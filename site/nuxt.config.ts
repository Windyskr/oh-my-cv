import { pwa } from "./configs/pwa";
import { i18n } from "./configs/i18n";
import { fileURLToPath } from "node:url";

const localBuild = process.env.RESUME_LOCAL_BUILD === "1";
const localFeatures = localBuild || process.env.NODE_ENV !== "production";
const siteUrl = process.env.NUXT_SITE_URL || "https://ohmycv.app";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: "src/",
  devtools: { enabled: false },
  sourcemap: { server: false, client: false },

  nitro: localBuild
    ? { output: { dir: fileURLToPath(new URL("./.output-local", import.meta.url)) } }
    : {},

  hooks: {
    "pages:extend"(pages) {
      if (localFeatures) return;
      for (let index = pages.length - 1; index >= 0; index--) {
        if (/\/pages\/(local|pdf-render)\.vue$/.test(pages[index].file || ""))
          pages.splice(index, 1);
      }
    }
  },

  modules: [
    "@vueuse/nuxt",
    "@unocss/nuxt",
    "@pinia/nuxt",
    "@nuxtjs/i18n",
    "@nuxtjs/color-mode",
    "@vite-pwa/nuxt",
    "nuxt-simple-sitemap",
    "radix-vue/nuxt",
    "shadcn-nuxt"
  ],

  css: [
    "@unocss/reset/tailwind.css",
    "katex/dist/katex.min.css",
    "~/assets/css/index.css"
  ],

  i18n,

  shadcn: {
    prefix: "Ui",
    componentDir: "./src/components/ui"
  },

  runtimeConfig: {
    localFilesEnabled: localFeatures,
    public: {
      localFeatures,
      googleFontsKey: ""
    }
  },

  colorMode: {
    classSuffix: ""
  },

  app: {
    head: {
      viewport: "width=device-width,initial-scale=1",
      link: [
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "mask-icon", href: "/safari-pinned-tab.svg", color: "#222" }
      ],
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "application-name", content: "Oh My CV!" },
        { name: "apple-mobile-web-app-title", content: "Oh My CV!" },
        { name: "msapplication-TileColor", content: "#fff" },
        { property: "og:url", content: siteUrl },
        { property: "og:type", content: "website" }
      ]
    }
  },

  site: {
    url: siteUrl
  },

  sitemap: { enabled: !localFeatures },
  pwa: { ...pwa, disable: localFeatures }
});
