# 3D アセット（Blender 制作物）

このプロジェクトで Blender / Blender MCP を使って制作した 3D モデルの編集可能ソース（`.blend`）の保管庫。
本番で使用する書き出し済み `.glb` は [`../public/assets/3d/`](../public/assets/3d/) に置く。

## 本番で使用中（コズミック背景に `useGLTF` で読み込み）

| ソース（3d-assets/） | 書き出し（public/assets/3d/） | 役割 |
|---|---|---|
| `hero-asteroids.blend` | `hero-asteroids.glb` | ヒーロー周辺を漂う小惑星群 |
| `comet-nucleus.blend` | `comet-nucleus.glb` | 彗星の核 |
| `spark-emblem.blend` | `spark-emblem.glb` | spark のエンブレム（宇宙空間に配置） |

いずれも Draco 不使用の無圧縮 GLB（外部デコーダ取得が不要 ＝ 厳格 CSP `'self'` で配信できる）。

## アーカイブ（本番未使用・保全用）

| ファイル | 内容 |
|---|---|
| `hero-torusknot.glb` | 旧 **Editorial Kinetic** 版ヒーローのトーラスノット（236KB・自作 GLSL を適用していた）。git 履歴から復元 |
| `planet.blend` / `planet.glb` | 惑星（Icosphere・1,410 頂点）の実験モデル |

## 制作・運用メモ

- Blender MCP（socket・port 9876）経由で Blender を操作して生成・編集。
- 編集 → 再書き出しの流れ：`*.blend` を Blender で開いて編集 → `File > Export > glTF 2.0 (.glb)` で `public/assets/3d/` へ上書き。
- 本番に載せる GLB は **Draco 圧縮を使わない**（Draco デコーダの外部取得が CSP に抵触するため）。容量はテクスチャ込みで数十 KB に収める。

## ライセンス / 帰属

自作モデル。惑星・宇宙テクスチャの出所は [`../public/assets/planet/CREDITS.txt`](../public/assets/planet/CREDITS.txt) を参照。
