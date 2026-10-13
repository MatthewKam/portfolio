import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    company: z.string(),
    role: z.string(),
    years: z.string(),
    stack: z.array(z.string()),
    order: z.number(),
    recreation: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work };
