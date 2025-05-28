import React from 'react'
import Link from 'next/link'

interface RoadmapCardProps {
  goal: string
  current_knowledge: any // Accept JSON/object
  weekly_hours: number
  weeks: number
}

export const RoadmapCard: React.FC<RoadmapCardProps> = ({ goal, current_knowledge, weekly_hours, weeks }) => {
  // Render current_knowledge as pretty JSON (always JSON)
  let knowledgeDisplay: React.ReactNode = '';
  if (typeof current_knowledge === 'object' && current_knowledge !== null) {
    knowledgeDisplay = (
      <pre className="whitespace-pre-wrap break-words text-xs bg-gray-100 p-2 rounded">
        {JSON.stringify(current_knowledge, null, 2)}
      </pre>
    );
  } else if (typeof current_knowledge === 'string') {
    // fallback for legacy/string data
    knowledgeDisplay = (
      <pre className="whitespace-pre-wrap break-words text-xs bg-gray-100 p-2 rounded">
        {current_knowledge}
      </pre>
    );
  }

  return (
    <Link
      href={`/dashboard/roadmap/${goal}`}
      className="block border rounded p-4 hover:shadow-lg transition"
    >
      <h2 className="text-xl font-semibold">{goal}</h2>
      <div className="mt-2 text-gray-600">{knowledgeDisplay}</div>
      <div className="mt-3 bg-gray-200 rounded h-2">
        <div className="bg-blue-500 h-2 rounded" style={{ width: `${weekly_hours}%` }} />
      </div>
      <p className="mt-1 text-sm text-gray-500">{weeks}% completed</p>
    </Link>
  )
}
