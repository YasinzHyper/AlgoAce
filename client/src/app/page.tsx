"use client";

import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  Bot,
  Dices,
  Flame,
  Lightbulb,
  LineChart,
  ListChecks,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Marquee } from "@/components/magicui/marquee";
import Link from "next/link";
import { cn } from "@/utils/supabase/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
          "relative h-full w-64 overflow-hidden rounded-xl border bg-card p-4",
          "transition-colors hover:bg-accent/40"
        )}
      >
        <div className="flex items-center gap-2">
          <img className="rounded-full" width="32" height="32" alt="" src={img} />
          <div className="flex flex-col">
            <figcaption className="text-sm font-medium">{name}</figcaption>
            <p className="text-xs text-muted-foreground">{username}</p>
          </div>
        </div>
        <blockquote className="mt-2 text-sm text-muted-foreground">{body}</blockquote>
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
      content:
        "Hi! I'm AlgoBuddy — ask me anything about data structures, algorithms, or interview prep.",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const data = localStorage.getItem('algoace-activity-dates');
    const dates: string[] = data ? JSON.parse(data) : [];
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) =>
          (p.difficulty?.toLowerCase?.() === "easy") ||
          (p.difficulty === "Easy")
      );
      if (!Array.isArray(easyProblems) || easyProblems.length === 0)
        throw new Error("No easy problems found");

      // Pick a random easy problem
      const random = easyProblems[Math.floor(Math.random() * easyProblems.length)];
      setRandomProblem(random);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const data = localStorage.getItem('algoace-activity-dates');
    const dates: string[] = data ? JSON.parse(data) : [];
    setActivityDates(dates);
  }, [showCalendar]);

  // --- SEARCH BAR LOGIC (SIMPLE, ERROR-FREE, ALL DATA SOURCES) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const currentTip = getCurrentTip();

  const features = [
    {
      href: "/roadmap",
      icon: Lightbulb,
      title: "Follow the roadmap",
      description: "Structured learning paths to guide your DSA journey.",
    },
    {
      href: "/problems",
      icon: ListChecks,
      title: "Practice problems",
      description: "Curated problems to strengthen your problem-solving skills.",
    },
    {
      href: "/analytics",
      icon: LineChart,
      title: "Track your progress",
      description: "Visualize your learning journey with detailed analytics.",
    },
  ];

  const renderSearchGroup = (
    label: string,
    items: { key: string; content: React.ReactNode; href?: string }[],
    offset: number
  ) =>
    items.length > 0 && (
      <div className="py-1">
        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {items.map((item, i) => {
          const idx = offset + i;
          const baseClass = cn(
            "mx-1 block rounded-md px-3 py-2 text-sm transition-colors",
            activeIndex === idx ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
          );
          return item.href ? (
            <a
              key={item.key}
              href={item.href}
              className={baseClass}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {item.content}
            </a>
          ) : (
            <div
              key={item.key}
              className={cn(baseClass, "cursor-default")}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {item.content}
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="flex flex-1 flex-col gap-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:p-8 lg:p-10">
        {/* Decorative gradient blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-primary/5 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3" />
              DSA preparation, simplified
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome to AlgoAce
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Build a personalized roadmap, solve curated problems, and track
              your growth — all in one place.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/roadmap">
                  Get started <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" onClick={handleRandomProblem}>
                <Dices className="size-4" />
                Random problem
              </Button>
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent hover:shadow-md"
                    title="Your streak grows each consecutive day you visit. Missing a day resets it."
                  >
                    <Flame className="size-4 text-orange-500 transition-transform group-hover:scale-110" />
                    {streak}-day streak
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={8}
                  className="w-auto border-none p-0 shadow-none"
                >
                  <MiniCalendar activityDates={activityDates} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Global search */}
          <div ref={searchRef} className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSearch(true);
                setActiveIndex(0);
              }}
              onFocus={() => setShowSearch(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search problems, topics, FAQs..."
              aria-label="Global search"
              autoComplete="off"
              className="h-11 bg-background pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setShowSearch(false);
                  setActiveIndex(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
            {showSearch && query && (
              <div className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
                {categorizedResults.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No results found.
                  </div>
                ) : (
                  <>
                    {renderSearchGroup(
                      "Problems",
                      filteredProblems.map((p) => ({
                        key: `p-${p.id}`,
                        href: `/problems/${p.id}`,
                        content: p.title,
                      })),
                      0
                    )}
                    {renderSearchGroup(
                      "Roadmap",
                      filteredRoadmap.map((t) => ({
                        key: `r-${t.id}`,
                        href: "/roadmap",
                        content: t.title,
                      })),
                      filteredProblems.length
                    )}
                    {renderSearchGroup(
                      "FAQ",
                      filteredFaqs.map((f) => ({
                        key: `f-${f.question}`,
                        content: (
                          <>
                            <span className="font-medium">{f.question}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {f.answer}
                            </span>
                          </>
                        ),
                      })),
                      filteredProblems.length + filteredRoadmap.length
                    )}
                    {renderSearchGroup(
                      "Reviews",
                      filteredReviews.map((r) => ({
                        key: `rv-${r.name}-${r.body}`,
                        content: (
                          <>
                            <span className="font-medium">{r.name}</span>
                            <span className="ml-1 text-muted-foreground">
                              — {r.body}
                            </span>
                          </>
                        ),
                      })),
                      filteredProblems.length +
                        filteredRoadmap.length +
                        filteredFaqs.length
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tip of the day */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 p-4">
          <Badge variant="outline" className="gap-1.5">
            <Lightbulb className="size-3" />
            {currentTip.type === "tip" ? "DSA tip" : "Interview advice"}
          </Badge>
          <p className="flex-1 text-sm text-muted-foreground">{currentTip.text}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTipIndex((prev) => prev + 1)}
          >
            Next tip
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature, idx) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <Card className="relative h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-lg group-hover:shadow-primary/5">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/15">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  {feature.title}
                  <ArrowRight className="size-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      {/* Testimonials */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">What our users say</h2>
          <p className="text-sm text-muted-foreground">
            Trusted by students and engineers preparing for top companies.
          </p>
        </div>
        <div className="relative flex flex-col overflow-hidden">
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
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-background" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-background" />
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <p className="text-sm text-muted-foreground">
            Can&apos;t find what you&apos;re looking for? Reach out via the contact link below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {faqCategories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {faqs
              .filter(
                (faq) => selectedCategory === "All" || faq.category === selectedCategory
              )
              .map((faq) => (
                <div key={faq.question} className="space-y-1 p-5">
                  <h4 className="font-medium">{faq.question}</h4>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      </section>

      {/* Mascot: AlgoBuddy Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowCoach(!showCoach)}
          className={cn(
            "group relative flex size-14 items-center justify-center rounded-full",
            "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20",
            "transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          aria-label="Toggle AlgoBuddy chat"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-primary/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-safe:animate-ping"
          />
          {showCoach ? (
            <X className="relative size-6" />
          ) : (
            <MessageCircle className="relative size-6" />
          )}
          <span className="sr-only">Chat with AlgoBuddy</span>
        </button>
      </div>

      {/* Chat Popup */}
      {showCoach && (
        <div className="fixed bottom-24 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-xl border bg-card shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 sm:w-96">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <span className="text-sm font-semibold">AlgoBuddy</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                Online
              </Badge>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setShowCoach(false)}
              aria-label="Close chat"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b bg-muted/30 px-3 py-2">
            {commonTopics.map((topic) => (
              <button
                key={topic.label}
                title={topic.explanation}
                className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setChatHistory((prev) => [
                    ...prev,
                    { role: "user" as const, content: topic.label },
                    {
                      role: "bot" as const,
                      content: {
                        type: "code",
                        code: topic.pseudocode,
                        label: topic.label,
                      },
                    },
                  ]);
                  setUserInput("");
                }}
              >
                {topic.label}
              </button>
            ))}
          </div>
          <div className="h-64 space-y-2 overflow-y-auto p-4 text-sm">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={msg.role === "user" ? "text-right" : "text-left"}
              >
                {msg.role === "bot" &&
                typeof msg.content === "object" &&
                msg.content.type === "code" ? (
                  <div className="relative rounded-lg border bg-muted p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        {msg.content.label} · Pseudocode
                      </span>
                      <button
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => {
                          if (
                            typeof msg.content === "object" &&
                            "code" in msg.content
                          ) {
                            navigator.clipboard.writeText(
                              msg.content.code.replace(/\\n/g, "\n")
                            );
                            setCopiedIndex(index);
                            setTimeout(
                              () =>
                                setCopiedIndex((prev) =>
                                  prev === index ? null : prev
                                ),
                              2000
                            );
                          }
                        }}
                        aria-label="Copy pseudocode"
                      >
                        {copiedIndex === index ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      className="min-h-24 w-full resize-y rounded border bg-background p-2 font-mono text-xs"
                      defaultValue={msg.content.code.replace(/\\n/g, "\n")}
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "inline-block max-w-[85%] rounded-lg px-3 py-2",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {typeof msg.content === "string" ? msg.content : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t p-2">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask me something..."
              className="flex-1"
            />
            <Button onClick={handleSend} size="sm">
              Send
            </Button>
          </div>
        </div>
      )}

      {randomProblem && (
        <div className="fixed right-4 top-20 z-50 w-full max-w-md">
          <Card className="relative overflow-hidden shadow-2xl">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl" />
            <CardHeader className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Dices className="size-5" />
                  </div>
                  <CardTitle className="text-lg leading-snug">
                    {randomProblem.title}
                  </CardTitle>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="-mr-2 -mt-2 size-8"
                  onClick={() => setRandomProblem(null)}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{randomProblem.difficulty}</Badge>
                {Array.isArray(randomProblem.related_topics) &&
                  randomProblem.related_topics.slice(0, 3).map((t: string) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
              </div>
            </CardHeader>
            <CardContent className="relative max-h-60 space-y-2 overflow-y-auto text-sm text-muted-foreground">
              {randomProblem.description
                ? randomProblem.description
                    .split(/\n{2,}/)
                    .map((para: string, idx: number) => (
                      <p key={idx} className="leading-relaxed">
                        {para.trim()}
                      </p>
                    ))
                : "No description available."}
            </CardContent>
            <div className="relative flex items-center justify-end gap-2 border-t px-6 py-4">
              <Button variant="ghost" onClick={() => setRandomProblem(null)}>
                Dismiss
              </Button>
              <Button asChild>
                <Link href={`/problems/${randomProblem.id}`}>
                  Solve <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      )}

      <footer className="border-t pt-6 text-center text-muted-foreground">
        <p className="text-sm">
          © {new Date().getFullYear()} AlgoAce. All rights reserved.
        </p>
        <div className="mt-3 flex justify-center gap-6 text-xs">
          <Link href="/footer/privacy-policy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/footer/terms-of-service" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/footer/contact-us" className="transition-colors hover:text-foreground">
            Contact Us
          </Link>
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
    <div
      onClick={(e) => e.stopPropagation()}
      className="min-w-[260px] rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <button
          onClick={handlePrev}
          type="button"
          className="rounded px-2 py-1 font-medium hover:bg-accent"
        >
          ← Prev
        </button>
        <span className="font-medium">
          {monthName} {viewYear}
        </span>
        <button
          onClick={handleNext}
          type="button"
          className="rounded px-2 py-1 font-medium hover:bg-accent"
        >
          Next →
        </button>
      </div>
      <div className="mb-2 text-center text-xs font-medium text-muted-foreground">
        {visitedCount} day{visitedCount === 1 ? "" : "s"} active this month
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={d + i} className="text-center font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {Array(firstDay)
          .fill(null)
          .map((_, i) => (
            <div key={"empty-" + i} />
          ))}
        {Array(daysInMonth)
          .fill(null)
          .map((_, i) => {
            const dateStr = ymd(i + 1);
            const visited = activityDates.includes(dateStr);
            return (
              <div
                key={"day-" + (i + 1)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  visited
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  isToday(dateStr) && "ring-2 ring-primary ring-offset-1 ring-offset-popover"
                )}
              >
                {i + 1}
              </div>
            );
          })}
      </div>
    </div>
  );
}
