import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, FileSpreadsheet, Play, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/documentation")({
  head: () => ({
    meta: [
      { title: "Documentation — CapaSolve" },
      { name: "description", content: "Learn how to use CapaSolve to optimize constraint-based manufacturing schedules." },
    ],
  }),
  component: DocumentationPage,
});

function DocumentationPage() {
  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background text-left">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Documentation
          </h1>
          <p className="text-muted-foreground text-xs">Learn how to model your factory and schedule orders.</p>
        </div>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <CardContent className="pt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4.5 w-4.5 text-primary" />
                1. Importing CSV Spreadsheet
              </h3>
              <p>
                Navigate to the <strong>Orders</strong> page in the dashboard workspace to upload your CSV file containing production orders. The CSV columns must map to fields like:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><code>order_id</code> — Unique order ID string.</li>
                <li><code>item_name</code> — Name or part identifier of the item.</li>
                <li><code>process_time_hrs</code> — Processing duration.</li>
                <li><code>due_date</code> — Delivery deadline date.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Play className="h-4.5 w-4.5 text-primary" />
                2. Running the Solver
              </h3>
              <p>
                Once your orders are loaded, open the <strong>Gantt Chart</strong> or <strong>Capacity Planning</strong> page. Tap the **Optimize Schedule** button in the header toolbar to trigger the constraint solver. The solver parses setup constraints, line assignments, and calendar shifts to structure your production timeline.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <CheckCircle className="h-4.5 w-4.5 text-primary" />
                3. Analyzing OEE Metrics
              </h3>
              <p>
                Open the **Analytics** dashboard to evaluate the generated plan. The charts display workstation utilization rates, average setup delay, total order delay hours, and overall plant OEE calculations to verify planning performance.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
