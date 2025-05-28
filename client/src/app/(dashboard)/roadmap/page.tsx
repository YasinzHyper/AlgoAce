'use client'

import { RoadmapEditor } from '@/components/roadmap/roadmap-editor'
import { useRouter } from 'next/navigation'

export default function CreateRoadmapPage() {
  const router = useRouter()

  const handleSave = async (data: { title: string; description: string; weeks: number; goal: string }) => {
    try {
      const token = localStorage.getItem('access_token') // Ensure token is set after login
      const res = await fetch('http://127.0.0.1:8000/api/roadmap/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          goal: data.goal,
          current_knowledge: {},
          weekly_hours: 10,
          weeks: data.weeks,
        }),
      })

      if (res.ok) {
        router.push('/dashboard/roadmap')
      } else {
        alert('Failed to create roadmap')
      }
    } catch (error) {
      console.error(error)
      alert('Error creating roadmap')
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create New Roadmap</h1>
      <RoadmapEditor onSave={handleSave} />
    </div>
  )
}
