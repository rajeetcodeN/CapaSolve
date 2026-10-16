import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service & Beta Agreement — CapaSolve" },
      {
        name: "description",
        content:
          "Terms of service, beta testing agreements, and data confidentiality for CapaSolve.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background text-left">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Terms of Service & Beta Agreement
          </h1>
          <p className="text-muted-foreground text-xs">
            Effective Date: March 2026. Applicable to all CapaSolve SaaS users and beta
            participants.
          </p>
        </div>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <CardContent className="pt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                1. Beta Testing Program Scope
              </h3>
              <p>
                CapaSolve is currently provided in an active Beta Program for discrete manufacturing
                production planning and scheduling. By accessing or using the platform, you agree to
                test the finite-capacity solver, simulation sandbox, and shop-floor dispatch
                capabilities and acknowledge that features may be updated without prior notice.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                2. Manufacturing Data Ownership & Confidentiality
              </h3>
              <p>
                You retain complete ownership of all work order schedules, Bill of Materials (BOM)
                quantities, cycle times, and machine group definitions uploaded to CapaSolve. We do
                not sell, monetize, or use your proprietary production schedules to train public
                models. Data is strictly isolated within your organization workspace via Row-Level
                Security.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-amber-500" />
                3. Production Disclaimer & Limitation of Liability
              </h3>
              <p>
                CapaSolve provides automated finite-capacity scheduling suggestions, setup matrix
                optimizations, and bottleneck warnings. Production planners are responsible for
                verifying schedule outputs against physical shop-floor constraints, tool readiness,
                and safety protocols before executing machine setups. CapaSolve is not liable for
                operational downtime resulting from scheduling decisions.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-primary" />
                4. Account Termination & Data Export
              </h3>
              <p>
                You may export your schedule data at any time via CSV or Excel (.xlsx). You may
                request complete deletion of your account and organization records in compliance
                with GDPR and applicable data privacy regulations.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
