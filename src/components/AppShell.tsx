import { Activity, Database, Info, LayoutDashboard, Menu, Wallet, X } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useFxStore } from "@/store/useFxStore";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, desc: "Live rates & trends" },
  { to: "/workbench", label: "Transaction Workbench", icon: Wallet, desc: "Settlement calculator" },
  { to: "/data-integrity", label: "Data Integrity Center", icon: Database, desc: "History & audit" },
  { to: "/about", label: "Info", icon: Info, desc: "How this was built · README" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const init = useFxStore((s) => s.init);
  const status = useFxStore((s) => s.syncStatus);
  const message = useFxStore((s) => s.syncMessage);
  const [open, setOpen] = useState(false);

  useEffect(() => { init(); }, [init]);
  useEffect(() => { setOpen(false); }, [path]);

  const statusColor: Record<typeof status, string> = {
    idle: "bg-muted-foreground",
    connected: "bg-success",
    syncing: "bg-warning animate-pulse",
    cached: "bg-info",
    manual: "bg-destructive",
  };

  const Sidebar = (
    <aside className="w-64 h-full shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Activity className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">ZW FX Workbench</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Treasury Console</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = path === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium leading-tight">{item.label}</div>
                <div className="text-[11px] text-sidebar-foreground/50">{item.desc}</div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50 mb-1.5">
          RBZ Feed Status
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("h-2 w-2 rounded-full shrink-0", statusColor[status])} />
          <span className="font-mono text-sidebar-foreground/80 truncate">{message}</span>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">{Sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full">{Sidebar}</div>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border bg-surface/80 backdrop-blur px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground truncate">
                RBZ — Operations Console
              </div>
              <div className="text-sm font-semibold text-foreground truncate">
                {nav.find((n) => n.to === path)?.label ?? "Workbench"}
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <div>SESSION&nbsp;<span className="text-foreground">TRZ-{new Date().getFullYear()}-0431</span></div>
            <div>OPS&nbsp;<span className="text-foreground">treasury@bank.zw</span></div>
          </div>
          <div className="md:hidden flex items-center gap-2 text-[11px] font-mono">
            <span className={cn("h-2 w-2 rounded-full", statusColor[status])} />
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
