// The Daily Challenge page body: today's board (arena, rival and the rival's opening army), the rule, the draft pool,
// and the streak as a week of lit days. main.ts owns the flow (saving, starting the match); this only draws.
import { ACTS } from "@engine/core/campaign";
import { dayNumber, type DailyBoard, type DailySave } from "@engine/core/daily";
import { el } from "./dom";
import { framedPortrait, ribbon } from "./game";
import { icon } from "./kit";

export interface DailyView {
  board: DailyBoard;
  save: DailySave;
  /** Today's day key. */
  key: string;
  /** The current streak (0 if it lapsed). */
  streak: number;
  /** Today's scored attempt is still open. */
  open: boolean;
  /** Date line, e.g. "Fri, 6 Nov". */
  when: string;
  /** Time until the next board, e.g. "6h 12m". */
  next: string;
  /** The play / practice button. */
  action: HTMLElement;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const num = (n: number) => n.toLocaleString("en");
const DAY = ["S", "M", "T", "W", "T", "F", "S"];

/** The board preview: the arena ground, the rival's opening pieces where they stand, and the rival's nameplate. */
function boardPreview(v: DailyView) {
  const b = v.board;
  // The rival's opening army, lined up on the field (bigger pieces first), each ringed in the rival's colour.
  const army = [...b.foe.start].sort((p, q) => (q.rank ?? 1) - (p.rank ?? 1)).slice(0, 6);
  const tokens = el("div", { class: "daily-army" }, army.map((p) => {
    const rank = Math.min(4, p.rank ?? 1);
    const { frame } = framedPortrait(p.kind, rank, "daily-token");
    return el("span", { class: "daily-piece" }, [frame, ...(rank > 1 ? [el("i", { class: "daily-rank" }, [String(rank)])] : [])]);
  }));
  return el("div", { class: "daily-board", style: `background-image:url(arenas/act${b.arena}.jpg)` }, [
    el("div", { class: "daily-board-shade" }),
    el("span", { class: "daily-chip num" }, [`#${b.number} · ${v.when}`]),
    el("span", { class: "daily-chip arena" }, [ACTS[b.arena - 1] ?? `Act ${b.arena}`]),
    tokens,
    el("div", { class: "daily-rival plate" }, [
      el("span", { class: "crest" }, [icon("shield")]),
      el("div", { class: "daily-rival-id" }, [el("small", {}, ["Today's rival"]), el("b", {}, [b.foe.name])]),
      el("span", { class: "tag" }, [cap(b.foe.ai.tactic)]),
    ]),
  ]);
}

/** Seven days ending today: lit while the streak covers them, today glowing if it's still to play. */
function streakWeek(v: DailyView) {
  const today = dayNumber(v.key);
  const last = v.save.last ? dayNumber(v.save.last) : -Infinity;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = today - i;
    const lit = v.streak > 0 && d <= last && d > last - v.streak;
    const wd = new Date(d * 86400000).getUTCDay();
    const cls = ["daily-day", lit ? "lit" : "", d === today ? "today" : "", d === today && v.open ? "due" : ""].join(" ");
    days.push(el("span", { class: cls }, [el("i", {}, [lit ? icon("flame") : d === today && v.open ? icon("star") : ""]), el("small", {}, [DAY[wd]])]));
  }
  return el("div", { class: "daily-week" }, days);
}

export function dailyBody(v: DailyView) {
  const b = v.board, s = v.save, t = s.today?.key === v.key ? s.today : undefined;
  const status = v.open
    ? el("p", { class: "daily-note" }, [`Same board for everyone · next in ${v.next}`])
    : el("div", { class: `daily-today ${t?.won ? "won" : ""}` }, [
      el("b", {}, [t?.done ? `${t.won ? "Victory" : "Defeat"} · ${num(t.score)}` : "Attempt abandoned"]),
      el("small", {}, [`Next board in ${v.next}`]),
    ]);
  const hero = el("div", { class: "panel daily-card" }, [
    boardPreview(v),
    el("div", { class: "daily-rule" }, [ribbon(b.rule.name, "gold small"), el("span", {}, [b.rule.text])]),
    el("div", { class: "daily-draft" }, [
      el("small", {}, ["Today's draft"]),
      // One row, however many units the draft has (the tiles share the width).
      el("div", { class: "roster", style: `--n:${b.roster.length}` }, b.roster.map((k) => framedPortrait(k, 1, "roster-unit").frame)),
    ]),
  ]);
  const streak = el("div", { class: `panel daily-streak ${v.streak ? "on" : ""}` }, [
    el("div", { class: "daily-streak-top" }, [
      el("span", { class: "daily-flame" }, [icon("flame")]),
      el("div", { class: "daily-streak-id" }, [el("b", {}, [String(v.streak)]), el("small", {}, ["day streak"])]),
      el("div", { class: "daily-streak-stats" }, [
        el("span", {}, [el("b", {}, [num(s.best)]), "best score"]),
        el("span", {}, [el("b", {}, [String(s.bestStreak)]), "top streak"]),
      ]),
    ]),
    streakWeek(v),
  ]);
  return el("div", { class: "daily-body" }, [hero, streak, status, v.action]);
}
