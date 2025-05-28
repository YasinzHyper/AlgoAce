'use client'

import { RoadmapEditor } from '@/components/roadmap/roadmap-editor'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function EditRoadmapPage() {
  const { id } = useParams()
  const router = useRouter()
  const [initialData, setInitialData] = useState(null)

  useEffect(() => {
    async function fetchRoadmap() {
      const res = await fetch(`http://127.0.0.1:8000/api/roadmap/${id}`)
      const data = await res.json()
      setInitialData(data)
    }

    if (id) fetchRoadmap()
  }, [id])

  const handleSave = async (data: { goal: string; current_knowledge: Record<string, string>; weekly_hours: number; weeks: number }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/roadmap/${id}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push('/dashboard/roadmap')
      } else {
        alert('Failed to update roadmap')
      }
    } catch (error) {
      console.error(error)
      alert('Error updating roadmap')
    }
  }

  if (!initialData) return <p>Loading...</p>

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Roadmap</h1>
      <RoadmapEditor initialData={initialData} onSave={handleSave} />
    </div>
  )
}
