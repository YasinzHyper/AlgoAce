"use client"

import Link from "next/link"
import { useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { EmptyState } from "@/components/layout/empty-state"
import { LeaderboardCard } from "@/components/practice/leaderboard-card"
import { cn } from "@/utils/supabase/utils"
import { useAuth } from "@/contexts/auth-context"
import { useDashboard } from "@/hooks/use-dashboard"
import { useChallengeStats } from "@/hooks/use-challenges"
import { useLeaderboard } from "@/hooks/use-leaderboard"
import type { PaceStatus } from "@/hooks/use-roadmap-progress"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Code2,
  Flame,
  Gauge,
  LayoutDashboard,
  Map,
  Medal,
  Play,
  Plus,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"

const PACE_BADGE: Record<PaceStatus, { label: string; className: string; icon: typeof Gauge }> = {
  ahead: {
    label: "Ahead of schedule",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: TrendingUp,
  },
  on_track: {
    label: "On track",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    icon: Gauge,
  },
  behind: {
    label: "Behind schedule",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    icon: AlertTriangle,
  },
  no_data: {
    label: "Not started",
    className: "border-muted bg-muted/40 text-muted-foreground",
    icon: Gauge,
  },
}

const QUICK_ACTIONS = [
  { href: "/problems", label: "Continue problems", icon: Code2 },
  { href: "/practice/challenges", label: "Start a challenge", icon: Timer },
  { href: "/practice/mock-interviews", label: "Mock interview", icon: Target },
  { href: "/analytics", label: "View analytics", icon: BarChart3 },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, loading, error, refresh } = useDashboard()
  const { stats: challengeStats } = useChallengeStats()
  // Only used for the "Your rank" stat card; full board is rendered via <LeaderboardCard>.
  const { me: myRank } = useLeaderboard("week", 5)

  const displayName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, string> | undefined
    return meta?.full_name || meta?.name || user?.email?.split("@")[0] || "there"
  }, [user])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={LayoutDashboard}
          title="Couldn't load your dashboard"
          description={error ?? "Something went wrong while fetching your data."}
          action={
            <Button onClick={() => refresh()} variant="outline">
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const { summary, roadmap, roadmap_count, next_task } = data
  const totals = summary.totals
  const pace = roadmap ? PACE_BADGE[roadmap.pace.status] ?? PACE_BADGE.no_data : null
  const PaceIcon = pace?.icon ?? Gauge
  const feedback = roadmap?.last_feedback ?? null
  const activeChallenge = challengeStats?.active_challenge ?? null
  const recent = summary.recent_activity.slice(0, 5)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting}, ${displayName}`}
        description="Here's where you stand today — pick up where you left off."
        actions={
          <Button asChild>
            <Link href={roadmap_count > 0 ? "/problems" : "/roadmap/create"}>
              {roadmap_count > 0 ? (
                <>
                  Continue <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  <Plus className="size-4" /> Create roadmap
                </>
              )}
            </Link>
          </Button>
        }
      />

      {/* Headline stats */}
      <div className="grid gap-4 stagger-children sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Problems Solved"
          value={totals.problems_solved}
          icon={CheckCircle2}
          sparkle={totals.problems_solved > 0}
          trend={
            totals.solved_this_week > 0
              ? { value: `+${totals.solved_this_week} this week`, positive: true }
              : undefined
          }
        />
        <StatCard
          title="Current Streak"
          value={`${totals.current_streak} ${totals.current_streak === 1 ? "day" : "days"}`}
          icon={Flame}
          sparkle={totals.current_streak > 0}
          description={`best ${totals.longest_streak}`}
        />
        <StatCard
          title="Challenge Points"
          value={challengeStats?.total_points ?? 0}
          icon={Trophy}
          description={
            challengeStats
              ? `${challengeStats.completed} done · best ${challengeStats.best_score}`
              : undefined
          }
        />
        <StatCard
          title="Leaderboard"
          value={myRank ? `#${myRank.rank}` : "—"}
          icon={Medal}
          description={myRank ? `${myRank.points} pts this week` : "no points yet"}
        />
      </div>

      {/* Active challenge resume banner */}
      {activeChallenge && (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Timer className="size-5 text-sky-600 dark:text-sky-400" />
                  Challenge in progress
                </CardTitle>
                <CardDescription>
                  {activeChallenge.title} · {activeChallenge.solved_count}/
                  {activeChallenge.total_count} solved
                </CardDescription>
              </div>
              <Button asChild>
                <Link href={`/practice/challenges/${activeChallenge.id}`}>
                  <Play className="size-4" /> Resume
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Active roadmap + leaderboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Map className="size-5 text-primary" />
                  {roadmap ? "Active roadmap" : "No roadmap yet"}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {roadmap
                    ? roadmap.goal ||
                      (roadmap.company ? `Preparing for ${roadmap.company}` : "Your study plan")
                    : "Create a personalized week-by-week plan to get started."}
                </CardDescription>
              </div>
              {pace && (
                <Badge variant="outline" className={cn("shrink-0 gap-1", pace.className)}>
                  <PaceIcon className="size-3" />
                  {pace.label}
                </Badge>
              )}
            </div>
          </CardHeader>
          {roadmap ? (
            <>
              <CardContent className="flex-1 space-y-5">
                {/* Overall vs expected */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-2xl font-bold tabular-nums">
                      {roadmap.overall.percentage}%
                    </span>
                    <span className="text-muted-foreground">
                      {roadmap.overall.completed}/{roadmap.overall.total} problems · week{" "}
                      {roadmap.pace.elapsed_weeks} of {roadmap.total_weeks}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={roadmap.overall.percentage} className="h-2" />
                    <div
                      className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-foreground/60"
                      style={{
                        left: `${Math.min(100, Math.max(0, roadmap.pace.expected_percentage))}%`,
                      }}
                      title={`Expected: ${roadmap.pace.expected_percentage}%`}
                    />
                  </div>
                  {roadmap.pace.days_remaining != null && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {roadmap.pace.days_remaining >= 0
                        ? `${roadmap.pace.days_remaining} days until deadline`
                        : `Deadline passed ${Math.abs(roadmap.pace.days_remaining)} days ago`}
                    </p>
                  )}
                </div>

                {/* Next up + weak topics */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Next up
                    </p>
                    {next_task ? (
                      <>
                        <p className="mt-1 font-medium">Week {next_task.week}</p>
                        <p className="text-sm text-muted-foreground">
                          {next_task.completed}/{next_task.total} problems done
                        </p>
                        <Button asChild size="sm" className="mt-3 w-full">
                          <Link
                            href={`/problems?roadmap=${next_task.roadmap_id}&week=${next_task.week}`}
                          >
                            Continue week {next_task.week}{" "}
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        All weeks complete — start a challenge to keep your streak.
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Needs attention
                    </p>
                    {roadmap.weak_topics.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {roadmap.weak_topics.slice(0, 4).map((t) => (
                          <Badge key={t.name} variant="secondary" className="gap-1">
                            {t.name}
                            <span className="text-[10px] text-muted-foreground">
                              {t.percentage}%
                            </span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        No weak areas detected yet.
                      </p>
                    )}
                    <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                      <Link href="/practice/challenges">
                        <Target className="size-4" /> Drill these
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="gap-2 border-t">
                <Button asChild variant="outline" className="flex-1 sm:flex-initial">
                  <Link href={`/roadmap/${roadmap.roadmap_id}`}>
                    View roadmap <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {roadmap_count > 1 && (
                  <Button asChild variant="ghost">
                    <Link href="/roadmap">All roadmaps ({roadmap_count})</Link>
                  </Button>
                )}
              </CardFooter>
            </>
          ) : (
            <CardContent className="flex-1">
              <EmptyState
                icon={Map}
                title="Create your first roadmap"
                description="Tell us your goal, target company and timeline — we'll build a week-by-week plan."
                className="border-0 bg-transparent p-6"
                action={
                  <Button asChild>
                    <Link href="/roadmap/create">
                      <Plus className="size-4" /> Create roadmap
                    </Link>
                  </Button>
                }
              />
            </CardContent>
          )}
        </Card>

        <LeaderboardCard defaultPeriod="week" limit={5} />
      </div>

      {/* AI Coach + 12-week trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI Coach
            </CardTitle>
            <CardDescription>
              {feedback
                ? `Generated ${formatDistanceToNow(new Date(feedback.generated_at), { addSuffix: true })}`
                : "Get a personalized read on your progress and what to focus on next."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedback ? (
              <>
                <p className="text-sm leading-relaxed">{feedback.summary}</p>
                {Array.isArray(feedback.focus_areas) && feedback.focus_areas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Focus areas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {feedback.focus_areas.slice(0, 4).map((fa, i) => (
                        <Badge key={`${fa.topic}-${i}`} variant="outline">
                          {fa.topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {roadmap
                  ? "No coaching feedback generated yet. Open your roadmap to generate one."
                  : "Coaching unlocks once you've created a roadmap and logged some progress."}
              </p>
            )}
          </CardContent>
          <CardFooter className="border-t">
            <Button asChild variant="outline" disabled={!roadmap}>
              <Link href={roadmap ? `/roadmap/${roadmap.roadmap_id}` : "/roadmap/create"}>
                {feedback ? "View full feedback" : "Generate feedback"}{" "}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>12-week trend</CardTitle>
            <CardDescription>Problems solved per week</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.weekly_progress.some((w) => w.problems > 0) ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={summary.weekly_progress}
                    margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                  >
                    <defs>
                      <linearGradient id="dashTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="problems"
                      name="Solved"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#dashTrend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Solve a problem to start your trend line.
              </p>
            )}
          </CardContent>
          <CardFooter className="border-t">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/analytics">
                Full analytics <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Recent activity + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Your latest solves and topic completions</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {recent.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nothing yet — mark a problem complete to see it here.
              </p>
            ) : (
              recent.map((item, idx) => (
                <div
                  key={`${item.type}-${item.problem_id ?? item.title}-${idx}`}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {item.type === "problem" && item.problem_id ? (
                        <Link
                          href={`/problems/${item.problem_id}`}
                          className="hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.topic}
                      {item.difficulty ? ` · ${item.difficulty}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump back in</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.href}
                asChild
                variant="outline"
                className="justify-start"
              >
                <Link href={action.href}>
                  <action.icon className="size-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
