// ---------------------------------------------------------------------------
// ThreatFlix — SplitFlapCounter
// Animated split-flap digit counter, airport departure board style.
// ---------------------------------------------------------------------------

import { useRef, useEffect, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface SplitFlapCounterProps {
  value: number;
  label: string;
  prefix?: string;
  accentColor?: string;
}

function formatWithCommas(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "0";
  return n.toLocaleString("en-US");
}

export function SplitFlapCounter({
  value,
  label,
  prefix = "",
  accentColor = "var(--ember-hot)",
}: SplitFlapCounterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayChars, setDisplayChars] = useState<string[]>([]);
  const prevCharsRef = useRef<string[]>([]);
  const isFirstRender = useRef(true);

  const formatted = prefix + formatWithCommas(value);
  const chars = formatted.split("");

  useGSAP(() => {
    // Skip animation on first render — just set chars
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayChars(chars);
      prevCharsRef.current = chars;
      return;
    }

    const prevChars = prevCharsRef.current;

    // Pad arrays to the same length (new number may have more digits)
    const maxLen = Math.max(chars.length, prevChars.length);
    const paddedPrev = prevChars.length < maxLen
      ? Array(maxLen - prevChars.length).fill("").concat(prevChars)
      : prevChars;
    const paddedNext = chars.length < maxLen
      ? Array(maxLen - chars.length).fill("").concat(chars)
      : chars;

    // Update display to target length immediately (for slot rendering)
    setDisplayChars(paddedNext);

    // After React re-renders, animate changed digits
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const slots = containerRef.current.querySelectorAll("[data-digit-slot]");

      slots.forEach((slot, i) => {
        const oldChar = paddedPrev[i] ?? "";
        const newChar = paddedNext[i] ?? "";

        if (oldChar === newChar) return;

        const digitEl = slot.querySelector("[data-digit]") as HTMLElement;
        if (!digitEl) return;

        // Animate: slide up out → reset below → slide up in
        gsap.fromTo(
          digitEl,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
            delay: i * 0.06,
          }
        );
      });
    });

    prevCharsRef.current = paddedNext;
  }, { dependencies: [value, prefix], scope: containerRef });

  // Ensure chars are set on mount
  useEffect(() => {
    if (displayChars.length === 0) {
      setDisplayChars(chars);
      prevCharsRef.current = chars;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-2">
      {/* Label */}
      <span className="text-label">{label}</span>

      {/* Digit slots */}
      <div className="flex items-center gap-[2px]">
        {displayChars.map((char, i) => {
          const isComma = char === ",";
          const isDot = char === ".";
          const isSeparator = isComma || isDot;

          if (isSeparator) {
            return (
              <span
                key={`sep-${i}`}
                style={{
                  fontFamily: "var(--font-primary)",
                  fontWeight: 800,
                  fontSize: "2.25rem",
                  color: "var(--text-muted)",
                  width: "0.6rem",
                  textAlign: "center",
                }}
              >
                {char}
              </span>
            );
          }

          return (
            <div
              key={`slot-${i}`}
              data-digit-slot
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--glass-border)",
                borderRadius: "6px",
                width: "2rem",
                height: "2.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <span
                data-digit
                style={{
                  fontFamily: "var(--font-primary)",
                  fontWeight: 800,
                  fontSize: "2.25rem",
                  lineHeight: 1,
                  color: accentColor,
                  willChange: "transform, opacity",
                }}
              >
                {char}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
