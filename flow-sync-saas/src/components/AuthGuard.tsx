import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePermissions, Role } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Mail, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: Role[];
  requiredPermission?: keyof ReturnType<typeof usePermissions>;
}

export function AuthGuard({ children, requiredRole, requiredPermission }: AuthGuardProps) {
  const permissions = usePermissions();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || "");
        // In local demo or if email_confirmed_at is present
        const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at || !user.email);
        setEmailVerified(confirmed);
      } else {
        // Guest mode fallback
        setEmailVerified(true);
      }
    });
  }, []);

  // 1. Email Verification Gate
  if (emailVerified === false) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-amber-500/30 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
              <Mail className="w-6 h-6 text-amber-500" />
            </div>
            <CardTitle className="text-xl">Verify Your Email Address</CardTitle>
            <CardDescription className="text-xs">
              We sent a verification link to{" "}
              <span className="font-semibold text-foreground">{userEmail}</span>. Please confirm
              your email before accessing production shop floor controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Button
              className="w-full"
              variant="outline"
              onClick={async () => {
                if (userEmail) {
                  await supabase.auth.resend({ type: "signup", email: userEmail });
                }
              }}
            >
              Resend Verification Email
            </Button>
            <div className="text-center">
              <Link
                to="/"
                className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
              >
                Return to Home <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Role-Based Access Control (RBAC) Gate
  if (requiredRole && requiredRole.length > 0 && !requiredRole.includes(permissions.role)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/30 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Access Restricted</CardTitle>
            <CardDescription className="text-xs">
              Your role (<span className="font-bold text-foreground">{permissions.role}</span>) does
              not have permission to view or execute actions on this workstation view.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Required role: {requiredRole.join(" or ")}. Contact your factory admin to request
              elevated permissions.
            </p>
            <Link to="/">
              <Button variant="secondary" className="w-full mt-2">
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Permission-Based Access Gate
  if (requiredPermission && !permissions[requiredPermission]) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/30 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Permission Required</CardTitle>
            <CardDescription className="text-xs">
              You lack the specific entitlement:{" "}
              <span className="font-mono text-xs">{String(requiredPermission)}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-center">
            <Link to="/">
              <Button variant="secondary" className="w-full">
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
