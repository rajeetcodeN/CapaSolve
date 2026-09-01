import React from "react";
import { useAppStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2, Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const { notifications, markNotificationAsRead, clearNotifications } = useAppStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-lg border border-border/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-xl border border-border/80">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full font-extrabold">
                {unreadCount} new
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearNotifications}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No notifications at this time.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markNotificationAsRead(n.id)}
                className={cn(
                  "p-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-accent/30 text-left",
                  !n.read && "bg-primary/5",
                )}
              >
                {getIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-xs font-semibold leading-none",
                        !n.read ? "text-foreground font-bold" : "text-muted-foreground",
                      )}
                    >
                      {n.title}
                    </p>
                    <span className="text-[9px] text-muted-foreground shrink-0">{n.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                    {n.message}
                  </p>
                </div>
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
