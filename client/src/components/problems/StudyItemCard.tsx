"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { BookOpen, HelpCircle, Lightbulb, ExternalLink } from "lucide-react"
import { cn } from "@/utils/supabase/utils"

export interface OsStudyItem {
  id: number
  title: string
  type: "reading" | "question" | "concept"
  topic: string
  difficulty: string
  body: string
  url?: string | null
  estimated_minutes?: number
  lecture?: string
}

interface StudyItemCardProps {
  item: OsStudyItem
  taskId?: number
  completed?: boolean
  onToggleComplete?: (checked: boolean) => void
  pending?: boolean
}

const TYPE_ICONS = {
  reading: BookOpen,
  question: HelpCircle,
  concept: Lightbulb,
}

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Medium: "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Hard: "border-rose-500/20 bg-rose-500/15 text-rose-700 dark:text-rose-400",
}

export default function StudyItemCard({
  item,
  completed = false,
  onToggleComplete,
  pending = false,
}: StudyItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = TYPE_ICONS[item.type] ?? BookOpen

  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-1",
          item.difficulty === "Easy" && "bg-emerald-500",
          item.difficulty === "Medium" && "bg-amber-500",
          item.difficulty === "Hard" && "bg-rose-500"
        )}
      />
      <CardHeader className="pb-2 pl-5">
        <div className="flex items-start gap-3">
          {onToggleComplete && (
            <Checkbox
              checked={completed}
              disabled={pending}
              onCheckedChange={(v) => onToggleComplete(!!v)}
              className="mt-1"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="gap-1 capitalize">
                <Icon className="size-3" />
                {item.type}
              </Badge>
              <Badge
                variant="outline"
                className={DIFFICULTY_STYLES[item.difficulty] ?? ""}
              >
                {item.difficulty}
              </Badge>
              {item.lecture && (
                <Badge variant="secondary" className="text-xs">
                  {item.lecture}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pl-5">
        <p className="text-xs text-muted-foreground">{item.topic}</p>
        {(expanded || item.type === "concept") && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {item.body}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {item.body.length > 120 && item.type !== "concept" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : "Read more"}
            </Button>
          )}
          {item.url && (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 size-3" />
                Resource
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
