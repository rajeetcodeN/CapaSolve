import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const consent = localStorage.getItem("capasolve_cookie_consent");
      if (!consent) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("capasolve_cookie_consent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("capasolve_cookie_consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Cookie and Privacy Consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-slate-900/95 backdrop-blur-md border border-slate-800 text-slate-100 rounded-xl p-4 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-950/60 border border-blue-800/50 rounded-lg text-blue-400 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 flex-1 text-left">
          <h2 className="text-sm font-semibold text-white">Privacy & Functional Cookies</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            We use essential local storage and functional cookies to manage your scheduler session,
            preserve timeline filters, and protect your workspace data.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleAccept}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3"
            >
              Accept All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDecline}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-7 px-3"
            >
              Essential Only
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
