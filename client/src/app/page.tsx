"use client";

import { useEffect, useState } from "react";
import { Lightbulb, ListChecks, LineChart } from "lucide-react";
import { Marquee } from "@/components/magicui/marquee";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/utils/supabase/utils"
import { supabase } from "@/utils/supabase/client";

export default function Home() {
  const reviews = [
    {
      name: "Rohit K",
      username: "Final Year CS Student",
      body: "I've never seen anything like this before. It's amazing. I love it.",
      img: "https://avatar.vercel.sh/jack",
    },
    {
      name: "Priya S",
      username: "Aspiring SDE",
      body: "I don't know what to say. I'm speechless. This is amazing.",
      img: "https://avatar.vercel.sh/jill",
    },
    {
      name: "Anjali R",
      username: "Software Engineer",
      body: "AlgoAce helped me land a job at Google. The structured roadmap and practice problems are gold.",
      img: "https://avatar.vercel.sh/jane",
    },
    {
      name: "Nikhil T",
      username: "Backend Developer",
      body: "AlgoAce’s roadmap made everything less overwhelming. Super helpful for interview prep.",
      img: "https://avatar.vercel.sh/john",
    },
    {
      name: "Jenny",
      username: "Senior SDE",
      body: "I'm at a loss for words. This is amazing. I love it.",
      img: "https://avatar.vercel.sh/jenny",
    },
    {
      name: "James",
      username: "Cloud Architect",
      body: "I'm at a loss for words. This is amazing. I love it.",
      img: "https://avatar.vercel.sh/james",
    },
  ];

  const firstRow = reviews.slice(0, reviews.length / 2);
  const secondRow = reviews.slice(reviews.length / 2);

  const ReviewCard = ({
    img,
    name,
    username,
    body,
  }: {
    img: string;
    name: string;
    username: string;
    body: string;
  }) => {
    return (
      <figure
        className={cn(
          "relative h-full w-64 cursor-pointer overflow-hidden rounded-xl border p-4",
          // light styles
          "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
          // dark styles
          "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]"
        )}
      >
        <div className="flex flex-row items-center gap-2">
          <img
            className="rounded-full"
            width="32"
            height="32"
            alt=""
            src={img}
          />
          <div className="flex flex-col">
            <figcaption className="text-sm font-medium dark:text-white">
              {name}
            </figcaption>
            <p className="text-xs font-medium dark:text-white/40">{username}</p>
          </div>
        </div>
        <blockquote className="mt-2 text-sm">{body}</blockquote>
      </figure>
    );
  };

  const [showCoach, setShowCoach] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      role: "bot",
      content: "Hey there! I'm AlgoBuddy 🤖. Need help with anything?",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [randomProblem, setRandomProblem] = useState<any | null>(null);
  // Utility to get today in YYYY-MM-DD
  const getToday = () => new Date().toISOString().slice(0, 10);

  // Utility to check if two dates are consecutive
  const isConsecutive = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate() + 1
    );
  };

  // Get streak from localStorage
  const getStreak = (): number => {
    if (typeof window === 'undefined') return 1;
    const data = localStorage.getItem('algoace-activity-dates');
    if (!data) return 1;
    const dates = JSON.parse(data) as string[];
    if (!dates.length) return 1;
    // Sort descending
    dates.sort((a, b) => b.localeCompare(a));
    let streak = 1;
    let prev = dates[0];
    for (let i = 1; i < dates.length; i++) {
      if (isConsecutive(prev, dates[i])) {
        streak++;
        prev = dates[i];
      } else {
        break;
      }
    }
    return streak;
  };

  // On mount, update activity dates
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const today = getToday();
    let data = localStorage.getItem('algoace-activity-dates');
    let dates: string[] = data ? JSON.parse(data) : [];
    if (!dates.includes(today)) {
      dates.push(today);
      localStorage.setItem('algoace-activity-dates', JSON.stringify(dates));
    }
    setStreak(getStreak());
  }, []);

  // Bot reply logic based on user input or category clicked
  const getBotReply = (input: string) => {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('binary search')) {
      return 'Binary search is a logarithmic search algorithm. It divides the search interval in half each time. Make sure the array is sorted!';
    } else if (lowerInput.includes('recursion')) {
      return 'Recursion is a method of solving a problem where the solution depends on solutions to smaller instances of the same problem.';
    } else if (lowerInput.includes('dp') || lowerInput.includes('dynamic programming')) {
      return 'Dynamic Programming (DP) is an optimization technique that solves problems by breaking them into subproblems and storing their results.';
    } else if (lowerInput.includes('linked list')) {
      return 'A linked list is a linear data structure where elements are stored in nodes and linked using pointers.';
    } else if (lowerInput.includes('time complexity')) {
      return 'Time complexity describes how the runtime of an algorithm changes with input size. Big-O notation is commonly used for this.';
    } else if (lowerInput.includes('graph')) {
      return 'Graphs are collections of nodes (vertices) and edges. Common algorithms include DFS, BFS, Dijkstra’s, and Kruskal’s.';
    } else if (lowerInput.includes('stack')) {
      return 'A stack is a LIFO (Last In First Out) data structure. Common operations are push, pop, and peek.';
    }
    return "That's a great question! Try breaking the problem into parts and solving step by step.";
  };

  const handleSend = () => {
    if (!userInput.trim()) return;

    const userMessage = { role: "user", content: userInput };
    const botMessage = {
      role: "bot",
      content: getBotReply(userInput),
    };

    setChatHistory((prev) => [...prev, userMessage, botMessage]);
    setUserInput("");
  };

  const handleRandomProblem = async () => {
    try {
      // Fetch the dataset directly from the static JSON file
      const response = await fetch("/leetcode-problems-dataset.json");
      if (!response.ok) throw new Error("Failed to fetch problems dataset");
      const problems = await response.json();
      // Filter for easy problems
      const easyProblems = problems.filter(
        (p: any) =>
          (p.difficulty?.toLowerCase?.() === "easy") ||
          (p.difficulty === "Easy")
      );
      if (!Array.isArray(easyProblems) || easyProblems.length === 0)
        throw new Error("No easy problems found");

      // Pick a random easy problem
      const random = easyProblems[Math.floor(Math.random() * easyProblems.length)];
      setRandomProblem(random);
    } catch (error: any) {
      alert(error.message || "Failed to fetch random problem");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-12">
      {/* Header with Top-Right Additions */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to AlgoAce
          </h1>
          <p className="text-muted-foreground">
            Your comprehensive platform for Data Structures and Algorithms
            preparation
          </p>
        </div>

        <div className="flex items-center gap-4 ml-auto mt-2">
          <div className="flex items-center gap-1 text-sm text-orange-500 font-medium">
            🔥 <span>{streak}-day streak</span>
          </div>
          <button
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-full text-sm shadow-md transition"
            onClick={handleRandomProblem}
          >
            🎲 Random Problem
          </button>
          <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
            🎯 Set Goal
          </button>
        </div>
      </div>

      {/* Features Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/roadmap" passHref>
            <div className="rounded-lg border bg-card p-6 shadow-sm cursor-pointer hover:bg-gray-100 hover:text-black transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="text-blue-500" />
                <h3 className="text-lg font-semibold">Follow the Roadmap</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Structured learning paths to guide your DSA journey
              </p>
            </div>
          </Link>

          <Link href="/problems" passHref>
            <div className="rounded-lg border bg-card p-6 shadow-sm cursor-pointer hover:bg-gray-100 hover:text-black transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="text-green-500" />
                <h3 className="text-lg font-semibold">Practice Problems</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Curated problems to strengthen your problem-solving skills
              </p>
            </div>
          </Link>

        <Link href="/analytics" passHref>
          <div className="rounded-lg border bg-card p-6 shadow-sm cursor-pointer hover:bg-gray-100 hover:text-black transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <LineChart className="text-purple-500" />
              <h3 className="text-lg font-semibold">Track Your Progress</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Visualize your learning journey with detailed analytics
            </p>
          </div>
        </Link>
        </div>

      <div className="m-0 ">
        <h2 className="text-xl font-semibold mb-4 align-start">
          What Our Users Say
        </h2>
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
          <Marquee pauseOnHover className="[--duration:20s]">
            {firstRow.map((review) => (
              <ReviewCard key={review.username} {...review} />
            ))}
          </Marquee>
          <Marquee reverse pauseOnHover className="[--duration:20s]">
            {secondRow.map((review) => (
              <ReviewCard key={review.username} {...review} />
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background"></div>
        </div>
      </div>

      {/* FAQ Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Is AlgoAce free to use?</h4>
            <p className="text-sm text-muted-foreground">
              Yes! Core features like the roadmap, practice problems, and
              tracking are free for all users.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Do I need an account?</h4>
            <p className="text-sm text-muted-foreground">
              You can browse content without an account, but you'll need one to
              save progress or compete in contests.
            </p>
          </div>
          <div>
            <h4 className="font-medium">How often is content updated?</h4>
            <p className="text-sm text-muted-foreground">
              We update weekly with new problems, tutorials, and roadmap
              improvements.
            </p>
          </div>
        </div>
      </div>

      {/* Mascot: AlgoBuddy Chat Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowCoach(!showCoach)}
          className="transition hover:scale-105"
          aria-label="Toggle AlgoBuddy chat"
        >
          <Image
            src="/algobuddy.jpg"
            alt="AlgoBuddy Mascot"
            width={64}
            height={64}
            className="rounded-full shadow-md border border-blue-800"
          />
        </button>
      </div>

      {/* Chat Popup */}
      {showCoach && (
        <div className="fixed bottom-24 right-4 w-80 bg-white border border-gray-200 shadow-lg rounded-lg flex flex-col z-50">
          <div className="bg-blue-600 text-white text-sm px-4 py-2 rounded-t-lg flex justify-between items-center">
            <span>🤖 AlgoBuddy</span>
            <button
              onClick={() => setShowCoach(false)}
              className="text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="p-4 h-60 overflow-y-auto text-sm space-y-2">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={msg.role === "user" ? "text-right" : "text-left"}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input area */}
          <div className="p-2 border-t flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 px-3 py-2 text-sm border rounded-md border-blue-400 placeholder-grey-500 text-black"
              placeholder="Ask me something..."
            />
            <button
              onClick={handleSend}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded-md"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {randomProblem && (
        <div className="fixed top-24 right-4 z-50 bg-white border border-gray-300 shadow-lg rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-2 text-black">{randomProblem.title}</h2>
          <div className="mb-2 text-xs text-gray-500 flex gap-2">
            <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">{randomProblem.difficulty}</span>
            {randomProblem.related_topics && Array.isArray(randomProblem.related_topics)
              ? randomProblem.related_topics.map((t: string) => (
                  <span key={t} className="px-2 py-1 rounded bg-gray-100 text-gray-700">{t}</span>
                ))
              : null}
          </div>
          <div className="mb-2 max-h-60 overflow-y-auto whitespace-pre-line text-sm text-gray-700">
            {/* Try to split description into paragraphs for readability */}
            {randomProblem.description
              ? randomProblem.description
                  .split(/\n{2,}/)
                  .map((para: string, idx: number) => (
                    <p key={idx} className="mb-2">{para.trim()}</p>
                  ))
              : "No description available."}
          </div>
          <a
            href={`/problems/${randomProblem.id}`}
            className="text-blue-600 underline text-sm"
          >
            Go to Problem
          </a>
          <button
            className="ml-4 text-xs text-gray-500 hover:text-gray-800"
            onClick={() => setRandomProblem(null)}
          >
            Close
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-transparent text-muted-foreground py-1">
        <div className="max-w-screen-xl mx-auto text-center">
          <p className="text-s">© 2025 AlgoAce. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <a href="#" className="hover:text-primary">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary">
              Terms of Service
            </a>
            <a href="#" className="hover:text-primary">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
