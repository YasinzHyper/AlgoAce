"use client"

import { Suspense, useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { API_BASE } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toaster, toast } from 'sonner'
import RoadmapSelector from '@/components/problems/RoadmapSelector'
import ProblemCard from '@/components/problems/ProblemCard'
import WeekPagination from '@/components/problems/WeekPagination'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/layout/empty-state'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Map,
  Search,
  SearchX,
  Sparkles,
  Target,
} from 'lucide-react'

const LAST_ROADMAP_KEY = 'algoace:last-problems-roadmap'
const LAST_WEEK_KEY = (roadmapId: number) => `algoace:last-problems-week:${roadmapId}`

// Define interfaces for raw problem data and transformed problem details
interface RawProblemData {
  id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  related_topics: string
  companies: string
  acceptance_rate: number
}

interface ProblemDetail {
  id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  related_topics: string[]
  companies: string[]
  acceptance_rate: number
}

interface Roadmap {
  id: number
  user_input: {
    goal: string
    weeks: number
  }
}

interface Task {
  id: number
  week: number
  lc_problem_ids: number[]
  other_topics: string[]
}

interface ProgressEntry {
  id: number
  task_id: number
  completed: {
    problems: Record<string, boolean>
    topics: Record<string, boolean>
  }
  completed_problem_count: number
  total_problem_count: number
  completion_percentage: number
  positive_feedback?: string | null
  negative_feedback?: string | null
}

interface WeekFeedback {
  positive: string
  negative: string
  focus_areas: string[]
}

function ProblemsPageContent() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentWeek, setCurrentWeek] = useState(1)
  const [loading, setLoading] = useState(true)
  const [problemDataset, setProblemDataset] = useState<RawProblemData[] | null>(null)
  const [currentWeekProblems, setCurrentWeekProblems] = useState<ProblemDetail[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')
  const [progressByTask, setProgressByTask] = useState<Record<number, ProgressEntry>>({})
  const [pendingProblemId, setPendingProblemId] = useState<number | null>(null)
  const [feedbackByTask, setFeedbackByTask] = useState<Record<number, WeekFeedback>>({})
  const [feedbackLoadingTaskId, setFeedbackLoadingTaskId] = useState<number | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Fetch roadmaps on mount
  useEffect(() => {
    const fetchRoadmaps = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error('Not authenticated')
        const token = sessionData.session.access_token

        const response = await fetch(`${API_BASE}/api/roadmap`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!response.ok) throw new Error('Failed to fetch roadmaps')
        const { roadmaps } = await response.json()
        setRoadmaps(roadmaps)

        // Resolve which roadmap to open. Precedence:
        //   1) ?roadmap= query param (deep link from roadmap card / progress panel)
        //   2) last-viewed roadmap persisted in localStorage
        //   3) newest roadmap (highest id)
        const byId = (id: number) => roadmaps.find((r: Roadmap) => r.id === id)
        let initial: Roadmap | undefined

        const roadmapParam = searchParams.get('roadmap')
        if (roadmapParam && /^\d+$/.test(roadmapParam)) {
          initial = byId(parseInt(roadmapParam))
        }
        if (!initial && typeof window !== 'undefined') {
          const stored = window.localStorage.getItem(LAST_ROADMAP_KEY)
          if (stored && /^\d+$/.test(stored)) initial = byId(parseInt(stored))
        }
        if (!initial && roadmaps.length > 0) {
          initial = [...roadmaps].sort((a: Roadmap, b: Roadmap) => b.id - a.id)[0]
        }
        if (initial) setSelectedRoadmap(initial)

        // Honour ?week= when arriving from the per-week links on the roadmap page.
        const weekParam = searchParams.get('week')
        if (initial && weekParam && /^\d+$/.test(weekParam)) {
          const w = parseInt(weekParam)
          if (w >= 1 && w <= initial.user_input.weeks) setCurrentWeek(w)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        toast.error('Error fetching roadmaps', { description: errorMessage })
      } finally {
        setLoading(false)
      }
    }
    fetchRoadmaps()
    // Intentionally mount-only: initial roadmap/week resolution reads the
    // *incoming* URL once. Subsequent URL updates are pushed *by* this page
    // (see the sync effect below) and must not trigger a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch problem dataset on mount
  useEffect(() => {
    const fetchProblemDataset = async () => {
      try {
        const response = await fetch('/leetcode-problems-dataset.json')
        if (!response.ok) throw new Error('Failed to fetch problem dataset')
        const data: RawProblemData[] = await response.json()
        setProblemDataset(data)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        toast.error('Error fetching problem dataset', { description: errorMessage })
      }
    }
    fetchProblemDataset()
  }, [])

  // Fetch tasks when roadmap changes
  useEffect(() => {
    if (!selectedRoadmap) return

    const fetchTasks = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error('Not authenticated')
        const token = sessionData.session.access_token

        const response = await fetch(`${API_BASE}/api/problems/${selectedRoadmap.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!response.ok) throw new Error('Failed to fetch tasks')
        const { tasks } = await response.json()
        setTasks(tasks)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        toast.error('Error fetching tasks', { description: errorMessage })
      }
    }
    fetchTasks()
  }, [selectedRoadmap])

  // Fetch per-task progress for the selected roadmap so checkboxes reflect server state
  useEffect(() => {
    if (!selectedRoadmap) {
      setProgressByTask({})
      return
    }

    const fetchProgress = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error('Not authenticated')
        const token = sessionData.session.access_token

        const response = await fetch(
          `${API_BASE}/api/progress/roadmap/${selectedRoadmap.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!response.ok) throw new Error('Failed to fetch progress')
        const { progress_entries } = await response.json()
        const map: Record<number, ProgressEntry> = {}
        const fbMap: Record<number, WeekFeedback> = {}
        for (const entry of progress_entries as ProgressEntry[]) {
          map[entry.task_id] = entry
          if (entry.positive_feedback || entry.negative_feedback) {
            fbMap[entry.task_id] = {
              positive: entry.positive_feedback ?? '',
              negative: entry.negative_feedback ?? '',
              focus_areas: [],
            }
          }
        }
        setProgressByTask(map)
        setFeedbackByTask(fbMap)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        toast.error('Error fetching progress', { description: errorMessage })
      }
    }
    fetchProgress()
  }, [selectedRoadmap])

  // Persist last viewed roadmap so returning to /problems lands where the user
  // left off instead of the oldest roadmap. Also restore the last-viewed week
  // for that roadmap (unless ?week= already set it above).
  useEffect(() => {
    if (!selectedRoadmap || typeof window === 'undefined') return
    window.localStorage.setItem(LAST_ROADMAP_KEY, String(selectedRoadmap.id))
    if (!searchParams.get('week')) {
      const stored = window.localStorage.getItem(LAST_WEEK_KEY(selectedRoadmap.id))
      if (stored && /^\d+$/.test(stored)) {
        const w = parseInt(stored)
        if (w >= 1 && w <= selectedRoadmap.user_input.weeks) setCurrentWeek(w)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoadmap])

  useEffect(() => {
    if (!selectedRoadmap || typeof window === 'undefined') return
    window.localStorage.setItem(LAST_WEEK_KEY(selectedRoadmap.id), String(currentWeek))
  }, [selectedRoadmap, currentWeek])

  // Keep ?roadmap= & ?week= in sync with the current selection so a browser
  // refresh / shared link lands on the same view (URL > localStorage).
  useEffect(() => {
    if (!selectedRoadmap) return
    const current = searchParams.toString()
    const params = new URLSearchParams(current)
    params.set('roadmap', String(selectedRoadmap.id))
    params.set('week', String(currentWeek))
    const next = params.toString()
    if (next !== current) {
      router.replace(`${pathname}?${next}`, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoadmap?.id, currentWeek])

  const handleGenerateWeekFeedback = async (taskId: number) => {
    setFeedbackLoadingTaskId(taskId)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) throw new Error('Not authenticated')
      const token = sessionData.session.access_token

      const response = await fetch(
        `${API_BASE}/api/progress/task/${taskId}/feedback`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Failed to generate feedback')
      }
      const json = await response.json()
      const progress: ProgressEntry = json.progress
      const focus: string[] = Array.isArray(json.focus_areas) ? json.focus_areas : []
      setProgressByTask((prev) => ({ ...prev, [taskId]: progress }))
      setFeedbackByTask((prev) => ({
        ...prev,
        [taskId]: {
          positive: progress.positive_feedback ?? '',
          negative: progress.negative_feedback ?? '',
          focus_areas: focus,
        },
      }))
      toast.success('Feedback updated')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error("Couldn't generate feedback", { description: errorMessage })
    } finally {
      setFeedbackLoadingTaskId(null)
    }
  }

  const handleToggleComplete = async (taskId: number, problemId: number, checked: boolean) => {
    // Optimistic update
    setPendingProblemId(problemId)
    setProgressByTask((prev) => {
      const entry = prev[taskId]
      if (!entry) return prev
      const nextProblems = { ...entry.completed.problems, [String(problemId)]: checked }
      const completedCount = Object.values(nextProblems).filter(Boolean).length
      const total = entry.total_problem_count || Object.keys(nextProblems).length
      return {
        ...prev,
        [taskId]: {
          ...entry,
          completed: { ...entry.completed, problems: nextProblems },
          completed_problem_count: completedCount,
          completion_percentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
        },
      }
    })

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) throw new Error('Not authenticated')
      const token = sessionData.session.access_token

      const response = await fetch(
        `${API_BASE}/api/progress/task/${taskId}/complete`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'problem', id: String(problemId), completed: checked }),
        }
      )
      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Failed to update progress')
      }
      const { progress } = await response.json()
      setProgressByTask((prev) => ({ ...prev, [taskId]: progress }))
      toast.success(checked ? 'Marked as completed' : 'Marked as incomplete')
    } catch (error) {
      // Revert optimistic update
      setProgressByTask((prev) => {
        const entry = prev[taskId]
        if (!entry) return prev
        const nextProblems = { ...entry.completed.problems, [String(problemId)]: !checked }
        const completedCount = Object.values(nextProblems).filter(Boolean).length
        const total = entry.total_problem_count || Object.keys(nextProblems).length
        return {
          ...prev,
          [taskId]: {
            ...entry,
            completed: { ...entry.completed, problems: nextProblems },
            completed_problem_count: completedCount,
            completion_percentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
          },
        }
      })
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error('Error updating progress', { description: errorMessage })
    } finally {
      setPendingProblemId(null)
    }
  }

  // Update current week's problems when tasks or week changes
  useEffect(() => {
    if (!problemDataset || !tasks.length) return

    const weekTask = tasks.find(task => task.week === currentWeek)
    if (!weekTask) {
      setCurrentWeekProblems([])
      return
    }

    const problemDetails = weekTask.lc_problem_ids
      .map(id => problemDataset.find(p => p.id === id))
      .filter((p): p is RawProblemData => p !== undefined)
      .map(p => ({
        ...p,
        related_topics: p.related_topics ? p.related_topics.split(',').map(t => t.trim()) : [],
        companies: p.companies ? p.companies.split(',').map(c => c.trim()) : [],
      }))

    setCurrentWeekProblems(problemDetails)
  }, [tasks, currentWeek, problemDataset])

  // Apply filters to current week's problems
  const filteredProblems = currentWeekProblems.filter(problem => {
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDifficulty = difficultyFilter === 'all' || problem.difficulty.toLowerCase() === difficultyFilter.toLowerCase()
    const matchesTopic = topicFilter === 'all' || problem.related_topics.some(t => t.toLowerCase() === topicFilter.toLowerCase())
    return matchesSearch && matchesDifficulty && matchesTopic
  })

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Problems" description="Loading your weekly problem set..." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!selectedRoadmap) {
    return (
      <div className="space-y-8">
        <PageHeader title="Problems" />
        <EmptyState
          icon={Map}
          title="No roadmap selected"
          description="Create a roadmap to unlock a personalized week-by-week problem set."
          action={
            <Button asChild>
              <Link href="/roadmap/create">Create roadmap</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const weekTask = tasks.find(task => task.week === currentWeek)
  const otherTopics = weekTask ? weekTask.other_topics : []
  const weekProgress = weekTask ? progressByTask[weekTask.id] : undefined
  const weekCompletedCount = weekProgress?.completed_problem_count ?? 0
  const weekTotalCount = weekProgress?.total_problem_count ?? currentWeekProblems.length
  const weekFeedback = weekTask ? feedbackByTask[weekTask.id] : undefined
  const weekFeedbackLoading = weekTask ? feedbackLoadingTaskId === weekTask.id : false

  return (
    <div className="space-y-8">
      <Toaster />
      <PageHeader
        title="Problems"
        description="Work through your roadmap one week at a time."
        actions={
          <RoadmapSelector
            roadmaps={roadmaps}
            selectedRoadmap={selectedRoadmap}
            onSelect={(roadmap) => {
              setSelectedRoadmap(roadmap)
              setCurrentWeek(1)
            }}
          />
        }
      />

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Week {currentWeek}</CardTitle>
              <Badge variant="secondary">
                {filteredProblems.length} of {currentWeekProblems.length}
              </Badge>
              {weekTotalCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                >
                  {weekCompletedCount}/{weekTotalCount} done
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="md:w-[170px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="md:w-[190px]">
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                <SelectItem value="arrays">Arrays</SelectItem>
                <SelectItem value="hash table">Hash Table</SelectItem>
                <SelectItem value="linked list">Linked List</SelectItem>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="dynamic programming">Dynamic Programming</SelectItem>
                <SelectItem value="math">Math</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {filteredProblems.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProblems.map((problem) => (
                <ProblemCard
                  key={problem.id}
                  problem={problem}
                  taskId={weekTask?.id}
                  completed={weekProgress?.completed?.problems?.[String(problem.id)] ?? false}
                  pending={pendingProblemId === problem.id}
                  onToggleComplete={
                    weekTask
                      ? (checked) => handleToggleComplete(weekTask.id, problem.id, checked)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
              title="No problems match your filters"
              description="Try clearing your search or selecting a different difficulty."
              className="border-0 bg-transparent p-8"
            />
          )}
          {otherTopics.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <h4 className="mb-2 text-sm font-semibold">
                Additional topics this week
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {otherTopics.map((topic, idx) => (
                  <Badge key={idx} variant="outline">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {weekTask && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="size-5 text-primary" />
                  Week {currentWeek} feedback
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  AI review of this week&apos;s problems against your goal.
                </p>
              </div>
              <Button
                variant={weekFeedback ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleGenerateWeekFeedback(weekTask.id)}
                disabled={weekFeedbackLoading}
              >
                {weekFeedbackLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    {weekFeedback ? 'Regenerate' : 'Generate feedback'}
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {weekFeedback ? (
              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div className="space-y-1.5 rounded-lg border bg-emerald-500/5 p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> What&apos;s working
                  </h4>
                  <p className="leading-relaxed text-muted-foreground">
                    {weekFeedback.positive}
                  </p>
                </div>
                <div className="space-y-1.5 rounded-lg border bg-rose-500/5 p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="size-3.5" /> What&apos;s at risk
                  </h4>
                  <p className="leading-relaxed text-muted-foreground">
                    {weekFeedback.negative}
                  </p>
                </div>
                {weekFeedback.focus_areas.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border bg-muted/40 p-4 md:col-span-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Target className="size-3.5" /> Focus next
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {weekFeedback.focus_areas.map((area, idx) => (
                        <Badge key={`${area}-${idx}`} variant="secondary">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate feedback to see what to prioritise this week and how it
                ties back to your overall plan.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <WeekPagination
        totalWeeks={selectedRoadmap.user_input.weeks}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
      />
    </div>
  )
}

export default function ProblemsPage() {
  return (
    <Suspense>
      <ProblemsPageContent />
    </Suspense>
  )
}