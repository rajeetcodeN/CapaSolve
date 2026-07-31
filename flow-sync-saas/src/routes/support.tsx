import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, Mail, Phone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support Center — CapaSolve" },
      { name: "description", content: "Get help from the CapaSolve support team." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background text-left">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Support Portal
          </h1>
          <p className="text-muted-foreground text-xs">Need help setting up constraints or troubleshooting uploads?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Email Support</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you encounter bugs, spreadsheet parsing errors, or layout issues, email us directly.
              </p>
              <a href="mailto:info@digitalbiz.tech" className="text-xs text-primary font-bold hover:underline block pt-2">
                info@digitalbiz.tech &rarr;
              </a>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit">
                <HelpCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">General Enquiries</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Want to schedule a demo walk-through or request custom solver configurations?
              </p>
              <Button asChild size="sm" className="cursor-pointer mt-2 text-xs">
                <Link to="/contact">Send Inquiry</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
