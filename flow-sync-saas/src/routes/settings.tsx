import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import {
  Globe,
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  CloudUpload,
  CloudDownload,
  Send,
  User,
  UserCheck,
  Sliders,
  Plus,
  Trash2,
  Clock,
  Layers,
} from "lucide-react";
import { SetupMatrixConfig } from "@/components/SetupMatrixConfig";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Manage Organization — MFG Scheduler" },
      {
        name: "description",
        content: "Manage your company profile, database synchronization, and support channels.",
      },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { language } = useTranslations();
  const {
    role,
    saveToCloud,
    loadFromCloud,
    isCloudSaving,
    isCloudLoading,
    orders,
    processes,
    user,
    setUser,
    setupMatrixRules,
    addSetupMatrixRule,
    deleteSetupMatrixRule,
    machineGroups,
  } = useAppStore();

  const [userName, setUserName] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  // Setup Matrix Form State
  const [fromMat, setFromMat] = useState("*");
  const [toMat, setToMat] = useState("*");
  const [setupTime, setSetupTime] = useState(15);
  const [ruleDesc, setRuleDesc] = useState("");

  // Sync local username state when user metadata loads
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setUserName(user.user_metadata.full_name);
    } else if (user?.email) {
      setUserName(user.email.split("@")[0]);
    } else {
      setUserName("Factory Operator");
    }
  }, [user]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    if (user) {
      setUser({
        ...user,
        user_metadata: {
          ...user.user_metadata,
          full_name: userName,
        },
      });
      toast.success(
        language === "de"
          ? "Benutzerprofil erfolgreich aktualisiert!"
          : "User profile updated successfully!",
      );
    } else {
      toast.error("No active user session found to update.");
    }
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    toast.success(
      language === "de"
        ? "Vielen Dank! Ihre Rückmeldung wurde an Digital Biz Tech übermittelt."
        : "Thank you! Your feedback has been sent to Digital Biz Tech.",
    );
    setFeedbackText("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Streamlined Header */}
      <div className="border-b border-border/60 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          {language === "de" ? "Organisation & Einstellungen" : "Organization Settings & Profile"}
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          {language === "de"
            ? "Verwalten Sie Ihr Firmenprofil, Ihr Benutzerkonto und Ihre Cloud-Synchronisation."
            : "Manage your company profile, user account details, database synchronization, and support channels."}
        </p>
      </div>

      {/* Stacked Cards Section — One Below The Other */}
      <div className="space-y-6 flex flex-col w-full">
        {/* Sequence-Dependent Setup Matrix Config */}
        <SetupMatrixConfig />

        {/* Block 1: User Profile Management */}
        <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-foreground border-b border-border/50 pb-3">
            <User className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <span>{language === "de" ? "Benutzerprofil" : "User Profile"}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {language === "de"
                  ? "Verwalten Sie Ihre Kontodaten und Berechtigungen."
                  : "Manage your account identity details and system access permissions."}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs font-semibold text-muted-foreground">
                Full Name
              </Label>
              <Input
                id="profile-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. John Operator"
                className="text-xs bg-background h-9 rounded-xl border-border focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="profile-email"
                className="text-xs font-semibold text-muted-foreground"
              >
                Email Address
              </Label>
              <Input
                id="profile-email"
                value={user?.email || "demo@factory.com"}
                className="text-xs bg-muted/40 h-9 rounded-xl border-border text-muted-foreground"
                disabled
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-role" className="text-xs font-semibold text-muted-foreground">
                System Role
              </Label>
              <Input
                id="profile-role"
                value={role === "DEVELOPER" ? "Developer" : role}
                className="text-xs bg-muted/40 h-9 rounded-xl border-border text-muted-foreground font-semibold uppercase"
                disabled
              />
            </div>

            <div className="sm:col-span-3 flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!user?.email) {
                    toast.error("No email associated with current user.");
                    return;
                  }
                  try {
                    const { sendPasswordResetEmail } = await import("@/lib/auth-service");
                    await sendPasswordResetEmail(user.email);
                    toast.success(
                      language === "de"
                        ? "Passwort-Zurücksetzungs-E-Mail gesendet!"
                        : "Password reset email sent!",
                    );
                  } catch (err: any) {
                    toast.error(err.message || "Failed to send reset email.");
                  }
                }}
                className="text-xs h-9 px-4 gap-1.5 cursor-pointer rounded-xl border-border hover:bg-accent"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>
                  {language === "de"
                    ? "Passwort-Zurücksetzungs-E-Mail senden"
                    : "Send Password Reset Link"}
                </span>
              </Button>

              <Button
                type="submit"
                size="sm"
                className="text-xs h-9 px-6 gap-1.5 cursor-pointer shadow-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/95"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>{language === "de" ? "Profil speichern" : "Save Profile"}</span>
              </Button>
            </div>
          </form>
        </div>

        {/* Block 2: Cloud Sync Option */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <CloudUpload className="h-5 w-5 text-slate-400" />
              <div className="flex flex-col">
                <span>{language === "de" ? "Cloud-Synchronisation" : "Cloud Sync Option"}</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {language === "de"
                    ? "Sichern Sie Planungsdaten in der Supabase-Cloud."
                    : "Backup and restore planning schedules to Supabase secure database."}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>Database Connected</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <Button
              onClick={() => {
                if (role !== "DEVELOPER" && role !== "ADMIN") {
                  toast.error("Access Denied: Only Developers or Admins can save data to cloud.");
                  return;
                }
                saveToCloud();
              }}
              disabled={isCloudSaving || isCloudLoading}
              className="w-full text-xs h-9 cursor-pointer gap-2 bg-slate-800 hover:bg-slate-700 text-white shadow-xs border border-slate-700/60 rounded-xl font-medium"
            >
              <CloudUpload className={`h-4 w-4 shrink-0 ${isCloudSaving && "animate-bounce"}`} />
              <span>{isCloudSaving ? "Saving to Cloud..." : "Save Cloud Backup"}</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                if (role !== "DEVELOPER" && role !== "ADMIN") {
                  toast.error("Access Denied: Only Developers or Admins can load data from cloud.");
                  return;
                }
                loadFromCloud();
              }}
              disabled={isCloudSaving || isCloudLoading}
              className="w-full text-xs h-9 cursor-pointer gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl font-medium text-slate-700 dark:text-slate-300"
            >
              <CloudDownload className={`h-4 w-4 shrink-0 ${isCloudLoading && "animate-spin"}`} />
              <span>{isCloudLoading ? "Loading from Cloud..." : "Load Cloud Backup"}</span>
            </Button>
          </div>
        </div>

        {/* Block: Sequence-Dependent Setup Matrix (Changeover Optimizer) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
            <Sliders className="h-5 w-5 text-slate-400" />
            <div className="flex flex-col">
              <span>Sequence-Dependent Setup Matrix (Changeover Time Optimizer)</span>
              <span className="text-[11px] font-normal text-slate-500">
                Define dynamic setup changeover times based on material transitions on workstations.
              </span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSetupMatrixRule({
                fromMaterial: fromMat,
                toMaterial: toMat,
                setupTimeMin: Number(setupTime) || 15,
                description: ruleDesc || `Transition ${fromMat} → ${toMat}`,
              });
              toast.success("Added setup matrix transition rule!");
              setRuleDesc("");
            }}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1 text-xs"
          >
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                From Material
              </Label>
              <Input
                value={fromMat}
                onChange={(e) => setFromMat(e.target.value)}
                placeholder="* or Material A"
                className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                To Material
              </Label>
              <Input
                value={toMat}
                onChange={(e) => setToMat(e.target.value)}
                placeholder="* or Material B"
                className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Setup Time (min)
              </Label>
              <Input
                type="number"
                value={setupTime}
                onChange={(e) => setSetupTime(Number(e.target.value))}
                className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Description / Notes
              </Label>
              <div className="flex gap-2">
                <Input
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  placeholder="e.g. Mold Cleanout / Color Purge"
                  className="h-8 text-xs flex-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-white font-medium shrink-0 shadow-xs border border-slate-700/60"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
                </Button>
              </div>
            </div>
          </form>

          {/* Active Rules List */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                  <th className="p-2.5 font-semibold">From</th>
                  <th className="p-2.5 font-semibold">To</th>
                  <th className="p-2.5 font-semibold font-mono">Setup Time</th>
                  <th className="p-2.5 font-semibold">Description</th>
                  <th className="p-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(setupMatrixRules || []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-850 text-xs">
                    <td className="p-2.5 font-mono text-slate-900 dark:text-white font-semibold">
                      {r.fromMaterial}
                    </td>
                    <td className="p-2.5 font-mono text-slate-900 dark:text-white font-semibold">
                      {r.toMaterial}
                    </td>
                    <td className="p-2.5 font-mono font-semibold text-slate-900 dark:text-white">
                      {r.setupTimeMin} min
                    </td>
                    <td className="p-2.5 text-slate-500">{r.description || "-"}</td>
                    <td className="p-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSetupMatrixRule(r.id)}
                        className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Block 3: About & Company Info */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
            <Building2 className="h-5 w-5 text-slate-400" />
            <div className="flex flex-col">
              <span>{language === "de" ? "Über & Kontakt" : "About & Contact"}</span>
              <span className="text-[11px] font-normal text-slate-500">
                {language === "de"
                  ? "Unternehmensinformationen und Systemstatus."
                  : "Company details and system diagnostics."}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 bg-white p-1.5 shrink-0 shadow-2xs">
                  <img
                    src="/digitalbiz_Logo.jpg"
                    className="h-full w-full object-contain"
                    alt="Digital Biz Tech Logo"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Digital Biz Tech
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mt-0.5">
                    Software & Automation
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-500">
                <div className="flex gap-2.5 items-start">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>565 Metro Pl S, Ste 300, Dublin, OH 43017</span>
                </div>
                <div className="flex gap-2.5 items-center">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>(614) 347-3250</span>
                </div>
                <div className="flex gap-2.5 items-center">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>info@digitalbiz.tech</span>
                </div>
                <div className="flex gap-2.5 items-center">
                  <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                  <a
                    href="https://www.digitalbiz.tech/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-900 dark:text-white font-medium hover:underline"
                  >
                    www.digitalbiz.tech
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50/50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 p-3 rounded-xl">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>Row-Level Security (RLS) Active</span>
                </div>
                <span className="font-semibold uppercase text-[9px] tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-full">
                  SECURE
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-500 pt-1">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                  <span>Active Orders Count:</span>
                  <span className="font-semibold text-slate-900 dark:text-white font-mono">
                    {orders.length}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                  <span>Scheduled Step Operations:</span>
                  <span className="font-semibold text-slate-900 dark:text-white font-mono">
                    {processes.length}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span>System Node Health:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold font-mono">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                    99.98%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Block 4: Technical Support & Feedback */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
            <Mail className="h-5 w-5 text-slate-400" />
            <div className="flex flex-col">
              <span>{language === "de" ? "Kontakt & Feedback" : "Contact & Feedback"}</span>
              <span className="text-[11px] font-normal text-slate-500">
                {language === "de"
                  ? "Feature-Anfragen und technischer Support."
                  : "Feature requests and technical support channels."}
              </span>
            </div>
          </div>

          <form onSubmit={handleSendFeedback} className="space-y-4 pt-1">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={
                language === "de"
                  ? "Schreiben Sie uns, wie wir helfen können..."
                  : "Send issues or requests directly to engineering..."
              }
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-xs min-h-[90px] outline-none focus:ring-1 focus:ring-slate-900 leading-normal shadow-2xs resize-none text-slate-800 dark:text-slate-200"
              required
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="text-xs h-8 px-5 gap-1.5 cursor-pointer rounded-xl font-medium border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              >
                <Send className="h-3.5 w-3.5 text-slate-400" />
                <span>{language === "de" ? "Feedback senden" : "Send Feedback"}</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
