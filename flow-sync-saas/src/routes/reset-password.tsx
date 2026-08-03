import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/translations";
import { updateUserPassword } from "@/lib/auth-service";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set New Password — CapaSolve" },
      { name: "description", content: "Set your new password for CapaSolve SaaS." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { language } = useTranslations();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      toast.error(language === "de" ? "Bitte füllen Sie alle Felder aus." : "Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      toast.error(language === "de" ? "Das Passwort muss mindestens 6 Zeichen lang sein." : "Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error(language === "de" ? "Die Passwörter stimmen nicht überein." : "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await updateUserPassword(password);
      toast.success(
        language === "de"
          ? "Passwort erfolgreich aktualisiert! Bitte melden Sie sich an."
          : "Password updated successfully! Please sign in."
      );
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
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
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {language === "de" ? "Neues Passwort festlegen" : "Set New Password"}
          </CardTitle>
          <CardDescription className="text-xs">
            {language === "de"
              ? "Geben Sie Ihr neues sicheres Passwort ein."
              : "Enter your new secure password for your account."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">
                {language === "de" ? "Neues Passwort" : "New Password"}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-xs bg-background pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-xs">
                {language === "de" ? "Passwort bestätigen" : "Confirm New Password"}
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-xs bg-background"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full text-xs h-10 mt-4 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 shadow">
              {loading
                ? (language === "de" ? "Wird aktualisiert..." : "Updating Password...")
                : (language === "de" ? "Passwort speichern" : "Update Password")}
            </Button>

            <div className="text-center pt-2">
              <Link to="/login" search={{}} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium">
                {language === "de" ? "Zurück zur Anmeldung" : "Back to Sign In"}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
