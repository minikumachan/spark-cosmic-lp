import "astro";

declare module "astro" {
  interface AstroClientDirectives {
    /** 最初の表示の後、手の空いた時に読み込む（src/directives/afterpaint.ts） */
    "client:afterpaint"?: boolean;
  }
}
