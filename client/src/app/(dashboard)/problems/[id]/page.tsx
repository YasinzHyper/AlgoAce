'use client';

import { useState } from 'react';
import { use } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpModal } from "@/components/problems/help-modal";

interface ProblemDetail {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];
  companies: string[];
  acceptance_rate: number;
  status: 'pending' | 'completed' | 'skipped';
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  constraints: string[];
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProblemDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [activeTab, setActiveTab] = useState('description');
  const [isCompleted, setIsCompleted] = useState(false);

  // Mock data - replace with API call
  const problem: ProblemDetail = {
    id: resolvedParams.id,
    title: 'Two Sum',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
    You may assume that each input would have exactly one solution, and you may not use the same element twice.
    You can return the answer in any order.`,
    difficulty: 'Easy',
    topics: ['Arrays', 'Hash Table'],
    companies: ['Google', 'Amazon'],
    acceptance_rate: 45.5,
    status: 'pending',
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      },
      {
        input: 'nums = [3,2,4], target = 6',
        output: '[1,2]'
      }
    ],
    constraints: [
      '2 <= nums.length <= 104',
      '-109 <= nums[i] <= 109',
      '-109 <= target <= 109',
      'Only one valid answer exists.'
    ]
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
      case 'hard':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{problem.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge 
              variant="secondary"
              className={getDifficultyColor(problem.difficulty)}
            >
              {problem.difficulty}
            </Badge>
            {problem.topics.map((topic) => (
              <Badge key={topic} variant="outline">
                {topic}
              </Badge>
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
            <label htmlFor="completed" className="text-sm font-medium">
              Mark as completed
            </label>
          </div>
          <HelpModal problemId={problem.id} problemTitle={problem.title} />
          <Button>View on LeetCode</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="solution">Solution</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
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
                    {example.explanation && (
                      <p><strong>Explanation:</strong> {example.explanation}</p>
                    )}
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
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="solution">
          <Card>
            <CardHeader>
              <CardTitle>Solution</CardTitle>
              <CardDescription>
                Choose your preferred programming language
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add code editor component here */}
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
              <CardDescription>
                Join the conversation about this problem
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add discussion component here */}
              <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
                Discussion Placeholder
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 