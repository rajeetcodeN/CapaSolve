import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { setupAuthListener } from "@/lib/auth-service";

import appCss from "../styles.css?url";
import AppLayout from "@/components/AppLayout";
import MarketingLayout from "@/components/MarketingLayout";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    const isPublic = [
      "/",
      "/pricing",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/about",
      "/contact",
      "/privacy",
      "/security",
      "/documentation",
      "/api-reference",
      "/support"
    ].includes(location.pathname);
    const user = useAppStore.getState().user;
    
    if (!isPublic && !user) {
      throw redirect({
        to: "/login",
      });
    }

    if (user && ["/login", "/signup"].includes(location.pathname)) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MFG Scheduler" },
      { name: "description", content: "Manufacturing scheduling and planning system." },
      { name: "author", content: "MFG Scheduler Team" },
      { property: "og:title", content: "MFG Scheduler" },
      { property: "og:description", content: "Manufacturing scheduling and planning system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();

  useEffect(() => {
    const cleanup = setupAuthListener();
    
    // Register PWA Service Worker for offline tablet access
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("PWA ServiceWorker registration failed:", err);
      });
    }

    return () => cleanup?.();
  }, []);

  const isKiosk = location.pathname === "/kiosk";
  const isMarketing = [
    "/",
    "/pricing",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/about",
    "/contact",
    "/privacy",
    "/security",
    "/documentation",
    "/api-reference",
    "/support"
  ].includes(location.pathname);

  return (
    <QueryClientProvider client={queryClient}>
      {isKiosk ? (
        <Outlet />
      ) : isMarketing ? (
        <MarketingLayout>
          <Outlet />
        </MarketingLayout>
      ) : (
        <AppLayout>
          <Outlet />
        </AppLayout>
      )}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
