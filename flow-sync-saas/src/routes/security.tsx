import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, Key, HardDrive } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security and Compliance — CapaSolve" },
      { name: "description", content: "Learn more about CapaSolve's data security, RLS isolation, and encryption." },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background text-left">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Security & Compliance
          </h1>
          <p className="text-muted-foreground text-xs">How we protect your industrial planning data.</p>
        </div>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <CardContent className="pt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                1. Multi-Tenant Data Isolation
              </h3>
              <p>
                Our core database leverages PostgreSQL **Row-Level Security (RLS)** in Supabase. This ensures that every SQL query executed on behalf of a user is strictly restricted to that user's active organization ID, preventing any cross-tenant data leaks.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Key className="h-4.5 w-4.5 text-primary" />
                2. Server-Side Request Verification
              </h3>
              <p>
                All scheduling updates and file saves invoke TanStack Start `createServerFn` endpoints. These endpoints require a verified client JWT token, validating the signature against Supabase Auth before processing any backend file transfers.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <HardDrive className="h-4.5 w-4.5 text-primary" />
                3. Encryption & Storage
              </h3>
              <p>
                All data is encrypted in transit using TLS 1.3 and at rest inside S3-compatible cloud storage buckets and encrypted PostgreSQL disks. Regular backups are automated to secure scheduling continuity.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
