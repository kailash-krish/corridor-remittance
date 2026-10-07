"use client";

import {
  createElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export interface TextTypeProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** One sentence or a list of sentences to type out */
  text: string | string[];
  as?: ElementType;
  /** ms per character */
  typingSpeed?: number;
  /** ms before the first character */
  initialDelay?: number;
  /** ms to wait after a sentence is fully typed */
  pauseDuration?: number;
  /** ms per deleted character */
  deletingSpeed?: number;
  loop?: boolean;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: ReactNode;
  cursorClassName?: string;
  /** seconds for one blink */
  cursorBlinkDuration?: number;
  /** colour per sentence (cycled) */
  textColors?: string[];
  /** random typing speed in ms for a human feel */
  variableSpeed?: { min: number; max: number };
  onSentenceComplete?: (sentence: string, index: number) => void;
  /** wait until scrolled into view */
  startOnVisible?: boolean;
}

type Phase = "typing" | "deleting";

/**
 * Typing effect.
 *
 * Differences from the React Bits version: TypeScript, no gsap (the cursor blink uses the
 * Web Animations API), no separate CSS file, honours prefers-reduced-motion (shows the first
 * sentence statically), and screen readers get the full text instead of half-typed words.
 */
export function TextType({
  text,
  as: Component = "div",
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorClassName = "",
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  ...props
}: TextTypeProps) {
  // Stable key so an inline array literal from the parent does not restart the animation
  const key = Array.isArray(text) ? text.join("\u0000") : text;
  const sentences = useMemo(() => key.split("\u0000"), [key]);

  const [display, setDisplay] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [started, setStarted] = useState(false);
  const [visible, setVisible] = useState(!startOnVisible);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const visibilityId = useId();
  const containerId = props.id ?? visibilityId;
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const onCompleteRef = useRef(onSentenceComplete);
  useEffect(() => {
    onCompleteRef.current = onSentenceComplete;
  });

  const minSpeed = variableSpeed?.min;
  const maxSpeed = variableSpeed?.max;

  // Restart if the sentences change
  useEffect(() => {
    const id = setTimeout(() => {
      setDisplay("");
      setTextIndex(0);
      setPhase("typing");
    }, 0);
    return () => clearTimeout(id);
  }, [key]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!startOnVisible) return;
    const element = document.getElementById(containerId);
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { threshold: 0.1 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerId, startOnVisible]);

  useEffect(() => {
    if (!visible || reduceMotion) return;
    const id = setTimeout(() => setStarted(true), initialDelay);
    return () => clearTimeout(id);
  }, [visible, reduceMotion, initialDelay]);

  // Cursor blink (replaces gsap)
  useEffect(() => {
    const el = cursorRef.current;
    if (!showCursor || !el || reduceMotion || typeof el.animate !== "function") return;
    const animation = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: cursorBlinkDuration * 1000,
      iterations: Infinity,
      direction: "alternate",
      easing: "ease-in-out",
    });
    return () => animation.cancel();
  }, [showCursor, cursorBlinkDuration, reduceMotion]);

  // Typing / pausing / deleting loop
  useEffect(() => {
    if (!started || reduceMotion) return;
    const current = sentences[textIndex] ?? "";
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (phase === "typing") {
      if (display.length < current.length) {
        const delay =
          minSpeed !== undefined && maxSpeed !== undefined
            ? Math.random() * (maxSpeed - minSpeed) + minSpeed
            : typingSpeed;
        timer = setTimeout(() => setDisplay(current.slice(0, display.length + 1)), delay);
      } else {
        const isLast = textIndex === sentences.length - 1;
        timer = setTimeout(() => {
          onCompleteRef.current?.(current, textIndex);
          if (isLast && !loop) return;
          setPhase("deleting");
        }, pauseDuration);
      }
    } else if (display.length > 0) {
      timer = setTimeout(() => setDisplay((d) => d.slice(0, -1)), deletingSpeed);
    } else {
      timer = setTimeout(() => {
        setTextIndex((i) => (i + 1) % sentences.length);
        setPhase("typing");
      }, 0);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    started,
    reduceMotion,
    sentences,
    textIndex,
    phase,
    display,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    loop,
    minSpeed,
    maxSpeed,
  ]);

  const current = sentences[textIndex] ?? "";
  const typingNow = phase === "deleting" || display.length < current.length;
  const color = textColors.length ? textColors[textIndex % textColors.length] : undefined;
  const shown = reduceMotion ? sentences[0] : display;

  return createElement(
    Component,
    {
      className: `inline-block whitespace-pre-wrap ${className}`.trim(),
      ...props,
      id: containerId,
    },
    <span key="sr" className="sr-only">
      {sentences.join(". ")}
    </span>,
    <span key="content" aria-hidden="true" style={color ? { color } : undefined}>
      {shown}
    </span>,
    showCursor && !reduceMotion ? (
      <span
        key="cursor"
        ref={cursorRef}
        aria-hidden="true"
        className={`ml-1 inline-block ${hideCursorWhileTyping && typingNow ? "hidden" : ""} ${cursorClassName}`.trim()}
      >
        {cursorCharacter}
      </span>
    ) : null
  );
}

export default TextType;
