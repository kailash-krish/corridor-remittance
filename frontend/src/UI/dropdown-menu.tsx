"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export type DropdownOption = {
  label: string;
  onClick: () => void | Promise<void>;
  Icon?: React.ReactNode;
  disabled?: boolean;
  /** red text, for destructive actions such as Delete */
  danger?: boolean;
};

export type DropdownMenuProps = {
  options: DropdownOption[];
  children: React.ReactNode;
  /** which edge of the button the menu lines up with */
  align?: "left" | "right";
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
};

/**
 * Action menu (e.g. "Send via", row actions).
 *
 * Differences from the original: uses theme tokens instead of hard-coded dark colours,
 * closes on outside click / Escape / selecting an item, full keyboard support
 * (Arrow keys, Home/End, Tab) and menu ARIA roles, disabled + danger items, subtler animation.
 */
export function DropdownMenu({
  options,
  children,
  align = "left",
  variant = "outline",
  size,
  disabled,
  className,
  menuClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const pendingFocusRef = React.useRef<"first" | "last" | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = React.useId();
  const reduceMotion = useReducedMotion();

  const enabledIndexes = () =>
    options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const focusIndex = (i: number | undefined) => {
    if (i === undefined) return;
    itemRefs.current[i]?.focus();
  };

  const closeAndRefocus = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current.offsetWidth;
    const maxHeight = Math.max(0, window.innerHeight - 16);
    const menuHeight = Math.min(menuRef.current.offsetHeight, maxHeight);
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const top = spaceBelow < menuHeight + 8
      ? Math.max(8, triggerRect.top - menuHeight - 8)
      : Math.min(triggerRect.bottom + 8, window.innerHeight - menuHeight - 8);
    const proposedLeft = align === "right"
      ? triggerRect.right - menuWidth
      : triggerRect.left;
    const left = Math.max(8, Math.min(proposedLeft, window.innerWidth - menuWidth - 8));

    setPosition({ top, left, maxHeight });
  }, [open, align]);

  // Close when clicking outside, pressing Escape, scrolling, or resizing.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closeAndRefocus();
    };
    const closeOnViewportChange = (e: Event) => {
      if (menuRef.current && e.target && (menuRef.current === e.target || menuRef.current.contains(e.target as Node))) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [open, closeAndRefocus]);

  // Move focus into the menu after it opens from the keyboard
  React.useEffect(() => {
    const pendingFocus = pendingFocusRef.current;
    if (!open || !pendingFocus) return;
    const list = enabledIndexes();
    focusIndex(pendingFocus === "first" ? list[0] : list[list.length - 1]);
    pendingFocusRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      pendingFocusRef.current = e.key === "ArrowDown" ? "first" : "last";
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const list = enabledIndexes();
    if (list.length === 0) return;
    const active = itemRefs.current.findIndex((el) => el === document.activeElement);
    const pos = list.indexOf(active);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusIndex(list[(pos + 1) % list.length]);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusIndex(list[(pos - 1 + list.length) % list.length]);
        break;
      case "Home":
        e.preventDefault();
        focusIndex(list[0]);
        break;
      case "End":
        e.preventDefault();
        focusIndex(list[list.length - 1]);
        break;
      case "Escape":
        e.preventDefault();
        closeAndRefocus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  async function select(option: DropdownOption) {
    if (option.disabled) return;
    closeAndRefocus();
    await option.onClick();
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        {children ?? "Menu"}
        {size !== "icon" && (
          <motion.span
            className="ml-2 inline-flex"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        )}
      </Button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              onKeyDown={onMenuKeyDown}
              initial={{ opacity: 0, y: reduceMotion ? 0 : -4, scale: reduceMotion ? 1 : 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -4, scale: reduceMotion ? 1 : 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
              style={{
                position: "fixed",
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                maxHeight: position?.maxHeight ?? "calc(100vh - 16px)",
                overflowY: "auto",
                zIndex: 120,
              }}
              className={cn(
                "min-w-48 max-w-[calc(100vw-16px)] rounded-xl border border-white/10 bg-popover p-1 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl",
                menuClassName
              )}
            >
              {options.length > 0 ? (
                options.map((option, index) => (
                  <button
                    key={option.label}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    disabled={option.disabled}
                    onClick={() => select(option)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors",
                      "hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50",
                      option.danger && "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                    )}
                  >
                    {option.Icon}
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">No options</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
