import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({
    base: './src/content/articles',
    pattern: ['**/*.md', '!**/example.md'],
    // O arquivo pode ter um prefixo numérico (ex.: "7.nome-do-ensaio.md") só para organizar
    // a pasta; a URL do ensaio usa apenas o nome, sem o número.
    generateId: ({ entry }) => entry.replace(/\.md$/, '').replace(/^\d+\./, ''),
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    pinned: z.boolean().default(false),
    gravitas: z.enum(['levis', 'modicus', 'gravis']).optional(),
    aphorismus: z.string().optional(),
    resumo: z.string().optional(),
    scholia: z
      .array(
        z.object({
          term: z.string(),
          etymology: z.string(),
          meaning: z.string(),
        })
      )
      .optional(),
  }),
});

export const collections = { articles };
