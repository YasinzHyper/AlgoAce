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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { useShakeDetector } from "@/hooks/use-shake-detector"
import {
  useInterviewSession,
  type InterviewProblem,
  type TranscriptTurn,
} from "@/hooks/use-interview"
import { useLiveInterview, type LiveStatus } from "@/hooks/use-live-interview"
import { InterviewReport } from "./InterviewReport"
import {
  ArrowLeft,
  AudioLines,
  Bot,
  Camera,
  CameraOff,
  Flag,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Timer as TimerIcon,
  User as UserIcon,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

const STATUS_LABEL: Record<LiveStatus, string> = {
  idle: "Ready",
  requesting_mic: "Requesting microphone…",
  connecting: "Connecting to interviewer…",
  live: "Live",
  reconnecting: "Reconnecting…",
  ended: "Disconnected",
  error: "Connection error",
}

function formatClock(seconds: number) {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, "0")
  return `${m}:${ss}`
}

/**
 * Live voice interview session. Left column: passive self-view + problem
 * statement / scratchpad (technical) or context summary. Right column: timer,
 * connection status, rolling transcript. Footer: mute / end controls.
 *
 * Doubles as the read-only history view for completed/abandoned sessions
 * (renders <InterviewReport> + saved transcript instead of live controls).
 */
export default function InterviewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const sessionId = /^\d+$/.test(id) ? parseInt(id, 10) : null

  const { session, loading, completing, error, mintToken, appendTurns, complete } =
    useInterviewSession(sessionId)

  const [notes, setNotes] = useState("")
  const [cameraOn, setCameraOn] = useState(false)
  const [shakeWarn, setShakeWarn] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const finaliseRef = useRef<{ triggered: boolean; abandoned: boolean }>({
    triggered: false,
    abandoned: false,
  })
  const autoConnectRef = useRef(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // ---- Gemini Live audio --------------------------------------------------
  const {
    status: liveStatus,
    error: liveError,
    muted,
    interviewerSpeaking,
    transcript: liveTranscript,
    liveUserText,
    liveModelText,
    connect,
    disconnect,
    toggleMute,
  } = useLiveInterview({
    mintToken,
    voiceModel: session?.context_snapshot?.voice_model,
    onTurns: (turns) => appendTurns(turns).catch(() => {}),
    onEndInterview: (reason) => {
      toast.message("Interviewer ended the session", { description: reason })
      void handleFinalise(false)
    },
  })

  // ---- countdown (server-authoritative) ----------------------------------
  const expiresAt =
    session?.status === "active" ? (session.expires_at_epoch ?? null) : null
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (expiresAt == null) {
      setRemaining(null)
      return
    }
    const compute = () => Math.max(0, Math.round(expiresAt - Date.now() / 1000))
    setRemaining(compute())
    const t = setInterval(() => setRemaining(compute()), 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  useEffect(() => {
    if (
      session?.status === "active" &&
      remaining === 0 &&
      !finaliseRef.current.triggered
    ) {
      toast.message("Time's up")
      void handleFinalise(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session?.status])

  // ---- self-view camera (passive; never sent to model) -------------------
  useEffect(() => {
    let stream: MediaStream | null = null
    const run = async () => {
      if (!cameraOn) {
        if (videoRef.current?.srcObject) {
          ;(videoRef.current.srcObject as MediaStream)
            .getTracks()
            .forEach((t) => t.stop())
          videoRef.current.srcObject = null
        }
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        toast.error("Camera access denied")
        setCameraOn(false)
      }
    }
    void run()
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [cameraOn])

  useShakeDetector(videoRef, () => {
    if (!cameraOn || shakeWarn) return
    setShakeWarn(true)
    setTimeout(() => setShakeWarn(false), 8000)
  })

  // ---- transcript autoscroll ---------------------------------------------
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [liveTranscript.length, liveUserText, liveModelText])

  // ---- finalise -----------------------------------------------------------
  const handleFinalise = async (abandoned: boolean) => {
    if (finaliseRef.current.triggered) return
    finaliseRef.current = { triggered: true, abandoned }
    await disconnect()
    try {
      const finished = await complete({ abandoned, notes: notes.trim() || undefined })
      if (finished?.status === "completed") {
        toast.success(`Interview scored — ${finished.overall_score}/100`)
      }
    } catch (e) {
      finaliseRef.current.triggered = false
      toast.error("Couldn't finalise interview", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  const handleConnect = async () => {
    try {
      await connect()
    } catch (e) {
      toast.error("Couldn't start the call", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  // Auto-join once the active session has loaded so the user doesn't need a
  // second click after "Begin interview". Ref-guarded for React strict mode.
  useEffect(() => {
    if (
      session?.status === "active" &&
      liveStatus === "idle" &&
      !autoConnectRef.current &&
      !finaliseRef.current.triggered
    ) {
      autoConnectRef.current = true
      void handleConnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, liveStatus])

  // ---- loading / error states --------------------------------------------
  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Mock interview" description="Loading session…" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[32rem] w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-[32rem] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="space-y-8">
        <PageHeader title="Mock interview" />
        <EmptyState
          icon={XCircle}
          title="Interview not found"
          description={error ?? "This session doesn't exist or you don't have access to it."}
          action={
            <Button asChild variant="outline">
              <Link href="/practice/mock-interviews">
                <ArrowLeft className="size-4" /> Back to interviews
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const isActive = session.status === "active"
  const canJoin =
    liveStatus === "idle" || liveStatus === "ended" || liveStatus === "error"
  const ctx = session.context_snapshot
  const problems = session.problems ?? []
  const lowTime = remaining != null && remaining > 0 && remaining <= 120
  const totalSeconds = session.duration_minutes * 60
  const elapsed = remaining != null ? totalSeconds - remaining : totalSeconds

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          isActive
            ? `${ctx?.company || "Mock"} ${session.interview_type.replace("_", " ")} interview`
            : "Interview report"
        }
        description={
          isActive
            ? "Speak naturally — the interviewer is listening. Think out loud."
            : `${session.status === "completed" ? "Completed" : "Abandoned"} ${
                session.completed_at
                  ? formatDistanceToNow(new Date(session.completed_at), { addSuffix: true })
                  : ""
              }`
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/practice/mock-interviews">
              <ArrowLeft className="size-4" /> All interviews
            </Link>
          </Button>
        }
      />

      {isActive ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ---- Left: self-view + problem/context --------------------- */}
          <div className="space-y-4 lg:col-span-2">
            <Card className="relative overflow-hidden">
              <CardContent className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={cn(
                      "aspect-[4/3] w-full rounded-lg border bg-muted object-cover",
                      !cameraOn && "opacity-40"
                    )}
                  />
                  {!cameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                      Camera off
                    </div>
                  )}
                  {shakeWarn && (
                    <div className="absolute inset-x-2 bottom-2 rounded-md bg-amber-500/90 px-2 py-1 text-center text-[11px] font-medium text-amber-950">
                      Stay calm — take a breath
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setCameraOn((c) => !c)}
                    className="absolute right-2 top-2 size-7"
                    aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
                  >
                    {cameraOn ? <CameraOff className="size-3.5" /> : <Camera className="size-3.5" />}
                  </Button>
                </div>
                <InterviewerOrb
                  status={liveStatus}
                  speaking={interviewerSpeaking}
                  muted={muted}
                  error={liveError}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flag className="size-4 text-primary" />
                  {session.interview_type === "technical" ? "Problem" : "Context"}
                </CardTitle>
                <CardDescription>
                  Calibrated to your roadmap: {ctx?.goal || "your goal"}
                  {ctx?.company ? ` at ${ctx.company}` : ""}
                  {ctx?.weak_topics?.length
                    ? ` · probing ${ctx.weak_topics.slice(0, 2).join(", ")}`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {session.interview_type === "technical" && problems.length > 0 ? (
                  <ProblemPanel problems={problems} notes={notes} setNotes={setNotes} />
                ) : (
                  <NonTechnicalPanel
                    type={session.interview_type}
                    notes={notes}
                    setNotes={setNotes}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ---- Right: timer + transcript + controls ------------------ */}
          <div className="space-y-4">
            <Card
              className={cn(
                lowTime && "border-rose-500/40 ring-1 ring-rose-500/20"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TimerIcon
                      className={cn("size-4", lowTime ? "text-rose-500" : "text-primary")}
                    />
                    {formatClock(elapsed)} / {session.duration_minutes}:00
                  </CardTitle>
                  <Badge
                    variant={liveStatus === "live" ? "default" : "secondary"}
                    className={cn(
                      "gap-1.5",
                      liveStatus === "live" && "bg-emerald-600 hover:bg-emerald-600"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        liveStatus === "live"
                          ? "animate-pulse bg-white"
                          : "bg-muted-foreground"
                      )}
                    />
                    {STATUS_LABEL[liveStatus]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "font-mono text-3xl font-bold tabular-nums tracking-tight",
                    lowTime && "animate-pulse text-rose-600 dark:text-rose-400"
                  )}
                >
                  {remaining != null ? formatClock(remaining) : "—"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">left</span>
                </p>
              </CardContent>
            </Card>

            <TranscriptPanel
              turns={liveTranscript}
              liveUserText={liveUserText}
              liveModelText={liveModelText}
              endRef={transcriptEndRef}
            />

            <Card>
              <CardContent className="flex flex-wrap gap-2 p-4">
                {canJoin ? (
                  <Button onClick={handleConnect} className="flex-1">
                    <Mic className="size-4" />{" "}
                    {liveStatus === "ended" ? "Rejoin call" : "Join call"}
                  </Button>
                ) : (
                  <Button
                    variant={muted ? "default" : "outline"}
                    onClick={toggleMute}
                    disabled={liveStatus !== "live"}
                    className="flex-1"
                  >
                    {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                    {muted ? "Unmute" : "Mute"}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={completing}>
                      {completing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PhoneOff className="size-4" />
                      )}
                      End
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>End this interview?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your transcript so far will be graded against the rubric. If
                        you&apos;ve barely started, it will be marked as abandoned
                        instead.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep going</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleFinalise(true)}>
                        Abandon
                      </AlertDialogAction>
                      <AlertDialogAction onClick={() => handleFinalise(false)}>
                        End &amp; score
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        // ---- History / report view --------------------------------------
        <div className="space-y-6">
          {session.status === "completed" ? (
            <InterviewReport session={session} />
          ) : (
            <EmptyState
              icon={XCircle}
              title="Interview abandoned"
              description="This session ended before enough conversation was captured to grade."
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcript</CardTitle>
              <CardDescription>{(session.transcript ?? []).length} turns</CardDescription>
            </CardHeader>
            <CardContent>
              <TranscriptPanel
                turns={session.transcript ?? []}
                liveUserText=""
                liveModelText=""
                readonly
              />
            </CardContent>
            <CardFooter className="border-t">
              <Button asChild variant="outline">
                <Link href="/practice/mock-interviews">
                  <RotateCcw className="size-4" /> Start another
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function InterviewerOrb({
  status,
  speaking,
  muted,
  error,
}: {
  status: LiveStatus
  speaking: boolean
  muted: boolean
  error: string | null
}) {
  const connecting = status === "connecting" || status === "requesting_mic" || status === "reconnecting"
  return (
    <div className="flex min-h-[165px] flex-col items-center justify-center gap-3 rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4 text-center">
      <div
        className={cn(
          "relative flex size-20 items-center justify-center rounded-full border-2 transition-all",
          status === "live"
            ? speaking
              ? "scale-110 border-primary bg-primary/20 shadow-lg shadow-primary/30"
              : "border-primary/40 bg-primary/10"
            : "border-muted bg-muted/50"
        )}
      >
        {connecting ? (
          <Loader2 className="size-8 animate-spin text-primary" />
        ) : (
          <Bot className={cn("size-8", status === "live" ? "text-primary" : "text-muted-foreground")} />
        )}
        {status === "live" && speaking && (
          <span className="absolute -inset-2 animate-ping rounded-full border border-primary/40" />
        )}
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">AI Interviewer</p>
        <p className="text-xs text-muted-foreground">
          {error
            ? error
            : status === "live"
              ? speaking
                ? "Speaking…"
                : muted
                  ? "You're muted"
                  : "Listening…"
              : status === "idle" || status === "ended"
                ? "Click Join call to begin"
                : STATUS_LABEL[status]}
        </p>
      </div>
    </div>
  )
}

function ProblemPanel({
  problems,
  notes,
  setNotes,
}: {
  problems: InterviewProblem[]
  notes: string
  setNotes: (s: string) => void
}) {
  const sorted = useMemo(
    () => [...problems].sort((a) => (a.role === "warmup" ? -1 : 1)),
    [problems]
  )
  return (
    <Tabs defaultValue={String(sorted[0]?.id ?? "notes")} className="w-full">
      <TabsList className="w-full">
        {sorted.map((p) => (
          <TabsTrigger key={p.id} value={String(p.id)} className="gap-1.5">
            {p.role === "warmup" && <Badge variant="outline" className="px-1 py-0 text-[10px]">warm-up</Badge>}
            {p.title.length > 24 ? `${p.title.slice(0, 24)}…` : p.title}
          </TabsTrigger>
        ))}
        <TabsTrigger value="notes">Scratchpad</TabsTrigger>
      </TabsList>
      {sorted.map((p) => (
        <TabsContent key={p.id} value={String(p.id)} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                p.difficulty === "Easy" && "border-emerald-500/30 text-emerald-600",
                p.difficulty === "Medium" && "border-amber-500/30 text-amber-600",
                p.difficulty === "Hard" && "border-rose-500/30 text-rose-600"
              )}
            >
              {p.difficulty}
            </Badge>
            {p.related_topics.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-xs font-normal">
                {t}
              </Badge>
            ))}
          </div>
          <ScrollArea className="h-56 rounded-md border bg-muted/30 p-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {p.description || "The interviewer will read this problem aloud."}
            </div>
          </ScrollArea>
        </TabsContent>
      ))}
      <TabsContent value="notes" className="space-y-2">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jot down your approach, edge cases, complexity… This is sent to the grader when you finish."
          rows={10}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Only you can see this. It&apos;s included in your rubric scoring.
        </p>
      </TabsContent>
    </Tabs>
  )
}

function NonTechnicalPanel({
  type,
  notes,
  setNotes,
}: {
  type: string
  notes: string
  setNotes: (s: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
        {type === "system_design" ? (
          <>
            The interviewer will pose one system-design prompt. Walk through{" "}
            <b>requirements → high-level architecture → data model → scaling &amp; trade-offs</b>.
            State your assumptions out loud and quantify where you can.
          </>
        ) : (
          <>
            Expect 3–4 behavioral questions. Structure each answer with{" "}
            <b>STAR</b>: Situation, Task, Action, Result. Be specific — name the
            project, the metric, the outcome.
          </>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional) — included in your rubric scoring."
        rows={6}
        className="text-sm"
      />
    </div>
  )
}

function TranscriptPanel({
  turns,
  liveUserText,
  liveModelText,
  endRef,
  readonly,
}: {
  turns: TranscriptTurn[]
  liveUserText: string
  liveModelText: string
  endRef?: React.RefObject<HTMLDivElement | null>
  readonly?: boolean
}) {
  const empty = turns.length === 0 && !liveUserText && !liveModelText
  return (
    <Card className={cn(readonly && "border-0 shadow-none")}>
      {!readonly && (
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AudioLines className="size-4 text-primary" /> Transcript
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(readonly && "p-0")}>
        <ScrollArea className={cn(readonly ? "h-80" : "h-72")}>
          <div className="space-y-3 pr-3">
            {empty && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {readonly
                  ? "No transcript was captured for this session."
                  : "Transcript will appear here once the call starts."}
              </p>
            )}
            {turns.map((t, i) => (
              <TurnBubble key={i} turn={t} />
            ))}
            {liveUserText && (
              <TurnBubble turn={{ role: "user", text: liveUserText, at_ms: 0 }} live />
            )}
            {liveModelText && (
              <TurnBubble turn={{ role: "model", text: liveModelText, at_ms: 0 }} live />
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function TurnBubble({ turn, live }: { turn: TranscriptTurn; live?: boolean }) {
  const isUser = turn.role === "user"
  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <UserIcon className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-none bg-primary/10"
            : "rounded-tl-none bg-muted/60",
          live && "animate-pulse opacity-80"
        )}
      >
        {turn.text}
      </div>
    </div>
  )
}
