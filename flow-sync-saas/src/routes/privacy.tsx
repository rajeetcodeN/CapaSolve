import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, FileText, Globe } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CapaSolve" },
      { name: "description", content: "Privacy Policy and data security documentation." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background text-left">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-xs">Last Updated: July 23, 2026</p>
        </div>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <CardContent className="pt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Globe className="h-4.5 w-4.5 text-primary" />
                1. Overview
              </h3>
              <p>
                This Privacy Policy describes how CapaSolve ("we", "us", or "our"), owned and
                operated by **Digital Biz Tech**, collects, uses, and discloses information when you
                use our manufacturing scheduling platform. We are committed to protecting the
                privacy of your factory data and your users.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-primary" />
                2. Information We Collect
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Account Metadata:</strong> Email addresses, user roles, passwords, name
                  details, and company designations.
                </li>
                <li>
                  <strong>Manufacturing Data:</strong> Workstation specifications, capacity rules,
                  machine groups, order quantities, and custom timelines imported via CSV sheets.
                </li>
                <li>
                  <strong>Log Data:</strong> System optimization events, error logs, and audit
                  records of cloud saving/loading transactions.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Lock className="h-4.5 w-4.5 text-primary" />
                3. How We Secure and Isolate Data
              </h3>
              <p>
                All imported CSV sheets, workstation configs, and schedules are stored securely
                inside Supabase PostgreSQL database tables and S3-compatible cloud storage buckets.
                We utilize Row-Level Security (RLS) policies to ensure that your factory data is
                strictly isolated and can only be accessed by authenticated users within your
                organization tenant.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
