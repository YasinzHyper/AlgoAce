import React, { useState } from 'react'

interface RoadmapEditorProps {
  initialData?: {
    title: string
    description: string
    weeks: number
    goal: string
  }
  onSave: (data: { title: string; description: string; weeks: number; goal: string }) => void
}

export const RoadmapEditor: React.FC<RoadmapEditorProps> = ({ initialData, onSave }) => {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [weeks, setWeeks] = useState(initialData?.weeks || 4)
  const [goal, setGoal] = useState(initialData?.goal || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ title, description, weeks, goal })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
      <div>
        <label className="block font-semibold">Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="border rounded p-2 w-full"
          required
        />
      </div>
      <div>
        <label className="block font-semibold">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="border rounded p-2 w-full"
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
      <div>
        <label className="block font-semibold">Goal</label>
        <input
          value={goal}
          onChange={e => setGoal(e.target.value)}
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