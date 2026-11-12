/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-180.png", "icons/icon.svg", "icons/shortcut-*.png"],
      manifest: {
        name: "Suivi bébé",
        short_name: "Suivi bébé",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#1B1828",
        theme_color: "#1B1828",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Appui long sur l’icône de l’appli (Android) : ouvre directement la saisie (voir useShortcut dans Shell).
        shortcuts: [
          { name: "Repas", short_name: "Repas", url: "/?ajout=repas", icons: [{ src: "/icons/shortcut-repas.png", sizes: "96x96", type: "image/png" }] },
          { name: "Couche", short_name: "Couche", url: "/?ajout=couche", icons: [{ src: "/icons/shortcut-couche.png", sizes: "96x96", type: "image/png" }] },
          { name: "Sommeil", short_name: "Sommeil", url: "/?ajout=sommeil", icons: [{ src: "/icons/shortcut-sommeil.png", sizes: "96x96", type: "image/png" }] },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        // Polices Google gardées en cache : l’appli garde sa typographie hors ligne.
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: "StaleWhileRevalidate", options: { cacheName: "google-fonts-css" } },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node" },
});
