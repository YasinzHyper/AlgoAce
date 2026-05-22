"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/utils/supabase/utils"
import { useLeaderboard, type LeaderboardPeriod } from "@/hooks/use-leaderboard"
import { Crown, Trophy } from "lucide-react"

interface LeaderboardCardProps {
  defaultPeriod?: LeaderboardPeriod
  limit?: number
  className?: string
}

const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  week: "This week",
  month: "This month",
  all: "All time",
}

/**
 * Points-based leaderboard backed by `GET /api/challenges/leaderboard`.
 * The caller's own row is highlighted and pinned even when outside the top N.
 */
export function LeaderboardCard({
  defaultPeriod = "week",
  limit = 10,
  className,
}: LeaderboardCardProps) {
  const { period, setPeriod, entries, me, loading, error } = useLeaderboard(
    defaultPeriod,
    limit
  )

  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" />
              Leaderboard
            </CardTitle>
            <CardDescription>{PERIOD_LABEL[period]} · points from solves & challenges</CardDescription>
          </div>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{error}</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activity in this period yet — solve a problem or finish a challenge to
            appear here.
          </p>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry) => (
              <li
                key={entry.user_id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                  entry.is_me
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      entry.rank === 1
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                        : entry.rank === 2
                          ? "bg-slate-400/20 text-slate-700 dark:text-slate-300"
                          : entry.rank === 3
                            ? "bg-orange-700/20 text-orange-800 dark:text-orange-400"
                            : "bg-muted"
                    )}
                  >
                    {entry.rank}
                  </span>
                  <span className="truncate">
                    {entry.is_me ? "You" : entry.display_name}
                  </span>
                  {entry.rank === 1 && <Crown className="size-3.5 shrink-0 text-amber-500" />}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-semibold tabular-nums">{entry.points}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {entry.problems_solved} solved
                  </span>
                </span>
              </li>
            ))}
            {me && !entries.some((e) => e.is_me) && (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                You haven&apos;t scored any points {PERIOD_LABEL[period].toLowerCase()} yet.
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
