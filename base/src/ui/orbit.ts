// Turning the world: drag the battlefield to spin it like a globe and tip it, pinch to zoom, double-tap to come
// back to the starting view. A drag that the game has claimed (moving a unit, placing a card) never turns the world.
import type { BoardView } from "../render/board";
import { TILT } from "../render/camera";

export interface Orbit { dispose(): void; /** glide back to the starting view */ home(): void; }

export function attachOrbit(canvas: HTMLCanvasElement, view: BoardView, busy: () => boolean): Orbit {
  const pts = new Map<number, { x: number; y: number }>();
  let turning = false, sx = 0, sy = 0, vyaw = 0, raf = 0, lastTap = 0, pinch = 0, homing = false, lastMove = 0;
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const glide = () => {
    stop();
    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      const v = view.view;
      if (homing) {
        // shortest way round to yaw 0
        const y = Math.atan2(Math.sin(v.yaw), Math.cos(v.yaw)), k = 1 - Math.exp(-dt * 7);
        view.setView(y * (1 - k), v.tilt + (TILT - v.tilt) * k, v.zoom + (1 - v.zoom) * k);
        if (Math.abs(y) < 0.004 && Math.abs(v.tilt - TILT) < 0.004 && Math.abs(v.zoom - 1) < 0.004) { view.setView(0, TILT, 1); homing = false; raf = 0; return; }
      } else {
        view.setView(v.yaw + vyaw * dt);
        vyaw *= Math.exp(-dt * 3.2);
        if (Math.abs(vyaw) < 0.03) { raf = 0; return; }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const down = (e: PointerEvent) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { sx = e.clientX; sy = e.clientY; turning = false; vyaw = 0; if (!homing) stop(); }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); turning = false; }
  };
  const move = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const v = view.view;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) view.setView(v.yaw, v.tilt, v.zoom * (d / pinch));
      pinch = d;
      return;
    }
    if (busy()) { turning = false; return; }
    if (!turning && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { turning = true; homing = false; stop(); }
    if (!turning) return;
    const now = performance.now(), dt = Math.max(0.004, (now - lastMove) / 1000); lastMove = now;
    const dyaw = -dx * 0.0085;
    vyaw = vyaw * 0.6 + (dyaw / dt) * 0.4;
    view.setView(v.yaw + dyaw, v.tilt - dy * 0.0035);
  };
  const up = (e: PointerEvent) => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size) return;
    if (turning) { turning = false; if (performance.now() - lastMove < 80 && Math.abs(vyaw) > 0.3) { vyaw = Math.max(-9, Math.min(9, vyaw)); glide(); } return; }
    const now = performance.now();
    if (now - lastTap < 320 && (view.view.yaw !== 0 || view.view.zoom !== 1 || view.view.tilt !== TILT)) { homing = true; glide(); lastTap = 0; } else lastTap = now;
  };
  const wheel = (e: WheelEvent) => { e.preventDefault(); const v = view.view; if (e.ctrlKey) view.setView(v.yaw, v.tilt, v.zoom * Math.exp(-e.deltaY * 0.01)); else view.setView(v.yaw + e.deltaX * 0.004, v.tilt, v.zoom * Math.exp(-e.deltaY * 0.0015)); };
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.style.touchAction = "none";
  return {
    dispose() { stop(); canvas.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); canvas.removeEventListener("wheel", wheel); },
    home() { homing = true; glide(); },
  };
}
