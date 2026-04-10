"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
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
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Map, Search, SearchX } from 'lucide-react'

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
}

export default function ProblemsPage() {
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
  const searchParams = useSearchParams()

  // Fetch roadmaps on mount
  useEffect(() => {
    const fetchRoadmaps = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error('Not authenticated')
        const token = sessionData.session.access_token

        const response = await fetch('http://localhost:8000/api/roadmap', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!response.ok) throw new Error('Failed to fetch roadmaps')
        const { roadmaps } = await response.json()
        setRoadmaps(roadmaps)

        // Check for roadmap ID in URL
        const roadmapId = searchParams.get('roadmap')
        if (roadmapId) {
          const roadmap = roadmaps.find((r: Roadmap) => r.id === parseInt(roadmapId))
          if (roadmap) {
            setSelectedRoadmap(roadmap)
          }
        } else if (roadmaps.length > 0) {
          setSelectedRoadmap(roadmaps[0])
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        toast.error('Error fetching roadmaps', { description: errorMessage })
      } finally {
        setLoading(false)
      }
    }
    fetchRoadmaps()
  }, [searchParams])

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

        const response = await fetch(`http://localhost:8000/api/problems/${selectedRoadmap.id}`, {
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
          `http://localhost:8000/api/progress/roadmap/${selectedRoadmap.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!response.ok) throw new Error('Failed to fetch progress')
        const { progress_entries } = await response.json()
        const map: Record<number, ProgressEntry> = {}
        for (const entry of progress_entries as ProgressEntry[]) {
          map[entry.task_id] = entry
        }
        setProgressByTask(map)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        toast.error('Error fetching progress', { description: errorMessage })
      }
    }
    fetchProgress()
  }, [selectedRoadmap])

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
        `http://localhost:8000/api/progress/task/${taskId}/complete`,
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

      <WeekPagination
        totalWeeks={selectedRoadmap.user_input.weeks}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
      />
    </div>
  )
}