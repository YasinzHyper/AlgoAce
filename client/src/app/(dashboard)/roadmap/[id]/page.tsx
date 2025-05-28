"use client"
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RoadmapProgress } from '@/components/roadmap/roadmap-progress'

interface RoadmapDetail {
  goal: string
  current_knowledge: string
  weekly_hours: number
  weeks: number
  progress: number
}

const RoadmapDetailPage = () => {
  const params = useParams()
  const id = params?.id as string
  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/roadmap/${id}`)
      .then(res => res.json())
      .then(data => setRoadmap(data))
      .catch(console.error)
  }, [id])

  if (!roadmap) return <p>Loading...</p>
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{roadmap.goal}</h1>
      <p className="mb-4">{roadmap.current_knowledge}</p>
      <p className="mb-2"><strong>weekly_hours:</strong> {roadmap.weekly_hours}</p>
      <p className="mb-4"><strong>Duration:</strong> {roadmap.weeks} weeks</p>
      <RoadmapProgress progress={roadmap.progress} />
      <div className="mt-6">
        <Link href={`/dashboard/roadmap/${id}/edit`} className="text-blue-600 underline">
          Edit Roadmap
        </Link>
      </div>
    </div>
  )
}

export default RoadmapDetailPage