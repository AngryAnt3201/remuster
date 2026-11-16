// Inkfall's effects state: the base Fx with every colour of light turned to ink on the way in (./inktone.ts) and
// nothing drawn additively (adding dark ink to pale paper shows nothing): sprite sheets play with normal blending and
// "spark" particles, which the board adds, become plain dots. Floating numbers keep the colour they were given;
// ./juicedraw.ts decides how a number is inked.
import { Fx as Base, type Anim, type AnimOpts, type Particle } from "@base/render/fx";
import { inkTone } from "./inktone";

export * from "@base/render/fx";

export class Fx extends Base {
  flashColor = "#fffaf0";
  burst(x: number, y: number, n: number, o: Partial<Particle> & { speed?: number; spread?: number; dir?: number } = {}) {
    super.burst(x, y, n, { ...o, color: inkTone(o.color ?? "#fff"), kind: o.kind === "spark" ? "dot" : o.kind, size: o.kind === "spark" ? (o.size ?? 0.06) * 0.8 : o.size });
  }
  anim(sheet: string, x: number, y: number, o: AnimOpts): Anim {
    return super.anim(sheet, x, y, { ...o, tint: o.tint ? inkTone(o.tint) : o.tint, blend: "normal" });
  }
  ring(x: number, y: number, r0: number, r1: number, max: number, color: string, width = 0.06, fill?: string) { super.ring(x, y, r0, r1, max, inkTone(color), width, fill ? inkTone(fill) : fill); }
  arc(x: number, y: number, a: number, r: number, color: string, spread = 2.0, max = 0.16) { super.arc(x, y, a, r, inkTone(color), spread, max); }
  bolt(pts: [number, number][], color: string, max = 0.24) { super.bolt(pts, inkTone(color), max); }
  beam(x0: number, y0: number, x1: number, y1: number, color: string, width = 0.07, max = 0.3) { super.beam(x0, y0, x1, y1, inkTone(color), width, max); }
}
