import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import { Factory, Rocket } from "lucide-react";

import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Start Free Trial — CapaSolve" },
      {
        name: "description",
        content: "Create your CapaSolve account and optimize your factory processes.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { language } = useTranslations();
  const { setRole, setUser, setOrganization } = useAppStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [machines, setMachines] = useState("10");
  const [signupRole, setSignupRole] = useState<"ADMIN" | "DEVELOPER">("ADMIN");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !company) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            company_name: company,
            signup_role: signupRole,
          },
        },
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (!authData.user) {
        toast.error("Signup failed.");
        return;
      }

      setUser(authData.user);

      // If session is active (email verification disabled in Supabase dashboard)
      if (authData.session) {
        try {
          const slug = company
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");
          const { data: orgData, error: orgError } = await supabase
            .from("organizations")
            .insert({ name: company, slug, plan: "FREE" })
            .select()
            .single();

          if (orgError) throw orgError;

          if (orgData) {
            const { error: memError } = await supabase.from("organization_members").insert({
              org_id: orgData.id,
              user_id: authData.user.id,
              role: signupRole,
            });

            if (memError) throw memError;

            setOrganization({
              id: orgData.id,
              name: orgData.name,
              plan: orgData.plan as any,
            });
            setRole(signupRole);
          }
        } catch (dbErr: any) {
          console.error("Error creating organization records:", dbErr);
        }

        toast.success(
          language === "de"
            ? `Konto für ${company} erstellt! Sie wurden als ${signupRole === "DEVELOPER" ? "Entwickler" : signupRole} angemeldet.`
            : `Account created for ${company}! Signed in as ${signupRole === "DEVELOPER" ? "Developer" : signupRole}.`,
        );
        navigate({ to: "/dashboard" });
      } else {
        toast.success(
          language === "de"
            ? "Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mail zur Bestätigung."
            : "Registration successful! Please check your email to confirm your account.",
        );
        navigate({ to: "/login" });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-grow py-16 px-6 bg-slate-50/50 dark:bg-slate-950">
      <Card className="w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xs rounded-2xl bg-white dark:bg-slate-900 z-10">
        <CardHeader className="space-y-2 text-center pt-8">
          <div className="flex justify-center">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200">
              <Rocket className="h-5 w-5" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {language === "de" ? "Kostenlos registrieren" : "Start Your Free Trial"}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {language === "de"
              ? "Erstellen Sie ein Demokonto, um die Produktionsplaner-SaaS zu testen."
              : "Get 30 days of free scheduling trial for your manufacturing organization."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Name */}
              <div className="space-y-1">
                <Label
                  htmlFor="signup-name"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {language === "de" ? "Ihr Name" : "Your Name"} *
                </Label>
                <Input
                  id="signup-name"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <Label
                  htmlFor="signup-email"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {language === "de" ? "E-Mail-Adresse" : "Email Address"} *
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="e.g. name@factory.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label
                htmlFor="signup-password"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {language === "de" ? "Passwort" : "Password"} *
              </Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Company Name */}
              <div className="space-y-1">
                <Label
                  htmlFor="signup-company"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {language === "de" ? "Firmenname" : "Company Name"} *
                </Label>
                <Input
                  id="signup-company"
                  placeholder="e.g. Tesla Giga Berlin"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              {/* Estimate Machines */}
              <div className="space-y-1">
                <Label
                  htmlFor="signup-machines"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {language === "de" ? "Anzahl der Maschinen" : "Estimated Machines"}
                </Label>
                <select
                  id="signup-machines"
                  value={machines}
                  onChange={(e) => setMachines(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1 text-xs h-8 outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer text-slate-800 dark:text-slate-200"
                >
                  <option value="1-5">1 - 5 machines</option>
                  <option value="5-20">5 - 20 machines</option>
                  <option value="20-100">20 - 100 machines</option>
                  <option value="100+">100+ machines</option>
                </select>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-1">
              <Label
                htmlFor="signup-role"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {language === "de" ? "Ihre Rolle im Demo-Account" : "Your Role in the Demo Account"}
              </Label>
              <select
                id="signup-role"
                value={signupRole}
                onChange={(e) => setSignupRole(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1 text-xs h-8 outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="ADMIN">Admin (Invite team members and manage plan)</option>
                <option value="DEVELOPER">Developer (Run optimizations and edit schedule)</option>
              </select>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full text-xs h-9 mt-5 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-semibold shadow-2xs"
            >
              {loading
                ? language === "de"
                  ? "Registrierung läuft..."
                  : "Creating Account..."
                : language === "de"
                  ? "Registrierung abschließen"
                  : "Create Account & Start Trial"}
            </Button>

            {/* Direct Quick Access Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUser({
                  id: "demo-test-user-id",
                  email: "demo@factory.com",
                  user_metadata: { full_name: "Demo Operator" },
                });
                setOrganization({
                  id: "demo-test-org-id",
                  name: "Demo Test Factory Organization",
                  plan: "PRO",
                });
                setRole(signupRole);
                toast.success(
                  language === "de"
                    ? `Schnellzugriff aktiv: Anmeldung als ${signupRole}...`
                    : `Quick Access active. Signed in as ${signupRole}...`,
                );
                navigate({ to: "/dashboard" });
              }}
              className="w-full text-xs h-9 mt-2 cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
            >
              {language === "de"
                ? "Schnellzugriff (Direkt zur App)"
                : "Quick Access (Direct to App)"}
            </Button>
          </form>

          {/* Social Sign-In Mockups */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              {language === "de" ? "oder registrieren mit" : "or continue with"}
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="text-xs h-8 cursor-pointer gap-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              onClick={async () => {
                try {
                  const { signInWithOAuthProvider } = await import("@/lib/auth-service");
                  await signInWithOAuthProvider("google");
                } catch (err: any) {
                  toast.error(err.message || "Google OAuth initialization failed.");
                }
              }}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="text-xs h-8 cursor-pointer gap-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              onClick={async () => {
                try {
                  const { signInWithOAuthProvider } = await import("@/lib/auth-service");
                  await signInWithOAuthProvider("azure");
                } catch (err: any) {
                  toast.error(err.message || "Microsoft OAuth initialization failed.");
                }
              }}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 23 23" fill="currentColor">
                <rect x="0" y="0" width="11" height="11" fill="#f25022" />
                <rect x="12" y="0" width="11" height="11" fill="#7fba00" />
                <rect x="0" y="12" width="11" height="11" fill="#00a4ef" />
                <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
              </svg>
              Microsoft
            </Button>
          </div>

          {/* Call to Sign In */}
          <div className="text-center text-xs text-slate-500 mt-3 pt-1">
            {language === "de" ? "Bereits ein Konto?" : "Already have an account?"}{" "}
            <Link
              to="/login"
              className="text-slate-900 dark:text-white font-semibold underline underline-offset-2"
            >
              {language === "de" ? "Einloggen" : "Sign In"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
