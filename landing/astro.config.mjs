import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";
import { webcore } from "webcoreui/integration";

export default defineConfig({
  site: "https://offergo.ru",
  base: "/promo",
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [webcore(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
