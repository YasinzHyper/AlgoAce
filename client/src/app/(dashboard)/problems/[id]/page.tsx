"use client"

import { useState, useEffect } from 'react'
import { use } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster, toast } from 'sonner'
import { HelpModal } from "@/components/problems/help-modal"

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
  const [problem, setProblem] = useState<ProblemDetail | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('description')
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [explanationLoading, setExplanationLoading] = useState(false)

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

  if (loading) return <div className="p-6 text-center">Loading...</div>
  if (!problem) return <div className="p-6 text-center">Problem not found</div>

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
      case 'hard': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
      default: return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
    }
  }

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{problem.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className={getDifficultyColor(problem.difficulty)}>
              {problem.difficulty}
            </Badge>
            {problem.topics.map(topic => (
              <Badge key={topic} variant="outline">{topic}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="completed"
              checked={isCompleted}
              onCheckedChange={(checked) => setIsCompleted(checked as boolean)}
            />
            <label htmlFor="completed" className="text-sm font-medium">Mark as completed</label>
          </div>
          <HelpModal problemId={resolvedParams.id} problemTitle={problem.title} />
          <Button asChild>
            <a href={problem.url} target="_blank" rel="noopener noreferrer">View on LeetCode</a>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="solution">Solution</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
          <TabsTrigger value="explanation">Explanation</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Problem Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-line">{problem.description}</p>
          <div className="space-y-2">
            <h3 className="font-semibold">Examples:</h3>
            {problem.examples.map((example, index) => (
                  <div key={index} className="bg-muted p-4 rounded-lg">
                <p><strong>Input:</strong> {example.input}</p>
                <p><strong>Output:</strong> {example.output}</p>
                {example.explanation && <p><strong>Explanation:</strong> {example.explanation}</p>}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Constraints:</h3>
                <ul className="list-disc list-inside">
              {problem.constraints.map((constraint, index) => (
                <li key={index}>{constraint}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Companies:</h3>
            <div className="flex flex-wrap gap-2">
                  {problem.companies.map(company => (
                <Badge key={company} variant="secondary">{company}</Badge>
              ))}
            </div>
          </div>
          <p><strong>Acceptance Rate:</strong> {problem.acceptance_rate}%</p>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="solution">
          <Card>
            <CardHeader>
              <CardTitle>Solution</CardTitle>
              <CardDescription>Choose your preferred programming language</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
                Code Editor Placeholder
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="discussion">
          <Card>
            <CardHeader>
              <CardTitle>Discussion</CardTitle>
              <CardDescription>Join the conversation about this problem</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
                Discussion Placeholder
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="explanation">
          <Card>
            <CardHeader>
              <CardTitle>Problem Explanation</CardTitle>
              <CardDescription>Get a detailed explanation of the problem and its solution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!explanation && !explanationLoading && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <p className="text-muted-foreground">Click the button below to get a detailed explanation</p>
                  <Button 
                    onClick={fetchExplanation}
                    disabled={explanationLoading}
                  >
                    {explanationLoading ? 'Generating Explanation...' : 'Get Explanation'}
                  </Button>
                </div>
              )}
              {explanationLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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