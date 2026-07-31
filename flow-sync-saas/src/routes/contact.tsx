import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslations } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Phone, MapPin, Send, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import MarketingLayout from "@/components/MarketingLayout";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — CapaSolve" },
      { name: "description", content: "Get in touch with CapaSolve support and sales team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { language } = useTranslations();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSending(true);
    setTimeout(() => {
      toast.success(
        language === "de"
          ? "Nachricht erfolgreich gesendet! Unser Team wird sich in Kürze bei Ihnen melden."
          : "Message sent successfully! Our team will contact you shortly."
      );
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setSending(false);
    }, 1000);
  };

  return (
    <div className="flex-1 py-16 px-6 relative bg-gradient-to-b from-background via-muted/10 to-background">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-5xl mx-auto space-y-12 relative z-10">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            {language === "de" ? "Kontaktieren Sie uns" : "Get in Touch"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
            {language === "de"
              ? "Haben Sie Fragen zur Planungsoptimierung oder benötigen Sie Support? Wir sind für Sie da."
              : "Have questions about scheduling rules or enterprise pricing? Write to us."}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact Details Cards */}
          <div className="md:col-span-1 space-y-4">
            <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
              <CardContent className="pt-6 flex gap-4 items-start">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Email Us</h4>
                  <a href="mailto:info@digitalbiz.tech" className="text-xs text-primary font-medium hover:underline block mt-1">
                    info@digitalbiz.tech
                  </a>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">Response within 12 hours</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
              <CardContent className="pt-6 flex gap-4 items-start">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Call Us</h4>
                  <a href="tel:+16143473250" className="text-xs text-foreground/80 hover:text-primary font-medium block mt-1">
                    (614) 347-3250
                  </a>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">Mon - Fri, 9am - 5pm EST</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
              <CardContent className="pt-6 flex gap-4 items-start">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Headquarters</h4>
                  <div className="text-xs text-muted-foreground block mt-1 leading-relaxed">
                    <p className="font-bold text-foreground">Digital Biz Tech</p>
                    <p>565 Metro Pl S, Ste 300</p>
                    <p>Dublin, OH 43017</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form Card */}
          <div className="md:col-span-2">
            <Card className="border-border/80 bg-card/90 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
              <CardHeader>
                <CardTitle className="text-lg font-bold">
                  {language === "de" ? "Nachricht senden" : "Send us a Message"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === "de"
                    ? "Schreiben Sie uns Ihr Anliegen und wir antworten Ihnen schnellstmöglich."
                    : "Fill out the contact form below and our team will get back to you shortly."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="contact-name" className="text-xs">Your Name *</Label>
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="text-xs bg-background"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="contact-email" className="text-xs">Email Address *</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. name@factory.com"
                        className="text-xs bg-background"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="contact-subject" className="text-xs">Subject</Label>
                    <Input
                      id="contact-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Constraint solver questions"
                      className="text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="contact-message" className="text-xs">Message *</Label>
                    <Textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your request details here..."
                      className="text-xs min-h-[120px] bg-background"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={sending} className="w-full text-xs h-10 gap-2 cursor-pointer">
                    <Send className="h-3.5 w-3.5" />
                    {sending ? "Sending Message..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
