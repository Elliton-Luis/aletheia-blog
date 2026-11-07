import type { CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

export function newestFirst(articles: Article[]) {
  return articles.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function articlePath(article: Article) {
  return `/ensaios/${article.id}/`;
}

export function allTags(articles: Article[]) {
  return [...new Set(articles.flatMap(({ data }) => data.tags))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

const categories = [
  { name: 'Fragmentum', label: 'Fragmento', max: 1500, hint: 'Reflexão rápida ou ideia inicial' },
  { name: 'Opusculum', label: 'Opúsculo', max: 4000, hint: 'Ensaio curto, com um único argumento central' },
  { name: 'Opus Minus', label: 'Obra Menor', max: 8000, hint: 'Formato intermediário, de consumo rápido' },
  { name: 'Opus', label: 'A Obra', max: 15000, hint: 'Ensaio padrão, com desenvolvimento completo' },
  { name: 'Opus Maius', label: 'Obra Maior', max: 30000, hint: 'Ensaio aprofundado, sobre várias facetas de um tema' },
  { name: 'Magnum Opus', label: 'Magnum Opus', max: Infinity, hint: 'Ensaio definitivo ou manifesto' },
];

export function plainText(markdown: string) {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Conta os caracteres (com espaços) e estima o tempo de leitura: 1200 caracteres por minuto + 10% de margem, mínimo de 1 minuto. */
export function readingTime(text: string) {
  const characters = text.length;
  const minutes = Math.max(1, Math.ceil((characters / 1200) * 1.1));
  return { characters, minutes };
}

export function classify(article: Article) {
  const { characters, minutes } = readingTime(plainText(article.body ?? ''));
  const category = categories.find(({ max }) => characters <= max) ?? categories[categories.length - 1];
  return {
    ...category,
    characters,
    minutes,
    formatted: new Intl.NumberFormat('pt-BR').format(characters),
    title: `${category.label}: ${category.hint}`,
  };
}
