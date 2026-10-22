import { Link, useRouterState } from "@tanstack/react-router";
import {
  BrainCircuit,
  Boxes,
  LayoutDashboard,
  RotateCcw,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useScores, useTown } from "@/lib/townshield/store";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/assets", label: "Assets", icon: Boxes },
  { to: "/work-orders", label: "Work orders", icon: Wrench },
  { to: "/inspect", label: "Field inspection", icon: ScanLine },
  { to: "/insights", label: "AI insights", icon: BrainCircuit },
  { to: "/audit", label: "Audit trail", icon: ScrollText },
] as const;

function NavLinks({ compact = false }: { compact?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useTown();
  const open = state.workOrders.filter((w) => w.status !== "closed").length;
  return (
    <>
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            search={{}}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              compact && "shrink-0 px-3 py-1.5",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-primary")} />
            <span>{label}</span>
            {to === "/work-orders" && open > 0 && (
              <span className="ml-auto rounded-full bg-primary/15 px-1.5 font-mono text-[10px] text-primary">
                {open}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { reset } = useTown();
  const { township } = useScores();

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur lg:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 glow-ring">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">TownShield AI</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Safety readiness
            </p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <NavLinks />
        </nav>
        <div className="mt-auto space-y-3 p-4">
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="eyebrow">Living-lab pilot</p>
            <p className="mt-1 text-sm font-medium">Nilai Impian</p>
            <p className="mt-1 text-xs text-muted-foreground">
              3 sites · simulated & read-only data. Decision support only — not a certified fire system.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              reset();
              toast.success("Demo data reset");
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <ShieldCheck className="size-5 text-primary" />
          <span className="font-semibold">TownShield AI</span>
          <span className="ml-auto font-mono text-sm text-muted-foreground">
            Township {township.score}
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          <NavLinks compact />
        </nav>
      </header>

      <main className="bg-grid min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
