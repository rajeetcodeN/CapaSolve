import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Factory,
  BarChart3,
  ListOrdered,
  LayoutGrid,
  SlidersHorizontal,
  Calendar,
  TrendingUp,
  CloudUpload,
  CloudDownload,
  Settings,
  ChevronDown,
  User,
  LogOut,
  ChevronRight,
  Shield,
  Briefcase,
  Check,
  Search,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  HelpCircle,
  Pin,
  Activity,
  QrCode,
  GitBranch,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeProvider } from "./ThemeProvider";
import { CommandPalette } from "./CommandPalette";
import { NotificationCenter } from "./NotificationCenter";
import { ExportButton } from "./ExportButton";
import { OnboardingTour } from "./OnboardingTour";

interface NavItem {
  to: string;
  labelKey: any;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  customLabel?: string;
}

const nav: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutGrid },
  { to: "/orders", labelKey: "nav.orders", icon: ListOrdered },
  {
    to: "/status",
    labelKey: "nav.orders",
    icon: Activity,
    customLabel: "Production",
    badge: "LIVE",
  },
  { to: "/sandbox", labelKey: "nav.gantt", icon: GitBranch, customLabel: "What-If", badge: "AI" },
  { to: "/shifts", labelKey: "nav.settings", icon: Wrench, customLabel: "Shifts & Maint" },
  { to: "/machines", labelKey: "nav.settings", icon: Factory, customLabel: "Machines" },
  { to: "/analytics", labelKey: "nav.analytics", icon: TrendingUp },
  { to: "/pivot", labelKey: "nav.pivot", icon: Factory },
  { to: "/capacity", labelKey: "nav.planner", icon: SlidersHorizontal },
  { to: "/monthly", labelKey: "nav.monthly", icon: Calendar },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { t, language } = useTranslations();
  const {
    saveToCloud,
    loadFromCloud,
    isCloudSaving,
    isCloudLoading,
    role,
    setRole,
    plan,
    setPlan,
    theme,
    setTheme,
    sidebarCollapsed,
    toggleSidebar,
    setCommandPaletteOpen,
    setTourCompleted,
    setUser,
    setOrganization,
    user,
  } = useAppStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/dashboard":
        return "Dashboard";
      case "/orders":
        return "CSV Order Import";
      case "/data-cleaning":
        return "AI Data Cleaning Hub";
      case "/gantt":
        return "Workstation Gantt Chart";
      case "/analytics":
        return "OEE & Analytics";
      case "/pivot":
        return "Pivot Worksheets";
      case "/capacity":
        return "Daily Capacity Planner";
      case "/monthly":
        return "Monthly Gantt Planner";
      case "/sandbox":
        return "What-If Sandbox";
      case "/settings":
        return "Settings & Team";
      default:
        return "CapaSolve Manufacturing";
    }
  };

  const handlePlanChange = (selectedPlan: "FREE" | "PRO" | "ENTERPRISE") => {
    const res = setPlan(selectedPlan);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const getRoleBadgeInfo = (currentRole: typeof role) => {
    switch (currentRole) {
      case "ADMIN":
        return { label: "Administrator Mode", subtitle: "Full system access", icon: Shield };
      case "DEVELOPER":
        return { label: "Developer Mode", subtitle: "Full Developer Access", icon: Settings };
      default:
        return { label: "Guest Mode", subtitle: "Read-only access", icon: User };
    }
  };

  const toggleDarkMode = () => {
    if (theme === "dark") {
      setTheme("light");
      toast.info("Light theme enabled");
    } else {
      setTheme("dark");
      toast.info("Dark theme enabled");
    }
  };

  return (
    <ThemeProvider>
      <CommandPalette />
      <OnboardingTour />

      <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300">
        {/* 1. LEFT SIDEBAR (Desktop) */}
        <aside className="hidden lg:flex w-[72px] border-r border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col shrink-0 min-h-screen sticky top-0 z-30 select-none shadow-2xs">
          {/* Brand Header */}
          <div className="h-16 border-b border-slate-200/70 dark:border-slate-800 flex flex-col items-center justify-center">
            <Link
              to="/dashboard"
              className="h-9 w-9 rounded-xl bg-emerald-950 dark:bg-emerald-900 hover:bg-emerald-900 dark:hover:bg-emerald-850 flex items-center justify-center text-white shadow-2xs transition-all duration-200"
              title="CapaSolve Manufacturing"
            >
              <Factory className="h-4.5 w-4.5 text-white" />
            </Link>
          </div>

          {/* Navigation Area */}
          <nav className="flex-1 px-1 py-3 space-y-1 overflow-y-auto flex flex-col items-center">
            {nav.map(({ to, labelKey, icon: Icon, customLabel }) => {
              const active = pathname === to;
              const displayLabel = customLabel || t(labelKey);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "w-[64px] py-2 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all group relative text-center",
                    active
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs"
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-slate-100",
                  )}
                  title={displayLabel}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                      active
                        ? "text-emerald-800 dark:text-emerald-300"
                        : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9.5px] font-medium tracking-tight mt-1 leading-tight truncate w-full text-center px-0.5",
                      active
                        ? "text-emerald-950 dark:text-emerald-100 font-semibold"
                        : "text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200",
                    )}
                  >
                    {displayLabel}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer (Role Swapper) */}
          <div className="p-2 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-[64px] py-1.5 px-0.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center transition-colors focus:outline-none cursor-pointer"
                  title={getRoleBadgeInfo(role).label}
                >
                  {(() => {
                    const Icon = getRoleBadgeInfo(role).icon;
                    return <Icon className="h-4 w-4 text-slate-500" />;
                  })()}
                  <span className="text-[8.5px] font-semibold text-slate-500 mt-0.5 tracking-tight uppercase">
                    {role === "ADMIN" ? "Admin" : role === "DEVELOPER" ? "Dev" : "Guest"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" side="right" sideOffset={8}>
                <DropdownMenuLabel className="text-xs font-semibold text-slate-500">
                  Switch Access Role
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setRole("ADMIN");
                    toast.success("Access role updated: Admin Mode");
                  }}
                  className={cn(
                    "text-xs py-2 cursor-pointer",
                    role === "ADMIN" && "bg-slate-100 dark:bg-slate-800 font-semibold",
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-slate-600" />
                      <div className="flex flex-col">
                        <span>Administrator</span>
                        <span className="text-[9px] text-slate-400">
                          Full controls & team access
                        </span>
                      </div>
                    </div>
                    {role === "ADMIN" && (
                      <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRole("DEVELOPER");
                    toast.success("Access role updated: Developer Mode");
                  }}
                  className={cn(
                    "text-xs py-2 cursor-pointer",
                    role === "DEVELOPER" && "bg-slate-100 dark:bg-slate-800 font-semibold",
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5 text-slate-600" />
                      <div className="flex flex-col">
                        <span>Developer</span>
                        <span className="text-[9px] text-slate-400">
                          Seeding, solves & cloud save
                        </span>
                      </div>
                    </div>
                    {role === "DEVELOPER" && (
                      <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRole("GUEST");
                    toast.success("Access role updated: Guest Mode");
                  }}
                  className={cn(
                    "text-xs py-2 cursor-pointer",
                    role === "GUEST" && "bg-slate-100 dark:bg-slate-800 font-semibold",
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-600" />
                      <div className="flex flex-col">
                        <span>Guest (View Only)</span>
                        <span className="text-[9px] text-slate-400">Read-only timeline view</span>
                      </div>
                    </div>
                    {role === "GUEST" && (
                      <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                    )}
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Mobile Off-Canvas Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex flex-col">
            <div className="h-16 px-6 border-b flex items-center justify-between">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 font-bold text-lg"
              >
                <Factory className="h-5 w-5 text-primary" />
                <span>CapaSolve</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-muted"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="p-6 space-y-2 flex-1 overflow-y-auto">
              {nav.map(({ to, labelKey, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    pathname === to
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{t(labelKey)}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* 2. RIGHT WORKSPACE COLUMN */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Subheader Navbar */}
          <header className="h-16 border-b border-border/80 bg-card/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8 select-none">
            {/* Left Header Info */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-muted text-muted-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">
                  App
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
                <span className="font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {getPageTitle(pathname)}
                </span>
              </div>
            </div>

            {/* Right SaaS Actions Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Command Palette Trigger */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-500 transition-colors cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline text-slate-600 dark:text-slate-400">
                  Search...
                </span>
                <kbd className="hidden sm:inline-block pointer-events-none text-[9px] font-mono border border-slate-200 dark:border-slate-700 rounded px-1 bg-white dark:bg-slate-800 text-slate-500">
                  ⌘K
                </kbd>
              </button>

              {/* Dark Mode Toggle Button */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Toggle Dark/Light Mode"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-slate-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-500" />
                )}
              </button>

              {/* Notification Center */}
              <NotificationCenter />

              {/* Export Button */}
              <div className="hidden md:block">
                <ExportButton />
              </div>

              {/* Interactive Subscription Plan Switcher Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none hidden sm:flex">
                    <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                    <span>{plan} Plan</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-semibold text-slate-500">
                    Change Subscription Plan
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handlePlanChange("FREE")}
                    className={cn(
                      "text-xs py-2 cursor-pointer",
                      plan === "FREE" && "bg-slate-100 dark:bg-slate-800 font-semibold",
                    )}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>Free Plan</span>
                        <span className="text-[9px] text-slate-400">
                          30-day Gantt window constraint
                        </span>
                      </div>
                      {plan === "FREE" && (
                        <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handlePlanChange("PRO")}
                    className={cn(
                      "text-xs py-2 cursor-pointer",
                      plan === "PRO" && "bg-slate-100 dark:bg-slate-800 font-semibold",
                    )}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>Pro Plan</span>
                        <span className="text-[9px] text-slate-400">
                          Unlimited horizons, resource sync
                        </span>
                      </div>
                      {plan === "PRO" && (
                        <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handlePlanChange("ENTERPRISE")}
                    className={cn(
                      "text-xs py-2 cursor-pointer",
                      plan === "ENTERPRISE" && "bg-slate-100 dark:bg-slate-800 font-semibold",
                    )}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>Enterprise Plan</span>
                        <span className="text-[9px] text-slate-400">
                          Multi-machine solver, priority API
                        </span>
                      </div>
                      {plan === "ENTERPRISE" && (
                        <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                      )}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Avatar Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 cursor-pointer focus:outline-none pl-1">
                    <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-800">
                      <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs">
                        {user?.email ? user.email.slice(0, 2).toUpperCase() : "CS"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-xs font-bold text-foreground">
                        {user?.user_metadata?.full_name || "Factory Operator"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {user?.email || "admin@factory.com"}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setTourCompleted(false)}
                    className="text-xs cursor-pointer gap-2"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-primary" />
                    <span>Restart Tour</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setCommandPaletteOpen(true)}
                    className="text-xs cursor-pointer gap-2"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Command Palette (⌘K)</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setUser(null);
                      setOrganization(null);
                      setRole("GUEST");
                      toast.success(
                        language === "de" ? "Erfolgreich abgemeldet." : "Successfully signed out.",
                      );
                    }}
                    className="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Content Panel Area */}
          <main className="px-4 sm:px-8 py-6 w-full flex-1">{children}</main>
        </div>
      </div>
    </ThemeProvider>
  );
}
