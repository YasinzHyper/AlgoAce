"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/layout/empty-state"
import { cn } from "@/utils/supabase/utils"
import {
  useRoadmapProgress,
  type PaceStatus,
  type RoadmapFocusArea,
  type RoadmapTopicStrength,
} from "@/hooks/use-roadmap-progress"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

const PACE_STYLES: Record<
  PaceStatus,
  { label: string; badge: string; icon: typeof TrendingUp }
> = {
  ahead: {
    label: "Ahead of schedule",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: TrendingUp,
  },
  on_track: {
    label: "On track",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    icon: Gauge,
  },
  behind: {
    label: "Behind schedule",
    badge:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    icon: AlertTriangle,
  },
  no_data: {
    label: "Not started",
    badge: "border-muted bg-muted/40 text-muted-foreground",
    icon: Gauge,
  },
}

interface RoadmapProgressPanelProps {
  roadmapId: number
  className?: string
}

/**
 * Full progress + AI-coaching surface for a single roadmap. Renders overall
 * completion vs expected pace, a per-week breakdown, strongest/weakest topics
 * and the most recent AI feedback (with a regenerate action).
 */
export function RoadmapProgressPanel({ roadmapId, className }: RoadmapProgressPanelProps) {
  const { data, feedback, loading, generating, error, refresh, generateFeedback } =
    useRoadmapProgress(roadmapId)

  const handleGenerate = async () => {
    try {
      await generateFeedback()
      toast.success("Feedback updated")
    } catch (e) {
      toast.error("Couldn't generate feedback", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  if (loading) {
    return (
      <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
        <Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={Gauge}
        title="Couldn't load roadmap progress"
        description={error ?? "Something went wrong while computing your progress."}
        action={
          <Button variant="outline" onClick={() => refresh()}>
            Try again
          </Button>
        }
        className={className}
      />
    )
  }

  const paceStyle = PACE_STYLES[data.pace.status] ?? PACE_STYLES.no_data
  const PaceIcon = paceStyle.icon
  const deltaLabel =
    data.pace.status === "no_data"
      ? "Mark a problem complete to start tracking"
      : `${data.pace.delta >= 0 ? "+" : ""}${data.pace.delta}% vs plan`

  return (
    <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
      {/* ---- Progress vs plan -------------------------------------------- */}
      <Card className="lg:col-span-2">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5 text-primary" />
                Progress vs plan
              </CardTitle>
              <CardDescription>
                Week {data.pace.elapsed_weeks} of {data.total_weeks}
                {data.pace.days_remaining != null && (
                  <>
                    {" · "}
                    {data.pace.days_remaining >= 0
                      ? `${data.pace.days_remaining} days to deadline`
                      : `${Math.abs(data.pace.days_remaining)} days past deadline`}
                  </>
                )}
              </CardDescription>
            </div>
            <Badge variant="outline" className={cn("gap-1.5", paceStyle.badge)}>
              <PaceIcon className="size-3.5" />
              {paceStyle.label}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-2xl font-bold tracking-tight">
                {data.overall.percentage}%
              </span>
              <span className="text-muted-foreground">
                {data.overall.completed}/{data.overall.total} problems
              </span>
            </div>
            <div className="relative">
              <Progress value={data.overall.percentage} className="h-2.5" />
              {data.pace.status !== "no_data" && (
                <div
                  className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-foreground/60"
                  style={{
                    left: `${Math.min(100, Math.max(0, data.pace.expected_percentage))}%`,
                  }}
                  title={`Expected: ${data.pace.expected_percentage}%`}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{deltaLabel}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2.5">
            {data.weeks.map((w) => (
              <div key={w.task_id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    href={`/problems?roadmap=${roadmapId}&week=${w.week}`}
                    className="font-medium hover:underline"
                  >
                    Week {w.week}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {w.completed}/{w.total}
                    {w.topics_total > 0 && ` · ${w.topics_completed}/${w.topics_total} topics`}
                  </span>
                </div>
                <Progress
                  value={w.percentage}
                  className={cn(
                    "h-1.5",
                    w.percentage === 100 && "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                  )}
                />
              </div>
            ))}
            {data.weeks.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No tasks generated for this roadmap yet.
              </p>
            )}
          </div>

          {(data.strong_topics.length > 0 || data.weak_topics.length > 0) && (
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <TopicList
                title="Strongest topics"
                icon={ThumbsUp}
                accent="text-emerald-600 dark:text-emerald-400"
                topics={data.strong_topics}
                emptyLabel="Complete a few more problems to surface strengths."
              />
              <TopicList
                title="Needs attention"
                icon={AlertTriangle}
                accent="text-amber-600 dark:text-amber-400"
                topics={data.weak_topics}
                emptyLabel="No weak areas detected yet."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- AI feedback ------------------------------------------------- */}
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                AI Coach
              </CardTitle>
              <CardDescription>
                Personalized review of how you&apos;re tracking toward your goal.
              </CardDescription>
            </div>
            {feedback && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGenerate}
                disabled={generating}
                aria-label="Regenerate feedback"
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {!feedback ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">
                Generate an AI review of your pace, strengths and what to focus on
                next to hit your goal.
              </p>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Generate feedback
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="font-medium leading-relaxed">{feedback.summary}</p>

              <FeedbackBlock
                icon={CheckCircle2}
                accent="text-emerald-600 dark:text-emerald-400"
                title="What's working"
                body={feedback.positive_feedback}
              />
              <FeedbackBlock
                icon={AlertTriangle}
                accent="text-rose-600 dark:text-rose-400"
                title="What's at risk"
                body={feedback.negative_feedback}
              />

              {feedback.focus_areas?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Target className="size-3.5" /> Focus next
                  </h4>
                  <ul className="space-y-2">
                    {feedback.focus_areas.map((area: RoadmapFocusArea, idx) => (
                      <li
                        key={`${area.topic}-${idx}`}
                        className="rounded-md border bg-muted/40 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <div className="space-y-0.5">
                            <p className="font-medium">{area.topic}</p>
                            {area.reason && (
                              <p className="text-xs text-muted-foreground">{area.reason}</p>
                            )}
                            {area.action && (
                              <p className="text-xs">
                                <span className="text-muted-foreground">Next step: </span>
                                {area.action}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="border-t pt-3 text-xs text-muted-foreground">
                Generated{" "}
                {formatDistanceToNow(new Date(feedback.generated_at), { addSuffix: true })} at{" "}
                {feedback.completion_percentage}% complete
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TopicList({
  title,
  icon: Icon,
  accent,
  topics,
  emptyLabel,
}: {
  title: string
  icon: typeof ThumbsUp
  accent: string
  topics: RoadmapTopicStrength[]
  emptyLabel: string
}) {
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("size-3.5", accent)} /> {title}
      </h4>
      {topics.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {topics.map((t) => (
            <li key={t.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{t.name}</span>
              <span className={cn("shrink-0 font-medium tabular-nums", accent)}>
                {t.completed}/{t.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FeedbackBlock({
  icon: Icon,
  accent,
  title,
  body,
}: {
  icon: typeof CheckCircle2
  accent: string
  title: string
  body: string
}) {
  if (!body) return null
  return (
    <div className="space-y-1">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("size-3.5", accent)} /> {title}
      </h4>
      <p className="leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
