import { Link, useLocation } from "@tanstack/react-router";
import { Factory, Menu, X, Globe, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { useTranslations } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "./ThemeProvider";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { t, language, setLanguage } = useTranslations();
  const { theme, setTheme } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleDarkMode = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "de" : "en");
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased">
        {/* Sticky Premium Glassmorphic Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-90"
            >
              <Factory className="h-6 w-6 text-primary" />
              <span className="text-slate-900 dark:text-white font-bold">CapaSolve</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              {pathname === "/" ? (
                <a
                  href="#features"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {t("marketing.features" as any) || "Features"}
                </a>
              ) : (
                <Link
                  to="/"
                  hash="features"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("marketing.features" as any) || "Features"}
                </Link>
              )}
              <Link
                to="/pricing"
                className={cn(
                  "transition-colors",
                  pathname === "/pricing"
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("marketing.pricing" as any) || "Pricing"}
              </Link>
              <Link
                to="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("marketing.dashboard" as any) || "Go to App"}
              </Link>
            </nav>

            {/* Action Buttons (Desktop) */}
            <div className="hidden md:flex items-center gap-3">
              {/* Language Switcher Button */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-border/60 hover:bg-accent text-muted-foreground transition-colors cursor-pointer"
                title="Switch Language (EN/DE)"
              >
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span className="uppercase">{language}</span>
              </button>

              {/* Dark Mode Toggle Button */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg border border-border/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Toggle Dark/Light Mode"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-500" />
                )}
              </button>

              <Button asChild variant="ghost" size="sm" className="cursor-pointer">
                <Link to="/login">{t("marketing.login" as any) || "Sign In"}</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm"
              >
                <Link to="/signup">{t("marketing.trial" as any) || "Start Free Trial"}</Link>
              </Button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-muted"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 z-40 bg-background/95 backdrop-blur-lg border-b border-border flex flex-col p-6 space-y-6">
            <nav className="flex flex-col space-y-4 font-medium text-lg">
              {pathname === "/" ? (
                <a
                  href="#features"
                  className="text-muted-foreground hover:text-foreground py-2 border-b border-border/40"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setTimeout(() => {
                      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                >
                  {t("marketing.features" as any) || "Features"}
                </a>
              ) : (
                <Link
                  to="/"
                  hash="features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-muted-foreground hover:text-foreground py-2 border-b border-border/40"
                >
                  {t("marketing.features" as any) || "Features"}
                </Link>
              )}
              <Link
                to="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-muted-foreground hover:text-foreground py-2 border-b border-border/40"
              >
                {t("marketing.pricing" as any) || "Pricing"}
              </Link>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-muted-foreground hover:text-foreground py-2 border-b border-border/40"
              >
                {t("marketing.dashboard" as any) || "Go to App"}
              </Link>
            </nav>

            <div className="flex flex-col space-y-4 pt-4">
              <Button
                asChild
                variant="outline"
                className="w-full justify-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Link to="/login">{t("marketing.login" as any) || "Sign In"}</Link>
              </Button>
              <Button
                asChild
                className="w-full justify-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Link to="/signup">{t("marketing.trial" as any) || "Start Free Trial"}</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-grow flex flex-col">{children}</main>

        {/* Modern SaaS Footer */}
        <footer className="border-t border-border/40 bg-muted/40 py-12 px-6">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              {/* Branding Column */}
              <div className="col-span-2 space-y-4 text-left">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Factory className="h-5 w-5 text-primary" />
                  <span>CapaSolve</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  {t("marketing.footerDesc" as any) ||
                    "AI-powered constraint-based manufacturing scheduling and capacity optimization platform."}
                </p>
                <div className="pt-4 flex gap-3 items-center">
                  <img
                    src="/digitalbiz_Logo.jpg"
                    alt="Digital Biz Tech Logo"
                    className="h-9 object-contain rounded bg-white p-1 border border-border/40 shrink-0 shadow-xs"
                  />
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    <p className="font-bold text-foreground hover:text-primary transition-colors">
                      <a
                        href="https://www.digitalbiz.tech/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Digital Biz Tech &rarr;
                      </a>
                    </p>
                    <p>565 Metro Pl S, Ste 300, Dublin, OH 43017</p>
                    <p className="mt-0.5">Tel: (614) 347-3250 | info@digitalbiz.tech</p>
                  </div>
                </div>
              </div>

              {/* Links Column 1 */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Product
                </h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    {pathname === "/" ? (
                      <a
                        href="#features"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Features
                      </a>
                    ) : (
                      <Link
                        to="/"
                        hash="features"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Features
                      </Link>
                    )}
                  </li>
                  <li>
                    <Link
                      to="/pricing"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/dashboard"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Interactive Demo
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Links Column 2 */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Resources
                </h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      to="/documentation"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/api-reference"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      API Reference
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/support"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Support Portal
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Links Column 3 */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Company
                </h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      to="/about"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/security"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Security
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/privacy"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-border/40 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
              <div>&copy; 2026 Digital Biz Tech. All rights reserved.</div>
              <div className="flex gap-6">
                <span className="hover:text-foreground cursor-default">Terms of Service</span>
                <span className="hover:text-foreground cursor-default">Privacy Policy</span>
                <span className="hover:text-foreground cursor-default">Cookie Settings</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
