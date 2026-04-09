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
                <ProblemCard key={problem.id} problem={problem} />
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