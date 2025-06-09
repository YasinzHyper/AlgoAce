import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Roadmap {
  id: number
  user_input: {
    goal: string
    weeks: number
  }
}

interface RoadmapSelectorProps {
  roadmaps: Roadmap[]
  selectedRoadmap: Roadmap | null
  onSelect: (roadmap: Roadmap) => void
}

export default function RoadmapSelector({ roadmaps, selectedRoadmap, onSelect }: RoadmapSelectorProps) {
  return (
    <Select
      value={selectedRoadmap?.id.toString() || ""}
      onValueChange={(value) => {
        const roadmap = roadmaps.find(r => r.id === parseInt(value))
        if (roadmap) onSelect(roadmap)
      }}
    >
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Select a roadmap" />
      </SelectTrigger>
      <SelectContent>
        {roadmaps.map((roadmap) => (
          <SelectItem key={roadmap.id} value={roadmap.id.toString()}>
            {roadmap.user_input.goal}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}