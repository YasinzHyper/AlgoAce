"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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


const RoadmapDashboard = () => {
  const [roadmaps, setRoadmaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchRoadmaps = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          throw new Error('Not authenticated')
        }
        const token = sessionData.session.access_token
        const response = await fetch('http://localhost:8000/api/roadmap', {
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
      const response = await fetch(`http://localhost:8000/api/roadmap/${id}`, {
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
          <Button asChild>
            <Link href="/roadmap/create">
              <Plus className="size-4" />
              New roadmap
            </Link>
          </Button>
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
          {roadmaps.map((roadmap) => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

const RoadmapCard = ({
  roadmap,
  onDelete,
}: {
  roadmap: any
  onDelete: (id: number) => void
}) => {
  const { goal, weeks, company, deadline, role } = roadmap.user_input
  const deadlineDate = deadline ? new Date(deadline).toLocaleDateString() : null

  return (
    <Card className="group flex flex-col transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
      <CardHeader className="space-y-3">
        <CardTitle className="line-clamp-2 text-lg leading-snug">{goal}</CardTitle>
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
      <CardContent className="flex-1">
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