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
import { Toaster, toast } from "sonner"
import { redirect, useRouter } from 'next/navigation'
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

const knowledgeSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  level: z.enum(["Basic", "Intermediate", "Advanced"]),
})

const formSchema = z.object({
  goal: z.string().min(1, "Goal is required"),
  deadline: z.date({ required_error: "Deadline is required" }),
  current_knowledge: z.array(knowledgeSchema).min(1, "At least one knowledge area is required"),
  weekly_hours: z.number().min(1, "Weekly hours must be at least 1"),
  weeks: z.number().min(1, "Weeks must be at least 1"),
})

export default function CreateRoadmapPage() {
  const [loading, setLoading] = useState(false)
  // const { toast } = useToast()
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goal: "",
      deadline: undefined,
      current_knowledge: [{ topic: "", level: "Basic" }],
      weekly_hours: 10,
      weeks: 1,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "current_knowledge",
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setLoading(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error("You must be logged in to generate a roadmap")
      }
      const token = sessionData.session.access_token

      const knowledgeJson = data.current_knowledge.reduce((acc, item) => {
        acc[item.topic] = item.level
        return acc
      }, {} as Record<string, string>)

      const formattedDeadline = format(data.deadline, "yyyy-MM-dd")

      const apiData = {
        goal: data.goal,
        deadline: formattedDeadline,
        current_knowledge: knowledgeJson,
        weekly_hours: data.weekly_hours,
        weeks: data.weeks,
      }

      const response = await fetch("http://localhost:8000/api/roadmap/generate", {
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

      const result = await response.json()
      // const roadmapId = result.roadmap.id
      // router.push(`/roadmap/${roadmapId}`)
      toast.success("Roadmap generated successfully!")
      setTimeout(() => {
        router.push('/roadmap')
      }, 2000) // 1 second delay
      router.push('/roadmap')
    } catch (error: any) {
      toast.error("Error",{
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Roadmap</h1>
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
          <FormField
            control={form.control}
            name="deadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deadline</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[280px] justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
                      max={20}
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
    </div>
  )
}