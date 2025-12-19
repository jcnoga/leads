/**
 * GERADOR DE LEADS PROFISSIONAL
 * Lógica da Aplicação Atualizada (Sistema de Créditos/Leads + Firebase DB + Gestão Detalhada)
 */

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDIQdzfnMBQ9Q6docuSPPbVyJ8PLoKD1AQ",
  authDomain: "leads-e5ae1.firebaseapp.com",
  projectId: "leads-e5ae1",
  storageBucket: "leads-e5ae1.firebasestorage.app",
  messagingSenderId: "17213040146",
  appId: "1:17213040146:web:d064ccc567e0b4dfd31acb",
  measurementId: "G-QSGNSDGJML"
};

// --- CHAVES DE API (DEFINIDAS NO CÓDIGO) ---
// Preencha as chaves abaixo conforme a documentação
const API_KEYS_CONFIG = {
    KEY_1: "d97256e83e8533e1c41d314bd147dfd72dde024a", // Insira sua chave Serper
    KEY_2: "SUA_CHAVE_SERPAPI_AQUI" // Insira sua chave SerpAPI
};

// --- Configurações Iniciais ---
const ADMIN_EMAIL = "jcnvap@gmail.com";
const DEFAULT_TEMPLATE_TEXT = "Olá, tudo bem? 👋\nNotei que você atua como {nicho} em {cidade} {estado} e identifiquei que o seu negócio possui um grande potencial para atrair mais clientes por meio de algumas ações estratégicas no ambiente digital.\nTrabalho ajudando profissionais do seu setor a gerar mais oportunidades e fortalecer a presença online. Posso te mostrar um exemplo simples, sem compromisso?";

const DEFAULT_TEMPLATES = [
    { id: 'default', name: 'Padrão do Sistema', content: DEFAULT_TEMPLATE_TEXT, isDefault: true }
];

// --- Estado da Aplicação ---
const state = {
    // Carrega a preferência de provedor, mas usa as chaves do código
    providerId: localStorage.getItem('selected_provider_id') || '', 
    apiKey: '', // Será preenchido dinamicamente baseado no providerId
    leadsBalance: parseInt(localStorage.getItem('leads_balance')) || 0,
    user: null, 
    leads: [],
    lastSearch: { niche: '', city: '', state: '' },
    templates: JSON.parse(localStorage.getItem('msg_templates')) || DEFAULT_TEMPLATES,
    challengeNumber: 0,
    currentLeadIndex: null 
};

// Inicializa a apiKey correta se houver provider salvo
if (state.providerId && API_KEYS_CONFIG[state.providerId]) {
    state.apiKey = API_KEYS_CONFIG[state.providerId];
}

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
const apiProviderBadge = document.getElementById('api-provider-badge'); // Novo badge

const leadsBody = document.getElementById('leads-body');
const resultsPanel = document.getElementById('results-panel');
const resultCount = document.getElementById('result-count');
const messageTemplateInput = document.getElementById('message-template-input');

// Admin Buttons
const btnAdminReset = document.getElementById('btn-admin-reset');
const btnAdminAdd = document.getElementById('btn-admin-add');

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

// Elements for Filters
const filterText = document.getElementById('filter-text');
const filterStatus = document.getElementById('filter-status');
const filterNiche = document.getElementById('filter-niche');

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
    setupFilterListeners();
    
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
            btnAdminAdd.classList.remove('hidden');
        } else {
            btnAdminReset.classList.add('hidden');
            btnAdminAdd.classList.add('hidden');
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

function addAdminLeads() {
    if (confirm("ADMIN: Adicionar 10 leads ao saldo?")) {
        state.leadsBalance += 10;
        localStorage.setItem('leads_balance', state.leadsBalance);
        updateApiStatusUI();
        updateSearchButtonState();
        alert("10 leads adicionados.");
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
        
        // Atualiza badge do provedor
        if (apiProviderBadge) {
            apiProviderBadge.innerText = state.providerId === 'KEY_2' ? 'SerpAPI' : 'Serper';
        }
    } else {
        apiStatusExpired.classList.remove('hidden');
    }
    
    updateSearchButtonState();
}

async function validateAndSaveApiKey() {
    const providerSelect = document.getElementById('api-provider-select');
    const msg = document.getElementById('api-validation-msg');
    
    const selectedProvider = providerSelect.value;

    if (!selectedProvider) {
        alert("Selecione uma chave de API.");
        return;
    }

    const key = API_KEYS_CONFIG[selectedProvider];
    
    if (!key || key.includes("SUA_CHAVE")) {
        msg.innerText = "Chave não configurada no código-fonte. Contate o administrador.";
        msg.style.color = "red";
        return;
    }

    msg.innerText = "Validando chave...";
    msg.style.color = "blue";

    // Simulação de validação da chave (ou teste real se possível)
    state.providerId = selectedProvider;
    state.apiKey = key;
    localStorage.setItem('selected_provider_id', selectedProvider);
    
    msg.innerText = "Preferência salva com sucesso! Adquira créditos abaixo para usar dados reais.";
    msg.style.color = "orange";
    
    updateApiStatusUI();
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
    
    filterText.value = "";
    filterStatus.value = "";
    
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
        
        // Decide qual função chamar baseado na chave selecionada
        if (state.providerId === 'KEY_2') {
            leads = await fetchSerpAPILeads(query, limit); // Nova função
        } else {
            leads = await fetchSerperLeads(query, limit); // Função existente (renomeada/mantida)
        }
        
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
    
    populateNicheFilter(leads);
    applyFilters(); 
}

// --- LOGICA DE FILTRO ---
function setupFilterListeners() {
    filterText.addEventListener('input', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
    filterNiche.addEventListener('change', applyFilters);
}

function populateNicheFilter(leads) {
    const niches = new Set(leads.map(l => l.niche));
    filterNiche.innerHTML = '<option value="">Todos</option>';
    niches.forEach(n => {
        const option = document.createElement('option');
        option.value = n;
        option.innerText = n;
        filterNiche.appendChild(option);
    });
}

function applyFilters() {
    const txt = filterText.value.toLowerCase();
    const st = filterStatus.value;
    const ni = filterNiche.value;

    const indexedLeads = state.leads.map((lead, index) => ({...lead, _originalIndex: index}));

    const filtered = indexedLeads.filter(lead => {
        const matchesText = (
            lead.name.toLowerCase().includes(txt) || 
            lead.niche.toLowerCase().includes(txt) ||
            lead.address.toLowerCase().includes(txt)
        );
        const matchesStatus = st ? lead.leadStatus === st : true;
        const matchesNiche = ni ? lead.niche === ni : true;

        return matchesText && matchesStatus && matchesNiche;
    });

    renderLeads(filtered);
}

// --- PERSISTÊNCIA FIREBASE ---
async function saveLeadsToFirestore(leads, niche = 'Manual') {
    if (!state.user || !state.user.uid) return;

    try {
        const batch = db.batch();
        leads.forEach(lead => {
            const leadToSave = { ...lead };
            delete leadToSave._originalIndex;

            const docRef = db.collection('users').doc(state.user.uid).collection('leads').doc();
            batch.set(docRef, {
                ...leadToSave,
                searchNiche: niche,
                leadStatus: lead.leadStatus || 'Novo',
                followUpNotes: lead.followUpNotes || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        console.log("Leads salvos no Firebase com sucesso.");
    } catch (error) {
        console.error("Erro ao salvar leads no Firebase:", error);
    }
}

async function saveCurrentLeadsToDB() {
    if(state.leads.length === 0) return alert("Nenhum lead para salvar.");
    if(!confirm("Deseja salvar a lista exibida no Banco de Dados?")) return;
    
    const niche = state.lastSearch.niche || 'Lista Manual';
    await saveLeadsToFirestore(state.leads, niche);
    alert("Leads salvos no banco de dados com sucesso!");
}

// --- GERENCIAMENTO DE LEADS ---
function openLeadDetails(index) {
    state.currentLeadIndex = index;
    const lead = state.leads[index];
    
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

    detailStatus.value = lead.leadStatus || "Novo";
    detailNotes.value = lead.followUpNotes || "";

    leadDetailsModal.classList.remove('hidden');
}

function saveLeadDetails() {
    if (state.currentLeadIndex === null) return;
    
    const lead = state.leads[state.currentLeadIndex];
    lead.leadStatus = detailStatus.value;
    lead.followUpNotes = detailNotes.value;
    
    alert("Alterações salvas localmente para este lead.");
    leadDetailsModal.classList.add('hidden');
    applyFilters();
}

function deleteLead(index) {
    if (confirm("Tem certeza que deseja excluir este lead da lista atual?")) {
        state.leads.splice(index, 1);
        applyFilters(); 
        document.getElementById('result-count').innerText = state.leads.length;
    }
}

// --- GERENCIAMENTO DO BANCO DE LEADS ---
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

function exportDataToCSV(data, filename) {
    const headers = ["Nome do Negócio", "Nicho", "Endereço", "Telefone", "Site", "Rating", "Status", "Notas"];
    const rows = data.map(lead => {
        const l = { ...lead };
        delete l._originalIndex;
        return [
            `"${l.name}"`, `"${l.niche}"`, `"${l.address}"`, `"${l.phone}"`, `"${l.website || ''}"`, `"${l.rating || ''}"`, `"${l.leadStatus || ''}"`, `"${l.followUpNotes || ''}"`
        ];
    });
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

// --- INTEGRAÇÃO API 1: SERPER (CHAVE 1) ---
// Função existente, apenas renomeada para clareza (compatível com chave 1)
async function fetchSerperLeads(query, limit) {
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
        
        if (!response.ok) throw new Error("Falha na API Serper");

        const result = await response.json();
        
        if (result.places) {
            return result.places.slice(0, limit).map(place => ({
                name: place.title,
                niche: place.category || 'Nicho Geral',
                address: place.address,
                phone: place.phoneNumber || 'Não informado',
                website: place.website,
                rating: place.rating,
                ratingCount: place.userRatingsTotal || 0,
                leadStatus: 'Novo'
            }));
        } else {
            return [];
        }
    } catch (error) {
        console.error('Erro na requisição Serper:', error);
        alert('Erro ao conectar com a API Serper.');
        return [];
    }
}

// --- INTEGRAÇÃO API 2: SERPAPI (CHAVE 2) ---
// Nova função solicitada
async function fetchSerpAPILeads(query, limit) {
    // URL base da SerpAPI
    // Nota: Geralmente SerpAPI requer proxy para chamadas frontend por CORS, ou uso de JSONP/Bibliotecas.
    // Implementação direta via fetch assumindo que o ambiente suporte ou use proxy.
    const baseUrl = 'https://serpapi.com/search.json';
    const params = new URLSearchParams({
        engine: 'google_local',
        q: query,
        hl: 'pt-br',
        gl: 'br',
        num: limit, // SerpAPI usa 'num' para limite
        api_key: state.apiKey
    });

    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        
        if (!response.ok) throw new Error("Falha na API SerpAPI");

        const result = await response.json();
        
        if (result.local_results) {
            return result.local_results.map(place => ({
                name: place.title,
                niche: place.type || 'Nicho Geral',
                address: place.address,
                phone: place.phone || 'Não informado',
                website: place.website,
                rating: place.rating,
                ratingCount: place.reviews,
                leadStatus: 'Novo'
            }));
        } else {
            return [];
        }
    } catch (error) {
        console.error('Erro na requisição SerpAPI:', error);
        alert('Erro ao conectar com a API SerpAPI. Verifique CORS/Proxy.');
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
            ratingCount: Math.floor(Math.random() * 200),
            leadStatus: 'Novo'
        });
    }
    return leads;
}

// --- Renderização ---
function getStatusClass(status) {
    const slug = status.toLowerCase().replace(/\s+/g, '-');
    return `status-${slug}`;
}

function renderLeads(leads) {
    leadsBody.innerHTML = '';
    resultCount.innerText = leads.length;

    if (leads.length === 0) {
        leadsBody.innerHTML = '<tr><td colspan="6">Nenhum lead encontrado.</td></tr>';
        return;
    }

    leads.forEach((lead, i) => {
        const row = document.createElement('tr');
        const actualIndex = (lead._originalIndex !== undefined) ? lead._originalIndex : i;
        
        const siteLink = lead.website 
            ? `<a href="${lead.website}" target="_blank"><i class="fas fa-external-link-alt"></i> Visitar</a>` 
            : '<span class="text-muted">-</span>';

        const whatsappLink = lead.phone && lead.phone !== 'Não informado' 
            ? `<button class="btn-action" onclick="openMessageModal(${actualIndex})" title="Gerar Abordagem"><i class="fab fa-whatsapp"></i></button>`
            : '<button class="btn-action" disabled style="opacity:0.5"><i class="fab fa-whatsapp"></i></button>';

        const actions = `
            <div class="actions-cell">
                ${whatsappLink}
                <button class="btn-manage" onclick="openLeadDetails(${actualIndex})" title="Gerenciar Lead"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteLead(${actualIndex})" title="Excluir Lead"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        const status = lead.leadStatus || 'Novo';
        const statusClass = getStatusClass(status);
        let cityState = lead.address;
        
        row.innerHTML = `
            <td>
                <div class="lead-info-primary">
                    <span class="lead-name">${lead.name}</span>
                    <span class="status-badge ${statusClass}">${status}</span>
                </div>
            </td>
            <td>
                <div class="lead-info-secondary">
                    <span class="lead-niche">${lead.niche}</span>
                    <span class="lead-separator">•</span>
                    <span>${cityState}</span>
                </div>
            </td>
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
        // Carrega seleção salva
        if(state.providerId) {
            document.getElementById('api-provider-select').value = state.providerId;
        }
        document.getElementById('config-modal').classList.remove('hidden');
        updateApiStatusUI();
    };
    
    // DB Modals e Saves
    document.getElementById('btn-save-db-direct').onclick = saveCurrentLeadsToDB;
    
    // O botão btn-db-manager foi removido do HTML, mas mantemos o listener condicional
    const btnDbManager = document.getElementById('btn-db-manager');
    if (btnDbManager) {
        btnDbManager.onclick = openDatabaseModal;
    }

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
    
    // ADMIN Events
    document.getElementById('btn-admin-reset').onclick = resetAccess;
    document.getElementById('btn-admin-add').onclick = addAdminLeads;
    
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