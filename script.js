/**
 * GERADOR DE LEADS PROFISSIONAL
 * Lógica da Aplicação Atualizada (Sistema de Créditos/Leads + Firebase DB + Gestão Detalhada)
 */

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAY06PHLqEUCBzg9SjnH4N6xe9ZzM8OLvo",
    authDomain: "projeto-bfed3.firebaseapp.com",
    projectId: "projeto-bfed3",
    storageBucket: "projeto-bfed3.firebasestorage.app",
    messagingSenderId: "785289237066",
    appId: "1:785289237066:web:d5871c2a002a90e2d5ccb3"
};

// --- Configurações Iniciais ---
const ADMIN_EMAIL = "jcnvap@gmail.com";
const DEFAULT_TEMPLATE_TEXT = "Olá, tudo bem? 👋\nNotei que você atua como {nicho} em {cidade} {estado} e identifiquei que o seu negócio possui um grande potencial para atrair mais clientes por meio de algumas ações estratégicas no ambiente digital.\nTrabalho ajudando profissionais do seu setor a gerar mais oportunidades e fortalecer a presença online. Posso te mostrar um exemplo simples, sem compromisso?";

const DEFAULT_TEMPLATES = [
    { id: 'default', name: 'Padrão do Sistema', content: DEFAULT_TEMPLATE_TEXT, isDefault: true }
];

// --- Estado da Aplicação ---
const state = {
    apiKey: localStorage.getItem('serper_api_key') || '',
    leadsBalance: parseInt(localStorage.getItem('leads_balance')) || 0,
    user: null, 
    leads: [],
    lastSearch: { niche: '', city: '', state: '' },
    templates: JSON.parse(localStorage.getItem('msg_templates')) || DEFAULT_TEMPLATES,
    challengeNumber: 0,
    currentLeadIndex: null // Para gerenciar edição
};

// --- Inicializa Firebase ---
let auth, db;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
} catch (e) {
    console.error("Erro ao inicializar Firebase.", e);
}

// --- Elementos do DOM ---
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const forgotBox = document.getElementById('forgot-box');

const apiStatusWarning = document.getElementById('api-status-warning');
const apiStatusSuccess = document.getElementById('api-status-success');
const apiStatusExpired = document.getElementById('api-status-expired');
const leadsBalanceDisplay = document.getElementById('leads-balance-display');

const leadsBody = document.getElementById('leads-body');
const resultsPanel = document.getElementById('results-panel');
const resultCount = document.getElementById('result-count');
const messageTemplateInput = document.getElementById('message-template-input');
const btnAdminReset = document.getElementById('btn-admin-reset');
const btnSearchLeads = document.getElementById('btn-search-leads');
const dataSourceBadge = document.getElementById('data-source-badge');

// Elements for Recharging
const btnWhatsappRequest = document.getElementById('btn-whatsapp-request');
const leadsQuantityInput = document.getElementById('leads-quantity');

// Elements for Database Modal
const databaseModal = document.getElementById('database-modal');
const dbNicheSelect = document.getElementById('db-niche-select');
const dbStatusMsg = document.getElementById('db-status-msg');

// Elements for Lead Details Modal
const leadDetailsModal = document.getElementById('lead-details-modal');
const detailName = document.getElementById('detail-name');
const detailNicheBadge = document.getElementById('detail-niche-badge');
const detailPhone = document.getElementById('detail-phone');
const detailWebsite = document.getElementById('detail-website');
const detailRating = document.getElementById('detail-rating');
const detailRatingCount = document.getElementById('detail-rating-count');
const detailActivity = document.getElementById('detail-activity');
const detailAddress = document.getElementById('detail-address');
const detailStatus = document.getElementById('detail-status');
const detailNotes = document.getElementById('detail-notes');

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                state.user = {
                    name: user.displayName || user.email,
                    email: user.email,
                    uid: user.uid
                };
                checkAuth();
            } else {
                state.user = null;
                checkAuth();
            }
        });
    }

    setupEventListeners();
    
    const savedMsg = localStorage.getItem('current_draft_message');
    if (savedMsg) {
        messageTemplateInput.value = savedMsg;
    } else {
        loadDefaultMessage();
    }

    updateApiStatusUI();
    renderTemplatesList();
    updateSearchButtonState(); 
});

// --- Autenticação ---
function checkAuth() {
    if (state.user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        document.getElementById('user-name-display').innerText = state.user.name;
        
        if (state.user.email === ADMIN_EMAIL) {
            btnAdminReset.classList.remove('hidden');
        } else {
            btnAdminReset.classList.add('hidden');
        }
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
    }
}

function login(email, password) {
    if (!auth) return alert("Firebase não configurado.");
    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            alert("Erro no login: " + error.message);
        });
}

function register(name, email, password) {
    if (!auth) return alert("Firebase não configurado.");
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            localStorage.setItem('leads_balance', 100);
            state.leadsBalance = 100;
            return userCredential.user.updateProfile({
                displayName: name
            });
        })
        .then(() => {
            alert("Conta criada com sucesso! Você ganhou 100 leads de brinde.");
            toggleAuthBox('login');
        })
        .catch((error) => {
            alert("Erro no cadastro: " + error.message);
        });
}

function logout() {
    if (auth) auth.signOut();
}

function resetPassword(email) {
    if (!auth) return;
    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert("E-mail de recuperação enviado!");
            toggleAuthBox('login');
        })
        .catch((error) => {
            alert("Erro: " + error.message);
        });
}

// --- Funções de Admin ---
function resetAccess() {
    if (confirm("ADMIN: Deseja zerar o saldo de leads?")) {
        state.leadsBalance = 0; 
        localStorage.setItem('leads_balance', 0);
        updateApiStatusUI();
        updateSearchButtonState();
        alert("Saldo zerado.");
    }
}

// --- Gerenciamento de Templates ---
function loadDefaultMessage() {
    const defaultTpl = state.templates.find(t => t.isDefault) || state.templates[0];
    if (defaultTpl) {
        messageTemplateInput.value = defaultTpl.content;
        localStorage.setItem('current_draft_message', defaultTpl.content);
    }
}

function saveNewTemplate() {
    const name = document.getElementById('new-template-name').value.trim();
    const content = document.getElementById('new-template-content').value.trim();

    if (!name || !content) {
        alert("Preencha o nome e o texto do modelo.");
        return;
    }

    const newTpl = {
        id: Date.now().toString(),
        name: name,
        content: content,
        isDefault: false
    };

    state.templates.push(newTpl);
    localStorage.setItem('msg_templates', JSON.stringify(state.templates));
    
    document.getElementById('new-template-name').value = '';
    document.getElementById('new-template-content').value = '';
    
    renderTemplatesList();
    alert("Modelo salvo com sucesso!");
}

function deleteTemplate(id) {
    if (confirm("Deseja excluir este modelo?")) {
        state.templates = state.templates.filter(t => t.id !== id);
        localStorage.setItem('msg_templates', JSON.stringify(state.templates));
        renderTemplatesList();
    }
}

function setDefaultTemplate(id) {
    state.templates.forEach(t => t.isDefault = (t.id === id));
    localStorage.setItem('msg_templates', JSON.stringify(state.templates));
    renderTemplatesList();
    loadDefaultMessage(); 
    alert("Modelo definido como padrão.");
}

function renderTemplatesList() {
    const list = document.getElementById('templates-list');
    list.innerHTML = '';

    state.templates.forEach(t => {
        const li = document.createElement('li');
        li.className = `template-item ${t.isDefault ? 'default-template' : ''}`;
        
        li.innerHTML = `
            <div>
                <strong>${t.name}</strong> ${t.isDefault ? '<small>(Padrão)</small>' : ''}
                <br><small style="color:#666">${t.content.substring(0, 50)}...</small>
            </div>
            <div class="template-actions">
                ${!t.isDefault ? `<button onclick="setDefaultTemplate('${t.id}')" class="btn-outline btn-sm">Usar Padrão</button>` : ''}
                ${t.id !== 'default' ? `<button onclick="deleteTemplate('${t.id}')" class="btn-outline btn-sm" style="color:red;border-color:red">X</button>` : ''}
            </div>
        `;
        list.appendChild(li);
    });
}

// --- Validação e Gerenciamento da API e Leads ---
function isApiActive() {
    return (state.apiKey && state.leadsBalance > 0);
}

function updateSearchButtonState() {
    btnSearchLeads.disabled = false;
    btnSearchLeads.classList.remove('btn-disabled-red');

    if (isApiActive()) {
        btnSearchLeads.innerHTML = '<i class="fas fa-search"></i> Buscar Leads';
    } else {
        btnSearchLeads.innerHTML = '<i class="fas fa-search"></i> Buscar Leads (Modo Simulação)';
    }
}

function updateApiStatusUI() {
    apiStatusWarning.classList.add('hidden');
    apiStatusSuccess.classList.add('hidden');
    apiStatusExpired.classList.add('hidden');
    
    const revalidationArea = document.getElementById('revalidation-area');
    
    if (!state.apiKey) {
        apiStatusWarning.classList.remove('hidden');
        revalidationArea.classList.add('hidden');
        updateSearchButtonState();
        return;
    }

    revalidationArea.classList.remove('hidden'); 

    if (state.leadsBalance > 0) {
        apiStatusSuccess.classList.remove('hidden');
        leadsBalanceDisplay.innerText = state.leadsBalance;
    } else {
        apiStatusExpired.classList.remove('hidden');
    }
    
    updateSearchButtonState();
}

async function validateAndSaveApiKey() {
    const keyInput = document.getElementById('api-key-input');
    const msg = document.getElementById('api-validation-msg');
    const key = keyInput.value.trim();

    if (!key) {
        alert("Insira uma chave API.");
        return;
    }

    msg.innerText = "Validando chave...";
    msg.style.color = "blue";

    const isValid = await testApiKey(key);

    if (isValid) {
        state.apiKey = key;
        localStorage.setItem('serper_api_key', key);
        
        msg.innerText = "Chave salva com sucesso! Adquira créditos abaixo para usar dados reais.";
        msg.style.color = "orange";
        
        updateApiStatusUI();
    } else {
        msg.innerText = "Chave Inválida. Verifique e tente novamente.";
        msg.style.color = "red";
        alert("A chave informada não é válida.");
    }
}

async function testApiKey(key) {
    const url = 'https://google.serper.dev/search';
    const myHeaders = new Headers();
    myHeaders.append("X-API-KEY", key);
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({ "q": "test" });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: myHeaders,
            body: raw
        });
        return response.ok; 
    } catch (error) {
        return false;
    }
}

// --- Recarga de Leads ---
function generateChallenge() {
    state.challengeNumber = Math.floor(Math.random() * 901) + 100;
    document.getElementById('challenge-number').innerText = state.challengeNumber;
    document.getElementById('challenge-response').value = '';
    updateWhatsappLink();
}

function updateWhatsappLink() {
    const qty = document.getElementById('leads-quantity').value;
    const code = state.challengeNumber;
    if (qty && code) {
        const text = `Olá, gostaria de adquirir ${qty} leads. Meu código de solicitação é: ${code}.`;
        btnWhatsappRequest.href = `https://wa.me/5534997824990?text=${encodeURIComponent(text)}`;
    }
}

function verifyChallenge() {
    const responseInput = document.getElementById('challenge-response').value.trim();
    
    if (!responseInput.includes('-')) {
        return alert("Formato inválido. Use o formato fornecido pelo suporte (Ex: 12345-500).");
    }

    const parts = responseInput.split('-');
    if (parts.length !== 2) return alert("Formato inválido.");

    const providedHash = parseInt(parts[0]);
    const leadsQty = parseInt(parts[1]);

    if (isNaN(providedHash) || isNaN(leadsQty)) return alert("Código inválido.");

    const expectedHash = (state.challengeNumber + 13) * 9 + 1954 + leadsQty;

    if (providedHash === expectedHash) {
        state.leadsBalance += leadsQty;
        localStorage.setItem('leads_balance', state.leadsBalance);
        
        alert(`Sucesso! ${leadsQty} leads adicionados ao seu saldo.`);
        
        updateApiStatusUI();
        document.getElementById('config-modal').classList.add('hidden');
        
        document.getElementById('leads-quantity').value = '';
        document.getElementById('challenge-response').value = '';
        state.challengeNumber = 0;
        document.getElementById('challenge-number').innerText = '---';
    } else {
        alert("Contra-senha incorreta.");
    }
}

// --- Lógica de Busca ---
async function searchLeads(event) {
    event.preventDefault();
    
    const niche = document.getElementById('niche').value;
    const city = document.getElementById('city').value;
    const stateInput = document.getElementById('state').value;
    const limit = parseInt(document.getElementById('limit').value);

    state.lastSearch = { niche, city, state: stateInput };

    const query = `${niche} em ${city} ${stateInput}`.trim();
    leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Buscando leads... <i class="fas fa-spinner fa-spin"></i></td></tr>';
    resultsPanel.classList.remove('hidden');

    let leads = [];

    if (state.apiKey && state.leadsBalance > 0) {
        leads = await fetchRealLeads(query, limit);
        
        if (leads.length > 0) {
            state.leadsBalance -= leads.length;
            if (state.leadsBalance < 0) state.leadsBalance = 0;
            localStorage.setItem('leads_balance', state.leadsBalance);
            
            updateApiStatusUI();
            updateResultsBadge(true);
            
            saveLeadsToFirestore(leads, niche);
        } else {
            updateResultsBadge(true); 
        }
    } else {
        leads = generateMockLeads(niche, city, stateInput, limit);
        updateResultsBadge(false);
    }

    state.leads = leads;
    renderLeads(leads);
}

// --- PERSISTÊNCIA FIREBASE ---
async function saveLeadsToFirestore(leads, niche) {
    if (!state.user || !state.user.uid) return;

    try {
        const batch = db.batch();
        leads.forEach(lead => {
            const docRef = db.collection('users').doc(state.user.uid).collection('leads').doc();
            batch.set(docRef, {
                ...lead,
                searchNiche: niche,
                leadStatus: 'Novo', // Status inicial padrão
                followUpNotes: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        console.log("Leads salvos no Firebase com sucesso.");
    } catch (error) {
        console.error("Erro ao salvar leads no Firebase:", error);
    }
}

// --- GERENCIAMENTO DE LEADS (NOVA FUNCIONALIDADE) ---
function openLeadDetails(index) {
    state.currentLeadIndex = index;
    const lead = state.leads[index];
    
    // Preencher campos
    detailName.innerText = lead.name;
    detailNicheBadge.innerText = lead.niche;
    detailPhone.innerText = lead.phone || 'Não informado';
    
    if (lead.website) {
        detailWebsite.href = lead.website;
        detailWebsite.innerText = lead.website;
    } else {
        detailWebsite.href = "#";
        detailWebsite.innerText = "Não disponível";
    }

    detailRating.innerText = lead.rating ? `${lead.rating} / 5,0` : "N/A";
    detailRatingCount.innerText = lead.ratingCount || "0";
    detailActivity.innerText = lead.niche;
    detailAddress.innerText = lead.address || "Endereço não disponível";

    // Valores padrão ou salvos (se estivéssemos recarregando do banco, mas aqui é da sessão)
    detailStatus.value = lead.leadStatus || "Novo";
    detailNotes.value = lead.followUpNotes || "";

    leadDetailsModal.classList.remove('hidden');
}

function saveLeadDetails() {
    if (state.currentLeadIndex === null) return;
    
    const lead = state.leads[state.currentLeadIndex];
    
    // Atualiza estado local
    lead.leadStatus = detailStatus.value;
    lead.followUpNotes = detailNotes.value;
    
    // Feedback visual
    alert("Alterações salvas localmente para este lead.");
    leadDetailsModal.classList.add('hidden');
    
    // Nota: Se fosse para atualizar no Firebase individualmente, precisaríamos do ID do documento.
    // Como o fluxo atual salva em lote na busca e aqui estamos editando o resultado da busca,
    // a persistência real da edição ocorreria se baixássemos o banco de leads atualizado.
}

function deleteLead(index) {
    if (confirm("Tem certeza que deseja excluir este lead da lista atual?")) {
        state.leads.splice(index, 1);
        renderLeads(state.leads);
        document.getElementById('result-count').innerText = state.leads.length;
    }
}

// --- GERENCIAMENTO DO BANCO DE LEADS (Modal) ---
async function openDatabaseModal() {
    if (!state.user) return alert("Você precisa estar logado.");
    
    databaseModal.classList.remove('hidden');
    dbStatusMsg.innerText = "Carregando nichos...";
    dbNicheSelect.innerHTML = '<option value="">Carregando...</option>';

    try {
        const snapshot = await db.collection('users').doc(state.user.uid).collection('leads').get();
        const niches = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.searchNiche) niches.add(data.searchNiche);
        });

        dbNicheSelect.innerHTML = '<option value="">Selecione um Nicho</option>';
        niches.forEach(niche => {
            const option = document.createElement('option');
            option.value = niche;
            option.innerText = niche;
            dbNicheSelect.appendChild(option);
        });
        
        dbStatusMsg.innerText = "";
    } catch (error) {
        console.error("Erro ao carregar nichos:", error);
        dbStatusMsg.innerText = "Erro ao carregar banco de dados.";
        dbStatusMsg.style.color = "red";
    }
}

async function downloadAndDelete(type) {
    const niche = dbNicheSelect.value;
    if (!niche) return alert("Selecione um nicho para baixar e limpar.");

    if (!confirm(`Tem certeza? Isso irá baixar os leads do nicho "${niche}" e apagá-los do sistema.`)) return;

    dbStatusMsg.innerText = "Processando...";
    
    try {
        const snapshot = await db.collection('users').doc(state.user.uid).collection('leads')
            .where('searchNiche', '==', niche)
            .get();

        if (snapshot.empty) {
            dbStatusMsg.innerText = "Nenhum lead encontrado para este nicho.";
            return;
        }

        const leadsData = [];
        const batch = db.batch();

        snapshot.forEach(doc => {
            leadsData.push(doc.data());
            batch.delete(doc.ref); 
        });

        if (type === 'csv') {
            exportDataToCSV(leadsData, `db_leads_${niche}.csv`);
        } else {
            exportDataToXLSX(leadsData, `db_leads_${niche}.xlsx`);
        }

        await batch.commit();
        
        dbStatusMsg.innerText = "Sucesso! Leads baixados e removidos.";
        dbStatusMsg.style.color = "green";
        
        setTimeout(openDatabaseModal, 1000);

    } catch (error) {
        console.error("Erro no processo:", error);
        dbStatusMsg.innerText = "Erro ao processar. Tente novamente.";
        dbStatusMsg.style.color = "red";
    }
}

// Funções auxiliares de exportação genérica
function exportDataToCSV(data, filename) {
    const headers = ["Nome do Negócio", "Nicho", "Endereço", "Telefone", "Site", "Rating", "Status", "Notas"];
    const rows = data.map(lead => [
        `"${lead.name}"`, `"${lead.niche}"`, `"${lead.address}"`, `"${lead.phone}"`, `"${lead.website || ''}"`, `"${lead.rating || ''}"`, `"${lead.leadStatus || ''}"`, `"${lead.followUpNotes || ''}"`
    ]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\r\n";
    rows.forEach(row => csvContent += row.join(",") + "\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportDataToXLSX(data, filename) {
    const dataForSheet = data.map(lead => ({
        "Nome do Negócio": lead.name,
        "Nicho": lead.niche,
        "Endereço": lead.address,
        "Telefone": lead.phone,
        "Site": lead.website || "",
        "Avaliação": lead.rating || "",
        "Status": lead.leadStatus || "",
        "Notas": lead.followUpNotes || ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, filename);
}

function updateResultsBadge(isReal) {
    if (isReal) {
        dataSourceBadge.innerText = "(Dados Reais)";
        dataSourceBadge.className = "badge-real";
    } else {
        dataSourceBadge.innerText = "(Dados Simulados)";
        dataSourceBadge.className = "badge-fictitious";
    }
}

// --- Integração API Serper ---
async function fetchRealLeads(query, limit) {
    const url = 'https://google.serper.dev/places';
    
    const myHeaders = new Headers();
    myHeaders.append("X-API-KEY", state.apiKey);
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "q": query,
        "gl": "br",
        "hl": "pt-br"
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: myHeaders,
            body: raw
        });
        
        if (!response.ok) throw new Error("Falha na API");

        const result = await response.json();
        
        if (result.places) {
            return result.places.slice(0, limit).map(place => ({
                name: place.title,
                niche: place.category || 'Nicho Geral',
                address: place.address,
                phone: place.phoneNumber || 'Não informado',
                website: place.website,
                rating: place.rating,
                ratingCount: place.userRatingsTotal || 0 // Adicionado conforme solicitação
            }));
        } else {
            return [];
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao conectar com a API. Verifique sua conexão.');
        return [];
    }
}

// --- Gerador de Dados Fictícios ---
function generateMockLeads(niche, city, uf, count) {
    const leads = [];
    for (let i = 0; i < count; i++) {
        const fakeName = `${niche} Exemplar ${i + 1}`;
        const fakePhone = `(34) 9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`;
        const location = city ? `${city} - ${uf}` : `Cidade Exemplo - ${uf || 'BR'}`;
        
        leads.push({
            name: fakeName,
            niche: niche,
            address: location,
            phone: fakePhone,
            website: `https://www.exemplo${i}.com.br`,
            rating: (Math.random() * 2 + 3).toFixed(1),
            ratingCount: Math.floor(Math.random() * 200) // Simulado
        });
    }
    return leads;
}

// --- Renderização ---
function renderLeads(leads) {
    leadsBody.innerHTML = '';
    resultCount.innerText = leads.length;

    if (leads.length === 0) {
        leadsBody.innerHTML = '<tr><td colspan="6">Nenhum lead encontrado.</td></tr>';
        return;
    }

    leads.forEach((lead, index) => {
        const row = document.createElement('tr');
        
        // Link Site
        const siteLink = lead.website 
            ? `<a href="${lead.website}" target="_blank"><i class="fas fa-external-link-alt"></i> Visitar</a>` 
            : '<span class="text-muted">-</span>';

        // Botão Abordar (Whats)
        const whatsappLink = lead.phone && lead.phone !== 'Não informado' 
            ? `<button class="btn-action" onclick="openMessageModal(${index})" title="Gerar Abordagem"><i class="fab fa-whatsapp"></i></button>`
            : '<button class="btn-action" disabled style="opacity:0.5"><i class="fab fa-whatsapp"></i></button>';

        // Botões de Ação Solicitados
        const actions = `
            <div class="actions-cell">
                ${whatsappLink}
                <button class="btn-manage" onclick="openLeadDetails(${index})" title="Gerenciar Lead"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteLead(${index})" title="Excluir Lead"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        row.innerHTML = `
            <td><strong>${lead.name}</strong></td>
            <td>${lead.niche}</td>
            <td>${lead.address}</td>
            <td>${lead.phone}</td>
            <td>${actions}</td>
        `;
        leadsBody.appendChild(row);
    });
}

function openMessageModal(leadIndex) {
    const lead = state.leads[leadIndex];
    const modal = document.getElementById('message-modal');
    const textArea = document.getElementById('generated-message');
    const btnWhats = document.getElementById('btn-send-whatsapp');

    const templateInput = document.getElementById('message-template-input').value;

    const nichoVal = state.lastSearch.niche || lead.niche;
    const cidadeVal = state.lastSearch.city || lead.address.split(',')[0] || "sua cidade";
    const estadoVal = state.lastSearch.state || "";

    let message = templateInput
        .replace(/{nicho}/g, nichoVal)
        .replace(/{cidade}/g, cidadeVal)
        .replace(/{estado}/g, estadoVal);

    message = message.replace(/\s+/g, ' ').trim();
    textArea.value = message;
    
    const cleanPhone = lead.phone.replace(/\D/g, '');
    if (cleanPhone) {
        const phoneParam = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
        btnWhats.href = `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`;
        btnWhats.classList.remove('hidden');
    } else {
        btnWhats.href = "#";
        btnWhats.classList.add('hidden');
    }
    modal.classList.remove('hidden');
}

// --- Funções de Exportação (Panel) ---
function exportToCSV() {
    if (state.leads.length === 0) { alert("Não há dados para exportar."); return; }
    exportDataToCSV(state.leads, `leads_${Date.now()}.csv`);
}

function exportToXLSX() {
    if (state.leads.length === 0) { alert("Não há dados para exportar."); return; }
    exportDataToXLSX(state.leads, `leads_${Date.now()}.xlsx`);
}

// --- Gerenciamento de Eventos UI ---
function setupEventListeners() {
    document.getElementById('link-register').onclick = (e) => { e.preventDefault(); toggleAuthBox('register'); };
    document.getElementById('link-login-reg').onclick = (e) => { e.preventDefault(); toggleAuthBox('login'); };
    document.getElementById('link-forgot').onclick = (e) => { e.preventDefault(); toggleAuthBox('forgot'); };
    document.getElementById('link-login-forgot').onclick = (e) => { e.preventDefault(); toggleAuthBox('login'); };

    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        login(document.getElementById('login-email').value, document.getElementById('login-password').value);
    };
    document.getElementById('register-form').onsubmit = (e) => {
        e.preventDefault();
        register(document.getElementById('reg-name').value, document.getElementById('reg-email').value, document.getElementById('reg-password').value);
    };
    document.getElementById('forgot-form').onsubmit = (e) => {
        e.preventDefault();
        resetPassword(document.getElementById('forgot-email').value);
    };
    document.getElementById('btn-logout').onclick = logout;

    document.getElementById('lead-search-form').onsubmit = searchLeads;

    messageTemplateInput.addEventListener('input', () => {
        localStorage.setItem('current_draft_message', messageTemplateInput.value);
    });

    document.getElementById('btn-config').onclick = () => {
        document.getElementById('api-key-input').value = state.apiKey;
        document.getElementById('config-modal').classList.remove('hidden');
        updateApiStatusUI();
    };
    
    // DB Modal
    document.getElementById('btn-database').onclick = openDatabaseModal;
    document.getElementById('btn-download-delete-csv').onclick = () => downloadAndDelete('csv');
    document.getElementById('btn-download-delete-xlsx').onclick = () => downloadAndDelete('xlsx');
    
    // Lead Details Modal
    document.getElementById('btn-save-details').onclick = saveLeadDetails;
    document.getElementById('btn-cancel-details').onclick = () => leadDetailsModal.classList.add('hidden');
    
    document.querySelector('.close-modal').onclick = () => document.getElementById('config-modal').classList.add('hidden');
    document.querySelector('.close-modal-db').onclick = () => document.getElementById('database-modal').classList.add('hidden');
    document.querySelector('.close-modal-details').onclick = () => document.getElementById('lead-details-modal').classList.add('hidden');
    document.querySelector('.close-modal-msg').onclick = () => document.getElementById('message-modal').classList.add('hidden');

    document.getElementById('save-api-key').onclick = validateAndSaveApiKey;
    document.getElementById('btn-admin-reset').onclick = resetAccess;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    document.getElementById('btn-revalidate-trigger').onclick = () => {
        document.getElementById('btn-config').click();
    };
    document.getElementById('btn-generate-challenge').onclick = generateChallenge;
    document.getElementById('btn-verify-challenge').onclick = verifyChallenge;
    document.getElementById('leads-quantity').addEventListener('input', updateWhatsappLink);

    document.getElementById('btn-save-template').onclick = saveNewTemplate;
    document.getElementById('btn-load-default-msg').onclick = loadDefaultMessage;

    document.getElementById('copy-message').onclick = () => {
        const text = document.getElementById('generated-message');
        text.select();
        document.execCommand('copy');
        alert('Mensagem copiada para a área de transferência!');
    };
    document.getElementById('btn-export-csv').onclick = exportToCSV;
    document.getElementById('btn-export-xlsx').onclick = exportToXLSX;
}

function toggleAuthBox(type) {
    loginBox.classList.add('hidden');
    registerBox.classList.add('hidden');
    forgotBox.classList.add('hidden');
    if (type === 'login') loginBox.classList.remove('hidden');
    if (type === 'register') registerBox.classList.remove('hidden');
    if (type === 'forgot') forgotBox.classList.remove('hidden');
}