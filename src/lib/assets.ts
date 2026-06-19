// public/assets 配下の素材パス解決ヘルパ（SVG優先）。
const BASE = "/assets";

export const assetIcon = (name: string) => `${BASE}/icons/svg/${name}.svg`;
export const assetShape = (name: string) => `${BASE}/shapes/svg/${name}.svg`;
export const assetUi = (name: string) => `${BASE}/ui/svg/${name}.svg`;

/** Retina PNG が必要な箇所用（@4x 240px）。 */
export const assetIconPng = (name: string) => `${BASE}/icons/png/${name}@4x.png`;
export const assetShapePng = (name: string) => `${BASE}/shapes/png/${name}@4x.png`;
