'use client'

import React from 'react'
import Link from 'next/link'

interface RoadmapCardProps {
  id: string
  title: string
  description: string
  progress: number
}

export const RoadmapCard: React.FC<RoadmapCardProps> = ({ id, title, description, progress }) => {
  return (
    <Link href={`/dashboard/roadmap/${id}`} className="block border rounded p-4 hover:shadow-lg transition">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-gray-600">{description}</p>
      <div className="mt-3 bg-gray-200 rounded h-2">
        <div className="bg-blue-500 h-2 rounded" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1 text-sm text-gray-500">{progress}% completed</p>
    </Link>
  )
}
