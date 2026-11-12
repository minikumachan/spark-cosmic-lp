// 関門: 惑星の位置の計算（src/lib/ephemeris.ts）が正しいか。
// 天文計算の部品 astronomy-engine（版を固定した開発用の部品）と、5 つの日付 × 8 惑星 = 40 件の日心黄経を比べる。
//   通った     … 40 件そろい、ずれの最大が 1 度以内          （終了コード 0）
//   落ちた     … 40 件そろったが、どれかが 1 度を超えてずれた  （終了コード 1）
//   判定できない … 40 件そろわなかった（部品が無い・計算が数字を返さない等）（終了コード 2）
// 実行: npm run check:ephem
// わざと落とす: npm run check:ephem -- sabotage（火星を 3 度ずらす→落ちた）／ -- sabotage-count（1 件抜く→判定できない）
// 差の 0.1〜0.6 度は歳差（この表は J2000 の黄道、参照はその日の黄道）で、J2000 から離れた日ほど大きい。
// 計算の誤りでない事は、参照も J2000 の黄道に直した差（「参考」の行）で確かめられる。判定には使わない。
import { helio, PLANET_KEYS } from "../src/lib/ephemeris.ts";

const EXPECTED = 40;
const LIMIT_DEG = 1;
const sabotage = process.argv.includes("sabotage");
const sabotageCount = process.argv.includes("sabotage-count");
const wrap = (deg) => Math.abs((((deg % 360) + 540) % 360) - 180);

const DATES = [
  "2026-11-12T00:00:00Z", // 作った日
  "2026-11-20T00:00:00Z", // 発表の日
  "2000-01-01T12:00:00Z", // J2000（表の基準の時刻）
  "2040-06-01T00:00:00Z", // 未来側
  "1990-03-15T00:00:00Z", // 過去側
];

let A;
try {
  A = await import("astronomy-engine");
} catch (e) {
  console.log(
    `判定できない: astronomy-engine を読めない（${e?.message ?? e}）`,
  );
  process.exit(2);
}

const rows = [];
let maxJ2000 = -1;
for (const iso of DATES) {
  const d = new Date(iso);
  for (const key of PLANET_KEYS) {
    if (sabotageCount && key === "neptune" && iso === DATES[0]) continue;
    try {
      const name = key[0].toUpperCase() + key.slice(1);
      const vec = A.HelioVector(A.Body[name], d);
      const ref = A.Ecliptic(vec).elon;
      let mine = helio(key, d).lon;
      if (sabotage && key === "mars") mine += 3;
      const diff = wrap(mine - ref);
      if (Number.isFinite(diff)) rows.push({ iso, key, mine, ref, diff });
      // 参考: 参照も J2000 の黄道に直した差（歳差を除いた、この表そのものの誤差）
      const e = A.RotateVector(A.Rotation_EQJ_ECL(), vec);
      const j = wrap(mine - (Math.atan2(e.y, e.x) * 180) / Math.PI);
      if (Number.isFinite(j)) maxJ2000 = Math.max(maxJ2000, j);
    } catch {
      /* 数に入らない＝件数で拾う */
    }
  }
}

const max = rows.reduce((m, r) => (r.diff > m.diff ? r : m), { diff: -1 });
const perPlanet = PLANET_KEYS.map((k) => {
  const ds = rows.filter((r) => r.key === k).map((r) => r.diff);
  return `${k} ${ds.length ? Math.max(...ds).toFixed(3) : "-"}°`;
});
console.log(
  `件数 ${rows.length}/${EXPECTED}${sabotage ? "（sabotage: 火星を +3°）" : ""}`,
);
console.log(`惑星ごとの最大のずれ: ${perPlanet.join(" / ")}`);
console.log(
  `参考（歳差を除いた差の最大・判定には使わない）: ${maxJ2000.toFixed(3)}°`,
);
const earthToday = rows.find((r) => r.key === "earth" && r.iso === DATES[0]);
if (earthToday)
  console.log(
    `例 ${DATES[0].slice(0, 10)} 地球: この表 ${earthToday.mine.toFixed(2)}° / 参照 ${earthToday.ref.toFixed(2)}°`,
  );

if (rows.length !== EXPECTED) {
  console.log(
    `判定できない: 件数が ${rows.length}（${EXPECTED} 件そろわない）`,
  );
  process.exit(2);
}
if (max.diff > LIMIT_DEG) {
  console.log(
    `落ちた: 最大のずれ ${max.diff.toFixed(3)}°（${max.key} ${max.iso.slice(0, 10)}）> ${LIMIT_DEG}°`,
  );
  process.exit(1);
}
console.log(
  `通った: 最大のずれ ${max.diff.toFixed(3)}°（${max.key} ${max.iso.slice(0, 10)}）≤ ${LIMIT_DEG}°`,
);
process.exit(0);
