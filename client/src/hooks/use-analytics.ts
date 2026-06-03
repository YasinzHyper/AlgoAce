"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { API_BASE } from "@/utils/api"

export interface AnalyticsTotals {
  problems_solved: number
  solved_this_week: number
  topics_completed: number
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
}

export interface WeeklyProgressPoint {
  week_start: string
  label: string
  problems: number
  cumulative: number
}

export interface NamedCount {
  name: string
  value: number
}

export interface RecentActivityItem {
  type: "problem" | "topic"
  problem_id: number | null
  title: string
  topic: string
  difficulty: string | null
  completed_at: string
}

export interface DailyActivityPoint {
  date: string
  count: number
  level: number
}

export interface AnalyticsSummary {
  totals: AnalyticsTotals
  difficulty_distribution: NamedCount[]
  topic_mastery: NamedCount[]
  weekly_progress: WeeklyProgressPoint[]
  daily_activity: DailyActivityPoint[]
  recent_activity: RecentActivityItem[]
}

interface UseAnalyticsResult {
  data: AnalyticsSummary | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Fetches the authenticated user's aggregated analytics from the backend.
 * Returns loading / error state and a manual refresh handle so pages can
 * re-pull after the user marks something complete.
 */
export function useAnalytics(): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) throw new Error("Not authenticated")
      const token = sessionData.session.access_token

      const res = await fetch(`${API_BASE}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `Request failed with status ${res.status}`)
      }
      const json: AnalyticsSummary = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
