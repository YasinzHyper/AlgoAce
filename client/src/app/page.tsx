export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to AlgoAce</h1>
        <p className="text-muted-foreground">
          Your comprehensive platform for Data Structures and Algorithms preparation
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Follow the Roadmap</h3>
          <p className="text-sm text-muted-foreground">Structured learning paths to guide your DSA journey</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Practice Problems</h3>
          <p className="text-sm text-muted-foreground">Curated problems to strengthen your problem-solving skills</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Track Your Progress</h3>
          <p className="text-sm text-muted-foreground">Visualize your learning journey with detailed analytics</p>
        </div>
      </div>
    </div>
  )
}
