"use client"

import { useState } from "react"
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
import { StatCard } from "@/components/layout/stat-card"
import { cn } from "@/utils/supabase/utils"
import {
  useInterviews,
  type InterviewType,
  type VoiceModel,
} from "@/hooks/use-interview"
import {
  AudioLines,
  Award,
  Bot,
  Gauge,
  History,
  Loader2,
  Mic,
  Play,
  Sparkles,
  Timer,
} from "lucide-react"
import { toast } from "sonner"

const DURATION_PRESETS = [20, 30, 45, 60]

const TYPE_LABEL: Record<InterviewType, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  system_design: "System design",
}

export default function MockInterviewsPage() {
  const router = useRouter()
  const { interviews, stats, loading, starting, start } = useInterviews()

  const [type, setType] = useState<InterviewType>("technical")
  const [difficulty, setDifficulty] = useState("intermediate")
  const [duration, setDuration] = useState(30)
  const [customMin, setCustomMin] = useState("")
  const [voiceModel, setVoiceModel] = useState<VoiceModel>("native")

  const activeSession = stats?.active_session ?? null

  const handleStart = async () => {
    try {
      const session = await start({
        interview_type: type,
        difficulty,
        duration_minutes: duration,
        voice_model: voiceModel,
      })
      router.push(`/practice/mock-interviews/${session.id}`)
    } catch (e) {
      toast.error("Couldn't start interview", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  const handleCustom = (v: string) => {
    setCustomMin(v)
    const n = parseInt(v, 10)
    if (!Number.isNaN(n) && n > 0) setDuration(Math.min(60, Math.max(10, n)))
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mock Interviews"
        description="Voice-to-voice practice with an AI interviewer calibrated to your roadmap, weak topics and target company."
      />

      {activeSession && (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Mic className="size-5 text-sky-600 dark:text-sky-400" />
                  Interview in progress
                </CardTitle>
                <CardDescription>
                  {TYPE_LABEL[activeSession.interview_type]} ·{" "}
                  {activeSession.duration_minutes} min · started{" "}
                  {formatDistanceToNow(new Date(activeSession.started_at), {
                    addSuffix: true,
                  })}
                </CardDescription>
              </div>
              <Button asChild>
                <Link href={`/practice/mock-interviews/${activeSession.id}`}>
                  <Play className="size-4" /> Resume
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Builder ------------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" /> Start a new interview
            </CardTitle>
            <CardDescription>
              The interviewer reads your roadmap progress, recent solves and weak
              topics to pick questions — just like a real {`{company}`} screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="iv-type">Interview type</Label>
                <Select value={type} onValueChange={(v) => setType(v as InterviewType)}>
                  <SelectTrigger id="iv-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical (DSA)</SelectItem>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="system_design">System design</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="iv-diff">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger id="iv-diff" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Session length</Label>
              <div className="flex flex-wrap items-center gap-2">
                {DURATION_PRESETS.map((min) => (
                  <Button
                    key={min}
                    type="button"
                    variant={duration === min && !customMin ? "default" : "outline"}
                    onClick={() => {
                      setDuration(min)
                      setCustomMin("")
                    }}
                    className="rounded-full"
                  >
                    {min} min
                  </Button>
                ))}
                <div className="relative w-32">
                  <Input
                    type="number"
                    min={10}
                    max={60}
                    placeholder="Custom"
                    value={customMin}
                    onChange={(e) => handleCustom(e.target.value)}
                    className="rounded-full pr-10 text-center"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    min
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Capped at 60 minutes server-side.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iv-voice">Interviewer voice</Label>
              <Select value={voiceModel} onValueChange={(v) => setVoiceModel(v as VoiceModel)}>
                <SelectTrigger id="iv-voice" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">
                    <div className="flex flex-col items-start">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5" /> Natural (native audio)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Higher-quality speech, better pacing
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="fast">
                    <div className="flex flex-col items-start">
                      <span className="flex items-center gap-1.5">
                        <Gauge className="size-3.5" /> Fast (low latency)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Snappier replies, slightly more robotic
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              <AudioLines className="mb-1 size-4 text-primary" />
              You&apos;ll be asked for <b>microphone</b> access on the next page.
              Audio streams directly to Google via a short-lived token — your API
              key never leaves the server. Camera is optional and stays local.
            </div>
          </CardContent>
          <CardFooter className="border-t">
            <Button onClick={handleStart} disabled={starting} size="lg">
              {starting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Preparing context…
                </>
              ) : (
                <>
                  <Mic className="size-4" /> Begin interview
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* ---- Stats sidebar ------------------------------------------- */}
        <div className="space-y-4">
          <StatCard
            title="Interviews completed"
            value={stats?.completed ?? 0}
            icon={Award}
            description={
              stats?.avg_score != null ? `avg ${stats.avg_score}/100` : undefined
            }
          />
          <StatCard
            title="Best score"
            value={stats?.best_score != null ? `${stats.best_score}` : "—"}
            icon={Sparkles}
            sparkle={(stats?.best_score ?? 0) >= 80}
            description="out of 100"
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="size-4 text-primary" /> How it works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <b className="text-foreground">1.</b> We snapshot your roadmap goal,
                pace, strong/weak topics and recent solves.
              </p>
              <p>
                <b className="text-foreground">2.</b> A live AI interviewer runs the
                session over voice — warm-up, main question, follow-ups.
              </p>
              <p>
                <b className="text-foreground">3.</b> When it ends, your transcript
                is graded against a rubric and fed back into your analytics.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- History --------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" /> Past interviews
          </CardTitle>
          <CardDescription>Click any row to view the full report and transcript.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : interviews.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No interviews yet"
              description="Your scored sessions will appear here."
              className="py-8"
            />
          ) : (
            <div className="divide-y">
              {interviews.map((iv) => (
                <Link
                  key={iv.id}
                  href={`/practice/mock-interviews/${iv.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors first:pt-0 last:pb-0 hover:text-primary"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0",
                        iv.status === "completed" &&
                          "border-emerald-500/30 text-emerald-600",
                        iv.status === "active" && "border-sky-500/30 text-sky-600",
                        iv.status === "abandoned" && "text-muted-foreground"
                      )}
                    >
                      {iv.status}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {TYPE_LABEL[iv.interview_type]} · {iv.difficulty}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {iv.duration_minutes} min ·{" "}
                        {formatDistanceToNow(new Date(iv.started_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {iv.overall_score != null ? (
                      <p className="font-mono text-lg font-bold tabular-nums">
                        {iv.overall_score}
                        <span className="text-xs font-normal text-muted-foreground">/100</span>
                      </p>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
