import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import { Factory, Eye, EyeOff } from "lucide-react";

import { neonAuth } from "@/lib/neon-auth";
import { neonDb } from "@/lib/neon";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — CapaSolve" },
      { name: "description", content: "Access your CapaSolve SaaS manufacturing dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { language } = useTranslations();
  const { setRole, setUser, setOrganization } = useAppStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await neonAuth.signIn(email, password);

      if (authError || !authData.user) {
        toast.error(authError?.message || "Authentication failed. Invalid email or password.");
        return;
      }

      setUser(authData.user as any);

      // Fetch organization membership details from Neon Postgres
      const memberData = await neonDb.getUserOrganization(authData.user.id);

      if (memberData) {
        setOrganization({
          id: memberData.org.id,
          name: memberData.org.name || "Company",
          plan: memberData.org.plan || "FREE",
        });
        setRole(memberData.role as any);
      } else {
        // Fallback for user with no organization membership yet
        setOrganization(null);
        setRole("GUEST");
      }

      toast.success(language === "de" ? "Erfolgreich angemeldet!" : "Successfully signed in!");

      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-grow py-16 px-6 bg-slate-50/50 dark:bg-slate-950">
      <Card className="w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xs rounded-2xl bg-white dark:bg-slate-900 z-10">
        <CardHeader className="space-y-2 text-center pt-8">
          <div className="flex justify-center">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200">
              <Factory className="h-5 w-5" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {language === "de" ? "Willkommen zurück" : "Welcome Back"}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {language === "de"
              ? "Melden Sie sich an, um Ihre Produktionspläne zu optimieren."
              : "Sign in to access your factory scheduler and optimization tools."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Address */}
            <div className="space-y-1">
              <Label
                htmlFor="email"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {language === "de" ? "E-Mail-Adresse" : "Email Address"}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. name@factory.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {language === "de" ? "Passwort" : "Password"}
                </Label>
                <Link
                  to="/forgot-password"
                  search={{}}
                  className="text-[11px] text-slate-600 dark:text-slate-400 hover:underline font-medium"
                >
                  {language === "de" ? "Passwort vergessen?" : "Forgot password?"}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full text-xs h-9 mt-5 cursor-pointer bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-semibold shadow-2xs"
            >
              {loading
                ? language === "de"
                  ? "Wird angemeldet..."
                  : "Signing In..."
                : language === "de"
                  ? "Anmelden"
                  : "Sign In"}
            </Button>
          </form>

          {/* Social Sign-In Mockups */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              {language === "de" ? "oder anmelden mit" : "or continue with"}
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

          {/* Call to Sign Up */}
          <div className="text-center text-xs text-slate-500 mt-3 pt-1">
            {language === "de" ? "Noch kein Konto?" : "Don't have an account?"}{" "}
            <Link
              to="/signup"
              className="text-slate-900 dark:text-white font-semibold underline underline-offset-2"
            >
              {language === "de" ? "Kostenlos registrieren" : "Sign Up Free"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
