// 惑星の位置（太陽中心・黄道座標）。
// 出典: NASA JPL "Approximate Positions of the Planets" Table 1（1800–2050 年で有効）
//   https://ssd.jpl.nasa.gov/planets/approx_pos.html
// 各惑星の J2000 時点の軌道要素と、1 世紀あたりの変化量から、指定した日時の位置を出す。
// 外部の部品に頼らない。精度は astronomy-engine と比べて 1 度以内（npm run check:ephem・tests/ephemeris.check.mjs）。

export type PlanetKey =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

/** [a(au), e, I(deg), L(deg), 近日点黄経(deg), 昇交点黄経(deg)] */
type Elements = readonly [number, number, number, number, number, number];

const ELEMENTS: Record<PlanetKey, readonly [Elements, Elements]> = {
  mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689,
      -0.12534081,
    ],
  ],
  venus: [
    [
      0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718,
      76.67984255,
    ],
    [
      0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329,
      -0.27769418,
    ],
  ],
  earth: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088,
      -0.29257343,
    ],
  ],
  jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668,
      0.20469106,
    ],
  ],
  saturn: [
    [
      9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831,
      113.66242448,
    ],
    [
      -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216,
      -0.28867794,
    ],
  ],
  uranus: [
    [
      19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763,
      74.01692503,
    ],
    [
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281,
      0.04240589,
    ],
  ],
  neptune: [
    [
      30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227,
      131.78422574,
    ],
    [
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464,
      -0.00508664,
    ],
  ],
};

export const PLANET_KEYS = Object.keys(ELEMENTS) as PlanetKey[];

/** 軌道の大きさ（J2000 時点の軌道長半径・au）。左下の小さな太陽系の図で輪を描くのに使う。 */
export function semiMajorAu(key: PlanetKey): number {
  return ELEMENTS[key][0][0];
}

/**
 * この表が有効な期間（1800〜2050 年。これより外は精度が落ちるので、表示する日付をこの中に収める）。
 * 端は見る人の手元の暦の 1800年1月1日 0時と 2050年12月31日の終わりで決める。
 * 日付の表示と日付の欄が手元の暦なので、世界標準時で決めると、時差のある地域では端の日が前後の日にずれる
 * （アメリカでは 2050年12月31日を選ぶと 12月30日になっていた。2026-11-12 に直した）。
 * 世界標準時の 1800〜2050 年より最大 14 時間はみ出すが、この近似式の誤差に比べれば無視できる。
 */
export const EPHEM_MIN_YEAR = 1800;
export const EPHEM_MAX_YEAR = 2050;
export const EPHEM_MIN_MS = new Date(EPHEM_MIN_YEAR, 0, 1).getTime();
export const EPHEM_MAX_MS = new Date(
  EPHEM_MAX_YEAR,
  11,
  31,
  23,
  59,
  59,
  999,
).getTime();

const D = Math.PI / 180;

export type Helio = { x: number; y: number; z: number; lon: number };

/** 指定した日時の惑星の位置。x,y,z は太陽中心・J2000 黄道座標(au)、lon は黄経(度, 0–360)。 */
export function helio(key: PlanetKey, date: Date | number): Helio {
  const ms = typeof date === "number" ? date : date.getTime();
  const [el, rt] = ELEMENTS[key];
  const T = (ms / 86400000 + 2440587.5 - 2451545.0) / 36525; // J2000 からの世紀数
  const a = el[0] + rt[0] * T;
  const e = el[1] + rt[1] * T;
  const I = el[2] + rt[2] * T;
  const L = el[3] + rt[3] * T;
  const wb = el[4] + rt[4] * T;
  const O = el[5] + rt[5] * T;
  const w = wb - O;
  const M = ((((L - wb) % 360) + 540) % 360) - 180;
  const Mr = M * D;
  let E = Mr + e * Math.sin(Mr);
  for (let k = 0; k < 8; k++)
    E -= (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w * D),
    sw = Math.sin(w * D);
  const cO = Math.cos(O * D),
    sO = Math.sin(O * D);
  const cI = Math.cos(I * D),
    sI = Math.sin(I * D);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;
  return { x, y, z, lon: (((Math.atan2(y, x) / D) % 360) + 360) % 360 };
}
