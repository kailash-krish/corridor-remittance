import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DarkGradientBgProps {
  children?: ReactNode;
  className?: string;
}

const STREAK_MASKS = [
  "linear-gradient(90deg, transparent 0%, #000 20%, transparent 36%, #000 55%, rgb(0 0 0 / 0.13) 67%, #000 78%, transparent 97%)",
  "linear-gradient(90deg, transparent 11%, #000 25%, rgb(0 0 0 / 0.55) 41%, rgb(0 0 0 / 0.13) 67%, #000 78%, transparent 97%)",
  "linear-gradient(90deg, transparent 9%, #000 20%, rgb(0 0 0 / 0.55) 28%, rgb(0 0 0 / 0.424) 40%, #000 48%, rgb(0 0 0 / 0.267) 54%, rgb(0 0 0 / 0.13) 78%, #000 88%, transparent 97%)",
  "linear-gradient(90deg, transparent 0%, #000 17%, rgb(0 0 0 / 0.55) 26%, #000 35%, transparent 47%, rgb(0 0 0 / 0.13) 69%, #000 79%, transparent 97%)",
  "linear-gradient(90deg, transparent 0%, #000 20%, rgb(0 0 0 / 0.55) 27%, #000 42%, transparent 48%, rgb(0 0 0 / 0.13) 67%, #000 74%, #000 82%, rgb(0 0 0 / 0.47) 88%, transparent 97%)",
];

export function DarkGradientBg({ children, className }: DarkGradientBgProps) {
  return (
    <div className={cn("relative min-h-screen w-full bg-black", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(100% 100% at 0% 0%, rgb(46 46 46) 0%, #000 100%)",
            mask: "radial-gradient(125% 100% at 0% 0%, #000 0%, rgb(0 0 0 / 0.224) 88.2883%, transparent 100%)",
          }}
        />
        {STREAK_MASKS.map((mask) => (
          <div
            key={mask}
            className="absolute inset-0 opacity-20"
            style={{
              background: "linear-gradient(#00cfff 0%, transparent 100%)",
              mask,
              transform: "skewX(45deg)",
            }}
          />
        ))}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(circle, rgb(255 255 255 / 0.45) 0.5px, transparent 0.8px)",
            backgroundSize: "3px 3px",
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.5) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgb(15 45 62 / 0.2), transparent 62%)",
          }}
        />
      </div>
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
