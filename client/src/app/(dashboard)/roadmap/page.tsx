"use client"
import React, { useEffect, useState } from 'react'
import { RoadmapCard } from '@/components/roadmap/roadmap-card'
import Link from 'next/link'

interface Roadmap {
  goal: string
  current_knowledge: string
  weekly_hours: number
  weeks: number
}

const RoadmapPage = () => {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])

  useEffect(() => {
    // Get access_token from URL if present
    const params = new URLSearchParams(window.location.search)
    let accessToken = params.get('access_token')
    
    // If not in URL, try localStorage
    if (!accessToken) {
      accessToken = localStorage.getItem('access_token')
    }

    let url = 'http://localhost:8000/api/roadmap'
    if (accessToken) {
      url += `?token=${encodeURIComponent(accessToken)}`
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        // If your backend returns { roadmaps: [...] }
        if (Array.isArray(data)) {
          setRoadmaps(data)
        } else if (Array.isArray(data.roadmaps)) {
          setRoadmaps(data.roadmaps)
        } else {
          setRoadmaps([]) // fallback to empty array to avoid crash
        }
      })
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
          <RoadmapCard key={r.goal} {...r} />
        ))}
      </div>
    </div>
  )
}

export default RoadmapPage
