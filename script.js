/**
 * LeadScraper Pro — Frontend (script.js)
 * =============================================================================
 * Camada de interface. Toda regra sensível (créditos, promoção a admin, busca
 * na API de leads) vive nas Cloud Functions (functions/index.js) — este
 * arquivo só chama essas funções e renderiza o resultado. Operações que o
 * próprio dono do dado pode fazer com segurança (CRUD dos próprios leads,
 * templates, tema) continuam client-side, protegidas pelas firestore.rules.
 *
 * Organização (procure pelos cabeçalhos ====):
 *   ESTADO · REFERÊNCIAS DOM · UTILITÁRIOS · MODAIS · TEMA · AUTENTICAÇÃO ·
 *   SESSÃO (listeners em tempo real) · NAVEGAÇÃO · BUSCA DE LEADS ·
 *   CARTEIRA DE LEADS (filtros/tabela/paginação) · MENSAGENS · TEMPLATES ·
 *   ADMINISTRAÇÃO · DASHBOARD/GRÁFICOS · EXPORTAÇÃO · EVENT LISTENERS · INIT
 * =============================================================================
 */

"use strict";

const auth = firebase.auth();
const db = firebase.firestore();

// Precisa bater com defaultSignupCredits() em firestore.rules — como regras
// do Firestore não importam constantes externas, o valor é duplicado lá de
// propósito. Se mudar aqui, mude lá também.
const DEFAULT_SIGNUP_CREDITS = 10;
const DEFAULT_TEMPLATE =
  "Olá! Encontrei a {empresa} buscando por {nicho} em {cidade} e gostaria de apresentar uma solução de site e automação de atendimento via WhatsApp para o seu negócio. Posso te enviar mais detalhes?";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreLead(rating, reviewCount) {
  const r = Number(rating) || 0;
  const c = Number(reviewCount) || 0;
  if (r >= 4.3 && c >= 15) return "quente";
  if (r >= 3.7 && c >= 4) return "morno";
  return "frio";
}

// Registra uma ação sensível (crédito, promoção, configuração) na coleção
// auditLog. Nunca bloqueia o fluxo principal se falhar — é só rastro.
async function writeAuditLog(entry) {
  if (!currentUser) return;
  try {
    await db.collection("auditLog").add({
      ...entry,
      performedByUid: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("Não foi possível gravar o log de auditoria:", err);
  }
}

// ============================== ESTADO ==============================

let currentUser = null;
let currentUserProfile = null;
let walletLeads = [];
let messageLog = [];
let globalConfig = { maxLeadsPerSearch: 150, maxResultsPerPage: 150 };

let unsubProfile = null;
let unsubLeads = null;
let unsubMessages = null;
let unsubConfig = null;

let currentSearchLeads = [];
let searchIsMock = false;
let editingLeadId = null;
let activeView = "dashboard";

let currentPage = 1;
let pageSize = 50;
const filters = { text: "", neighborhood: "", status: "", score: "", niche: "", minRating: 0 };

let charts = { status: null, niche: null };
let confirmResolver = null;

// ============================== REFERÊNCIAS DOM ==============================

const $ = (id) => document.getElementById(id);

const authSection = $("auth-section");
const appShell = $("app-shell");
const loginBox = $("login-box");
const registerBox = $("register-box");
const forgotBox = $("forgot-box");

const userNameDisplay = $("user-name-display");
const userAvatar = $("user-avatar");
const leadsBalanceDisplay = $("leads-balance-display");
const adminSection = $("admin-section");

const resultsPanel = $("results-panel");
const searchResultsBody = $("search-results-body");
const resultCountSpan = $("result-count");
const apiStatusBox = $("api-status-box");
const btnSaveLeads = $("btn-save-leads");
const searchCreditsHint = $("search-credits-hint");

const leadsBody = $("leads-body");
const walletCountLabel = $("wallet-count-label");
const filterNicheSelect = $("filter-niche");
const templatesList = $("templates-list");

const toastContainer = $("toast-container");

// ============================== UTILITÁRIOS ==============================

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}

function normalizeString(str) {
  if (!str) return "";
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function cleanPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function statusToClass(status) {
  return "status-" + String(status || "Novo").toLowerCase().replace(/\s+/g, "-");
}

function scoreMeta(score) {
  const map = {
    quente: { emoji: "🔥", label: "Quente" },
    morno: { emoji: "🟡", label: "Morno" },
    frio: { emoji: "🔵", label: "Frio" },
  };
  return map[score] || map.frio;
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

function formatDateShort(ts) {
  const date = toDate(ts);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function timeAgo(ts) {
  const date = toDate(ts);
  if (!date) return "agora mesmo";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD} d`;
  return formatDateShort(ts);
}

function isWithinDays(ts, days) {
  const date = toDate(ts);
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 86400000;
}

function showToast(message, type = "info", timeout = 4500) {
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", warning: "fa-triangle-exclamation", info: "fa-circle-info" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

function setValidationMsg(el, message, type) {
  el.textContent = message || "";
  el.classList.remove("success", "error");
  if (type) el.classList.add(type);
}

function setButtonLoading(btn, loading) {
  const label = btn.querySelector(".btn-label");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = loading;
  if (label) label.classList.toggle("hidden", loading);
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

function translateFirebaseError(err) {
  const code = err?.code || "";
  const map = {
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente entrar.",
    "auth/weak-password": "A senha deve ter no mínimo 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "functions/permission-denied": "Você não tem permissão para esta ação.",
    "permission-denied": "Você não tem permissão para esta ação.",
    "resource-exhausted": "Saldo de leads insuficiente.",
    "not-found": "Usuário não encontrado. Confirme o e-mail exato usado no cadastro.",
    "invalid-argument": err?.message || "Dados inválidos.",
    unauthenticated: "Sua sessão expirou. Faça login novamente.",
  };
  return map[code] || err?.message || "Ocorreu um erro inesperado.";
}

// ============================== MODAIS ==============================

function openModal(el) {
  el.classList.remove("hidden");
}
function closeModal(el) {
  el.classList.add("hidden");
}
function bindModalDismiss(modalEl, closeBtnSelectors) {
  closeBtnSelectors.forEach((sel) => {
    const btn = modalEl.querySelector(sel) || document.querySelector(sel);
    if (btn) btn.addEventListener("click", () => closeModal(modalEl));
  });
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal(modalEl);
  });
}

function confirmDialog(title, message) {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  openModal($("confirm-modal"));
  return new Promise((resolve) => { confirmResolver = resolve; });
}

// ============================== TEMA ==============================

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  const icon = $("btn-theme-toggle").querySelector("i");
  icon.className = t === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
  renderCharts(); // recolore os gráficos para o novo tema
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  if (currentUser) {
    try {
      await db.collection("users").doc(currentUser.uid).update({ theme: next });
    } catch (err) {
      console.warn("Não foi possível salvar a preferência de tema:", err);
    }
  }
}

// ============================== AUTENTICAÇÃO ==============================

function toggleAuth(type) {
  [loginBox, registerBox, forgotBox].forEach((b) => b.classList.add("hidden"));
  if (type === "login") loginBox.classList.remove("hidden");
  else if (type === "register") registerBox.classList.remove("hidden");
  else if (type === "forgot") forgotBox.classList.remove("hidden");
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = $("btn-login-submit");
  setButtonLoading(btn, true);
  try {
    await auth.signInWithEmailAndPassword($("login-email").value.trim(), $("login-password").value);
  } catch (err) {
    showToast(translateFirebaseError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = $("reg-name").value.trim();
  const email = normalizeEmail($("reg-email").value);
  const password = $("reg-password").value;
  if (password.length < 6) {
    showToast("A senha deve ter no mínimo 6 caracteres.", "error");
    return;
  }
  const btn = $("btn-register-submit");
  setButtonLoading(btn, true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    // Sem Cloud Functions, o próprio cliente cria o perfil — as
    // firestore.rules obrigam exatamente estes valores padrão (credits,
    // isAdmin) e rejeitam qualquer tentativa de manipular o payload.
    await db.collection("users").doc(cred.user.uid).set({
      name: name || email,
      email,
      credits: DEFAULT_SIGNUP_CREDITS,
      isAdmin: false,
      templates: [{ id: "default", name: "Padrão", content: DEFAULT_TEMPLATE }],
      theme: "dark",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showToast("Conta criada com sucesso! Você já recebeu seus créditos iniciais.", "success");
  } catch (err) {
    showToast(translateFirebaseError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleForgot(e) {
  e.preventDefault();
  const btn = $("btn-forgot-submit");
  setButtonLoading(btn, true);
  try {
    await auth.sendPasswordResetEmail($("forgot-email").value.trim());
    showToast("E-mail de recuperação enviado! Verifique sua caixa de entrada.", "success");
    toggleAuth("login");
  } catch (err) {
    showToast(translateFirebaseError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function logout() {
  stopUserSession();
  await auth.signOut();
}

// ============================== SESSÃO (listeners em tempo real) ==============================

function startUserSession(user) {
  currentUser = user;

  unsubProfile = db.collection("users").doc(user.uid).onSnapshot(
    (snap) => {
      if (!snap.exists) return; // o .set() do cadastro ainda está em voo; o próximo snapshot já traz os dados
      currentUserProfile = snap.data();
      renderHeader();
      renderTemplatesList();
      applyTheme(currentUserProfile.theme || "dark");
    },
    (err) => showToast("Erro ao carregar perfil: " + translateFirebaseError(err), "error")
  );

  unsubLeads = db.collection("leads")
    .where("ownerUid", "==", user.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        walletLeads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateNicheFilterOptions();
        applyWalletFiltersAndRender();
        renderDashboard();
      },
      (err) => showToast("Erro ao carregar leads: " + translateFirebaseError(err), "error")
    );

  unsubMessages = db.collection("messageLog")
    .where("ownerUid", "==", user.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        messageLog = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderMessagesView();
        renderDashboard();
      },
      (err) => console.warn("Erro ao carregar histórico de mensagens:", err)
    );

  unsubConfig = db.collection("config").doc("global").onSnapshot(
    (snap) => {
      if (snap.exists) globalConfig = snap.data();
      const max = globalConfig.maxLeadsPerSearch || 150;
      $("limit-max-label").textContent = max;
      $("limit").max = max;
      if (!$("admin-max-leads").value) $("admin-max-leads").placeholder = `Atual: ${max}`;
    },
    () => {}
  );
}

function stopUserSession() {
  [unsubProfile, unsubLeads, unsubMessages, unsubConfig].forEach((u) => u && u());
  unsubProfile = unsubLeads = unsubMessages = unsubConfig = null;
  currentUser = null;
  currentUserProfile = null;
  walletLeads = [];
  messageLog = [];
  currentSearchLeads = [];
}

function renderHeader() {
  if (!currentUserProfile) return;
  userNameDisplay.textContent = currentUserProfile.name || currentUserProfile.email;
  userAvatar.textContent = (currentUserProfile.name || currentUserProfile.email || "?").trim().charAt(0).toUpperCase();
  leadsBalanceDisplay.textContent = currentUserProfile.credits ?? 0;
  adminSection.style.display = currentUserProfile.isAdmin ? "block" : "none";
  searchCreditsHint.textContent = `Saldo atual: ${currentUserProfile.credits ?? 0} lead(s)`;
}

// ============================== NAVEGAÇÃO ==============================

function showView(view) {
  activeView = view;
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const target = $(`view-${view}`);
  if (target) target.classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
}

// ============================== BUSCA DE LEADS ==============================

function generateMockLeadsClient(niche, city, state, neighborhood, limit) {
  const leads = [];
  const bairro = neighborhood || "Centro";
  for (let i = 0; i < limit; i++) {
    const rating = Number((Math.random() * 2 + 3).toFixed(1));
    const reviewCount = Math.floor(Math.random() * 200);
    leads.push({
      name: `${niche} Exemplo ${i + 1}`,
      niche, city, state, neighborhood,
      address: `${bairro}, ${city || "Cidade Exemplo"} - ${state || "BR"}`,
      phone: `(34) 9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
      website: `https://www.exemplo${i}.com.br`,
      rating, reviewCount,
      score: rating >= 4.3 && reviewCount >= 15 ? "quente" : rating >= 3.7 ? "morno" : "frio",
      status: "Novo", notes: "", lastContactAt: null, source: "mock",
      isMock: true,
    });
  }
  return leads;
}

async function searchLeadsViaProxy(niche, city, state, neighborhood, limit) {
  const idToken = await currentUser.getIdToken();
  const resp = await fetch(LEAD_SEARCH_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ niche, city, state, neighborhood, limit }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.message || "Falha ao consultar a API de leads.");
    err.code = data.error || `http-${resp.status}`;
    throw err;
  }
  return data.leads || [];
}

async function handleSearchSubmit(e) {
  e.preventDefault();
  const niche = $("niche").value.trim();
  const city = $("city").value.trim();
  const state = $("state").value;
  const neighborhood = $("neighborhood").value.trim();
  const maxAllowed = globalConfig.maxLeadsPerSearch || 150;
  const limit = Math.min(parseInt($("limit").value, 10) || 50, maxAllowed);

  if (!niche) {
    showToast("Informe o nicho ou profissão para buscar.", "error");
    return;
  }

  const btn = $("btn-search-submit");
  setButtonLoading(btn, true);
  apiStatusBox.classList.add("hidden");
  resultsPanel.classList.remove("hidden");

  // Sem créditos: nem chama o proxy (economiza cota da Serper) — cai direto
  // no modo demonstração, igual ao comportamento original.
  if ((currentUserProfile?.credits || 0) <= 0) {
    const leads = generateMockLeadsClient(niche, city, state, neighborhood, Math.min(limit, maxAllowed));
    currentSearchLeads = leads;
    searchIsMock = true;
    renderSearchResults(leads);
    btnSaveLeads.disabled = false;
    apiStatusBox.className = "info-box info";
    apiStatusBox.innerHTML = `<i class="fa-solid fa-circle-info"></i> Saldo de leads insuficiente. Exibindo ${leads.length} lead(s) fictício(s) para demonstração — peça créditos a um administrador para buscar leads reais.`;
    apiStatusBox.classList.remove("hidden");
    setButtonLoading(btn, false);
    return;
  }

  searchResultsBody.innerHTML = `
    <tr class="skeleton-row"><td colspan="5"><div class="skeleton-bar"></div></td></tr>
    <tr class="skeleton-row"><td colspan="5"><div class="skeleton-bar"></div></td></tr>
    <tr class="skeleton-row"><td colspan="5"><div class="skeleton-bar"></div></td></tr>`;

  try {
    const leads = await searchLeadsViaProxy(niche, city, state, neighborhood, limit);
    currentSearchLeads = leads;
    searchIsMock = false;
    renderSearchResults(leads);
    btnSaveLeads.disabled = leads.length === 0;

    // Débito de créditos: transação no próprio cliente, protegida pelas
    // firestore.rules (um usuário comum só pode DIMINUIR o próprio saldo,
    // nunca abaixo de zero — ver regra de users/{uid}).
    const userRef = db.collection("users").doc(currentUser.uid);
    const newBalance = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const current = snap.data().credits || 0;
      const toConsume = Math.min(current, leads.length);
      if (toConsume <= 0) return current;
      const updated = current - toConsume;
      tx.update(userRef, { credits: updated });
      return updated;
    });
    const consumed = (currentUserProfile?.credits || 0) - newBalance;
    writeAuditLog({
      action: "consume_search",
      performedByEmail: currentUserProfile?.email,
      targetUid: currentUser.uid,
      targetEmail: currentUserProfile?.email,
      amount: -consumed,
      balanceAfter: newBalance,
      details: { niche, city, state, neighborhood, returned: leads.length },
    });

    apiStatusBox.className = "info-box success";
    apiStatusBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${leads.length} lead(s) encontrados. Créditos consumidos: ${consumed}. Saldo atual: ${newBalance}.`;
    apiStatusBox.classList.remove("hidden");
  } catch (err) {
    if (err.code === "unauthenticated") {
      showToast("Sua sessão expirou. Faça login novamente.", "error");
    } else {
      searchResultsBody.innerHTML = `<tr><td colspan="5" class="empty-row">Não foi possível concluir a busca.</td></tr>`;
      apiStatusBox.className = "info-box error";
      apiStatusBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(err.message || "Erro inesperado.")}`;
      apiStatusBox.classList.remove("hidden");
    }
  } finally {
    setButtonLoading(btn, false);
  }
}

function renderSearchResults(leads) {
  resultCountSpan.textContent = leads.length;
  if (leads.length === 0) {
    searchResultsBody.innerHTML = `<tr><td colspan="5" class="empty-row">Nenhum resultado encontrado. Tente ampliar a região ou simplificar o nicho.</td></tr>`;
    return;
  }
  searchResultsBody.innerHTML = leads.map((lead, idx) => {
    const sc = scoreMeta(lead.score);
    const ratingTxt = lead.rating ? `${lead.rating.toFixed ? lead.rating.toFixed(1) : lead.rating} ⭐ (${lead.reviewCount || 0})` : "Sem avaliação";
    const phone = cleanPhone(lead.phone);
    return `
      <tr>
        <td><span class="lead-name">${escapeHtml(lead.name)}</span><div class="lead-meta">${escapeHtml(lead.niche || "")}</div></td>
        <td><span class="score-pill score-${lead.score}">${sc.emoji} ${sc.label}</span></td>
        <td>${escapeHtml(ratingTxt)}</td>
        <td class="lead-meta">${escapeHtml(lead.address || "")}</td>
        <td>
          <span class="mono-cell">${escapeHtml(lead.phone || "—")}</span>
          ${phone ? `<button class="btn-action whatsapp" data-search-msg="${idx}" title="Gerar abordagem"><i class="fa-brands fa-whatsapp"></i></button>` : ""}
        </td>
      </tr>`;
  }).join("");

  searchResultsBody.querySelectorAll("[data-search-msg]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lead = currentSearchLeads[Number(btn.dataset.searchMsg)];
      openMessageModalFor(lead, null);
    });
  });
}

async function handleSaveLeads() {
  if (currentSearchLeads.length === 0) return;
  if (searchIsMock) {
    showToast("Leads fictícios são apenas para demonstração e não podem ser salvos. Peça créditos a um administrador.", "warning");
    return;
  }
  const existingKeys = new Set(
    walletLeads.map((l) => l.cid || `${normalizeString(l.name)}|${normalizeString(l.address)}`)
  );
  const toSave = currentSearchLeads.filter((l) => {
    const key = l.cid || `${normalizeString(l.name)}|${normalizeString(l.address)}`;
    return !existingKeys.has(key);
  });
  const skipped = currentSearchLeads.length - toSave.length;

  if (toSave.length === 0) {
    showToast("Todos esses leads já estão na sua carteira.", "info");
    return;
  }

  btnSaveLeads.disabled = true;
  try {
    let batch = db.batch();
    let opsInBatch = 0;
    const leadsRef = db.collection("leads");
    for (const lead of toSave) {
      const docRef = leadsRef.doc();
      batch.set(docRef, {
        ownerUid: currentUser.uid,
        name: lead.name, address: lead.address || "", phone: lead.phone || "",
        website: lead.website || "", rating: lead.rating ?? null, reviewCount: lead.reviewCount || 0,
        cid: lead.cid || null, niche: lead.niche || "", city: lead.city || "",
        state: lead.state || "", neighborhood: lead.neighborhood || "",
        score: lead.score || "frio", status: "Novo", notes: "", lastContactAt: null,
        source: lead.source || "serper",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      opsInBatch++;
      if (opsInBatch === 450) { await batch.commit(); batch = db.batch(); opsInBatch = 0; }
    }
    if (opsInBatch > 0) await batch.commit();

    showToast(
      skipped > 0
        ? `${toSave.length} lead(s) salvos na carteira (${skipped} já existiam e foram ignorados).`
        : `${toSave.length} lead(s) salvos na carteira.`,
      "success"
    );
  } catch (err) {
    showToast("Erro ao salvar leads: " + translateFirebaseError(err), "error");
  } finally {
    btnSaveLeads.disabled = false;
  }
}

// ============================== CARTEIRA DE LEADS ==============================

function updateNicheFilterOptions() {
  const niches = [...new Set(walletLeads.map((l) => l.niche).filter(Boolean))].sort();
  const current = filterNicheSelect.value;
  filterNicheSelect.innerHTML = '<option value="">Todos</option>' + niches.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (niches.includes(current)) filterNicheSelect.value = current;
}

function getFilteredWallet() {
  let list = [...walletLeads];
  if (filters.text) {
    const q = normalizeString(filters.text);
    list = list.filter((l) => normalizeString(l.name).includes(q) || normalizeString(l.address).includes(q));
  }
  if (filters.neighborhood) {
    const q = normalizeString(filters.neighborhood);
    list = list.filter((l) => normalizeString(l.address).includes(q) || normalizeString(l.neighborhood).includes(q));
  }
  if (filters.status) list = list.filter((l) => l.status === filters.status);
  if (filters.score) list = list.filter((l) => l.score === filters.score);
  if (filters.niche) list = list.filter((l) => l.niche === filters.niche);
  if (filters.minRating > 0) list = list.filter((l) => (l.rating || 0) >= filters.minRating);
  return list;
}

function applyWalletFiltersAndRender() {
  const filtered = getFilteredWallet();
  walletCountLabel.textContent = `${walletLeads.length} lead(s) na carteira`;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  renderLeadsTable(pageItems, filtered.length);
  renderPagination(totalPages);
}

function renderLeadsTable(leads, filteredTotal) {
  if (leads.length === 0) {
    const msg = filteredTotal === 0 && walletLeads.length > 0
      ? "Nenhum lead corresponde aos filtros aplicados."
      : "Sua carteira está vazia. Busque leads na aba Prospecção e salve os que interessarem.";
    leadsBody.innerHTML = `<tr><td colspan="4" class="empty-row">${msg}</td></tr>`;
    return;
  }
  leadsBody.innerHTML = leads.map((lead) => {
    const sc = scoreMeta(lead.score);
    return `
      <tr>
        <td>
          <div class="lead-info-primary">
            <span class="lead-name">${escapeHtml(lead.name)}</span>
            <span class="badge ${statusToClass(lead.status)}"><span class="badge-dot"></span>${escapeHtml(lead.status || "Novo")}</span>
          </div>
          <div class="lead-meta"><span class="score-pill score-${lead.score}">${sc.emoji} ${sc.label}</span></div>
        </td>
        <td>${escapeHtml(lead.niche || "")}<div class="lead-meta">${escapeHtml(lead.address || "")}</div></td>
        <td><span class="mono-cell">${escapeHtml(lead.phone || "—")}</span><div class="lead-meta">${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">Site ↗</a>` : "Sem site"}</div></td>
        <td class="actions-cell">
          <button class="btn-action whatsapp" data-msg="${lead.id}" title="Gerar abordagem"><i class="fa-brands fa-whatsapp"></i></button>
          <button class="btn-action" data-edit="${lead.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-delete" data-delete="${lead.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
  }).join("");

  leadsBody.querySelectorAll("[data-msg]").forEach((b) => b.addEventListener("click", () => {
    const lead = walletLeads.find((l) => l.id === b.dataset.msg);
    if (lead) openMessageModalFor(lead, lead.id);
  }));
  leadsBody.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEditLeadModal(b.dataset.edit)));
  leadsBody.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => handleDeleteLead(b.dataset.delete)));
}

function renderPagination(totalPages) {
  const container = $("pagination-controls");
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  const buttons = [];
  const addBtn = (label, page, opts = {}) => buttons.push({ label, page, ...opts });

  addBtn('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, { disabled: currentPage === 1 });
  const windowStart = Math.max(1, currentPage - 2);
  const windowEnd = Math.min(totalPages, currentPage + 2);
  if (windowStart > 1) { addBtn("1", 1); if (windowStart > 2) addBtn("…", null, { disabled: true }); }
  for (let p = windowStart; p <= windowEnd; p++) addBtn(String(p), p, { active: p === currentPage });
  if (windowEnd < totalPages) { if (windowEnd < totalPages - 1) addBtn("…", null, { disabled: true }); addBtn(String(totalPages), totalPages); }
  addBtn('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, { disabled: currentPage === totalPages });

  container.innerHTML = buttons.map((b) =>
    `<button class="page-btn${b.active ? " active" : ""}" ${b.disabled ? "disabled" : ""} data-page="${b.page}">${b.label}</button>`
  ).join("");
  container.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.dataset.page);
      if (!page) return;
      currentPage = page;
      applyWalletFiltersAndRender();
      $("view-leads").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function openEditLeadModal(leadId) {
  const lead = walletLeads.find((l) => l.id === leadId);
  if (!lead) return;
  editingLeadId = leadId;
  $("detail-lead-name").textContent = lead.name;
  $("detail-status").value = lead.status || "Novo";
  $("detail-score").value = lead.score || "frio";
  $("detail-notes").value = lead.notes || "";
  $("detail-last-contact").textContent = lead.lastContactAt
    ? `Último contato: ${timeAgo(lead.lastContactAt)}`
    : "Ainda não contatado.";
  openModal($("lead-details-modal"));
}

async function saveLeadDetails() {
  if (!editingLeadId) return;
  const btn = $("btn-save-details");
  btn.disabled = true;
  try {
    await db.collection("leads").doc(editingLeadId).update({
      status: $("detail-status").value,
      score: $("detail-score").value,
      notes: $("detail-notes").value,
    });
    showToast("Lead atualizado.", "success");
    closeModal($("lead-details-modal"));
  } catch (err) {
    showToast("Erro ao salvar: " + translateFirebaseError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

async function handleDeleteLeadFromModal() {
  if (!editingLeadId) return;
  const ok = await confirmDialog("Excluir lead", "Esta ação não pode ser desfeita. Deseja excluir este lead permanentemente?");
  if (!ok) return;
  await handleDeleteLead(editingLeadId, false);
  closeModal($("lead-details-modal"));
}

async function handleDeleteLead(leadId, askConfirm = true) {
  if (askConfirm) {
    const ok = await confirmDialog("Excluir lead", "Esta ação não pode ser desfeita. Deseja excluir este lead permanentemente?");
    if (!ok) return;
  }
  try {
    await db.collection("leads").doc(leadId).delete();
    showToast("Lead excluído.", "success");
  } catch (err) {
    showToast("Erro ao excluir: " + translateFirebaseError(err), "error");
  }
}

// ============================== MENSAGENS ==============================

function openMessageModalFor(lead, savedLeadId) {
  const select = $("modal-template-select");
  const textarea = $("generated-message");
  const whatsBtn = $("btn-send-whatsapp");
  $("message-lead-name").textContent = lead.name;

  const templates = (currentUserProfile?.templates || []);
  select.innerHTML = templates.map((t, i) => `<option value="${i}">${escapeHtml(t.name)}</option>`).join("");

  const buildMessage = () => {
    const tpl = templates[Number(select.value)];
    if (!tpl) return "";
    return tpl.content
      .replace(/{empresa}/g, lead.name || "")
      .replace(/{nicho}/g, lead.niche || "")
      .replace(/{cidade}/g, lead.city || (lead.address || "").split(",")[0] || "")
      .replace(/{bairro}/g, lead.neighborhood || "");
  };

  const refresh = () => {
    textarea.value = buildMessage();
    const phone = cleanPhone(lead.phone);
    if (phone) {
      whatsBtn.href = `https://wa.me/55${phone}?text=${encodeURIComponent(textarea.value)}`;
      whatsBtn.classList.remove("hidden");
    } else {
      whatsBtn.classList.add("hidden");
    }
  };
  select.onchange = refresh;
  refresh();

  $("copy-message").onclick = async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      showToast("Mensagem copiada!", "success");
      logMessageSent(savedLeadId, lead, templates[Number(select.value)]?.name || "Personalizado", textarea.value, "copy");
    } catch {
      showToast("Não foi possível copiar automaticamente. Selecione e copie manualmente.", "warning");
    }
  };
  whatsBtn.onclick = () => {
    logMessageSent(savedLeadId, lead, templates[Number(select.value)]?.name || "Personalizado", textarea.value, "whatsapp");
  };

  openModal($("message-modal"));
}

async function logMessageSent(savedLeadId, lead, templateName, message, channel) {
  if (!currentUser) return;
  try {
    await db.collection("messageLog").add({
      ownerUid: currentUser.uid,
      leadId: savedLeadId || null,
      leadName: lead.name,
      phone: lead.phone || "",
      templateName,
      channel,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (savedLeadId) {
      const lead2 = walletLeads.find((l) => l.id === savedLeadId);
      const updates = { lastContactAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (lead2 && lead2.status === "Novo") updates.status = "Contatado";
      await db.collection("leads").doc(savedLeadId).update(updates);
    }
  } catch (err) {
    console.warn("Falha ao registrar histórico de mensagem:", err);
  }
}

function renderMessagesView() {
  const total = messageLog.length;
  const weekCount = messageLog.filter((m) => isWithinDays(m.createdAt, 7)).length;
  const freq = {};
  messageLog.forEach((m) => { freq[m.templateName] = (freq[m.templateName] || 0) + 1; });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

  $("msg-kpi-total").textContent = total;
  $("msg-kpi-week").textContent = weekCount;
  $("msg-kpi-top-template").textContent = top ? top[0] : "—";

  const body = $("messages-history-body");
  if (total === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty-row">Nenhuma mensagem registrada ainda.</td></tr>`;
    return;
  }
  body.innerHTML = messageLog.slice(0, 100).map((m) => `
    <tr>
      <td>${escapeHtml(m.leadName)}</td>
      <td>${escapeHtml(m.templateName || "—")}</td>
      <td>${formatDateShort(m.createdAt)}</td>
      <td>${m.channel === "whatsapp" ? '<i class="fa-brands fa-whatsapp" style="color:var(--whatsapp)"></i> WhatsApp' : '<i class="fa-regular fa-copy"></i> Copiado'}</td>
    </tr>`).join("");
}

// ============================== TEMPLATES ==============================

function renderTemplatesList() {
  if (!currentUserProfile) return;
  const templates = currentUserProfile.templates || [];
  templatesList.innerHTML = templates.map((tpl) => `
    <li class="template-item">
      <div>
        <div class="template-item-name">${escapeHtml(tpl.name)}</div>
        <div class="template-item-preview">${escapeHtml(tpl.content)}</div>
      </div>
      <div class="template-actions">
        <button class="danger" data-del-template="${escapeHtml(tpl.id)}">Excluir</button>
      </div>
    </li>`).join("");

  templatesList.querySelectorAll("[data-del-template]").forEach((b) => {
    b.addEventListener("click", () => deleteTemplate(b.dataset.delTemplate));
  });
}

async function addTemplate(name, content) {
  if (!name.trim() || !content.trim()) {
    showToast("Preencha nome e conteúdo do modelo.", "error");
    return;
  }
  const newTemplates = [...(currentUserProfile.templates || []), { id: `tpl_${Date.now()}`, name: name.trim(), content: content.trim() }];
  try {
    await db.collection("users").doc(currentUser.uid).update({ templates: newTemplates });
    showToast("Modelo adicionado.", "success");
  } catch (err) {
    showToast("Erro ao salvar modelo: " + translateFirebaseError(err), "error");
  }
}

async function deleteTemplate(id) {
  const templates = currentUserProfile.templates || [];
  if (templates.length <= 1) {
    showToast("Mantenha ao menos um modelo de mensagem.", "warning");
    return;
  }
  const newTemplates = templates.filter((t) => t.id !== id);
  try {
    await db.collection("users").doc(currentUser.uid).update({ templates: newTemplates });
    showToast("Modelo excluído.", "success");
  } catch (err) {
    showToast("Erro ao excluir modelo: " + translateFirebaseError(err), "error");
  }
}

// ============================== ADMINISTRAÇÃO ==============================

async function handleAdminAddSelfCredits() {
  const btn = $("btn-admin-add-self-leads");
  btn.disabled = true;
  const AMOUNT = 10;
  try {
    const userRef = db.collection("users").doc(currentUser.uid);
    const newBalance = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const updated = (snap.data().credits || 0) + AMOUNT;
      tx.update(userRef, { credits: updated });
      return updated;
    });
    writeAuditLog({
      action: "admin_self_add", performedByEmail: currentUserProfile.email,
      targetUid: currentUser.uid, targetEmail: currentUserProfile.email,
      amount: AMOUNT, balanceAfter: newBalance,
    });
    setValidationMsg($("admin-self-msg"), `+10 créditos adicionados. Novo saldo: ${newBalance}.`, "success");
    showToast("Créditos adicionados ao seu saldo.", "success");
  } catch (err) {
    setValidationMsg($("admin-self-msg"), translateFirebaseError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

async function handleAdminResetSelfBalance() {
  const ok = await confirmDialog("Zerar saldo", "Deseja realmente zerar o seu próprio saldo de créditos?");
  if (!ok) return;
  try {
    await db.collection("users").doc(currentUser.uid).update({ credits: 0 });
    writeAuditLog({
      action: "admin_self_reset", performedByEmail: currentUserProfile.email,
      targetUid: currentUser.uid, targetEmail: currentUserProfile.email,
      amount: 0, balanceAfter: 0,
    });
    setValidationMsg($("admin-self-msg"), "Saldo zerado.", "success");
  } catch (err) {
    setValidationMsg($("admin-self-msg"), translateFirebaseError(err), "error");
  }
}

async function handleAdminAddCredits() {
  const email = normalizeEmail($("admin-user-email").value);
  const qty = parseInt($("admin-credits-qty").value, 10);
  if (!email || !Number.isFinite(qty) || qty <= 0 || qty > 5000) {
    setValidationMsg($("admin-credits-msg"), "Preencha um e-mail e uma quantidade válida (1 a 5000).", "error");
    return;
  }
  const btn = $("btn-admin-add-credits");
  btn.disabled = true;
  try {
    const query = await db.collection("users").where("email", "==", email).limit(1).get();
    if (query.empty) {
      throw { code: "not-found" };
    }
    const targetRef = query.docs[0].ref;
    const newBalance = await db.runTransaction(async (tx) => {
      const snap = await tx.get(targetRef);
      const updated = (snap.data().credits || 0) + qty;
      tx.update(targetRef, { credits: updated });
      return updated;
    });
    writeAuditLog({
      action: "admin_add_credits", performedByEmail: currentUserProfile.email,
      targetUid: targetRef.id, targetEmail: email,
      amount: qty, balanceAfter: newBalance,
    });
    setValidationMsg($("admin-credits-msg"), `${qty} créditos adicionados a ${email}. Novo saldo: ${newBalance}.`, "success");
    $("admin-user-email").value = "";
    $("admin-credits-qty").value = "";
  } catch (err) {
    setValidationMsg($("admin-credits-msg"), translateFirebaseError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

async function handleAdminPromote() {
  const email = normalizeEmail($("admin-promote-email").value);
  if (!email) {
    setValidationMsg($("admin-promote-msg"), "Informe o e-mail do usuário.", "error");
    return;
  }
  const btn = $("btn-promote-to-admin");
  btn.disabled = true;
  try {
    const query = await db.collection("users").where("email", "==", email).limit(1).get();
    if (query.empty) {
      throw { code: "not-found" };
    }
    const targetRef = query.docs[0].ref;
    await targetRef.update({ isAdmin: true });
    writeAuditLog({
      action: "admin_promote", performedByEmail: currentUserProfile.email,
      targetUid: targetRef.id, targetEmail: email, amount: 0, balanceAfter: null,
    });
    setValidationMsg($("admin-promote-msg"), `✅ ${email} agora é superadministrador.`, "success");
    $("admin-promote-email").value = "";
  } catch (err) {
    setValidationMsg($("admin-promote-msg"), translateFirebaseError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

async function handleAdminUpdateMaxLeads() {
  const value = parseInt($("admin-max-leads").value, 10);
  if (!Number.isFinite(value) || value < 1 || value > 500) {
    setValidationMsg($("admin-max-leads-msg"), "Informe um valor entre 1 e 500.", "error");
    return;
  }
  const btn = $("btn-admin-update-max-leads");
  btn.disabled = true;
  try {
    await db.collection("config").doc("global").set(
      { maxLeadsPerSearch: value, maxResultsPerPage: value },
      { merge: true }
    );
    writeAuditLog({
      action: "admin_update_config", performedByEmail: currentUserProfile.email,
      targetUid: null, targetEmail: null, amount: value, balanceAfter: null,
      details: { field: "maxLeadsPerSearch" },
    });
    setValidationMsg($("admin-max-leads-msg"), `Limite atualizado para ${value} leads por busca.`, "success");
  } catch (err) {
    setValidationMsg($("admin-max-leads-msg"), translateFirebaseError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

// ============================== DASHBOARD / GRÁFICOS ==============================

function getThemeChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue("--text-muted").trim() || "#9aa3bd",
    grid: styles.getPropertyValue("--line").trim() || "#1b2740",
    gold: styles.getPropertyValue("--gold-500").trim() || "#d4af6a",
    teal: styles.getPropertyValue("--teal-400").trim() || "#2dd4bf",
    statuses: {
      Novo: styles.getPropertyValue("--status-novo").trim(),
      Contatado: styles.getPropertyValue("--status-contatado").trim(),
      Interessado: styles.getPropertyValue("--status-interessado").trim(),
      "Negociação": styles.getPropertyValue("--status-negociacao").trim(),
      Convertido: styles.getPropertyValue("--status-convertido").trim(),
      "Não interessado": styles.getPropertyValue("--status-nao-interessado").trim(),
      "Telefone sem WhatsApp": styles.getPropertyValue("--status-tel-sem-wpp").trim(),
    },
  };
}

function renderDashboardKpis() {
  $("kpi-total").textContent = walletLeads.length;
  $("kpi-hot").textContent = walletLeads.filter((l) => l.score === "quente").length;
  $("kpi-converted").textContent = walletLeads.filter((l) => l.status === "Convertido").length;
  $("kpi-messages-week").textContent = messageLog.filter((m) => isWithinDays(m.createdAt, 7)).length;
}

function renderDashboardRecent() {
  const recent = walletLeads.slice(0, 5);
  const body = $("dashboard-recent-body");
  if (recent.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="empty-row">Nenhum lead ainda.</td></tr>`;
    return;
  }
  body.innerHTML = recent.map((l) => {
    const sc = scoreMeta(l.score);
    return `<tr>
      <td>${escapeHtml(l.name)}</td>
      <td>${escapeHtml(l.niche || "")}</td>
      <td><span class="score-pill score-${l.score}">${sc.emoji} ${sc.label}</span></td>
      <td><span class="badge ${statusToClass(l.status)}"><span class="badge-dot"></span>${escapeHtml(l.status || "Novo")}</span></td>
      <td class="muted small">${timeAgo(l.createdAt)}</td>
    </tr>`;
  }).join("");
}

function renderCharts() {
  if (typeof Chart === "undefined") return;
  const colors = getThemeChartColors();

  const statusCounts = {};
  walletLeads.forEach((l) => { const s = l.status || "Novo"; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const statusLabels = Object.keys(statusCounts);
  const statusCtx = $("chart-status");
  if (charts.status) charts.status.destroy();
  if (statusCtx) {
    charts.status = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: statusLabels.length ? statusLabels : ["Sem dados"],
        datasets: [{
          data: statusLabels.length ? statusLabels.map((s) => statusCounts[s]) : [1],
          backgroundColor: statusLabels.length ? statusLabels.map((s) => colors.statuses[s] || colors.teal) : [colors.grid],
          borderWidth: 0,
        }],
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { color: colors.text, boxWidth: 10, font: { size: 11 } } } },
        cutout: "65%",
      },
    });
  }

  const nicheCounts = {};
  walletLeads.forEach((l) => { if (l.niche) nicheCounts[l.niche] = (nicheCounts[l.niche] || 0) + 1; });
  const topNiches = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const nicheCtx = $("chart-niche");
  if (charts.niche) charts.niche.destroy();
  if (nicheCtx) {
    charts.niche = new Chart(nicheCtx, {
      type: "bar",
      data: {
        labels: topNiches.length ? topNiches.map((n) => n[0]) : ["Sem dados"],
        datasets: [{
          data: topNiches.length ? topNiches.map((n) => n[1]) : [0],
          backgroundColor: colors.gold,
          borderRadius: 6,
          maxBarThickness: 36,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: colors.text, font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } },
        },
      },
    });
  }
}

function renderDashboard() {
  if (!currentUser) return;
  renderDashboardKpis();
  renderDashboardRecent();
  renderCharts();
}

// ============================== EXPORTAÇÃO ==============================

function exportSearchResultsToCSV() {
  if (currentSearchLeads.length === 0) return showToast("Nenhum dado para exportar.", "error");
  const headers = ["Nome", "Nicho", "Endereço", "Telefone", "Site", "Avaliação", "Score"];
  const rows = currentSearchLeads.map((l) => [l.name, l.niche, l.address, l.phone, l.website || "", l.rating || "", l.score]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const csv = "\uFEFF" + headers.join(",") + "\r\n" + rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `leads_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportSearchResultsToXLSX() {
  if (currentSearchLeads.length === 0) return showToast("Nenhum dado para exportar.", "error");
  const data = currentSearchLeads.map((l) => ({
    Nome: l.name, Nicho: l.niche, Endereço: l.address, Telefone: l.phone,
    Site: l.website || "", Avaliação: l.rating || "", Avaliações: l.reviewCount || 0, Score: l.score,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, `leads_${Date.now()}.xlsx`);
}

// ============================== EVENT LISTENERS ==============================

function setupEventListeners() {
  $("login-form").addEventListener("submit", handleLogin);
  $("register-form").addEventListener("submit", handleRegister);
  $("forgot-form").addEventListener("submit", handleForgot);
  $("link-register").onclick = (e) => { e.preventDefault(); toggleAuth("register"); };
  $("link-login-reg").onclick = (e) => { e.preventDefault(); toggleAuth("login"); };
  $("link-forgot").onclick = (e) => { e.preventDefault(); toggleAuth("forgot"); };
  $("link-login-forgot").onclick = (e) => { e.preventDefault(); toggleAuth("login"); };

  $("btn-logout").addEventListener("click", logout);
  $("btn-theme-toggle").addEventListener("click", toggleTheme);

  $("btn-user-menu").addEventListener("click", (e) => {
    e.stopPropagation();
    $("user-dropdown").classList.toggle("hidden");
  });
  document.addEventListener("click", () => $("user-dropdown").classList.add("hidden"));

  document.querySelectorAll(".nav-btn").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));
  document.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.nav)));
  $("btn-goto-search").addEventListener("click", () => showView("leads"));

  $("lead-search-form").addEventListener("submit", handleSearchSubmit);
  $("btn-save-leads").addEventListener("click", handleSaveLeads);
  $("btn-export-csv").addEventListener("click", exportSearchResultsToCSV);
  $("btn-export-xlsx").addEventListener("click", exportSearchResultsToXLSX);

  const onFilterChange = () => { currentPage = 1; applyWalletFiltersAndRender(); };
  $("filter-text").addEventListener("input", debounce(() => { filters.text = $("filter-text").value; onFilterChange(); }));
  $("filter-neighborhood").addEventListener("input", debounce(() => { filters.neighborhood = $("filter-neighborhood").value; onFilterChange(); }));
  $("filter-status").addEventListener("change", () => { filters.status = $("filter-status").value; onFilterChange(); });
  $("filter-score").addEventListener("change", () => { filters.score = $("filter-score").value; onFilterChange(); });
  $("filter-niche").addEventListener("change", () => { filters.niche = $("filter-niche").value; onFilterChange(); });
  $("filter-min-rating").addEventListener("change", () => { filters.minRating = Number($("filter-min-rating").value); onFilterChange(); });
  $("page-size-select").addEventListener("change", () => { pageSize = Number($("page-size-select").value); currentPage = 1; applyWalletFiltersAndRender(); });

  $("btn-config").addEventListener("click", () => { $("user-dropdown").classList.add("hidden"); openModal($("config-modal")); });
  $("btn-save-template").addEventListener("click", () => {
    addTemplate($("new-template-name").value, $("new-template-content").value);
    $("new-template-name").value = "";
    $("new-template-content").value = "";
  });

  $("btn-admin-add-self-leads").addEventListener("click", handleAdminAddSelfCredits);
  $("btn-admin-reset-self-balance").addEventListener("click", handleAdminResetSelfBalance);
  $("btn-admin-add-credits").addEventListener("click", handleAdminAddCredits);
  $("btn-promote-to-admin").addEventListener("click", handleAdminPromote);
  $("btn-admin-update-max-leads").addEventListener("click", handleAdminUpdateMaxLeads);

  $("btn-save-details").addEventListener("click", saveLeadDetails);
  $("btn-cancel-details").addEventListener("click", () => closeModal($("lead-details-modal")));
  $("btn-delete-lead").addEventListener("click", handleDeleteLeadFromModal);

  $("confirm-ok").addEventListener("click", () => { closeModal($("confirm-modal")); if (confirmResolver) confirmResolver(true); });
  $("confirm-cancel").addEventListener("click", () => { closeModal($("confirm-modal")); if (confirmResolver) confirmResolver(false); });

  bindModalDismiss($("config-modal"), [".close-modal"]);
  bindModalDismiss($("lead-details-modal"), [".close-modal-details"]);
  bindModalDismiss($("message-modal"), [".close-modal-msg"]);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal:not(.hidden)").forEach((m) => closeModal(m));
  });
}

// ============================== INICIALIZAÇÃO ==============================

$("footer-year").textContent = new Date().getFullYear();
setupEventListeners();

auth.onAuthStateChanged((user) => {
  if (user) {
    authSection.classList.add("hidden");
    appShell.classList.remove("hidden");
    startUserSession(user);
    showView("dashboard");
  } else {
    appShell.classList.add("hidden");
    authSection.classList.remove("hidden");
    toggleAuth("login");
    stopUserSession();
  }
});
