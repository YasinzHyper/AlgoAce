"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { API_BASE } from '@/lib/api'
import { supabase } from '@/utils/supabase/client'
import { ReactFlow, Background, Controls, Node, Edge, BackgroundVariant, Handle, Position } from '@xyflow/react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { Toaster } from 'sonner'
import { RoadmapProgressPanel } from '@/components/roadmap/roadmap-progress-panel'
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
    <div className="w-72 rounded-lg border bg-card p-4 shadow-sm">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground"
      />
      <h3 className="text-lg font-bold mb-3 text-center">Week {data.week}</h3>
      {data.topics.map((section) => (
        <div key={section.category} className="mb-4">
          <h4 className={`font-semibold text-sm ${section.category === 'DSA' ? 'text-primary' : 'text-chart-2'}`}>
            {section.category}
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {section.items.map(([topic, level], idx) => (
              <li key={idx} className="flex justify-between items-center">
                <span className="text-foreground">{topic}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    level === 'Basic'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : level === 'Intermediate'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
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
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const fetchRoadmap = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error('Not authenticated')
        const token = sessionData.session.access_token

        const response = await fetch(`${API_BASE}/api/roadmap/${id}`, {
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
          type: ' ',
          style: { stroke: 'var(--border)', strokeWidth: 2 },
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
    return <div className="p-6 text-center text-muted-foreground">Loading roadmap...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-destructive">Error: {error}</div>
  }

  if (!roadmap) {
    return <div className="p-6 text-center text-muted-foreground">Roadmap not found</div>
  }

  const { goal, deadline, weeks, company } = roadmap.user_input

  return (
    <div className="h-full space-y-4">
      <Toaster />
      {/* Roadmap Metadata */}
      <div className="rounded-lg border bg-card p-4">
        <h1 className="text-2xl font-bold mb-2">{goal}</h1>
        <p className="text-muted-foreground">
          Deadline: {deadline ? format(new Date(deadline), 'PPP') : 'Not specified'}
        </p>
        <p className="text-muted-foreground">Duration: {weeks} weeks</p>
        {company && <p className="text-muted-foreground">Company: {company}</p>}
      </div>

      {/* Progress + AI feedback */}
      <RoadmapProgressPanel roadmapId={roadmap.id} />

      {/* React Flow Visualization */}
      <div className="h-[500px] w-full overflow-hidden rounded-lg border shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 50, y: 50, zoom: 1.0 }}
          panOnDrag={true}
          panOnScroll={true}
          zoomOnScroll={true}
          minZoom={0.2}
          maxZoom={2}
          fitView={false}
          colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} color="var(--border)" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

export default RoadmapDetailPage