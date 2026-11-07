import type { CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

export function newestFirst(articles: Article[]) {
  return articles.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function articlePath(article: Article) {
  return `/artigos/${article.id}/`;
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
