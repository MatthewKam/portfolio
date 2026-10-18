import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";

export default defineConfig({
	site: "https://portfolio-dun-chi-15.vercel.app/", // TODO: set your real domain
	integrations: [react(), mdx()],
});
