// The launch video. The edit is data (timeline.ts); this file only knows how to draw a shot, a typed prompt, a
// caption, the six-up grid and the end card, and how to mix music, voice and the games' own sound.
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import clips from "./clips.json";
import vo from "../vo/script.json";
import { BAR, BARS, BEAT, CAPTIONS, DURATION, FPS, GAMES, PEEK, PROMPTS, SCENE_SKIP, SCENE_START, SHOTS, TAIL, at, game, type GameId, type Shot } from "./timeline";

const W = 1080, H = 1920;
const INK = "#1a1210";
const has = (g: string, clip: string) => !!(clips as Record<string, Record<string, { seconds: number; sfx: boolean }>>)[g]?.[clip];
const info = (g: string, clip: string) => (clips as Record<string, Record<string, { seconds: number; sfx: boolean }>>)[g]?.[clip];

const fontReady = delayRender("font");
if (typeof document !== "undefined") {
  const face = new FontFace("Lilita", `url(${staticFile("fonts/LilitaOne-Regular.ttf")})`);
  face.load().then((f) => { (document as any).fonts.add(f); continueRender(fontReady); }).catch(() => continueRender(fontReady));
}
const DISPLAY = "Lilita, system-ui, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
const outline = (px: number, c = INK) => Array.from({ length: 16 }, (_, i) => `${(Math.cos((i / 16) * Math.PI * 2) * px).toFixed(1)}px ${(Math.sin((i / 16) * Math.PI * 2) * px).toFixed(1)}px 0 ${c}`).join(",") + `, 0 ${px * 1.6}px 0 ${c}`;
const pop = (f: number, delay = 0) => spring({ frame: f - delay, fps: FPS, config: { stiffness: 260, damping: 15, mass: 0.7 } });

/** The scene time (seconds) a shot starts at: its own `t`, or wherever the scene's running clock is at that bar. */
const shotTime = (s: Shot) => s.t ?? (SCENE_SKIP[s.clip] ?? 0) + Math.max(0, (at(s.bar) - at(SCENE_START[s.clip] ?? s.bar)) / FPS);

/** A capture, cropped to fill a box. A game that hasn't been filmed yet gets a labelled slate, so the edit renders. */
const Footage: React.FC<{ g: GameId; clip: string; t: number; style?: React.CSSProperties; fit?: "cover" | "contain" }> = ({ g, clip, t, style, fit = "cover" }) => {
  if (!has(g, clip)) {
    return (
      <AbsoluteFill style={{ background: `linear-gradient(160deg, ${game(g).color}, ${INK})`, alignItems: "center", justifyContent: "center", ...style }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 84, color: "#fff", textShadow: outline(6) }}>{game(g).name}</div>
        <div style={{ fontFamily: MONO, fontSize: 30, color: "#fff", opacity: 0.8, marginTop: 12 }}>{clip} · not filmed yet</div>
      </AbsoluteFill>
    );
  }
  const max = Math.max(0, (info(g, clip)!.seconds - 0.05));
  return (
    <AbsoluteFill style={style}>
      <OffthreadVideo src={staticFile(`clips/${g}/${clip}.mp4`)} startFrom={Math.round(Math.min(t, max) * FPS)} muted style={{ width: "100%", height: "100%", objectFit: fit }} />
    </AbsoluteFill>
  );
};

/** A full-screen shot: lands with a small punch and a flash, like a hit. */
const ShotView: React.FC<{ s: Shot }> = ({ s }) => {
  const f = useCurrentFrame();
  const punch = interpolate(f, [0, 10], [1.07, 1], { extrapolateRight: "clamp", easing: (x) => 1 - (1 - x) ** 3 });
  const flash = interpolate(f, [0, 2, 7], [0.55, 0.3, 0], { extrapolateRight: "clamp" });
  const ui = s.clip === "home" || s.clip === "army";
  const g = game(s.game);
  return (
    <AbsoluteFill style={{ background: INK }}>
      {ui ? (
        <>
          <Footage g={s.game} clip={s.clip} t={shotTime(s)} style={{ filter: "blur(40px) brightness(0.55) saturate(1.2)", transform: "scale(1.25)" }} />
          <div style={{ position: "absolute", left: (W - 800) / 2, top: (H - 1731) / 2, width: 800, height: 1731, borderRadius: 64, overflow: "hidden", boxShadow: `0 0 0 10px ${INK}, 0 40px 90px rgba(0,0,0,0.6)`, transform: `scale(${punch})` }}>
            <Footage g={s.game} clip={s.clip} t={shotTime(s)} />
          </div>
        </>
      ) : <Footage g={s.game} clip={s.clip} t={shotTime(s)} style={{ transform: `scale(${punch})` }} />}
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      {s.tag ? (
        <div style={{ position: "absolute", left: 44, top: 150, transform: `translateX(${interpolate(pop(f, 2), [0, 1], [-520, 0])}px)` }}>
          <div style={{ display: "inline-block", fontFamily: DISPLAY, fontSize: 76, color: "#fff", textShadow: outline(6), background: g.color, padding: "6px 30px 12px", borderRadius: 22, border: `7px solid ${INK}`, boxShadow: `0 9px 0 ${INK}` }}>{g.name}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** "See it in the rival's game": the player's results sheet, a tap on its button, and the rival's game sliding up
 *  over it under the bar the real overlay has, replaying the same round from the rival's end of the field. */
const Peek: React.FC = () => {
  const f = useCurrentFrame();
  const P = PEEK, to = game(P.to);
  const tap = interpolate(f, [P.tapAt, P.tapAt + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const open = spring({ frame: f - P.openAt, fps: FPS, config: { stiffness: 170, damping: 22, mass: 0.9 } });
  // the capture is 1080 x 2338 and fills the frame by height crop: its rows sit (2338 - 1920) / 2 higher on screen
  const bx = P.button[0], by = P.button[1] - (2338 - H) / 2;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Footage g={P.from} clip="peek" t={P.fromT} />
      {f >= P.tapAt && f < P.tapAt + 26 ? (
        <div style={{ position: "absolute", left: bx - 90, top: by - 90, width: 180, height: 180, borderRadius: 90, border: "10px solid #fff", opacity: 1 - tap, transform: `scale(${0.35 + tap * 0.9})`, boxShadow: "0 0 40px rgba(255,255,255,0.8)" }} />
      ) : null}
      {f >= P.openAt ? (
        <AbsoluteFill style={{ transform: `translateY(${(1 - open) * H}px)`, background: "#000" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 150, background: "#111", display: "flex", alignItems: "center", padding: "0 36px", boxSizing: "border-box", gap: 24 }}>
            <div style={{ flex: 1, color: "#fff", fontFamily: "system-ui, sans-serif", fontWeight: 600, fontSize: 40, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{P.rival} plays <span style={{ color: to.color }}>{to.name}</span></div>
            <div style={{ background: "#e5484d", color: "#fff", fontFamily: "system-ui, sans-serif", fontWeight: 600, fontSize: 40, padding: "18px 44px", borderRadius: 22 }}>Close</div>
          </div>
          <div style={{ position: "absolute", left: 0, top: 150, width: W, height: H - 150, overflow: "hidden" }}>
            <Footage g={P.to} clip="peekview" t={P.toT} />
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/** The prompt, typed as it would be in Claude Code: a caret, the words arriving, then sent on the cut. */
const Prompt: React.FC<{ text: string; typeFrames: number }> = ({ text, typeFrames }) => {
  const f = useCurrentFrame();
  const typing = Math.max(8, typeFrames - 14);
  const n = Math.round(interpolate(f, [6, typing], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const enter = pop(f);
  const sent = interpolate(f, [typeFrames - 5, typeFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const caret = Math.floor(f / 15) % 2 === 0 || n < text.length;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 250, transform: `translateY(${interpolate(enter, [0, 1], [260, 0])}px) scale(${1 + sent * 0.06})`, opacity: 1 - sent * 0.2 }}>
      <div style={{ background: "rgba(16,14,13,0.94)", border: `4px solid ${sent > 0.3 ? "#fff" : "#d97757"}`, borderRadius: 30, padding: "30px 38px", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
        <div style={{ fontFamily: MONO, fontSize: 30, color: "#d97757", letterSpacing: 2, marginBottom: 14 }}>CLAUDE CODE</div>
        <div style={{ fontFamily: MONO, fontSize: 58, color: "#f5efe6", whiteSpace: "nowrap" }}>
          <span style={{ color: "#d97757" }}>{"> "}</span>{text.slice(0, n)}<span style={{ opacity: caret ? 1 : 0, color: "#d97757" }}>▌</span>
        </div>
      </div>
    </div>
  );
};

const Caption: React.FC<{ lines: string[]; big?: boolean; y?: number; frames: number }> = ({ lines, big, y, frames }) => {
  const f = useCurrentFrame();
  const out = interpolate(f, [frames - 8, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: H * (y ?? (big ? 0.36 : 0.12)), textAlign: "center", opacity: out }}>
      {lines.map((l, i) => {
        const p = pop(f, i * 9);
        return (
          <div key={i} style={{ fontFamily: DISPLAY, fontSize: big ? (i === lines.length - 1 && lines.length > 1 ? 190 : 150) : 96, lineHeight: 1.06, color: i % 2 || lines.length === 1 ? "#ffd84a" : "#fff", textShadow: outline(big ? 11 : 8), transform: `scale(${interpolate(p, [0, 1], [0.4, 1])}) rotate(${interpolate(p, [0, 1], [-5, 0])}deg)`, opacity: Math.min(1, p * 2) }}>{l}</div>
        );
      })}
    </div>
  );
};

/** Six games, one battle, in step. */
const Grid: React.FC<{ clip: string }> = ({ clip }) => {
  const f = useCurrentFrame();
  const cw = W / 2, ch = H / 3;
  return (
    <AbsoluteFill style={{ background: INK }}>
      {GAMES.map((g, i) => {
        const p = pop(f, i * 5);
        return (
          <div key={g.id} style={{ position: "absolute", left: (i % 2) * cw, top: Math.floor(i / 2) * ch, width: cw, height: ch, overflow: "hidden", transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: Math.min(1, p * 1.5), boxShadow: `inset 0 0 0 5px ${INK}` }}>
            <Footage g={g.id} clip={clip} t={f / FPS} />
            <div style={{ position: "absolute", left: 14, bottom: 14, fontFamily: DISPLAY, fontSize: 40, color: "#fff", textShadow: outline(4), background: g.color, padding: "2px 16px 6px", borderRadius: 12, border: `4px solid ${INK}` }}>{g.name}</div>
            <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 5px ${INK}` }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const a = pop(f, 2), b = pop(f, 26), c = pop(f, 44);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, #3a2a22, ${INK} 70%)`, alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 200, color: "#ffd84a", textShadow: outline(13), transform: `scale(${interpolate(a, [0, 1], [0.3, 1])})`, letterSpacing: 2 }}>REMUSTER</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 74, color: "#fff", textShadow: outline(6), marginTop: 22, opacity: b, transform: `translateY(${interpolate(b, [0, 1], [40, 0])}px)` }}>One game. Every look.</div>
      <div style={{ marginTop: 90, opacity: c, transform: `translateY(${interpolate(c, [0, 1], [40, 0])}px)`, background: "rgba(16,14,13,0.94)", border: "4px solid #d97757", borderRadius: 26, padding: "24px 40px", fontFamily: MONO, fontSize: 50, color: "#f5efe6" }}>
        <span style={{ color: "#d97757" }}>{"> "}</span>make it yours
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC<{ music: boolean; vo: boolean; sfx: boolean }> = ({ music, vo: voOn, sfx }) => {
  const lines = (vo as { lines: { id: string; bar: number }[] }).lines;
  const voLen = 4.2 * FPS; // long enough for the longest line; used only to duck the music
  return (
    <AbsoluteFill style={{ background: INK }}>
      {SHOTS.map((s, i) => (
        <Sequence key={i} from={at(s.bar)} durationInFrames={s.beats * BEAT}>
          <ShotView s={s} />
          {sfx && info(s.game, s.clip)?.sfx ? <Audio src={staticFile(`clips/${s.game}/${s.clip}.wav`)} startFrom={Math.round(shotTime(s) * FPS)} volume={0.5} /> : null}
        </Sequence>
      ))}
      <Sequence from={at(21)} durationInFrames={4 * BAR}><Grid clip="siege" /></Sequence>
      <Sequence from={at(PEEK.bar)} durationInFrames={PEEK.bars * BAR}><Peek /></Sequence>
      <Sequence from={at(39)} durationInFrames={2 * BAR}><AbsoluteFill style={{ background: INK }} /></Sequence>
      {PROMPTS.map((p, i) => (
        <Sequence key={i} from={at(p.bar)} durationInFrames={at(p.send) - at(p.bar) + 4} layout="none"><Prompt text={p.text} typeFrames={at(p.send) - at(p.bar)} /></Sequence>
      ))}
      {CAPTIONS.map((c, i) => (
        <Sequence key={i} from={at(c.bar)} durationInFrames={c.beats * BEAT} layout="none"><Caption lines={c.lines} big={c.big} y={c.y} frames={c.beats * BEAT} /></Sequence>
      ))}
      <Sequence from={at(47)} durationInFrames={2 * BAR + TAIL}><EndCard /></Sequence>

      {music ? (
        <Audio src={staticFile("audio/soundtrack.wav")} volume={(f) => {
          let v = 0.85;
          if (voOn) for (const l of lines) { const a = at(l.bar); v = Math.min(v, interpolate(f, [a - 8, a + 4, a + voLen - 20, a + voLen], [0.85, 0.42, 0.42, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })); }
          return v * interpolate(f, [DURATION - 40, DURATION], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }} />
      ) : null}
      {voOn ? lines.map((l) => <Sequence key={l.id} from={at(l.bar)} layout="none"><Audio src={staticFile(`vo/${l.id}.wav`)} volume={1.5} /></Sequence>) : null}
      <AbsoluteFill style={{ pointerEvents: "none", boxShadow: "inset 0 0 220px rgba(0,0,0,0.35)" }} />
      {BARS ? null : null}
    </AbsoluteFill>
  );
};
