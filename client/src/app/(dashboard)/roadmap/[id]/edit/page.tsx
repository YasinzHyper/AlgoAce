
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { RoadmapEditor } from '@/components/roadmap/roadmap-editor'

const EditRoadmapPage = () => {
  const router = useRouter()
  const { goal } = router.query
  const [initialData, setInitialData] = useState(null)

  useEffect(() => {
    if (!goal) return
    fetch(`/api/roadmap/generate${goal}`)
      .then(res => res.json())
      .then(data => setInitialData(data))
      .catch(console.error)
  }, [goal])

interface RoadmapData {
    // Add properties according to your roadmap data structure
    [key: string]: any;
}


interface SaveData {
    // Add properties according to the data being saved
    [key: string]: any;
}

const handleSave = async (data: SaveData): Promise<void> => {
    try {
        const res = await fetch(`/api/roadmaps/${goal}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        if (res.ok) {
            router.push(`/dashboard/roadmap/${goal}`)
        } else {
            alert('Failed to update roadmap')
        }
    } catch (error) {
        console.error(error)
        alert('Error updating roadmap')
    }
}

  if (!initialData) return <p>Loading...</p>

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Roadmap</h1>
      <RoadmapEditor initialData={initialData} onSave={handleSave} />
    </div>
  )
}

export default EditRoadmapPage
