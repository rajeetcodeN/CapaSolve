import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { neonAuth } from "@/lib/neon-auth";
import { neonDb } from "@/lib/neon";
import { useAppStore } from "@/lib/store";
import { syncUserSession, signInWithOAuthProvider } from "@/lib/auth-service";
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

        // 1. Sync session with CapaSolve app state
        let user = await syncUserSession(true);

        // 2. Direct Neon Auth session retrieval
        if (!user) {
          const { data } = await neonAuth.getSession(true);
          if (data?.session) {
            user = await syncUserSession(true);
          }
        }

        // 3. Resilient server-side verification: Reconcile active OAuth session from Neon Postgres
        if (!user) {
          try {
            const { verifyOAuthCallbackServerFn } = await import("@/lib/auth.server");
            const tokenParam = searchParams.get("token") || hashParams.get("token") || undefined;
            const res = await verifyOAuthCallbackServerFn({ data: { token: tokenParam } });
            if (res?.success && res?.session) {
              localStorage.setItem("capasolve_neon_session", JSON.stringify(res.session));
              user = await syncUserSession(true);
            }
          } catch (serverErr) {
            console.warn("[AuthCallback] Server session reconciliation:", serverErr);
          }
        }

        if (!user) {
          throw new Error("Unable to verify an active user session. Please try signing in again.");
        }

        // Check if an invitation was attached to this session
        const inviteToken = searchParams.get("invite") || hashParams.get("invite");
        if (inviteToken && user?.id) {
          try {
            const accepted = await neonDb.acceptInvitation(inviteToken, user.id);
            if (accepted) {
              useAppStore.getState().setOrganization({
                id: accepted.orgId,
                name: accepted.orgName,
                plan: "FREE",
              });
              useAppStore.getState().setRole(accepted.role as any);
            }
          } catch (invErr) {
            console.warn("Could not process invite on callback:", invErr);
          }
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
                <Button
                  onClick={() => signInWithOAuthProvider("google")}
                  className="w-full text-xs h-9 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800"
                >
                  <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continue with Google
                </Button>
                <Button asChild variant="outline" className="w-full text-xs h-9">
                  <Link to="/login">Return to Sign In</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full text-xs h-8 text-slate-500">
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
