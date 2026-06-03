"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE } from '@/lib/api'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utils/supabase/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarRange,
  Map,
  Plus,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/layout/empty-state'

type SortOrder = 'newest' | 'oldest' | 'deadline'

type PaceStatus = 'ahead' | 'on_track' | 'behind' | 'no_data'

interface RoadmapOverview {
  roadmap_id: number
  overall: { completed: number; total: number; percentage: number }
  pace: { status: PaceStatus; delta: number; days_remaining: number | null }
  total_weeks: number
  weak_topics: string[]
}

const PACE_BADGE: Record<PaceStatus, { label: string; className: string }> = {
  ahead: {
    label: 'Ahead',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  on_track: {
    label: 'On track',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  behind: {
    label: 'Behind',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
  no_data: {
    label: 'Not started',
    className: 'border-muted bg-muted/40 text-muted-foreground',
  },
}

const RoadmapDashboard = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [roadmaps, setRoadmaps] = useState<any[]>([])
  const [overview, setOverview] = useState<Record<number, RoadmapOverview>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const router = useRouter()

  const sortedRoadmaps = useMemo(() => {
    const list = [...roadmaps]
    const ts = (v: string | undefined) => (v ? new Date(v).getTime() : 0)
    switch (sortOrder) {
      case 'oldest':
        return list.sort((a, b) => ts(a.created_at) - ts(b.created_at))
      case 'deadline':
        return list.sort((a, b) => {
          const ad = a.user_input?.deadline
          const bd = b.user_input?.deadline
          if (!ad && !bd) return ts(b.created_at) - ts(a.created_at)
          if (!ad) return 1
          if (!bd) return -1
          return ts(ad) - ts(bd)
        })
      case 'newest':
      default:
        return list.sort((a, b) => ts(b.created_at) - ts(a.created_at))
    }
  }, [roadmaps, sortOrder])

  useEffect(() => {
    const fetchRoadmaps = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          throw new Error('Not authenticated')
        }
        const token = sessionData.session.access_token
        const response = await fetch(`${API_BASE}/api/roadmap`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (!response.ok) {
          throw new Error('Failed to fetch roadmaps')
        }
        const data = await response.json()
        console.log('API Response:', data)
        setRoadmaps(data.roadmaps)

        // Fetch per-roadmap completion in one shot so each card can render a
        // progress bar inline. Non-blocking: failure here doesn't hide cards.
        try {
          const ovRes = await fetch(`${API_BASE}/api/analytics/roadmaps`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (ovRes.ok) {
            const ovJson = await ovRes.json()
            setOverview(ovJson.roadmaps ?? {})
          }
        } catch (e) {
          console.warn('Roadmap overview fetch failed', e)
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchRoadmaps()
  }, [])

  const handleDelete = async (id: number) => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error("You must be logged in to delete the roadmap")
      }
      const token = sessionData.session.access_token
      const response = await fetch(`${API_BASE}/api/roadmap/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error('Failed to delete roadmap')
      }
      setRoadmaps(prev => prev.filter(r => r.id !== id))
      toast.success("Success", {
        description: 'Roadmap deleted successfully',
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("Error", {
        description: err.message,
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Roadmaps" description="Loading your personalized plans..." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Roadmaps" />
        <EmptyState
          icon={Map}
          title="Couldn't load your roadmaps"
          description={error}
          action={
            <Button onClick={() => router.refresh()} variant="outline">
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Toaster />
      <PageHeader
        title="Roadmaps"
        description="Personalized study plans tailored to your goal and timeline."
        actions={
          <>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
              <SelectTrigger className="w-[160px]" aria-label="Sort roadmaps">
                <ArrowUpDown className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="deadline">Deadline soonest</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/roadmap/create">
                <Plus className="size-4" />
                New roadmap
              </Link>
            </Button>
          </>
        }
      />

      {roadmaps.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No roadmaps yet"
          description="Create your first roadmap to get a week-by-week plan for your target role."
          action={
            <Button asChild>
              <Link href="/roadmap/create">
                <Plus className="size-4" />
                Create roadmap
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 stagger-children sm:grid-cols-2 xl:grid-cols-3">
          {sortedRoadmaps.map((roadmap) => (
            <RoadmapCard
              key={roadmap.id}
              roadmap={roadmap}
              overview={overview[roadmap.id]}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const RoadmapCard = ({
  roadmap,
  overview,
  onDelete,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roadmap: any
  overview?: RoadmapOverview
  onDelete: (id: number) => void
}) => {
  const { goal, weeks, company, deadline, role } = roadmap.user_input
  const deadlineDate = deadline ? new Date(deadline).toLocaleDateString() : null
  const pace = overview ? PACE_BADGE[overview.pace.status] ?? PACE_BADGE.no_data : null

  return (
    <Card className="group flex flex-col transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-lg leading-snug">{goal}</CardTitle>
          {pace && (
            <Badge variant="outline" className={cn('shrink-0', pace.className)}>
              {pace.label}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {company && (
            <Badge variant="secondary" className="gap-1">
              <Building2 className="size-3" />
              {company}
            </Badge>
          )}
          {role && (
            <Badge variant="secondary" className="gap-1">
              <Briefcase className="size-3" />
              {role}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-4" />
            {weeks} weeks
          </span>
          {deadlineDate && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" />
              Due {deadlineDate}
            </span>
          )}
        </div>
        {overview && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold">{overview.overall.percentage}%</span>
              <span className="text-muted-foreground">
                {overview.overall.completed}/{overview.overall.total} problems
              </span>
            </div>
            <Progress value={overview.overall.percentage} className="h-1.5" />
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 border-t pt-4">
        <Button asChild className="flex-1">
          <Link href={`/roadmap/${roadmap.id}`}>
            View <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/problems?roadmap=${roadmap.id}`}>Problems</Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete roadmap"
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this roadmap?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All tasks and progress associated
                with this roadmap will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(roadmap.id)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}

export default RoadmapDashboard