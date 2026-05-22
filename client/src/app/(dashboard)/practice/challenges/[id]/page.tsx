"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { cn } from "@/utils/supabase/utils"
import {
  useChallenge,
  type ChallengeProblem,
  type ChallengeResult,
} from "@/hooks/use-challenges"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Flag,
  Gauge,
  Loader2,
  RotateCcw,
  Tag,
  Timer as TimerIcon,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

const DIFFICULTY_BADGE: Record<string, string> = {
  Easy: "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Medium: "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Hard: "border-rose-500/20 bg-rose-500/15 text-rose-700 dark:text-rose-400",
}

const DIFFICULTY_POINTS: Record<string, number> = { Easy: 10, Medium: 25, Hard: 50 }

function formatClock(seconds: number) {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/**
 * Live challenge session: countdown timer, mark-solved problem list, submit /
 * abandon actions, and a results summary once finalised. Also serves as the
 * read-only history detail view for completed/abandoned challenges.
 */
export default function ChallengeSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const challengeId = /^\d+$/.test(id) ? parseInt(id, 10) : null

  const {
    challenge,
    result,
    loading,
    pendingProblemId,
    completing,
    error,
    markSolved,
    complete,
  } = useChallenge(challengeId)

  // ---- Live countdown -------------------------------------------------------
  // Derived from server-authoritative `expires_at_epoch` so the timer survives
  // refresh / tab-switch and stays in sync across devices.
  const [remaining, setRemaining] = useState<number | null>(null)
  const autoFinalisedRef = useRef(false)

  const expiresAtEpoch =
    challenge?.status === "active" ? (challenge.expires_at_epoch ?? null) : null

  useEffect(() => {
    if (expiresAtEpoch == null) {
      setRemaining(null)
      return
    }
    const compute = () => Math.max(0, Math.round(expiresAtEpoch - Date.now() / 1000))
    setRemaining(compute())
    const interval = setInterval(() => setRemaining(compute()), 1000)
    return () => clearInterval(interval)
  }, [expiresAtEpoch])

  // Auto-finalise once when the clock hits zero on an active session.
  useEffect(() => {
    if (
      challenge?.status === "active" &&
      remaining === 0 &&
      !completing &&
      !autoFinalisedRef.current
    ) {
      autoFinalisedRef.current = true
      complete({ elapsed_seconds: challenge.duration_minutes * 60 }).catch(() => {
        autoFinalisedRef.current = false
      })
    }
  }, [remaining, challenge?.status, challenge?.duration_minutes, completing, complete])

  const elapsedSeconds = useMemo(() => {
    if (!challenge) return 0
    const total = challenge.duration_minutes * 60
    return remaining != null ? Math.min(total, total - remaining) : total
  }, [challenge, remaining])

  const handleSubmit = async (abandoned = false) => {
    try {
      const res = await complete({ elapsed_seconds: elapsedSeconds, abandoned })
      if (!abandoned && res) {
        toast.success(`Challenge complete — ${res.score} pts`)
      } else {
        toast.message("Challenge ended")
      }
    } catch (e) {
      toast.error("Couldn't finalise challenge", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  const handleToggle = async (problemId: number, solved: boolean) => {
    try {
      await markSolved(problemId, solved)
    } catch (e) {
      toast.error("Couldn't update problem", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  // ---- Loading / error states ----------------------------------------------
  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Challenge" description="Loading session..." />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !challenge) {
    return (
      <div className="space-y-8">
        <PageHeader title="Challenge" />
        <EmptyState
          icon={XCircle}
          title="Challenge not found"
          description={error ?? "This challenge doesn't exist or you don't have access to it."}
          action={
            <Button asChild variant="outline">
              <Link href="/practice/challenges">
                <ArrowLeft className="size-4" /> Back to challenges
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const isActive = challenge.status === "active"
  const totalSeconds = challenge.duration_minutes * 60
  const timePct =
    remaining != null ? Math.round(((totalSeconds - remaining) / totalSeconds) * 100) : 100
  const solvedPct =
    challenge.total_count > 0
      ? Math.round((challenge.solved_count / challenge.total_count) * 100)
      : 0
  const lowTime = remaining != null && remaining > 0 && remaining <= 120

  return (
    <div className="space-y-8">
      <PageHeader
        title={challenge.title}
        description={
          isActive
            ? "Mark each problem as solved as you go — submit when you're done or let the timer run out."
            : `${challenge.status === "completed" ? "Completed" : "Abandoned"} ${
                challenge.completed_at
                  ? formatDistanceToNow(new Date(challenge.completed_at), { addSuffix: true })
                  : ""
              }`
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/practice/challenges">
              <ArrowLeft className="size-4" /> All challenges
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Problem list ---------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Flag className="size-5 text-primary" />
                  Problems
                </CardTitle>
                <CardDescription>
                  {challenge.solved_count} of {challenge.total_count} solved
                  {challenge.focus_topics.length > 0 && (
                    <> · {challenge.focus_topics.slice(0, 2).join(", ")}</>
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="capitalize">
                {challenge.difficulty}
              </Badge>
            </div>
            <Progress value={solvedPct} className="h-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {challenge.problems.map((p, idx) => (
              <ProblemRow
                key={p.id}
                index={idx + 1}
                problem={p}
                readonly={!isActive}
                pending={pendingProblemId === p.id}
                onToggle={(solved) => handleToggle(p.id, solved)}
              />
            ))}
          </CardContent>
          {isActive && (
            <CardFooter className="flex-wrap gap-2 border-t">
              <Button onClick={() => handleSubmit(false)} disabled={completing}>
                {completing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Scoring...
                  </>
                ) : (
                  <>
                    <Trophy className="size-4" /> Submit challenge
                  </>
                )}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" disabled={completing}>
                    Abandon
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Abandon this challenge?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {challenge.solved_count > 0
                        ? `Your ${challenge.solved_count} solved problem${
                            challenge.solved_count === 1 ? "" : "s"
                          } will still be scored and count toward your streak.`
                        : "No problems have been solved yet — this session will be marked as abandoned with 0 points."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep going</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleSubmit(true)}>
                      Abandon
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          )}
        </Card>

        {/* ---- Timer / results sidebar ----------------------------------- */}
        <div className="space-y-4">
          {isActive ? (
            <Card
              className={cn(
                "relative overflow-hidden",
                lowTime && "border-rose-500/40 ring-1 ring-rose-500/20"
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TimerIcon
                    className={cn("size-5", lowTime ? "text-rose-500" : "text-primary")}
                  />
                  Time remaining
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p
                  className={cn(
                    "font-mono text-5xl font-bold tabular-nums tracking-tight",
                    lowTime && "animate-pulse text-rose-600 dark:text-rose-400"
                  )}
                >
                  {remaining != null ? formatClock(remaining) : "—"}
                </p>
                <Progress
                  value={timePct}
                  className={cn(
                    "h-1.5",
                    lowTime && "[&_[data-slot=progress-indicator]]:bg-rose-500"
                  )}
                />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Duration" value={`${challenge.duration_minutes} min`} />
                  <Stat label="Solved" value={`${challenge.solved_count}/${challenge.total_count}`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Started{" "}
                  {formatDistanceToNow(new Date(challenge.started_at), { addSuffix: true })}.
                  The timer is server-backed — refreshing won&apos;t reset it.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ResultCard
              status={challenge.status === "abandoned" ? "abandoned" : "completed"}
              result={
                result ?? {
                  score: challenge.score ?? 0,
                  base_points: 0,
                  time_bonus: 0,
                  solved: challenge.solved_count,
                  total: challenge.total_count,
                }
              }
              hasBreakdown={result != null}
              durationMinutes={challenge.duration_minutes}
              completedAt={challenge.completed_at}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="size-4 text-primary" /> Scoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Easy <b className="text-foreground">10</b> · Medium{" "}
                <b className="text-foreground">25</b> · Hard{" "}
                <b className="text-foreground">50</b> pts each.
              </p>
              <p>
                Finish early for up to <b className="text-foreground">+50%</b> time bonus.
                Points feed the leaderboard and your streak.
              </p>
            </CardContent>
            {!isActive && (
              <CardFooter className="flex-col items-stretch gap-2 border-t">
                <Button asChild variant="outline">
                  <Link href="/practice/challenges">
                    <RotateCcw className="size-4" /> Start another
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/practice">View leaderboard</Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ProblemRow({
  index,
  problem,
  readonly,
  pending,
  onToggle,
}: {
  index: number
  problem: ChallengeProblem
  readonly: boolean
  pending: boolean
  onToggle: (solved: boolean) => void
}) {
  const diffStyle = DIFFICULTY_BADGE[problem.difficulty] ?? "bg-muted"
  const points = DIFFICULTY_POINTS[problem.difficulty] ?? 25
  const topics = problem.related_topics.slice(0, 3)
  const moreTopics = problem.related_topics.length - topics.length

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-colors",
        problem.solved
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "hover:border-primary/30 hover:bg-muted/30"
      )}
    >
      {readonly ? (
        problem.solved ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
        )
      ) : (
        <Checkbox
          checked={problem.solved}
          disabled={pending}
          onCheckedChange={(c) => onToggle(c as boolean)}
          className="mt-0.5 size-5"
          aria-label={`Mark ${problem.title} as solved`}
        />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p
              className={cn(
                "font-medium leading-snug",
                problem.solved && "line-through opacity-70"
              )}
            >
              <span className="mr-1.5 text-muted-foreground">{index}.</span>
              {problem.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className={cn("font-medium", diffStyle)}>
              {problem.difficulty}
            </Badge>
            <Badge variant="secondary" className="tabular-nums">
              {points} pts
            </Badge>
          </div>
        </div>
        {topics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Tag className="size-3 text-muted-foreground" />
            {topics.map((t) => (
              <Badge key={t} variant="outline" className="font-normal">
                {t}
              </Badge>
            ))}
            {moreTopics > 0 && (
              <span className="text-muted-foreground">+{moreTopics}</span>
            )}
          </div>
        )}
      </div>
      <Button asChild variant="ghost" size="icon" className="shrink-0">
        <Link
          href={`/problems/${problem.id}`}
          target="_blank"
          aria-label={`Open ${problem.title}`}
        >
          <ExternalLink className="size-4" />
        </Link>
      </Button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ResultCard({
  status,
  result,
  hasBreakdown,
  durationMinutes,
  completedAt,
}: {
  status: "completed" | "abandoned"
  result: ChallengeResult
  hasBreakdown: boolean
  durationMinutes: number
  completedAt: string | null
}) {
  const accuracy =
    result.total > 0 ? Math.round((result.solved / result.total) * 100) : 0

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy
            className={cn(
              "size-5",
              status === "completed" ? "text-amber-500" : "text-muted-foreground"
            )}
          />
          {status === "completed" ? "Results" : "Session ended"}
        </CardTitle>
        {completedAt && (
          <CardDescription>
            {formatDistanceToNow(new Date(completedAt), { addSuffix: true })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-transparent p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total score
          </p>
          <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
            {result.score}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">points</p>
        </div>
        {hasBreakdown && (
          <div className="space-y-2 text-sm">
            <Row icon={CheckCircle2} label="Base points" value={result.base_points} />
            <Row
              icon={Zap}
              label="Time bonus"
              value={result.time_bonus > 0 ? `+${result.time_bonus}` : 0}
              accent={result.time_bonus > 0}
            />
            <Separator />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Solved" value={`${result.solved}/${result.total}`} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Duration" value={`${durationMinutes} min`} />
          <Stat
            label="Status"
            value={status === "completed" ? "Done" : "Abandoned"}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof CheckCircle2
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          accent && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {value}
      </span>
    </div>
  )
}
