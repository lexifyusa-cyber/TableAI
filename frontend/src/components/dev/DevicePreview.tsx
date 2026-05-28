import { useSearchParams, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Monitor, Smartphone, Tablet, Maximize2 } from "lucide-react";

const VIEWPORTS = {
  phone: { w: 390, h: 844, label: "Phone" },
  ipad: { w: 768, h: 1024, label: "iPad" },
  desktop: { w: 1440, h: 900, label: "Desktop" },
} as const;

type VW = keyof typeof VIEWPORTS;

/**
 * Dev-only viewport switcher.
 * When ?vw=phone|ipad|desktop is set, renders the same route inside a real
 * iframe sized to that viewport — CSS media queries actually fire at that
 * width (a CSS-only width clamp wouldn\'t trigger them).
 *
 * Hidden inside iframes (window !== window.top), so no recursion.
 */
export function DevicePreview({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const vw = searchParams.get("vw") as VW | null;
  const valid = vw && vw in VIEWPORTS ? vw : null;

  const inIframe = typeof window !== "undefined" && window.top !== window.self;
  if (inIframe) return <>{children}</>;

  const setVw = (next: VW | null) => {
    const sp = new URLSearchParams(searchParams);
    if (next) sp.set("vw", next);
    else sp.delete("vw");
    setSearchParams(sp);
  };

  if (!valid) {
    return (
      <>
        {children}
        <Toolbar current={null} onChange={setVw} />
      </>
    );
  }

  const v = VIEWPORTS[valid];
  // Build the inner URL without vw param.
  const innerSearch = new URLSearchParams(searchParams);
  innerSearch.delete("vw");
  const innerHref = location.pathname + (innerSearch.toString() ? "?" + innerSearch.toString() : "");

  return (
    <div className="min-h-svh bg-ink-950 flex flex-col items-center justify-start p-6 gap-3">
      <div className="text-xs uppercase tracking-widest text-ink-500">
        Preview · {v.label} · {v.w} × {v.h}
      </div>
      <div
        className="overflow-hidden rounded-[28px] bg-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-ink-800"
        style={{ width: v.w, height: v.h }}
      >
        <iframe
          key={valid}
          src={innerHref}
          title={`preview-${valid}`}
          className="block h-full w-full border-0"
        />
      </div>
      <Toolbar current={valid} onChange={setVw} />
    </div>
  );
}

function Toolbar({
  current,
  onChange,
}: {
  current: VW | null;
  onChange: (v: VW | null) => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-ink-200/80 bg-white/95 px-1.5 py-1.5 shadow-xl backdrop-blur dark:border-ink-700/80 dark:bg-ink-900/95">
      <div className="flex items-center gap-1">
        <Btn label="Full" icon={<Maximize2 className="h-3.5 w-3.5" />} active={current === null} onClick={() => onChange(null)} />
        <Btn label="Phone" icon={<Smartphone className="h-3.5 w-3.5" />} active={current === "phone"} onClick={() => onChange("phone")} />
        <Btn label="iPad" icon={<Tablet className="h-3.5 w-3.5" />} active={current === "ipad"} onClick={() => onChange("ipad")} />
        <Btn label="Desktop" icon={<Monitor className="h-3.5 w-3.5" />} active={current === "desktop"} onClick={() => onChange("desktop")} />
      </div>
    </div>
  );
}

function Btn({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
        (active
          ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900"
          : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800")
      }
    >
      {icon}
      {label}
    </button>
  );
}
