import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Sparkles } from "@/components/magicui/sparkles"
import { cn } from "@/utils/supabase/utils"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: string
    positive?: boolean
  }
  /** Adds a subtle twinkling-star backdrop inside the card. */
  sparkle?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  sparkle,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "group relative gap-0 overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      {sparkle && <Sparkles density={12} color="text-primary/20" />}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {(trend || description) && (
            <p className="flex items-center gap-1.5 text-xs">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    trend.positive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {trend.positive ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {trend.value}
                </span>
              )}
              {description && (
                <span className="text-muted-foreground">{description}</span>
              )}
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </Card>
  )
}
