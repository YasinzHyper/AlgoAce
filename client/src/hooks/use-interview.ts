"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"

export type InterviewStatus = "active" | "completed" | "abandoned"
export type InterviewType = "technical" | "behavioral" | "system_design"
export type VoiceModel = "native" | "fast"

export interface InterviewProblem {
  id: number
  title: string
  difficulty: string
  related_topics: string[]
  description: string
  role?: "warmup" | "main"
}

export interface InterviewContext {
  interview_type: InterviewType
  difficulty: string
  goal: string | null
  company: string | null
  roadmap_id: number | null
  overall_percentage: number
  pace_status: string
  days_remaining: number | null
  strong_topics: string[]
  weak_topics: string[]
  recently_solved: string[]
  problems: InterviewProblem[]
  voice_model?: VoiceModel
}

export interface TranscriptTurn {
  role: "user" | "model" | "system"
  text: string
  at_ms: number
}

export interface InterviewFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
  focus_areas: string[]
}

export interface InterviewSession {
  id: number
  user_id: string
  roadmap_id: number | null
  interview_type: InterviewType
  difficulty: string
  duration_minutes: number
  status: InterviewStatus
  context_snapshot: InterviewContext
  problem_ids: number[]
  problems: InterviewProblem[]
  transcript: TranscriptTurn[]
  rubric_scores: Record<string, number> | null
  overall_score: number | null
  feedback: InterviewFeedback | null
  started_at: string
  completed_at: string | null
  created_at: string
  expires_at_epoch: number | null
}

export interface InterviewListItem {
  id: number
  interview_type: InterviewType
  difficulty: string
  duration_minutes: number
  status: InterviewStatus
  overall_score: number | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface InterviewStats {
  completed: number
  active: number
  best_score: number | null
  avg_score: number | null
  last: InterviewListItem | null
  active_session: InterviewListItem | null
}

export interface StartInterviewInput {
  roadmap_id?: number | null
  interview_type: InterviewType
  difficulty: string
  duration_minutes: number
  voice_model: VoiceModel
}

export interface LiveTokenResponse {
  token: string
  model: string
  api_version: string
  expires_in_seconds: number
}

import { API_BASE } from "@/lib/api"

async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    let detail = ""
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch {
      detail = await res.text()
    }
    throw new Error(detail || `Request failed with status ${res.status}`)
  }
  return res.json()
}

/**
 * List + create interview sessions. `start()` resolves to the new session so
 * the caller can redirect to its live page.
 */
export function useInterviews() {
  const [interviews, setInterviews] = useState<InterviewListItem[]>([])
  const [stats, setStats] = useState<InterviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, st] = await Promise.all([
        authedFetch<{ interviews: InterviewListItem[] }>("/api/interviews"),
        authedFetch<InterviewStats>("/api/interviews/stats"),
      ])
      setInterviews(list.interviews)
      setStats(st)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load interviews")
    } finally {
      setLoading(false)
    }
  }, [])

  const start = useCallback(async (input: StartInterviewInput): Promise<InterviewSession> => {
    setStarting(true)
    try {
      const json = await authedFetch<{ session: InterviewSession }>("/api/interviews/start", {
        method: "POST",
        body: JSON.stringify(input),
      })
      return json.session
    } finally {
      setStarting(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { interviews, stats, loading, starting, error, refresh, start }
}

/**
 * Stats-only fetch for surfaces that don't need the full history list
 * (dashboard headline card, practice hub).
 */
export function useInterviewStats() {
  const [stats, setStats] = useState<InterviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const st = await authedFetch<InterviewStats>("/api/interviews/stats")
      setStats(st)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { stats, loading, refresh }
}

/**
 * Single-interview controller: fetch the session, mint Live tokens, append
 * transcript turns, and finalise (`complete`).
 */
export function useInterviewSession(sessionId: number | null) {
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [loading, setLoading] = useState<boolean>(sessionId != null)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (sessionId == null) {
      setSession(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const json = await authedFetch<{ session: InterviewSession }>(
        `/api/interviews/${sessionId}`
      )
      setSession(json.session)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load interview")
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const mintToken = useCallback(
    async (voiceModel?: VoiceModel): Promise<LiveTokenResponse> => {
      if (sessionId == null) throw new Error("No session")
      return authedFetch<LiveTokenResponse>(`/api/interviews/${sessionId}/token`, {
        method: "POST",
        body: JSON.stringify({ voice_model: voiceModel ?? null }),
      })
    },
    [sessionId]
  )

  const appendTurns = useCallback(
    async (turns: TranscriptTurn[]) => {
      if (sessionId == null || turns.length === 0) return
      await authedFetch<{ ok: boolean; turn_count: number }>(
        `/api/interviews/${sessionId}/event`,
        { method: "POST", body: JSON.stringify({ turns }) }
      )
    },
    [sessionId]
  )

  const complete = useCallback(
    async (opts: { abandoned?: boolean; notes?: string } = {}) => {
      if (sessionId == null) return null
      setCompleting(true)
      try {
        const json = await authedFetch<{ session: InterviewSession }>(
          `/api/interviews/${sessionId}/complete`,
          { method: "POST", body: JSON.stringify(opts) }
        )
        setSession(json.session)
        return json.session
      } finally {
        setCompleting(false)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { session, loading, completing, error, refresh, mintToken, appendTurns, complete }
}
