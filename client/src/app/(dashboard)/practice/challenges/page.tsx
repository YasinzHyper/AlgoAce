"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { LeaderboardCard } from "@/components/practice/leaderboard-card"
import { cn } from "@/utils/supabase/utils"
import {
  useChallenges,
  type Challenge,
  type ChallengeRecommendation,
} from "@/hooks/use-challenges"
import {
  ArrowRight,
  CheckCircle2,
  History,
  Loader2,
  Play,
  Sparkles,
  Target,
  Timer,
  Trophy,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

const DURATION_OPTIONS = [15, 30, 45, 60]
const COUNT_OPTIONS = [3, 4, 5, 6, 8]

const STATUS_BADGE: Record<Challenge["status"], string> = {
  active: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  abandoned: "border-muted bg-muted/40 text-muted-foreground",
}

/**
 * Challenge hub: configure + start a new timed session, resume any in-progress
 * challenge, and review past sessions. Backed end-to-end by /api/challenges.
 */
export default function CodingChallengesPage() {
  const router = useRouter()
  const { challenges, recommendation, loading, generating, generate } = useChallenges()

  // ---- Builder state -------------------------------------------------------
  const [difficulty, setDifficulty] = useState<string>("mixed")
  const [duration, setDuration] = useState<number>(30)
  const [customDuration, setCustomDuration] = useState<string>("")
  const [problemCount, setProblemCount] = useState<number>(4)
  const [topicsInput, setTopicsInput] = useState<string>("")
  const [useRecommended, setUseRecommended] = useState<boolean>(false)

  const effectiveDuration = customDuration
    ? Math.max(5, Math.min(180, parseInt(customDuration, 10) || 0))
    : duration

  const focusTopics = useMemo(
    () =>
      topicsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5),
    [topicsInput]
  )

  const applyRecommendation = (rec: ChallengeRecommendation) => {
    setDifficulty(rec.difficulty)
    setDuration(rec.duration_minutes)
    setCustomDuration("")
    setProblemCount(rec.problem_count)
    setTopicsInput(rec.focus_topics.join(", "))
    setUseRecommended(true)
  }

  const handleStart = async () => {
    try {
      const challenge = await generate({
        roadmap_id: useRecommended ? recommendation?.roadmap_id : undefined,
        difficulty,
        duration_minutes: effectiveDuration,
        problem_count: problemCount,
        focus_topics: focusTopics.length > 0 ? focusTopics : undefined,
      })
      toast.success("Challenge started")
      router.push(`/practice/challenges/${challenge.id}`)
    } catch (e) {
      toast.error("Couldn't start challenge", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  const active = challenges.filter((c) => c.status === "active")
  const past = challenges.filter((c) => c.status !== "active")

  return (
    <div className="space-y-8">
      <PageHeader
        title="Coding Challenges"
        description="Timed problem sets generated from your weak spots — earn points for the leaderboard."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/practice">Practice hub</Link>
          </Button>
        }
      />

      {/* ---- Active sessions ----------------------------------------------- */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">In progress</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((c) => (
              <ActiveChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Builder ----------------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" />
              Start a challenge
            </CardTitle>
            <CardDescription>
              Pick difficulty, duration and focus topics — or use the recommended
              config from your roadmap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {recommendation && (
              <button
                type="button"
                onClick={() => applyRecommendation(recommendation)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40",
                  useRecommended && "border-primary/40 bg-primary/5"
                )}
              >
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">Use recommended config</p>
                  <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recommendation.focus_topics.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </button>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ch-difficulty">Difficulty</Label>
                <Select
                  value={difficulty}
                  onValueChange={(v) => {
                    setDifficulty(v)
                    setUseRecommended(false)
                  }}
                >
                  <SelectTrigger id="ch-difficulty" className="w-full">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-count">Problems</Label>
                <Select
                  value={String(problemCount)}
                  onValueChange={(v) => {
                    setProblemCount(parseInt(v, 10))
                    setUseRecommended(false)
                  }}
                >
                  <SelectTrigger id="ch-count" className="w-full">
                    <SelectValue placeholder="How many" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNT_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} problems
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Session length</Label>
              <div className="flex flex-wrap items-center gap-2">
                {DURATION_OPTIONS.map((min) => (
                  <Button
                    key={min}
                    type="button"
                    variant={!customDuration && duration === min ? "default" : "outline"}
                    onClick={() => {
                      setDuration(min)
                      setCustomDuration("")
                      setUseRecommended(false)
                    }}
                    className="rounded-full"
                  >
                    {min} min
                  </Button>
                ))}
                <div className="relative w-32">
                  <Input
                    type="number"
                    min={5}
                    max={180}
                    placeholder="Custom"
                    value={customDuration}
                    onChange={(e) => {
                      setCustomDuration(e.target.value)
                      setUseRecommended(false)
                    }}
                    className="rounded-full pr-10 text-center"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    min
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ch-topics">
                Focus topics{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ch-topics"
                placeholder="e.g. Dynamic Programming, Graphs"
                value={topicsInput}
                onChange={(e) => {
                  setTopicsInput(e.target.value)
                  setUseRecommended(false)
                }}
              />
              {focusTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {focusTopics.map((t) => (
                    <Badge key={t} variant="secondary" className="font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Comma-separated. Leave blank to draw from your roadmap&apos;s weak
                areas (or random if no roadmap).
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex-wrap gap-3 border-t">
            <Button onClick={handleStart} disabled={generating || effectiveDuration < 5}>
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Play className="size-4" /> Start challenge
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              {problemCount} problems · {effectiveDuration} min ·{" "}
              <span className="capitalize">{difficulty}</span>
            </span>
          </CardFooter>
        </Card>

        <LeaderboardCard defaultPeriod="week" limit={8} />
      </div>

      {/* ---- History --------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            Past challenges
          </CardTitle>
          <CardDescription>
            Review your completed and abandoned sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : past.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No challenges yet"
              description="Start your first timed challenge above to see it here."
              className="border-0 bg-transparent p-8"
            />
          ) : (
            <div className="divide-y">
              {past.map((c) => (
                <HistoryRow key={c.id} challenge={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ActiveChallengeCard({ challenge }: { challenge: Challenge }) {
  const remaining = challenge.expires_at_epoch
    ? Math.max(0, Math.round(challenge.expires_at_epoch - Date.now() / 1000))
    : null
  const remainingLabel =
    remaining != null
      ? remaining > 60
        ? `${Math.ceil(remaining / 60)} min left`
        : remaining > 0
          ? `${remaining}s left`
          : "Time's up"
      : `${challenge.duration_minutes} min`

  return (
    <Card className="border-sky-500/30 bg-sky-500/5">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">{challenge.title}</CardTitle>
          <Badge variant="outline" className={STATUS_BADGE.active}>
            In progress
          </Badge>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <Timer className="size-3.5" /> {remainingLabel}
          </span>
          <span>
            {challenge.solved_count}/{challenge.total_count} solved
          </span>
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild size="sm">
          <Link href={`/practice/challenges/${challenge.id}`}>
            <Play className="size-4" /> Resume
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function HistoryRow({ challenge }: { challenge: Challenge }) {
  const accuracy =
    challenge.total_count > 0
      ? Math.round((challenge.solved_count / challenge.total_count) * 100)
      : 0
  const Icon = challenge.status === "completed" ? CheckCircle2 : XCircle

  return (
    <Link
      href={`/practice/challenges/${challenge.id}`}
      className="flex items-center justify-between gap-3 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-muted/30 sm:px-2 sm:-mx-2 sm:rounded-md"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon
          className={cn(
            "size-5 shrink-0",
            challenge.status === "completed"
              ? "text-emerald-500"
              : "text-muted-foreground/50"
          )}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{challenge.title}</p>
          <p className="text-xs text-muted-foreground">
            {challenge.completed_at
              ? formatDistanceToNow(new Date(challenge.completed_at), { addSuffix: true })
              : formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true })}
            {" · "}
            {challenge.solved_count}/{challenge.total_count} solved · {accuracy}%
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant="outline" className={cn("capitalize", STATUS_BADGE[challenge.status])}>
          {challenge.status}
        </Badge>
        <span className="min-w-[3.5rem] text-right font-semibold tabular-nums">
          {challenge.score ?? 0}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">pts</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  )
}
