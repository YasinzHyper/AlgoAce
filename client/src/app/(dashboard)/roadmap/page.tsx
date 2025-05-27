"use client"
import React, { useEffect, useState } from 'react'
import { RoadmapCard } from '@/components/roadmap/roadmap-card'
import Link from 'next/link'

interface Roadmap {
  id: string
  title: string
  description: string
  progress: number
}

const RoadmapPage = () => {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])

  useEffect(() => {
    fetch('/api/roadmaps')
      .then(res => res.json())
      .then(data => setRoadmaps(data))
      .catch(console.error)
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Your Roadmaps</h1>

      <Link
  href="/roadmap/create"
  className="inline-block mb-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
>
  + Create New Roadmap
</Link>


      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {roadmaps.map(r => (
          <RoadmapCard key={r.id} {...r} />
        ))}
      </div>
    </div>
  )
}

export default RoadmapPage
