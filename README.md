# Aletheia · Caderno de Ensaios

**Aletheia** é um caderno digital de ensaios filosóficos, leituras e investigações sobre conhecimento, razão e sociedade. Construído como um site estático de altíssima performance utilizando [Astro](https://astro.build), tipografia composta na família *Literata* e diagramação editorial minimalista.

---

## Recursos e Funcionalidades

### 1. Arquivo e Leitura de Ensaios (`/ensaios/`)
- **Virtualização de Lista**: Rola centenas de publicações com fluidez instantânea, reciclando nós do DOM para manter o consumo de memória baixo e preservar a posição de leitura.
- **Filtros Combinados em Tempo Real**:
  - **Busca**: Localiza por título, descrição ou tags.
  - **Período**: Filtro por data inicial e final.
  - **Filtro de Complexidade**: Alterna instantaneamente entre `Todos`, `Simples` (*Levis*), `Médio` (*Modicus*) e `Complexo` (*Gravis*).
- **Tempo de Leitura Ponderado**: O cálculo de tempo não se limita a caracteres brutos; ele aplica multiplicadores de densidade (*Gravitas*) conforme a complexidade e abstração do vocabulário do ensaio.

### 2. Diagramação dos Ensaios
- **Atalho para a Síntese**: Link em destaque no topo do artigo (*"Não tem tempo para ler tudo agora? **Ir direto para a síntese ↓**"*), permitindo saltar diretamente para a síntese.
- **Índice Lateral (TOC)**: Acompanha a rolagem destacando a seção ativa e os títulos `##` e `###`.
- **Scholia (Glossário Etimológico)**: Destaque sutil com etimologia grega/latina de termos filosóficos e técnicos.
- **Aphorismus & Síntese**: O fechamento do ensaio traz uma citação verbatim do próprio autor destacando o núcleo da tese, seguida por um resumo objetivo do conteúdo (com aviso discreto de auxílio de IA).

### 3. Antologia & Livreto Personalizado (`/antologia/`)
- **Monte seu Livrinho**: O leitor pode personalizar seu próprio volume encadernado:
  - Seleção de **até 10 ensaios** entre os 20 mais recentes (ou via barra de busca).
  - A capa, o sumário geral com numeração romana (`Capítulo I`, `II`... `X`) e o colofão atualizam em tempo real.
- **Baixar PDF (A4 Sequencial)**:
  - Formato tradicional de leitura contínua, com numeração de páginas exclusiva no canto superior direito (`@top-right`), quebras de página por capítulo e zero sobreposição.
- **Livreto A5 (Dobra & Grampo)**:
  - **Imposição Booklet 2-Up**: Em cada folha A4 em paisagem, cabem duas páginas A5 (Folha 1 Frente: contracapa + capa; Folha 1 Verso: pág 2 + penúltima... até o miolo).
  - **Conversor Integrado com `pdf-lib`**: Permite arrastar o PDF gerado para convertê-lo instantaneamente no navegador para um PDF booklet imposto pronto para impressão duplex (virar na borda curta) e dobra.

### 4. Navegação e Interface
- **Barra Superior Objetiva**: Exibe diretamente os acessos prioritários: `Ensaios`, `Assuntos` e o alternador de `Tema` (claro/escuro persistente).
- **Menu Dropdown "Mais"**: Agrupa `Antologia`, `Sobre` e o atalho de `Imprimir` (quando na página de leitura).

### 5. Redação Móvel via Telegram Bot (`telegram-bot/`)
- Bot serverless hospedado em Cloudflare Workers conectado à API do GitHub e Cloudflare Workers AI.
- **Fluxo de Edição Fluido**: O comando `/editar` envia primeiro as instruções e, em seguida, o texto do ensaio dividido em blocos que respeitam cabeçalhos (`##`), permitindo edição direta pelo chat do celular sem anexos incômodos.
- Comandos analíticos: `/analise` (análise por duas IAs independentes), `/contrapor` (debate socrático), `/card` (gera card editorial SVG em alta definição), `/ideia` (caderno de rascunhos em KV), `/status` e `/publicar`.

---

## Como Começar Localmente

O projeto inclui o runtime Node.js 22 como dependência para garantir compatibilidade idêntica ao ambiente de produção.

```sh
# Instala as dependências
npm install

# Inicia o servidor local de desenvolvimento
npm run dev
```

Acesse `http://localhost:4321` no navegador.

---

## Criar um Novo Ensaio

```sh
npm run criar:ensaio --nome "Título do seu ensaio"
```

O script criará automaticamente o arquivo em `src/content/articles/` com a numeração sequencial correta (ex.: `0011.titulo-do-seu-ensaio.md`) e o frontmatter preenchido:

```markdown
---
title: "Título do seu ensaio"
date: 2026-11-09T08:00:00Z
description: "Uma breve descrição editorial."
tags: ["filosofia", "sociedade"]
pinned: false
gravitas: "modicus" # levis | modicus | gravis
---

Texto do ensaio aqui...
```

Para mais detalhes, consulte:
- [Guia de Comandos](docs/guia-comandos.md)
- [Guia de Formatação Markdown](docs/guia-markdown.md)

---

## Build e Validação

```sh
# Executa a verificação estrita de tipos do Astro e gera o site em dist/
npm run build
```

---

## Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Na Vercel, clique em **Add New → Project** e selecione o repositório.
3. Framework Preset: **Astro**.
4. Node.js Version: **22.x**.
5. Build Command: `npm run build` | Output Directory: `dist`.
6. O deploy é 100% estático, com suporte a RSS (`/rss.xml`) e Sitemap (`/sitemap-index.xml`).

---

## Licença e Autoria

Textos e ensaios por **O Eleito**. Todos os direitos reservados.
