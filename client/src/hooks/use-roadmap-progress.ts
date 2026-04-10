"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"

export interface RoadmapWeekProgress {
  week: number
  task_id: number
  completed: number
  total: number
  percentage: number
  topics_completed: number
  topics_total: number
  positive_feedback: string | null
  negative_feedback: string | null
}

export interface RoadmapTopicStrength {
  name: string
  completed: number
  total: number
  percentage: number
}

export interface RoadmapFocusArea {
  topic: string
  reason: string
  action: string
}

export interface RoadmapFeedback {
  id?: number
  roadmap_id: number
  summary: string
  positive_feedback: string
  negative_feedback: string
  focus_areas: RoadmapFocusArea[]
  completion_percentage: number
  pace_status: string
  generated_at: string
}

export type PaceStatus = "ahead" | "on_track" | "behind" | "no_data"

export interface RoadmapProgressSummary {
  roadmap_id: number
  goal: string | null
  company: string | null
  created_at: string | null
  deadline: string | null
  total_weeks: number
  overall: { completed: number; total: number; percentage: number }
  weeks: RoadmapWeekProgress[]
  pace: {
    elapsed_weeks: number
    expected_percentage: number
    delta: number
    status: PaceStatus
    days_remaining: number | null
  }
  strong_topics: RoadmapTopicStrength[]
  weak_topics: RoadmapTopicStrength[]
  difficulty_breakdown: { name: string; completed: number; total: number }[]
  last_feedback: RoadmapFeedback | null
}

interface UseRoadmapProgressResult {
  data: RoadmapProgressSummary | null
  feedback: RoadmapFeedback | null
  loading: boolean
  generating: boolean
  /** Seconds until regenerate is allowed again (0 = available now). Ticks live. */
  cooldownSeconds: number
  error: string | null
  refresh: () => Promise<void>
  generateFeedback: () => Promise<void>
}

const API_BASE = "http://localhost:8000"
/** Mirrors `ROADMAP_FEEDBACK_COOLDOWN_SECONDS` in `progress_router.py`. */
const FEEDBACK_COOLDOWN_SECONDS = 5 * 60

async function authedFetch(path: string, init?: RequestInit) {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) throw new Error("Not authenticated")
  const token = sessionData.session.access_token
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `Request failed with status ${res.status}`)
  }
  return res.json()
}

/**
 * Loads per-roadmap progress (per-week completion, pace, strong/weak topics)
 * plus the latest cached AI feedback, and exposes a `generateFeedback` action
 * that calls the feedback agent and updates local state in place.
 */
export function useRoadmapProgress(roadmapId: number | null): UseRoadmapProgressResult {
  const [data, setData] = useState<RoadmapProgressSummary | null>(null)
  const [feedback, setFeedback] = useState<RoadmapFeedback | null>(null)
  const [loading, setLoading] = useState<boolean>(roadmapId != null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  // Derive remaining cooldown from the cached feedback's `generated_at` and
  // tick it down once per second so the regenerate button re-enables itself.
  useEffect(() => {
    const compute = () => {
      if (!feedback?.generated_at) return 0
      const generatedAt = new Date(feedback.generated_at).getTime()
      if (Number.isNaN(generatedAt)) return 0
      const elapsed = Math.floor((Date.now() - generatedAt) / 1000)
      return Math.max(0, FEEDBACK_COOLDOWN_SECONDS - elapsed)
    }
    setCooldownSeconds(compute())
    if (!feedback?.generated_at) return
    const id = setInterval(() => {
      setCooldownSeconds((prev) => {
        const next = compute()
        if (next === 0 && prev === 0) clearInterval(id)
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [feedback?.generated_at])

  const refresh = useCallback(async () => {
    if (roadmapId == null) {
      setData(null)
      setFeedback(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const json: RoadmapProgressSummary = await authedFetch(
        `/api/analytics/roadmap/${roadmapId}`
      )
      setData(json)
      setFeedback(json.last_feedback ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roadmap progress")
    } finally {
      setLoading(false)
    }
  }, [roadmapId])

  const generateFeedback = useCallback(async () => {
    if (roadmapId == null) return
    setGenerating(true)
    setError(null)
    try {
      const json = await authedFetch(`/api/progress/roadmap/${roadmapId}/feedback`, {
        method: "POST",
      })
      const fb: RoadmapFeedback = json.feedback
      setFeedback(fb)
      // Keep the headline numbers in sync without a full refetch.
      setData((prev) =>
        prev
          ? {
              ...prev,
              overall: json.snapshot?.overall ?? prev.overall,
              pace: json.snapshot?.pace ?? prev.pace,
              last_feedback: fb,
            }
          : prev
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate feedback")
      throw e
    } finally {
      setGenerating(false)
    }
  }, [roadmapId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    data,
    feedback,
    loading,
    generating,
    cooldownSeconds,
    error,
    refresh,
    generateFeedback,
  }
}
