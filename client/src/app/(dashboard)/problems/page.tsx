'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpModal } from "@/components/problems/help-modal";
import Link from 'next/link';

interface Problem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];
  companies: string[];
  acceptance_rate: number;
  status: 'pending' | 'completed' | 'skipped';
}

export default function ProblemsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Mock data - replace with API call
  const problems: Problem[] = [
    {
      id: '1',
      title: 'Two Sum',
      difficulty: 'Easy',
      topics: ['Arrays', 'Hash Table'],
      companies: ['Google', 'Amazon'],
      acceptance_rate: 45.5,
      status: 'pending'
    },
    {
      id: '2',
      title: 'Add Two Numbers',
      difficulty: 'Medium',
      topics: ['Linked List', 'Math'],
      companies: ['Microsoft', 'Bloomberg'],
      acceptance_rate: 35.2,
      status: 'completed'
    },
    {
      id: '3',
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'Medium',
      topics: ['Hash Table', 'String', 'Sliding Window'],
      companies: ['Amazon', 'Google', 'Microsoft'],
      acceptance_rate: 30.8,
      status: 'pending'
    },
    {
      id: '4',
      title: 'Median of Two Sorted Arrays',
      difficulty: 'Hard',
      topics: ['Array', 'Binary Search', 'Divide and Conquer'],
      companies: ['Google', 'Microsoft', 'Amazon'],
      acceptance_rate: 28.5,
      status: 'skipped'
    },
    {
      id: '5',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      topics: ['Stack', 'String'],
      companies: ['Amazon', 'Google', 'Microsoft'],
      acceptance_rate: 42.3,
      status: 'completed'
    },
    {
      id: '6',
      title: 'Merge K Sorted Lists',
      difficulty: 'Hard',
      topics: ['Linked List', 'Heap', 'Divide and Conquer'],
      companies: ['Amazon', 'Google', 'Microsoft'],
      acceptance_rate: 25.7,
      status: 'pending'
    },
    {
      id: '7',
      title: 'Reverse Integer',
      difficulty: 'Easy',
      topics: ['Math'],
      companies: ['Amazon', 'Google'],
      acceptance_rate: 38.9,
      status: 'completed'
    },
    {
      id: '8',
      title: 'Longest Palindromic Substring',
      difficulty: 'Medium',
      topics: ['String', 'Dynamic Programming'],
      companies: ['Amazon', 'Microsoft'],
      acceptance_rate: 32.1,
      status: 'pending'
    },
    {
      id: '9',
      title: 'Regular Expression Matching',
      difficulty: 'Hard',
      topics: ['String', 'Dynamic Programming'],
      companies: ['Google', 'Microsoft'],
      acceptance_rate: 27.4,
      status: 'skipped'
    },
    {
      id: '10',
      title: 'Container With Most Water',
      difficulty: 'Medium',
      topics: ['Array', 'Two Pointers'],
      companies: ['Amazon', 'Google'],
      acceptance_rate: 33.8,
      status: 'pending'
    }
  ];

  const filteredProblems = problems.filter(problem => {
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'all' || problem.difficulty.toLowerCase() === difficultyFilter;
    const matchesTopic = topicFilter === 'all' || problem.topics.includes(topicFilter);
    const matchesStatus = statusFilter === 'all' || problem.status === statusFilter;
    return matchesSearch && matchesDifficulty && matchesTopic && matchesStatus;
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'skipped':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Problems</h1>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[300px]"
          />
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              <SelectItem value="Arrays">Arrays</SelectItem>
              <SelectItem value="Hash Table">Hash Table</SelectItem>
              <SelectItem value="Linked List">Linked List</SelectItem>
              <SelectItem value="String">String</SelectItem>
              <SelectItem value="Dynamic Programming">Dynamic Programming</SelectItem>
              <SelectItem value="Math">Math</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProblems.map((problem) => (
          <Card key={problem.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/problems/${problem.id}`}>
                    <CardTitle className="hover:text-blue-500 transition-colors">
                      {problem.title}
                    </CardTitle>
                  </Link>
                  <CardDescription>
                    Acceptance Rate: {problem.acceptance_rate}%
                  </CardDescription>
                </div>
                <Badge 
                  variant="secondary"
                  className={getDifficultyColor(problem.difficulty)}
                >
                  {problem.difficulty}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {problem.topics.map((topic) => (
                    <Badge key={topic} variant="outline">
                      {topic}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <Badge 
                    variant="secondary"
                    className={getStatusColor(problem.status)}
                  >
                    {problem.status.charAt(0).toUpperCase() + problem.status.slice(1)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <HelpModal problemId={problem.id} problemTitle={problem.title} />
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 