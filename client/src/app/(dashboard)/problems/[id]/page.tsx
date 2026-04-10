"use client"

import { useState, useEffect } from 'react'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster, toast } from 'sonner'
import { HelpModal } from "@/components/problems/help-modal"
import { EmptyState } from "@/components/layout/empty-state"
import {
  ArrowRight,
  Building2,
  Code2,
  ExternalLink,
  FileText,
  Lightbulb,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import Link from "next/link"

interface RawProblemData {
  id: number
  title: string
  description: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  topics: string
  companies: string
  acceptance_rate: number
  examples: string
  constraints: string
}

interface ProblemDetail {
  id: number
  title: string
  description: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  topics: string[]
  companies: string[]
  acceptance_rate: number
  examples: { input: string; output: string; explanation?: string }[]
  constraints: string[]
  url: string
}

interface Explanation {
  problem_understanding: string
  approaches: {
    approach: string
    time_complexity: string
    space_complexity: string
  }[]
  example_walkthrough: string
  edge_cases: string
  tips: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ProblemDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const searchParams = useSearchParams()
  const taskIdParam = searchParams.get('task')
  const taskId = taskIdParam && /^\d+$/.test(taskIdParam) ? parseInt(taskIdParam) : null

  const [problem, setProblem] = useState<ProblemDetail | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionPending, setCompletionPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('description')
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [explanationLoading, setExplanationLoading] = useState(false)

  // Load persisted completion state for this problem within its task context.
  useEffect(() => {
    if (!taskId) return
    const loadProgress = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) return
        const token = sessionData.session.access_token
        const res = await fetch(`http://localhost:8000/api/progress/task/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const progress = await res.json()
        const problems: Record<string, boolean> = progress?.completed?.problems ?? {}
        setIsCompleted(Boolean(problems[resolvedParams.id]))
      } catch {
        // Non-fatal: leave checkbox in its default state.
      }
    }
    loadProgress()
  }, [taskId, resolvedParams.id])

  const handleToggleComplete = async (checked: boolean) => {
    setIsCompleted(checked)
    if (!taskId) return // No task context: behave as before (local-only).

    setCompletionPending(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) throw new Error('Not authenticated')
      const token = sessionData.session.access_token
      const res = await fetch(`http://localhost:8000/api/progress/task/${taskId}/complete`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'problem', id: resolvedParams.id, completed: checked }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || 'Failed to update progress')
      }
      toast.success(checked ? 'Marked as completed' : 'Marked as incomplete')
    } catch (error) {
      setIsCompleted(!checked)
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error('Error updating progress', { description: errorMessage })
    } finally {
      setCompletionPending(false)
    }
  }

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await fetch('/leetcode-problems-dataset.json')
        if (!response.ok) throw new Error('Failed to fetch dataset')
        
        const problems: RawProblemData[] = await response.json()
        console.log("Fetched problems (first 5):", problems.slice(0, 5)) // Log first few problems for debugging
  
        const problemIdStr = resolvedParams.id
        if (!/^\d+$/.test(problemIdStr)) throw new Error('Invalid problem ID')
        const problemId = parseInt(problemIdStr)
        
        // Use find to locate the problem by ID
        const problemData = problems.find(p => p.id === problemId)
        console.log("Problem data for ID", problemId, ":", problemData)
        
        // Check if problemData exists and matches the requested ID
        if (!problemData || problemData.id !== problemId) {
          throw new Error('Problem not found')
        }
  
        setProblem({
          ...problemData,
          topics: problemData.topics ? problemData.topics.split(',').map(t => t.trim()) : [],
          companies: problemData.companies ? problemData.companies.split(',').map(c => c.trim()) : [],
          examples: problemData.examples ? JSON.parse(problemData.examples.replace(/'/g, '"')) : [],
          constraints: problemData.constraints ? problemData.constraints.split('\n').filter(c => c.trim()) : [],
          url: `https://leetcode.com/problems/${problemData.title.toLowerCase().replace(/\s+/g, '-')}`
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        toast.error('Error fetching problem', { description: errorMessage })
      } finally {
        setLoading(false)
      }
    }
    fetchProblem()
  }, [resolvedParams.id])

  const fetchExplanation = async () => {
    if (!problem) {
      console.error("No problem data available")
      return
    }
    console.log("Problem data:", {
      id: problem.id,
      title: problem.title,
      type: typeof problem.id
    })
    setExplanationLoading(true)
    try {
      // Ensure problem.id is a string for the URL
      const problemId = String(problem.id)
      const url = `http://localhost:8000/api/problems/explain?problem_id=${encodeURIComponent(problemId)}`
      console.log("Making request to:", url)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error(`Failed to fetch explanation: ${errorText}`)
      }
      const data = await response.json()
      console.log("Received explanation data:", data)
      setExplanation(data.explanation)
    } catch (error) {
      console.error("Error in fetchExplanation:", error)
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error('Error fetching explanation', { description: errorMessage })
    } finally {
      setExplanationLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!problem) {
    return (
      <EmptyState
        icon={FileText}
        title="Problem not found"
        description="This problem doesn't exist or failed to load."
        action={
          <Button asChild variant="outline">
            <Link href="/problems">
              Back to problems
            </Link>
          </Button>
        }
      />
    )
  }

  const getDifficultyBadgeClass = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      case 'medium':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
      case 'hard':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
      default:
        return ''
    }
  }

  // Split description into paragraphs and identify code-like blocks (lines with leading whitespace or code)
  const renderDescription = (desc: string) => {
    const paragraphs = desc.split(/\n{2,}/).filter((p) => p.trim())
    return paragraphs.map((para, i) => {
      // Detect code blocks: paragraphs that start with common code markers or look like examples
      const looksLikeCode =
        /^[ \t]{2,}/.test(para) ||
        /Input:|Output:|Example \d+:/i.test(para)
      if (looksLikeCode) {
        return (
          <pre
            key={i}
            className="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/60 p-4 font-mono text-xs leading-relaxed"
          >
            {para.trim()}
          </pre>
        )
      }
      return (
        <p key={i} className="leading-relaxed text-muted-foreground">
          {para.trim()}
        </p>
      )
    })
  }

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{problem.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getDifficultyBadgeClass(problem.difficulty)}>
              {problem.difficulty}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Acceptance {problem.acceptance_rate}%
            </span>
            <span className="text-muted-foreground">·</span>
            <div className="flex flex-wrap gap-1.5">
              {problem.topics.slice(0, 4).map(topic => (
                <Badge key={topic} variant="secondary">{topic}</Badge>
              ))}
              {problem.topics.length > 4 && (
                <Badge variant="secondary">+{problem.topics.length - 4}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="completed"
            className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Checkbox
              id="completed"
              checked={isCompleted}
              disabled={completionPending}
              onCheckedChange={(checked) => handleToggleComplete(checked as boolean)}
            />
            Completed
          </label>
          <HelpModal problemId={resolvedParams.id} problemTitle={problem.title} />
          <Button asChild>
            <a href={problem.url} target="_blank" rel="noopener noreferrer">
              View on LeetCode
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="description" className="gap-1.5">
            <FileText className="size-4" /> Description
          </TabsTrigger>
          <TabsTrigger value="solution" className="gap-1.5">
            <Code2 className="size-4" /> Solution
          </TabsTrigger>
          <TabsTrigger value="discussion" className="gap-1.5">
            <MessageSquare className="size-4" /> Discussion
          </TabsTrigger>
          <TabsTrigger value="explanation" className="gap-1.5">
            <Sparkles className="size-4" /> Explanation
          </TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Problem Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="space-y-3">{renderDescription(problem.description)}</div>

              {problem.examples.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Examples
                  </h3>
                  <div className="space-y-3">
                    {problem.examples.map((example, index) => (
                      <div
                        key={index}
                        className="overflow-hidden rounded-lg border bg-muted/40"
                      >
                        <div className="border-b bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground">
                          Example {index + 1}
                        </div>
                        <div className="space-y-2 p-4 font-mono text-xs leading-relaxed">
                          <div>
                            <span className="text-muted-foreground">Input: </span>
                            <span className="text-foreground">{example.input}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Output: </span>
                            <span className="text-foreground">{example.output}</span>
                          </div>
                          {example.explanation && (
                            <div className="pt-1 font-sans text-muted-foreground">
                              <span className="font-semibold">Explanation: </span>
                              {example.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {problem.constraints.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Constraints
                  </h3>
                  <ul className="space-y-1.5 rounded-lg border bg-muted/40 p-4 font-mono text-xs">
                    {problem.constraints.map((constraint, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-muted-foreground"
                      >
                        <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span className="text-foreground">{constraint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {problem.companies.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Companies
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {problem.companies.map(company => (
                      <Badge key={company} variant="outline" className="gap-1">
                        <Building2 className="size-3" />
                        {company}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="solution">
          <EmptyState
            icon={Code2}
            title="Code editor coming soon"
            description="An in-browser editor with language selection and test runner is on the way. Meanwhile, you can solve this problem on LeetCode."
            action={
              <Button asChild variant="outline">
                <a href={problem.url} target="_blank" rel="noopener noreferrer">
                  Open on LeetCode
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            }
          />
        </TabsContent>
        <TabsContent value="discussion">
          <EmptyState
            icon={MessageSquare}
            title="No discussion yet"
            description="Discussions will appear here once the community starts sharing approaches and solutions."
            action={
              <Button
                variant="outline"
                onClick={() => setActiveTab("explanation")}
              >
                See AI explanation
                <ArrowRight className="size-4" />
              </Button>
            }
          />
        </TabsContent>
        <TabsContent value="explanation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-primary" />
                AI Explanation
              </CardTitle>
              <CardDescription>
                Generate a detailed walkthrough with approaches, edge cases, and tips.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!explanation && !explanationLoading && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Lightbulb className="size-6" />
                  </div>
                  <div className="max-w-sm space-y-1">
                    <h3 className="text-base font-semibold">Unlock the solution approach</h3>
                    <p className="text-sm text-muted-foreground">
                      Generate an AI-powered breakdown with intuition, approaches, and complexity analysis.
                    </p>
                  </div>
                  <Button
                    onClick={fetchExplanation}
                    disabled={explanationLoading}
                  >
                    <Sparkles className="size-4" />
                    Generate explanation
                  </Button>
                </div>
              )}
              {explanationLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">
                    Thinking through the problem...
                  </p>
                </div>
              )}
              {explanation && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Problem Understanding</h3>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: explanation.problem_understanding
                          .split('\n')
                          .map(line => {
                            if (line.startsWith('###')) {
                              return `<h3 class="text-lg font-semibold mt-4 mb-2">${line.replace('###', '').trim()}</h3>`;
                            } else if (line.startsWith('- ')) {
                              return `<li class="ml-4">${line.replace('- ', '').trim()}</li>`;
                            } else if (line.match(/^\d+\./)) {
                              return `<li class="ml-4">${line.trim()}</li>`;
                            } else if (line.trim()) {
                              return `<p class="my-2">${line.trim()}</p>`;
                            }
                            return '';
                          })
                          .join('')
                      }} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Approaches</h3>
                    <div className="space-y-4">
                      {Array.isArray(explanation.approaches) ? (
                        explanation.approaches.map((approach, index) => (
                          <div key={index} className="bg-muted p-4 rounded-lg">
                            <div className="prose prose-sm max-w-none">
                              <div dangerouslySetInnerHTML={{ 
                                __html: approach.approach
                                  .split('\n')
                                  .map(line => {
                                    if (line.startsWith('###')) {
                                      return `<h4 class="text-md font-semibold mt-3 mb-2">${line.replace('###', '').trim()}</h4>`;
                                    } else if (line.startsWith('- ')) {
                                      return `<li class="ml-4">${line.replace('- ', '').trim()}</li>`;
                                    } else if (line.match(/^\d+\./)) {
                                      return `<li class="ml-4">${line.trim()}</li>`;
                                    } else if (line.trim()) {
                                      return `<p class="my-2">${line.trim()}</p>`;
                                    }
                                    return '';
                                  })
                                  .join('')
                              }} />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                              <div>
                                <span className="font-medium">Time Complexity:</span>
                                <p className="text-muted-foreground">{approach.time_complexity || 'Not specified'}</p>
                              </div>
                              <div>
                                <span className="font-medium">Space Complexity:</span>
                                <p className="text-muted-foreground">{approach.space_complexity || 'Not specified'}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">No approaches provided.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Example Walkthrough</h3>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: explanation.example_walkthrough
                          .split('\n')
                          .map(line => {
                            if (line.startsWith('###')) {
                              return `<h4 class="text-md font-semibold mt-3 mb-2">${line.replace('###', '').trim()}</h4>`;
                            } else if (line.startsWith('- ')) {
                              return `<li class="ml-4">${line.replace('- ', '').trim()}</li>`;
                            } else if (line.match(/^\d+\./)) {
                              return `<li class="ml-4">${line.trim()}</li>`;
                            } else if (line.trim()) {
                              return `<p class="my-2">${line.trim()}</p>`;
                            }
                            return '';
                          })
                          .join('')
                      }} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Edge Cases</h3>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: explanation.edge_cases
                          .split('\n')
                          .map(line => {
                            if (line.startsWith('- ')) {
                              return `<li class="ml-4">${line.replace('- ', '').trim()}</li>`;
                            } else if (line.trim()) {
                              return `<p class="my-2">${line.trim()}</p>`;
                            }
                            return '';
                          })
                          .join('')
                      }} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Tips</h3>
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: explanation.tips
                          .split('\n')
                          .map(line => {
                            if (line.startsWith('- ')) {
                              return `<li class="ml-4">${line.replace('- ', '').trim()}</li>`;
                            } else if (line.trim()) {
                              return `<p class="my-2">${line.trim()}</p>`;
                            }
                            return '';
                          })
                          .join('')
                      }} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// 'use client';

// import { useState } from 'react';
// import { use } from 'react';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Checkbox } from "@/components/ui/checkbox";
// import { HelpModal } from "@/components/problems/help-modal";

// interface ProblemDetail {
//   id: string;
//   title: string;
//   description: string;
//   difficulty: 'Easy' | 'Medium' | 'Hard';
//   topics: string[];
//   companies: string[];
//   acceptance_rate: number;
//   status: 'pending' | 'completed' | 'skipped';
//   examples: {
//     input: string;
//     output: string;
//     explanation?: string;
//   }[];
//   constraints: string[];
// }

// interface PageProps {
//   params: Promise<{
//     id: string;
//   }>;
// }

// export default function ProblemDetailPage({ params }: PageProps) {
//   const resolvedParams = use(params);
//   const [activeTab, setActiveTab] = useState('description');
//   const [isCompleted, setIsCompleted] = useState(false);

//   // Mock data - replace with API call
//   const problem: ProblemDetail = {
//     id: resolvedParams.id,
//     title: 'Two Sum',
//     description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
//     You may assume that each input would have exactly one solution, and you may not use the same element twice.
//     You can return the answer in any order.`,
//     difficulty: 'Easy',
//     topics: ['Arrays', 'Hash Table'],
//     companies: ['Google', 'Amazon'],
//     acceptance_rate: 45.5,
//     status: 'pending',
//     examples: [
//       {
//         input: 'nums = [2,7,11,15], target = 9',
//         output: '[0,1]',
//         explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
//       },
//       {
//         input: 'nums = [3,2,4], target = 6',
//         output: '[1,2]'
//       }
//     ],
//     constraints: [
//       '2 <= nums.length <= 104',
//       '-109 <= nums[i] <= 109',
//       '-109 <= target <= 109',
//       'Only one valid answer exists.'
//     ]
//   };

//   const getDifficultyColor = (difficulty: string) => {
//     switch (difficulty.toLowerCase()) {
//       case 'easy':
//         return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
//       case 'medium':
//         return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
//       case 'hard':
//         return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
//       default:
//         return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
//     }
//   };

//   return (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-3xl font-bold">{problem.title}</h1>
//           <div className="flex items-center gap-2 mt-2">
//             <Badge 
//               variant="secondary"
//               className={getDifficultyColor(problem.difficulty)}
//             >
//               {problem.difficulty}
//             </Badge>
//             {problem.topics.map((topic) => (
//               <Badge key={topic} variant="outline">
//                 {topic}
//               </Badge>
//             ))}
//           </div>
//         </div>
//         <div className="flex items-center gap-4">
//           <div className="flex items-center gap-2">
//             <Checkbox
//               id="completed"
//               checked={isCompleted}
//               onCheckedChange={(checked) => setIsCompleted(checked as boolean)}
//             />
//             <label htmlFor="completed" className="text-sm font-medium">
//               Mark as completed
//             </label>
//           </div>
//           <HelpModal problemId={problem.id} problemTitle={problem.title} />
//           <Button>View on LeetCode</Button>
//         </div>
//       </div>

//       <Tabs value={activeTab} onValueChange={setActiveTab}>
//         <TabsList>
//           <TabsTrigger value="description">Description</TabsTrigger>
//           <TabsTrigger value="solution">Solution</TabsTrigger>
//           <TabsTrigger value="discussion">Discussion</TabsTrigger>
//         </TabsList>
//         <TabsContent value="description" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Problem Description</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <p className="whitespace-pre-line">{problem.description}</p>
              
//               <div className="space-y-2">
//                 <h3 className="font-semibold">Examples:</h3>
//                 {problem.examples.map((example, index) => (
//                   <div key={index} className="bg-muted p-4 rounded-lg">
//                     <p><strong>Input:</strong> {example.input}</p>
//                     <p><strong>Output:</strong> {example.output}</p>
//                     {example.explanation && (
//                       <p><strong>Explanation:</strong> {example.explanation}</p>
//                     )}
//                   </div>
//                 ))}
//               </div>

//               <div className="space-y-2">
//                 <h3 className="font-semibold">Constraints:</h3>
//                 <ul className="list-disc list-inside">
//                   {problem.constraints.map((constraint, index) => (
//                     <li key={index}>{constraint}</li>
//                   ))}
//                 </ul>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
//         <TabsContent value="solution">
//           <Card>
//             <CardHeader>
//               <CardTitle>Solution</CardTitle>
//               <CardDescription>
//                 Choose your preferred programming language
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               {/* Add code editor component here */}
//               <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
//                 Code Editor Placeholder
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
//         <TabsContent value="discussion">
//           <Card>
//             <CardHeader>
//               <CardTitle>Discussion</CardTitle>
//               <CardDescription>
//                 Join the conversation about this problem
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               {/* Add discussion component here */}
//               <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
//                 Discussion Placeholder
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// } 