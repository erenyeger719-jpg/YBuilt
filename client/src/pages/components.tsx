// client/src/components.tsx
import React from "react";
import { HoverMsg } from "./types-and-helpers";

/** -------------------- Hover Highlight Component -------------------- **/
export function HoverHighlight({
  hoverBox,
  layer,
}: {
  hoverBox: { x: number; y: number; w: number; h: number } | null;
  layer: "Layout" | "Copy" | "Brand" | "Proof" | "Perf" | "Variants";
}) {
  if (!hoverBox) return null;
  const layerColor =
    layer === "Perf"
      ? "rgba(16,185,129,0.85)"
      : layer === "Proof"
      ? "rgba(239,68,68,0.85)"
      : layer === "Brand"
      ? "rgba(234,179,8,0.85)"
      : layer === "Variants"
      ? "rgba(59,130,246,0.85)"
      : layer === "Copy"
      ? "rgba(147,51,234,0.85)"
      : "rgba(99,102,241,0.85)";
  const soft = layerColor.replace("0.85", "0.18");
  return (
    <div
      className="absolute pointer-events-none rounded"
      style={{
        left: hoverBox.x,
        top: hoverBox.y,
        width: hoverBox.w,
        height: hoverBox.h,
        outline: `2px solid ${layerColor}`,
        boxShadow: `0 0 0 4px ${soft} inset`,
      }}
    />
  );
}

/** -------------------- Measurements Component -------------------- **/
export function Measurements({
  enabled,
  box,
}: {
  enabled: boolean;
  box: { x: number; y: number; w: number; h: number } | null;
}) {
  if (!enabled || !box) return null;
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const w = Math.max(0, box.w);
  const h = Math.max(0, box.h);
  const cw = 1280, ch = 800;
  const left = Math.round(x);
  const right = Math.round(cw - (x + w));
  const top = Math.round(y);
  const bottom = Math.round(ch - (y + h));
  const midY = y + h / 2;
  const midX = x + w / 2;
  const line = "absolute bg-emerald-500/70 pointer-events-none";
  const tag = "absolute text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 pointer-events-none";
  
  return (
    <>
      {/* horizontal to left */}
      <div className={line} style={{ left: 0, top: midY, width: left, height: 1 }} />
      <div className={tag} style={{ left: Math.max(2, left / 2 - 12), top: midY - 14 }}>
        {left}px
      </div>
      {/* horizontal to right */}
      <div className={line} style={{ left: x + w, top: midY, width: right, height: 1 }} />
      <div className={tag} style={{ left: x + w + Math.max(2, right / 2 - 12), top: midY - 14 }}>
        {right}px
      </div>
      {/* vertical to top */}
      <div className={line} style={{ left: midX, top: 0, width: 1, height: top }} />
      <div className={tag} style={{ left: midX + 4, top: Math.max(2, top / 2 - 8) }}>
        {top}px
      </div>
      {/* vertical to bottom */}
      <div className={line} style={{ left: midX, top: y + h, width: 1, height: bottom }} />
      <div className={tag} style={{ left: midX + 4, top: y + h + Math.max(2, bottom / 2 - 8) }}>
        {bottom}px
      </div>
      {/* center crosshair */}
      <div className={line} style={{ left: 0, top: midY, width: cw, height: 1, opacity: 0.35 }} />
      <div className={line} style={{ left: midX, top: 0, width: 1, height: ch, opacity: 0.35 }} />
    </>
  );
}

/** -------------------- Row Component for Constraint Ledger -------------------- **/
export function Row({ label, val, hint }: { label: string; val: boolean | null; hint?: string }) {
  const badge =
    val === true
      ? "bg-emerald-100 text-emerald-800"
      : val === false
      ? "bg-rose-100 text-rose-800"
      : "bg-gray-100 text-gray-700";
  const text = val === true ? "PASS" : val === false ? "FAIL" : "—";
  return (
    <div className="flex items-center justify-between">
      <div>{label}</div>
      <div className="flex items-center gap-2">
        {hint ? <span className="text-xs opacity-60">{hint}</span> : null}
        <span className={`text-[10px] px-2 py-0.5 rounded ${badge}`}>{text}</span>
      </div>
    </div>
  );
}