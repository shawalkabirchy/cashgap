"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; ariaLabel?: string };

/**
 * A single-choice control whose ink pill slides to the chosen option.
 * Items keep Radix's `role="radio"` semantics and keyboard behaviour.
 */
export function SegmentedControl({
  value,
  options,
  onValueChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  options: Option[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(
    null,
  );
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const active = element.querySelector<HTMLElement>(
        '[data-slot="toggle-group-item"][data-state="on"]',
      );
      setBox(
        active ? { left: active.offsetLeft, width: active.offsetWidth } : null,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, options.length]);

  useLayoutEffect(() => {
    if (!box || animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [box, animate]);

  return (
    <ToggleGroup
      ref={root}
      type="single"
      size="sm"
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn("segmented", className)}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
    >
      <span
        aria-hidden="true"
        className="segment-indicator"
        data-animate={animate}
        style={
          box
            ? { transform: `translateX(${box.left}px)`, width: box.width }
            : { opacity: 0 }
        }
      />
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel ?? option.label}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
