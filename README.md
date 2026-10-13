# Matt Kam — portfolio

Astro + React islands + MDX.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

## Where things live

- `src/content/work/*.mdx` — one file per case study. Frontmatter schema is in `src/content.config.ts`.
  Set `draft: true` to hide one. `order` controls the list order.
- `src/components/demos/` — live demos (React). Fictional brand: Loam Coffee Co.
- `src/components/Hero.astro` — placeholder hero. The multiplane version replaces this file only;
  the planes are already separate elements with a `--depth` value.
- `src/styles/global.css` — design tokens (color, type scale, spacing).

## TODO before launch

- [ ] Case study copy (search for `TODO (interview` in `src/content/work`)
- [ ] Years for the Recharge projects
- [ ] Public email address in `src/layouts/Base.astro`, LinkedIn URL
- [ ] `public/resume.pdf`
- [ ] Real domain in `astro.config.mjs`
- [ ] Cancellation flow demo, Ad Exchange screenshots
