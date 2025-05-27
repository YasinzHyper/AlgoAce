'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, ListChecks, LineChart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link'; 

export default function Home() {
  const testimonials = [
    {
      quote: 'AlgoAce helped me land a job at Google. The structured roadmap and practice problems are gold.',
      name: 'Anjali R., Software Engineer',
    },
    {
      quote: 'Best platform I’ve used for DSA prep. Clean UI and practical features.',
      name: 'Rohit K., Final Year CS Student',
    },
    {
      quote: 'I love the progress tracker and weekly updates. Keeps me motivated.',
      name: 'Priya S., Aspiring SDE',
    },
    {
      quote: 'AlgoAce’s roadmap made everything less overwhelming. Super helpful for interview prep.',
      name: 'Nikhil T., Backend Developer',
    },
  ];

  const [current, setCurrent] = useState(0);
  const [showCoach, setShowCoach] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', content: "Hey there! I'm AlgoBuddy 🤖. Need help with anything?" },
  ]);
  const [userInput, setUserInput] = useState('');

  // New: Help categories quick suggestions
  const helpCategories = [
    'Binary Search',
    'Recursion',
    'Dynamic Programming',
    'Linked List',
    'Time Complexity',
    'Graph',
    'Stack',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
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

    const userMessage = { role: 'user', content: userInput };
    const botMessage = { role: 'bot', content: getBotReply(userInput) };

    setChatHistory((prev) => [...prev, userMessage, botMessage]);
    setUserInput('');
  };

  // Handle clicking a help category button
  const handleCategoryClick = (category: string) => {
    const userMessage = { role: 'user', content: category };
    const botMessage = { role: 'bot', content: getBotReply(category) };

    setChatHistory((prev) => [...prev, userMessage, botMessage]);
    setShowCoach(true); // open chat if closed
  };

  return (
    <div className="flex flex-col gap-12">
      {/* Header with Top-Right Additions */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to AlgoAce</h1>
          <p className="text-muted-foreground">
            Your comprehensive platform for Data Structures and Algorithms preparation
          </p>
        </div>

        <div className="flex items-center gap-4 ml-auto mt-2">
          <div className="flex items-center gap-1 text-sm text-orange-500 font-medium">
            🔥 <span>5-day streak</span>
          </div>
          <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-full text-sm shadow-md transition">
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

      {/* Testimonials Carousel */}
      <div className="relative bg-muted rounded-lg p-6 min-h-[140px]">
        <h2 className="text-xl font-semibold mb-4">What Our Users Say</h2>
        {testimonials.map((t, i) => (
          <div
            key={i}
            className={`transition-opacity duration-700 ease-in-out ${
              i === current ? 'opacity-100' : 'opacity-0 absolute top-0 left-0 w-full p-6'
            }`}
          >
            <blockquote className="italic text-muted-foreground mb-2">{`“${t.quote}”`}</blockquote>
            <p className="text-sm text-muted-foreground">— {t.name}</p>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Is AlgoAce free to use?</h4>
            <p className="text-sm text-muted-foreground">
              Yes! Core features like the roadmap, practice problems, and tracking are free for all users.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Do I need an account?</h4>
            <p className="text-sm text-muted-foreground">
              You can browse content without an account, but you'll need one to save progress or compete in contests.
            </p>
          </div>
          <div>
            <h4 className="font-medium">How often is content updated?</h4>
            <p className="text-sm text-muted-foreground">
              We update weekly with new problems, tutorials, and roadmap improvements.
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
            <button onClick={() => setShowCoach(false)} className="text-white text-xs">✕</button>
          </div>

          {/* Quick Help Categories */}
          <div className="flex gap-2 flex-wrap p-2 border-b overflow-x-auto">
            {helpCategories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs px-3 py-1 rounded-full whitespace-nowrap"
              >
                {category}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="p-4 h-60 overflow-y-auto text-sm space-y-2">
            {chatHistory.map((msg, index) => (
              <div key={index} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block px-3 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
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
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 px-3 py-2 text-sm border rounded-md border-blue-400 placeholder-gray-500"
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

      {/* Footer */}
      <footer className="bg-transparent text-muted-foreground py-1">
        <div className="max-w-screen-xl mx-auto text-center">
          <p className="text-s">© 2025 AlgoAce. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <a href="#" className="hover:text-primary">Privacy Policy</a>
            <a href="#" className="hover:text-primary">Terms of Service</a>
            <a href="#" className="hover:text-primary">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
