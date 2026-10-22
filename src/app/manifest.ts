import type { MetadataRoute } from "next";

// ホーム画面に追加 (ブックマーク) した時のアプリ名・アイコン
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aether League™",
    short_name: "Aether League",
    description: "8人のレジェンドと、頂点のエーテルへ。ブラウザで動く3D MOBA。",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#05070f",
    theme_color: "#05070f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
