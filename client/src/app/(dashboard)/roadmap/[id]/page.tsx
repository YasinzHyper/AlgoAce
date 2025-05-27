"use client"
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { RoadmapProgress } from '@/components/roadmap/roadmap-progress'

interface RoadmapDetail {
  id: string
  title: string
  description: string
  progress: number
  weeks: number
  goal: string
}

const RoadmapDetailPage = () => {
  const router = useRouter()
  const { id } = router.query
  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/roadmaps/${id}`)
      .then(res => res.json())
      .then(data => setRoadmap(data))
      .catch(console.error)
  }, [id])

  if (!roadmap) return <p>Loading...</p>
return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{roadmap.title}</h1>
      <p className="mb-4">{roadmap.description}</p>
      <p className="mb-2"><strong>Goal:</strong> {roadmap.goal}</p>
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