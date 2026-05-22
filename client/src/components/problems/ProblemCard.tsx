import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Building, Star, Tag } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/utils/supabase/utils"

interface ProblemDetail {
  id: number
  title: string
  difficulty: "Easy" | "Medium" | "Hard"
  related_topics: string[]
  companies: string[]
  acceptance_rate: number
}

interface ProblemCardProps {
  problem: ProblemDetail
  /** Task this problem belongs to; used to persist completion + deep-link. */
  taskId?: number
  /** Controlled completion value from the server. Falls back to local state if omitted. */
  completed?: boolean
  /** Called when the user toggles the checkbox. If omitted, state stays local-only. */
  onToggleComplete?: (checked: boolean) => void
  /** Disable the checkbox while a toggle request is in flight. */
  pending?: boolean
}

const DIFFICULTY_STYLES: Record<
  ProblemDetail["difficulty"],
  { badge: string; accent: string }
> = {
  Easy: {
    badge:
      "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    accent: "bg-emerald-500",
  },
  Medium: {
    badge:
      "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400",
    accent: "bg-amber-500",
  },
  Hard: {
    badge:
      "border-rose-500/20 bg-rose-500/15 text-rose-700 dark:text-rose-400",
    accent: "bg-rose-500",
  },
}

export default function ProblemCard({
  problem,
  taskId,
  completed,
  onToggleComplete,
  pending = false,
}: ProblemCardProps) {
  const [localCompleted, setLocalCompleted] = useState(false)
  const [isImportant, setIsImportant] = useState(false)

  const isControlled = completed !== undefined
  const isCompleted = isControlled ? completed : localCompleted

  const handleToggle = (checked: boolean) => {
    if (onToggleComplete) {
      onToggleComplete(checked)
    }
    if (!isControlled) {
      setLocalCompleted(checked)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(`important-problem-${problem.id}`)
    if (saved === "true") setIsImportant(true)
  }, [problem.id])

  useEffect(() => {
    localStorage.setItem(
      `important-problem-${problem.id}`,
      isImportant ? "true" : "false"
    )
  }, [isImportant, problem.id])

  const styles = DIFFICULTY_STYLES[problem.difficulty] ?? DIFFICULTY_STYLES.Easy

  const displayedTopics = problem.related_topics.slice(0, 3)
  const moreTopicsCount = problem.related_topics.length - 3

  const displayedCompanies = problem.companies.slice(0, 3)
  const moreCompaniesCount = problem.companies.length - 3

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md",
        isCompleted && "opacity-70"
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", styles.accent)} />
      <CardHeader className="space-y-3 pl-7">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <Checkbox
              id={`completed-${problem.id}`}
              checked={isCompleted}
              disabled={pending}
              onCheckedChange={(checked) => handleToggle(checked as boolean)}
              className="mt-0.5 shrink-0"
              aria-label="Mark as completed"
            />
            <Link
              href={taskId ? `/problems/${problem.id}?task=${taskId}` : `/problems/${problem.id}`}
              className="min-w-0"
            >
              <CardTitle
                className={cn(
                  "line-clamp-2 text-base leading-snug transition-colors group-hover:text-primary",
                  isCompleted && "line-through"
                )}
              >
                {problem.title}
              </CardTitle>
            </Link>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 shrink-0 text-muted-foreground hover:text-amber-500",
              isImportant && "text-amber-500"
            )}
            onClick={() => setIsImportant(!isImportant)}
            aria-label={isImportant ? "Remove bookmark" : "Bookmark problem"}
          >
            <Star className="size-4" fill={isImportant ? "currentColor" : "none"} />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("font-medium", styles.badge)}>
            {problem.difficulty}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {problem.acceptance_rate}% acceptance
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pl-7">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Tag className="size-3.5" />
            Topics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayedTopics.map((topic) => (
              <Badge key={topic} variant="secondary" className="font-normal">
                {topic}
              </Badge>
            ))}
            {moreTopicsCount > 0 && (
              <Badge variant="outline" className="font-normal">
                +{moreTopicsCount}
              </Badge>
            )}
          </div>
        </div>
        {displayedCompanies.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Building className="size-3.5" />
              Companies
            </div>
            <div className="flex flex-wrap gap-1.5">
              {displayedCompanies.map((company) => (
                <Badge key={company} variant="outline" className="font-normal">
                  {company}
                </Badge>
              ))}
              {moreCompaniesCount > 0 && (
                <Badge variant="outline" className="font-normal">
                  +{moreCompaniesCount}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}