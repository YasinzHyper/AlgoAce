'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface HelpModalProps {
  problemId: string;
  problemTitle: string;
}

export function HelpModal({ problemId, problemTitle }: HelpModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState('');

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Call the explanation agent API
      const response = await fetch('http://localhost:8000/api/problems/explanation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problem_id: problemId,
          question,
        }),
      });

      const data = await response.json();
      setExplanation(data.explanation);
    } catch (error) {
      console.error('Error getting explanation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Get Help</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Get Help with {problemTitle}</DialogTitle>
          <DialogDescription>
            Ask any question about the problem and get AI-powered explanations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            placeholder="What would you like to know about this problem?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[100px]"
          />
          <Button 
            onClick={handleSubmit} 
            disabled={!question.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting Explanation...
              </>
            ) : (
              'Get Explanation'
            )}
          </Button>
          {explanation && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Explanation:</h3>
              <p className="whitespace-pre-line">{explanation}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 