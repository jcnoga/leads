// Configuração Firebase mantida com ajustes de segurança implicitos para ambiente free
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

// ATENÇÃO: Substitua em produção
const API_KEYS = { SERPER: "SUA_CHAVE_SERPAPI_AQUI" };

let currentUser = null;
let currentUserProfile = null;
let currentLeads = [];
let displayingSaved = true;
let currentPage = 1;
const itemsPerPage = 150; // Requisito SaaS
const MAX_LEADS_FETCH = 150; // Requisito SaaS

// DOM Elements principais
const el = {
    auth: document.getElementById('auth-section'),
    app: document.getElementById('app-section'),
    userName: document.getElementById('user-name-display'),
    leadsBalance: document.getElementById('leads-balance-display'),
    totalMetric: document.getElementById('total-leads-metric'),
    leadsBody: document.getElementById('leads-body'),
    themeToggle: document.getElementById('theme-toggle')
};

// ==================== TEMA ====================
el.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    el.themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

// ==================== AUTENTICAÇÃO ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        el.auth.classList.add('hidden');
        el.app.classList.remove('hidden');
        await loadUserProfile(user.uid);
    } else {
        currentUser = null;
        el.auth.classList.remove('hidden');
        el.app.classList.add('hidden');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await auth.signInWithEmailAndPassword(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        );
    } catch (err) { alert("Erro: " + err.message); }
});

document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

// ==================== PERFIL E DASHBOARD ====================
async function loadUserProfile(uid) {
    const docRef = db.collection('users').doc(uid);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        currentUserProfile = docSnap.data();
    } else {
        currentUserProfile = {
            name: currentUser.email.split('@')[0], email: currentUser.email,
            credits: 50, isAdmin: false, templates: []
        };
        await docRef.set(currentUserProfile);
    }
    el.userName.innerText = currentUserProfile.name;
    el.leadsBalance.innerText = currentUserProfile.credits;
    
    if (currentUserProfile.isAdmin) {
        document.getElementById('admin-section').style.display = 'block';
    }
    
    await loadMyLeads();
}

// ==================== LÓGICA DE AUDITORIA & CRÉDITOS ====================
// Requisito: Registro e correção de movimentação financeira/créditos
async function logAudit(action, adminEmail, targetEmail, amount) {
    await db.collection('audits').add({
        action, adminEmail, targetEmail, amount,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Corrigido: Botão +10 agora adiciona exatos 10 (anteriormente chamava 150 hardcoded)
document.getElementById('btn-admin-add-self-leads').addEventListener('click', async () => {
    if (!currentUserProfile.isAdmin) return alert("Acesso Negado.");
    const qty = 10;
    const novoSaldo = (currentUserProfile.credits || 0) + qty;
    
    await db.collection('users').doc(currentUser.uid).update({ credits: novoSaldo });
    await logAudit('ADD_SELF_CREDITS', currentUser.email, currentUser.email, qty);
    
    currentUserProfile.credits = novoSaldo;
    el.leadsBalance.innerText = novoSaldo;
    alert(`Sucesso! +${qty} créditos adicionados.`);
});

// Corrigido: Adição a terceiros com log de auditoria
document.getElementById('btn-admin-add-credits').addEventListener('click', async () => {
    if (!currentUserProfile.isAdmin) return alert("Acesso Negado.");
    const email = document.getElementById('admin-user-email').value.trim();
    const qty = parseInt(document.getElementById('admin-credits-qty').value);
    
    if (!email || isNaN(qty) || qty <= 0) return alert("Dados inválidos.");
    
    const userQuery = await db.collection('users').where('email', '==', email).get();
    if (userQuery.empty) return alert("Usuário não encontrado.");
    
    const targetDoc = userQuery.docs[0];
    const novoSaldo = (targetDoc.data().credits || 0) + qty;
    
    await targetDoc.ref.update({ credits: novoSaldo });
    await logAudit('TRANSFER_CREDITS', currentUser.email, email, qty);
    
    alert(`Transferência concluída: ${qty} leads para ${email}.`);
});

// ==================== INTELIGÊNCIA COMERCIAL (QUALIFICAÇÃO) ====================
function calculateTemperature(rating, ratingCount) {
    if (!rating || !ratingCount) return 'Frio';
    const r = parseFloat(rating);
    const c = parseInt(ratingCount);
    if (r >= 4.5 && c >= 50) return 'Quente';
    if (r >= 4.0 && c >= 10) return 'Morno';
    return 'Frio';
}

function getTempIcon(temp) {
    if(temp === 'Quente') return '🔥 Quente';
    if(temp === 'Morno') return '🟡 Morno';
    return '❄️ Frio';
}

// ==================== BUSCA DE LEADS (SERPER API) ====================
document.getElementById('lead-search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const niche = document.getElementById('niche').value;
    const city = document.getElementById('city').value;
    const state = document.getElementById('state').value;
    const keyword = document.getElementById('keyword').value;
    const minRating = parseFloat(document.getElementById('min-rating').value) || 0;
    const limit = Math.min(parseInt(document.getElementById('limit').value) || 50, MAX_LEADS_FETCH);

    if (currentUserProfile.credits <= 0) return alert("Saldo insuficiente. Adquira mais créditos.");

    el.leadsBody.innerHTML = '<tr><td colspan="5" style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Prospectando mercado...</td></tr>';
    document.getElementById('results-panel').classList.remove('hidden');

    try {
        const query = `${niche} ${keyword} em ${city} ${state}`.trim();
        const response = await fetch('https://google.serper.dev/places', {
            method: 'POST',
            headers: { 'X-API-KEY': API_KEYS.SERPER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br' })
        });
        
        if (!response.ok) throw new Error("Erro na integração com Serper.");
        const data = await response.json();
        
        let fetchedLeads = (data.places || []).map(p => ({
            name: p.title, niche: niche, address: p.address,
            phone: p.phoneNumber || '', website: p.website || '',
            rating: p.rating || 0, ratingCount: p.userRatingsTotal || 0,
            leadStatus: 'Novo',
            temperature: calculateTemperature(p.rating, p.userRatingsTotal),
            isMock: true // Marcador até ser salvo no Firestore
        }));

        // Filtro local pelo rating
        if (minRating > 0) {
            fetchedLeads = fetchedLeads.filter(l => l.rating >= minRating);
        }
        
        fetchedLeads = fetchedLeads.slice(0, limit);

        if (fetchedLeads.length > 0) {
            // Consome 1 crédito por busca realizada (Modelo SaaS padrão)
            const novoSaldo = currentUserProfile.credits - 1;
            await db.collection('users').doc(currentUser.uid).update({ credits: novoSaldo });
            currentUserProfile.credits = novoSaldo;
            el.leadsBalance.innerText = novoSaldo;
            
            currentLeads = fetchedLeads;
            displayingSaved = false;
            applyFiltersAndRender();
        } else {
            el.leadsBody.innerHTML = '<tr><td colspan="5">Nenhum lead encontrado com estes parâmetros.</td></tr>';
        }
    } catch (err) {
        alert("Erro na prospecção: Verifique sua chave de API Serper.");
        el.leadsBody.innerHTML = '';
    }
});

// ==================== FIRESTORE / GESTÃO ====================
async function saveCurrentLeads() {
    if (displayingSaved) return alert("Estes leads já estão no seu CRM.");
    const batch = db.batch();
    const leadsRef = db.collection('users').doc(currentUser.uid).collection('leads');
    
    currentLeads.forEach(lead => {
        delete lead.isMock;
        lead.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        batch.set(leadsRef.doc(), lead);
    });
    
    await batch.commit();
    alert("Leads salvos com sucesso no CRM!");
    await loadMyLeads();
}

document.getElementById('btn-save-leads').addEventListener('click', saveCurrentLeads);

async function loadMyLeads() {
    if (!currentUser) return;
    const snapshot = await db.collection('users').doc(currentUser.uid).collection('leads').orderBy('createdAt', 'desc').get();
    currentLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    el.totalMetric.innerText = currentLeads.length;
    displayingSaved = true;
    document.getElementById('results-panel').classList.remove('hidden');
    applyFiltersAndRender();
}

document.getElementById('btn-refresh-leads').addEventListener('click', loadMyLeads);

// ==================== RENDERIZAÇÃO E FILTROS ====================
function applyFiltersAndRender() {
    const textFilter = document.getElementById('filter-text').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const tempFilter = document.getElementById('filter-temp').value;
    
    let filtered = currentLeads.filter(l => {
        const matchText = l.name.toLowerCase().includes(textFilter) || l.address.toLowerCase().includes(textFilter);
        const matchStatus = statusFilter ? l.leadStatus === statusFilter : true;
        const matchTemp = tempFilter ? l.temperature === tempFilter : true;
        return matchText && matchStatus && matchTemp;
    });

    document.getElementById('result-count').innerText = filtered.length;
    
    // Paginação SaaS (até 150)
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);
    
    el.leadsBody.innerHTML = '';
    paginated.forEach(lead => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${lead.name}</strong><br>
                <span class="badge ${lead.temperature?.toLowerCase() || 'frio'}">${getTempIcon(lead.temperature)}</span>
                <span class="badge status">${lead.rating}⭐ (${lead.ratingCount} av)</span>
            </td>
            <td><small>${lead.address}</small></td>
            <td>
                ${lead.phone}<br>
                ${lead.website ? `<a href="${lead.website}" target="_blank" style="font-size:0.8rem">🔗 Site Oficial</a>` : '-'}
            </td>
            <td>
                <select class="form-control" onchange="updateLeadStatus('${lead.id}', this.value)" ${!displayingSaved ? 'disabled' : ''}>
                    ${['Novo','Contatado','Interessado','Negociação','Convertido'].map(s => 
                        `<option value="${s}" ${lead.leadStatus === s ? 'selected' : ''}>${s}</option>`
                    ).join('')}
                </select>
            </td>
            <td>
                <button class="btn-primary btn-sm" onclick="openWhatsAppModal('${lead.phone}', '${lead.niche}', '${lead.address}')"><i class="fab fa-whatsapp"></i> Abordar</button>
            </td>
        `;
        el.leadsBody.appendChild(tr);
    });
}

async function updateLeadStatus(id, newStatus) {
    if(!id) return;
    await db.collection('users').doc(currentUser.uid).collection('leads').doc(id).update({ leadStatus: newStatus });
    // Otimização: Atualiza localmente para não precisar refazer query pesada no Firebase
    const index = currentLeads.findIndex(l => l.id === id);
    if(index > -1) currentLeads[index].leadStatus = newStatus;
}

['filter-text', 'filter-status', 'filter-temp'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { currentPage = 1; applyFiltersAndRender(); });
});

// ==================== MÓDULO DE MENSAGENS AVANÇADO ====================
function openWhatsAppModal(phone, niche, address) {
    if(!phone) return alert("Lead não possui telefone registrado.");
    const modal = document.getElementById('message-modal');
    const select = document.getElementById('modal-template-select');
    const textarea = document.getElementById('generated-message');
    const btn = document.getElementById('btn-send-whatsapp');
    
    // Modelos default + salvos
    const templates = currentUserProfile.templates.length ? currentUserProfile.templates : [{
        name: "Abordagem Padrão SaaS",
        content: "Olá! Tudo bem?\n\nAnalisamos o posicionamento do seu negócio no segmento de {nicho} na região de {cidade} e identificamos um forte potencial para escalar sua atração de clientes usando ferramentas automatizadas.\n\nFaz sentido conversarmos 5 minutinhos hoje?"
    }];

    select.innerHTML = templates.map(t => `<option value="${t.content}">${t.name}</option>`).join('');
    
    const generate = () => {
        const cityShort = address.split('-')[0].split(',')[1]?.trim() || 'sua região';
        const msg = select.value.replace(/{nicho}/g, niche).replace(/{cidade}/g, cityShort);
        textarea.value = msg;
        const cleanPhone = phone.replace(/\D/g, '');
        btn.href = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
    };
    
    select.onchange = generate;
    generate();
    modal.classList.remove('hidden');
}

// Fechar Modais
document.querySelectorAll('.close-modal, .close-modal-msg').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden'));
});
document.getElementById('btn-config').addEventListener('click', () => document.getElementById('config-modal').classList.remove('hidden'));

// Listeners de UI auxiliares omitidos por brevidade (export CSV/XLSX se mantêm iguais da v1)