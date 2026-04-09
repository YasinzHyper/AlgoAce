"use client"

import { useMemo } from "react"
import { cn } from "@/utils/supabase/utils"

interface SparklesProps {
  density?: number
  className?: string
  /** Tailwind color class for the sparkle fill, e.g. `text-primary/40` */
  color?: string
}

/**
 * Subtle twinkling-star backdrop. Absolutely positioned — place inside a
 * `relative overflow-hidden` container.
 */
export function Sparkles({ density = 18, color = "text-primary/30", className }: SparklesProps) {
  const stars = useMemo(
    () =>
      Array.from({ length: density }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 6 + 4,
        delay: Math.random() * 2.5,
        duration: Math.random() * 2 + 2,
      })),
    [density]
  )

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {stars.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={cn("absolute animate-sparkle", color)}
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          <path
            fill="currentColor"
            d="M12 2l1.8 5.6L20 10l-6.2 2.4L12 18l-1.8-5.6L4 10l6.2-2.4L12 2z"
          />
        </svg>
      ))}
    </div>
  )
}
