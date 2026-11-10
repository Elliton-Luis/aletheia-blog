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
const AJUDA_IDLE = `📖 Ensaios:
/criar — novo ensaio
/editar — busca um ensaio pra alterar
/listar — busca um ensaio só pra ler
/analise — análise crítica com IA (IA A e IA B)
/contrapor — debate socrático e objeções duras
/card — gera card editorial com citação e link
/deletar — busca um ensaio pra agendar exclusão

💡 Caderno de Ideias:
/ideia <texto> — anota um pensamento rápido
/ideias — lista e gerencia suas ideias salvas
/rascunhos — retoma rascunho de escrita

🛠️ Repositório & Deploy:
/deploy — status do deploy da Vercel e confirmação
/repo — status e últimos commits do GitHub
/historico — histórico de versões de um ensaio
/link — endereço do blog

🎙️ Mande um áudio a qualquer momento para transcrever ou guardar como ideia.`;

function ajudaContextual(session) {
  if (!session) return AJUDA_IDLE;
  if (session.mode === "guardar-ideia") {
    return `Anotando ideia no caderno:\nMande um texto ou áudio com o seu pensamento.\n/cancelar — desiste`;
  }
  if (session.mode === "revisar-publicar") {
    return `Ensaio aguardando confirmação:\n/publicar — publica no blog\n/cancelar — desiste\nOu mande uma mensagem (texto/áudio) para continuar editando.`;
  }
  if (session.mode === "editando") {
    const blocoInfo = session.blocoAlvo ? `\n(Editando Bloco #${session.blocoAlvo})` : "";
    return `Editando ${session.path}:${blocoInfo}\n/editar <id> — edita só um bloco específico\n/colar — cola mensagens até você mandar /end\n/reescrever — substitui todo o texto\n/revisar — análise editorial com IA\n/contrapor — debate socrático\n/sugerir — sugestões de títulos e descrição\n/pin — liga/desliga fixado\n/tag nome-da-tag — adiciona ou remove\n/cancelar — desiste`;
  }
  if (session.mode === "escrevendo") {
    return `Escrevendo "${session.title}":\n/revisar — análise editorial com IA\n/contrapor — debate socrático e objeções\n/sugerir — sugestões de títulos e descrição\n/end — conclui para análise final e publicação\n/rascunho — salva sem publicar e sai\n/cancelar — desiste`;
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
    const url = new URL(request.url);

    // Rota pública para visualização e renderização do Card editorial
    if (request.method === "GET" && url.pathname === "/card") {
      return handleCardRequest(url, env);
    }

    if (request.method !== "POST") return new Response("ok");

    // Só aceita chamadas vindas do Telegram (segredo definido no setWebhook)
    if (!env.TELEGRAM_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    const update = await request.json();
    ctx.waitUntil(handleUpdate(update, env).catch((err) => console.error(err)));
    return new Response("ok");
  },

  // Roda a cada minuto (ver [triggers] no wrangler.toml): executa as
  // exclusões agendadas pelo /deletar cujos 20 minutos já passaram.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(processarExclusoesPendentes(env).catch((err) => console.error(err)));
  },
};

// =====================================================================
// Roteamento
// =====================================================================

function extractMessageText(msg) {
  const text = msg.text || msg.caption;
  const entities = msg.entities || msg.caption_entities;
  if (!text || !entities || !entities.length) return text?.trim() || "";

  // Comandos puros (ex: /start, /cancelar, /end) devem permanecer intactos
  if (entities.length === 1 && entities[0].type === "bot_command" && entities[0].offset === 0) {
    return text.trim();
  }

  // Ordena entidades do fim para o início para não desalinhar os offsets UTF-16
  const sorted = [...entities].sort((a, b) => (b.offset - a.offset) || (b.length - a.length));
  let res = text;
  for (const ent of sorted) {
    if (ent.type === "bot_command") continue;
    const start = ent.offset;
    const end = ent.offset + ent.length;
    const chunk = res.slice(start, end);
    let wrapped = chunk;
    if (ent.type === "bold") wrapped = `**${chunk}**`;
    else if (ent.type === "italic") wrapped = `*${chunk}*`;
    else if (ent.type === "code") wrapped = `\`${chunk}\``;
    else if (ent.type === "pre") wrapped = `\`\`\`\n${chunk}\n\`\`\``;
    else if (ent.type === "strikethrough") wrapped = `~~${chunk}~~`;
    else if (ent.type === "blockquote" || ent.type === "expandable_blockquote") {
      const quoted = chunk.split("\n").map((l) => `> ${l}`).join("\n");
      wrapped = `\n\n${quoted}\n\n`;
    }
    res = res.slice(0, start) + wrapped + res.slice(end);
  }
  return res.replace(/\n{3,}/g, "\n\n").trim();
}

async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(update.callback_query, env);

  const msg = update.message;
  if (!msg) return;

  // Só responde em conversas privadas (nunca em grupos ou canais)
  if (msg.chat?.type !== "private") return;

  // Whitelist: ignora qualquer pessoa que não seja você
  if (String(msg.from?.id) !== String(env.ALLOWED_USER_ID)) return;
  const chatId = msg.chat.id;
  const text = extractMessageText(msg);
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
    const param = text.replace("/editar", "").trim();
    // Se o usuário já está editando um arquivo e enviou "/editar <id>" (ou "/editar <id> <texto>")
    if (session?.mode === "editando" && /^\d+(\s+[\s\S]*)?$/.test(param)) {
      return handleEditando(env, chatId, session, msg, text);
    }
    return startBusca(env, chatId, param.toLowerCase(), "editar");
  }
  if (text?.startsWith("/listar") || text?.startsWith("/lista")) {
    const termo = text.replace(/^\/(listar|lista)/, "").trim().toLowerCase();
    return startBusca(env, chatId, termo, "listar");
  }
  if (text?.startsWith("/analise") || text?.startsWith("/analisar")) {
    const termo = text.replace(/^\/(analise|analisar)/, "").trim().toLowerCase();
    return startBusca(env, chatId, termo, "analise");
  }
  if (text?.startsWith("/contrapor") || text?.startsWith("/debate")) {
    const termo = text.replace(/^\/(contrapor|debate)/, "").trim().toLowerCase();
    return startBusca(env, chatId, termo, "contrapor");
  }
  if (text?.startsWith("/sugerir")) {
    const termo = text.replace("/sugerir", "").trim().toLowerCase();
    return startBusca(env, chatId, termo, "sugerir");
  }
  if (text?.startsWith("/card")) {
    const termo = text.replace("/card", "").trim().toLowerCase();
    return startBusca(env, chatId, termo, "card");
  }
  if (text === "/ideia" || text?.startsWith("/ideia ")) {
    return handleComandoIdeia(env, chatId, text.replace(/^\/ideia/, "").trim());
  }
  if (text === "/ideias") return listarIdeias(env, chatId);
  if (text === "/repo" || text === "/status" || text === "/deploy") return verStatusRepo(env, chatId);
  if (text?.startsWith("/historico")) {
    const termo = text.replace("/historico", "").trim().toLowerCase();
    return startBusca(env, chatId, termo, "historico");
  }
  if (text?.startsWith("/deletar")) {
    return startBusca(env, chatId, text.replace("/deletar", "").trim().toLowerCase(), "deletar");
  }
  if (text === "/rascunhos") return listarRascunhos(env, chatId);
  if (text === "/publicar") {
    if (session?.mode === "revisar-publicar") {
      return finalizeNewPost(env, chatId, session.header.title, session.markdown);
    }
    return send(env, chatId, "Nenhum ensaio aguardando publicação. Use /criar para começar.");
  }

  // Transcrição de áudio avulsa (fora de fluxos de criação/edição)
  const audioId = getAudioFileId(msg);
  if (audioId && !session) {
    await send(env, chatId, "🎙️ Transcrevendo áudio...");
    try {
      const transcricao = await transcreverAudio(env, audioId);
      if (!transcricao) return send(env, chatId, "⚠️ Não consegui identificar nenhuma fala no áudio.");

      const ideaId = Date.now().toString(36);
      await env.KV.put(
        `idea:${chatId}:${ideaId}`,
        JSON.stringify({ id: ideaId, text: transcricao, date: today(), createdAt: Date.now() }),
        { expirationTtl: TRINTA_DIAS }
      );

      await sendContent(env, chatId, "🎙️ Transcrição salva no Caderno de Ideias:", transcricao);
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "💡 O que deseja fazer com este pensamento?",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✍️ Transformar em Ensaio", callback_data: `idea:use:${ideaId}` },
              { text: "🗑️ Descartar Ideia", callback_data: `idea:del:${ideaId}` },
            ],
          ],
        },
      });
    } catch (e) {
      return send(env, chatId, `⚠️ Erro ao transcrever áudio: ${e.message}`);
    }
  }

  if (session) return handleSessionMessage(env, chatId, session, msg, text);

  return send(env, chatId, `Não entendi. Comandos:\n\n${AJUDA_IDLE}`);
}

async function handleCallback(cq, env) {
  // Whitelist: ignora cliques de qualquer pessoa que não seja você
  if (String(cq.from?.id) !== String(env.ALLOWED_USER_ID)) return;

  const chatId = cq.message?.chat?.id;
  if (!chatId) return;

  await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });

  const data = cq.data;

  // Confirmação de publicação pós-análise da IA
  if (data === "pub:confirmar") {
    const session = await env.KV.get(sessionKey(chatId), "json");
    if (!session || session.mode !== "revisar-publicar") {
      return send(env, chatId, "Essa sessão expirou. Use /criar para recomeçar.");
    }
    return finalizeNewPost(env, chatId, session.header.title, session.markdown);
  }
  if (data === "pub:cancelar") {
    await env.KV.delete(sessionKey(chatId));
    return send(env, chatId, "🗑️ Publicação cancelada.");
  }

  // Ações do Caderno de Ideias
  if (data.startsWith("idea:use:")) {
    const id = data.slice("idea:use:".length);
    const item = await env.KV.get(`idea:${chatId}:${id}`, "json");
    if (!item) return send(env, chatId, "Essa ideia não existe mais.");
    await saveSession(env, chatId, { mode: "cabecalho-title", bodyPronto: item.text });
    return send(env, chatId, `✍️ Transformando ideia em ensaio:\n\n"${item.text}"\n\nQual o título do ensaio?`);
  }
  if (data.startsWith("idea:del:")) {
    const id = data.slice("idea:del:".length);
    await env.KV.delete(`idea:${chatId}:${id}`);
    return send(env, chatId, "🗑️ Ideia removida do caderno.");
  }

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

  // Escolheu um ensaio na lista
  if (data.startsWith("ed:")) {
    const list = await env.KV.get(listKey(chatId), "json");
    const path = list?.paths[Number(data.slice(3))];
    if (!path) return send(env, chatId, "A lista expirou. Busque de novo.");
    if (list.acao === "listar") return sendForReading(env, chatId, path);
    if (list.acao === "deletar") return scheduleDelete(env, chatId, path);
    if (list.acao === "rascunho") return resumeDraft(env, chatId, path);
    if (list.acao === "analise") return runArticleAnalysis(env, chatId, path);
    if (list.acao === "contrapor") return runArticleDebate(env, chatId, path);
    if (list.acao === "sugerir") return runArticleSuggestions(env, chatId, path);
    if (list.acao === "card") return runGenerateCard(env, chatId, path);
    if (list.acao === "historico") return runArticleHistory(env, chatId, path);
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
    return prepararRevisaoEConfirmacao(env, chatId, { title, date, description }, body, raw);
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
        const md = buildMarkdown(header, session.bodyPronto);
        return prepararRevisaoEConfirmacao(env, chatId, header, session.bodyPronto, md);
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

  // Análise editorial sob demanda durante a escrita
  if (text === "/revisar" || text === "/analisar") {
    if (!session.body?.trim()) return send(env, chatId, "Escreva algo no ensaio antes de pedir a revisão.");
    try {
      await enviarRelatoriosDuplos(env, chatId, session.title, session.body);
      return send(env, chatId, "💡 Pode continuar escrevendo ou ajustando. Quando estiver pronto para publicar, mande /end.");
    } catch (e) {
      return send(env, chatId, `⚠️ Não foi possível obter a análise da IA: ${e.message}`);
    }
  }

  // Debate socrático sob demanda durante a escrita
  if (text === "/contrapor" || text === "/debate") {
    if (!session.body?.trim()) return send(env, chatId, "Escreva algo no ensaio antes de pedir o debate socrático.");
    try {
      await enviarDebateSocratico(env, chatId, session.title, session.body);
      return send(env, chatId, "💡 Pode continuar escrevendo ou ajustando. Quando estiver pronto para publicar, mande /end.");
    } catch (e) {
      return send(env, chatId, `⚠️ Não foi possível obter as objeções da IA: ${e.message}`);
    }
  }

  // Sugestões de títulos e descrição sob demanda
  if (text === "/sugerir") {
    if (!session.body?.trim()) return send(env, chatId, "Escreva algo no ensaio antes de pedir sugestões.");
    try {
      await enviarSugestoesEditorial(env, chatId, session.title, session.body);
      return send(env, chatId, "💡 Continue escrevendo ou mande /end para publicar.");
    } catch (e) {
      return send(env, chatId, `⚠️ Erro nas sugestões: ${e.message}`);
    }
  }

  // Permite mandar áudio para acumular no ensaio
  const audioId = getAudioFileId(msg);
  if (audioId) {
    await send(env, chatId, "🎙️ Transcrevendo áudio...");
    let transcricao = "";
    try {
      transcricao = await transcreverAudio(env, audioId);
    } catch (e) {
      return send(env, chatId, `⚠️ Erro ao transcrever áudio: ${e.message}`);
    }
    if (!transcricao) return send(env, chatId, "⚠️ Não consegui identificar nenhuma fala no áudio.");
    const body = session.body ? `${session.body}\n\n${transcricao}` : transcricao;
    await saveSession(env, chatId, { ...session, body });
    return send(env, chatId, `🎙️ Transcrito e adicionado:\n\n"${transcricao}"\n\nContinue mandando mensagens (texto ou áudio), ou /end para publicar.`);
  }

  if (!text) return send(env, chatId, "Nesta etapa eu aceito texto ou áudio de voz. Para terminar, mande /end (ou /rascunho pra salvar sem publicar).");

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
  const md = buildMarkdown(header, body);
  return prepararRevisaoEConfirmacao(env, chatId, header, body, md);
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

// =====================================================================
// IA: Análise Editorial Dupla (IA A e IA B)
// =====================================================================

const MANIFESTO_AUTOR = `Em tempos de vazio intelectual, tento trazer meus pensamentos para este espaço. Nada do que escrevo aqui é necessariamente verdade, e não há pretensão de rigor acadêmico: são pensamentos filosóficos, perguntas e tentativas de compreender o mundo.

Aristóteles escreveu sobre a física com os conhecimentos de seu tempo; muitas de suas explicações hoje estão superadas. Ainda assim, o valor daquele trabalho não depende apenas de ter acertado. Está também no exercício de observar, perguntar e pensar.

É esse exercício que quero registrar aqui: um pensamento em processo, sujeito a dúvidas, mudanças e erros. O importante não é apenas estar certo, mas se permitir pensar.`;

const PROMPT_REVISAO = `Você é um leitor crítico e conselheiro editorial do blog Aletheia.
Sua função NÃO é ter a resposta final, ditar regras ou reescrever o texto no seu estilo; a voz, o estilo e todas as decisões pertencem exclusivamente ao autor.
Sua missão é oferecer uma avaliação lúcida, perspectivas construtivas e apontar pontos cegos para reflexão do autor.

Contexto e manifesto fundamental do autor:
"${MANIFESTO_AUTOR}"

Diretrizes essenciais:
1. Avaliação com Nota (0 a 10): Atribua uma nota de 0 a 10 avaliando o POTENCIAL do tema em relação ao CAMINHO e à EXECUÇÃO do artigo (ex.: tema excelente com boa execução; tema com grande potencial mas em desenvolvimento/"indo"; tema promissor mas mal direcionado; ou tema modesto mas com execução primorosa). Explique a nota em poucas linhas.
2. Destaque obrigatoriamente e de forma SEPARADA o "Ponto Forte" e o "Ponto Mais Fraco" do ensaio.
3. Síntese Filosófica das Ideias Centrais: sintetize de forma completa e estruturada todas as teses, conexões conceituais e o fio condutor do pensamento do autor (sem ficar artificialmente preso a 3 ou 4 linhas; capture a densidade real dos argumentos de ponta a ponta).
4. O foco prioritário deve ser o exercício do pensamento, a consistência reflexiva e as conexões conceituais (pensamento em processo).
5. Pode e deve mencionar pontuação e aspectos formais do texto, mas estritamente como a ÚLTIMA prioridade da análise.

Estruture sua resposta obrigatoriamente no seguinte formato conciso (use emojis):

🎯 Avaliação: [Nota de 0 a 10]/10
(Diagnóstico conciso sobre a relação entre o potencial do tema e o caminho/execução do texto)

📖 Síntese das Principais Ideias
(Resumo substancial e fiel das teses centrais, encadeamento lógico e argumentos do ensaio, detalhando o raciocínio sem reducionismo)

🟢 Ponto Forte
(O aspecto mais potente da reflexão, tese ou argumento)

🔴 Ponto Mais Fraco
(O aspecto mais frágil, salto lógico ou ponto que mais carece de solidez/desenvolvimento)

💡 Reflexões e Caminhos
(Perguntas instigantes para levar o pensamento além e uma frase de destaque)

✍️ Pontuação e Aspectos Formais (Última prioridade)
(Observações pontuais sobre pontuação ou fluidez sintática, como última prioridade e sempre em tom opcional)

Responda em português, de forma concisa, objetiva e respeitosa.`;

// IA A: NVIDIA Nemotron 70B (com fallback para Llama 3.3 70B)
async function consultarIaA(env, title, body) {
  if (env.NVIDIA_API_KEY) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: [
            { role: "system", content: PROMPT_REVISAO },
            { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const texto = data.choices?.[0]?.message?.content?.trim();
        if (texto) return texto;
      }
    } catch {}
  }

  // Fallback: Llama 3.3 70B
  if (env.AI) {
    try {
      const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: PROMPT_REVISAO },
          { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
        ],
        max_tokens: 1500,
      });
      if (res?.response) return res.response.trim();
    } catch {}
  }

  return null;
}

// IA B: Família de modelo alternativa (Qwen / Mistral / Llama 3.1)
async function consultarIaB(env, title, body) {
  if (!env.AI) return null;

  // 1. Tenta Qwen 2.5 72B (modelo de outra família, excelente em português)
  try {
    const res = await env.AI.run("@cf/qwen/qwen2.5-72b-instruct", {
      messages: [
        { role: "system", content: PROMPT_REVISAO },
        { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
      ],
      max_tokens: 1500,
    });
    if (res?.response) return res.response.trim();
  } catch {}

  // 2. Fallback: Mistral 7B
  try {
    const res = await env.AI.run("@cf/mistral/mistral-7b-instruct-v0.2", {
      messages: [
        { role: "system", content: PROMPT_REVISAO },
        { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
      ],
      max_tokens: 1500,
    });
    if (res?.response) return res.response.trim();
  } catch {}

  // 3. Fallback: Llama 3.1 8B
  try {
    const res = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: PROMPT_REVISAO },
        { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
      ],
      max_tokens: 1500,
    });
    if (res?.response) return res.response.trim();
  } catch {}

  return null;
}

async function enviarRelatoriosDuplos(env, chatId, title, body) {
  await send(env, chatId, "🔍 Consultando duas IAs independentes (IA A e IA B) para trazer visões diferentes...");

  const [resA, resB] = await Promise.allSettled([
    consultarIaA(env, title, body),
    consultarIaB(env, title, body),
  ]);

  const textoA = resA.status === "fulfilled" ? resA.value : null;
  const textoB = resB.status === "fulfilled" ? resB.value : null;

  if (!textoA && !textoB) {
    throw new Error("Não foi possível obter resposta das IAs no momento.");
  }

  if (textoA) {
    await sendContent(env, chatId, "🤖 Opinião da IA A:", textoA);
  }

  if (textoB) {
    await sendContent(env, chatId, "🤖 Opinião da IA B:", textoB);
  }

  await send(
    env,
    chatId,
    "📌 Lembrete: As observações acima são apenas sugestões e pontos de vista para sua reflexão. A decisão e a palavra final sobre o ensaio são sempre suas.",
  );
}

// =====================================================================
// Debate Socrático / Oposição (IA A e IA B)
// =====================================================================

const PROMPT_CONTRAPOR = `Você é um debatedor socrático rigoroso, erudito e implacável do blog Aletheia.
Sua missão NÃO é elogiar o texto nem ser complacente. Sua função é encontrar as fissuras na tese, os pressupostos não examinados e apresentar os contra-argumentos mais difíceis e desconfortáveis para desafiar o autor a fortalecer seu pensamento.

Contexto e manifesto do autor:
"${MANIFESTO_AUTOR}"

Estruture sua resposta no seguinte formato conciso (use emojis):

⚔️ A Objeção Fundamental
(O contra-argumento mais duro e sofisticado contra a tese central. Como o leitor mais crítico e inteligente rebateria esse ponto?)

🌪️ O Paradoxo Oculto
(Uma contradição interna, consequência indesejada ou ponto cego que o argumento acarreta se levado às últimas consequências)

❓ Perguntas para Blindar o Pensamento
(2 perguntas cirúrgicas e desafiadoras que o autor precisa responder para tornar o ensaio inatacável)

Responda em português, de forma concisa, afiada e intelectualmente estimulante.`;

async function consultarDebateIaA(env, title, body) {
  if (env.NVIDIA_API_KEY) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: [
            { role: "system", content: PROMPT_CONTRAPOR },
            { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
          ],
          temperature: 0.4,
          max_tokens: 1200,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const texto = data.choices?.[0]?.message?.content?.trim();
        if (texto) return texto;
      }
    } catch {}
  }

  if (env.AI) {
    try {
      const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: PROMPT_CONTRAPOR },
          { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
        ],
        max_tokens: 1200,
      });
      if (res?.response) return res.response.trim();
    } catch {}
  }
  return null;
}

async function consultarDebateIaB(env, title, body) {
  if (!env.AI) return null;
  try {
    const res = await env.AI.run("@cf/qwen/qwen2.5-72b-instruct", {
      messages: [
        { role: "system", content: PROMPT_CONTRAPOR },
        { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body}` },
      ],
      max_tokens: 1200,
    });
    if (res?.response) return res.response.trim();
  } catch {}
  return null;
}

async function enviarDebateSocratico(env, chatId, title, body) {
  await send(env, chatId, "⚔️ Convocando IA A e IA B para o debate socrático...");
  const [resA, resB] = await Promise.allSettled([
    consultarDebateIaA(env, title, body),
    consultarDebateIaB(env, title, body),
  ]);
  const textoA = resA.status === "fulfilled" ? resA.value : null;
  const textoB = resB.status === "fulfilled" ? resB.value : null;

  if (!textoA && !textoB) {
    throw new Error("Não foi possível consultar as IAs para o debate.");
  }
  if (textoA) await sendContent(env, chatId, "⚔️ Objeções da IA A:", textoA);
  if (textoB) await sendContent(env, chatId, "⚔️ Objeções da IA B:", textoB);
  await send(env, chatId, "🛡️ Use as objeções acima para refletir e blindar seus argumentos.");
}

// =====================================================================
// Sugestões de Título e Descrição
// =====================================================================

const PROMPT_SUGERIR = `Você é um editor literário experiente do blog Aletheia.
Com base no texto do ensaio fornecido, gere sugestões refinadas para o título e a descrição do post:

Estruture sua resposta estritamente assim:
🏷️ Sugestões de Título:
1. ... (direto e conciso)
2. ... (provocativo / interrogativo)
3. ... (poético / conceitual)

📝 Sugestão de Descrição (frase única de máx 140 caracteres, elegante e instigante):
...

🔖 Tags Recomendadas (separadas por vírgula):
...

Responda em português.`;

async function enviarSugestoesEditorial(env, chatId, title, body) {
  await send(env, chatId, "💡 Gerando sugestões editoriais com IA...");
  let resp = null;
  if (env.AI) {
    try {
      const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: PROMPT_SUGERIR },
          { role: "user", content: `Título atual: ${title}\n\nTexto:\n${body}` },
        ],
        max_tokens: 600,
      });
      resp = res?.response?.trim();
    } catch {}
  }
  if (!resp) throw new Error("Não foi possível gerar sugestões no momento.");
  return send(env, chatId, `💡 Sugestões Editoriais:\n\n${resp}`);
}

async function extrairFraseMarcante(env, title, body) {
  if (env.AI) {
    try {
      const res = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "Você é um editor literário do blog Aletheia. Extraia OBRIGATORIAMENTE uma frase curta e marcante (máximo de 1 a 2 linhas curtas, até 120 caracteres) contida literalmente no próprio texto do ensaio. Ela NÃO deve ser um resumo do texto, e sim uma citação forte, impactante e instigante que desperte curiosidade imediata e mostre que o texto é interessante. NUNCA invente nem parafraseie: use estritamente as palavras do autor tal como constam no texto. Retorne APENAS o trecho exato extraído do texto, sem aspas e sem nenhuma explicação." },
          { role: "user", content: `Título: ${title}\n\nTexto do ensaio:\n${body.slice(0, 3000)}` },
        ],
        max_tokens: 60,
      });
      const txt = res?.response?.trim()?.replace(/^["'“]|["'”]$/g, "");
      if (txt && txt.length > 10 && txt.length < 160) return txt;
    } catch {}
  }

  // Fallbacks
  const blockquote = body.match(/^>\s*(.+)$/m);
  if (blockquote && blockquote[1].length < 160) return blockquote[1].trim().replace(/^["'“]|["'”]$/g, "");
  const boldMatch = body.match(/\*\*([^*]+)\*\*/);
  if (boldMatch && boldMatch[1].length > 15 && boldMatch[1].length < 150) return boldMatch[1];
  const linhas = body.split("\n").filter((l) => l.trim().length > 25 && l.trim().length < 140 && !l.startsWith("#") && !l.startsWith("---"));
  return linhas[0] || title;
}

async function prepararRevisaoEConfirmacao(env, chatId, header, body, markdown) {
  const problemas = validateFrontmatter(markdown);
  if (problemas.length) {
    await env.KV.delete(sessionKey(chatId));
    return send(env, chatId, `⚠️ Não posso publicar: faltou ${problemas.join(", ")} no frontmatter.`);
  }

  await saveSession(env, chatId, {
    mode: "revisar-publicar",
    header,
    body,
    markdown,
  });

  try {
    await enviarRelatoriosDuplos(env, chatId, header.title, body);
  } catch (e) {
    await send(env, chatId, `⚠️ Não foi possível obter as análises da IA (${e.message}), mas você ainda pode publicar.`);
  }

  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: `Deseja publicar "${header.title}" no blog?`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Publicar no Blog", callback_data: "pub:confirmar" },
          { text: "🗑️ Cancelar", callback_data: "pub:cancelar" },
        ],
      ],
    },
  });
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
    const commitSha = await commitFile(env, path, markdown, `novo: ${fileName(path)}`);
    await env.KV.delete(sessionKey(chatId));
    await env.KV.delete(`card:${slug}`).catch(() => {});
    await send(env, chatId, `✅ Salvo no GitHub: ${path}\n${commitSha ? `Commit: \`${commitSha.slice(0, 7)}\`\n` : ""}Aguardando build da Vercel...`);
    await avisarLink(env, chatId, slug, commitSha);
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

  const rotulos = {
    editar: "editar",
    deletar: "apagar",
    analise: "analisar",
    contrapor: "debater (socrático)",
    sugerir: "sugerir título/descrição",
    card: "gerar card editorial",
    historico: "ver histórico de revisões",
  };
  const emojis = {
    editar: "✏️",
    deletar: "🗑️",
    analise: "🧠",
    contrapor: "⚔️",
    sugerir: "💡",
    card: "🎨",
    historico: "📜",
  };
  const rotulo = rotulos[acao] ?? "ler";
  const emoji = emojis[acao] ?? "🔎";
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
  await send(env, chatId, `🔎 Leitura: ${fileName(path)}${link}`);

  const blocks = splitTextIntoBlocks(file.text, LIMITE_TEXTO);
  for (let i = 0; i < blocks.length; i++) {
    const prefix = blocks.length > 1 ? `📄 [Parte ${i + 1}/${blocks.length}]\n\n` : "";
    await send(env, chatId, `${prefix}${blocks[i]}`);
  }
}

async function runArticleAnalysis(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }

  const { data: fm, body } = parseFrontmatter(file.text);
  const title = (fm && extractField(fm, "title")) || fileName(path);
  const bodyText = (body && body.trim()) || file.text;

  await send(env, chatId, `🧠 Analisando "${title}" com IA A e IA B... Aguarde alguns instantes.`);
  try {
    await enviarRelatoriosDuplos(env, chatId, title, bodyText);
  } catch (e) {
    return send(env, chatId, `⚠️ Não foi possível obter as análises da IA: ${e.message}`);
  }
}

async function runArticleDebate(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }

  const { data: fm, body } = parseFrontmatter(file.text);
  const title = (fm && extractField(fm, "title")) || fileName(path);
  const bodyText = (body && body.trim()) || file.text;

  await send(env, chatId, `⚔️ Convocando debate socrático sobre "${title}"... Aguarde alguns instantes.`);
  try {
    await enviarDebateSocratico(env, chatId, title, bodyText);
  } catch (e) {
    return send(env, chatId, `⚠️ Não foi possível obter as objeções: ${e.message}`);
  }
}

async function runArticleSuggestions(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }

  const { data: fm, body } = parseFrontmatter(file.text);
  const title = (fm && extractField(fm, "title")) || fileName(path);
  const bodyText = (body && body.trim()) || file.text;

  await send(env, chatId, `💡 Gerando sugestões editoriais para "${title}"...`);
  try {
    await enviarSugestoesEditorial(env, chatId, title, bodyText);
  } catch (e) {
    return send(env, chatId, `⚠️ Não foi possível obter as sugestões: ${e.message}`);
  }
}

async function runArticleHistory(env, chatId, path) {
  await send(env, chatId, `⏳ Buscando histórico de revisões de "${fileName(path)}"...`);
  try {
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/commits?path=${path}&per_page=8`, { headers: ghHeaders(env) });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const commits = await res.json();
    if (!commits.length) return send(env, chatId, `Nenhum commit encontrado para ${fileName(path)}.`);

    let msg = `📜 Histórico de revisões: ${fileName(path)}\n\n`;
    for (const c of commits) {
      const sha = c.sha.slice(0, 7);
      const title = c.commit.message.split("\n")[0];
      const autor = c.commit.author?.name || "Autor";
      const dateStr = c.commit.author?.date;
      const dataFormatada = dateStr
        ? new Date(dateStr).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";
      msg += `• \`${sha}\` — ${title}\n  _${autor} · ${dataFormatada}_\n\n`;
    }
    return send(env, chatId, msg.trim());
  } catch (e) {
    return send(env, chatId, `⚠️ Erro ao buscar histórico: ${e.message}`);
  }
}

async function runGenerateCard(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }

  const { data: fm, body } = parseFrontmatter(file.text);
  const title = (fm && extractField(fm, "title")) || fileName(path);
  const slug = slugFromPath(path);
  const link = env.SITE_URL ? `${env.SITE_URL.replace(/\/$/, "")}/ensaios/${slug}/` : "";

  await send(env, chatId, `🎨 Gerando card editorial para "${title}"...`);

  const frase = CURATED_HOOKS[slug] || (await extrairFraseMarcante(env, title, body || file.text));
  const cardData = { title, quote: frase, link, slug };

  // Guarda dados no KV para a rota web do card
  await env.KV.put(`card:${slug}`, JSON.stringify(cardData), { expirationTtl: 60 * 60 * 24 * 30 });

  const workerBase = "https://aletheia-telegram-bot.ellitonluis-dev.workers.dev";
  const cardWebUrl = `${workerBase}/card?slug=${slug}`;
  const thumImageUrl = `https://image.thum.io/get/width/1080/crop/1920/${cardWebUrl}`;

  const svgContent = buildCardSvg(cardData);

  // 1. Tenta mandar a imagem renderizada como foto inline
  try {
    const photoRes = await tg(env, "sendPhoto", {
      chat_id: chatId,
      photo: thumImageUrl,
      caption: `🎨 Card editorial: "${title}"\n\n💬 "${frase}"\n\n🔗 ${link}\n🌐 Card em alta: ${cardWebUrl}`,
    });
    const photoData = await photoRes.json();
    if (!photoData.ok) {
      await sendDocumentContent(env, chatId, `card-${slug}.svg`, svgContent, `🎨 Card: "${title}"\n\n💬 "${frase}"\n\n🔗 ${link}\n🌐 ${cardWebUrl}`);
    }
  } catch {
    await sendDocumentContent(env, chatId, `card-${slug}.svg`, svgContent, `🎨 Card: "${title}"\n\n💬 "${frase}"\n\n🔗 ${link}\n🌐 ${cardWebUrl}`);
  }

  // 2. Envia também o arquivo vetorial .SVG para alta fidelidade
  await sendDocumentContent(
    env,
    chatId,
    `card-${slug}.svg`,
    svgContent,
    `📐 Arquivo vetorial SVG (alta definição para redes sociais, Canva ou impressão).`
  );
}

async function sendForEditing(env, chatId, path) {
  let file;
  try {
    file = await getFile(env, path);
  } catch (e) {
    return send(env, chatId, `Erro ao baixar o arquivo: ${e.message}`);
  }

  const { data: fm, body } = parseFrontmatter(file.text);
  const blocks = splitTextIntoBlocks(file.text, LIMITE_TEXTO);

  // O sha identifica a versão exata que você baixou (evita sobrescrever uma
  // edição feita pelo PC enquanto você editava pelo celular).
  await saveSession(env, chatId, {
    mode: "editando",
    path,
    sha: file.sha,
    original: file.text,
    blocos: blocks,
  });

  // 1ª Mensagem: Explicação clara dos comandos disponíveis
  await send(
    env,
    chatId,
    `✏️ Editando: ${fileName(path)}\n\n📌 Comandos disponíveis:\n• /editar <id> — edita apenas um bloco específico (ex: /editar 1)\n• /colar — acrescenta no fim (acumula mensagens até /end)\n• /reescrever — substitui todo o texto\n• /pin — liga/desliga destaque fixado\n• /tag nome — adiciona ou remove tag\n• /cancelar — cancela e descarta alterações\n\nAbaixo envio o texto atual do ensaio dividido em blocos identificados:`
  );

  // 2ª Mensagem (e seguintes): O texto em si, com ID visível para edição pontual
  for (let i = 0; i < blocks.length; i++) {
    const headerBloco = `🧩 [Bloco ${i + 1}/${blocks.length}]`;
    await send(env, chatId, `${headerBloco}\n\n${blocks[i]}`);
  }
}

function extrairCorpo(raw) {
  const { data: fm, body } = parseFrontmatter(raw);
  return (fm ? body : raw).trim();
}

function montarTextoComBlocoEditado(original, blocos, blocoIdx, novoTextoBloco) {
  const novosBlocos = [...blocos];
  novosBlocos[blocoIdx] = novoTextoBloco.trim();
  return novosBlocos.join("\n\n");
}

function montarTextoEditado(original, novoConteudo, modo) {
  const { data: fmOriginal, body: bodyOriginal } = parseFrontmatter(original);
  const { data: fmNovo } = parseFrontmatter(novoConteudo);

  if (modo === "reescrever") {
    if (fmNovo) return novoConteudo;
    const header = {
      title: extractField(fmOriginal, "title"),
      date: extractField(fmOriginal, "date"),
      description: extractField(fmOriginal, "description"),
      tags: extractTags(fmOriginal),
      pinned: extractPinned(fmOriginal),
    };
    return buildMarkdown(header, novoConteudo.trim());
  }

  const corpoAdicionar = extrairCorpo(novoConteudo);
  if (!fmOriginal) {
    return `${original.trim()}\n\n${corpoAdicionar}\n`;
  }
  const header = {
    title: extractField(fmOriginal, "title"),
    date: extractField(fmOriginal, "date"),
    description: extractField(fmOriginal, "description"),
    tags: extractTags(fmOriginal),
    pinned: extractPinned(fmOriginal),
  };
  const corpoAtualizado = `${bodyOriginal.trim()}\n\n${corpoAdicionar}`;
  return buildMarkdown(header, corpoAtualizado);
}

async function handleEditando(env, chatId, session, msg, text) {
  const blocos = session.blocos || splitTextIntoBlocks(session.original, LIMITE_TEXTO);

  // Comando /editar <id> [novoTexto]
  if (text?.startsWith("/editar")) {
    const param = text.replace(/^\/editar\s*/, "").trim();
    const match = param.match(/^(\d+)(?:\s+([\s\S]+))?$/);
    if (match) {
      const numBloco = Number(match[1]);
      const textoInline = match[2]?.trim();
      if (numBloco < 1 || numBloco > blocos.length) {
        return send(env, chatId, `⚠️ Bloco inválido. Escolha um bloco de 1 a ${blocos.length}.`);
      }

      if (textoInline) {
        const novoTexto = montarTextoComBlocoEditado(session.original, blocos, numBloco - 1, textoInline);
        return commitEdit(env, chatId, session, novoTexto, `bloco ${numBloco} alterado`);
      }

      await saveSession(env, chatId, {
        ...session,
        blocos,
        blocoAlvo: numBloco,
        acumulandoBloco: true,
        bufferBloco: "",
      });
      return send(
        env,
        chatId,
        `🧩 Editando Bloco ${numBloco}/${blocos.length}.\n\nTexto atual:\n---\n${blocos[numBloco - 1]}\n---\n\nEnvie o novo texto (ou áudios). Pode mandar várias mensagens; quando terminar, mande /end para aplicar.`
      );
    }
  }

  // Se estiver acumulando edição de um bloco específico
  if (session.acumulandoBloco && session.blocoAlvo) {
    const audioId = getAudioFileId(msg);
    let conteudo = text || "";
    if (audioId) {
      await send(env, chatId, "🎙️ Transcrevendo áudio para o bloco...");
      try {
        conteudo = await transcreverAudio(env, audioId);
      } catch (e) {
        return send(env, chatId, `⚠️ Erro ao transcrever áudio: ${e.message}`);
      }
    } else if (msg.document) {
      conteudo = normalize(await downloadFile(env, msg.document.file_id));
    }

    const fimNoFinal = conteudo.match(/\/end\s*$/);
    const ehFim = conteudo === "/end" || Boolean(fimNoFinal);
    const pedaco = conteudo === "/end" ? "" : fimNoFinal ? conteudo.slice(0, fimNoFinal.index).trim() : conteudo;

    let bufferAtual = session.bufferBloco || "";
    if (pedaco) {
      bufferAtual = bufferAtual ? `${bufferAtual}\n\n${pedaco}` : pedaco;
    }

    if (!ehFim) {
      await saveSession(env, chatId, { ...session, bufferBloco: bufferAtual });
      return; // Acumula em silêncio
    }

    if (!bufferAtual.trim()) {
      return send(env, chatId, "Nenhum texto foi informado para o bloco. Envie o novo texto antes de /end, ou /cancelar.");
    }

    const novoTexto = montarTextoComBlocoEditado(session.original, blocos, session.blocoAlvo - 1, bufferAtual);
    return commitEdit(env, chatId, session, novoTexto, `bloco ${session.blocoAlvo} alterado`);
  }

  // Comando /colar
  const ehColarComando = text === "/colar" || text?.startsWith("/colar ");
  if (ehColarComando) {
    const textoInline = text?.startsWith("/colar ") ? text.replace(/^\/colar\s+/, "").trim() : "";
    await saveSession(env, chatId, {
      ...session,
      blocos,
      acumulandoColar: true,
      colarBuffer: textoInline,
    });

    if (textoInline) {
      return send(
        env,
        chatId,
        `📥 Modo colar ativado com texto inicial. Continue enviando mensagens e termine com /end para acrescentar ao fim do ensaio.`
      );
    }
    return send(
      env,
      chatId,
      "📥 Modo colar ativado. Mande todo o conteúdo que deseja acrescentar (quantas mensagens ou áudios quiser). Quando terminar, mande /end para aplicar no fim do ensaio."
    );
  }

  // Se estiver acumulando colar
  if (session.acumulandoColar) {
    const audioId = getAudioFileId(msg);
    let conteudo = text || "";
    if (audioId) {
      await send(env, chatId, "🎙️ Transcrevendo áudio...");
      try {
        conteudo = await transcreverAudio(env, audioId);
      } catch (e) {
        return send(env, chatId, `⚠️ Erro ao transcrever áudio: ${e.message}`);
      }
    } else if (msg.document) {
      conteudo = normalize(await downloadFile(env, msg.document.file_id));
    }

    const fimNoFinal = conteudo.match(/\/end\s*$/);
    const ehFim = conteudo === "/end" || Boolean(fimNoFinal);
    const pedaco = conteudo === "/end" ? "" : fimNoFinal ? conteudo.slice(0, fimNoFinal.index).trim() : conteudo;

    let bufferAtual = session.colarBuffer || "";
    if (pedaco) {
      bufferAtual = bufferAtual ? `${bufferAtual}\n\n${pedaco}` : pedaco;
    }

    if (!ehFim) {
      await saveSession(env, chatId, { ...session, colarBuffer: bufferAtual });
      return; // Acumula em silêncio
    }

    if (!bufferAtual.trim()) {
      return send(env, chatId, "Nenhum texto foi acumulado. Envie o texto antes de /end, ou /cancelar.");
    }

    const novo = montarTextoEditado(session.original, bufferAtual, "colar");
    return commitEdit(env, chatId, session, novo, "conteúdo adicionado ao fim");
  }

  // Comando /reescrever
  const ehReescreverComando = text === "/reescrever" || text?.startsWith("/reescrever ");
  const ehEnd = text === "/end";

  if (ehReescreverComando) {
    const textoParaReescrever = text?.startsWith("/reescrever ")
      ? text.replace(/^\/reescrever\s+/, "").trim()
      : session.pendente;

    if (!textoParaReescrever?.trim()) {
      return send(env, chatId, "Mande o novo conteúdo completo (texto ou arquivo), ou envie `/reescrever seu texto aqui`.");
    }

    const novo = montarTextoEditado(session.original, textoParaReescrever, "reescrever");
    return commitEdit(env, chatId, session, novo, "conteúdo reescrito");
  }

  if (ehEnd && session.pendente) {
    const novo = montarTextoEditado(session.original, session.pendente, "colar");
    return commitEdit(env, chatId, session, novo, "conteúdo adicionado ao fim");
  }

  if (ehEnd && !session.pendente) {
    return send(env, chatId, "Nenhum texto novo foi enviado para este ensaio. Mande o texto que quer acrescentar ou substituir, ou /cancelar.");
  }

  if (text === "/pin" || text?.startsWith("/tag")) {
    return handlePinOuTag(env, chatId, session, text);
  }

  // Análise editorial sob demanda durante a edição
  if (text === "/revisar" || text === "/analisar") {
    const alvo = session.pendente ?? session.original;
    const { data: fm, body } = parseFrontmatter(alvo);
    const titulo = fm ? extractField(fm, "title") : fileName(session.path);
    try {
      await enviarRelatoriosDuplos(env, chatId, titulo || "Ensaio", body || alvo);
      return send(env, chatId, "💡 Agora use /colar (adiciona ao fim) ou /reescrever (substitui tudo).");
    } catch (e) {
      return send(env, chatId, `⚠️ Não foi possível obter a análise da IA: ${e.message}`);
    }
  }

  // Debate socrático sob demanda durante a edição
  if (text === "/contrapor" || text === "/debate") {
    const alvo = session.pendente ?? session.original;
    const { data: fm, body } = parseFrontmatter(alvo);
    const titulo = fm ? extractField(fm, "title") : fileName(session.path);
    try {
      await enviarDebateSocratico(env, chatId, titulo || "Ensaio", body || alvo);
      return send(env, chatId, "💡 Agora use /colar (adiciona ao fim) ou /reescrever (substitui tudo).");
    } catch (e) {
      return send(env, chatId, `⚠️ Não foi possível obter as objeções da IA: ${e.message}`);
    }
  }

  // Sugestões de títulos e descrição sob demanda durante a edição
  if (text === "/sugerir") {
    const alvo = session.pendente ?? session.original;
    const { data: fm, body } = parseFrontmatter(alvo);
    const titulo = fm ? extractField(fm, "title") : fileName(session.path);
    try {
      await enviarSugestoesEditorial(env, chatId, titulo || "Ensaio", body || alvo);
      return send(env, chatId, "💡 Use /colar ou /reescrever quando quiser salvar as alterações.");
    } catch (e) {
      return send(env, chatId, `⚠️ Erro nas sugestões: ${e.message}`);
    }
  }

  // Chegou um conteúdo novo (texto, áudio ou arquivo): guarda como pendente e DÁ FEEDBACK IMEDIATO ao usuário!
  let conteudo = text;
  const audioId = getAudioFileId(msg);
  if (msg.document) {
    conteudo = normalize(await downloadFile(env, msg.document.file_id));
  } else if (audioId) {
    await send(env, chatId, "🎙️ Transcrevendo áudio...");
    try {
      conteudo = await transcreverAudio(env, audioId);
      if (!conteudo) return send(env, chatId, "⚠️ Não consegui identificar nenhuma fala no áudio.");
      await saveSession(env, chatId, { ...session, pendente: conteudo });
      return send(env, chatId, `🎙️ Transcrito (${conteudo.length} caracteres):\n\n"${conteudo}"\n\nAgora use /colar (adiciona ao fim) ou /reescrever (substitui tudo).`);
    } catch (e) {
      return send(env, chatId, `⚠️ Erro ao transcrever áudio: ${e.message}`);
    }
  }

  if (!conteudo?.trim()) {
    return send(env, chatId, "Mande o texto editado, um áudio ou arquivo .md, e depois use /colar ou /reescrever (ou /cancelar).");
  }

  await saveSession(env, chatId, { ...session, pendente: conteudo });
  return send(env, chatId, `📝 Conteúdo recebido (${conteudo.length} caracteres)!\n\nEnvie /colar para acrescentar no fim do ensaio, ou /reescrever para substituir tudo.\n(Ou /cancelar para desistir)`);
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
    const commitSha = await commitFile(env, session.path, novo, `revisão: ${fileName(session.path)}`, session.sha);
    await env.KV.delete(sessionKey(chatId));
    const slug = slugFromPath(session.path);
    await env.KV.delete(`card:${slug}`).catch(() => {});
    await send(env, chatId, `✅ ${session.path} atualizado${resumo ? ` (${resumo})` : ""}.\n${commitSha ? `Commit: \`${commitSha.slice(0, 7)}\`\n` : ""}Aguardando build da Vercel...`);
    await avisarLink(env, chatId, slug, commitSha);
  } catch (e) {
    await send(env, chatId, `Erro ao publicar: ${e.message}`);
  }
}

// Divide o texto em blocos que respeitam cabeçalhos (##, ###) e o limite de caracteres
function splitTextIntoBlocks(text, maxChars = LIMITE_TEXTO) {
  if (!text || text.length <= maxChars) return [text || ""];
  const sections = text.split(/(?=\n#{1,4}\s)/);
  const blocks = [];
  let currentBlock = "";

  for (const sec of sections) {
    if (!currentBlock) {
      if (sec.length <= maxChars) {
        currentBlock = sec;
      } else {
        const paras = sec.split(/\n\n+/);
        for (const p of paras) {
          if ((currentBlock ? `${currentBlock}\n\n${p}` : p).length <= maxChars) {
            currentBlock = currentBlock ? `${currentBlock}\n\n${p}` : p;
          } else {
            if (currentBlock) blocks.push(currentBlock.trim());
            if (p.length <= maxChars) {
              currentBlock = p;
            } else {
              for (let i = 0; i < p.length; i += maxChars) {
                blocks.push(p.slice(i, i + maxChars));
              }
              currentBlock = "";
            }
          }
        }
      }
    } else if ((currentBlock + "\n\n" + sec).length <= maxChars) {
      currentBlock += "\n\n" + sec;
    } else {
      blocks.push(currentBlock.trim());
      if (sec.length <= maxChars) {
        currentBlock = sec;
      } else {
        const paras = sec.split(/\n\n+/);
        for (const p of paras) {
          if ((currentBlock ? `${currentBlock}\n\n${p}` : p).length <= maxChars) {
            currentBlock = currentBlock ? `${currentBlock}\n\n${p}` : p;
          } else {
            if (currentBlock) blocks.push(currentBlock.trim());
            if (p.length <= maxChars) {
              currentBlock = p;
            } else {
              for (let i = 0; i < p.length; i += maxChars) {
                blocks.push(p.slice(i, i + maxChars));
              }
              currentBlock = "";
            }
          }
        }
      }
    }
  }

  if (currentBlock && currentBlock.trim()) {
    blocks.push(currentBlock.trim());
  }
  return blocks;
}

// Manda o texto sempre em mensagens sequenciais (dividido em blocos se grande)
async function sendContent(env, chatId, cabecalho, texto) {
  if (texto.length <= LIMITE_TEXTO) {
    return send(env, chatId, `${cabecalho}\n\n${texto}`);
  }
  await send(env, chatId, cabecalho);
  const blocks = splitTextIntoBlocks(texto, LIMITE_TEXTO);
  for (let i = 0; i < blocks.length; i++) {
    const prefix = blocks.length > 1 ? `📄 [Parte ${i + 1}/${blocks.length}]\n\n` : "";
    await send(env, chatId, `${prefix}${blocks[i]}`);
  }
}

async function sendDocumentContent(env, chatId, filename, texto, caption = "") {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  form.append("document", new File([texto], filename, { type: filename.endsWith(".svg") ? "image/svg+xml" : "text/markdown" }));
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendDocument`, { method: "POST", body: form });
}

// =====================================================================
// Caderno de Ideias
// =====================================================================

async function handleComandoIdeia(env, chatId, texto) {
  if (texto) {
    const ideaId = Date.now().toString(36);
    await env.KV.put(
      `idea:${chatId}:${ideaId}`,
      JSON.stringify({ id: ideaId, text: texto, date: today(), createdAt: Date.now() }),
      { expirationTtl: 60 * 60 * 24 * 90 }
    );
    return send(env, chatId, `💡 Ideia salva no seu caderno!\n\n"${texto}"\n\nUse /ideias para listar todas ou transformá-las em ensaio.`);
  }

  await saveSession(env, chatId, { mode: "guardar-ideia" });
  return send(env, chatId, "💡 Mande o texto ou áudio da sua ideia (ou /cancelar para sair):");
}

async function handleGuardarIdeia(env, chatId, msg, text) {
  let conteudo = text;
  const audioId = getAudioFileId(msg);
  if (audioId) {
    await send(env, chatId, "🎙️ Transcrevendo áudio da ideia...");
    try {
      conteudo = await transcreverAudio(env, audioId);
    } catch (e) {
      return send(env, chatId, `⚠️ Erro ao transcrever áudio: ${e.message}`);
    }
  }
  if (!conteudo?.trim()) {
    return send(env, chatId, "Mande um texto ou áudio para salvar a ideia, ou /cancelar.");
  }
  const ideaId = Date.now().toString(36);
  await env.KV.put(
    `idea:${chatId}:${ideaId}`,
    JSON.stringify({ id: ideaId, text: conteudo.trim(), date: today(), createdAt: Date.now() }),
    { expirationTtl: 60 * 60 * 24 * 90 }
  );
  await env.KV.delete(sessionKey(chatId));
  return send(env, chatId, `💡 Ideia salva no seu caderno!\n\n"${conteudo.trim()}"\n\nUse /ideias para ver todas ou transformá-las em ensaio.`);
}

async function listarIdeias(env, chatId) {
  const lista = await env.KV.list({ prefix: `idea:${chatId}:` });
  if (!lista.keys.length) {
    return send(env, chatId, "💡 Seu caderno de ideias está vazio no momento.\nEnvie /ideia <sua reflexão> ou mande um áudio a qualquer momento.");
  }

  const ideias = [];
  for (const key of lista.keys) {
    const d = await env.KV.get(key.name, "json");
    if (d) ideias.push(d);
  }
  ideias.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!ideias.length) {
    return send(env, chatId, "💡 Seu caderno de ideias está vazio no momento.");
  }

  let msg = `💡 Caderno de Ideias (${ideias.length} salva${ideias.length > 1 ? "s" : ""}):\n\n`;
  const rows = [];
  ideias.slice(0, 10).forEach((item, i) => {
    const trecho = item.text.replace(/\n+/g, " ").slice(0, 80);
    msg += `${i + 1}. "${trecho}${item.text.length > 80 ? "..." : ""}"\n📅 _${item.date}_\n\n`;
    rows.push([
      { text: `✍️ #${i + 1} Criar Ensaio`, callback_data: `idea:use:${item.id}` },
      { text: `🗑️ #${i + 1}`, callback_data: `idea:del:${item.id}` },
    ]);
  });

  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: msg.trim(),
    reply_markup: { inline_keyboard: rows },
  });
}

// =====================================================================
// Repositório GitHub
// =====================================================================

async function verStatusRepo(env, chatId) {
  await send(env, chatId, "⏳ Buscando informações do repositório e deploy na Vercel...");
  try {
    const [commitsRes, posts] = await Promise.all([
      fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/commits?sha=${env.GITHUB_BRANCH}&per_page=5`, { headers: ghHeaders(env) }),
      listPosts(env).catch(() => []),
    ]);

    if (!commitsRes.ok) throw new Error(`GitHub API: ${commitsRes.status}`);
    const commits = await commitsRes.json();
    const latestSha = commits[0]?.sha;

    let vercelMsg = "⚪ Vercel Deploy: Não verificado";
    if (latestSha) {
      try {
        const stRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/commits/${latestSha}/status`, { headers: ghHeaders(env) });
        if (stRes.ok) {
          const stData = await stRes.json();
          const vercelSt = stData.statuses?.find((s) => s.context?.toLowerCase().includes("vercel"));
          if (vercelSt) {
            if (vercelSt.state === "success") {
              vercelMsg = "🟢 Vercel Deploy: Concluído e no ar";
            } else if (vercelSt.state === "pending") {
              vercelMsg = "🟡 Vercel Deploy: Em andamento (construindo...)";
            } else {
              vercelMsg = `🔴 Vercel Deploy: Falhou (${vercelSt.description})`;
            }
          } else {
            vercelMsg = `ℹ️ Status geral GitHub: ${stData.state || "desconhecido"}`;
          }
        }
      } catch {}
    }

    let msg = `📦 Repositório: ${env.GITHUB_REPO}\n🌿 Branch: \`${env.GITHUB_BRANCH}\` · 📚 ${posts.length} ensaios\n${vercelMsg}\n🔗 ${env.SITE_URL || "Site configurado"}\n\n📜 Últimos 5 Commits:\n`;
    for (const c of commits) {
      const sha = c.sha.slice(0, 7);
      const title = c.commit.message.split("\n")[0].slice(0, 60);
      const autor = c.commit.author?.name || "Autor";
      const dateStr = c.commit.author?.date;
      const dataFormatada = dateStr
        ? new Date(dateStr).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";
      msg += `\n• \`${sha}\` — ${title}\n  _${autor}${dataFormatada ? ` em ${dataFormatada}` : ""}_\n`;
    }
    msg += `\n💡 O bot agora aguarda a confirmação real da Vercel antes de avisar que está no ar.`;
    return send(env, chatId, msg);
  } catch (e) {
    return send(env, chatId, `⚠️ Erro ao consultar repositório: ${e.message}`);
  }
}

// =====================================================================
// Card Editorial (HTML e SVG)
// =====================================================================

function wrapSvgText(text, maxCharsPerLine = 46) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = current ? current + " " + w : w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CURATED_HOOKS = {
  "filosofar-na-era-da-ia": "É importante pensar, mesmo estando errado.",
  "sorte-sucesso-e-injustica": "Sabendo o que é melhor, ela escolheu a ignorância ou nunca teve a oportunidade de saber?",
  "verdade-e-mentira-social": "Se você só sabe o quê das coisas e não sabe o porquê, você é um decorador.",
  "filosofia-teologia-e-artes-liberais": "Quando a mente se fecha na pura mecânica, perde o sentido do sagrado.",
  "suicidio": "E se o propósito da existência for ser?",
  "o-valor-da-etimologia": "A etimologia é a arqueologia viva do pensamento humano.",
  "sobre-o-sincretismo": "Misturar tradições sem compreender suas raízes não é síntese: é confusão.",
  "a-cultura-do-vitimismo-e-a-mentira-necessidade": "A mentira repetida por necessidade de consolo aprisiona o espírito.",
  "dificultar-para-aprender": "A facilidade excessiva é a anestesia do intelecto.",
  "nunca-devemos-praticar-algo-que-e-possivelmente-mal": "A dúvida moral honesta nos obriga a recuar antes de agir.",
};

function buildCardSvg({ title, quote, link }) {
  const cleanQuote = quote.replace(/^[«"“\s]+|[»"”\s]+$/g, "").trim();
  const quoteFormatted = `«${cleanQuote}»`;
  const lines = wrapSvgText(quoteFormatted, 24);
  const titleLines = wrapSvgText(title, 34);
  const cleanLink = link.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const lineHeight = 86;
  const startY = Math.round(940 - ((lines.length - 1) * lineHeight) / 2);
  const quoteSpans = lines
    .map((l, i) => `<text x="140" y="${startY + i * lineHeight}" font-family="'Literata', Georgia, serif" font-size="58" font-style="italic" fill="#f4f2ea">${escapeXml(l)}</text>`)
    .join("\n  ");

  const titleSpans = titleLines
    .map((l, i) => `<text x="140" y="${1700 + i * 44}" font-family="'Literata', Georgia, serif" font-size="30" font-weight="500" fill="#dedbd1">${escapeXml(l)}</text>`)
    .join("\n  ");

  const footerY = 1700 + titleLines.length * 44 + 24;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Fundo Sólido Editorial Matte (Sem degradê) -->
  <rect width="1080" height="1920" fill="#161816" />

  <!-- Cabeçalho Topo -->
  <text x="140" y="210" font-family="'Literata', Georgia, serif" font-size="24" letter-spacing="5" fill="#c2a47d">ALETHEIA</text>
  <text x="940" y="210" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="14" letter-spacing="2" fill="#7a7d74">CADERNO DE ENSAIOS</text>
  <line x1="140" y1="240" x2="940" y2="240" stroke="#ffffff" stroke-opacity="0.09" stroke-width="1" />

  <!-- Citação Central (Hero) -->
  ${quoteSpans}

  <!-- Rodapé Editorial -->
  <line x1="140" y1="1640" x2="940" y2="1640" stroke="#ffffff" stroke-opacity="0.09" stroke-width="1" />
  ${titleSpans}
  <text x="140" y="${footerY}" font-family="system-ui, -apple-system, sans-serif" font-size="16" letter-spacing="1" fill="#8a8d83">POR O ELEITO</text>
  <text x="940" y="${footerY}" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="16" letter-spacing="1" fill="#c2a47d">${escapeXml(cleanLink)}</text>
</svg>`;
}

async function handleCardRequest(url, env) {
  const slug = url.searchParams.get("slug");
  if (!slug) return new Response("Informe ?slug=nome-do-ensaio", { status: 400 });

  let card = await env.KV.get(`card:${slug}`, "json");
  if (!card) {
    try {
      const posts = await listPosts(env);
      const matched = posts.find((p) => slugFromPath(p) === slug);
      if (!matched) return new Response("Ensaio não encontrado", { status: 404 });
      const file = await getFile(env, matched);
      const { data: fm, body } = parseFrontmatter(file.text);
      const title = (fm && extractField(fm, "title")) || slug;
      const quote = CURATED_HOOKS[slug] || (await extrairFraseMarcante(env, title, body || file.text));
      card = { title, quote, link: `${env.SITE_URL.replace(/\/$/, "")}/ensaios/${slug}/`, slug };
      await env.KV.put(`card:${slug}`, JSON.stringify(card), { expirationTtl: 60 * 60 * 24 * 30 });
    } catch (e) {
      return new Response(`Erro ao carregar ensaio: ${e.message}`, { status: 500 });
    }
  }

  const cleanQuote = (card.quote || "").replace(/^[«"“\s]+|[»"”\s]+$/g, "").trim();
  const cleanLink = (card.link || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(card.title)} · Aletheia</title>
  <meta name="viewport" content="width=1080, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;1,7..72,400;1,7..72,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1080px;
      height: 1920px;
      background: #161816;
      color: #f4f2ea;
      font-family: 'Literata', Georgia, serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 160px 130px 140px;
      -webkit-font-smoothing: antialiased;
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 28px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    }
    .brand {
      font-size: 24px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #c2a47d;
      font-weight: 500;
    }
    .sub-brand {
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 14px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #7a7d74;
      font-weight: 500;
    }
    .quote-container {
      margin: auto 0;
      padding: 40px 0;
    }
    .quote-text {
      font-size: 60px;
      line-height: 1.5;
      font-style: italic;
      font-weight: 400;
      color: #f4f2ea;
      letter-spacing: -0.01em;
    }
    .footer-bar {
      padding-top: 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.09);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .essay-title {
      font-size: 32px;
      line-height: 1.35;
      font-weight: 500;
      color: #dedbd1;
    }
    .footer-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 16px;
      letter-spacing: 0.08em;
      color: #8a8d83;
    }
    .author-name {
      text-transform: uppercase;
    }
    .site-domain {
      color: #c2a47d;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="brand">Aletheia</div>
    <div class="sub-brand">Caderno de Ensaios</div>
  </div>

  <div class="quote-container">
    <p class="quote-text">«${escapeHtml(cleanQuote)}»</p>
  </div>

  <div class="footer-bar">
    <h2 class="essay-title">${escapeHtml(card.title)}</h2>
    <div class="footer-meta">
      <span class="author-name">Por O Eleito</span>
      <span class="site-domain">${escapeHtml(cleanLink)}</span>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });
}

// =====================================================================
// Roteia mensagens para quem está no meio de um fluxo (sessão ativa)
// =====================================================================

async function handleSessionMessage(env, chatId, session, msg, text) {
  if (session.mode === "guardar-ideia") return handleGuardarIdeia(env, chatId, msg, text);
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
  if (session.mode === "revisar-publicar") {
    if (text === "/publicar") {
      return finalizeNewPost(env, chatId, session.header.title, session.markdown);
    }
    // Mande mais texto ou áudio para continuar ajustando
    session.mode = "escrevendo";
    return handleEscrevendo(env, chatId, session, msg, text);
  }

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
  const data = await res.json().catch(() => null);
  return data?.commit?.sha || null;
}

async function deleteFile(env, path, sha, message) {
  const body = { message, sha, branch: env.GITHUB_BRANCH };
  const res = await fetch(ghUrl(env, path), { method: "DELETE", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json().catch(() => null);
  return data?.commit?.sha || null;
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

function getAudioFileId(msg) {
  if (msg.voice?.file_id) return msg.voice.file_id;
  if (msg.audio?.file_id) return msg.audio.file_id;
  if (msg.document && /\.(ogg|oga|mp3|m4a|wav|aac|flac)$/i.test(msg.document.file_name || "")) {
    return msg.document.file_id;
  }
  return null;
}

async function downloadAudioBuffer(env, fileId) {
  const r = await tg(env, "getFile", { file_id: fileId });
  const data = await r.json();
  if (!data.ok || !data.result?.file_path) {
    throw new Error("Não foi possível obter o arquivo de áudio do Telegram.");
  }
  const f = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${data.result.file_path}`);
  if (!f.ok) throw new Error(`Falha ao baixar áudio do Telegram (${f.status}).`);
  return f.arrayBuffer();
}

async function transcreverAudio(env, fileId) {
  if (!env.AI) {
    throw new Error("O binding 'AI' não está ativo no Worker. Verifique o wrangler.toml e faça o deploy.");
  }
  const arrayBuffer = await downloadAudioBuffer(env, fileId);
  const audio = Array.from(new Uint8Array(arrayBuffer));

  let res;
  try {
    res = await env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio });
  } catch {
    // Fallback para o whisper base caso o turbo oscile
    res = await env.AI.run("@cf/openai/whisper", { audio });
  }
  return res?.text?.trim() || "";
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

// Espera o deploy da Vercel e confirma de verdade:
// 1. Se tivermos commitSha, monitora o status real da Vercel no GitHub a cada 10s.
// 2. Invalida cache de card KV.
// 3. Só manda "Está no ar" quando a Vercel responder "success".
// 4. Se a Vercel falhar no build (ex.: erro de compilação/syntax), avisa imediatamente.
async function avisarLink(env, chatId, slug, commitSha) {
  if (!env.SITE_URL) return;
  const baseUrl = `${env.SITE_URL.replace(/\/$/, "")}/ensaios/${slug}/`;

  if (slug) {
    await env.KV.delete(`card:${slug}`).catch(() => {});
  }

  if (commitSha) {
    const statusUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/commits/${commitSha}/status`;
    const maxTentativas = 15; // até 2m30s
    const intervaloMs = 10_000;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      await delay(intervaloMs);
      try {
        const res = await fetch(statusUrl, { headers: ghHeaders(env) });
        if (res.ok) {
          const data = await res.json();
          const vercelStatus = data.statuses?.find((s) => s.context?.toLowerCase().includes("vercel"));
          if (vercelStatus) {
            if (vercelStatus.state === "success") {
              const urlComCacheBuster = `${baseUrl}?v=${Date.now()}`;
              return send(
                env,
                chatId,
                `🚀 *Deploy concluído na Vercel!*\nO ensaio já está atualizado no ar.\n\n🔗 ${baseUrl}\n\n📱 _Se o navegador móvel mostrar versão antiga em disco:_\n${urlComCacheBuster}`
              );
            }
            if (vercelStatus.state === "failure" || vercelStatus.state === "error") {
              return send(
                env,
                chatId,
                `❌ *Falha no build da Vercel!*\nO ensaio foi salvo no GitHub, mas a Vercel não conseguiu compilar o site.\n\nDetalhes:\n${vercelStatus.target_url || vercelStatus.description}`
              );
            }
          }
        }
      } catch {}
    }
  }

  // Fallback caso Vercel não reporte status ou não haja commitSha
  await delay(LINK_ESPERA_INICIAL);
  for (let tentativa = 1; tentativa <= LINK_TENTATIVAS; tentativa++) {
    if (await urlNoAr(baseUrl, LINK_TIMEOUT)) {
      return send(env, chatId, `🔗 Está no ar: ${baseUrl}`);
    }
    if (tentativa < LINK_TENTATIVAS) await delay(LINK_INTERVALO);
  }

  await send(
    env,
    chatId,
    `⚠️ Não consegui confirmar o deploy automaticamente: ${baseUrl}\nVerifique em instantes com /repo ou /deploy.`
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
