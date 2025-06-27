"use client";

import { useEffect, useState, useRef } from "react";
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
  type ChatMessage = {
    role: "user" | "bot";
    content: string | { type: string; code: string; label: string };
  };

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: "bot",
      content: "Hey there! I'm AlgoBuddy 🤖. Need help with anything?",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [randomProblem, setRandomProblem] = useState<any | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null); // For copy-to-clipboard feedback
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
    const lowerInput = input.trim().toLowerCase();
    if (["hi", "hello", "hey"].includes(lowerInput)) {
      return (
        "Hi! I'm AlgoBuddy, your personal DSA assistant. " +
        "Ask me about algorithms, data structures, or interview prep. " +
        "I can explain concepts, show pseudocode, and help you practice!"
      );
    }
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

    const userMessage: ChatMessage = { role: "user", content: userInput };
    const botMessage: ChatMessage = {
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

  // Refine common topics for chatbot: 10 focused DSA topics with explanations and pseudocode
  const commonTopics = [
    {
      label: "Binary Search",
      explanation: "Efficiently search a sorted array by repeatedly dividing the search interval in half. Time complexity: O(log n).",
      pseudocode: `Pseudocode:\nfunction binarySearch(arr, target):\n    left = 0\n    right = length(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        else if arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1`
    },
    {
      label: "Recursion",
      explanation: "A function calls itself to solve smaller instances of a problem. Useful for divide-and-conquer and tree/graph traversals.",
      pseudocode: `Pseudocode (Factorial):\nfunction factorial(n):\n    if n == 0 or n == 1:\n        return 1\n    else:\n        return n * factorial(n-1)`
    },
    {
      label: "Dynamic Programming",
      explanation: "Optimize by storing results of overlapping subproblems. Used for problems like Fibonacci, Knapsack, and more.",
      pseudocode: `Pseudocode (Fibonacci DP):\nfunction fib(n):\n    dp = array of size n+1\n    dp[0] = 0\n    dp[1] = 1\n    for i from 2 to n:\n        dp[i] = dp[i-1] + dp[i-2]\n    return dp[n]`
    },
    {
      label: "Linked List",
      explanation: "A linear data structure where elements (nodes) point to the next. Useful for efficient insertions/deletions.",
      pseudocode: `Pseudocode (Reverse List):\nfunction reverseList(head):\n    prev = null\n    curr = head\n    while curr != null:\n        next = curr.next\n        curr.next = prev\n        prev = curr\n        curr = next\n    return prev`
    },
    {
      label: "Graph",
      explanation: "A collection of nodes (vertices) and edges. Used to model networks, with algorithms like BFS, DFS, Dijkstra's.",
      pseudocode: `Pseudocode (BFS):\nfunction BFS(start):\n    queue = empty queue\n    mark start as visited\n    enqueue start\n    while queue not empty:\n        node = dequeue\n        for each neighbor in node.neighbors:\n            if neighbor not visited:\n                mark neighbor as visited\n                enqueue neighbor`
    },
    {
      label: "Stack",
      explanation: "A LIFO (Last In First Out) data structure. Supports push, pop, and peek operations.",
      pseudocode: `Pseudocode:\npush(x): add x to top\npop(): remove and return top\npeek(): return top without removing`
    },
    {
      label: "Queue",
      explanation: "A FIFO (First In First Out) data structure. Supports enqueue and dequeue operations.",
      pseudocode: `Pseudocode:\nenqueue(x): add x to rear\ndequeue(): remove and return front`
    },
    {
      label: "Heap",
      explanation: "A complete binary tree used for efficient min/max operations. Commonly used in priority queues and heap sort.",
      pseudocode: `Pseudocode (Heapify):\nfunction heapify(arr, n, i):\n    largest = i\n    left = 2*i + 1\n    right = 2*i + 2\n    if left < n and arr[left] > arr[largest]:\n        largest = left\n    if right < n and arr[right] > arr[largest]:\n        largest = right\n    if largest != i:\n        swap arr[i], arr[largest]\n        heapify(arr, n, largest)`
    },
    {
      label: "Tree",
      explanation: "A hierarchical data structure with nodes and edges. Includes binary trees, BSTs, and is used for fast searching and sorting.",
      pseudocode: `Pseudocode (Inorder Traversal):\nfunction inorder(node):\n    if node is not null:\n        inorder(node.left)\n        visit(node)\n        inorder(node.right)`
    },
    {
      label: "Sorting Algorithms",
      explanation: "Techniques to arrange data in order. Includes bubble, merge, quick, and heap sort. Time complexity varies by algorithm.",
      pseudocode: `Pseudocode (Merge Sort):\nfunction mergeSort(arr):\n    if length(arr) > 1:\n        mid = length(arr) // 2\n        left = arr[0:mid]\n        right = arr[mid:]\n        mergeSort(left)\n        mergeSort(right)\n        merge left and right into arr`
    }
  ];

  // DSA Tips and Interview Advice only
  const tips = [
    "Break down problems into smaller parts before coding.",
    "Always analyze time and space complexity.",
    "Practice writing pseudocode before implementation.",
    "Draw diagrams for trees, graphs, and linked lists.",
    "Test your code with edge cases.",
    "Use meaningful variable names for clarity.",
    "Review and refactor your code for readability.",
    "Understand the problem constraints before starting.",
    "Master recursion and iterative approaches for common patterns.",
    "Practice regularly to build muscle memory."
  ];
  const interviewAdvice = [
    "Communicate your thought process clearly during interviews.",
    "Ask clarifying questions if the problem statement is unclear.",
    "Start with a brute-force solution, then optimize.",
    "Don't be afraid to admit if you don't know something—show your willingness to learn.",
    "Write clean, bug-free code before optimizing for performance.",
    "Practice mock interviews with peers or online platforms.",
    "Review common data structures and algorithms before interviews.",
    "Stay calm and take a deep breath if you get stuck.",
    "Explain your approach before jumping into code.",
    "Always test your solution with sample inputs."
  ];

  const [tipIndex, setTipIndex] = useState<number>(0);

  const getCurrentTip = () => {
    // Alternate between tips and advice
    const total = tips.length + interviewAdvice.length;
    const idx = tipIndex % total;
    if (idx % 2 === 0) {
      // Even: tip
      return { type: 'tip', text: tips[Math.floor(idx / 2) % tips.length] };
    } else {
      // Odd: advice
      return { type: 'advice', text: interviewAdvice[Math.floor(idx / 2) % interviewAdvice.length] };
    }
  };

  // FAQ categories and questions
  const faqCategories = [
    'All',
    'General',
    'Accounts',
    'Content',
    'Features',
    'Support',
  ];
  const [selectedCategory, setSelectedCategory] = useState('All');
  const faqs = [
    {
      category: 'General',
      question: 'Is AlgoAce free to use?',
      answer: 'Yes! Core features like the roadmap, practice problems, and tracking are free for all users.'
    },
    {
      category: 'Accounts',
      question: 'Do I need an account?',
      answer: 'You can browse content without an account, but you\'ll need one to save progress or compete in contests.'
    },
    {
      category: 'Content',
      question: 'How often is content updated?',
      answer: 'We update weekly with new problems, tutorials, and roadmap improvements.'
    },
    {
      category: 'Features',
      question: 'What features are available for free?',
      answer: 'Roadmap, practice problems, analytics, and tips are free. Some advanced features may require an account.'
    },
    {
      category: 'Support',
      question: 'How can I contact support?',
      answer: 'Use the Contact Us link in the footer or email us at support@algoace.com.'
    },
  ];

  const [showCalendar, setShowCalendar] = useState(false);
  const [activityDates, setActivityDates] = useState<string[]>([]);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let data = localStorage.getItem('algoace-activity-dates');
    let dates: string[] = data ? JSON.parse(data) : [];
    setActivityDates(dates);
  }, [showCalendar]);

  // Helper to get days in current month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  // Helper to check if a date is in activityDates
  const isVisited = (date: Date) => {
    const ymd = date.toISOString().slice(0, 10);
    return activityDates.includes(ymd);
  };

  // --- SEARCH BAR LOGIC (SIMPLE, ERROR-FREE, ALL DATA SOURCES) ---
  const [problems, setProblems] = useState<any[]>([]);
  useEffect(() => {
    fetch("/leetcode-problems-dataset.json")
      .then((res) => res.json())
      .then((data) => setProblems(data))
      .catch(() => setProblems([]));
  }, []);

  // Static roadmap topics (example, can be replaced with dynamic data)
  const roadmapTopics = [
    { id: 1, title: "Arrays & Strings", description: "Master the basics of arrays and strings." },
    { id: 2, title: "Linked Lists", description: "Learn about singly and doubly linked lists." },
    { id: 3, title: "Trees & Graphs", description: "Understand tree and graph traversals." },
    { id: 4, title: "Dynamic Programming", description: "Tackle DP problems step by step." },
    { id: 5, title: "Sorting & Searching", description: "Explore classic sorting and searching algorithms." },
  ];

  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0); // For keyboard navigation
  const searchRef = useRef<HTMLDivElement>(null);

  // Filtered/categorized results
  const filteredProblems = query.trim()
    ? problems.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(query.toLowerCase())) ||
          (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 5)
    : [];
  const filteredRoadmap = query.trim()
    ? roadmapTopics.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3)
    : [];
  const filteredFaqs = query.trim()
    ? faqs.filter(
        (f) =>
          f.question.toLowerCase().includes(query.toLowerCase()) ||
          f.answer.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3)
    : [];
  const filteredReviews = query.trim()
    ? reviews.filter(
        (r) =>
          r.body.toLowerCase().includes(query.toLowerCase()) ||
          r.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3)
    : [];

  // Flatten for keyboard navigation
  const categorizedResults = [
    ...filteredProblems.map((item) => ({ type: "problem", item })),
    ...filteredRoadmap.map((item) => ({ type: "roadmap", item })),
    ...filteredFaqs.map((item) => ({ type: "faq", item })),
    ...filteredReviews.map((item) => ({ type: "review", item })),
  ];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    if (showSearch) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSearch]);

  // Keyboard navigation
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSearch || categorizedResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % categorizedResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + categorizedResults.length) % categorizedResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const res = categorizedResults[activeIndex];
      if (res) {
        if (res.type === "problem") {
          window.location.href = `/problems/${res.item.id}`;
        } else if (res.type === "roadmap") {
          window.location.href = "/roadmap";
        } else if (res.type === "faq") {
          setShowSearch(false);
        } else if (res.type === "review") {
          setShowSearch(false);
        }
      }
    } else if (e.key === "Escape") {
      setShowSearch(false);
    }
  }

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
        {/* Simple Search Bar (Global) */}
        <div ref={searchRef} className="w-full sm:w-72 max-w-md ml-auto mt-2 sm:mt-0">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSearch(true); setActiveIndex(0); }}
              onFocus={() => setShowSearch(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              className="w-full px-5 py-2 pr-10 rounded-xl border border-primary dark:border-primary shadow text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-900 text-black dark:text-white transition-colors"
              aria-label="Global search"
              style={{ boxShadow: '0 2px 12px 0 rgba(0,0,0,0.04)' }}
              autoComplete="off"
            />
            {/* Clear (X) button when typing */}
            {query && (
              <button
                type="button"
                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 focus:outline-none"
                aria-label="Clear search"
                tabIndex={0}
                onClick={() => { setQuery(""); setShowSearch(false); setActiveIndex(0); }}
                style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 focus:outline-none"
              aria-label="Search"
              tabIndex={0}
              onClick={() => setShowSearch(true)}
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M20 20l-3.5-3.5" />
              </svg>
            </button>
            {showSearch && query && (
              <div className="absolute mt-2 w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
                {categorizedResults.length === 0 ? (
                  <div className="p-4 text-gray-500 dark:text-gray-400 text-sm">No results found.</div>
                ) : (
                  <>
                    {/* Problems Category */}
                    {filteredProblems.length > 0 && (
                      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-blue-100 dark:border-blue-900/30 px-4 pt-2 pb-1">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-300 tracking-wide uppercase">Problems</div>
                      </div>
                    )}
                    {filteredProblems.map((p, i) => (
                      <a
                        key={p.id}
                        href={`/problems/${p.id}`}
                        className={`block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm text-blue-900 dark:text-blue-200 transition-colors rounded ${activeIndex === i ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        tabIndex={-1}
                        onMouseEnter={() => setActiveIndex(i)}
                        style={{ borderBottom: i === filteredProblems.length - 1 && (filteredRoadmap.length > 0 || filteredFaqs.length > 0 || filteredReviews.length > 0) ? '1px solid #e0e7ef' : undefined }}
                      >
                        {p.title}
                      </a>
                    ))}
                    {filteredProblems.length > 0 && (filteredRoadmap.length > 0 || filteredFaqs.length > 0 || filteredReviews.length > 0) && (
                      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                    )}

                    {/* Roadmap Category */}
                    {filteredRoadmap.length > 0 && (
                      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-purple-100 dark:border-purple-900/30 px-4 pt-2 pb-1">
                        <div className="text-xs font-bold text-purple-700 dark:text-purple-300 tracking-wide uppercase">Roadmap</div>
                      </div>
                    )}
                    {filteredRoadmap.map((t, i) => (
                      <a
                        key={t.id}
                        href="/roadmap"
                        className={`block px-4 py-2 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-sm text-purple-900 dark:text-purple-200 transition-colors rounded ${activeIndex === filteredProblems.length + i ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}
                        tabIndex={-1}
                        onMouseEnter={() => setActiveIndex(filteredProblems.length + i)}
                        style={{ borderBottom: i === filteredRoadmap.length - 1 && (filteredFaqs.length > 0 || filteredReviews.length > 0) ? '1px solid #ede9fe' : undefined }}
                      >
                        {t.title}
                      </a>
                    ))}
                    {filteredRoadmap.length > 0 && (filteredFaqs.length > 0 || filteredReviews.length > 0) && (
                      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                    )}

                    {/* FAQ Category */}
                    {filteredFaqs.length > 0 && (
                      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-green-100 dark:border-green-900/30 px-4 pt-2 pb-1">
                        <div className="text-xs font-bold text-green-700 dark:text-green-300 tracking-wide uppercase">FAQ</div>
                      </div>
                    )}
                    {filteredFaqs.map((f, i) => (
                      <div
                        key={f.question}
                        className={`block px-4 py-2 hover:bg-green-100 dark:hover:bg-green-900/40 text-sm text-green-900 dark:text-green-200 transition-colors rounded cursor-default ${activeIndex === filteredProblems.length + filteredRoadmap.length + i ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                        tabIndex={-1}
                        onMouseEnter={() => setActiveIndex(filteredProblems.length + filteredRoadmap.length + i)}
                        style={{ borderBottom: i === filteredFaqs.length - 1 && filteredReviews.length > 0 ? '1px solid #d1fae5' : undefined }}
                      >
                        <span className="font-semibold">Q:</span> {f.question}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{f.answer}</div>
                      </div>
                    ))}
                    {filteredFaqs.length > 0 && filteredReviews.length > 0 && (
                      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                    )}

                    {/* Reviews Category */}
                    {filteredReviews.length > 0 && (
                      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-orange-100 dark:border-orange-900/30 px-4 pt-2 pb-1">
                        <div className="text-xs font-bold text-orange-700 dark:text-orange-300 tracking-wide uppercase">Reviews</div>
                      </div>
                    )}
                    {filteredReviews.map((r, i) => (
                      <div
                        key={r.name + r.body}
                        className={`block px-4 py-2 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-sm text-orange-900 dark:text-orange-200 transition-colors rounded cursor-default ${activeIndex === filteredProblems.length + filteredRoadmap.length + filteredFaqs.length + i ? 'bg-orange-50 dark:bg-orange-900/30' : ''}`}
                        tabIndex={-1}
                        onMouseEnter={() => setActiveIndex(filteredProblems.length + filteredRoadmap.length + filteredFaqs.length + i)}
                      >
                        <span className="font-semibold">{r.name}:</span> {r.body}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/roadmap" passHref>
            <div className="rounded-lg border border-blue-500 bg-card p-6 shadow-sm cursor-pointer hover:bg-gray-100 hover:text-black transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="text-blue-500 " />
                <h3 className="text-lg font-semibold">Follow the Roadmap</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Structured learning paths to guide your DSA journey
              </p>
            </div>
          </Link>

          <Link href="/problems" passHref>
            <div className="rounded-lg border border-green-500 bg-card p-6 shadow-sm cursor-pointer hover:bg-gray-100 hover:text-black transition-colors">
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
          <div className="rounded-lg border border-purple-500 bg-card p-6 shadow-sm cursor-pointer hover:bg-gray-100 hover:text-black transition-colors">
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

      {/* FAQ Section with Categories */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          {/* FAQ Categories */}
          {faqCategories.map((cat, idx) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${selectedCategory === cat ? 'bg-slate-700 text-white border-blue-400' : 'bg-slate-900 text-white-800 border-blue-400 hover:bg-blue-700'}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {faqs
            .filter(faq => selectedCategory === 'All' || faq.category === selectedCategory)
            .map((faq, idx) => (
              <div key={idx}>
                <h4 className="font-medium">{faq.question}</h4>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
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
            className="rounded-full shadow-md border border-primary"
          />
        </button>
      </div>

      {/* Chat Popup */}
      {showCoach && (
        <div className="fixed bottom-24 right-4 w-80 bg-card border border-primary shadow-lg rounded-lg flex flex-col z-50">
          <div className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-t-lg flex justify-between items-center">
            <span>🤖 AlgoBuddy</span>
            <button
              onClick={() => setShowCoach(false)}
              className="text-white text-xs"
            >
              ✕
            </button>
          </div>
          {/* Common topics as clickable chips with explanations on hover and pseudocode on click */}
          <div className="flex flex-wrap gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
            {commonTopics.map((topic) => (
              <button
                key={topic.label}
                className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition relative group"
                onClick={() => {
                  setChatHistory((prev) => [
                    ...prev,
                    { role: "user" as const, content: topic.label },
                    { role: "bot" as const, content: { type: 'code', code: topic.pseudocode, label: topic.label } },
                  ]);
                  setUserInput("");
                }}
              >
                {topic.label}
                <span className="hidden group-hover:block absolute left-0 top-8 z-10 w-56 bg-card border border-primary/20 text-xs text-primary rounded p-2 shadow-lg">
                  {topic.explanation}
                </span>
              </button>
            ))}
          </div>
          <div className="p-4 h-60 overflow-y-auto text-sm space-y-2">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={msg.role === "user" ? "text-right" : "text-left"}
              >
                {msg.role === "bot" && typeof msg.content === 'object' && msg.content.type === 'code' ? (
                  <div className="bg-gray-900 text-green-200 rounded-lg p-2 mb-1 relative">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-xs text-white">{msg.content.label} Pseudocode</span>
                      <button
                        className="relative group ml-2"
                        onClick={() => {
                          if (typeof msg.content === 'object' && 'code' in msg.content) {
                            navigator.clipboard.writeText(msg.content.code.replace(/\\n/g, '\n'));
                            setCopiedIndex(index);
                            setTimeout(() => setCopiedIndex((prev) => prev === index ? null : prev), 5000);
                          }
                        }}
                        aria-label="Copy pseudocode"
                      >
                        {/* Clipboard SVG icon */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          fill="none"
                          viewBox="0 0 24 24"
                          className="text-blue-300 hover:text-blue-500 transition"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                          <rect x="3" y="3" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                        </svg>
                        {/* Tooltip on hover or after copy */}
                        <span className={`absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none transition whitespace-nowrap shadow-lg z-20 opacity-0 group-hover:opacity-100 ${copiedIndex === index ? '!opacity-100' : ''}`}>
                          {copiedIndex === index ? 'Copied' : 'Copy'}
                        </span>
                      </button>
                    </div>
                    <textarea
                      className="w-full bg-gray-900 text-green-200 font-mono text-xs rounded p-1 border border-gray-700 resize-vertical"
                      style={{ minHeight: 90 }}
                      defaultValue={msg.content.code.replace(/\\n/g, '\n')}
                    />
                  </div>
                ) : (
                  <div
                    className={`inline-block px-3 py-2 rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {typeof msg.content === 'string' ? msg.content : ''}
                  </div>
                )}
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
              className="flex-1 px-3 py-2 text-sm border rounded-md border-primary placeholder-grey-500 text-black dark:text-white"
              placeholder="Ask me something..."
            />
            <button
              onClick={handleSend}
              className="bg-primary hover:bg-primary/80 text-primary-foreground text-sm px-3 py-1 rounded-md"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {randomProblem && (
        <div className="fixed top-24 right-4 z-50 max-w-md w-full">
          <div className="relative rounded-2xl border-4 border-blue-400 bg-gradient-to-br from-blue-50 via-white to-blue-100 shadow-2xl p-6 overflow-hidden animate-fade-in">
            {/* Decorative gradient ring */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br from-blue-300/30 to-purple-400/20 rounded-full blur-2xl z-0" />
            <div className="flex items-center gap-3 mb-2 z-10 relative">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-200 border-2 border-blue-400 text-2xl shadow">
                🎲
              </span>
              <h2 className="text-xl font-bold text-blue-900 drop-shadow-sm">{randomProblem.title}</h2>
            </div>
            <div className="mb-2 text-xs flex gap-2 z-10 relative">
              <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 border border-blue-300 font-semibold uppercase tracking-wide">{randomProblem.difficulty}</span>
              {randomProblem.related_topics && Array.isArray(randomProblem.related_topics)
                ? randomProblem.related_topics.map((t: string) => (
                    <span key={t} className="px-2 py-1 rounded bg-purple-100 text-purple-700 border border-purple-200 font-medium">{t}</span>
                  ))
                : null}
            </div>
            <div className="mb-2 max-h-60 overflow-y-auto whitespace-pre-line text-sm text-gray-800 z-10 relative">
              {/* Try to split description into paragraphs for readability */}
              {randomProblem.description
                ? randomProblem.description
                    .split(/\n{2,}/)
                    .map((para: string, idx: number) => (
                      <p key={idx} className="mb-2 leading-relaxed">{para.trim()}</p>
                    ))
                : "No description available."}
            </div>
            <div className="flex items-center justify-between mt-4 z-10 relative">
              <a
                href={`/problems/${randomProblem.id}`}
                className="bg-blue-500 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow transition"
              >
                Go to Problem
              </a>
              <button
                className="ml-4 text-xs text-gray-500 hover:text-gray-800 px-3 py-1 rounded-full border border-gray-300 bg-gray-100 transition"
                onClick={() => setRandomProblem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-transparent text-muted-foreground py-1">
        <div className="max-w-screen-xl mx-auto text-center">
          <p className="text-s">© 2025 AlgoAce. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <Link href="/footer/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
            <Link href="/footer/terms-of-service" className="hover:text-primary">Terms of Service</Link>
            <Link href="/footer/contact-us" className="hover:text-primary">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// MiniCalendar component
function MiniCalendar({ activityDates }: { activityDates: string[] }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Only reset to current month/year on first mount, not every time calendar is shown
    if (isFirstMount.current) {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
      isFirstMount.current = false;
    }
    // Do not reset on subsequent show/hide
    // eslint-disable-next-line
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const ymd = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isToday = (dateStr: string) => dateStr === today.toISOString().slice(0, 10);
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long' });
  const visitedCount = activityDates.filter(date => date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`)).length;

  // Navigation handlers
  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setViewMonth(m => {
      if (m === 0) {
        setViewYear((y: number) => y - 1);
        return 11;
      } else {
        return m - 1;
      }
    });
  };
  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setViewMonth(m => {
      if (m === 11) {
        setViewYear((y: number) => y + 1);
        return 0;
      } else {
        return m + 1;
      }
    });
  };

  return (
    <div onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center text-xs mb-1 text-gray-500">
        <button onClick={handlePrev} className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700 font-bold" type="button">&#8592; Prev</button>
        <span>{monthName} {viewYear}</span>
        <button onClick={handleNext} className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700 font-bold" type="button">Next &#8594;</button>
      </div>
      <div className="text-center text-xs mb-1 text-orange-700 font-semibold">Visited: {visitedCount}d</div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={d + i} className="text-center font-bold text-gray-400">{d}</div>
        ))}
        {Array(firstDay).fill(null).map((_, i) => <div key={"empty-" + i}></div>)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const dateStr = ymd(i + 1);
          const visited = activityDates.includes(dateStr);
          return (
            <div
              key={"day-" + (i + 1)}
              className={`rounded-full w-7 h-7 flex items-center justify-center ${visited ? 'bg-orange-400 text-white font-bold shadow' : 'bg-gray-100 text-gray-700'} ${isToday(dateStr) ? 'ring-2 ring-orange-600' : ''}`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}
