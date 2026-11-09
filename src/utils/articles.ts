import type { CollectionEntry } from 'astro:content';
import { CURATED_ARTICLE_META, type CuratedMeta, type ScholiaItem } from '../data/curatedArticleMeta';

export type Article = CollectionEntry<'articles'>;
export type { ScholiaItem, CuratedMeta };

export function newestFirst(articles: Article[]) {
  return articles.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Ensaios marcados com `pinned: true`, do mais novo para o mais antigo. Não remove nada da lista original — é só uma seleção. */
export function pinnedArticles(articles: Article[]) {
  return newestFirst(articles.filter((article) => article.data.pinned));
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

export type GravitasLevel = 'levis' | 'modicus' | 'gravis';

export interface GravitasInfo {
  level: GravitasLevel;
  label: string;
  icon: string;
  multiplier: number;
  hint: string;
}

export const GRAVITAS_CONFIG: Record<GravitasLevel, GravitasInfo> = {
  levis: {
    level: 'levis',
    label: 'Levis',
    icon: '🪶',
    multiplier: 1.0,
    hint: 'Levis (Leve): Texto fluido, narrativo, focado no cotidiano e frases curtas.',
  },
  modicus: {
    level: 'modicus',
    label: 'Modicus',
    icon: '⚖️',
    multiplier: 1.2,
    hint: 'Modicus (Moderado): Ensaio analítico, estrutura clara de tese/antítese, vocabulário culto.',
  },
  gravis: {
    level: 'gravis',
    label: 'Gravis',
    icon: '🧭',
    multiplier: 1.5,
    hint: 'Gravis (Denso): Altamente filosófico ou técnico, conceitos abstratos, exige releitura.',
  },
};

export interface AnalogStage {
  name: string;
  icon: string;
  description: string;
  weightedMinutes: number;
}

export function computeAnalogTime(characters: number, gravitasLevel: GravitasLevel): AnalogStage {
  const baseMinutes = characters / 1200;
  const multiplier = GRAVITAS_CONFIG[gravitasLevel].multiplier;
  const weightedMinutes = Math.max(1, Math.round(baseMinutes * multiplier));

  if (weightedMinutes <= 3) {
    return {
      name: 'Centelha',
      icon: '🪔',
      description: '1 a 3 min (Foco rápido)',
      weightedMinutes,
    };
  }
  if (weightedMinutes <= 7) {
    return {
      name: 'Vela',
      icon: '🕯️',
      description: '4 a 7 min (Leitura atenta)',
      weightedMinutes,
    };
  }
  if (weightedMinutes <= 14) {
    return {
      name: 'Lampião',
      icon: '🏮',
      description: '8 a 14 min (Imersão reflexiva)',
      weightedMinutes,
    };
  }
  return {
    name: 'Lareira',
    icon: '🔥',
    description: '15+ min (Estudo profundo)',
    weightedMinutes,
  };
}

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
  const text = plainText(article.body ?? '');
  const characters = text.length;
  const minutes = Math.max(1, Math.ceil((characters / 1200) * 1.1));
  const category = categories.find(({ max }) => characters <= max) ?? categories[categories.length - 1];

  const curated = CURATED_ARTICLE_META[article.id];
  const gravitasLevel: GravitasLevel = article.data.gravitas ?? curated?.gravitas ?? 'modicus';
  const gravitas = GRAVITAS_CONFIG[gravitasLevel];
  const analogTime = computeAnalogTime(characters, gravitasLevel);
  const aphorismus = article.data.aphorismus ?? curated?.aphorismus ?? '';
  const resumo = article.data.resumo ?? curated?.resumo ?? '';
  const scholia: ScholiaItem[] = article.data.scholia ?? curated?.scholia ?? [];

  return {
    ...category,
    characters,
    minutes,
    formatted: new Intl.NumberFormat('pt-BR').format(characters),
    title: `${category.label}: ${category.hint}`,
    gravitas,
    analogTime,
    aphorismus,
    resumo,
    scholia,
  };
}
