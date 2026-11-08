// Bot do Telegram para criar e editar ensaios do blog Aletheia pelo celular.
// Roda num Cloudflare Worker (grátis). O PC não participa de nada disso.
//
// Arquitetura (igual à ideia original): Telegram -> Worker -> GitHub (API) -> Vercel (deploy automático).
// Adaptado a este projeto: pasta src/content/articles, frontmatter com
// title/date/description/tags/pinned, numeração automática dos arquivos
// (N.nome.md, como o scripts/criar-ensaio.sh já faz) e validação do
// frontmatter antes de qualquer commit, para nunca mandar pro ar um ensaio
// que quebre o build (astro check) por faltar um campo obrigatório.

const AJUDA = `📝 Ensaio novo: mande um arquivo .md.
   • Com frontmatter completo (title, date, description): publica como está, só ajusto a numeração do arquivo.
   • Sem frontmatter: uso o primeiro "# Título" e a data de hoje, e te pergunto a descrição.
✏️ Editar ensaio: /editar lista os ensaios, /editar palavra filtra pelo nome. Mando o arquivo, você edita no celular e manda de volta.

Antes de qualquer commit você vê uma prévia e confirma.
/cancelar desiste do que estiver em andamento.`;

const POR_PAGINA = 8;

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("ok");

    // Só aceita chamadas vindas do Telegram (segredo definido no setWebhook)
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    const update = await request.json();
    // Responde 200 na hora e processa em segundo plano
    ctx.waitUntil(handleUpdate(update, env).catch((err) => console.error(err)));
    return new Response("ok");
  },
};

// =====================================================================
// Mensagens
// =====================================================================

class PostError extends Error {}

async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(update.callback_query, env);

  const msg = update.message;
  if (!msg) return;

  // Whitelist: ignora qualquer pessoa que não seja você
  if (String(msg.from?.id) !== String(env.ALLOWED_USER_ID)) return;
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (text === "/start" || text === "/ajuda") return send(env, chatId, AJUDA);

  if (text === "/cancelar") {
    await env.KV.delete(sessionKey(chatId));
    return send(env, chatId, "🗑️ Cancelado.");
  }

  if (text?.startsWith("/editar")) {
    const termo = text.replace("/editar", "").trim().toLowerCase();
    return startEditList(env, chatId, termo);
  }

  const session = await env.KV.get(sessionKey(chatId), "json");

  // Esperando a descrição de um ensaio novo sem frontmatter
  if (session?.mode === "awaiting-description") {
    if (!text) return send(env, chatId, "Preciso de uma frase curta para a descrição, ou /cancelar.");
    const markdown = buildMarkdown(session.title, session.date, text, session.body);
    const post = { mode: "new", title: session.title, path: session.path, markdown };
    await saveSession(env, chatId, post);
    return sendNewPreview(env, chatId, post);
  }

  // Esperando o arquivo editado: só aceita documento
  if (session?.mode === "editing" || session?.mode === "edit-ready") {
    if (!msg.document) {
      return send(env, chatId, `Estou esperando o arquivo editado de ${session.path}.\nMande o .md ou use /cancelar.`);
    }
    const content = normalize(await downloadFile(env, msg.document.file_id));
    return receiveEdit(env, chatId, session, content);
  }

  // Caso contrário: ensaio novo (só por arquivo — texto solto não vira ensaio)
  if (!msg.document) {
    if (text) return send(env, chatId, "Para criar um ensaio, mande um arquivo .md. Veja /ajuda.");
    return;
  }
  const filename = msg.document.file_name || "";
  if (!/\.md$/i.test(filename)) return send(env, chatId, "Mande um arquivo .md.");
  const content = await downloadFile(env, msg.document.file_id);

  let post;
  try {
    post = await prepareNewPost(content, env);
  } catch (e) {
    if (e instanceof PostError) return send(env, chatId, `⚠️ ${e.message}`);
    throw e;
  }

  if (post.mode === "awaiting-description") {
    await saveSession(env, chatId, post);
    return send(env, chatId, `Preciso de uma descrição curta (uma frase) para "${post.title}". Responda com ela, ou /cancelar.`);
  }

  await saveSession(env, chatId, post);
  await sendNewPreview(env, chatId, post);
}

// =====================================================================
// Botões
// =====================================================================

async function handleCallback(cq, env) {
  const chatId = cq.message.chat.id;
  await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  if (String(cq.from.id) !== String(env.ALLOWED_USER_ID)) return;

  const data = cq.data;

  // Trocar de página na lista de ensaios
  if (data.startsWith("pg:")) {
    const page = Number(data.slice(3));
    const list = await env.KV.get(listKey(chatId), "json");
    if (!list) return send(env, chatId, "A lista expirou. Use /editar de novo.");
    return tg(env, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: cq.message.message_id,
      reply_markup: listKeyboard(list.paths, page),
    });
  }

  // Escolheu um ensaio para editar
  if (data.startsWith("ed:")) {
    const list = await env.KV.get(listKey(chatId), "json");
    const path = list?.paths[Number(data.slice(3))];
    if (!path) return send(env, chatId, "A lista expirou. Use /editar de novo.");
    return sendFileForEditing(env, chatId, path);
  }

  if (data === "descartar") {
    await env.KV.delete(sessionKey(chatId));
    return send(env, chatId, "🗑️ Descartado.");
  }

  if (data === "publicar") {
    const s = await env.KV.get(sessionKey(chatId), "json");
    if (!s || (s.mode !== "new" && s.mode !== "edit-ready")) {
      return send(env, chatId, "Não há nada pendente para publicar.");
    }

    // Última checagem antes de ir pro ar: nunca publicar frontmatter incompleto.
    const problemas = validateFrontmatter(s.markdown);
    if (problemas.length) {
      return send(env, chatId, `⚠️ Isso quebraria o build do site. Faltou no frontmatter: ${problemas.join(", ")}.`);
    }

    try {
      if (s.mode === "new") {
        await commitFile(env, s.path, s.markdown, `novo: ${fileName(s.path)}`);
        await send(env, chatId, `✅ Publicado em ${s.path}\nO deploy na Vercel deve começar em instantes.`);
      } else {
        await commitFile(env, s.path, s.markdown, `revisão: ${fileName(s.path)}`, s.sha);
        await send(env, chatId, `✅ ${s.path} atualizado.\nO deploy na Vercel deve começar em instantes.`);
      }
      await env.KV.delete(sessionKey(chatId));
    } catch (e) {
      await send(env, chatId, `Erro ao publicar: ${e.message}`);
    }
  }
}

// =====================================================================
// Ensaio novo
// =====================================================================

function buildMarkdown(title, date, description, body) {
  return `---\ntitle: ${JSON.stringify(title)}\ndate: ${date}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}`;
}

async function prepareNewPost(raw, env) {
  const md = normalize(raw);
  const { data: fm, body } = parseFrontmatter(md);

  if (fm) {
    // Já tem frontmatter: exige os campos obrigatórios do schema do blog.
    const title = extractField(fm, "title");
    const date = extractField(fm, "date");
    const description = extractField(fm, "description");
    const faltando = [];
    if (!title) faltando.push("title");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) faltando.push("date (formato AAAA-MM-DD)");
    if (!description) faltando.push("description");
    if (faltando.length) {
      throw new PostError(`Faltou no frontmatter: ${faltando.join(", ")}.\nCorrija o arquivo e mande de novo.`);
    }
    const number = await nextNumber(env);
    const slug = slugify(title);
    return { mode: "new", title, path: `${env.CONTENT_PATH}/${number}.${slug}.md`, markdown: md };
  }

  // Sem frontmatter: título do primeiro "# Título" (ou "Sem título"), data de
  // hoje, e a descrição é perguntada depois — não dá pra inventar uma boa.
  const h1 = body.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1].trim() : "Sem título";
  const bodyWithoutH1 = h1 ? body.replace(h1[0], "").trim() + "\n" : body;
  const date = new Date().toISOString().slice(0, 10);
  const number = await nextNumber(env);
  const slug = slugify(title);
  return {
    mode: "awaiting-description",
    title,
    date,
    body: bodyWithoutH1,
    path: `${env.CONTENT_PATH}/${number}.${slug}.md`,
  };
}

async function sendNewPreview(env, chatId, post) {
  const body = post.markdown.length > 1500 ? post.markdown.slice(0, 1500) + "\n[…]" : post.markdown;
  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: `📝 Ensaio novo: ${post.title}\n📄 ${post.path}\n\n${body}`,
    reply_markup: confirmKeyboard(),
  });
}

// =====================================================================
// Edição de ensaio existente
// =====================================================================

async function startEditList(env, chatId, termo) {
  let paths;
  try {
    paths = await listPosts(env);
  } catch (e) {
    return send(env, chatId, `Erro ao listar ensaios: ${e.message}`);
  }
  if (termo) paths = paths.filter((p) => fileName(p).toLowerCase().includes(termo));
  if (!paths.length) return send(env, chatId, "Nenhum ensaio encontrado.");

  // Guarda a lista por 1 hora para os botões poderem se referir a ela pelo número
  await env.KV.put(listKey(chatId), JSON.stringify({ paths }), { expirationTtl: 3600 });

  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: `✏️ Qual ensaio você quer editar? (${paths.length} encontrado${paths.length > 1 ? "s" : ""})`,
    reply_markup: listKeyboard(paths, 0),
  });
}

function listKeyboard(paths, page) {
  const start = page * POR_PAGINA;
  const rows = paths.slice(start, start + POR_PAGINA).map((p, i) => [
    { text: fileName(p).replace(/\.md$/i, "").slice(0, 60), callback_data: `ed:${start + i}` },
  ]);
  const nav = [];
  if (page > 0) nav.push({ text: "◀️ Anterior", callback_data: `pg:${page - 1}` });
  if (start + POR_PAGINA < paths.length) nav.push({ text: "Próxima ▶️", callback_data: `pg:${page + 1}` });
  if (nav.length) rows.push(nav);
  return { inline_keyboard: rows };
}

async function sendFileForEditing(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }

  // O sha identifica a versão exata que você baixou (evita sobrescrever uma
  // edição feita pelo PC enquanto você editava pelo celular).
  await saveSession(env, chatId, { mode: "editing", path, sha: file.sha, original: file.text });

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", `✏️ ${path}\n\nEdite e mande o arquivo de volta aqui. /cancelar para desistir.`);
  form.append("document", new File([file.text], fileName(path), { type: "text/markdown" }));
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendDocument`, { method: "POST", body: form });
}

async function receiveEdit(env, chatId, session, content) {
  const problemas = validateFrontmatter(content);
  if (problemas.length) {
    return send(env, chatId, `⚠️ Isso quebraria o build do site. Faltou no frontmatter: ${problemas.join(", ")}.\nCorrija e mande o arquivo de novo, ou /cancelar.`);
  }

  const { added, removed } = diffLines(session.original, content);
  if (!added.length && !removed.length) {
    return send(env, chatId, "Não encontrei nenhuma alteração em relação ao original. Edite e mande de novo, ou /cancelar.");
  }

  await saveSession(env, chatId, { ...session, mode: "edit-ready", markdown: content });

  const mostra = (lines, sinal) =>
    lines.slice(0, 12).map((l) => `${sinal} ${l.slice(0, 120)}`).join("\n") +
    (lines.length > 12 ? `\n${sinal} …mais ${lines.length - 12}` : "");

  let text = `✏️ Atualizar ${session.path}\n➕ ${added.length} linha(s)  ➖ ${removed.length} linha(s)\n`;
  if (removed.length) text += `\nRemovido:\n${mostra(removed, "−")}\n`;
  if (added.length) text += `\nAdicionado:\n${mostra(added, "+")}\n`;
  if (text.length > 3900) text = text.slice(0, 3900) + "\n[…]";

  await tg(env, "sendMessage", { chat_id: chatId, text, reply_markup: confirmKeyboard() });
}

// Diferença simples: linhas que aparecem a mais em um lado do que no outro.
// Não é um diff "de verdade" (não percebe reordenação), mas é suficiente para
// conferir uma edição antes de publicar.
function diffLines(a, b) {
  const contar = (arr) => arr.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const A = contar(a.split("\n"));
  const B = contar(b.split("\n"));
  const sobras = (lines, outro) => {
    const usados = new Map();
    return lines.filter((l) => {
      const n = (usados.get(l) || 0) + 1;
      usados.set(l, n);
      return n > (outro.get(l) || 0) && l.trim() !== "";
    });
  };
  return { added: sobras(b.split("\n"), A), removed: sobras(a.split("\n"), B) };
}

// =====================================================================
// Frontmatter
// =====================================================================

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: null, body: md };
  return { data: m[1], body: md.slice(m[0].length) };
}

function extractField(fm, name) {
  const m = fm.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "") || null;
}

// Garante que title, date e description existem e a data está no formato
// certo — os três são obrigatórios no schema do blog (content.config.ts).
function validateFrontmatter(markdown) {
  const { data } = parseFrontmatter(normalize(markdown));
  if (!data) return ["frontmatter ausente (o arquivo precisa começar e terminar o bloco com `---`)"];
  const problemas = [];
  if (!extractField(data, "title")) problemas.push("title");
  const date = extractField(data, "date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) problemas.push("date (formato AAAA-MM-DD)");
  if (!extractField(data, "description")) problemas.push("description");
  return problemas;
}

// =====================================================================
// GitHub
// =====================================================================

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "aletheia-telegram-bot",
  };
}

function ghUrl(env, path) {
  return `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
}

async function listPosts(env) {
  const res = await fetch(`${ghUrl(env, env.CONTENT_PATH)}?ref=${env.GITHUB_BRANCH}`, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const items = await res.json();
  return items
    .filter((i) => i.type === "file" && /\.md$/i.test(i.name) && i.name !== "example.md")
    .map((i) => i.path)
    .sort();
}

// Maior prefixo numérico (N.nome.md) já usado na pasta, mais um — igual ao
// scripts/criar-ensaio.sh local.
async function nextNumber(env) {
  const paths = await listPosts(env);
  let max = 0;
  for (const p of paths) {
    const m = fileName(p).match(/^(\d+)\./);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

async function getFile(env, path) {
  const res = await fetch(`${ghUrl(env, path)}?ref=${env.GITHUB_BRANCH}`, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.content) throw new Error("arquivo grande demais para a API (acima de 1 MB) — não deveria acontecer com um ensaio.");
  return { sha: data.sha, text: normalize(fromBase64(data.content)) };
}

// Sem sha: cria arquivo novo. Com sha: atualiza a versão exata que você baixou.
async function commitFile(env, path, markdown, message, sha) {
  const body = { message, content: toBase64(markdown), branch: env.GITHUB_BRANCH };
  if (sha) body.sha = sha;

  const res = await fetch(ghUrl(env, path), { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });

  if (res.status === 409 || (sha && res.status === 422)) {
    throw new Error("o arquivo mudou no GitHub depois que você baixou. Use /editar para pegar a versão atual e refaça a edição.");
  }
  if (res.status === 422) {
    throw new Error("provavelmente já existe um ensaio com esse nome. Use /editar para alterá-lo.");
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

// =====================================================================
// Telegram
// =====================================================================

async function downloadFile(env, fileId) {
  const r = await tg(env, "getFile", { file_id: fileId });
  const { result } = await r.json();
  const f = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${result.file_path}`);
  return f.text();
}

function confirmKeyboard() {
  return {
    inline_keyboard: [[
      { text: "✅ Publicar", callback_data: "publicar" },
      { text: "🗑️ Descartar", callback_data: "descartar" },
    ]],
  };
}

function tg(env, method, payload) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const send = (env, chat_id, text) => tg(env, "sendMessage", { chat_id, text });

// =====================================================================
// Estado (KV) e utilitários
// =====================================================================

const sessionKey = (chatId) => `session:${chatId}`;
const listKey = (chatId) => `list:${chatId}`;

function saveSession(env, chatId, data) {
  return env.KV.put(sessionKey(chatId), JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 7 });
}

function normalize(s) {
  return s.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n";
}

function fileName(path) {
  return path.split("/").pop();
}

function slugify(s) {
  return (
    String(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `ensaio-${Date.now()}`
  );
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
