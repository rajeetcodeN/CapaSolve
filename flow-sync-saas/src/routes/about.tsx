import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslations } from "@/lib/translations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Factory, ShieldCheck, Mail, MapPin, Phone, Users, Sparkles, Cpu, Globe } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — CapaSolve" },
      { name: "description", content: "Learn more about CapaSolve, powered by Digital Biz Tech." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { language } = useTranslations();

  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-16 relative z-10">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-primary/10 text-primary">
              OUR MISSION
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            About CapaSolve
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            CapaSolve is a next-generation manufacturing constraint scheduling and timeline synchronization SaaS, engineered to eliminate shop floor bottlenecks and maximize OEE (Overall Equipment Effectiveness).
          </p>
        </div>

        {/* Company Ownership Details */}
        <div className="grid md:grid-cols-2 gap-8 items-center pt-4">
          <div className="space-y-6 text-left">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Corporate Core
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                CapaSolve is owned, developed, and maintained by **Digital Biz Tech**, a software solutions firm based in Dublin, Ohio. We build industrial automation algorithms and SaaS workflow platforms designed for medium-to-enterprise level manufacturing shop floors.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 items-center">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">565 Metro Pl S, Ste 300, Dublin, OH 43017</span>
              </div>
              <div className="flex gap-3 items-center">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">(614) 347-3250</span>
              </div>
              <div className="flex gap-3 items-center">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">info@digitalbiz.tech</span>
              </div>
              <div className="flex gap-3 items-center">
                <Globe className="h-4 w-4 text-primary shrink-0" />
                <a href="https://www.digitalbiz.tech/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  www.digitalbiz.tech
                </a>
              </div>
            </div>

            <Button asChild size="sm" className="cursor-pointer">
              <Link to="/contact">Contact Our Team</Link>
            </Button>
          </div>

          <div className="relative flex justify-center">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl pointer-events-none" />
            <img 
              src="/digitalbiz_Logo.jpg" 
              alt="Digital Biz Tech Logo" 
              className="max-h-32 object-contain rounded-2xl bg-white p-6 border border-border/60 shadow-lg relative z-10" 
            />
          </div>
        </div>

        {/* Core Values / Features */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-center text-foreground">Why Factories Rely on Us</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xs">
              <CardContent className="pt-6 space-y-3 text-left">
                <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit">
                  <Cpu className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Constraint Solvers</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Our advanced planning algorithm calculates setup times, machine availability, and operator capacities to optimize plans.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xs">
              <CardContent className="pt-6 space-y-3 text-left">
                <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Multi-Tenant Security</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Built on top of Supabase Row-Level Security (RLS) to guarantee complete data isolation and JWT verification on every save.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xs">
              <CardContent className="pt-6 space-y-3 text-left">
                <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit">
                  <Users className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Built for Teams</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Seamlessly collaborate with OEE managers, production line schedulers, and setup technicians under a single interface.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
