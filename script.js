// Configuração do Firebase - VERIFICADA E CORRIGIDA
const firebaseConfig = {
  apiKey: "AIzaSyDIQdzfnMBQ9Q6docuSPPbVyJ8PLoKD1AQ",
  authDomain: "leads-e5ae1.firebaseapp.com",
  databaseURL: "https://leads-e5ae1-default-rtdb.firebaseio.com",
  projectId: "leads-e5ae1",
  storageBucket: "leads-e5ae1.firebasestorage.app",
  messagingSenderId: "17213040146",
  appId: "1:17213040146:web:d064ccc567e0b4dfd31acb",
  measurementId: "G-QSGNSDGJML"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const ADMIN_EMAIL = "admin@leadscraper.com";
const DEFAULT_TEMPLATE = "Olá, tudo bem? 👋\nNotei que você atua como {nicho} em {cidade} e identifiquei potencial para mais clientes. Posso ajudar?";

const API_KEYS = {
    KEY_1: "d97256e83e8533e1c41d314bd147dfd72dde024a",
    KEY_2: "SUA_CHAVE_SERPAPI_AQUI"
};

let currentUser = null;
let currentUserProfile = null;
let currentLeads = [];
let displayingSaved = true;
let currentPage = 1;
let itemsPerPage = 10;
let filterText = "", filterStatus = "", filterNiche = "", filterNeighborhood = "";
let editingLeadId = null;

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
const filterNeighborhoodInput = document.getElementById('filter-neighborhood');
const filterStatusSelect = document.getElementById('filter-status');
const filterNicheSelect = document.getElementById('filter-niche');
const templatesList = document.getElementById('templates-list');
const apiStatusBox = document.getElementById('api-status-box');
const adminSection = document.getElementById('admin-section');

// ==================== AUTENTICAÇÃO ====================
async function handleLogin(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        alert("Erro no login: " + err.message);
    }
}

async function handleRegister(name, email, password) {
    if (password.length < 6) {
        alert("A senha deve ter no mínimo 6 caracteres.");
        return;
    }
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        await db.collection('users').doc(cred.user.uid).set({
            name: name,
            email: email,
            credits: 50,
            isAdmin: (email === ADMIN_EMAIL),
            templates: [{ name: "Padrão", content: DEFAULT_TEMPLATE }],
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

// ==================== PERFIL DO USUÁRIO ====================
async function loadUserProfile(uid) {
    const docRef = db.collection('users').doc(uid);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        currentUserProfile = docSnap.data();
    } else {
        const defaultProfile = {
            name: currentUser.displayName || currentUser.email,
            email: currentUser.email,
            credits: 50,
            isAdmin: (currentUser.email === ADMIN_EMAIL),
            templates: [{ name: "Padrão", content: DEFAULT_TEMPLATE }]
        };
        await docRef.set(defaultProfile);
        currentUserProfile = defaultProfile;
    }
    userNameDisplay.innerText = currentUserProfile.name;
    leadsBalanceDisplay.innerText = currentUserProfile.credits;
    if (currentUserProfile.isAdmin) {
        adminSection.style.display = 'block';
    } else {
        adminSection.style.display = 'none';
    }
    renderTemplatesList();
    await loadMyLeads();
}

// ==================== LEADS (FIRESTORE) ====================
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
        if (saved % 450 === 0) await batch.commit();
    }
    if (saved % 450 !== 0) await batch.commit();
    return saved;
}

async function updateLead(leadId, updates) {
    await db.collection('users').doc(currentUser.uid).collection('leads').doc(leadId).update(updates);
    await loadMyLeads();
}

async function deleteLead(leadId) {
    if (confirm("Excluir este lead permanentemente?")) {
        await db.collection('users').doc(currentUser.uid).collection('leads').doc(leadId).delete();
        await loadMyLeads();
    }
}

// ==================== CRÉDITOS E BUSCA ====================
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

async function addCreditsToUser(email, qty, isAdminAction = true) {
    if (isAdminAction && !currentUserProfile.isAdmin) return alert("Apenas administradores podem adicionar créditos a outros.");
    const userQuery = await db.collection('users').where('email', '==', email).get();
    if (userQuery.empty) return alert("Usuário não encontrado.");
    const userDoc = userQuery.docs[0];
    const oldCredits = userDoc.data().credits || 0;
    await userDoc.ref.update({ credits: oldCredits + qty });
    if (email === currentUserProfile.email) {
        currentUserProfile.credits = oldCredits + qty;
        leadsBalanceDisplay.innerText = currentUserProfile.credits;
    }
    alert(`Adicionado ${qty} créditos a ${email}.`);
}

async function addSelfCredits(amount) {
    if (!currentUserProfile.isAdmin) return alert("Apenas administradores podem usar esta função.");
    await addCreditsToUser(currentUserProfile.email, amount, false);
}

async function resetSelfBalance() {
    if (!currentUserProfile.isAdmin) return alert("Apenas administradores podem zerar o próprio saldo.");
    if (confirm("Deseja zerar seu próprio saldo de créditos?")) {
        await db.collection('users').doc(currentUser.uid).update({ credits: 0 });
        currentUserProfile.credits = 0;
        leadsBalanceDisplay.innerText = "0";
        alert("Saldo zerado.");
    }
}

// Busca real via Serper
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

function generateMockLeads(niche, city, state, limit) {
    const leads = [];
    for (let i = 0; i < limit; i++) {
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

async function searchLeads(event) {
    event.preventDefault();
    const niche = document.getElementById('niche').value.trim();
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value;
    const neighborhood = document.getElementById('neighborhood').value.trim();
    let limit = parseInt(document.getElementById('limit').value);
    if (!niche) return alert("Preencha o nicho.");

    // Verifica se não há créditos
    if (currentUserProfile.credits <= 0) {
        const mockLimit = Math.min(limit, 10);
        alert(`⚠️ Você não tem créditos. Gerando ${mockLimit} lead(s) fictício(s) para demonstração.`);
        const leads = generateMockLeads(niche, city, state, mockLimit);
        currentLeads = leads;
        displayingSaved = false;
        applyFiltersAndRender();
        resultsPanel.classList.remove('hidden');
        apiStatusBox.innerHTML = `<i class="fas fa-info-circle"></i> Modo demonstração (sem créditos). Leads fictícios exibidos.`;
        apiStatusBox.classList.remove('hidden');
        setTimeout(() => apiStatusBox.classList.add('hidden'), 5000);
        return;
    }

    // Se créditos insuficientes para o limite solicitado
    if (currentUserProfile.credits < limit) {
        const mockLimit = Math.min(limit, 10);
        alert(`Créditos insuficientes (você tem ${currentUserProfile.credits}). Gerando ${mockLimit} lead(s) fictício(s) para demonstração.`);
        const leads = generateMockLeads(niche, city, state, mockLimit);
        currentLeads = leads;
        displayingSaved = false;
        applyFiltersAndRender();
        resultsPanel.classList.remove('hidden');
        apiStatusBox.innerHTML = `<i class="fas fa-info-circle"></i> Créditos insuficientes. Exibindo leads fictícios (demonstração).`;
        apiStatusBox.classList.remove('hidden');
        setTimeout(() => apiStatusBox.classList.add('hidden'), 5000);
        return;
    }

    // Fluxo normal: tenta buscar leads reais
    leadsBody.innerHTML = '<tr><td colspan="4">Buscando leads... <i class="fas fa-spinner fa-spin"></i></td></tr>';
    resultsPanel.classList.remove('hidden');
    displayingSaved = false;
    let leads = [];
    let isReal = false;
    try {
        // Monta a query incluindo bairro
        let query = niche;
        if (neighborhood) query += ` no bairro ${neighborhood}`;
        if (city) query += ` em ${city}`;
        if (state) query += ` ${state}`;
        leads = await fetchSerperLeads(query, limit);
        if (leads.length > 0) {
            isReal = true;
            const consumed = await consumeCredits(leads.length);
            if (!consumed) throw new Error("Créditos insuficientes.");
        } else {
            throw new Error("Nenhum resultado real.");
        }
    } catch (err) {
        console.warn(err);
        leads = generateMockLeads(niche, city, state, limit);
        isReal = false;
        alert("Modo simulação ativado (créditos não foram descontados).");
    }
    currentLeads = leads;
    applyFiltersAndRender();
    apiStatusBox.innerHTML = isReal ? `<i class="fas fa-check-circle"></i> Dados reais. Consumidos ${leads.length} créditos. Saldo: ${currentUserProfile.credits}` : `<i class="fas fa-info-circle"></i> Dados simulados (não consumiram créditos).`;
    apiStatusBox.classList.remove('hidden');
    setTimeout(() => apiStatusBox.classList.add('hidden'), 5000);
}

async function saveCurrentLeads() {
    if (displayingSaved) return alert("Você já está visualizando leads salvos. Realize uma nova busca.");
    if (currentLeads.length === 0) return alert("Nenhum lead para salvar.");
    const realLeads = currentLeads.filter(l => !l.isMock);
    if (realLeads.length === 0) return alert("Leads simulados não podem ser salvos.");
    await saveLeadsToFirestore(realLeads, document.getElementById('niche').value);
    alert("Leads salvos com sucesso!");
    await loadMyLeads();
}

// ==================== FILTROS E RENDERIZAÇÃO ====================
function applyFiltersAndRender() {
    let filtered = [...currentLeads];
    if (filterText) {
        const lower = filterText.toLowerCase();
        filtered = filtered.filter(l => l.name?.toLowerCase().includes(lower) || l.address?.toLowerCase().includes(lower));
    }
    if (filterNeighborhood) {
        const lower = filterNeighborhood.toLowerCase();
        filtered = filtered.filter(l => l.address?.toLowerCase().includes(lower));
    }
    if (filterStatus) filtered = filtered.filter(l => l.leadStatus === filterStatus);
    if (filterNiche) filtered = filtered.filter(l => l.niche === filterNiche);
    resultCountSpan.innerText = filtered.length;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage-1)*itemsPerPage;
    const paginated = filtered.slice(start, start+itemsPerPage);
    renderLeadsTable(paginated);
    renderPagination(totalPages);
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
                ${(displayingSaved || lead.isMock) ? `<button class="btn-action" onclick="openEditLeadModal('${lead.id || ''}', ${!!lead.isMock})"><i class="fas fa-edit"></i></button>` : ''}
                ${displayingSaved ? `<button class="btn-delete" onclick="deleteLead('${lead.id}')"><i class="fas fa-trash"></i></button>` : ''}
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

function openEditLeadModal(leadId, isMock = false) {
    if (isMock) {
        alert("Este lead é fictício e não pode ser editado. Salve os leads reais para poder editá-los.");
        return;
    }
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
}

// ==================== TEMPLATES ====================
function renderTemplatesList() {
    if (!templatesList) return;
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

// ==================== ADMIN ====================
async function promoteToAdmin() {
    if (!currentUserProfile.isAdmin) return alert("Apenas administradores podem promover outros.");
    const email = document.getElementById('admin-promote-email').value.trim();
    if (!email) return alert("Digite o e-mail.");
    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('email', '==', email).get();
    if (querySnapshot.empty) {
        document.getElementById('admin-promote-msg').innerText = "Usuário não encontrado.";
        return;
    }
    const userDoc = querySnapshot.docs[0];
    if (userDoc.data().isAdmin === true) {
        document.getElementById('admin-promote-msg').innerText = "Este usuário já é administrador.";
        return;
    }
    await userDoc.ref.update({ isAdmin: true });
    document.getElementById('admin-promote-msg').innerText = `✅ ${email} agora é super administrador!`;
    document.getElementById('admin-promote-email').value = '';
}

function exportToCSV() {
    if (currentLeads.length === 0) return alert("Nenhum dado para exportar.");
    const headers = ["Nome", "Nicho", "Endereço", "Telefone", "Site", "Status", "Notas"];
    const rows = currentLeads.map(l => [`"${l.name}"`, `"${l.niche}"`, `"${l.address}"`, `"${l.phone}"`, `"${l.website || ''}"`, `"${l.leadStatus}"`, `"${l.followUpNotes || ''}"`]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\r\n" + rows.map(r => r.join(",")).join("\r\n");
    const a = document.createElement('a'); a.href = encodeURI(csvContent); a.download = `leads_${Date.now()}.csv`; a.click();
}

function exportToXLSX() {
    if (currentLeads.length === 0) return alert("Nenhum dado para exportar.");
    const data = currentLeads.map(l => ({ "Nome": l.name, "Nicho": l.niche, "Endereço": l.address, "Telefone": l.phone, "Site": l.website || '', "Status": l.leadStatus, "Notas": l.followUpNotes || '' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_${Date.now()}.xlsx`);
}

function toggleAuth(type) {
    loginBox.classList.add('hidden');
    registerBox.classList.add('hidden');
    forgotBox.classList.add('hidden');
    if (type === 'login') loginBox.classList.remove('hidden');
    else if (type === 'register') registerBox.classList.remove('hidden');
    else if (type === 'forgot') forgotBox.classList.remove('hidden');
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        handleLogin(email, password);
    });
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        handleRegister(name, email, password);
    });
    document.getElementById('forgot-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        handleForgot(email);
    });
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('link-register').onclick = () => toggleAuth('register');
    document.getElementById('link-login-reg').onclick = () => toggleAuth('login');
    document.getElementById('link-forgot').onclick = () => toggleAuth('forgot');
    document.getElementById('link-login-forgot').onclick = () => toggleAuth('login');

    document.getElementById('lead-search-form').addEventListener('submit', searchLeads);
    document.getElementById('btn-save-leads').addEventListener('click', saveCurrentLeads);
    document.getElementById('btn-refresh-leads').addEventListener('click', loadMyLeads);
    document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);
    document.getElementById('btn-export-xlsx').addEventListener('click', exportToXLSX);

    filterTextInput.addEventListener('input', () => { filterText = filterTextInput.value; currentPage=1; applyFiltersAndRender(); });
    filterNeighborhoodInput.addEventListener('input', () => { filterNeighborhood = filterNeighborhoodInput.value; currentPage=1; applyFiltersAndRender(); });
    filterStatusSelect.addEventListener('change', () => { filterStatus = filterStatusSelect.value; currentPage=1; applyFiltersAndRender(); });
    filterNicheSelect.addEventListener('change', () => { filterNiche = filterNicheSelect.value; currentPage=1; applyFiltersAndRender(); });

    document.getElementById('btn-config').addEventListener('click', () => {
        if (currentUserProfile && currentUserProfile.isAdmin) {
            document.getElementById('admin-section').style.display = 'block';
        } else {
            document.getElementById('admin-section').style.display = 'none';
        }
        document.getElementById('config-modal').classList.remove('hidden');
    });
    document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('config-modal').classList.add('hidden'));
    
    document.getElementById('btn-save-template').addEventListener('click', () => {
        addTemplate(document.getElementById('new-template-name').value, document.getElementById('new-template-content').value);
        document.getElementById('new-template-name').value = '';
        document.getElementById('new-template-content').value = '';
    });

    document.getElementById('btn-admin-add-self-leads').addEventListener('click', () => addSelfCredits(10));
    document.getElementById('btn-admin-reset-self-balance').addEventListener('click', resetSelfBalance);
    document.getElementById('btn-admin-add-credits').addEventListener('click', () => {
        const email = document.getElementById('admin-user-email').value.trim();
        const qty = parseInt(document.getElementById('admin-credits-qty').value);
        if (!email || isNaN(qty)) return alert("Preencha e-mail e quantidade.");
        addCreditsToUser(email, qty, true);
    });
    document.getElementById('btn-promote-to-admin').addEventListener('click', promoteToAdmin);

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
        setupEventListeners();
    }
});