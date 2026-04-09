import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { BookOpen, Building, Tag, Star } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

interface ProblemDetail {
  id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  related_topics: string[]
  companies: string[]
  acceptance_rate: number
}

interface ProblemCardProps {
  problem: ProblemDetail
}

export default function ProblemCard({ problem }: ProblemCardProps) {
  const [isCompleted, setIsCompleted] = useState(false)
  const [isImportant, setIsImportant] = useState(false)

  // Load important state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`important-problem-${problem.id}`)
    if (saved === 'true') setIsImportant(true)
  }, [problem.id])

  // Save important state to localStorage when changed
  useEffect(() => {
    localStorage.setItem(`important-problem-${problem.id}`, isImportant ? 'true' : 'false')
  }, [isImportant, problem.id])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCardGradient = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'from-green-50 to-emerald-50'
      case 'medium': return 'from-yellow-50 to-amber-50'
      case 'hard': return 'from-red-50 to-rose-50'
      default: return 'from-gray-50 to-slate-50'
    }
  }

  const displayedTopics = problem.related_topics.slice(0, 3)
  const moreTopicsCount = problem.related_topics.length - 3

  const displayedCompanies = problem.companies.slice(0, 3)
  const moreCompaniesCount = problem.companies.length - 3

  return (
    <Card className={`hover:shadow-xl shadow-md transition-all duration-300 bg-gradient-to-br ${getCardGradient(problem.difficulty)} border border-gray-200 rounded-xl gap-0`}>
      <CardHeader className="pb-2 g-0">
        <div className="flex flex-col gap-0 min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BookOpen className="h-4 w-4 text-black flex-shrink-0" />
              <Checkbox
                id={`completed-${problem.id}`}
                checked={isCompleted}
                onCheckedChange={(checked) => setIsCompleted(checked as boolean)}
                className="border-gray-400 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={`/problems/${problem.id}`} className="block min-w-0">
                        <CardTitle className="hover:text-blue-600 transition-colors text-m font-semibold text-black min-w-0 truncate" title={problem.title}>
                          {problem.title}
                        </CardTitle>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs break-words">
                      {problem.title}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${isImportant ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-500 flex-shrink-0`}
                    onClick={() => setIsImportant(!isImportant)}
                    aria-label={isImportant ? 'Unmark as important' : 'Mark as important'}
                  >
                    <Star className="h-4 w-4" fill={isImportant ? 'currentColor' : 'none'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {isImportant ? 'Unmark as important' : 'Mark as important'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex w-full mt-1">
            <Badge className={`${getDifficultyColor(problem.difficulty)} font-medium truncate whitespace-nowrap overflow-hidden max-w-[90px]`}>{problem.difficulty}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className=" pb-4 px-4">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-blue-700" />
              <span className="text-sm font-medium text-black">Topics</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedTopics.map(topic => (
                <Badge
                  key={topic}
                  variant="outline"
                  className="bg-blue-100/90 border-blue-300 !text-blue-800 hover:bg-blue-200 transition-colors font-medium shadow-sm cursor-pointer"
                >
                  {topic}
                </Badge>
              ))}
              {moreTopicsCount > 0 && (
                <Badge
                  variant="outline"
                  className="bg-blue-100/90 border-blue-300 !text-blue-800 hover:bg-blue-200 transition-colors font-medium shadow-sm cursor-pointer"
                >
                  +{moreTopicsCount} more
                </Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-black font-medium">Acceptance Rate: <span className="text-black">{problem.acceptance_rate}%</span></p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-black">Companies</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedCompanies.map(company => (
                <Badge key={company} variant="outline" className="bg-purple-100/80 border-purple-300 text-purple-800 hover:bg-purple-200 transition-colors font-medium shadow-sm cursor-pointer">{company}</Badge>
              ))}
              {moreCompaniesCount > 0 && (
                <Badge variant="outline" className="bg-purple-100/80 border-purple-300 text-purple-800 hover:bg-purple-200 transition-colors font-medium shadow-sm cursor-pointer">+{moreCompaniesCount} more</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}