"use client"
import React, { useState } from 'react'

interface RoadmapEditorProps {
  initialData?: {
    goal: string
    deadline?: string
    current_knowledge: Record<string, { level: string }>
    weekly_hours: number
    weeks: number
  }
  onSave: (data: { goal: string; deadline: string; current_knowledge: Record<string, { level: string }>; weekly_hours: number; weeks: number }) => void
}

export const RoadmapEditor: React.FC<RoadmapEditorProps> = ({ initialData, onSave }) => {
  const [goal, setGoal] = useState(initialData?.goal || '')
  const [deadline, setDeadline] = useState(initialData?.deadline || '')
  const [weekly_hours, setWeekly_hours] = useState(initialData?.weekly_hours || 4)
  const [weeks, setWeeks] = useState<number>(initialData?.weeks || 1)
  const [knowledgeList, setKnowledgeList] = useState<{ key: string; value: string }[]>(
    initialData?.current_knowledge
      ? Object.entries(initialData.current_knowledge).map(([key, value]) => ({ key, value: value.level }))
      : [{ key: '', value: '' }]
  )
  const [error, setError] = useState<string | null>(null)

  const handleKnowledgeChange = (idx: number, field: 'key' | 'value', value: string) => {
    setKnowledgeList(list =>
      list.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    )
  }

  const addKnowledge = () => setKnowledgeList(list => [...list, { key: '', value: '' }])
  const removeKnowledge = (idx: number) =>
    setKnowledgeList(list => list.length > 1 ? list.filter((_, i) => i !== idx) : list)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // Build current_knowledge as object of objects
    const current_knowledge: Record<string, { level: string }> = {}
    knowledgeList.forEach(({ key, value }) => {
      if (key && value) current_knowledge[key] = { level: value }
    })

    // Validation
    if (!goal.trim()) {
      setError('Goal is required.')
      return
    }
    if (!deadline) {
      setError('Deadline is required.')
      return
    }
    if (Object.keys(current_knowledge).length === 0) {
      setError('At least one knowledge area is required.')
      return
    }
    if (!weekly_hours || isNaN(Number(weekly_hours))) {
      setError('Weekly hours is required and must be a number.')
      return
    }
    if (!weeks || isNaN(Number(weeks))) {
      setError('Weeks is required and must be a number.')
      return
    }

    onSave({
      goal,
      deadline,
      current_knowledge,
      weekly_hours: Number(weekly_hours),
      weeks: Number(weeks)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
      {error && <div className="text-red-600">{error}</div>}
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
        <label className="block font-semibold">Deadline</label>
        <input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="border rounded p-2 w-full"
          required
        />
      </div>
      <div>
        <label className="block font-semibold">Current Knowledge</label>
        <div className="space-y-2">
          {knowledgeList.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                placeholder="Topic (e.g. Graphs)"
                value={item.key}
                onChange={e => handleKnowledgeChange(idx, 'key', e.target.value)}
                className="border rounded p-2 flex-1"
                required
              />
              <input
                placeholder="Level (e.g. Advanced)"
                value={item.value}
                onChange={e => handleKnowledgeChange(idx, 'value', e.target.value)}
                className="border rounded p-2 flex-1"
                required
              />
              <button type="button" onClick={() => removeKnowledge(idx)} className="px-2 text-red-500">-</button>
            </div>
          ))}
          <button type="button" onClick={addKnowledge} className="text-blue-600 underline text-sm">+ Add Knowledge Area</button>
        </div>
      </div>
      <div>
        <label className="block font-semibold">Number of Weekly Hours</label>
        <input
          type="number"
          value={weekly_hours}
          onChange={e => setWeekly_hours(Number(e.target.value))}
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
          onChange={e => setWeeks(Number(e.target.value))}
          className="border rounded p-2 w-full"
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