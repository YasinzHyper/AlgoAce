import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { BookOpen, Building, Tag, Star } from 'lucide-react'
import { useState } from 'react'

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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-black" />
            <div className="flex items-center gap-2">
              <Checkbox
                id={`completed-${problem.id}`}
                checked={isCompleted}
                onCheckedChange={(checked) => setIsCompleted(checked as boolean)}
                className="border-gray-400"
              />
              <Link href={`/problems/${problem.id}`}>
                <CardTitle className="hover:text-blue-600 transition-colors text-sm font-semibold text-black">
                  {problem.title}
                </CardTitle>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 ${isImportant ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-500`}
              onClick={() => setIsImportant(!isImportant)}
            >
              <Star className="h-5 w-5" fill={isImportant ? 'currentColor' : 'none'} />
            </Button>
            <Badge className={`${getDifficultyColor(problem.difficulty)} font-medium`}>{problem.difficulty}</Badge>
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
                <Badge key={topic} variant="outline" className="bg-white/50 text-black border-blue-200 hover:bg-blue-50 transition-colors">{topic}</Badge>
              ))}
              {moreTopicsCount > 0 && (
                <Badge variant="outline" className="bg-white/50 text-black border-blue-200 hover:bg-blue-50 transition-colors">+{moreTopicsCount} more</Badge>
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
                <Badge key={company} variant="secondary" className="bg-white/50 text-black border-purple-200 hover:bg-purple-50 transition-colors">{company}</Badge>
              ))}
              {moreCompaniesCount > 0 && (
                <Badge variant="secondary" className="bg-white/50 text-black border-purple-200 hover:bg-purple-50 transition-colors">+{moreCompaniesCount} more</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}