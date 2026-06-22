# 3D アセット（Blender 制作物の保管）

このプロジェクトで Blender / Blender MCP を使って制作した 3D モデルの保管庫。
本番サイト（コズミック版）の 3D 背景は **手続き的ジオメトリ + 自作 GLSL** で構成しており、これらの `.glb` は直接は読み込んでいない。制作物を失わないためのアーカイブとして残す。

## ファイル

| ファイル | 内容 | 用途 |
|---|---|---|
| `hero-torusknot.glb` | トーラスノット（236KB・glTF binary v2・無圧縮 / Draco 不使用 = CSP `'self'` 運用のため） | 旧 **Editorial Kinetic** 版ヒーローで使用。自作 GLSL（墨 + 電撃ブルー）を適用していた。現在は本番から外し git 履歴に保持していたものを復元 |
| `planet.blend` | 惑星（Icosphere・1,410 頂点 / 2,816 ポリゴン）の編集可能ソース | Blender で再編集する場合の元データ |
| `planet.glb` | 上記惑星のエクスポート（67KB） | 配布 / 読み込み用 |

## 制作方法

- Blender MCP（socket 接続・port 9876）経由で Blender を操作して生成・編集。
- トーラスノットは Editorial 期に生成し `public/models/hero.glb` として組み込んでいた（その後の整理で本番から除外）。
- 惑星は Blender 上の Icosphere をベースにした実験モデル。

## 使い方

- Blender で開く: `planet.blend` をダブルクリック、または Blender から開く。
- コードから読み込む（必要時）: three.js / R3F の `useGLTF("/...glb")` 等。本番に載せる場合は `public/` 配下へ配置し、容量と CSP（Draco デコーダ等の外部取得）に注意。

## ライセンス / 帰属

自作モデル。惑星表面テクスチャの出所は [`../public/assets/planet/CREDITS.txt`](../public/assets/planet/CREDITS.txt) を参照。
