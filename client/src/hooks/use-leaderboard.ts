"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"

export type LeaderboardPeriod = "week" | "month" | "all"

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  problems_solved: number
  challenge_points: number
  points: number
  rank: number
  is_me: boolean
}

interface LeaderboardResponse {
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

const API_BASE = "http://localhost:8000"

/**
 * Fetches the points-based leaderboard for the given period. The caller's own
 * row (if any) is always included in `entries` even when outside the top N.
 */
export function useLeaderboard(initialPeriod: LeaderboardPeriod = "week", limit = 10) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [me, setMe] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) throw new Error("Not authenticated")
      const token = sessionData.session.access_token
      const res = await fetch(
        `${API_BASE}/api/challenges/leaderboard/?period=${period}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `Request failed with status ${res.status}`)
      }
      const json: LeaderboardResponse = await res.json()
      setEntries(json.entries)
      setMe(json.me)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard")
    } finally {
      setLoading(false)
    }
  }, [period, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { period, setPeriod, entries, me, loading, error, refresh }
}
