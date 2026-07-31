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
  { to: "/status", labelKey: "nav.orders", icon: Activity, customLabel: "Shop Status", badge: "DAILY" },
  { to: "/gantt", labelKey: "nav.gantt", icon: BarChart3, badge: "LIVE" },
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
      case "/dashboard": return "Dashboard";
      case "/orders": return "CSV Order Import";
      case "/data-cleaning": return "AI Data Cleaning Hub";
      case "/gantt": return "Workstation Gantt Chart";
      case "/analytics": return "OEE & Analytics";
      case "/pivot": return "Pivot Worksheets";
      case "/capacity": return "Daily Capacity Planner";
      case "/monthly": return "Monthly Gantt Planner";
      case "/settings": return "Settings & Team";
      default: return "CapaSolve Manufacturing";
    }
  };

  const handlePlanChange = (selectedPlan: 'FREE' | 'PRO' | 'ENTERPRISE') => {
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
        <aside className="hidden lg:flex w-[72px] border-r border-border/80 bg-card flex-col shrink-0 min-h-screen sticky top-0 z-30 select-none shadow-sm">
          {/* Brand Header */}
          <div className="h-16 border-b border-border/50 flex flex-col items-center justify-center">
            <Link to="/dashboard" className="h-9 w-9 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary shadow-xs transition-all duration-200" title="CapaSolve Manufacturing">
              <Factory className="h-4.5 w-4.5 text-primary" />
            </Link>
          </div>

          {/* Navigation Area */}
          <nav className="flex-1 px-1 py-3 space-y-1 overflow-y-auto flex flex-col items-center">
            {nav.map(({ to, labelKey, icon: Icon, badge, customLabel }) => {
              const active = pathname === to;
              const displayLabel = customLabel || t(labelKey);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "w-[64px] py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all group relative text-center",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  title={displayLabel}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className={cn("text-[9.5px] font-semibold tracking-tighter mt-1 leading-tight truncate w-full text-center px-0.5", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                    {displayLabel}
                  </span>
                  {badge && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer (Role Swapper) */}
          <div className="p-2 border-t border-border/50 bg-muted/20 flex flex-col items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-[64px] py-1.5 px-0.5 rounded-xl border border-border/50 bg-card hover:bg-accent/40 flex flex-col items-center justify-center transition-colors focus:outline-none cursor-pointer"
                  title={getRoleBadgeInfo(role).label}
                >
                  {(() => {
                    const Icon = getRoleBadgeInfo(role).icon;
                    return <Icon className="h-4 w-4 text-primary" />;
                  })()}
                  <span className="text-[8.5px] font-bold text-muted-foreground mt-0.5 tracking-tight uppercase">
                    {role === "ADMIN" ? "Admin" : role === "DEVELOPER" ? "Dev" : "Guest"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" side="right" sideOffset={8}>
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">Switch Access Role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => { setRole("ADMIN"); toast.success("Access role updated: Admin Mode"); }}
                  className={cn("text-xs py-2 cursor-pointer", role === "ADMIN" && "bg-accent font-semibold")}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <div className="flex flex-col">
                        <span>Administrator</span>
                        <span className="text-[9px] text-muted-foreground">Full controls & team access</span>
                      </div>
                    </div>
                    {role === "ADMIN" && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setRole("DEVELOPER"); toast.success("Access role updated: Developer Mode"); }}
                  className={cn("text-xs py-2 cursor-pointer", role === "DEVELOPER" && "bg-accent font-semibold")}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5 text-primary" />
                      <div className="flex flex-col">
                        <span>Developer</span>
                        <span className="text-[9px] text-muted-foreground">Seeding, solves & cloud save</span>
                      </div>
                    </div>
                    {role === "DEVELOPER" && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setRole("GUEST"); toast.success("Access role updated: Guest Mode"); }}
                  className={cn("text-xs py-2 cursor-pointer", role === "GUEST" && "bg-accent font-semibold")}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <div className="flex flex-col">
                        <span>Guest (View Only)</span>
                        <span className="text-[9px] text-muted-foreground">Read-only timeline view</span>
                      </div>
                    </div>
                    {role === "GUEST" && <Check className="h-3.5 w-3.5 text-primary" />}
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
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 font-bold text-lg">
                <Factory className="h-5 w-5 text-primary" />
                <span>CapaSolve</span>
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-md hover:bg-muted">
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
                    pathname === to ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
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

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80 hidden sm:inline">App</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 hidden sm:inline" />
                <span className="font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                  {getPageTitle(pathname)}
                </span>
              </div>
            </div>

            {/* Right SaaS Actions Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Command Palette Trigger */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-accent text-xs text-muted-foreground transition-colors cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="hidden sm:inline-block pointer-events-none text-[9px] font-mono border rounded px-1 bg-background">⌘K</kbd>
              </button>

              {/* Dark Mode Toggle Button */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg border border-border/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Toggle Dark/Light Mode"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
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
                  <button className={cn(
                    "text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border flex items-center gap-1 cursor-pointer hover:bg-accent/40 transition-colors focus:outline-none hidden sm:flex",
                    plan === "FREE" && "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
                    plan === "PRO" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                    plan === "ENTERPRISE" && "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                  )}>
                    <Briefcase className="h-3 w-3 shrink-0" />
                    {plan} Plan
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">Change Subscription Plan</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handlePlanChange("FREE")}
                    className={cn("text-xs py-2 cursor-pointer", plan === "FREE" && "bg-accent font-semibold")}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>Free Plan</span>
                        <span className="text-[9px] text-muted-foreground">30-day Gantt window constraint</span>
                      </div>
                      {plan === "FREE" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handlePlanChange("PRO")}
                    className={cn("text-xs py-2 cursor-pointer", plan === "PRO" && "bg-accent font-semibold")}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>Pro Plan</span>
                        <span className="text-[9px] text-muted-foreground">Unlimited horizons, resource sync</span>
                      </div>
                      {plan === "PRO" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handlePlanChange("ENTERPRISE")}
                    className={cn("text-xs py-2 cursor-pointer", plan === "ENTERPRISE" && "bg-accent font-semibold")}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>Enterprise Plan</span>
                        <span className="text-[9px] text-muted-foreground">Multi-machine solver, priority API</span>
                      </div>
                      {plan === "ENTERPRISE" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Avatar Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 cursor-pointer focus:outline-none pl-1">
                    <Avatar className="h-8 w-8 border border-border/80">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {user?.email ? user.email.slice(0, 2).toUpperCase() : "CS"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-xs font-bold text-foreground">{user?.user_metadata?.full_name || "Factory Operator"}</span>
                      <span className="text-[10px] text-muted-foreground">{user?.email || "admin@factory.com"}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTourCompleted(false)} className="text-xs cursor-pointer gap-2">
                    <HelpCircle className="h-3.5 w-3.5 text-primary" />
                    <span>Restart Tour</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCommandPaletteOpen(true)} className="text-xs cursor-pointer gap-2">
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
                      toast.success(language === "de" ? "Erfolgreich abgemeldet." : "Successfully signed out.");
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
          <main className="px-4 sm:px-8 py-6 w-full flex-1">
            {children}
          </main>
        </div>

      </div>
    </ThemeProvider>
  );
}

