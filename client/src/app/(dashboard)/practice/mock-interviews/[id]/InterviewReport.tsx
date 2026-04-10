"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/utils/supabase/utils"
import type { InterviewSession } from "@/hooks/use-interview"
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Lightbulb,
  Target,
} from "lucide-react"

const RUBRIC_LABELS: Record<string, string> = {
  problem_solving: "Problem solving",
  coding: "Coding / pseudocode",
  communication: "Communication",
  complexity_analysis: "Complexity analysis",
  independence: "Independence (hints)",
  structure: "STAR structure",
  relevance: "Relevance",
  reflection: "Self-reflection",
  requirements: "Requirements gathering",
  architecture: "Architecture",
  tradeoffs: "Trade-offs",
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function dimColor(v: number) {
  if (v >= 4) return "[&_[data-slot=progress-indicator]]:bg-emerald-500"
  if (v >= 3) return "[&_[data-slot=progress-indicator]]:bg-amber-500"
  return "[&_[data-slot=progress-indicator]]:bg-rose-500"
}

/**
 * Post-interview rubric + structured feedback. Rendered both inline on the
 * live page after `/complete` resolves and as the read-only history detail
 * view for past sessions.
 */
export function InterviewReport({ session }: { session: InterviewSession }) {
  const rubric = session.rubric_scores ?? {}
  const fb = session.feedback
  const overall = session.overall_score ?? 0
  const dims = Object.entries(rubric)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="relative overflow-hidden lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="size-5 text-primary" /> Overall
          </CardTitle>
          <CardDescription className="capitalize">
            {session.interview_type.replace("_", " ")} · {session.difficulty}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-transparent p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Score
            </p>
            <p
              className={cn(
                "mt-1 text-6xl font-bold tabular-nums tracking-tight",
                scoreColor(overall)
              )}
            >
              {overall}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">out of 100</p>
          </div>
          {fb?.summary && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {fb.summary}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Rubric breakdown</CardTitle>
          <CardDescription>Each dimension scored 1–5</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dims.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rubric scores recorded.</p>
          ) : (
            dims.map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{RUBRIC_LABELS[key] ?? key}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {val}/5
                  </span>
                </div>
                <Progress
                  value={(val / 5) * 100}
                  className={cn("h-2", dimColor(val))}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {fb && (
        <>
          <FeedbackList
            title="What went well"
            icon={CheckCircle2}
            tone="emerald"
            items={fb.strengths}
            empty="No specific strengths called out."
          />
          <FeedbackList
            title="What to improve"
            icon={AlertTriangle}
            tone="amber"
            items={fb.improvements}
            empty="No improvements flagged."
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-primary" /> Study next
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {fb.focus_areas.length > 0 ? (
                fb.focus_areas.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    <Lightbulb className="size-3" /> {t}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Keep following your roadmap.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function FeedbackList({
  title,
  icon: Icon,
  tone,
  items,
  empty,
}: {
  title: string
  icon: typeof CheckCircle2
  tone: "emerald" | "amber"
  items: string[]
  empty: string
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : "bg-amber-500"
  const iconColor =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400"
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={cn("size-4", iconColor)} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {items.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
