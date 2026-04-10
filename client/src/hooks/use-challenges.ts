"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"

export type ChallengeStatus = "active" | "completed" | "abandoned"

export interface ChallengeProblem {
  id: number
  title: string
  difficulty: string
  related_topics: string[]
  companies: string[]
  acceptance_rate: number
  solved: boolean
}

export interface Challenge {
  id: number
  user_id: string
  roadmap_id: number | null
  title: string
  problem_ids: number[]
  focus_topics: string[]
  difficulty: string
  duration_minutes: number
  status: ChallengeStatus
  solved_problem_ids: number[]
  score: number | null
  started_at: string
  completed_at: string | null
  created_at: string
  problems: ChallengeProblem[]
  solved_count: number
  total_count: number
  expires_at_epoch: number | null
}

export interface ChallengeResult {
  score: number
  base_points: number
  time_bonus: number
  solved: number
  total: number
}

export interface ChallengeRecommendation {
  roadmap_id: number
  goal: string | null
  focus_topics: string[]
  difficulty: string
  duration_minutes: number
  problem_count: number
  pace_status: string
  reason: string
}

export interface GenerateChallengeInput {
  roadmap_id?: number | null
  difficulty?: string
  duration_minutes?: number
  problem_count?: number
  focus_topics?: string[]
}

const API_BASE = "http://localhost:8000"

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
    const body = await res.text()
    throw new Error(body || `Request failed with status ${res.status}`)
  }
  return res.json()
}

/**
 * List + create challenges. `generate()` resolves to the new challenge so the
 * caller can redirect to its session page.
 */
export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [recommendation, setRecommendation] = useState<ChallengeRecommendation | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, rec] = await Promise.all([
        authedFetch<{ challenges: Challenge[] }>("/api/challenges"),
        authedFetch<{ recommendation: ChallengeRecommendation | null }>(
          "/api/challenges/recommended"
        ),
      ])
      setChallenges(list.challenges)
      setRecommendation(rec.recommendation)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load challenges")
    } finally {
      setLoading(false)
    }
  }, [])

  const generate = useCallback(async (input: GenerateChallengeInput): Promise<Challenge> => {
    setGenerating(true)
    try {
      const json = await authedFetch<{ challenge: Challenge }>("/api/challenges/generate", {
        method: "POST",
        body: JSON.stringify(input),
      })
      setChallenges((prev) => [json.challenge, ...prev])
      return json.challenge
    } finally {
      setGenerating(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { challenges, recommendation, loading, generating, error, refresh, generate }
}

/**
 * Single-challenge session controller. Exposes `markSolved` (optimistic) and
 * `complete` (returns the scored result).
 */
export function useChallenge(challengeId: number | null) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [result, setResult] = useState<ChallengeResult | null>(null)
  const [loading, setLoading] = useState<boolean>(challengeId != null)
  const [pendingProblemId, setPendingProblemId] = useState<number | null>(null)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (challengeId == null) {
      setChallenge(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const json = await authedFetch<{ challenge: Challenge }>(`/api/challenges/${challengeId}`)
      setChallenge(json.challenge)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load challenge")
    } finally {
      setLoading(false)
    }
  }, [challengeId])

  const markSolved = useCallback(
    async (problemId: number, solved: boolean) => {
      if (challengeId == null) return
      setPendingProblemId(problemId)
      // Optimistic update
      setChallenge((prev) => {
        if (!prev) return prev
        const next = new Set(prev.solved_problem_ids)
        if (solved) next.add(problemId)
        else next.delete(problemId)
        return {
          ...prev,
          solved_problem_ids: Array.from(next),
          solved_count: next.size,
          problems: prev.problems.map((p) =>
            p.id === problemId ? { ...p, solved } : p
          ),
        }
      })
      try {
        const json = await authedFetch<{ challenge: Challenge }>(
          `/api/challenges/${challengeId}/solve`,
          { method: "PUT", body: JSON.stringify({ problem_id: problemId, solved }) }
        )
        setChallenge(json.challenge)
      } catch (e) {
        // Roll back
        await refresh()
        throw e
      } finally {
        setPendingProblemId(null)
      }
    },
    [challengeId, refresh]
  )

  const complete = useCallback(
    async (opts: { elapsed_seconds?: number; abandoned?: boolean } = {}) => {
      if (challengeId == null) return null
      setCompleting(true)
      try {
        const json = await authedFetch<{ challenge: Challenge; result: ChallengeResult | null }>(
          `/api/challenges/${challengeId}/complete`,
          { method: "POST", body: JSON.stringify(opts) }
        )
        setChallenge(json.challenge)
        setResult(json.result)
        return json.result
      } finally {
        setCompleting(false)
      }
    },
    [challengeId]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    challenge,
    result,
    loading,
    pendingProblemId,
    completing,
    error,
    refresh,
    markSolved,
    complete,
  }
}
