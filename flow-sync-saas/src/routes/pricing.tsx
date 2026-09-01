import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/translations";
import { Check, HelpCircle, ChevronDown, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing Tiers — CapaSolve" },
      {
        name: "description",
        content: "Select a plan tailored to your factory capacity and optimization needs.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { language } = useTranslations();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annually">("monthly");

  // FAQ toggle state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Pricing English & German dictionary
  const text = {
    en: {
      title: "Simple, Tailored Pricing",
      subtitle:
        "Flexible subscription plans designed to scale with your production capacity and team size.",
      monthly: "Monthly Billing",
      annually: "Annual Billing (Save 20%)",
      freeTitle: "Free Trial",
      freeDesc: "Experience automated constraint scheduling for your plant.",
      freePrice: "Free",
      freePeriod: "for 30 days",
      freeCTA: "Start Free Trial",
      proTitle: "Growth Pro",
      proDesc: "For scaling factories requiring full integration and collaboration.",
      proPrice: "Flexible",
      proPeriod: "tailored to your scale",
      proCTA: "Request Quote",
      entTitle: "Enterprise",
      entDesc: "For multi-site manufacturers needing custom models and compliance.",
      entPrice: "Custom",
      entPeriod: "dedicated agreement",
      entCTA: "Contact Sales",
      popular: "Most Popular",

      // Features
      features: "Included Features",
      fHorizon: "1-Month optimization horizon",
      fHorizonUn: "Unlimited scheduling horizon",
      fDevSeat: "1 Developer seat",
      fTeamSeats: "Up to 5 Team seats",
      fAllSeats: "Unlimited Team seats",
      fConstraints: "1 Constraint",
      fAdvConstraints: "Advanced constraint rules",
      fCloudSync: "Cloud storage integration",
      fAPI: "API access & webhooks",
      fSupport: "Standard email support",
      fPrioritySupport: "24/7 Priority support",
      fSLA: "Dedicated SLA & hosting",

      // Compare Title
      compareTitle: "Detailed Plan Comparison",
      faqTitle: "Frequently Asked Questions",

      // FAQs
      q1: "What counts as a 'Developer' vs an 'Admin' seat?",
      a1: "Developers are users who can modify order spreadsheets, run the optimization engine, and change machine capacity ceilings. Admins can manage team invitations, switch plans, and configure billing. Guests are read-only and do not consume paid seats.",
      q2: "How is the Growth Pro plan priced?",
      a2: "Our pricing is flexible and scales based on the number of active machines and production lines in your facility. This ensures small machine shops pay a fraction of what large industrial assembly plants pay. Contact us to receive a custom proposal.",
      q3: "Can we test the role access system during the trial?",
      a3: "Yes! The free trial includes full access to the role simulation. You can switch between Admin, Developer, and Guest roles at any time in the sidebar of the workspace to experience the access control system first-hand.",
    },
    de: {
      title: "Einfache, maßgeschneiderte Tarife",
      subtitle:
        "Flexible Abonnements, die sich an Ihre Produktionskapazität und Teamgröße anpassen.",
      monthly: "Monatliche Abrechnung",
      annually: "Jährliche Abrechnung (20% Jährlich Sparen)",
      freeTitle: "Kostenloser Test",
      freeDesc: "Erleben Sie die automatisierte Restriktionsplanung für Ihr Werk.",
      freePrice: "Kostenlos",
      freePeriod: "für 30 Tage",
      freeCTA: "Kostenlos testen",
      proTitle: "Wachstum Pro",
      proDesc:
        "Für wachsende Fabriken, die eine vollständige Integration und Zusammenarbeit benötigen.",
      proPrice: "Flexibel",
      proPeriod: "an Ihre Größe angepasst",
      proCTA: "Angebot anfordern",
      entTitle: "Enterprise",
      entDesc: "Für Hersteller mit mehreren Standorten, die kundenspezifische Modelle benötigen.",
      entPrice: "Individuell",
      entPeriod: "eigener Vertrag",
      entCTA: "Vertrieb kontaktieren",
      popular: "Beliebtest",

      // Features
      features: "Enthaltene Funktionen",
      fHorizon: "1 Monat Optimierungsfenster",
      fHorizonUn: "Unbegrenztes Optimierungsfenster",
      fDevSeat: "1 Entwickler-Zugang",
      fTeamSeats: "Bis zu 5 Team-Zugänge",
      fAllSeats: "Unbegrenzte Team-Zugänge",
      fConstraints: "1 Restriktion",
      fAdvConstraints: "Erweiterte Planungsregeln",
      fCloudSync: "Cloud-Speicher-Integration",
      fAPI: "API-Zugang & Webhooks",
      fSupport: "Standard-E-Mail-Support",
      fPrioritySupport: "24/7 Prioritäts-Support",
      fSLA: "Eigenes SLA & Hosting",

      // Compare Title
      compareTitle: "Detaillierter Tarifvergleich",
      faqTitle: "Häufig gestellte Fragen",

      // FAQs
      q1: "Was ist der Unterschied zwischen einem Entwickler- und einem Admin-Zugang?",
      a1: "Entwickler sind Benutzer, die Aufträge bearbeiten, die Optimierung starten und Kapazitäten ändern können. Admins verwalten Teameinladungen, Abonnements und Abrechnungen. Gäste haben Lesezugriff und benötigen keine kostenpflichtigen Lizenzen.",
      q2: "Wie berechnet sich der Preis für den Wachstum Pro Tarif?",
      a2: "Unsere Preise sind flexibel und richten sich nach der Anzahl der aktiven Maschinen und Produktionslinien in Ihrem Werk. So zahlen kleine Werkstätten nur einen Bruchteil dessen, was große Montagewerke zahlen. Kontaktieren Sie uns für ein Angebot.",
      q3: "Können wir das Rollen-Zugriffssystem während des Tests ausprobieren?",
      a3: "Ja! Der kostenlose Test beinhaltet den vollen Zugriff auf die Rollensimulation. Sie können in der Sidebar des Arbeitsbereichs jederzeit zwischen Admin, Entwickler und Gast wechseln, um die Berechtigungen live zu testen.",
    },
  };

  const str = language === "de" ? text.de : text.en;

  const faqItems = [
    { q: str.q1, a: str.a1 },
    { q: str.q2, a: str.a2 },
    { q: str.q3, a: str.a3 },
  ];

  return (
    <div className="space-y-16 max-w-6xl mx-auto py-12 px-6">
      {/* Page Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
          {str.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
          {str.subtitle}
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Free Plan */}
        <Card className="border border-border/60 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative bg-card/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold">{str.freeTitle}</CardTitle>
            <CardDescription className="text-xs min-h-[32px]">{str.freeDesc}</CardDescription>
            <div className="pt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight">{str.freePrice}</span>
              <span className="text-xs text-muted-foreground">/ {str.freePeriod}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-grow border-t border-border/40 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {str.features}
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {str.fHorizon}
              </li>
              <li className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {str.fConstraints}
              </li>
            </ul>
          </CardContent>
          <CardFooter className="pt-2">
            <Button asChild className="w-full text-xs cursor-pointer" variant="outline">
              <Link to="/signup">{str.freeCTA}</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Enterprise Plan */}
        <Card className="border border-border/60 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative bg-card/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold">{str.entTitle}</CardTitle>
            <CardDescription className="text-xs min-h-[32px]">{str.entDesc}</CardDescription>
            <div className="pt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight">{str.entPrice}</span>
              <span className="text-xs text-muted-foreground">/ {str.entPeriod}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-grow border-t border-border/40 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {str.features}
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {str.fHorizonUn}
              </li>
              <li className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {str.fAllSeats}
              </li>
              <li className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {str.fAdvConstraints}
              </li>
              <li className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {str.fCloudSync}
              </li>
              <li className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {str.fAPI}
              </li>
            </ul>
          </CardContent>
          <CardFooter className="pt-2">
            <Button asChild className="w-full text-xs cursor-pointer" variant="outline">
              <Link to="/signup">{str.entCTA}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Comparison Grid Table */}
      <div className="space-y-6 pt-8 hidden sm:block">
        <h3 className="text-xl font-bold tracking-tight text-center">{str.compareTitle}</h3>
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse text-left text-xs bg-card">
            <thead>
              <tr className="bg-muted/50 border-b border-border font-bold">
                <th className="p-4 w-1/3">Feature</th>
                <th className="p-4 w-1/3">Free</th>
                <th className="p-4 w-1/3">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-4 font-semibold">Optimization horizon</td>
                <td className="p-4 text-muted-foreground">30 Days (1 month)</td>
                <td className="p-4 text-foreground">Unlimited</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Developer seats included</td>
                <td className="p-4 text-muted-foreground">1 Dev</td>
                <td className="p-4 text-foreground">Unlimited</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Constraint-based Scheduling</td>
                <td className="p-4 text-muted-foreground">Basic limits</td>
                <td className="p-4 text-foreground">Custom constraints</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Supabase cloud sync</td>
                <td className="p-4 text-muted-foreground">No</td>
                <td className="p-4 text-foreground">Yes</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">API integrations</td>
                <td className="p-4 text-muted-foreground">No</td>
                <td className="p-4 text-foreground">Yes</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Dedicated deployment</td>
                <td className="p-4 text-muted-foreground">No</td>
                <td className="p-4 text-foreground">Yes (SLA active)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQs Section */}
      <div className="space-y-6 max-w-3xl mx-auto pt-8">
        <h3 className="text-xl font-bold tracking-tight text-center">{str.faqTitle}</h3>
        <div className="divide-y divide-border/60 border rounded-xl overflow-hidden bg-card shadow-sm">
          {faqItems.map((faq, idx) => (
            <div key={idx} className="bg-background">
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between p-5 text-left text-xs font-bold text-foreground hover:bg-muted/10 transition-colors outline-none cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  {faq.q}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    openFaq === idx && "rotate-180",
                  )}
                />
              </button>
              {openFaq === idx && (
                <div className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-border/20 bg-muted/5 animate-fade-in">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Custom Quote Request Banner */}
      <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 max-w-4xl mx-auto mt-8">
        <div className="flex gap-4 items-start text-left">
          <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">
              Need a custom integration or have more than 50 machines?
            </h4>
            <p className="text-xs text-muted-foreground mt-1 leading-normal">
              Our engineering team builds custom constraint solver rules to model specific factory
              flows, parent orders, and material requirements.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 cursor-pointer">
          <Link to="/signup">{str.entCTA}</Link>
        </Button>
      </div>
    </div>
  );
}
