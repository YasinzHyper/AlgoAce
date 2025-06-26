import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { BookOpen, Building, Tag, Star } from 'lucide-react'
import { useState, useEffect } from 'react'

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
    <Card className={`hover:shadow-lg transition-all duration-300 bg-gradient-to-br ${getCardGradient(problem.difficulty)} border-0`}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 text-black flex-shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <Checkbox
                id={`completed-${problem.id}`}
                checked={isCompleted}
                onCheckedChange={(checked) => setIsCompleted(checked as boolean)}
                className="border-gray-400 flex-shrink-0"
              />
              <Link href={`/problems/${problem.id}`} className="min-w-0">
                <CardTitle className="hover:text-blue-600 transition-colors text-m font-semibold text-black min-w-0 break-words whitespace-normal">
                  {problem.title}
                </CardTitle>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 ${isImportant ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-500 flex-shrink-0`}
              onClick={() => setIsImportant(!isImportant)}
            >
              <Star className="h-5 w-5" fill={isImportant ? 'currentColor' : 'none'} />
            </Button>
            <Badge className={`${getDifficultyColor(problem.difficulty)} font-medium truncate whitespace-nowrap overflow-hidden max-w-[90px]`}>
              {problem.difficulty}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-black" />
              <span className="text-sm font-medium text-black">Topics</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedTopics.map(topic => (
                <Badge key={topic} variant="outline" className="bg-white/50 border-blue-200 hover:bg-blue-50 transition-colors" style={{ color: 'black' }}>{topic}</Badge>
              ))}
              {moreTopicsCount > 0 && (
                <Badge variant="outline" className="bg-white/50 border-blue-200 hover:bg-blue-50 transition-colors" style={{ color: 'black' }}>+{moreTopicsCount} more</Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-black font-medium">Acceptance Rate: <span className="text-black">{problem.acceptance_rate}%</span></p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-4 w-4 text-black" />
              <span className="text-sm font-medium text-black">Companies</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedCompanies.map(company => (
                <Badge key={company} variant="outline" className="bg-white/50 border-blue-200 hover:bg-blue-50 transition-colors" style={{ color: 'black' }}>{company}</Badge>
              ))}
              {moreCompaniesCount > 0 && (
                <Badge variant="outline" className="bg-white/50 border-blue-200 hover:bg-blue-50 transition-colors" style={{ color: 'black' }}>+{moreCompaniesCount} more</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}