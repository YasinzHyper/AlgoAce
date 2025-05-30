"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toaster } from "@/components/ui/sonner"
import { toast, useSonner } from "sonner"

// Define the form schema with zod
const knowledgeSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  level: z.enum(["Basic", "Intermediate", "Advanced"]),
})

const formSchema = z.object({
  goal: z.string().min(1, "Goal is required"),
  current_knowledge: z.array(knowledgeSchema).min(1, "At least one knowledge area is required"),
  weekly_hours: z.number().min(1, "Weekly hours must be at least 1"),
  weeks: z.number().min(1, "Weeks must be at least 1"),
})

export default function CreateRoadmapPage() {
  const [roadmap, setRoadmap] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { toasts } = useSonner()

  // Initialize the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goal: "",
      current_knowledge: [{ topic: "", level: "Basic" }],
      weekly_hours: 1,
      weeks: 1,
    },
  })

  // Handle dynamic current knowledge fields
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "current_knowledge",
  })

  // Handle form submission
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setLoading(true)
    try {
      // Get Supabase session and token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error("You must be logged in to generate a roadmap")
      }
      const token = sessionData.session.access_token

      // Transform current_knowledge array into JSON object
      const knowledgeJson = data.current_knowledge.reduce((acc, item) => {
        acc[item.topic] = item.level
        return acc
      }, {} as Record<string, string>)

      const apiData = {
        ...data,
        current_knowledge: knowledgeJson,
      }

      // Make API call
      const response = await fetch(`http://localhost:8000/api/roadmap/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(apiData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to generate roadmap: ${errorText}`)
      }
      // console.log(response.json());

      const result = await response.json()

      console.log(result)

      setRoadmap(result.roadmap_data) // Assuming API returns { roadmap_data: [...] }
      // toast(title,)
    } catch (error: any) {
      // toast({
      //   title: "Error",
      //   description: error.message,
      //   variant: "destructive",
      // })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Roadmap</h1>

      {/* Roadmap Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Goal</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Prepare for an SDE internship" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <FormLabel>Current Knowledge</FormLabel>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center space-x-2 mt-2">
                <FormField
                  control={form.control}
                  name={`current_knowledge.${index}.topic`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Topic (e.g., Graphs)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`current_knowledge.${index}.level`}
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Basic">Basic</SelectItem>
                          <SelectItem value="Intermediate">Intermediate</SelectItem>
                          <SelectItem value="Advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ topic: "", level: "Basic" })}
              className="mt-2"
            >
              Add Knowledge Area
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="weekly_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weekly Hours</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weeks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weeks</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Generating..." : "Generate Roadmap"}
          </Button>
        </form>
      </Form>

      {/* Roadmap Display */}
      {roadmap && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Your Generated Roadmap</h2>
          {roadmap.map((week: any, index: number) => (
            <div key={index} className="mb-4 p-4 border rounded">
              <h3 className="text-lg font-medium">Week {week.week}</h3>
              {week.DSA && (
                <div>
                  <h4 className="font-medium">DSA</h4>
                  <ul className="list-disc pl-5">
                    {Object.entries(week.DSA).map(([topic, level]) => (
                      <li key={topic}>
                        {topic}: {level as string}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {week.Other && (
                <div>
                  <h4 className="font-medium">Other</h4>
                  <ul className="list-disc pl-5">
                    {Object.entries(week.Other).map(([topic, level]) => (
                      <li key={topic}>
                        {topic}: {level as string}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}