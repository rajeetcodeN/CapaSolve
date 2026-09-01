import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/translations";
import { sendPasswordResetEmail } from "@/lib/auth-service";
import { toast } from "sonner";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — CapaSolve" },
      { name: "description", content: "Reset your CapaSolve SaaS user password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { language } = useTranslations();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(
        language === "de"
          ? "Bitte geben Sie eine E-Mail-Adresse ein."
          : "Please enter an email address.",
      );
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(email);
      setSubmitted(true);
      toast.success(
        language === "de"
          ? "Passwort-Zurücksetzungs-Link gesendet! Prüfen Sie Ihren Posteingang."
          : "Password reset link sent! Check your inbox.",
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-grow py-16 px-6 relative overflow-hidden bg-gradient-to-b from-background via-muted/10 to-background">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <Card className="w-full max-w-md border border-border/80 shadow-2xl relative overflow-hidden backdrop-blur-md bg-card/95 z-10">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-indigo-600" />

        <CardHeader className="space-y-2 text-center pt-8">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-xs">
              <KeyRound className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {language === "de" ? "Passwort zurücksetzen" : "Reset Password"}
          </CardTitle>
          <CardDescription className="text-xs">
            {language === "de"
              ? "Geben Sie Ihre registrierte E-Mail-Adresse ein, um einen Wiederherstellungslink zu erhalten."
              : "Enter your registered email address to receive a password reset recovery link."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {submitted ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-semibold text-foreground">
                {language === "de" ? "Wiederherstellungs-E-Mail gesendet!" : "Recovery Email Sent!"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {language === "de"
                  ? `Wir haben Anweisungen zum Zurücksetzen des Passworts an ${email} gesendet.`
                  : `We have sent password reset instructions to ${email}. Please check your inbox and spam folder.`}
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  search={{}}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {language === "de" ? "Zurück zur Anmeldung" : "Back to Sign In"}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">
                  {language === "de" ? "E-Mail-Adresse" : "Email Address"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. planner@factory.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs bg-background"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full text-xs h-10 mt-4 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 shadow"
              >
                {loading
                  ? language === "de"
                    ? "Wird gesendet..."
                    : "Sending Link..."
                  : language === "de"
                    ? "Zurücksetzungs-Link senden"
                    : "Send Reset Link"}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  search={{}}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {language === "de" ? "Zurück zur Anmeldung" : "Back to Sign In"}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
