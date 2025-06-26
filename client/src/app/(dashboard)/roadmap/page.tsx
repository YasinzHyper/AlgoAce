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

  // Remove sort/filter logic, just show all roadmaps
  let displayedRoadmaps = roadmaps;

  if (loading) return <div className="flex items-center justify-center h-96 text-lg text-muted-foreground">Loading your roadmaps...</div>
  if (error) return <div className="flex items-center justify-center h-96 text-lg text-red-500">Error: {error}</div>

  return (
    <div className="p-6">
      <Toaster />
      <h1 className="text-3xl font-bold mb-6 text-primary">Your Roadmaps</h1>
      <Button asChild className="flex items-center gap-2 px-5 py-2 text-base font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg hover:from-blue-600 hover:to-indigo-600 mb-6">
        <Link href="/roadmap/create">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create New Roadmap
        </Link>
      </Button>
      {displayedRoadmaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0V7a4 4 0 00-4-4H7a4 4 0 00-4 4v10a4 4 0 004 4h10a4 4 0 004-4v-4a4 4 0 00-4-4h-4" /></svg>
          <span className="text-lg">No roadmaps found. Start by creating a new roadmap!</span>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {displayedRoadmaps.map(roadmap => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

const RoadmapCard = ({ roadmap, onDelete }: { roadmap: any, onDelete: (id: number) => void }) => {
  const { goal, weeks, company, deadline, role } = roadmap.user_input;
  const deadlineDate = deadline ? new Date(deadline).toLocaleDateString() : 'N/A';
  return (
    <Card className="transition-shadow duration-200 hover:shadow-2xl hover:border-primary border border-gray-200 bg-blue/90">
      <CardHeader>
        <CardTitle className="flex flex-col gap-1 text-xl font-semibold">
          <span className="break-words max-w-full">{goal}</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {company && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium w-fit">{company}</span>}
            {role && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium w-fit">{role}</span>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-2 text-xs text-muted-foreground">
          <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">{weeks} weeks</span>
          <span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">Deadline: {deadlineDate}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 items-center">
          <Link href={`/roadmap/${roadmap.id}`} className="w-full">
            <Button variant="default" className="w-full cursor-pointer bg-green-500 hover:bg-green-600 text-white">View</Button>
          </Link>
          <Link href={`/problems?roadmap=${roadmap.id}`} className="w-full">
            <Button variant="secondary" className="w-full cursor-pointer">Problems</Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full cursor-pointer col-span-2">Delete</Button>
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
  );
}

export default RoadmapDashboard