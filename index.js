/**
 * LeadScraper Pro — Cloud Functions (backend seguro)
 * =============================================================================
 * RESUMO DA AUDITORIA E DO QUE ESTE ARQUIVO CORRIGE
 *
 * Problema 1 — Botão "+10 leads (meu saldo)" não funcionava
 *   Causa raiz: o cliente escrevia o campo `credits` diretamente no Firestore.
 *   Sem regras de segurança fortes isso é inseguro; COM regras de segurança
 *   fortes (como as deste projeto, ver firestore.rules) a escrita era negada
 *   silenciosamente porque o código antigo não tinha try/catch. O usuário
 *   clicava e nada parecia acontecer.
 *   Correção: toda alteração de crédito agora passa por uma Cloud Function
 *   autenticada (addSelfCredits) que roda com o Admin SDK — que ignora as
 *   regras do Firestore — dentro de uma transação, e devolve erro real para
 *   a interface caso algo falhe.
 *
 * Problema 2 — Botão "Adicionar créditos" (admin → outro usuário) não
 *   funcionava
 *   Causa raiz: mesma causa do problema 1, agravada porque as regras do
 *   Firestore corretamente NUNCA deveriam permitir que o usuário A escreva
 *   no documento do usuário B — então mesmo com regras certas, a escrita
 *   direta do cliente jamais funcionaria. Só uma função de backend, validando
 *   que quem chama é admin, pode fazer isso com segurança.
 *   Correção: addCreditsToUser roda no servidor, confirma isAdmin === true do
 *   chamador, localiza o usuário pelo e-mail (normalizado para minúsculas) e
 *   grava em uma transação + log de auditoria com admin, alvo, quantidade e
 *   data/hora (exatamente como pedido no briefing).
 *
 * Problema 3 — Chave da API de leads exposta no navegador
 *   Causa raiz: a chave da Serper API estava hardcoded no JavaScript do
 *   cliente — visível em "Ver código-fonte" e no histórico do GitHub.
 *   Correção: a busca de leads agora roda inteiramente aqui (searchLeads),
 *   usando um Secret do Cloud Functions. O navegador nunca vê a chave.
 *
 * Problema 4 — Limite de leads por busca preso a ~20 resultados
 *   Causa raiz: a função antiga fazia uma única chamada à API e cortava o
 *   array com .slice(0, limit) — pedir 100 ou 150 não mudava nada, porque a
 *   API só devolve ~20 resultados por página.
 *   Correção: searchLeads pagina automaticamente (parâmetro `page` da Serper),
 *   deduplica por CID (e por nome+endereço como reforço) e para assim que
 *   atingir o limite configurado ou quando a API parar de devolver resultados
 *   novos — sem necessidade de refatoração futura para subir o teto.
 *
 * Problema 5 — Sem trilha de auditoria
 *   Toda operação sensível (crédito, promoção a admin, configuração global)
 *   agora grava um documento em auditLog com quem fez, em quem, quanto e
 *   quando.
 * =============================================================================
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const functionsV1 = require("firebase-functions/v1");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const SERPER_API_KEY = defineSecret("SERPER_API_KEY");

const REGION = "southamerica-east1";
const DEFAULT_MAX_LEADS_PER_SEARCH = 150;
const DEFAULT_MAX_RESULTS_PER_PAGE = 150;
const DEFAULT_SIGNUP_CREDITS = 10;
const HARD_CEILING_LEADS_PER_SEARCH = 500; // teto de segurança configurável pelo admin
const SERPER_PAGE_SIZE = 20; // tamanho de página típico devolvido pela Serper Places
const MAX_SERPER_PAGES = 30; // 30 x 20 = até 600 resultados brutos antes da dedup

// Bootstrap: o primeiro e-mail abaixo vira superadmin automaticamente ao criar
// conta. Depois disso, novos admins são promovidos via promoteToAdmin.
const ADMIN_BOOTSTRAP_EMAIL = "websitelogx@gmail.com";

const DEFAULT_TEMPLATE =
  "Olá! Encontrei a {empresa} buscando por {nicho} em {cidade} e gostaria de apresentar uma solução de site e automação de atendimento via WhatsApp para o seu negócio. Posso te enviar mais detalhes?";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function assertAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  return request.auth.uid;
}

async function getUserProfile(uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Perfil de usuário não encontrado.");
  }
  return { ref: snap.ref, data: snap.data() };
}

async function assertAdmin(uid) {
  const { data } = await getUserProfile(uid);
  if (data.isAdmin !== true) {
    throw new HttpsError(
      "permission-denied",
      "Apenas administradores podem executar esta ação."
    );
  }
  return data;
}

async function getGlobalConfig() {
  const ref = db.collection("config").doc("global");
  const snap = await ref.get();
  if (!snap.exists) {
    const defaults = {
      maxLeadsPerSearch: DEFAULT_MAX_LEADS_PER_SEARCH,
      maxResultsPerPage: DEFAULT_MAX_RESULTS_PER_PAGE,
      defaultSignupCredits: DEFAULT_SIGNUP_CREDITS,
    };
    await ref.set(defaults);
    return defaults;
  }
  return snap.data();
}

async function writeAuditLog(entry) {
  await db.collection("auditLog").add({
    ...entry,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreLead(rating, reviewCount) {
  // Heurística de qualificação (quente/morno/frio) usada pelo frontend para
  // priorizar contato. Empresas bem avaliadas e com volume de avaliações
  // tendem a estar ativas e a se importar com a própria reputação online —
  // perfil ideal para um pitch de site + automação de atendimento.
  const r = Number(rating) || 0;
  const c = Number(reviewCount) || 0;
  if (r >= 4.3 && c >= 15) return "quente";
  if (r >= 3.7 && c >= 4) return "morno";
  return "frio";
}

// -----------------------------------------------------------------------
// Gatilho: criação de usuário → cria o perfil no Firestore (no servidor)
// -----------------------------------------------------------------------

exports.onUserCreate = functionsV1
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const userRef = db.collection("users").doc(user.uid);
    const existing = await userRef.get();
    if (existing.exists) return; // idempotência: evita sobrescrever em retries

    const config = await getGlobalConfig();
    const email = (user.email || "").toLowerCase();
    const isBootstrapAdmin = !!email && email === ADMIN_BOOTSTRAP_EMAIL;

    await userRef.set({
      name: user.displayName || user.email || "Usuário",
      email,
      credits: config.defaultSignupCredits ?? DEFAULT_SIGNUP_CREDITS,
      isAdmin: isBootstrapAdmin,
      templates: [{ id: "default", name: "Padrão", content: DEFAULT_TEMPLATE }],
      theme: "dark",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: "user_signup",
      performedByUid: user.uid,
      performedByEmail: email,
      targetUid: user.uid,
      targetEmail: email,
      amount: config.defaultSignupCredits ?? DEFAULT_SIGNUP_CREDITS,
      balanceAfter: config.defaultSignupCredits ?? DEFAULT_SIGNUP_CREDITS,
    });

    if (isBootstrapAdmin) {
      logger.info(`Usuário bootstrap promovido a admin: ${email}`);
    }
  });

// -----------------------------------------------------------------------
// Créditos e administração (corrige os bugs #1 e #2 do relatório)
// -----------------------------------------------------------------------

// Botão "+10 leads (meu saldo)" — disponível apenas para administradores,
// sempre adiciona exatamente 10 créditos à própria conta (rótulo e
// comportamento agora batem, ao contrário da versão anterior).
exports.addSelfCredits = onCall({ region: REGION }, async (request) => {
  const uid = assertAuth(request);
  const adminProfile = await assertAdmin(uid);
  const AMOUNT = 10;
  const userRef = db.collection("users").doc(uid);

  const newBalance = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const current = snap.data().credits || 0;
    const updated = current + AMOUNT;
    tx.update(userRef, { credits: updated });
    return updated;
  });

  await writeAuditLog({
    action: "admin_self_add",
    performedByUid: uid,
    performedByEmail: adminProfile.email,
    targetUid: uid,
    targetEmail: adminProfile.email,
    amount: AMOUNT,
    balanceAfter: newBalance,
  });

  return { success: true, newBalance };
});

exports.resetSelfBalance = onCall({ region: REGION }, async (request) => {
  const uid = assertAuth(request);
  const adminProfile = await assertAdmin(uid);
  const userRef = db.collection("users").doc(uid);

  await userRef.update({ credits: 0 });

  await writeAuditLog({
    action: "admin_self_reset",
    performedByUid: uid,
    performedByEmail: adminProfile.email,
    targetUid: uid,
    targetEmail: adminProfile.email,
    amount: 0,
    balanceAfter: 0,
  });

  return { success: true };
});

// Botão "Adicionar créditos" do painel de administração.
exports.addCreditsToUser = onCall({ region: REGION }, async (request) => {
  const uid = assertAuth(request);
  const adminProfile = await assertAdmin(uid);

  const targetEmail = normalizeEmail(request.data?.targetEmail);
  const amount = Number(request.data?.amount);

  if (!targetEmail) {
    throw new HttpsError("invalid-argument", "Informe o e-mail do usuário.");
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
    throw new HttpsError("invalid-argument", "Quantidade inválida (1 a 5000).");
  }

  const query = await db
    .collection("users")
    .where("email", "==", targetEmail)
    .limit(1)
    .get();
  if (query.empty) {
    throw new HttpsError(
      "not-found",
      "Usuário não encontrado. Confirme o e-mail exato usado no cadastro."
    );
  }
  const targetRef = query.docs[0].ref;

  const newBalance = await db.runTransaction(async (tx) => {
    const snap = await tx.get(targetRef);
    const current = snap.data().credits || 0;
    const updated = current + amount;
    tx.update(targetRef, { credits: updated });
    return updated;
  });

  await writeAuditLog({
    action: "admin_add_credits",
    performedByUid: uid,
    performedByEmail: adminProfile.email,
    targetUid: targetRef.id,
    targetEmail,
    amount,
    balanceAfter: newBalance,
  });

  return { success: true, newBalance, targetEmail };
});

exports.promoteToAdmin = onCall({ region: REGION }, async (request) => {
  const uid = assertAuth(request);
  const adminProfile = await assertAdmin(uid);

  const targetEmail = normalizeEmail(request.data?.targetEmail);
  if (!targetEmail) {
    throw new HttpsError("invalid-argument", "Informe o e-mail do usuário.");
  }

  const query = await db
    .collection("users")
    .where("email", "==", targetEmail)
    .limit(1)
    .get();
  if (query.empty) {
    throw new HttpsError("not-found", "Usuário não encontrado.");
  }
  const targetRef = query.docs[0].ref;

  await targetRef.update({ isAdmin: true });

  await writeAuditLog({
    action: "admin_promote",
    performedByUid: uid,
    performedByEmail: adminProfile.email,
    targetUid: targetRef.id,
    targetEmail,
    amount: 0,
    balanceAfter: null,
  });

  return { success: true, targetEmail };
});

// Configuração global (limite de leads por busca / por página) — só admin.
exports.updateGlobalConfig = onCall({ region: REGION }, async (request) => {
  const uid = assertAuth(request);
  const adminProfile = await assertAdmin(uid);

  const maxLeadsPerSearch = Number(request.data?.maxLeadsPerSearch);
  if (
    !Number.isFinite(maxLeadsPerSearch) ||
    maxLeadsPerSearch < 1 ||
    maxLeadsPerSearch > HARD_CEILING_LEADS_PER_SEARCH
  ) {
    throw new HttpsError(
      "invalid-argument",
      `Limite inválido (1 a ${HARD_CEILING_LEADS_PER_SEARCH}).`
    );
  }

  const ref = db.collection("config").doc("global");
  await ref.set(
    { maxLeadsPerSearch, maxResultsPerPage: maxLeadsPerSearch },
    { merge: true }
  );

  await writeAuditLog({
    action: "admin_update_config",
    performedByUid: uid,
    performedByEmail: adminProfile.email,
    targetUid: null,
    targetEmail: null,
    amount: maxLeadsPerSearch,
    balanceAfter: null,
    details: { field: "maxLeadsPerSearch" },
  });

  return { success: true, maxLeadsPerSearch };
});

// -----------------------------------------------------------------------
// Busca de leads — proxy seguro da Serper API (corrige #3 e #4 do relatório)
// -----------------------------------------------------------------------

async function fetchSerperPage(query, page, apiKey) {
  const response = await fetch("https://google.serper.dev/places", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, page, gl: "br", hl: "pt-br" }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new HttpsError(
      "unavailable",
      `Falha ao consultar a API de leads (HTTP ${response.status}). ${text}`.trim()
    );
  }

  const data = await response.json();
  return Array.isArray(data.places) ? data.places : [];
}

exports.searchLeads = onCall(
  { region: REGION, secrets: [SERPER_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    const uid = assertAuth(request);
    const { ref: userRef, data: profile } = await getUserProfile(uid);

    const niche = String(request.data?.niche || "").trim();
    const city = String(request.data?.city || "").trim();
    const state = String(request.data?.state || "").trim();
    const neighborhood = String(request.data?.neighborhood || "").trim();
    let requestedLimit = Number(request.data?.limit);

    if (!niche) {
      throw new HttpsError("invalid-argument", "Informe o nicho ou profissão.");
    }

    const config = await getGlobalConfig();
    const maxAllowed = config.maxLeadsPerSearch || DEFAULT_MAX_LEADS_PER_SEARCH;
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      requestedLimit = maxAllowed;
    }
    const limit = Math.min(requestedLimit, maxAllowed, HARD_CEILING_LEADS_PER_SEARCH);

    if ((profile.credits || 0) <= 0) {
      throw new HttpsError(
        "resource-exhausted",
        "Saldo de leads insuficiente. Solicite créditos a um administrador."
      );
    }

    const queryParts = [niche];
    if (neighborhood) queryParts.push(neighborhood);
    if (city) queryParts.push(city);
    if (state) queryParts.push(state);
    const searchQuery = queryParts.join(" em ").replace(" em em ", " em ");

    const seen = new Set();
    const leads = [];
    let consecutiveEmptyPages = 0;

    for (let page = 1; page <= MAX_SERPER_PAGES; page++) {
      if (leads.length >= limit) break;

      let pageResults;
      try {
        pageResults = await fetchSerperPage(searchQuery, page, SERPER_API_KEY.value());
      } catch (err) {
        if (leads.length > 0) {
          // já temos resultados parciais: devolve o que foi possível coletar
          // em vez de derrubar a busca inteira por uma falha de página tardia
          logger.warn("Falha em página tardia da Serper, devolvendo parcial", err);
          break;
        }
        throw err;
      }

      if (pageResults.length === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) break;
        continue;
      }
      consecutiveEmptyPages = 0;

      for (const place of pageResults) {
        const dedupeKey =
          place.cid || `${place.title || ""}|${place.address || ""}`.toLowerCase();
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const rating = typeof place.rating === "number" ? place.rating : null;
        const reviewCount = typeof place.ratingCount === "number" ? place.ratingCount : 0;

        leads.push({
          name: place.title || "Sem nome",
          address: place.address || "",
          phone: place.phoneNumber || "",
          website: place.website || "",
          rating,
          reviewCount,
          cid: place.cid || null,
          niche,
          city,
          state,
          neighborhood,
          score: scoreLead(rating, reviewCount),
          status: "Novo",
          notes: "",
          lastContactAt: null,
          source: "serper",
        });

        if (leads.length >= limit) break;
      }

      if (pageResults.length < SERPER_PAGE_SIZE) break; // última página da API
    }

    // Consumo de créditos: 1 crédito por lead retornado, nunca mais do que o
    // saldo disponível (evita saldo negativo em buscas concorrentes graças à
    // transação abaixo).
    const newBalance = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const current = snap.data().credits || 0;
      const toConsume = Math.min(current, leads.length);
      if (toConsume <= 0) return current;
      tx.update(userRef, { credits: current - toConsume });
      return current - toConsume;
    });

    const consumed = (profile.credits || 0) - newBalance;

    await writeAuditLog({
      action: "consume_search",
      performedByUid: uid,
      performedByEmail: profile.email,
      targetUid: uid,
      targetEmail: profile.email,
      amount: -consumed,
      balanceAfter: newBalance,
      details: { niche, city, state, neighborhood, returned: leads.length },
    });

    return { success: true, leads, newBalance, maxAllowed };
  }
);
