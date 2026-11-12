// 表示する日付（惑星の位置を決める時計）。
// - 始まりは今日。daysPerSec で 1 秒あたり何日進めるかを決める（0 なら今日で止まる）。
// - 進めるのは 3D の描画ループからだけ（advance）。描画が止まっている間（タブが隠れた・図鑑を開いた）は
//   進まないので、戻った時に日付が飛ばない。
// - DOM 側（日付の操作の部品）とは window の CustomEvent でやり取りする。
//     外へ知らせる:  "spark:simdate"      detail = SimState を文字にした物（下の SimDetail）
//     受け取る:      "spark:simdate:set"  detail = { date?, daysPerSec?, playing?, today? }
//     今の状態を頼む: "spark:simdate:get"  （"spark:simdate" が 1 回返る）
import { EPHEM_MAX_MS, EPHEM_MIN_MS } from "./ephemeris";

/** 既定の速さ（1 秒あたりの日数）。開いた時は今日の並びから 1 日/秒で進む（2026-11-12 決定）。0 にすると今日で止まる。ここ 1 か所だけで決める。 */
export const DEFAULT_DAYS_PER_SEC: number = 1;

const DAY_MS = 86_400_000;

export type SimState = {
  ms: number;
  daysPerSec: number;
  playing: boolean;
  isToday: boolean;
};
export type SimDetail = SimState & { iso: string };
export type SimSetDetail = {
  date?: string | number;
  daysPerSec?: number;
  playing?: boolean;
  today?: boolean;
};

let simMs = Date.now();
let daysPerSec = DEFAULT_DAYS_PER_SEC;
let playing = DEFAULT_DAYS_PER_SEC !== 0;
let lastDayEmitted = Number.NaN;
const listeners = new Set<(s: SimState) => void>();

const clamp = (ms: number) =>
  Math.min(Math.max(ms, EPHEM_MIN_MS), EPHEM_MAX_MS);
const sameLocalDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

export function getSimState(): SimState {
  return {
    ms: simMs,
    daysPerSec,
    playing,
    isToday: sameLocalDay(simMs, Date.now()),
  };
}

/** 惑星の位置の計算に使う、表示中の日時(ms)。 */
export function simDateMs(): number {
  return simMs;
}

function emit() {
  const s = getSimState();
  lastDayEmitted = Math.floor(simMs / DAY_MS);
  for (const fn of listeners) fn(s);
  if (typeof window !== "undefined") {
    const detail: SimDetail = { ...s, iso: new Date(s.ms).toISOString() };
    window.dispatchEvent(
      new CustomEvent<SimDetail>("spark:simdate", { detail }),
    );
  }
}

/** 描画ループから 1 フレームごとに呼ぶ。deltaSec は大きく飛んでも 0.1 秒までに抑える。 */
export function advance(deltaSec: number) {
  if (!playing || daysPerSec === 0) return;
  const d = Math.min(Math.max(deltaSec, 0), 0.1);
  const next = clamp(simMs + d * daysPerSec * DAY_MS);
  const hitEdge = next === EPHEM_MIN_MS || next === EPHEM_MAX_MS;
  simMs = next;
  if (hitEdge) playing = false; // 表の有効期間の端で止める
  // 日付の表示は 1 日単位なので、日が変わった時と止まった時だけ知らせる（毎フレームは送らない）
  if (hitEdge || Math.floor(simMs / DAY_MS) !== lastDayEmitted) emit();
}

export function setSimDate(date: Date | string | number) {
  const ms =
    date instanceof Date
      ? date.getTime()
      : typeof date === "number"
        ? date
        : Date.parse(date);
  if (!Number.isFinite(ms)) return;
  simMs = clamp(ms);
  emit();
}

export function setDaysPerSec(v: number) {
  if (!Number.isFinite(v)) return;
  daysPerSec = v;
  if (v === 0) playing = false;
  emit();
}

export function play() {
  if (daysPerSec === 0) return;
  playing = true;
  emit();
}

export function pause() {
  playing = false;
  emit();
}

/** 今日へ戻す。進める／止めるの状態は変えない（今日で止めたい時は { today: true, playing: false } を送る）。 */
export function resetToToday() {
  simMs = clamp(Date.now());
  emit();
}

export function subscribeSim(fn: (s: SimState) => void): () => void {
  listeners.add(fn);
  fn(getSimState());
  return () => listeners.delete(fn);
}

if (typeof window !== "undefined") {
  const w = window as Window & { __sparkSimclock?: boolean };
  if (!w.__sparkSimclock) {
    w.__sparkSimclock = true;
    window.addEventListener("spark:simdate:set", (e: Event) => {
      const d = ((e as CustomEvent<SimSetDetail>).detail ?? {}) as SimSetDetail;
      if (d.today) resetToToday();
      if (d.date !== undefined) setSimDate(d.date);
      if (d.daysPerSec !== undefined) setDaysPerSec(d.daysPerSec);
      if (d.playing === true) play();
      if (d.playing === false) pause();
    });
    window.addEventListener("spark:simdate:get", () => emit());
  }
}
