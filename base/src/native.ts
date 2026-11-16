// Native touches on iOS through Capacitor (no-ops in a browser).
import { Capacitor } from "@capacitor/core";

let haptics: typeof import("@capacitor/haptics") | null = null;
let on = true;
export function setHaptics(v: boolean) { on = v; }

export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    haptics = await import("@capacitor/haptics");
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch { /* plugin missing: fine */ }
}

export function buzz(kind: "light" | "medium" | "heavy" | "success" | "error" = "light") {
  if (!on) return;
  if (haptics) {
    const { Haptics, ImpactStyle, NotificationType } = haptics;
    if (kind === "success") void Haptics.notification({ type: NotificationType.Success });
    else if (kind === "error") void Haptics.notification({ type: NotificationType.Error });
    else void Haptics.impact({ style: kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
  } else if (navigator.vibrate) {
    navigator.vibrate(kind === "heavy" ? 25 : kind === "medium" ? 15 : 8);
  }
}
