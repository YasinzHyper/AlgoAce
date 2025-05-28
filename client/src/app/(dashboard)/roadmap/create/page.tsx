"use client"
import { RoadmapEditor } from '@/components/roadmap/roadmap-editor'
import { useRouter, useSearchParams } from 'next/navigation'

export default function CreateRoadmapPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accessToken = searchParams.get('access_token')

  const handleSave = async (data: { goal: string; deadline: string; current_knowledge: Record<string, { level: string }>; weekly_hours: number; weeks: number }) => {
    try {
      const cleanData = {
        goal: data.goal?.trim(),
        deadline: data.deadline?.trim(),
        current_knowledge: data.current_knowledge,
        weekly_hours: Number(data.weekly_hours),
        weeks: Number(data.weeks)
      }
      // Debug: log the payload
      console.log("Sending to backend:", cleanData);

      // Build query string for token if required by backend
      let url = 'http://localhost:8000/api/roadmap/generate';
      if (accessToken) {
        // If backend expects token as query param (?token=...)
        url += `?token=${encodeURIComponent(accessToken)}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanData),
      })

      if (res.ok) {
        router.push('/dashboard/roadmap')
      } else {
        const err = await res.text();
        alert('Failed to create roadmap: ' + err)
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
