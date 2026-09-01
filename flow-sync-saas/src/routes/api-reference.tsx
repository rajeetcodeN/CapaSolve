import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Terminal, Code2, Link2 } from "lucide-react";

export const Route = createFileRoute("/api-reference")({
  head: () => ({
    meta: [
      { title: "API Reference — CapaSolve" },
      {
        name: "description",
        content: "Integrate CapaSolve scheduling solver into your ERP system via API endpoints.",
      },
    ],
  }),
  component: ApiReferencePage,
});

function ApiReferencePage() {
  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background text-left">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            API Reference
          </h1>
          <p className="text-muted-foreground text-xs">
            Integrate CapaSolve's constraint engine directly with your ERP.
          </p>
        </div>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <CardContent className="pt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Code2 className="h-4.5 w-4.5 text-primary" />
                Authentication
              </h3>
              <p>
                All API requests must contain an <code>Authorization</code> header containing your
                Enterprise API token:
              </p>
              <pre className="bg-muted p-3.5 rounded-lg text-xs text-foreground/90 font-mono border border-border/40 overflow-x-auto">
                Authorization: Bearer cap_live_YOUR_SECRET_API_KEY
              </pre>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-primary" />
                1. Trigger Schedule Optimization
              </h3>
              <p>
                To trigger the constraint optimization engine programmatically, send a{" "}
                <code>POST</code> request:
              </p>
              <pre className="bg-muted p-3.5 rounded-lg text-xs text-foreground/90 font-mono border border-border/40 overflow-x-auto">
                POST https://api.capasolve.com/v1/schedule/optimize
              </pre>
              <p className="text-xs text-muted-foreground">
                Payload parameters: <code>organization_id</code>, <code>horizon_days</code>, and{" "}
                <code>workstations</code> map details.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Link2 className="h-4.5 w-4.5 text-primary" />
                2. Fetch Current Timeline
              </h3>
              <p>To retrieve the currently active Gantt schedule entries:</p>
              <pre className="bg-muted p-3.5 rounded-lg text-xs text-foreground/90 font-mono border border-border/40 overflow-x-auto">
                GET https://api.capasolve.com/v1/schedule/active
              </pre>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
