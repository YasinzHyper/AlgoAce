'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, ListChecks, LineChart } from 'lucide-react';

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 4000); // Change testimonial every 4 seconds
    return () => clearInterval(interval); // Cleanup
  }, [testimonials.length]);

  return (
    <div className="flex flex-col gap-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to AlgoAce</h1>
        <p className="text-muted-foreground">
          Your comprehensive platform for Data Structures and Algorithms preparation
        </p>
      </div>

      {/* Features Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="text-blue-500" />
            <h3 className="text-lg font-semibold">Follow the Roadmap</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Structured learning paths to guide your DSA journey
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="text-green-500" />
            <h3 className="text-lg font-semibold">Practice Problems</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Curated problems to strengthen your problem-solving skills
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <LineChart className="text-purple-500" />
            <h3 className="text-lg font-semibold">Track Your Progress</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Visualize your learning journey with detailed analytics
          </p>
        </div>
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

      {/* Divider Line above Footer */}
      <div className="border-t border-muted-foreground border-t-[0.1px] mt-1" /> 

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
