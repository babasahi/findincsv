import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Weekly blog articles live in /blog at the repo root (markdown).
 * Editorial rules are in CLAUDE.md: drafted by the agent as a draft PR,
 * edited and published by a human, real byline, one Arabic long-tail
 * keyword per post, must add something the top results don't have.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    lang: z.enum(['ar', 'en']).default('ar'),
    author: z.string(),
    /** The single Arabic long-tail keyword this post targets. */
    keyword: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

/**
 * Keyword landing pages live in /landing at the repo root. Each targets ONE
 * long-tail query and points to the tool. Structure only — grow slowly.
 */
const landing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './landing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** URL slug (Arabic slugs are fine and rank for Arabic queries). */
    slug: z.string(),
    lang: z.enum(['ar', 'en']).default('ar'),
    keyword: z.string(),
  }),
});

export const collections = { blog, landing };
