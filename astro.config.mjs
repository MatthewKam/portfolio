import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";

export default defineConfig({
	// The live domain. The Vercel URL (portfolio-dun-chi-15.vercel.app) serves the same build;
	// canonical links in Base.astro point search engines here.
	site: "https://mattkam.dev",
	integrations: [react(), mdx()],
	// The depth view became the home page; keep old links working.
	redirects: { "/depth": "/" },
});
