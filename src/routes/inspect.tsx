import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera, Check, CheckCircle2, Nfc, ScanLine, X, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, PriorityBadge } from "@/components/townshield/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { activeWorkOrder } from "@/lib/townshield/engine";
import { useTown } from "@/lib/townshield/store";
import { ASSET_TYPE_LABEL, type AssetType } from "@/lib/townshield/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inspect")({
  validateSearch: (search: Record<string, unknown>): { asset?: string | undefined } => ({
    asset: typeof search["asset"] === "string" ? search["asset"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Field Inspection — TownShield AI" },
      { name: "description", content: "Scan an asset's QR or NFC tag, complete the checklist and upload repair evidence from the field." },
      { property: "og:title", content: "Field Inspection — TownShield AI" },
      { property: "og:description", content: "Mobile QR/NFC inspection and evidence capture for technicians." },
    ],
  }),
  component: InspectPage,
});

const CHECKLIST: Record<AssetType, string[]> = {
  emergency_light: ["Lamp illuminates on mains-fail test", "Battery holds charge for test duration", "Housing and lens undamaged"],
  exit_sign: ["Sign illuminated and legible", "Battery backup functional", "Not obstructed"],
  extinguisher: ["Present at marked location", "Pressure gauge in green zone", "Safety pin and seal intact", "No visible damage or corrosion"],
  smoke_detector: ["Responds to test smoke", "Status LED normal", "Not obstructed or dirty"],
  fire_alarm_panel: ["No active fault or trouble LEDs", "Battery and charger normal", "Zone list matches site plan"],
  electrical_panel: ["No abnormal heat or odour", "Thermal scan within limits", "Enclosure closed and labelled"],
  fire_pump: ["Weekly run test completed", "Pressure within design range", "No leaks at seals"],
  hydrant: ["Accessible and unobstructed", "Valve operates freely", "Caps and outlets intact"],
};

const TECHNICIANS = ["Tech. Hafiz", "Tech. Mei Ling", "Tech. Ravi"];

function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function InspectPage() {
  const { asset: assetId } = Route.useSearch();
  const { state } = useTown();
  const asset = assetId ? state.assets.find((a) => a.id === assetId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field app · technician"
        title="QR / NFC inspection"
        description="Scan the tag on the asset, complete the checklist and attach evidence. Results flow straight into the work order and readiness score."
      />
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-border bg-sidebar p-3 shadow-[var(--shadow-panel)]">
          <div className="min-h-[640px] rounded-[1.5rem] bg-background p-5">
            {asset ? <InspectionForm key={asset.id} assetId={asset.id} /> : <Scanner unknown={assetId} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Scanner({ unknown }: { unknown?: string | undefined }) {
  const { state } = useTown();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const withTasks = state.assets.filter((a) => activeWorkOrder(state, a.id));
  const others = state.assets.filter((a) => !activeWorkOrder(state, a.id));

  const go = (id: string) => navigate({ to: "/inspect", search: { asset: id } });

  return (
    <div className="space-y-5">
      <div className="relative mx-auto flex aspect-square w-full max-w-64 items-center justify-center overflow-hidden rounded-2xl border border-primary/30 bg-grid">
        <div className="absolute inset-6 rounded-xl border-2 border-dashed border-primary/50" />
        <div className="absolute inset-x-6 top-1/2 h-0.5 bg-primary/80 shadow-[0_0_12px_var(--color-primary)] animate-pulse" />
        <ScanLine className="size-10 text-primary/70" />
      </div>
      <p className="text-center text-xs text-muted-foreground">Point camera at the asset tag — or tap a tag in range below.</p>
      {unknown && <p className="text-center text-xs text-critical">Tag “{unknown}” is not registered.</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const id = code.trim().toUpperCase().replace(/^TS-/, "");
          if (id) go(id);
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter tag e.g. TS-EL-A03" className="font-mono" />
        <Button type="submit" variant="secondary">Go</Button>
      </form>

      {withTasks.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Assigned tasks</p>
          <div className="space-y-2">
            {withTasks.map((a) => {
              const wo = activeWorkOrder(state, a.id)!;
              return (
                <button key={a.id} onClick={() => go(a.id)} className="flex w-full items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-left hover:bg-warning/10">
                  <Nfc className="size-4 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-primary">{a.id}</p>
                    <p className="truncate text-sm">{wo.title}</p>
                  </div>
                  <PriorityBadge priority={wo.priority} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="eyebrow mb-2">Routine inspection</p>
        <div className="grid grid-cols-3 gap-1.5">
          {others.map((a) => (
            <button key={a.id} onClick={() => go(a.id)} className="rounded-md border border-border px-2 py-1.5 font-mono text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground">
              {a.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectionForm({ assetId }: { assetId: string }) {
  const { state, dispatch } = useTown();
  const asset = state.assets.find((a) => a.id === assetId)!;
  const wo = activeWorkOrder(state, asset.id);
  const items = CHECKLIST[asset.type];
  const [checks, setChecks] = useState<Record<string, boolean | undefined>>({});
  const [technician, setTechnician] = useState(TECHNICIANS[0]);
  const [notes, setNotes] = useState("");
  const [part, setPart] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [done, setDone] = useState<null | { result: "pass" | "fail"; woId?: string | undefined }>(null);

  const answered = items.every((i) => checks[i] !== undefined);
  const failed = items.filter((i) => checks[i] === false);
  const result: "pass" | "fail" = failed.length ? "fail" : "pass";

  if (done) {
    return (
      <div className="flex min-h-[600px] flex-col items-center justify-center text-center animate-rise">
        {done.result === "pass" ? <CheckCircle2 className="size-14 text-success" /> : <XCircle className="size-14 text-critical" />}
        <h2 className="mt-4 text-lg font-semibold">{done.result === "pass" ? "Evidence submitted" : "Failure reported"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {done.woId && done.result === "pass"
            ? `${done.woId} is now awaiting supervisor verification.`
            : done.result === "pass"
              ? "Inspection recorded. Validity renewed and score updated."
              : "A prioritised work order has been raised and the readiness score updated."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link to="/work-orders">View work orders</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/inspect" search={{}}>Scan another tag</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!answered) {
          toast.error("Complete every checklist item first");
          return;
        }
        const at = Date.now();
        dispatch({
          type: "submit_evidence",
          assetId: asset.id,
          failedItems: failed,
          at,
          evidence: {
            technician,
            notes: notes.trim() || (result === "pass" ? "All checks passed." : `Failed: ${failed.join(", ")}`),
            partReplaced: part.trim() || undefined,
            photo,
            result,
            submittedAt: at,
          },
        });
        setDone({ result, woId: wo?.id });
      }}
    >
      <div className="flex items-center gap-2">
        <Link to="/inspect" search={{}} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Back to scanner">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="flex items-center gap-1 text-xs text-success"><Check className="size-3" /> Tag TS-{asset.id} verified</span>
      </div>

      <div>
        <p className="eyebrow">{ASSET_TYPE_LABEL[asset.type]} · Site {asset.site}</p>
        <h2 className="mt-1 text-lg font-semibold">{asset.name.split(" — ")[1] ?? asset.name}</h2>
        <p className="text-xs text-muted-foreground">{asset.location}</p>
      </div>

      {wo && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={wo.priority} />
            <span className="font-mono text-xs">{wo.id}</span>
          </div>
          <p className="mt-1">{wo.title}</p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Checklist</legend>
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
            <span className="flex-1 text-sm">{item}</span>
            <button
              type="button"
              aria-label={`${item}: pass`}
              onClick={() => setChecks((c) => ({ ...c, [item]: true }))}
              className={cn("rounded-md border p-1.5", checks[item] === true ? "border-success bg-success/20 text-success" : "border-border text-muted-foreground")}
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`${item}: fail`}
              onClick={() => setChecks((c) => ({ ...c, [item]: false }))}
              className={cn("rounded-md border p-1.5", checks[item] === false ? "border-critical bg-critical/20 text-critical" : "border-border text-muted-foreground")}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </fieldset>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="tech">Technician</label>
        <select
          id="tech"
          value={technician}
          onChange={(e) => setTechnician(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {TECHNICIANS.map((t) => (
            <option key={t} value={t} className="bg-popover">{t}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="part">Part replaced <span className="text-muted-foreground">(optional)</span></label>
        <Input id="part" value={part} onChange={(e) => setPart(e.target.value)} placeholder="e.g. LED lamp module, NiCd battery" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="notes">Notes</label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you find and do?" rows={3} />
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3 hover:border-primary/50">
        {photo ? (
          <img src={photo} alt="Evidence preview" className="size-14 rounded object-cover" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded bg-muted"><Camera className="size-5 text-muted-foreground" /></span>
        )}
        <span className="text-sm">{photo ? "Replace photo" : "Attach evidence photo"}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setPhoto(await downscale(f));
            } catch {
              toast.error("Couldn't read that image");
            }
          }}
        />
      </label>

      <Button type="submit" className="w-full" size="lg" variant={answered && result === "fail" ? "destructive" : "default"}>
        {!answered ? "Complete checklist" : result === "pass" ? (wo ? "Submit repair evidence" : "Record pass") : "Report failure"}
      </Button>
    </form>
  );
}
