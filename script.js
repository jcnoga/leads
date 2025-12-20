/**
 * GERADOR DE LEADS PROFISSIONAL - MODO HÍBRIDO (LOCAL + NUVEM)
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

const API_KEYS_CONFIG = {
    KEY_1: "d97256e83e8533e1c41d314bd147dfd72dde024a",
    KEY_2: "SUA_CHAVE_SERPAPI_AQUI"
};

// --- Configurações Iniciais ---
const ADMIN_EMAIL = "jcnvap@gmail.com";
const DEFAULT_TEMPLATE_TEXT = "Olá, tudo bem? 👋\nNotei que você atua como {nicho} em {cidade} {estado} e identifiquei que o seu negócio possui um grande potencial para atrair mais clientes por meio de algumas ações estratégicas no ambiente digital.\nTrabalho ajudando profissionais do seu setor a gerar mais oportunidades e fortalecer a presença online. Posso te mostrar um exemplo simples, sem compromisso?";

const DEFAULT_TEMPLATES = [
    { id: 'default', name: 'Padrão do Sistema', content: DEFAULT_TEMPLATE_TEXT, isDefault: true }
];

// --- Estado da Aplicação (Atualizado) ---
const state = {
    providerId: localStorage.getItem('selected_provider_id') || 'KEY_1', 
    apiKey: '', 
    leadsBalance: parseInt(localStorage.getItem('leads_balance')) || 0,
    user: null, 
    leads: [],
    lastSearch: { niche: '', city: '', state: '' },
    templates: JSON.parse(localStorage.getItem('msg_templates')) || DEFAULT_TEMPLATES,
    challengeNumber: 0,
    currentLeadIndex: null,
    appMode: localStorage.getItem('app_mode') || 'hybrid',
    // Controle de Paginação
    currentPage: 1,
    itemsPerPage: 10,
    isShowingSaved: false 
};

// Inicializa a apiKey correta
if (state.providerId && API_KEYS_CONFIG[state.providerId]) {
    state.apiKey = API_KEYS_CONFIG[state.providerId];
    if (!localStorage.getItem('selected_provider_id')) {
        localStorage.setItem('selected_provider_id', 'KEY_1');
    }
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
const apiProviderBadge = document.getElementById('api-provider-badge');

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

// NOVOS ELEMENTOS
const registerModeSelect = document.getElementById('register-mode-select'); 
const btnBackup = document.getElementById('btn-backup');
const btnRestoreTrigger = document.getElementById('btn-restore-trigger');
const restoreFileInput = document.getElementById('restore-file-input');
const btnSaveDbDirect = document.getElementById('btn-save-db-direct');
const btnShowSavedLeads = document.getElementById('btn-show-saved-leads');
const paginationControls = document.getElementById('pagination-controls');
const resultsTitle = document.getElementById('results-title');


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (state.appMode === 'local') return;

            if (user) {
                state.user = {
                    name: user.displayName || user.email,
                    email: user.email,
                    uid: user.uid,
                    source: 'firebase'
                };
                checkAuth();
            } else if (!state.user || state.user.source === 'firebase') {
                state.user = null;
                checkAuth();
            }
        });
    }

    const localSession = localStorage.getItem('local_session_user');
    if (localSession && !state.user) {
        state.user = JSON.parse(localSession);
        if (!state.appMode && localStorage.getItem('app_mode')) {
             state.appMode = localStorage.getItem('app_mode');
        }
        checkAuth();
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
        
        let modeLabel = '';
        if (state.appMode === 'local') modeLabel = ' (Local)';
        if (state.appMode === 'hybrid') modeLabel = ' (Híbrido)';
        if (state.appMode === 'cloud') modeLabel = ' (Nuvem)';

        document.getElementById('user-name-display').innerText = state.user.name + modeLabel;
        
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

async function login(email, password) {
    let detectedMode = 'cloud'; 
    let loginSuccess = false;

    const localUsers = JSON.parse(localStorage.getItem('local_users_db') || '[]');
    const userFound = localUsers.find(u => u.email === email && u.password === password);

    if (userFound) {
        detectedMode = userFound.mode || 'local';
        state.appMode = detectedMode;
        localStorage.setItem('app_mode', detectedMode);

        state.user = {
            name: userFound.name,
            email: userFound.email,
            uid: userFound.uid,
            source: 'local'
        };
        localStorage.setItem('local_session_user', JSON.stringify(state.user));
        loginSuccess = true;
        
        if (detectedMode === 'hybrid' && auth) {
             auth.signInWithEmailAndPassword(email, password).catch(err => console.log("Login Firebase falhou no modo híbrido (offline?):", err));
        }
        
        checkAuth();
        if (detectedMode === 'local') return;
    }

    if (!loginSuccess) {
        if (!auth) return alert("Firebase não configurado.");
        try {
            await auth.signInWithEmailAndPassword(email, password);
            state.appMode = 'cloud';
            localStorage.setItem('app_mode', 'cloud');
        } catch (error) {
            alert("Erro no login: " + error.message);
        }
    }
}

function register(name, email, password) {
    const mode = registerModeSelect.value; 
    
    if (mode === 'local' || mode === 'hybrid') {
        const localUsers = JSON.parse(localStorage.getItem('local_users_db') || '[]');
        if (localUsers.find(u => u.email === email)) {
             return alert("Usuário já existe localmente.");
        } else {
            const newUser = {
                name: name,
                email: email,
                password: password,
                uid: 'local_' + Date.now(),
                mode: mode 
            };
            localUsers.push(newUser);
            localStorage.setItem('local_users_db', JSON.stringify(localUsers));
            
            localStorage.setItem('leads_balance', 50);
            state.leadsBalance = 50;
        }
    }

    if (mode === 'cloud' || mode === 'hybrid') {
        if (!auth) return alert("Firebase não configurado.");
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                localStorage.setItem('leads_balance', 50);
                state.leadsBalance = 50;
                return userCredential.user.updateProfile({ displayName: name });
            })
            .then(() => {
                alert("Conta criada com sucesso! (Modo: " + mode + ")");
                toggleAuthBox('login');
            })
            .catch((error) => {
                if(error.code === 'auth/email-already-in-use' && mode === 'hybrid') {
                    alert("Conta criada localmente. O e-mail já existia na nuvem, sincronizando...");
                    toggleAuthBox('login');
                } else {
                    alert("Erro no cadastro nuvem: " + error.message);
                }
            });
    } else {
        alert("Conta local criada com sucesso!");
        toggleAuthBox('login');
    }
}

function logout() {
    state.user = null;
    localStorage.removeItem('local_session_user'); 
    localStorage.removeItem('app_mode'); 
    if (auth) auth.signOut();
    location.reload(); 
}

function resetPassword(email) {
    if (!auth) return alert("Disponível apenas em modo Nuvem/Híbrido com Firebase.");
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

// --- CARREGAR MEUS CONTATOS (GRID) ---

async function loadMyContacts() {
    if (!state.user) return alert("Faça login para ver seus contatos.");

    // Reset UI
    leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando contatos... <i class="fas fa-spinner fa-spin"></i></td></tr>';
    resultsPanel.classList.remove('hidden');
    state.isShowingSaved = true;
    state.currentPage = 1; 
    
    // Atualiza Título
    resultsTitle.innerHTML = 'Meus Contatos <span class="badge-real">(Salvos)</span>: <span id="result-count">...</span>';
    dataSourceBadge.classList.add('hidden'); 

    let loadedLeads = [];

    // Lógica Híbrida de Carregamento
    if (state.appMode === 'local') {
        const storageKey = `local_leads_${state.user.email}`;
        loadedLeads = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } else {
        // Nuvem ou Híbrido
        if (!auth.currentUser && state.appMode === 'hybrid') {
            const storageKey = `local_leads_${state.user.email}`;
            loadedLeads = JSON.parse(localStorage.getItem(storageKey) || '[]');
        } else {
            try {
                const snapshot = await db.collection('users').doc(state.user.uid || auth.currentUser.uid).collection('leads')
                    .orderBy('createdAt', 'desc')
                    .get();
                
                loadedLeads = snapshot.docs.map(doc => {
                    return { ...doc.data(), firestoreId: doc.id };
                });
            } catch (error) {
                console.error("Erro ao buscar leads:", error);
                const storageKey = `local_leads_${state.user.email}`;
                loadedLeads = JSON.parse(localStorage.getItem(storageKey) || '[]');
            }
        }
    }

    state.leads = loadedLeads;
    populateNicheFilter(state.leads);
    applyFilters(); 
}

// --- Lógica de Busca ---
async function searchLeads(event) {
    event.preventDefault();
    state.isShowingSaved = false;
    state.currentPage = 1;
    
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
    resultsTitle.innerHTML = `Resultados <span id="data-source-badge" class="badge-fictitious">...</span>: <span id="result-count">...</span>`;

    let leads = [];

    if (state.apiKey && state.leadsBalance > 0) {
        if (state.providerId === 'KEY_2') {
            leads = await fetchSerpAPILeads(query, limit); 
        } else {
            leads = await fetchSerperLeads(query, limit);
        }
        
        // --- NOVA LÓGICA: Forçar nicho da busca ---
        if (leads.length > 0) {
            // Aqui substituímos a categoria da API pelo termo pesquisado
            leads.forEach(l => l.niche = niche);

            state.leadsBalance -= leads.length;
            if (state.leadsBalance < 0) state.leadsBalance = 0;
            localStorage.setItem('leads_balance', state.leadsBalance);
            
            updateApiStatusUI();
            updateResultsBadge(true);
            saveLeadsUniversal(leads, niche); 
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
    filterText.addEventListener('input', () => { state.currentPage = 1; applyFilters(); });
    filterStatus.addEventListener('change', () => { state.currentPage = 1; applyFilters(); });
    filterNiche.addEventListener('change', () => { state.currentPage = 1; applyFilters(); });
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

    // Preservamos o _originalIndex para saber quem é quem no array principal state.leads
    const indexedLeads = state.leads.map((lead, index) => ({...lead, _originalIndex: index}));

    const filtered = indexedLeads.filter(lead => {
        const matchesText = (
            (lead.name && lead.name.toLowerCase().includes(txt)) || 
            (lead.niche && lead.niche.toLowerCase().includes(txt)) ||
            (lead.address && lead.address.toLowerCase().includes(txt))
        );
        const matchesStatus = st ? lead.leadStatus === st : true;
        const matchesNiche = ni ? lead.niche === ni : true;

        return matchesText && matchesStatus && matchesNiche;
    });

    renderLeads(filtered);
}

// --- PERSISTÊNCIA UNIVERSAL ---

async function saveCurrentLeadsToDB() {
    if(state.leads.length === 0) return alert("Nenhum lead para salvar.");
    if(state.leads.some(l => l.isMock)) return alert("Atenção: Leads fictícios não podem ser salvos.");

    if(!confirm(`Deseja salvar a lista no modo: ${state.appMode.toUpperCase()}?`)) return;

    const niche = state.lastSearch.niche || 'Lista Manual';
    await saveLeadsUniversal(state.leads, niche);
    
    if(state.appMode === 'local') {
        alert("Dados salvos localmente com sucesso!");
    }
}

async function saveLeadsUniversal(leads, niche) {
    const validLeads = leads.filter(lead => !lead.isMock);
    if (validLeads.length === 0) return;

    if (state.appMode === 'local' || state.appMode === 'hybrid') {
        saveLeadsToLocal(validLeads, niche);
    }

    if (state.appMode === 'cloud' || state.appMode === 'hybrid') {
        await saveLeadsToFirestore(validLeads, niche);
    }
}

function saveLeadsToLocal(leads, niche) {
    if (!state.user) return;
    const storageKey = `local_leads_${state.user.email}`;
    let currentData = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    leads.forEach(lead => {
        const leadToSave = { ...lead };
        delete leadToSave._originalIndex;
        delete leadToSave.isMock;
        
        // Evitar duplicatas exatas se já existir
        const exists = currentData.some(d => d.name === leadToSave.name && d.phone === leadToSave.phone);
        if (!exists) {
            currentData.push({
                ...leadToSave,
                searchNiche: niche,
                leadStatus: lead.leadStatus || 'Novo',
                followUpNotes: lead.followUpNotes || '',
                createdAt: new Date().toISOString()
            });
        }
    });
    localStorage.setItem(storageKey, JSON.stringify(currentData));
    console.log("Leads salvos localmente.");
}

async function saveLeadsToFirestore(leads, niche = 'Manual') {
    if (!state.user) return;
    if (state.appMode === 'local') return;

    if (!auth || !auth.currentUser) {
        console.warn("Ignorando salvamento na Nuvem: Usuário não autenticado no Firebase (Modo Híbrido Offline?).");
        return;
    }

    const validLeads = leads.filter(lead => !lead.isMock);
    if (validLeads.length === 0) return;

    try {
        const batch = db.batch();
        const uid = auth.currentUser.uid;

        validLeads.forEach(lead => {
            const leadToSave = { ...lead };
            delete leadToSave._originalIndex;
            delete leadToSave.isMock;

            Object.keys(leadToSave).forEach(key => {
                if (leadToSave[key] === undefined) {
                    leadToSave[key] = null;
                }
            });

            const docRef = db.collection('users').doc(uid).collection('leads').doc();
            batch.set(docRef, {
                ...leadToSave,
                searchNiche: niche,
                leadStatus: lead.leadStatus || 'Novo',
                followUpNotes: lead.followUpNotes || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log("Leads salvos no Firebase.");
        if (state.appMode === 'cloud') {
            alert("Dados salvos na nuvem com sucesso!");
        }

    } catch (error) {
        console.error("Erro ao salvar leads no Firebase:", error);
        
        if (error.code === 'permission-denied') {
            const msg = "Atenção: Os dados foram salvos LOCALMENTE, mas a sincronização com a Nuvem falhou (Permissão/Login).\nVerifique sua conexão ou faça login novamente.";
            alert(msg);
        } else {
            if (state.appMode === 'cloud') {
                 alert("Erro ao sincronizar com a nuvem: " + error.message);
            }
        }
    }
}

// --- BACKUP E RESTORE ---
function backupData() {
    const backupObj = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        userEmail: state.user ? state.user.email : 'anon',
        leadsBalance: localStorage.getItem('leads_balance'),
        templates: localStorage.getItem('msg_templates'),
        leads: state.user ? localStorage.getItem(`local_leads_${state.user.email}`) : null,
        usersDb: localStorage.getItem('local_users_db')
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `backup_leads_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupObj = JSON.parse(e.target.result);
            if (confirm("Isso substituirá seus dados locais atuais. Deseja continuar?")) {
                if(backupObj.leadsBalance) localStorage.setItem('leads_balance', backupObj.leadsBalance);
                if(backupObj.templates) localStorage.setItem('msg_templates', backupObj.templates);
                if(backupObj.usersDb) localStorage.setItem('local_users_db', backupObj.usersDb);
                
                if(backupObj.leads && state.user) {
                    localStorage.setItem(`local_leads_${state.user.email}`, backupObj.leads);
                }
                alert("Restauração concluída! A página será recarregada.");
                location.reload();
            }
        } catch (error) {
            alert("Erro ao ler backup: " + error.message);
        }
    };
    reader.readAsText(file);
}

// --- GERENCIAMENTO DE LEADS ---
function openLeadDetails(index) {
    state.currentLeadIndex = index;
    const lead = state.leads[index];
    
    if (!lead) return; 

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
    
    // Se estiver no modo "Meus Contatos", precisamos salvar persistente
    if (state.isShowingSaved) {
        if (state.appMode === 'local') {
            const storageKey = `local_leads_${state.user.email}`;
            localStorage.setItem(storageKey, JSON.stringify(state.leads));
        } else if (state.appMode === 'cloud' || (state.appMode === 'hybrid' && auth.currentUser)) {
            // Update Firestore se tiver ID
            if (lead.firestoreId) {
                db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).update({
                    leadStatus: lead.leadStatus,
                    followUpNotes: lead.followUpNotes
                }).catch(err => console.error("Erro update firestore", err));
            }
        }
        alert("Alterações salvas!");
    } else {
        alert("Alterações salvas na memória (lista temporária). Salve a lista para persistir.");
    }
    
    leadDetailsModal.classList.add('hidden');
    applyFilters();
}

function deleteLead(index) {
    if (confirm("Tem certeza que deseja excluir este lead?")) {
        // Se for lista salva, remove do banco/localstorage
        if (state.isShowingSaved) {
            const lead = state.leads[index];
            if (state.appMode === 'local') {
                state.leads.splice(index, 1);
                const storageKey = `local_leads_${state.user.email}`;
                localStorage.setItem(storageKey, JSON.stringify(state.leads));
            } else if (lead.firestoreId) {
                // Cloud delete
                db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).delete()
                .then(() => {
                    state.leads.splice(index, 1);
                    applyFilters();
                });
                return; // Async handle
            }
        } else {
            state.leads.splice(index, 1);
        }
        applyFilters(); 
    }
}

// --- RENDERIZAÇÃO E PAGINAÇÃO ---

function renderLeads(leadsToRender) {
    leadsBody.innerHTML = '';
    resultCount.innerText = leadsToRender.length;

    if (leadsToRender.length === 0) {
        leadsBody.innerHTML = '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';
        paginationControls.classList.add('hidden');
        return;
    }

    // Paginação
    const totalPages = Math.ceil(leadsToRender.length / state.itemsPerPage);
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const paginatedLeads = leadsToRender.slice(start, end);

    paginatedLeads.forEach((lead) => {
        // Usamos o _originalIndex anexado no applyFilters para manter referência correta
        const actualIndex = lead._originalIndex; 
        
        const row = document.createElement('tr');
        
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

    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    paginationControls.innerHTML = '';
    if (totalPages <= 1) {
        paginationControls.classList.add('hidden');
        return;
    }
    paginationControls.classList.remove('hidden');

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = state.currentPage === 1;
    prevBtn.onclick = () => changePage(state.currentPage - 1);
    paginationControls.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.innerText = `Página ${state.currentPage} de ${totalPages}`;
    paginationControls.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = state.currentPage === totalPages;
    nextBtn.onclick = () => changePage(state.currentPage + 1);
    paginationControls.appendChild(nextBtn);
}

function changePage(newPage) {
    state.currentPage = newPage;
    applyFilters(); 
}

// --- INTEGRAÇÃO API ---
async function fetchSerperLeads(query, limit) {
    const url = 'https://google.serper.dev/places';
    const myHeaders = new Headers();
    myHeaders.append("X-API-KEY", state.apiKey);
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({ "q": query, "gl": "br", "hl": "pt-br" });

    try {
        const response = await fetch(url, { method: 'POST', headers: myHeaders, body: raw });
        if (!response.ok) throw new Error("Falha na API Serper");
        const result = await response.json();
        
        if (result.places) {
            return result.places.slice(0, limit).map(place => ({
                name: place.title,
                niche: place.category || 'Nicho Geral',
                address: place.address,
                phone: place.phoneNumber || 'Não informado',
                website: place.website || null,
                rating: place.rating || null,
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

async function fetchSerpAPILeads(query, limit) {
    const baseUrl = 'https://serpapi.com/search.json';
    const params = new URLSearchParams({
        engine: 'google_local',
        q: query,
        hl: 'pt-br',
        gl: 'br',
        num: limit, 
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
                website: place.website || null,
                rating: place.rating || null,
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
            leadStatus: 'Novo',
            isMock: true
        });
    }
    return leads;
}

// --- Utils ---
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getStatusClass(status) {
    const slug = removeAccents(status.toLowerCase()).replace(/\s+/g, '-');
    return `status-${slug}`;
}

function openMessageModal(leadIndex) {
    const lead = state.leads[leadIndex];
    const modal = document.getElementById('message-modal');
    const textArea = document.getElementById('generated-message');
    const btnWhats = document.getElementById('btn-send-whatsapp');

    const templateInput = document.getElementById('message-template-input').value;

    const nichoVal = lead.niche || "";
    const cidadeVal = lead.address ? lead.address.split(',')[0] : "sua cidade";
    const estadoVal = "";

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

function exportToCSV() {
    if (state.leads.length === 0) { alert("Não há dados para exportar."); return; }
    exportDataToCSV(state.leads, `leads_${Date.now()}.csv`);
}

function exportToXLSX() {
    if (state.leads.length === 0) { alert("Não há dados para exportar."); return; }
    exportDataToXLSX(state.leads, `leads_${Date.now()}.xlsx`);
}

function exportDataToCSV(data, filename) {
    const headers = ["Nome do Negócio", "Nicho", "Endereço", "Telefone", "Site", "Rating", "Status", "Notas"];
    const rows = data.map(lead => {
        return [
            `"${lead.name}"`, `"${lead.niche}"`, `"${lead.address}"`, `"${lead.phone}"`, `"${lead.website || ''}"`, `"${lead.rating || ''}"`, `"${lead.leadStatus || ''}"`, `"${lead.followUpNotes || ''}"`
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

    // Novo listener para Meus Contatos
    if(btnShowSavedLeads) {
        btnShowSavedLeads.onclick = loadMyContacts;
    }

    messageTemplateInput.addEventListener('input', () => {
        localStorage.setItem('current_draft_message', messageTemplateInput.value);
    });

    document.getElementById('btn-config').onclick = () => {
        if(state.providerId) {
            document.getElementById('api-provider-select').value = state.providerId;
        }
        document.getElementById('config-modal').classList.remove('hidden');
        updateApiStatusUI();
    };
    
    if(btnSaveDbDirect) btnSaveDbDirect.onclick = saveCurrentLeadsToDB;
    
    if(btnBackup) btnBackup.onclick = backupData;
    if(btnRestoreTrigger) btnRestoreTrigger.onclick = () => restoreFileInput.click();
    if(restoreFileInput) restoreFileInput.onchange = restoreData;
    
    const btnDbManager = document.getElementById('btn-db-manager');
    if (btnDbManager) {
        btnDbManager.onclick = openDatabaseModal;
    }

    document.getElementById('btn-download-delete-csv').onclick = () => downloadAndDelete('csv');
    document.getElementById('btn-download-delete-xlsx').onclick = () => downloadAndDelete('xlsx');
    
    document.getElementById('btn-save-details').onclick = saveLeadDetails;
    document.getElementById('btn-cancel-details').onclick = () => leadDetailsModal.classList.add('hidden');
    
    document.querySelector('.close-modal').onclick = () => document.getElementById('config-modal').classList.add('hidden');
    document.querySelector('.close-modal-db').onclick = () => document.getElementById('database-modal').classList.add('hidden');
    document.querySelector('.close-modal-details').onclick = () => document.getElementById('lead-details-modal').classList.add('hidden');
    document.querySelector('.close-modal-msg').onclick = () => document.getElementById('message-modal').classList.add('hidden');

    document.getElementById('save-api-key').onclick = validateAndSaveApiKey;
    
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