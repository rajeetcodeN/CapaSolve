import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import {
  LayoutGrid,
  ListOrdered,
  BarChart3,
  TrendingUp,
  Factory,
  SlidersHorizontal,
  Calendar,
  Settings,
  Play,
  CloudUpload,
  CloudDownload,
  RotateCcw,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";

export function CommandPalette() {
  const navigate = useNavigate();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    theme,
    setTheme,
    runScheduler,
    saveToCloud,
    loadFromCloud,
    loadDefaultCSV,
    orders,
    role,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleSelectNav = (path: string) => {
    setCommandPaletteOpen(false);
    navigate({ to: path });
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput placeholder="Type a command or search workspace..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {/* Navigation Group */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelectNav("/dashboard")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectNav("/orders")}>
            <ListOrdered className="mr-2 h-4 w-4" />
            <span>Orders Spreadsheet</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectNav("/gantt")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Workstation Gantt Chart</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectNav("/analytics")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>OEE & Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectNav("/pivot")}>
            <Factory className="mr-2 h-4 w-4" />
            <span>Pivot Worksheets</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectNav("/capacity")}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            <span>Daily Capacity Planner</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectNav("/monthly")}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Monthly Gantt Planner</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectNav("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Organization & Team Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Quick Actions */}
        <CommandGroup heading="Actions & Operations">
          <CommandItem
            onSelect={() => {
              setCommandPaletteOpen(false);
              if (role !== "DEVELOPER" && role !== "ADMIN") {
                toast.error("Access Denied: Developer or Admin role required.");
                return;
              }
              runScheduler();
              toast.success("Scheduler executed!");
              navigate({ to: "/gantt" });
            }}
          >
            <Play className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Run Constraint Scheduler</span>
            <CommandShortcut>⌘R</CommandShortcut>
          </CommandItem>
          
          <CommandItem
            onSelect={() => {
              setCommandPaletteOpen(false);
              if (role !== "DEVELOPER" && role !== "ADMIN") {
                toast.error("Access Denied: Developer or Admin role required.");
                return;
              }
              saveToCloud();
            }}
          >
            <CloudUpload className="mr-2 h-4 w-4 text-sky-500" />
            <span>Save State to Supabase Cloud</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              setCommandPaletteOpen(false);
              if (role !== "DEVELOPER" && role !== "ADMIN") {
                toast.error("Access Denied: Developer or Admin role required.");
                return;
              }
              loadFromCloud();
            }}
          >
            <CloudDownload className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Load State from Supabase Cloud</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Preferences */}
        <CommandGroup heading="Appearance & Theme">
          <CommandItem
            onSelect={() => {
              setTheme("light");
              setCommandPaletteOpen(false);
              toast.info("Theme set to Light mode");
            }}
          >
            <Sun className="mr-2 h-4 w-4 text-amber-500" />
            <span>Light Theme</span>
            {theme === "light" && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("dark");
              setCommandPaletteOpen(false);
              toast.info("Theme set to Dark mode");
            }}
          >
            <Moon className="mr-2 h-4 w-4 text-indigo-400" />
            <span>Dark Theme</span>
            {theme === "dark" && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("system");
              setCommandPaletteOpen(false);
              toast.info("Theme set to System preference");
            }}
          >
            <Laptop className="mr-2 h-4 w-4" />
            <span>System Default</span>
            {theme === "system" && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
        </CommandGroup>

        {/* Quick Order Search if orders exist */}
        {orders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Loaded Orders (${orders.length})`}>
              {orders.slice(0, 5).map((ord) => (
                <CommandItem
                  key={ord.id}
                  onSelect={() => {
                    setCommandPaletteOpen(false);
                    navigate({ to: "/orders" });
                  }}
                >
                  <ListOrdered className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    Order #{ord.orderId} - <span className="font-mono text-xs">{ord.material}</span> ({ord.orderQty} pcs)
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
