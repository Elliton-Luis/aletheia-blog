import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { articlePath, newestFirst } from '../utils/articles';

export async function GET(context: APIContext) {
  const articles = newestFirst(await getCollection('articles'));
  return rss({
    title: 'Aletheia',
    description: 'Pensamentos, reflexões, estudos e descobertas.',
    site: context.site!,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.date,
      link: articlePath(article),
    })),
    customData: '<language>pt-br</language>',
  });
}
