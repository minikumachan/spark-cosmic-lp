# Mac 切替ハンドオフ（Blender 3D ＋ Adobe Firefly）

Windows では実施できない 2 つ（Blender MCP・Firefly 生成）を Mac で行うための手順。
**これらは「修正」ではなく品質を一段押し上げる強化**（現状でも本番品質：手続き型3Dブロブ＋ブランドOGは完成済み）。

---

## A. 切替前チェック（重要・.git 破損防止）
1. **Windows 側の Claude を完全終了**（Win/Mac 同時起動は `.git` を壊す）。[[claude-history-sharing-setup]]
2. Syncthing が `Design_LP` を**完全同期**するまで待つ（最新コミットが Mac に届いていること）。
3. Mac で `git log --oneline -3` が Windows と一致するか確認してから着手。

直近コミット基点（このハンドオフ作成時点・clean）:
`feat: OG画像生成＋Mac/Blenderハンドオフ` の手前まで Windows で完了済み。

---

## B. Mac で再開
Mac の Claude を起動し、次のように依頼:
> 「Design_LP の Mac 作業を再開。docs/ai/setup/HANDOFF_MAC_BLENDER.md の B〜D を実施して」

Node は Mac でも 22 系を使う（`node -v` ≥ 22.12）。`npm i` 済みでなければ実行。

---

## C. Blender MCP → カスタム3D（任意の見せ場強化）
**現状**: `src/components/three/HeroScene.tsx` が `icosahedronGeometry` ＋ 自作GLSL
（simplexノイズ変位＋フレネルリムグロー）で有機ブロブを描画。これ自体が高品質。

**強化案**: Blender で spark らしい bespoke 造形（火花/結晶/流体など）を作り GLB 化して差替。

手順:
1. Blender 起動 → MCP アドオン有効 → **Claude 再起動**（MCP は起動中のみ接続）。
2. 造形 → **glTF(.glb) でエクスポート**。必ず **Draco 圧縮**ON、ポリゴンは控えめに。
   出力先: `public/models/hero.glb`（**目標 < 300KB**。LCP/perf 予算を守る）。
3. 統合（`HeroScene.tsx`）— `icosahedronGeometry` の mesh を GLB に差し替える例:
   ```tsx
   import { useGLTF, Float } from "@react-three/drei";
   // useGLTF.preload("/models/hero.glb");
   function HeroModel() {
     const { nodes } = useGLTF("/models/hero.glb");
     const mat = useRef<THREE.ShaderMaterial>(null);
     useFrame((_, d) => { if (mat.current) mat.current.uniforms.uTime.value += d; });
     return (
       <mesh geometry={(nodes.Hero as THREE.Mesh).geometry}>
         {/* 自作シェーダを流用するなら shaderMaterial を、質感を出すなら GLB のマテリアルを使う */}
         <shaderMaterial ref={mat} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} />
       </mesh>
     );
   }
   ```
   - drei `useGLTF` は Draco 対応。`Hero3D.tsx` の WebGL/reduced-motion ガードと遅延ロードはそのまま活きる。
   - GLB は `public/models/` 直下（Astro が dist へコピー）。
4. **検証**: 実ブラウザ `npm run dev` で描画確認 → `npm run build` → `npm run lhci`
   （**perf≥95 / CLS=0 を維持**。GLB が重く LCP 悪化するなら減ポリ/Draco強化）。

> 差し替えない判断も有り。手続き型ブロブは「見えない技術力」として十分に強い。

---

## D. Adobe Firefly → 画像（OG リッチ版・実績ビジュアル）
**現状**:
- OG = `public/assets/og/og-default.png`（ブランドOG生成済み・本番可）。Firefly で**リッチ版に差替**可。
  同じパスに上書き保存すれば `seo.ts` の参照は変更不要（1200×630・PNG/JPG）。
- 実績(Works) = `src/components/sections/Works.astro` が CSS グラデの抽象ビジュアル。
  実写/作品サムネに差し替えると説得力UP。

手順（Works 画像を入れる場合）:
1. Firefly で 6 件分の作品ビジュアルを生成（**4:3**、各テーマに合う色）。
2. **AVIF or WebP** で書き出し、`public/assets/works/<slug>.avif` に保存（各 **< 120KB** 目安）。
3. 配線: `src/content.config.ts` の works スキーマに `image` を足し、各 `src/data/works/*.yaml`(または md) に
   パスを記入 → `Works.astro` の `.work-visual` 内 `<img>` を実画像に差し替え（`loading="lazy"` 維持）。
   Astro の `<Image>`(astro:assets) を使うと最適化/レスポンシブが自動。
4. **検証**: `npm run build` → `npm run lhci`（画像系監査 score=1 維持、CLS=0、`width/height` 必須でリフロー防止）。

---

## E. 完了後
- `npm run check`(0/0/0) / `npm run test:e2e`(4/4) / `npm run lhci`(perf≥95/a11y100/CLS≤0.005) を再確認。
- コミット後、**Mac の Claude を終了**してから Windows に戻る（同時起動禁止）。
- メモリ `design-lp-spark-dev-env` の進捗行を更新。
