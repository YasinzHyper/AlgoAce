"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { ReactFlow, Background, Controls, Node, Edge, BackgroundVariant } from '@xyflow/react'
import { format } from 'date-fns'
import '@xyflow/react/dist/style.css';

// Define TypeScript interfaces for type safety
interface TopicItem {
  [topic: string]: string // topic name: difficulty level
}

interface WeekData {
  week: number
  DSA?: TopicItem
  Other?: TopicItem
}

interface UserInput {
  goal: string
  deadline: string | null
  weeks: number
  company?: string
}

interface Roadmap {
  id: number
  user_id: string
  created_at: string
  roadmap_data: WeekData[]
  company?: string
  user_input: UserInput
}

// Custom WeekNode component
const WeekNode = ({ data }: { data: { week: number; topics: { category: string; items: [string, string][] }[] } }) => {
  return (
    <div className="w-72 bg-gray-100 border rounded-lg shadow-md p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">Week {data.week}</h3>
      {data.topics.map((section) => (
        <div key={section.category} className="mb-4">
          <h4 className={`font-semibold ${section.category === 'DSA' ? 'text-blue-600' : 'text-green-600'}`}>
            {section.category}
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-gray-700">
            {section.items.map(([topic, level], idx) => (
              <li key={idx} className="flex justify-between items-center">
                <span>{topic}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    level === 'Basic'
                      ? 'bg-green-100 text-green-800'
                      : level === 'Intermediate'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {level}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

const nodeTypes = { weekNode: WeekNode }

const RoadmapDetailPage = () => {
  const params = useParams()
  const id = params.id as string
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRoadmap = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error('Not authenticated')
        const token = sessionData.session.access_token

        const response = await fetch(`http://localhost:8000/api/roadmap/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) throw new Error('Failed to fetch roadmap')
        const data: Roadmap = await response.json()
        setRoadmap(data)

        // Transform roadmap data into React Flow nodes
        const roadmapNodes: Node[] = data.roadmap_data.map((weekData, index) => {
          const topics = [
            { category: 'DSA', items: weekData.DSA ? Object.entries(weekData.DSA) : [] },
            { category: 'Other', items: weekData.Other ? Object.entries(weekData.Other) : [] },
          ].filter((section) => section.items.length > 0)

          return {
            id: `week-${weekData.week}`,
            type: 'weekNode',
            position: { x: index * 350, y: 0 }, // Horizontal layout with spacing
            data: { week: weekData.week, topics },
          }
        })

        // Create edges to connect weeks sequentially
        const roadmapEdges: Edge[] = roadmapNodes.slice(0, -1).map((node, index) => ({
          id: `edge-${node.id}-${roadmapNodes[index + 1].id}`,
          source: node.id,
          target: roadmapNodes[index + 1].id,
          type: 'smoothstep',
          style: { stroke: '#333', strokeWidth: 2},
        }))

        // Log to debug
        console.log('Nodes:', roadmapNodes)
        console.log('Edges:', roadmapEdges)

        setNodes(roadmapNodes)
        setEdges(roadmapEdges)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchRoadmap()
  }, [id])

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading roadmap...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">Error: {error}</div>
  }

  if (!roadmap) {
    return <div className="p-6 text-center text-gray-500">Roadmap not found</div>
  }

  const { goal, deadline, weeks, company } = roadmap.user_input

  return (
    <div className="p-6 h-full">
      {/* Roadmap Metadata */}
      <div className="mb-2 p-4 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-2">{goal}</h1>
        <p className="text-gray-500">
          Deadline: {deadline ? format(new Date(deadline), 'PPP') : 'Not specified'}
        </p>
        <p className="text-gray-500">Duration: {weeks} weeks</p>
        {company && <p className="text-gray-600">Company: {company}</p>}
      </div>

      {/* React Flow Visualization */}
      <div style={{ width: '100%', height: '500px' }} className="rounded-lg shadow-sm overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 50, y: 50, zoom: 0.8 }}
          panOnDrag={true}
          panOnScroll={true}
          zoomOnScroll={true}
          minZoom={0.2}
          maxZoom={2}
          fitView={false}
          // colorMode='light'
        >
          <Background variant={BackgroundVariant.Dots} gap={16} />
          <Controls style={{color:"black"}}/>
        </ReactFlow>
      </div>
    </div>
  )
}

export default RoadmapDetailPage