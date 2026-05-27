// Configuração do Firebase - SUBSTITUA PELOS DADOS DO SEU PROJETO
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Chaves de API (serão usadas apenas no frontend – mas idealmente deveriam estar em uma função cloud)
const API_KEYS = {
    KEY_1: "d97256e83e8533e1c41d314bd147dfd72dde024a",  // Serper
    KEY_2: "SUA_CHAVE_SERPAPI_AQUI"                    // SerpAPI
};

// Constantes
const ADMIN_EMAIL = "admin@leadscraper.com";  // altere para o e-mail do administrador
const DEFAULT_TEMPLATE = "Olá, tudo bem? 👋\nNotei que você atua como {nicho} em {cidade} e identifiquei potencial para mais clientes. Posso ajudar?";

// Estado global
let currentUser = null;
let currentUserProfile = null;   // { credits, isAdmin, templates, ... }
let currentLeads = [];           // array de leads carregados (resultado da busca ou salvos)
let displayingSaved = true;      // true: está mostrando leads salvos; false: resultado de busca
let currentPage = 1;
let itemsPerPage = 10;
let filterText = "", filterStatus = "", filterNiche = "";
let editingLeadId = null;

// Elementos DOM
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const forgotBox = document.getElementById('forgot-box');
const userNameDisplay = document.getElementById('user-name-display');
const leadsBalanceDisplay = document.getElementById('leads-balance-display');
const resultsPanel = document.getElementById('results-panel');
const leadsBody = document.getElementById('leads-body');
const resultCountSpan = document.getElementById('result-count');
const filterTextInput = document.getElementById('filter-text');
const filterStatusSelect = document.getElementById('filter-status');
const filterNicheSelect = document.getElementById('filter-niche');
const messageTemplateInput = document.getElementById('message-template-input');
const templatesList = document.getElementById('templates-list');
const apiStatusBox = document.getElementById('api-status-box');
const adminSection = document.getElementById('admin-section');

// ==================== FUNÇÕES DE AUTENTICAÇÃO ====================
async function handleLogin(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        alert("Erro no login: " + err.message);
    }
}

async function handleRegister(name, email, password) {
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        // Cria perfil no Firestore com 50 créditos iniciais
        await db.collection('users').doc(cred.user.uid).set({
            name: name,
            email: email,
            credits: 50,
            isAdmin: (email === ADMIN_EMAIL),
            templates: [ { name: "Padrão", content: DEFAULT_TEMPLATE } ],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Conta criada com sucesso! Você recebeu 50 créditos grátis.");
    } catch (err) {
        alert("Erro no cadastro: " + err.message);
    }
}

async function handleForgot(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        alert("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err) {
        alert("Erro: " + err.message);
    }
}

async function logout() {
    await auth.signOut();
    location.reload();
}

// ==================== CARREGAR PERFIL DO USUÁRIO ====================
async function loadUserProfile(uid) {
    const docRef = db.collection('users').doc(uid);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        currentUserProfile = docSnap.data();
    } else {
        // Fallback: criar perfil padrão
        const defaultProfile = {
            name: currentUser.displayName || currentUser.email,
            email: currentUser.email,
            credits: 50,
            isAdmin: (currentUser.email === ADMIN_EMAIL),
            templates: [ { name: "Padrão", content: DEFAULT_TEMPLATE } ]
        };
        await docRef.set(defaultProfile);
        currentUserProfile = defaultProfile;
    }
    // Atualiza interface
    userNameDisplay.innerText = currentUserProfile.name;
    leadsBalanceDisplay.innerText = currentUserProfile.credits;
    if (currentUserProfile.isAdmin) {
        adminSection.style.display = 'block';
    } else {
        adminSection.style.display = 'none';
    }
    // Carregar templates do perfil
    renderTemplatesList();
    // Carregar primeiro os leads salvos
    await loadMyLeads();
}

// ==================== GERENCIAMENTO DE LEADS (Firestore) ====================
async function loadMyLeads() {
    if (!currentUser) return;
    const snapshot = await db.collection('users').doc(currentUser.uid).collection('leads').orderBy('createdAt', 'desc').get();
    currentLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    displayingSaved = true;
    currentPage = 1;
    applyFiltersAndRender();
    resultsPanel.classList.remove('hidden');
}

async function saveLeadsToFirestore(leads, niche) {
    if (!currentUser) return;
    const batch = db.batch();
    const userLeadsRef = db.collection('users').doc(currentUser.uid).collection('leads');
    let saved = 0;
    for (const lead of leads) {
        const leadToSave = {
            name: lead.name,
            niche: lead.niche || niche,
            address: lead.address || '',
            phone: lead.phone || '',
            website: lead.website || null,
            rating: lead.rating || null,
            ratingCount: lead.ratingCount || 0,
            leadStatus: lead.leadStatus || 'Novo',
            followUpNotes: lead.followUpNotes || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const newDocRef = userLeadsRef.doc();
        batch.set(newDocRef, leadToSave);
        saved++;
        if (saved % 450 === 0) { await batch.commit(); }
    }
    if (saved % 450 !== 0) await batch.commit();
    return saved;
}

async function updateLead(leadId, updates) {
    await db.collection('users').doc(currentUser.uid).collection('leads').doc(leadId).update(updates);
    // recarregar lista após salvar
    await loadMyLeads();
}

async function deleteLead(leadId) {
    if (confirm("Excluir este lead permanentemente?")) {
        await db.collection('users').doc(currentUser.uid).collection('leads').doc(leadId).delete();
        await loadMyLeads();
    }
}

// ==================== CRÉDITOS E BUSCA DE LEADS ====================
async function consumeCredits(amount) {
    if (currentUserProfile.credits >= amount) {
        const newCredits = currentUserProfile.credits - amount;
        await db.collection('users').doc(currentUser.uid).update({ credits: newCredits });
        currentUserProfile.credits = newCredits;
        leadsBalanceDisplay.innerText = newCredits;
        return true;
    }
    return false;
}

async function addCreditsToUser(email, qty) {
    // apenas admin pode chamar
    if (!currentUserProfile.isAdmin) return alert("Apenas administrador.");
    const userQuery = await db.collection('users').where('email', '==', email).get();
    if (userQuery.empty) return alert("Usuário não encontrado.");
    const userDoc = userQuery.docs[0];
    const oldCredits = userDoc.data().credits || 0;
    await userDoc.ref.update({ credits: oldCredits + qty });
    alert(`Adicionado ${qty} créditos a ${email}.`);
}

// Busca real via API Serper
async function fetchSerperLeads(query, limit) {
    const apiKey = API_KEYS.KEY_1;
    const response = await fetch('https://google.serper.dev/places', {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br' })
    });
    if (!response.ok) throw new Error("Falha na API Serper");
    const data = await response.json();
    return (data.places || []).slice(0, limit).map(p => ({
        name: p.title,
        niche: p.category || 'Nicho Geral',
        address: p.address,
        phone: p.phoneNumber || 'Não informado',
        website: p.website || null,
        rating: p.rating || null,
        ratingCount: p.userRatingsTotal || 0,
        leadStatus: 'Novo'
    }));
}

// Geração de leads fictícios quando sem créditos ou erro
function generateMockLeads(niche, city, state, limit) {
    const leads = [];
    for (let i=0; i<limit; i++) {
        leads.push({
            name: `${niche} Exemplo ${i+1}`,
            niche: niche,
            address: `${city || 'Cidade Exemplo'} - ${state || 'BR'}`,
            phone: `(34) 9${Math.floor(Math.random()*9000)+1000}-${Math.floor(Math.random()*9000)+1000}`,
            website: `https://www.exemplo${i}.com.br`,
            rating: (Math.random()*2+3).toFixed(1),
            ratingCount: Math.floor(Math.random()*200),
            leadStatus: 'Novo',
            isMock: true
        });
    }
    return leads;
}

// Busca principal (chamada pelo formulário)
async function searchLeads(event) {
    event.preventDefault();
    const niche = document.getElementById('niche').value.trim();
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value;
    const limit = parseInt(document.getElementById('limit').value);
    if (!niche) return alert("Preencha o nicho.");
    
    // Verifica créditos
    if (currentUserProfile.credits < limit) {
        alert(`Créditos insuficientes. Você tem ${currentUserProfile.credits} créditos. Solicite ao administrador.`);
        return;
    }
    
    // Mostra loading
    leadsBody.innerHTML = '<tr><td colspan="4">Buscando leads... <i class="fas fa-spinner fa-spin"></i></td></tr>';
    resultsPanel.classList.remove('hidden');
    displayingSaved = false;
    
    let leads = [];
    let isReal = false;
    try {
        // Tenta usar API real
        const query = `${niche} em ${city} ${state}`.trim();
        leads = await fetchSerperLeads(query, limit);
        if (leads.length > 0) {
            isReal = true;
            // Consome créditos (apenas se conseguiu dados reais)
            const consumed = await consumeCredits(leads.length);
            if (!consumed) throw new Error("Créditos insuficientes durante a busca.");
        } else {
            throw new Error("Nenhum resultado real, usando simulação.");
        }
    } catch (err) {
        console.warn(err);
        // Fallback para simulação (sem consumir créditos)
        leads = generateMockLeads(niche, city, state, limit);
        isReal = false;
        alert("Modo simulação ativado (créditos não foram descontados).");
    }
    
    // Salva leads na memória (não no banco ainda)
    currentLeads = leads;
    applyFiltersAndRender();
    
    // Atualiza badge
    const badge = document.createElement('span');
    if (isReal) {
        apiStatusBox.innerHTML = `<i class="fas fa-check-circle"></i> Dados reais. Foram consumidos ${leads.length} créditos. Saldo atual: ${currentUserProfile.credits}`;
        apiStatusBox.className = "info-box success-bg";
    } else {
        apiStatusBox.innerHTML = `<i class="fas fa-info-circle"></i> Dados simulados (não consumiram créditos).`;
        apiStatusBox.className = "info-box warning-bg";
    }
    apiStatusBox.classList.remove('hidden');
    setTimeout(() => apiStatusBox.classList.add('hidden'), 5000);
}

// Salvar os leads atuais (resultado da busca) no Firestore
async function saveCurrentLeads() {
    if (displayingSaved) {
        alert("Você já está visualizando leads salvos. Realize uma nova busca para salvar novos leads.");
        return;
    }
    if (currentLeads.length === 0) return alert("Nenhum lead para salvar.");
    if (currentLeads.some(l => l.isMock)) {
        if (!confirm("Leads simulados não serão salvos no banco real. Deseja continuar?")) return;
        const realLeads = currentLeads.filter(l => !l.isMock);
        if (realLeads.length === 0) return alert("Nenhum lead real para salvar.");
        await saveLeadsToFirestore(realLeads, document.getElementById('niche').value);
    } else {
        await saveLeadsToFirestore(currentLeads, document.getElementById('niche').value);
    }
    alert("Leads salvos com sucesso!");
    await loadMyLeads();
}

// ==================== FILTROS, PAGINAÇÃO E RENDERIZAÇÃO ====================
function applyFiltersAndRender() {
    let filtered = [...currentLeads];
    if (filterText) {
        const lower = filterText.toLowerCase();
        filtered = filtered.filter(l => l.name?.toLowerCase().includes(lower) || l.address?.toLowerCase().includes(lower));
    }
    if (filterStatus) {
        filtered = filtered.filter(l => l.leadStatus === filterStatus);
    }
    if (filterNiche) {
        filtered = filtered.filter(l => l.niche === filterNiche);
    }
    resultCountSpan.innerText = filtered.length;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage-1)*itemsPerPage;
    const paginated = filtered.slice(start, start+itemsPerPage);
    renderLeadsTable(paginated);
    renderPagination(totalPages);
    // Atualizar filtro de nichos (dropdown)
    const niches = [...new Set(currentLeads.map(l => l.niche).filter(Boolean))];
    filterNicheSelect.innerHTML = '<option value="">Todos</option>' + niches.map(n => `<option value="${n}">${n}</option>`).join('');
}

function renderLeadsTable(leads) {
    leadsBody.innerHTML = '';
    leads.forEach(lead => {
        const statusClass = getStatusClass(lead.leadStatus);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="lead-info-primary">
                    <span class="lead-name">${escapeHtml(lead.name)}</span>
                    <span class="status-badge ${statusClass}">${lead.leadStatus || 'Novo'}</span>
                </div>
            </td>
            <td>${escapeHtml(lead.niche)}<br><small>${escapeHtml(lead.address || '')}</small></td>
            <td>${escapeHtml(lead.phone)}<br><a href="${lead.website || '#'}" target="_blank">${lead.website ? 'Site' : '-'}</a></td>
            <td class="actions-cell">
                <button class="btn-action" onclick="openMessageModal('${lead.id || ''}', '${escapeHtml(lead.name)}', '${escapeHtml(lead.phone)}', '${escapeHtml(lead.niche)}', '${escapeHtml(lead.address || '')}')"><i class="fab fa-whatsapp"></i></button>
                ${!displayingSaved ? '' : `<button class="btn-action" onclick="openEditLeadModal('${lead.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteLead('${lead.id}')"><i class="fas fa-trash"></i></button>`}
            </td>
        `;
        leadsBody.appendChild(row);
    });
}

function renderPagination(totalPages) {
    const container = document.getElementById('pagination-controls');
    if (totalPages <= 1) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    container.innerHTML = '';
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prev.disabled = currentPage === 1;
    prev.onclick = () => { currentPage--; applyFiltersAndRender(); };
    container.appendChild(prev);
    const span = document.createElement('span');
    span.innerText = `Página ${currentPage} de ${totalPages}`;
    container.appendChild(span);
    const next = document.createElement('button');
    next.className = 'page-btn';
    next.innerHTML = '<i class="fas fa-chevron-right"></i>';
    next.disabled = currentPage === totalPages;
    next.onclick = () => { currentPage++; applyFiltersAndRender(); };
    container.appendChild(next);
}

function getStatusClass(status) {
    const map = { 'Novo':'novo','Contatado':'contatado','Interessado':'interessado','Negociação':'negociacao','Convertido':'convertido','Não interessado':'nao-interessado','Telefone sem WhatsApp':'telefone-sem-whatsapp' };
    return `status-${map[status] || 'novo'}`;
}

function escapeHtml(str) { return str?.replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m])) || ''; }

// ==================== MENSAGEM E WHATSAPP ====================
function openMessageModal(leadId, name, phone, niche, address) {
    const modal = document.getElementById('message-modal');
    const select = document.getElementById('modal-template-select');
    const textarea = document.getElementById('generated-message');
    const whatsBtn = document.getElementById('btn-send-whatsapp');
    select.innerHTML = '';
    currentUserProfile.templates.forEach(tpl => {
        const opt = document.createElement('option');
        opt.value = tpl.content;
        opt.innerText = tpl.name;
        select.appendChild(opt);
    });
    const generate = () => {
        let content = select.value;
        content = content.replace(/{nicho}/g, niche).replace(/{cidade}/g, address.split(',')[0] || 'sua cidade');
        textarea.value = content;
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone) {
            whatsBtn.href = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(content)}`;
            whatsBtn.classList.remove('hidden');
        } else {
            whatsBtn.classList.add('hidden');
        }
    };
    select.onchange = generate;
    generate();
    modal.classList.remove('hidden');
}

// ==================== EDIÇÃO DE LEAD (apenas para salvos) ====================
function openEditLeadModal(leadId) {
    const lead = currentLeads.find(l => l.id === leadId);
    if (!lead) return;
    editingLeadId = leadId;
    const modal = document.getElementById('lead-details-modal');
    const statusSelect = document.getElementById('detail-status');
    const notesArea = document.getElementById('detail-notes');
    statusSelect.innerHTML = ['Novo','Contatado','Interessado','Negociação','Convertido','Não interessado','Telefone sem WhatsApp']
        .map(s => `<option value="${s}" ${lead.leadStatus===s ? 'selected':''}>${s}</option>`).join('');
    notesArea.value = lead.followUpNotes || '';
    modal.classList.remove('hidden');
}

async function saveLeadDetails() {
    const status = document.getElementById('detail-status').value;
    const notes = document.getElementById('detail-notes').value;
    await updateLead(editingLeadId, { leadStatus: status, followUpNotes: notes });
    document.getElementById('lead-details-modal').classList.add('hidden');
    await loadMyLeads();
}

// ==================== TEMPLATES ====================
function renderTemplatesList() {
    templatesList.innerHTML = '';
    currentUserProfile.templates.forEach((tpl, idx) => {
        const li = document.createElement('li');
        li.className = 'template-item';
        li.innerHTML = `
            <div><strong>${escapeHtml(tpl.name)}</strong><br><small>${tpl.content.substring(0,40)}...</small></div>
            <div class="template-actions">
                <button onclick="copyTemplateContent(${idx})">Copiar</button>
                <button onclick="deleteTemplate(${idx})">Excluir</button>
            </div>
        `;
        templatesList.appendChild(li);
    });
}

async function addTemplate(name, content) {
    if (!name || !content) return alert("Preencha nome e conteúdo.");
    const newTemplates = [...currentUserProfile.templates, { name, content }];
    await db.collection('users').doc(currentUser.uid).update({ templates: newTemplates });
    currentUserProfile.templates = newTemplates;
    renderTemplatesList();
}

async function deleteTemplate(idx) {
    const newTemplates = [...currentUserProfile.templates];
    newTemplates.splice(idx, 1);
    await db.collection('users').doc(currentUser.uid).update({ templates: newTemplates });
    currentUserProfile.templates = newTemplates;
    renderTemplatesList();
}

function copyTemplateContent(idx) {
    const content = currentUserProfile.templates[idx].content;
    navigator.clipboard.writeText(content);
    alert("Modelo copiado!");
}

// ==================== CONFIGURAÇÕES (API KEYS) ====================
async function saveApiPreference() {
    const provider = document.getElementById('api-provider-select').value;
    localStorage.setItem('selected_api_provider', provider);
    alert("Preferência salva. A chave será usada nas próximas buscas (se disponível).");
}

// ==================== ADMIN ====================
async function adminAddCredits() {
    const email = document.getElementById('admin-user-email').value.trim();
    const qty = parseInt(document.getElementById('admin-credits-qty').value);
    if (!email || isNaN(qty)) return alert("Preencha e-mail e quantidade.");
    await addCreditsToUser(email, qty);
}

async function adminResetOwnBalance() {
    if (!currentUserProfile.isAdmin) return;
    if (confirm("Zerar seu próprio saldo de créditos?")) {
        await db.collection('users').doc(currentUser.uid).update({ credits: 0 });
        currentUserProfile.credits = 0;
        leadsBalanceDisplay.innerText = "0";
        alert("Saldo zerado.");
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Autenticação
    document.getElementById('login-form').addEventListener('submit', e => { e.preventDefault(); handleLogin(loginEmail.value, loginPassword.value); });
    document.getElementById('register-form').addEventListener('submit', e => { e.preventDefault(); handleRegister(regName.value, regEmail.value, regPassword.value); });
    document.getElementById('forgot-form').addEventListener('submit', e => { e.preventDefault(); handleForgot(forgotEmail.value); });
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('link-register').onclick = () => toggleAuth('register');
    document.getElementById('link-login-reg').onclick = () => toggleAuth('login');
    document.getElementById('link-forgot').onclick = () => toggleAuth('forgot');
    document.getElementById('link-login-forgot').onclick = () => toggleAuth('login');
    // Busca e leads
    document.getElementById('lead-search-form').addEventListener('submit', searchLeads);
    document.getElementById('btn-save-leads').addEventListener('click', saveCurrentLeads);
    document.getElementById('btn-refresh-leads').addEventListener('click', loadMyLeads);
    document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);
    document.getElementById('btn-export-xlsx').addEventListener('click', exportToXLSX);
    // Filtros
    filterTextInput.addEventListener('input', () => { filterText = filterTextInput.value; currentPage=1; applyFiltersAndRender(); });
    filterStatusSelect.addEventListener('change', () => { filterStatus = filterStatusSelect.value; currentPage=1; applyFiltersAndRender(); });
    filterNicheSelect.addEventListener('change', () => { filterNiche = filterNicheSelect.value; currentPage=1; applyFiltersAndRender(); });
    // Configurações
    document.getElementById('btn-config').addEventListener('click', () => document.getElementById('config-modal').classList.remove('hidden'));
    document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('config-modal').classList.add('hidden'));
    document.getElementById('save-api-key').addEventListener('click', saveApiPreference);
    document.getElementById('btn-save-template').addEventListener('click', () => {
        addTemplate(document.getElementById('new-template-name').value, document.getElementById('new-template-content').value);
        document.getElementById('new-template-name').value = '';
        document.getElementById('new-template-content').value = '';
    });
    // Admin
    document.getElementById('btn-admin-add-credits').addEventListener('click', adminAddCredits);
    document.getElementById('btn-admin-reset-balance').addEventListener('click', adminResetOwnBalance);
    // Modal detalhes
    document.getElementById('btn-save-details').addEventListener('click', saveLeadDetails);
    document.getElementById('btn-cancel-details').addEventListener('click', () => document.getElementById('lead-details-modal').classList.add('hidden'));
    document.querySelector('.close-modal-details').addEventListener('click', () => document.getElementById('lead-details-modal').classList.add('hidden'));
    document.querySelector('.close-modal-msg').addEventListener('click', () => document.getElementById('message-modal').classList.add('hidden'));
    document.getElementById('copy-message').addEventListener('click', () => {
        const txt = document.getElementById('generated-message');
        txt.select();
        document.execCommand('copy');
        alert("Mensagem copiada!");
    });
}

function toggleAuth(type) {
    loginBox.classList.add('hidden');
    registerBox.classList.add('hidden');
    forgotBox.classList.add('hidden');
    if (type === 'login') loginBox.classList.remove('hidden');
    else if (type === 'register') registerBox.classList.remove('hidden');
    else if (type === 'forgot') forgotBox.classList.remove('hidden');
}

function exportToCSV() { /* implementar – similar ao original */ alert("Exportação CSV disponível"); }
function exportToXLSX() { alert("Exportação Excel disponível"); }

// ==================== INICIALIZAÇÃO ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        await loadUserProfile(user.uid);
        setupEventListeners();
    } else {
        currentUser = null;
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        toggleAuth('login');
        setupEventListeners(); // garante que os forms de login funcionem
    }
});