"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { API_BASE } from "@/lib/api"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { useRouter } from 'next/navigation'
import { CalendarIcon, Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { PageHeader } from "@/components/layout/page-header"
import { cn } from "@/utils/supabase/utils"

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

      const response = await fetch(`${API_BASE}/api/roadmap/generate`, {
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

      await response.json()
      // const roadmapId = result.roadmap.id
      // router.push(`/roadmap/${roadmapId}`)
      toast.success("Roadmap generated successfully!")
      setTimeout(() => {
        router.push('/roadmap')
      }, 2000) // 1 second delay
      router.push('/roadmap')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("Error",{
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Toaster />
      <PageHeader
        title="Create New Roadmap"
        description="Tell us about your goal, current knowledge, and time budget — we'll generate a personalized plan."
      />

      <Card>
        <CardHeader>
          <CardTitle>Roadmap details</CardTitle>
          <CardDescription>
            All fields help tailor the generated plan to your situation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Prepare for an SDE internship"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Deadline</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal sm:w-[280px]",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        sideOffset={6}
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-3">
                <FormLabel>Current Knowledge</FormLabel>
                <div className="space-y-3">
                  {fields.map((f, index) => (
                    <div
                      key={f.id}
                      className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-start"
                    >
                      <FormField
                        control={form.control}
                        name={`current_knowledge.${index}.topic`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="Topic (e.g., Graphs)"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`current_knowledge.${index}.level`}
                        render={({ field }) => (
                          <FormItem className="sm:w-44">
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Basic">Basic</SelectItem>
                                <SelectItem value="Intermediate">
                                  Intermediate
                                </SelectItem>
                                <SelectItem value="Advanced">
                                  Advanced
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label="Remove knowledge area"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => append({ topic: "", level: "Basic" })}
                >
                  <Plus className="size-4" />
                  Add knowledge area
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="weekly_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekly Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
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
                          min={1}
                          max={20}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/roadmap")}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Generating..." : "Generate Roadmap"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
