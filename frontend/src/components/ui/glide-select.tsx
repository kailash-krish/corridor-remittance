"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import "./glide-select.css";

export type GlideSelectOptionItem = { value: string; label: ReactNode; tag?: string };
export type GlideSelectOption = string | GlideSelectOptionItem;

type NormalizedOption = GlideSelectOptionItem;
type GlideSelectSize = "sm" | "md" | "lg";
type CloseMode = "instant" | "pop";

export interface GlideSelectProps {
  id?: string;
  options?: GlideSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: NormalizedOption) => void;
  placeholder?: string;
  showTags?: boolean;
  accentColor?: string;
  surfaceColor?: string;
  highlightColor?: string;
  textColor?: string;
  size?: GlideSelectSize;
  radius?: number;
  menuWidth?: number;
  menuZIndex?: number;
  placement?: "top" | "bottom";
  align?: "left" | "right";
  popDuration?: number;
  glideDuration?: number;
  rememberPosition?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const SIZES: Record<GlideSelectSize, { chip: number; row: number; font: number }> = {
  sm: { chip: 28, row: 26, font: 12 },
  md: { chip: 32, row: 30, font: 13 },
  lg: { chip: 44, row: 40, font: 14 },
};
const PAD = 4;
const GAP = 1;
const MENU_GAP = 6;
const DEFAULT_OPTIONS = ["One", "Two", "Three"];

function normalize(option: GlideSelectOption): NormalizedOption {
  return typeof option === "string"
    ? { value: option, label: option }
    : option;
}

function labelText(option: NormalizedOption) {
  return typeof option.label === "string" ? option.label : option.value;
}

function typeaheadIndex(items: NormalizedOption[], from: number, character: string) {
  if (!items.length) return from;
  const query = character.toLowerCase();
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (from + offset) % items.length;
    if (labelText(items[index]).toLowerCase().startsWith(query)) return index;
  }
  return from;
}

export default function GlideSelect({
  id: triggerId,
  options = DEFAULT_OPTIONS,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  showTags = true,
  accentColor = "#67e8f9",
  surfaceColor = "rgba(7, 18, 25, 0.98)",
  highlightColor = "rgba(0, 207, 255, 0.2)",
  textColor = "#f1f5f9",
  size = "md",
  radius = 12,
  menuWidth = 176,
  menuZIndex = 120,
  placement = "bottom",
  align = "left",
  popDuration = 180,
  glideDuration = 220,
  rememberPosition = true,
  disabled = false,
  ariaLabel = "Select",
  className = "",
}: GlideSelectProps) {
  const items = options.map(normalize);
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const currentValue = value !== undefined ? value : innerValue;
  const selectedIndex = items.findIndex((item) => item.value === currentValue);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [side, setSide] = useState(placement);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const instantRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubRef = useRef<{ pointerId: number; top: number } | null>(null);
  const id = useId();
  const dimensions = SIZES[size] ?? SIZES.md;
  const step = dimensions.row + GAP;
  const popOutDuration = Math.round((popDuration * 2) / 3);

  const close = useCallback((mode: CloseMode) => {
    setActiveIndex(null);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

    const menu = menuRef.current;
    if (mode === "instant" || !menu) {
      setPhase("closed");
      return;
    }

    menu.style.transitionDuration = "";
    menu.dataset.state = "closed";
    setPhase("closing");
    closeTimerRef.current = setTimeout(() => setPhase("closed"), popOutDuration + 20);
  }, [popOutDuration]);

  const open = useCallback((viaKeyboard: boolean) => {
    if (disabled || !items.length) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    instantRef.current = true;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : viaKeyboard ? 0 : null);
    setPhase("open");
  }, [disabled, items.length, selectedIndex]);

  const pick = useCallback((index: number, viaKeyboard: boolean) => {
    const option = items[index];
    if (!option) {
      close("instant");
      return;
    }
    if (option.value !== currentValue) {
      if (value === undefined) setInnerValue(option.value);
      onChange?.(option.value, option);
      if (!viaKeyboard && rootRef.current) rootRef.current.dataset.swap = "";
    }
    close("instant");
    triggerRef.current?.focus({ preventScroll: true });
  }, [close, currentValue, items, onChange, setInnerValue, value]);

  useLayoutEffect(() => {
    if (phase !== "open") return;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuWidthInView = Math.min(
      Math.max(menu.offsetWidth, triggerRect.width),
      Math.max(0, window.innerWidth - 16)
    );
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const nextSide = placement === "bottom" && spaceBelow < menuHeight + MENU_GAP
      ? "top"
      : placement === "top" && triggerRect.top < menuHeight + MENU_GAP
        ? "bottom"
        : placement;
    const proposedLeft = align === "right"
      ? triggerRect.right - menuWidthInView
      : triggerRect.left;
    const left = Math.max(8, Math.min(proposedLeft, window.innerWidth - menuWidthInView - 8));
    const proposedTop = nextSide === "bottom"
      ? triggerRect.bottom + MENU_GAP
      : triggerRect.top - menuHeight - MENU_GAP;
    const top = Math.max(8, Math.min(proposedTop, window.innerHeight - menuHeight - 8));

    setSide(nextSide);
    setPosition({ top, left, width: menuWidthInView });
    menu.style.transitionDuration = instantRef.current ? "0ms" : "";
    menu.dataset.state = "closed";
    void menu.offsetHeight;
    menu.dataset.state = "open";

    const pill = pillRef.current;
    if (pill) {
      pill.style.transition = "none";
      pill.style.transform = `translateY(${Math.max(0, selectedIndex) * step}px)`;
      pill.style.opacity = "0";
      void pill.offsetHeight;
      pill.style.transition = "";
    }
  }, [align, phase, placement, selectedIndex, step]);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill || phase !== "open") return;
    if (activeIndex === null) {
      pill.style.opacity = "0";
      return;
    }
    const jump = instantRef.current || pill.style.opacity !== "1";
    pill.style.transitionDuration = jump ? "0ms, 150ms" : "";
    pill.style.transform = `translateY(${activeIndex * step}px)`;
    pill.style.opacity = "1";
    instantRef.current = false;
  }, [activeIndex, phase, step]);

  useEffect(() => {
    if (phase === "closed") return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close("pop");
    };
    const closeOnViewportChange = (event: Event) => {
      if (menuRef.current && event.target && (menuRef.current === event.target || menuRef.current.contains(event.target as Node))) {
        return;
      }
      close("instant");
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [close, phase]);

  useEffect(() => {
    if (!disabled || phase === "closed") return;
    const timeout = window.setTimeout(() => close("instant"), 0);
    return () => window.clearTimeout(timeout);
  }, [close, disabled, phase]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const rowAt = (y: number) => {
    const scrub = scrubRef.current;
    if (!scrub) return null;
    const scrollTop = menuRef.current?.scrollTop ?? 0;
    const index = Math.floor((y - scrub.top + scrollTop - PAD) / step);
    return index >= 0 && index < items.length ? index : null;
  };

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    const currentIndex = activeIndex ?? Math.max(0, selectedIndex);
    if (phase !== "open") {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(key)) {
        event.preventDefault();
        open(true);
      }
      return;
    }

    const goTo = (index: number) => {
      event.preventDefault();
      instantRef.current = true;
      setActiveIndex(Math.min(items.length - 1, Math.max(0, index)));
    };
    if (key === "ArrowDown" || key === "ArrowUp") {
      goTo(activeIndex === null ? currentIndex : currentIndex + (key === "ArrowDown" ? 1 : -1));
    } else if (key === "Home" || key === "End") {
      goTo(key === "Home" ? 0 : items.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      pick(currentIndex, true);
    } else if (key === "Escape" || key === "Tab") {
      if (key === "Escape") {
        event.preventDefault();
        triggerRef.current?.focus({ preventScroll: true });
      }
      close("instant");
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      goTo(typeaheadIndex(items, currentIndex, key));
    }
  }

  function onListPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (scrubRef.current) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional for browsers that do not support it.
    }
    scrubRef.current = { pointerId: event.pointerId, top: event.currentTarget.getBoundingClientRect().top };
    instantRef.current = true;
    setActiveIndex(rowAt(event.clientY));
  }

  function onListPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!scrubRef.current || scrubRef.current.pointerId !== event.pointerId) return;
    const index = rowAt(event.clientY);
    if (index !== activeIndex) setActiveIndex(index);
  }

  function onListPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!scrubRef.current || scrubRef.current.pointerId !== event.pointerId) return;
    const index = event.type === "pointerup" ? rowAt(event.clientY) : null;
    scrubRef.current = null;
    if (index !== null) pick(index, false);
    else if (!rememberPosition) setActiveIndex(null);
  }

  function onListPointerOver(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || scrubRef.current) return;
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>("[data-index]");
    if (!row) return;
    const index = Number(row.dataset.index);
    if (index !== activeIndex) setActiveIndex(index);
  }

  const popOrigin = `${side === "bottom" ? "top" : "bottom"} ${align}`;
  const themeStyle: CSSProperties = {
    "--gs-accent": accentColor,
    "--gs-surface": surfaceColor,
    "--gs-highlight": highlightColor,
    "--gs-text": textColor,
    "--gs-radius": `${radius}px`,
    "--gs-inner-radius": `${Math.max(3, radius - 4)}px`,
    "--gs-chip": `${dimensions.chip}px`,
    "--gs-row": `${dimensions.row}px`,
    "--gs-font": `${dimensions.font}px`,
    "--gs-menu-w": `${menuWidth}px`,
    "--gs-pop": `${popDuration}ms`,
    "--gs-pop-out": `${popOutDuration}ms`,
    "--gs-glide": `${glideDuration}ms`,
    "--gs-origin": popOrigin,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`glide-select${className ? ` ${className}` : ""}`}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      onAnimationEnd={(event) => {
        if (event.animationName === "gs-swap" && rootRef.current) delete rootRef.current.dataset.swap;
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={phase === "open"}
        aria-controls={`${id}-list`}
        aria-activedescendant={activeIndex !== null ? `${id}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        className="glide-select__trigger"
        style={themeStyle}
        onPointerDown={(event) => {
          if (event.button !== 0 || disabled) return;
          event.currentTarget.focus({ preventScroll: true });
          if (phase === "open") close("pop");
          else open(false);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="glide-select__label" key={currentValue} data-empty={selectedIndex < 0 ? "" : undefined}>
          {selectedIndex >= 0 ? items[selectedIndex].label : placeholder}
        </span>
        <span className="glide-select__chevron" aria-hidden="true">
          <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2.5} />
        </span>
      </button>

      {typeof document !== "undefined" && phase !== "closed" && createPortal(
        <div
          ref={menuRef}
          className="glide-select__menu"
          data-state={phase === "closing" ? "closed" : "open"}
          data-side={side}
          data-align={align}
          style={{
            ...themeStyle,
            position: "fixed",
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            width: position?.width ?? menuWidth,
            zIndex: menuZIndex,
          }}
        >
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            className="glide-select__list"
            data-live={activeIndex !== null ? "" : undefined}
            onPointerOver={onListPointerOver}
            onPointerLeave={() => {
              if (!scrubRef.current && !rememberPosition) setActiveIndex(null);
            }}
            onPointerDown={onListPointerDown}
            onPointerMove={onListPointerMove}
            onPointerUp={onListPointerUp}
            onPointerCancel={onListPointerUp}
            onLostPointerCapture={onListPointerUp}
          >
            <span ref={pillRef} className="glide-select__pill" aria-hidden="true" />
            {items.map((item, index) => (
              <div
                key={item.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-index={index}
                className="glide-select__option"
                onClick={(e) => {
                  e.stopPropagation();
                  pick(index, false);
                }}
              >
                <span className="glide-select__name">{item.label}</span>
                {showTags && item.tag ? <span className="glide-select__tag">{item.tag}</span> : null}
                <span className="glide-select__check" data-on={index === selectedIndex ? "" : undefined} aria-hidden="true">
                  <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.5} />
                </span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}