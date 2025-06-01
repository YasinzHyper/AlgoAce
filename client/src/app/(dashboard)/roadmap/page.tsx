"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
// import { Toaster } from '@/components/ui/sonner'
import { Toaster, toast } from 'sonner'
import Link from 'next/link'


const RoadmapDashboard = () => {
  const [roadmaps, setRoadmaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // const { toast } = toast()
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

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="p-6">
      <Toaster />
      <h1 className="text-3xl font-bold mb-6">Your Roadmaps</h1>
      <Button asChild className="mb-6">
        <Link href="/roadmap/create">Create New Roadmap</Link>
      </Button>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {roadmaps.map(roadmap => (
          <RoadmapCard key={roadmap.id} roadmap={roadmap} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}

const RoadmapCard = ({ roadmap, onDelete }: { roadmap: any, onDelete: (id: number) => void }) => {
  const { goal, weeks, company } = roadmap.user_input
  return (
    <Card>
      <CardHeader>
        <CardTitle>{goal}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Weeks: {weeks}</p>
        {company && <p>Company: {company}</p>}
        <div className="mt-4 flex justify-between">
          <Link href={`/roadmap/${roadmap.id}`}>
            <Button variant="outline" className='cursor-pointer'>View</Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className='cursor-pointer'>Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the roadmap.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(roadmap.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

export default RoadmapDashboard