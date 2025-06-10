'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Mock data for charts
const progressData = [
  { date: 'Week 1', problems: 5, score: 65 },
  { date: 'Week 2', problems: 8, score: 70 },
  { date: 'Week 3', problems: 12, score: 75 },
  { date: 'Week 4', problems: 15, score: 80 },
  { date: 'Week 5', problems: 20, score: 85 },
];

const topicData = [
  { name: 'Arrays', value: 90 },
  { name: 'Strings', value: 85 },
  { name: 'DP', value: 70 },
  { name: 'Graphs', value: 65 },
  { name: 'Trees', value: 75 },
];

const difficultyData = [
  { name: 'Easy', value: 20 },
  { name: 'Medium', value: 15 },
  { name: 'Hard', value: 7 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ProgressOverviewPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Progress Overview</h1>
      
      {/* Progress Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Completed Problems</CardTitle>
            <CardDescription>Total problems solved</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">42</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Streak</CardTitle>
            <CardDescription>Days of consistent practice</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">7</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
            <CardDescription>Based on problem difficulty</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">85%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Time Spent</CardTitle>
            <CardDescription>Total hours dedicated</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">120</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Analytics */}
      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList>
          <TabsTrigger value="progress">Progress Over Time</TabsTrigger>
          <TabsTrigger value="topics">Topic Mastery</TabsTrigger>
          <TabsTrigger value="difficulty">Difficulty Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Progress Over Time</CardTitle>
              <CardDescription>Your problem-solving progress and scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="problems"
                      stroke="#8884d8"
                      name="Problems Solved"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="score"
                      stroke="#82ca9d"
                      name="Average Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Topic Mastery</CardTitle>
              <CardDescription>Your proficiency in different topics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" name="Mastery %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="difficulty" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Problem Difficulty Distribution</CardTitle>
              <CardDescription>Breakdown of solved problems by difficulty</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={difficultyData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={150}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {difficultyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest problem-solving sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold">Two Sum</h3>
                  <p className="text-sm text-gray-500">Arrays • Easy</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">Solved</p>
                  <p className="text-sm text-gray-500">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 