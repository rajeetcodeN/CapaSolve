import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { neonAuth } from "@/lib/neon-auth";
import { syncUserSession } from "@/lib/auth-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, Factory } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Authenticating — CapaSolve" },
      { name: "description", content: "Completing authentication for CapaSolve." },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      try {
        if (typeof window === "undefined") return;

        const url = new URL(window.location.href);
        const searchParams = url.searchParams;
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

        // Check for error returned by OAuth provider
        const error = searchParams.get("error") || hashParams.get("error");
        const errorDescription =
          searchParams.get("error_description") || hashParams.get("error_description");

        if (error) {
          throw new Error(errorDescription || `Authentication error: ${error}`);
        }

        // Sync session with CapaSolve app state (user, org, role in Neon)
        const user = await syncUserSession();
        if (!user) {
          // If not established yet, create default trial user
          const { data } = await neonAuth.getSession();
          if (!data.session) {
            await neonAuth.signUp("operator@capasolve.com", "temporary-pass", {
              full_name: "Demo Operator",
              company_name: "CapaSolve Operations",
            });
            await syncUserSession();
          }
        }
        if (!user) {
          throw new Error("Failed to initialize organization workspace for this user.");
        }

        if (isMounted) {
          setStatus("success");
          // Small delay for smooth UX transition
          setTimeout(() => {
            navigate({ to: "/dashboard" });
          }, 600);
        }
      } catch (err: any) {
        console.error("Auth callback processing failed:", err);
        if (isMounted) {
          setStatus("error");
          setErrorMessage(err.message || "Failed to complete authentication with Google.");
        }
      }
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-16 px-6 bg-slate-50/50 dark:bg-slate-950">
      <Card className="w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900">
        <CardHeader className="space-y-2 text-center pt-8">
          <div className="flex justify-center">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200">
              <Factory className="h-6 w-6 text-slate-800 dark:text-slate-100" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {status === "loading" && "Authenticating..."}
            {status === "success" && "Signed In Successfully!"}
            {status === "error" && "Sign In Failed"}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {status === "loading" && "Finalizing your secure session with CapaSolve."}
            {status === "success" && "Redirecting you to your production workspace..."}
            {status === "error" && "We could not verify your Google account credentials."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-8 text-center">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-700 dark:text-slate-300" />
              <p className="text-xs text-slate-500">Exchanging credentials with Neon Auth...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Authentication verified. Redirecting now...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-left">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-700 dark:text-rose-300">
                  <p className="font-semibold">Authentication Error</p>
                  <p className="mt-1 break-words">{errorMessage}</p>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button asChild className="w-full text-xs h-9">
                  <Link to="/login">Return to Sign In</Link>
                </Button>
                <Button asChild variant="outline" className="w-full text-xs h-9">
                  <Link to="/support">Contact Support</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
