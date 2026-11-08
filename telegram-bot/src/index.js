// Bot do Telegram para criar e editar ensaios do blog Aletheia pelo celular.
// Roda num Cloudflare Worker (grátis). O PC não participa de nada disso.
//
// Fluxo: /criar, /editar, /listar. Tudo é direto — não existe uma etapa
// genérica de "confirmar antes de publicar": o gatilho de publicar É o
// comando que você manda (/end, /reescrever, /colar, ou o próprio arquivo
// .md completo em /criar). A única trava automática é não deixar publicar
// um ensaio sem title/date/description, porque isso quebraria o build
// (astro check) do blog.

// Comandos usáveis sem nenhum fluxo em andamento. Os comandos de dentro de
// cada fluxo (/end, /reescrever, /colar, /pin, /tag, /rascunho) só aparecem
// quando fazem sentido — ver ajudaContextual().
const AJUDA_IDLE = `/criar — novo ensaio
/editar — busca um ensaio pra alterar
/listar — busca um ensaio só pra ler
/deletar — busca um ensaio pra apagar
/rascunhos — retoma um rascunho salvo
/link — manda o link do site`;

function ajudaContextual(session) {
  if (!session) return AJUDA_IDLE;
  if (session.mode === "editando") {
    return `Editando ${session.path}:\n/reescrever — substitui tudo\n/colar — acrescenta no fim\n/pin — liga/desliga fixado\n/tag nome-da-tag — adiciona ou remove\n/cancelar — desiste`;
  }
  if (session.mode === "escrevendo") {
    return `Escrevendo "${session.title}":\n/end — termina e publica\n/rascunho — salva sem publicar e sai\n/cancelar — desiste`;
  }
  // novo-escolha, cabecalho-*
  return `Criando um ensaio novo.\n/cancelar — desiste`;
}

const VINTE_MINUTOS = 20 * 60 * 1000;
const TRINTA_DIAS = 60 * 60 * 24 * 30;

const POR_PAGINA = 10;
const LIMITE_TEXTO = 3500; // margem abaixo do limite de 4096 do Telegram

// Confirmação de que o deploy terminou: espera um tempo inicial e depois
// tenta algumas vezes, com timeout, antes de desistir e só avisar o link.
const LINK_ESPERA_INICIAL = 20_000;
const LINK_TENTATIVAS = 6;
const LINK_INTERVALO = 15_000;
const LINK_TIMEOUT = 8_000;

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("ok");

    // Só aceita chamadas vindas do Telegram (segredo definido no setWebhook)
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    const update = await request.json();
    ctx.waitUntil(handleUpdate(update, env).catch((err) => console.error(err)));
    return new Response("ok");
  },

  // Roda a cada minuto (ver [triggers] no wrangler.toml): executa as
  // exclusões agendadas pelo /deletar cujos 20 minutos já passaram.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processarExclusoesPendentes(env).catch((err) => console.error(err)));
  },
};

// =====================================================================
// Roteamento
// =====================================================================

async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(update.callback_query, env);

  const msg = update.message;
  if (!msg) return;

  // Whitelist: ignora qualquer pessoa que não seja você
  if (String(msg.from?.id) !== String(env.ALLOWED_USER_ID)) return;
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const session = await env.KV.get(sessionKey(chatId), "json");

  // Comandos globais: sempre interrompem o que estiver em andamento
  if (text === "/start" || text === "/ajuda") return send(env, chatId, ajudaContextual(session));
  if (text === "/cancelar") {
    await env.KV.delete(sessionKey(chatId));
    const canceladas = await cancelarExclusoesPendentes(env, chatId);
    return send(env, chatId, canceladas.length ? `🗑️ Cancelado (inclusive a exclusão de ${canceladas.join(", ")}).` : "🗑️ Cancelado.");
  }
  if (text === "/link") {
    if (!env.SITE_URL) return send(env, chatId, "SITE_URL não está configurado no wrangler.toml.");
    return send(env, chatId, `🔗 ${env.SITE_URL.replace(/\/$/, "")}/`);
  }
  if (text === "/criar") return startCriar(env, chatId);
  if (text?.startsWith("/editar")) {
    return startBusca(env, chatId, text.replace("/editar", "").trim().toLowerCase(), "editar");
  }
  if (text?.startsWith("/listar")) {
    return startBusca(env, chatId, text.replace("/listar", "").trim().toLowerCase(), "listar");
  }
  if (text?.startsWith("/deletar")) {
    return startBusca(env, chatId, text.replace("/deletar", "").trim().toLowerCase(), "deletar");
  }
  if (text === "/rascunhos") return listarRascunhos(env, chatId);

  if (session) return handleSessionMessage(env, chatId, session, msg, text);

  return send(env, chatId, `Não entendi. Comandos:\n\n${AJUDA_IDLE}`);
}

async function handleCallback(cq, env) {
  const chatId = cq.message.chat.id;
  await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  if (String(cq.from.id) !== String(env.ALLOWED_USER_ID)) return;

  const data = cq.data;

  // Trocar de página na lista de ensaios
  if (data.startsWith("pg:")) {
    const page = Number(data.slice(3));
    const list = await env.KV.get(listKey(chatId), "json");
    if (!list) return send(env, chatId, "A lista expirou. Busque de novo.");
    return tg(env, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: cq.message.message_id,
      reply_markup: listKeyboard(list.paths, page),
    });
  }

  // Escolheu um ensaio na lista (/editar, /listar ou /deletar)
  if (data.startsWith("ed:")) {
    const list = await env.KV.get(listKey(chatId), "json");
    const path = list?.paths[Number(data.slice(3))];
    if (!path) return send(env, chatId, "A lista expirou. Busque de novo.");
    if (list.acao === "listar") return sendForReading(env, chatId, path);
    if (list.acao === "deletar") return scheduleDelete(env, chatId, path);
    if (list.acao === "rascunho") return resumeDraft(env, chatId, path);
    return sendForEditing(env, chatId, path);
  }
}

// =====================================================================
// /criar
// =====================================================================

async function startCriar(env, chatId) {
  await saveSession(env, chatId, { mode: "novo-escolha" });
  return send(env, chatId, "Mande um arquivo .md para publicar direto, ou /escrever para montar o ensaio aqui no chat.");
}

async function handleNewFromFile(env, chatId, msg) {
  const filename = msg.document.file_name || "";
  if (!/\.md$/i.test(filename)) return send(env, chatId, "Mande um arquivo .md.");
  const raw = normalize(await downloadFile(env, msg.document.file_id));
  const { data: fm, body } = parseFrontmatter(raw);

  if (fm) {
    const title = extractField(fm, "title");
    const date = extractField(fm, "date");
    const description = extractField(fm, "description");
    const faltando = [];
    if (!title) faltando.push("title");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) faltando.push("date (AAAA-MM-DD)");
    if (!description) faltando.push("description");
    if (faltando.length) {
      await env.KV.delete(sessionKey(chatId));
      return send(env, chatId, `⚠️ Faltou no frontmatter: ${faltando.join(", ")}.\nCorrija o arquivo e mande de novo com /criar.`);
    }
    return finalizeNewPost(env, chatId, title, raw);
  }

  // Sem frontmatter: pede os campos do cabeçalho, com o corpo do arquivo já pronto.
  await saveSession(env, chatId, { mode: "cabecalho-title", bodyPronto: body });
  return send(env, chatId, "Esse arquivo não tem frontmatter. Qual o título do ensaio?");
}

async function handleCabecalho(env, chatId, session, text) {
  switch (session.mode) {
    case "cabecalho-title":
      if (!text) return send(env, chatId, "Preciso de um texto para o título.");
      await saveSession(env, chatId, { ...session, mode: "cabecalho-description", title: text });
      return send(env, chatId, "Descrição (uma frase curta sobre o ensaio):");

    case "cabecalho-description":
      if (!text) return send(env, chatId, "Preciso de uma frase para a descrição.");
      await saveSession(env, chatId, { ...session, mode: "cabecalho-tags", description: text });
      return send(env, chatId, "Tags, separadas por vírgula (ou manda - para usar o padrão: filosofia):");

    case "cabecalho-tags": {
      const tags = !text || text === "-" ? ["filosofia"] : text.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      await saveSession(env, chatId, { ...session, mode: "cabecalho-pinned", tags });
      return send(env, chatId, "Fixar (pinned) este ensaio no topo? Responda sim, ou - para não (padrão):");
    }

    case "cabecalho-pinned": {
      const pinned = /^s(im)?$/i.test(text || "");
      const header = { title: session.title, description: session.description, tags: session.tags, pinned, date: today() };
      if (session.bodyPronto !== undefined) {
        return finalizeNewPost(env, chatId, header.title, buildMarkdown(header, session.bodyPronto));
      }
      await saveSession(env, chatId, { mode: "escrevendo", ...header, body: "" });
      return send(env, chatId, "Pode escrever o ensaio. Quando terminar, mande /end. Se quiser parar no meio e continuar depois, mande /rascunho.");
    }
  }
}

async function handleEscrevendo(env, chatId, session, msg, text) {
  if (text === "/rascunho") {
    if (!session.body?.trim()) return send(env, chatId, "Ainda não tem nada escrito para salvar. Escreva algo, ou /cancelar.");
    const draftKey = `draft:${chatId}:${slugify(session.title)}`;
    await env.KV.put(draftKey, JSON.stringify(session), { expirationTtl: TRINTA_DIAS });
    await env.KV.delete(sessionKey(chatId));
    return send(env, chatId, `📝 Rascunho salvo: "${session.title}". Use /rascunhos pra continuar depois.`);
  }

  if (!text) return send(env, chatId, "Nesta etapa eu só aceito texto. Para terminar, mande /end (ou /rascunho pra salvar sem publicar).");

  const fimNoFinal = text.match(/\/end\s*$/);
  const ehFim = text === "/end" || Boolean(fimNoFinal);
  const pedaco = text === "/end" ? "" : fimNoFinal ? text.slice(0, fimNoFinal.index).trim() : text;

  if (!ehFim) {
    const body = session.body ? `${session.body}\n\n${pedaco}` : pedaco;
    await saveSession(env, chatId, { ...session, body });
    return; // acumula em silêncio — pode mandar quantas mensagens quiser
  }

  const body = pedaco ? (session.body ? `${session.body}\n\n${pedaco}` : pedaco) : session.body;
  if (!body?.trim()) return send(env, chatId, "O ensaio ficou sem texto. Escreva algo antes do /end, ou /cancelar.");

  const header = { title: session.title, date: session.date, description: session.description, tags: session.tags, pinned: session.pinned };
  return finalizeNewPost(env, chatId, header.title, buildMarkdown(header, body));
}

function buildMarkdown({ title, date, description, tags, pinned }, body) {
  const lines = ["---", `title: ${JSON.stringify(title)}`, `date: ${date}`, `description: ${JSON.stringify(description)}`];
  if (tags?.length) {
    lines.push("tags:");
    for (const tag of tags) lines.push(`  - ${tag}`);
  }
  if (pinned) lines.push("pinned: true");
  lines.push("---", "", body.trim(), "");
  return lines.join("\n");
}

async function finalizeNewPost(env, chatId, title, markdown) {
  const problemas = validateFrontmatter(markdown);
  if (problemas.length) {
    await env.KV.delete(sessionKey(chatId));
    return send(env, chatId, `⚠️ Não publiquei: faltou ${problemas.join(", ")} no frontmatter.`);
  }

  const number = await nextNumber(env);
  const slug = slugify(title);
  const path = `${env.CONTENT_PATH}/${String(number).padStart(4, "0")}.${slug}.md`;

  try {
    await commitFile(env, path, markdown, `novo: ${fileName(path)}`);
    await env.KV.delete(sessionKey(chatId));
    await send(env, chatId, `✅ Publicado em ${path}\nO deploy na Vercel deve começar em instantes.`);
    await avisarLink(env, chatId, slug);
  } catch (e) {
    await send(env, chatId, `Erro ao publicar: ${e.message}`);
  }
}

// =====================================================================
// /editar e /listar (mesma busca, ações diferentes)
// =====================================================================

async function startBusca(env, chatId, termo, acao) {
  let paths;
  try {
    paths = await listPosts(env);
  } catch (e) {
    return send(env, chatId, `Erro ao listar ensaios: ${e.message}`);
  }
  if (termo) paths = paths.filter((p) => fileName(p).toLowerCase().includes(termo));
  if (!paths.length) return send(env, chatId, "Nenhum ensaio encontrado.");

  await env.KV.put(listKey(chatId), JSON.stringify({ paths, acao }), { expirationTtl: 3600 });

  const rotulo = { editar: "editar", deletar: "apagar" }[acao] ?? "ler";
  const emoji = { editar: "✏️", deletar: "🗑️" }[acao] ?? "🔎";
  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: `${emoji} Qual ensaio você quer ${rotulo}? (${paths.length} encontrado${paths.length > 1 ? "s" : ""})`,
    reply_markup: listKeyboard(paths, 0),
  });
}

// =====================================================================
// /deletar — a exclusão só acontece 20 minutos depois, pelo Cron Trigger
// (scheduled()), pra dar tempo de desistir com /cancelar.
// =====================================================================

function deleteKey(path) {
  return `delete:${path}`;
}

async function scheduleDelete(env, chatId, path) {
  const executeAt = Date.now() + VINTE_MINUTOS;
  await env.KV.put(deleteKey(path), JSON.stringify({ chatId, path, executeAt }), { expirationTtl: 60 * 30 });
  await send(env, chatId, `🗑️ ${path} será apagado em 20 minutos.\nMudou de ideia? Mande /cancelar antes disso.`);
}

async function cancelarExclusoesPendentes(env, chatId) {
  const lista = await env.KV.list({ prefix: "delete:" });
  const canceladas = [];
  for (const key of lista.keys) {
    const entry = await env.KV.get(key.name, "json");
    if (entry && String(entry.chatId) === String(chatId)) {
      await env.KV.delete(key.name);
      canceladas.push(fileName(entry.path));
    }
  }
  return canceladas;
}

// =====================================================================
// /rascunho (salvo durante o /escrever) e /rascunhos (retomar)
// =====================================================================

async function listarRascunhos(env, chatId) {
  const lista = await env.KV.list({ prefix: `draft:${chatId}:` });
  if (!lista.keys.length) return send(env, chatId, "Nenhum rascunho salvo.");

  const itens = [];
  for (const key of lista.keys) {
    const draft = await env.KV.get(key.name, "json");
    if (draft) itens.push({ key: key.name, title: draft.title });
  }
  if (!itens.length) return send(env, chatId, "Nenhum rascunho salvo.");

  await env.KV.put(listKey(chatId), JSON.stringify({ paths: itens.map((i) => i.key), acao: "rascunho" }), { expirationTtl: 3600 });
  const rows = itens.map((item, i) => [{ text: item.title.slice(0, 60), callback_data: `ed:${i}` }]);
  await tg(env, "sendMessage", { chat_id: chatId, text: `📝 Rascunhos salvos (${itens.length}):`, reply_markup: { inline_keyboard: rows } });
}

async function resumeDraft(env, chatId, draftKey) {
  const draft = await env.KV.get(draftKey, "json");
  if (!draft) return send(env, chatId, "Esse rascunho não existe mais.");
  await env.KV.delete(draftKey);
  await saveSession(env, chatId, draft);
  await send(env, chatId, `📝 Retomando "${draft.title}". Continue escrevendo; /end pra publicar, ou /rascunho pra salvar de novo.`);
}

// Chamado pelo Cron Trigger (a cada minuto). Apaga só o que já venceu.
async function processarExclusoesPendentes(env) {
  const lista = await env.KV.list({ prefix: "delete:" });
  const agora = Date.now();

  for (const key of lista.keys) {
    const entry = await env.KV.get(key.name, "json");
    if (!entry) {
      await env.KV.delete(key.name);
      continue;
    }
    if (entry.executeAt > agora) continue; // ainda não chegou a hora

    try {
      const file = await getFile(env, entry.path).catch(() => null);
      if (file) {
        await deleteFile(env, entry.path, file.sha, `remoção: ${fileName(entry.path)}`);
        await send(env, entry.chatId, `🗑️ ${entry.path} apagado.\nO deploy na Vercel deve atualizar em instantes.`);
      } else {
        await send(env, entry.chatId, `${entry.path} já não existia mais no GitHub — nada para apagar.`);
      }
    } catch (e) {
      await send(env, entry.chatId, `Erro ao apagar ${entry.path}: ${e.message}`);
    }
    await env.KV.delete(key.name);
  }
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

async function sendForReading(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }
  const link = env.SITE_URL ? `\n🔗 ${env.SITE_URL.replace(/\/$/, "")}/ensaios/${slugFromPath(path)}/` : "";
  await sendContent(env, chatId, `🔎 ${path}${link}`, file.text);
}

async function sendForEditing(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }

  // O sha identifica a versão exata que você baixou (evita sobrescrever uma
  // edição feita pelo PC enquanto você editava pelo celular).
  await saveSession(env, chatId, { mode: "editando", path, sha: file.sha, original: file.text });
  await sendContent(
    env,
    chatId,
    `✏️ ${path}\n\nEdite e mande de volta (texto ou arquivo). Depois use /reescrever (substitui tudo) ou /colar (acrescenta no fim).\nOu, sem mexer no texto: /pin (liga/desliga fixado) ou /tag nome-da-tag (adiciona/remove).\n/cancelar para desistir.`,
    file.text,
  );
}

async function handleEditando(env, chatId, session, msg, text) {
  if (text === "/reescrever" || text === "/colar") {
    if (!session.pendente) {
      return send(env, chatId, "Mande o conteúdo editado antes (texto ou arquivo), depois use /reescrever ou /colar.");
    }
    const novo = text === "/reescrever" ? session.pendente : `${session.original.trim()}\n\n${session.pendente.trim()}\n`;
    return commitEdit(env, chatId, session, novo);
  }

  if (text === "/pin" || text?.startsWith("/tag")) {
    return handlePinOuTag(env, chatId, session, text);
  }

  // Chegou um conteúdo novo (texto ou arquivo): guarda como pendente, aguardando /reescrever ou /colar.
  const conteudo = msg.document ? normalize(await downloadFile(env, msg.document.file_id)) : text;
  if (!conteudo) return send(env, chatId, "Mande o texto editado, ou um arquivo .md, e depois /reescrever ou /colar.");
  await saveSession(env, chatId, { ...session, pendente: conteudo });
}

// /pin: alterna pinned. /tag nome-da-tag: adiciona a tag se não tiver, remove
// se já tiver. Os dois agem no frontmatter sem você precisar reescrever o
// arquivo inteiro.
async function handlePinOuTag(env, chatId, session, text) {
  const atual = session.pendente ?? session.original;
  const { data: fm, body } = parseFrontmatter(atual);
  if (!fm) return send(env, chatId, "Não encontrei o frontmatter desse ensaio para alterar.");

  const title = extractField(fm, "title");
  const date = extractField(fm, "date");
  const description = extractField(fm, "description");
  let tags = extractTags(fm);
  let pinned = extractPinned(fm);
  let resumo;

  if (text === "/pin") {
    pinned = !pinned;
    resumo = pinned ? "fixado" : "desafixado";
  } else {
    const tag = text.replace(/^\/tag/, "").trim().toLowerCase();
    if (!tag) return send(env, chatId, "Use /tag nome-da-tag.");
    if (tags.includes(tag)) {
      tags = tags.filter((t) => t !== tag);
      resumo = `tag "${tag}" removida`;
    } else {
      tags = [...tags, tag];
      resumo = `tag "${tag}" adicionada`;
    }
  }

  const novo = buildMarkdown({ title, date, description, tags, pinned }, body);
  return commitEdit(env, chatId, session, novo, resumo);
}

// Usado por /reescrever, /colar, /pin e /tag — um único caminho pra validar,
// commitar, avisar e checar o deploy.
async function commitEdit(env, chatId, session, novo, resumo = "") {
  const problemas = validateFrontmatter(novo);
  if (problemas.length) {
    return send(env, chatId, `⚠️ Não publiquei: faltou ${problemas.join(", ")} no frontmatter.`);
  }
  try {
    await commitFile(env, session.path, novo, `revisão: ${fileName(session.path)}`, session.sha);
    await env.KV.delete(sessionKey(chatId));
    await send(env, chatId, `✅ ${session.path} atualizado${resumo ? ` (${resumo})` : ""}.\nO deploy na Vercel deve começar em instantes.`);
    await avisarLink(env, chatId, slugFromPath(session.path));
  } catch (e) {
    await send(env, chatId, `Erro ao publicar: ${e.message}`);
  }
}

// Manda como mensagem de texto quando cabe; como arquivo .md quando é grande
// demais para uma mensagem do Telegram (limite de ~4096 caracteres).
async function sendContent(env, chatId, cabecalho, texto) {
  if (texto.length <= LIMITE_TEXTO) {
    return send(env, chatId, `${cabecalho}\n\n${texto}`);
  }
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", `${cabecalho}\n\n(Ensaio grande demais para mensagem de texto — mandei como arquivo.)`);
  form.append("document", new File([texto], "ensaio.md", { type: "text/markdown" }));
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendDocument`, { method: "POST", body: form });
}

// =====================================================================
// Roteia mensagens para quem está no meio de um fluxo (sessão ativa)
// =====================================================================

async function handleSessionMessage(env, chatId, session, msg, text) {
  if (session.mode === "novo-escolha") {
    if (msg.document) return handleNewFromFile(env, chatId, msg);
    if (text === "/escrever") {
      await saveSession(env, chatId, { mode: "cabecalho-title" });
      return send(env, chatId, "Título do ensaio:");
    }
    return send(env, chatId, "Mande um arquivo .md, ou /escrever para montar o ensaio aqui no chat. /cancelar para sair.");
  }

  if (session.mode?.startsWith("cabecalho-")) return handleCabecalho(env, chatId, session, text);
  if (session.mode === "escrevendo") return handleEscrevendo(env, chatId, session, msg, text);
  if (session.mode === "editando") return handleEditando(env, chatId, session, msg, text);

  await env.KV.delete(sessionKey(chatId));
  return send(env, chatId, `Sessão perdida, começando do zero.\n\n${AJUDA_IDLE}`);
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

function extractTags(fm) {
  const m = fm.match(/^tags:\s*\n((?:[ \t]*-[ \t]*.+\n?)*)/m);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((line) => line.replace(/^[ \t]*-[ \t]*/, "").trim())
    .filter(Boolean);
}

function extractPinned(fm) {
  const m = fm.match(/^pinned:\s*(true|false)\s*$/m);
  return m ? m[1] === "true" : false;
}

// title, date e description são obrigatórios no schema do blog (content.config.ts).
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

// Pega os 4 primeiros caracteres do último artigo e soma 1 — igual ao
// scripts/criar-ensaio.sh local.
async function nextNumber(env) {
  const paths = await listPosts(env);
  if (!paths.length) return 1;
  const lastName = fileName(paths[paths.length - 1]);
  const prefix = lastName.slice(0, 4);
  const num = parseInt(prefix, 10);
  return isNaN(num) ? 1 : num + 1;
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

async function deleteFile(env, path, sha, message) {
  const body = { message, sha, branch: env.GITHUB_BRANCH };
  const res = await fetch(ghUrl(env, path), { method: "DELETE", headers: ghHeaders(env), body: JSON.stringify(body) });
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalize(s) {
  return s.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n";
}

function fileName(path) {
  return path.split("/").pop();
}

// O endereço do ensaio usa só o nome, sem o número — igual ao generateId do
// content.config.ts do blog (ex.: "8.nome.md" -> "nome").
function slugFromPath(path) {
  return fileName(path).replace(/\.md$/i, "").replace(/^\d+\./, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Espera o deploy da Vercel e confirma de verdade: dá um tempo inicial e
// depois tenta buscar a página algumas vezes, com timeout em cada tentativa.
// Se nunca responder 200, avisa que não confirmou (pode ser só demora, ou
// algo deu errado) em vez de mandar o link sem checar nada.
// Só roda se SITE_URL estiver configurado.
async function avisarLink(env, chatId, slug) {
  if (!env.SITE_URL) return;
  const url = `${env.SITE_URL.replace(/\/$/, "")}/ensaios/${slug}/`;

  await delay(LINK_ESPERA_INICIAL);
  for (let tentativa = 1; tentativa <= LINK_TENTATIVAS; tentativa++) {
    if (await urlNoAr(url, LINK_TIMEOUT)) {
      return send(env, chatId, `🔗 Está no ar: ${url}`);
    }
    if (tentativa < LINK_TENTATIVAS) await delay(LINK_INTERVALO);
  }

  await send(
    env,
    chatId,
    `⚠️ Não consegui confirmar que ficou no ar: ${url}\nPode ser só demora do deploy — dá uma olhada manualmente daqui a pouco.`,
  );
}

async function urlNoAr(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "follow", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
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
