"use client"

import { useMemo } from "react"
import { cn } from "@/utils/supabase/utils"

interface MeteorsProps {
  number?: number
  className?: string
}

/**
 * Shooting-star / meteor background effect. Absolutely positioned — place
 * inside a `relative overflow-hidden` container.
 */
export function Meteors({ number = 12, className }: MeteorsProps) {
  const meteors = useMemo(
    () =>
      Array.from({ length: number }, () => ({
        top: Math.floor(Math.random() * 100),
        left: Math.floor(Math.random() * 120) - 10,
        delay: (Math.random() * 1.2).toFixed(2),
        duration: (Math.random() * 5 + 5).toFixed(2),
      })),
    [number]
  )

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]",
        className
      )}
    >
      {meteors.map((m, i) => (
        <span
          key={i}
          className="absolute size-0.5 rotate-[215deg] animate-meteor rounded-full bg-primary shadow-[0_0_0_1px_#ffffff10] before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-primary before:to-transparent"
          style={{
            top: `${m.top}%`,
            left: `${m.left}%`,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
