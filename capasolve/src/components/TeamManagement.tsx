import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { neonDb } from "@/lib/neon";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Trash2,
  Clock,
  Building2,
  RefreshCw,
  ExternalLink,
  UserX,
  AlertCircle,
} from "lucide-react";

export function TeamManagement() {
  const { language } = useTranslations();
  const { user, organization, role } = useAppStore();

  const [members, setMembers] = useState<
    Array<{
      id: string;
      user_id: string;
      role: string;
      created_at: string;
      email: string;
      full_name: string;
    }>
  >([]);

  const [invitations, setInvitations] = useState<
    Array<{
      id: string;
      org_id: string;
      email: string;
      role: string;
      token: string;
      expires_at: string;
      created_at: string;
      accepted_at: string | null;
    }>
  >([]);

  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "DEVELOPER" | "GUEST">("DEVELOPER");
  const [isInviting, setIsInviting] = useState(false);
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const orgId = organization?.id;
  const isAuthorized = role === "ADMIN" || role === "DEVELOPER";

  const loadTeamData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        neonDb.getOrganizationMembers(orgId),
        neonDb.getOrganizationInvitations(orgId),
      ]);
      setMembers(membersData);
      setInvitations(invitesData);
    } catch (err: any) {
      console.warn("Could not load team data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, [orgId]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) {
      toast.error("No active organization found.");
      return;
    }
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsInviting(true);
    try {
      const result = await neonDb.createInvitation(orgId, inviteEmail.trim().toLowerCase(), inviteRole);
      setLatestInviteLink(result.inviteLink);
      setInviteEmail("");
      toast.success(
        language === "de"
          ? `Einladung für ${inviteEmail} erfolgreich erstellt!`
          : `Invitation generated for ${inviteEmail}!`,
      );
      loadTeamData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(id);
      toast.success(language === "de" ? "Link in die Zwischenablage kopiert!" : "Invite link copied to clipboard!");
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await neonDb.revokeInvitation(inviteId);
      toast.success(language === "de" ? "Einladung widerrufen." : "Invitation revoked.");
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId));
      if (latestInviteLink?.includes(inviteId)) {
        setLatestInviteLink(null);
      }
    } catch (err: any) {
      toast.error("Failed to revoke invitation: " + err.message);
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberEmail: string) => {
    if (!orgId) return;
    if (memberUserId === user?.id) {
      toast.error("You cannot remove your own active account from the workspace.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${memberEmail} from ${organization.name}?`,
    );
    if (!confirmed) return;

    try {
      await neonDb.removeMember(orgId, memberUserId);
      toast.success(`Removed ${memberEmail} from organization.`);
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
    } catch (err: any) {
      toast.error("Failed to remove member: " + err.message);
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case "ADMIN":
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800 text-[10px] font-semibold">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        );
      case "DEVELOPER":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Planner / Dev
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[10px] font-medium">
            <Shield className="h-3 w-3 mr-1" />
            Operator / Guest
          </Badge>
        );
    }
  };

  return (
    <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                {language === "de" ? "Team & Mitgliederverwaltung" : "Team Members & Plant Access"}
              </h2>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {members.length} {members.length === 1 ? "member" : "members"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {language === "de"
                ? `Organisationsarbeitsbereich: ${organization?.name || "Standardfabrik"}`
                : `Workspace: ${organization?.name || "Factory Plant Workspace"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadTeamData}
            disabled={loading}
            className="text-xs h-8.5 px-3 rounded-xl border-border hover:bg-accent gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            <span>{language === "de" ? "Aktualisieren" : "Sync Team"}</span>
          </Button>
        </div>
      </div>

      {/* Invite Member Section (Only for Admins & Developers) */}
      {isAuthorized ? (
        <div className="bg-muted/30 border border-border/60 rounded-xl p-4.5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <UserPlus className="h-4 w-4 text-primary" />
            <span>{language === "de" ? "Neues Teammitglied einladen" : "Invite Colleague to Factory"}</span>
          </div>

          <form onSubmit={handleSendInvite} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6 space-y-1">
              <Label htmlFor="invite-email" className="text-[11px] font-medium text-muted-foreground">
                Colleague Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. planner@factory.com"
                  className="pl-9 h-9 text-xs bg-background rounded-xl border-border focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <Label htmlFor="invite-role" className="text-[11px] font-medium text-muted-foreground">
                Assigned Role & Plant Permissions
              </Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full bg-background border border-border rounded-xl px-3 py-1 text-xs h-9 outline-none focus:ring-1 focus:ring-primary cursor-pointer text-foreground font-medium"
              >
                <option value="DEVELOPER">Planner / Dev (Build & Optimize Schedules)</option>
                <option value="ADMIN">Administrator (Full Access & Organization Management)</option>
                <option value="GUEST">Floor Operator (View Schedules & Report Execution)</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-end">
              <Button
                type="submit"
                disabled={isInviting || !inviteEmail}
                size="sm"
                className="w-full h-9 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{isInviting ? "Inviting..." : "Create Invite"}</span>
              </Button>
            </div>
          </form>

          {/* Generated Shareable Link Preview */}
          {latestInviteLink && (
            <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 overflow-hidden text-xs">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">Invite Ready: </span>
                  <span className="font-mono text-muted-foreground select-all">{latestInviteLink}</span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(latestInviteLink, "latest")}
                className="text-xs h-7.5 px-3 rounded-lg border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 shrink-0 gap-1.5"
              >
                {copiedToken === "latest" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-muted/20 border border-border/50 rounded-xl p-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Only Plant Administrators and Planners have permissions to invite colleagues.</span>
        </div>
      )}

      {/* Pending Invitations Table */}
      {invitations.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Pending Invitations ({invitations.length})</span>
            </h3>
          </div>

          <div className="border border-border/70 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b border-border/70 text-[11px]">
                  <th className="p-3 font-semibold">Invited Colleague</th>
                  <th className="p-3 font-semibold">Assigned Role</th>
                  <th className="p-3 font-semibold">Status / Expires</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invitations.map((inv) => {
                  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"}/signup?invite=${inv.token}`;
                  const isCopied = copiedToken === inv.id;
                  const expiresDate = new Date(inv.expires_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium text-foreground">{inv.email}</td>
                      <td className="p-3">{getRoleBadge(inv.role)}</td>
                      <td className="p-3 text-muted-foreground text-[11px]">
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>{" "}
                        · Expires {expiresDate}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(inviteUrl, inv.id)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title="Copy Invitation Link"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {isAuthorized && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRevokeInvite(inv.id)}
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              title="Revoke Invitation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Workspace Members Table */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Active Team Members ({members.length})</span>
        </h3>

        <div className="border border-border/70 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b border-border/70 text-[11px]">
                <th className="p-3 font-semibold">User</th>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Access Level</th>
                <th className="p-3 font-semibold">Joined Date</th>
                {isAuthorized && <th className="p-3 font-semibold text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground text-xs">
                    {loading ? "Loading active team members..." : "No members found in workspace."}
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const isCurrentUser = m.user_id === user?.id;
                  const joinedDate = m.created_at
                    ? new Date(m.created_at).toLocaleDateString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Active";

                  return (
                    <tr key={m.id || m.user_id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                            {m.full_name?.charAt(0) || m.email?.charAt(0) || "U"}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">{m.full_name}</span>
                            {isCurrentUser && (
                              <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0">
                                You
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[11px]">{m.email}</td>
                      <td className="p-3">{getRoleBadge(m.role)}</td>
                      <td className="p-3 text-muted-foreground text-[11px]">{joinedDate}</td>
                      {isAuthorized && (
                        <td className="p-3 text-right">
                          {!isCurrentUser && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMember(m.user_id, m.email)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer"
                              title={`Remove ${m.email} from workspace`}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
