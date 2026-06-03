"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"
import type { AnalyticsSummary } from "./use-analytics"
import type { RoadmapProgressSummary } from "./use-roadmap-progress"

export interface DashboardNextTask {
  roadmap_id: number
  task_id: number
  week: number
  completed: number
  total: number
}

export interface DashboardPayload {
  summary: AnalyticsSummary
  roadmap: RoadmapProgressSummary | null
  roadmap_count: number
  next_task: DashboardNextTask | null
}

import { API_BASE } from "@/lib/api"

/**
 * Single-shot fetch for the `/dashboard` page (analytics summary + active
 * roadmap snapshot + next-incomplete-week pointer). Challenge stats and
 * leaderboard rank are fetched separately via their dedicated hooks so the
 * server-side stale-challenge sweep still runs.
 */
export function useDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) throw new Error("Not authenticated")
      const token = sessionData.session.access_token
      const res = await fetch(`${API_BASE}/api/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `Request failed with status ${res.status}`)
      }
      const json: DashboardPayload = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
