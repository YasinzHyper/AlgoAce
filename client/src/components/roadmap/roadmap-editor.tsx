'use client'

import React, { useState } from 'react'

interface RoadmapEditorProps {
  onSave: (data: {
    goal: string
    current_knowledge: Record<string, string>
    weekly_hours: number
    weeks: number
  }) => void
}

export const RoadmapEditor: React.FC<RoadmapEditorProps> = ({ onSave }) => {
  const [goal, setGoal] = useState('')
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('')
  const [weeklyHours, setWeeklyHours] = useState(10)
  const [weeks, setWeeks] = useState(4)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const current_knowledge: Record<string, string> = {}
    if (topic && level) {
      current_knowledge[topic] = level
    }
    onSave({ goal, current_knowledge, weekly_hours: weeklyHours, weeks })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
      <div>
        <label className="block font-semibold">Goal</label>
        <input
          value={goal}
          onChange={e => setGoal(e.target.value)}
          className="border rounded p-2 w-full"
          required
        />
      </div>
      <div>
        <label className="block font-semibold">Topic</label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="border rounded p-2 w-full"
        />
      </div>
      <div>
        <label className="block font-semibold">Proficiency Level</label>
        <input
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="border rounded p-2 w-full"
        />
      </div>
      <div>
        <label className="block font-semibold">Weekly Hours</label>
        <input
          type="number"
          value={weeklyHours}
          onChange={e => setWeeklyHours(parseInt(e.target.value))}
          className="border rounded p-2 w-full"
          min={1}
          required
        />
      </div>
      <div>
        <label className="block font-semibold">Number of Weeks</label>
        <input
          type="number"
          value={weeks}
          onChange={e => setWeeks(parseInt(e.target.value))}
          className="border rounded p-2 w-full"
          min={1}
          required
        />
      </div>
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Save Roadmap
      </button>
    </form>
  )
}
