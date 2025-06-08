import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from 'next/link'
import { BookOpen, Building, Tag } from 'lucide-react'

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
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const displayedTopics = problem.related_topics.slice(0, 3)
  const moreTopicsCount = problem.related_topics.length - 3

  const displayedCompanies = problem.companies.slice(0, 3)
  const moreCompaniesCount = problem.companies.length - 3

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-gray-500" />
            <Link href={`/problems/${problem.id}`}>
              <CardTitle className="hover:text-blue-500 transition-colors text-sm">
                {problem.title}
              </CardTitle>
            </Link>
          </div>
          <Badge className={getDifficultyColor(problem.difficulty)}>{problem.difficulty}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Topics</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedTopics.map(topic => (
                <Badge key={topic} variant="outline" className="bg-blue-50 text-blue-700">{topic}</Badge>
              ))}
              {moreTopicsCount > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700">+{moreTopicsCount} more</Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">Acceptance Rate: {problem.acceptance_rate}%</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Companies</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedCompanies.map(company => (
                <Badge key={company} variant="secondary" className="bg-purple-50 text-purple-700">{company}</Badge>
              ))}
              {moreCompaniesCount > 0 && (
                <Badge variant="secondary" className="bg-purple-50 text-purple-700">+{moreCompaniesCount} more</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}