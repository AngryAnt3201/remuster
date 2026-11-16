// Inkfall's effect sheets are ink, not light (art/flat.ts bakes them that way), so nothing may be drawn additively:
// once the atlas has loaded, every sheet is switched to normal blending; and any tint asked for is turned into the
// ink that stands for it (./inktone.ts), for callers that do not go through Fx (the Gatewatch view).
import { loadVfx as baseLoad, vfxFrame as baseFrame, vfxManifest, type FrameSource } from "@base/render/vfx";
import { inkTone } from "./inktone";

export * from "@base/render/vfx";

let loading: Promise<void> | null = null;
export function loadVfx(): Promise<void> {
  return (loading ??= baseLoad().then(() => { const m = vfxManifest(); if (m) for (const s of Object.values(m.sheets)) s.blend = "normal"; }));
}
export function vfxFrame(name: string, f: number, tint?: string): FrameSource | null {
  return baseFrame(name, f, tint ? inkTone(tint) : tint);
}
