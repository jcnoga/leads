const firebaseConfig = {
  apiKey: "AIzaSyAY06PHLqEUCBzg9SjnH4N6xe9ZzM8OLvo",
  authDomain: "projeto-bfed3.firebaseapp.com",
  projectId: "projeto-bfed3",
  storageBucket: "projeto-bfed3.firebasestorage.app",
  messagingSenderId: "785289237066",
  appId: "1:785289237066:web:d5871c2a002a90e2d5ccb3"
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
    // ALTERAÇÃO: Modo Híbrido Obrigatório
    appMode: 'hybrid', 
    // Controle de Paginação
    currentPage: 1,
    itemsPerPage: 10,
    isShowingSaved: false 
};

// Variável de controle para edição
let editingTemplateId = null; 

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
const btnSyncData = document.getElementById('btn-sync-data'); // Botão de Sincronização


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Força modo Híbrido ao iniciar
    state.appMode = 'hybrid';
    localStorage.setItem('app_mode', 'hybrid');

    if (auth) {
        auth.onAuthStateChanged((user) => {
            // Se estiver logado no Firebase, atualiza o estado
            if (user) {
                // Se já temos um usuário local, preservamos a sessão local mas atualizamos UID
                if (state.user) {
                    state.user.uid = user.uid;
                    state.user.source = 'hybrid';
                } else {
                    state.user = {
                        name: user.displayName || user.email,
                        email: user.email,
                        uid: user.uid,
                        source: 'hybrid' // Autenticado na Nuvem
                    };
                }
                checkAuth();
            }
        });
    }

    const localSession = localStorage.getItem('local_session_user');
    if (localSession && !state.user) {
        state.user = JSON.parse(localSession);
        // Garante que o modo seja híbrido mesmo recuperando sessão
        state.appMode = 'hybrid';
        checkAuth();
    }

    setupEventListeners();
    setupFilterListeners();
    setupVisualFeedback(); 
    
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

// --- Destaque Visual ---
function setupVisualFeedback() {
    const inputs = document.querySelectorAll('input, textarea, select');
    const handleInput = (e) => {
        if (e.target.value && e.target.value.trim() !== '') {
            e.target.classList.add('input-filled');
        } else {
            e.target.classList.remove('input-filled');
        }
    };
    inputs.forEach(input => {
        input.addEventListener('input', handleInput);
        input.addEventListener('change', handleInput);
        input.addEventListener('blur', handleInput);
        // Validação inicial
        if(input.value) handleInput({ target: input });
    });
}

// Filtragem de Fictícios e Duplicados
async function filterInvalidAndDuplicateLeads(newLeads) {
    let existingLeads = [];
    
    if (state.user) {
        const storageKey = `local_leads_${state.user.email}`;
        existingLeads = JSON.parse(localStorage.getItem(storageKey) || '[]');
    }

    if (state.isShowingSaved && state.leads.length > 0) {
        existingLeads = [...existingLeads, ...state.leads];
    }

    const existingPhones = new Set(existingLeads.map(l => l.phone ? l.phone.replace(/\D/g, '') : ''));
    const existingNames = new Set(existingLeads.map(l => l.name ? l.name.toLowerCase().trim() : ''));

    return newLeads.filter(lead => {
        const lowerName = lead.name ? lead.name.toLowerCase() : '';

        const isFictitious = (
            lead.isMock === true || 
            lowerName.includes('teste') || 
            lowerName.includes('exemplo') || 
            lowerName.includes('admin') ||
            lead.phone === 'Não informado' ||
            lead.phone === '000000000'
        );

        if (isFictitious) return false;

        const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
        const cleanName = lowerName.trim();

        if (cleanPhone.length > 5 && existingPhones.has(cleanPhone)) return false;
        if (existingNames.has(cleanName)) return false;

        return true;
    });
}

// --- Autenticação ---
function checkAuth() {
    if (state.user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        
        let modeLabel = ' (Híbrido)';
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

// ALTERAÇÃO: Login agora aceita o Nome e armazena
async function login(email, password, name) {
    // 1. Tenta autenticação local primeiro (Offline First)
    const localUsers = JSON.parse(localStorage.getItem('local_users_db') || '[]');
    let userFound = localUsers.find(u => u.email === email && u.password === password);
    let loginSuccess = false;

    if (userFound) {
        // Se o usuário já existe localmente, mas forneceu um nome novo/diferente no login, atualizamos
        if (name && name.trim() !== "" && (!userFound.name || userFound.name !== name)) {
            userFound.name = name;
            // Salva atualização no DB local
            localStorage.setItem('local_users_db', JSON.stringify(localUsers));
        }

        // Define estado do usuário
        state.user = {
            name: userFound.name, // Usa o nome do DB local (ou atualizado)
            email: userFound.email,
            uid: userFound.uid || 'local_' + Date.now(),
            source: 'local'
        };
        
        // Persiste sessão
        localStorage.setItem('local_session_user', JSON.stringify(state.user));
        loginSuccess = true;
        
        // Tenta conectar no Firebase em segundo plano para sync de auth
        if (auth) {
             auth.signInWithEmailAndPassword(email, password)
                 .then(cred => {
                     // Atualiza UID para o oficial da nuvem
                     state.user.uid = cred.user.uid;
                     state.user.source = 'hybrid';
                     localStorage.setItem('local_session_user', JSON.stringify(state.user));
                 })
                 .catch(err => console.log("Login Firebase em background falhou (offline ou credencial errada):", err));
        }
        
        checkAuth();
        return;
    }

    // 2. Se não achou localmente, tenta na nuvem (Firebase)
    if (!loginSuccess) {
        if (!auth) return alert("Firebase não configurado.");
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const fbUser = userCredential.user;
            
            // Define o nome: ou o que veio do form, ou o do profile Firebase, ou o e-mail
            const finalName = name || fbUser.displayName || email.split('@')[0];

            // Atualiza profile no Firebase se necessário
            if (name && fbUser.displayName !== name) {
                await fbUser.updateProfile({ displayName: name });
            }

            // Cria usuário localmente para próximos logins offline e sincronização
            const newUserLocal = {
                name: finalName,
                email: email,
                password: password, // Armazenando conforme solicitado no prompt (sincronização de credenciais)
                uid: fbUser.uid,
                mode: 'hybrid'
            };
            localUsers.push(newUserLocal);
            localStorage.setItem('local_users_db', JSON.stringify(localUsers));

            state.user = {
                name: finalName,
                email: email,
                uid: fbUser.uid,
                source: 'hybrid'
            };
            localStorage.setItem('local_session_user', JSON.stringify(state.user));
            
            checkAuth();
        } catch (error) {
            alert("Erro no login: " + error.message);
        }
    }
}

function register(name, email, password) {
    const mode = 'hybrid'; // Forçado
    
    // 1. Cria Localmente
    const localUsers = JSON.parse(localStorage.getItem('local_users_db') || '[]');
    if (localUsers.find(u => u.email === email)) {
         return alert("Usuário já existe localmente.");
    }

    const newUser = {
        name: name,
        email: email,
        password: password,
        uid: 'local_' + Date.now(),
        mode: mode 
    };
    localUsers.push(newUser);
    localStorage.setItem('local_users_db', JSON.stringify(localUsers));
    
    // Saldo inicial
    localStorage.setItem('leads_balance', 50);
    state.leadsBalance = 50;

    // 2. Tenta Criar na Nuvem (Sync Imediato)
    if (auth) {
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Atualiza UID local com o da nuvem
                newUser.uid = userCredential.user.uid;
                localStorage.setItem('local_users_db', JSON.stringify(localUsers));
                return userCredential.user.updateProfile({ displayName: name });
            })
            .then(() => {
                alert("Conta criada com sucesso! Você pode fazer login.");
                toggleAuthBox('login');
            })
            .catch((error) => {
                if(error.code === 'auth/email-already-in-use') {
                    alert("Conta criada localmente. O e-mail já existia na nuvem. Faça login para sincronizar.");
                    toggleAuthBox('login');
                } else {
                    alert("Conta criada LOCALMENTE. Erro na nuvem: " + error.message + ". Tente sincronizar depois.");
                    toggleAuthBox('login');
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

// --- SINCRONIZAÇÃO ROBUSTA (NOVO RECURSO) ---
async function syncSystem() {
    if (!state.user) return alert("Faça login para sincronizar.");
    if (!navigator.onLine) return alert("Sem conexão com a internet.");

    const btn = document.getElementById('btn-sync-data');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    btn.disabled = true;

    try {
        // 1. Sincronizar Usuário (Credenciais)
        // Se o usuário está logado localmente, verifica se precisa criar/logar no Firebase para obter token válido
        if (!auth.currentUser) {
            const localUsers = JSON.parse(localStorage.getItem('local_users_db') || '[]');
            const currentUserLocal = localUsers.find(u => u.email === state.user.email);
            
            if (currentUserLocal) {
                try {
                    await auth.signInWithEmailAndPassword(currentUserLocal.email, currentUserLocal.password);
                    console.log("Sync Auth: Logado no Firebase com credenciais locais.");
                } catch (authErr) {
                    if (authErr.code === 'auth/user-not-found') {
                        // Usuário existe localmente mas não na nuvem -> Criar na nuvem
                        await auth.createUserWithEmailAndPassword(currentUserLocal.email, currentUserLocal.password);
                        await auth.currentUser.updateProfile({ displayName: currentUserLocal.name });
                        console.log("Sync Auth: Usuário recriado na nuvem.");
                    } else if (authErr.code === 'auth/wrong-password') {
                        // Conflito: E-mail existe mas senha é diferente. Não podemos sobrescrever a nuvem sem autorização.
                        // Mas podemos tentar continuar o sync se o usuário manualmente logar depois.
                        throw new Error("Conflito de senha na nuvem. Faça login manualmente.");
                    } else {
                        throw authErr; // Erro de rede ou outro
                    }
                }
                // Atualiza UID do estado global
                if(auth.currentUser) state.user.uid = auth.currentUser.uid;
            }
        }

        // 2. Sincronizar Leads
        const storageKey = `local_leads_${state.user.email}`;
        let localLeads = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        let syncedCount = 0;
        let errorCount = 0;

        // Filtra apenas leads que NÃO têm ID do Firestore (ainda não sincronizados)
        // Mapeamos com o índice original para poder atualizar o localStorage corretamente
        const leadsToSync = localLeads.map((lead, index) => ({...lead, localIndex: index}))
                                      .filter(lead => !lead.firestoreId);

        if (leadsToSync.length === 0) {
            alert("Todos os leads locais já estão sincronizados!");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        // Processa sincronização item a item para garantir que erro em um não pare os outros
        for (const lead of leadsToSync) {
            try {
                // Prepara objeto para envio (remove metadados locais)
                const leadToSend = { ...lead };
                delete leadToSend.localIndex;
                delete leadToSend.firestoreId; // Garante que vai sem ID para criar novo
                delete leadToSend.isMock;

                // Garante campos nulos onde necessário
                Object.keys(leadToSend).forEach(key => {
                    if (leadToSend[key] === undefined) leadToSend[key] = null;
                });
                
                // Adiciona timestamp se não tiver
                if (!leadToSend.createdAt) leadToSend.createdAt = firebase.firestore.FieldValue.serverTimestamp();

                // Envia para o Firestore
                const docRef = await db.collection('users').doc(state.user.uid).collection('leads').add(leadToSend);

                // Atualiza o objeto local original com o novo ID para evitar duplicatas futuras
                localLeads[lead.localIndex].firestoreId = docRef.id;
                syncedCount++;

            } catch (err) {
                console.error(`Erro ao sincronizar lead ${lead.name}:`, err);
                errorCount++;
                // Não interrompe o loop, continua para o próximo lead
            }
        }

        // Salva a lista atualizada (com os novos IDs) no LocalStorage
        localStorage.setItem(storageKey, JSON.stringify(localLeads));

        // Feedback
        let msg = `Sincronização concluída.\nEnviados com sucesso: ${syncedCount}`;
        if (errorCount > 0) {
            msg += `\nFalhas: ${errorCount} (Verifique conexão e tente novamente).`;
        }
        alert(msg);

        // Se estiver na tela de "Meus Contatos", recarrega para mostrar status
        if (state.isShowingSaved) {
            loadMyContacts();
        }

    } catch (globalError) {
        console.error("Erro fatal na sincronização:", globalError);
        alert("Erro ao iniciar sincronização: " + globalError.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
    const nameInput = document.getElementById('new-template-name');
    const contentInput = document.getElementById('new-template-content');
    const btnSave = document.getElementById('btn-save-template');

    const name = nameInput.value.trim();
    const content = contentInput.value.trim();

    if (!name || !content) {
        alert("Preencha o nome e o texto do modelo.");
        return;
    }

    if (editingTemplateId) {
        const index = state.templates.findIndex(t => t.id === editingTemplateId);
        if (index !== -1) {
            state.templates[index].name = name;
            state.templates[index].content = content;
            alert("Modelo atualizado com sucesso!");
        }
        editingTemplateId = null;
        btnSave.innerText = "Adicionar Modelo";
        btnSave.classList.remove('btn-primary'); 
        btnSave.classList.add('btn-secondary');
    } else {
        const newTpl = {
            id: Date.now().toString(),
            name: name,
            content: content,
            isDefault: false
        };
        state.templates.push(newTpl);
        alert("Modelo salvo com sucesso!");
    }

    localStorage.setItem('msg_templates', JSON.stringify(state.templates));
    nameInput.value = '';
    contentInput.value = '';
    
    renderTemplatesList();
}

function editTemplate(id) {
    const template = state.templates.find(t => t.id === id);
    if (!template) return;

    document.getElementById('new-template-name').value = template.name;
    document.getElementById('new-template-content').value = template.content;
    
    editingTemplateId = id;
    
    const btnSave = document.getElementById('btn-save-template');
    btnSave.innerText = "Salvar Alterações";
    btnSave.classList.remove('btn-secondary');
    btnSave.classList.add('btn-primary'); 
    
    document.querySelector('.new-template-form').scrollIntoView({ behavior: 'smooth' });
}

function copyTemplateContent(id) {
    const template = state.templates.find(t => t.id === id);
    if (!template) return;

    navigator.clipboard.writeText(template.content).then(() => {
        alert(`Modelo "${template.name}" copiado para a área de transferência!`);
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Não foi possível copiar o texto automaticamente.');
    });
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
        
        const btnCopy = `<button onclick="copyTemplateContent('${t.id}')" class="btn-manage" title="Copiar"><i class="far fa-copy"></i></button>`;
        const btnEdit = `<button onclick="editTemplate('${t.id}')" class="btn-manage" title="Editar"><i class="fas fa-edit"></i></button>`;
        const btnDelete = t.id !== 'default' ? `<button onclick="deleteTemplate('${t.id}')" class="btn-delete" title="Excluir">X</button>` : '';
        const btnDefault = !t.isDefault ? `<button onclick="setDefaultTemplate('${t.id}')" class="btn-manage" style="font-size:0.8rem;">Usar Padrão</button>` : '<span style="color:var(--success); font-size:0.8rem; font-weight:bold; margin-right:5px;"><i class="fas fa-check"></i> Padrão</span>';

        li.innerHTML = `
            <div style="flex: 1; padding-right: 10px;">
                <strong>${t.name}</strong>
                <br><small style="color:#666; display:block; margin-top:4px;">${t.content.substring(0, 60)}${t.content.length > 60 ? '...' : ''}</small>
            </div>
            <div class="template-actions" style="display:flex; align-items:center; gap:5px;">
                ${btnCopy}
                ${btnEdit}
                ${btnDefault}
                ${btnDelete}
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

    // Lógica Híbrida: Carrega sempre do LocalStorage, pois ele é a fonte da verdade offline
    // A Sincronização é que cuida de enviar para a nuvem
    const storageKey = `local_leads_${state.user.email}`;
    loadedLeads = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // Se estiver vazio localmente, tenta um fallback para nuvem (apenas se tiver internet)
    if (loadedLeads.length === 0 && auth && auth.currentUser) {
        try {
            const snapshot = await db.collection('users').doc(auth.currentUser.uid).collection('leads').get();
            const cloudLeads = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
            
            if (cloudLeads.length > 0) {
                loadedLeads = cloudLeads;
                localStorage.setItem(storageKey, JSON.stringify(loadedLeads));
            }
        } catch (e) {
            console.log("Sem leads locais e sem conexão para baixar.");
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
        
        if (leads.length > 0) {
            leads.forEach(l => l.niche = niche);

            const originalCount = leads.length;
            leads = await filterInvalidAndDuplicateLeads(leads);
            const filteredCount = originalCount - leads.length;

            if (filteredCount > 0) {
                console.log(`Foram removidos ${filteredCount} leads (Duplicados ou Fictícios).`);
            }

            if (leads.length > 0) {
                state.leadsBalance -= leads.length;
                if (state.leadsBalance < 0) state.leadsBalance = 0;
                localStorage.setItem('leads_balance', state.leadsBalance);
                
                updateApiStatusUI();
                updateResultsBadge(true);
                
                // Salva Localmente (Offline First)
                saveLeadsToLocal(leads, niche);
            } else {
                alert("A busca retornou resultados, mas todos já existiam no seu banco de dados ou eram inválidos.");
            }
        } else {
            updateResultsBadge(true); 
        }
    } else {
        // Modo Simulação (Mock)
        let rawMocks = generateMockLeads(niche, city, stateInput, limit);
        leads = rawMocks; 
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

// --- PERSISTÊNCIA ---

async function saveCurrentLeadsToDB() {
    if(state.leads.length === 0) return alert("Nenhum lead para salvar.");
    if(state.leads.some(l => l.isMock)) return alert("Atenção: Leads fictícios da simulação não podem ser salvos no banco.");

    if(!confirm(`Deseja salvar a lista?`)) return;

    const niche = state.lastSearch.niche || 'Lista Manual';
    const validLeads = await filterInvalidAndDuplicateLeads(state.leads);
    
    if (validLeads.length === 0) {
        return alert("Todos os leads desta lista já foram salvos anteriormente.");
    }

    // Salva Localmente (sempre)
    saveLeadsToLocal(validLeads, niche);
    
    // Tenta Nuvem (Sync) se possível, senão avisa
    if (navigator.onLine) {
        // O syncSystem pode ser chamado ou deixamos automático na ação do botão "Sincronizar"
        // Para manter consistência, salvamos local e avisamos.
        alert("Dados salvos localmente! Clique em 'Sync Nuvem' para fazer backup online.");
    } else {
        alert("Dados salvos OFFLINE. Sincronize quando tiver internet.");
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
        
        // Evitar duplicatas exatas
        const exists = currentData.some(d => d.name === leadToSave.name && d.phone === leadToSave.phone);
        if (!exists) {
            currentData.push({
                ...leadToSave,
                searchNiche: niche,
                leadStatus: lead.leadStatus || 'Novo',
                followUpNotes: lead.followUpNotes || '',
                createdAt: new Date().toISOString(),
                firestoreId: null // Marca como não sincronizado
            });
        }
    });
    localStorage.setItem(storageKey, JSON.stringify(currentData));
    console.log("Leads salvos localmente.");
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
    
    if (state.isShowingSaved) {
        // Atualiza Localmente
        const storageKey = `local_leads_${state.user.email}`;
        localStorage.setItem(storageKey, JSON.stringify(state.leads));

        // Se tiver ID da nuvem e estiver online, atualiza lá também
        if (lead.firestoreId && auth.currentUser) {
            db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).update({
                leadStatus: lead.leadStatus,
                followUpNotes: lead.followUpNotes
            }).catch(err => console.error("Erro update firestore", err));
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
            
            // Remove Local
            state.leads.splice(index, 1);
            const storageKey = `local_leads_${state.user.email}`;
            localStorage.setItem(storageKey, JSON.stringify(state.leads));

            // Remove Nuvem se existir
            if (lead.firestoreId && auth.currentUser) {
                db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).delete()
                .catch(err => console.error("Erro ao deletar na nuvem", err));
            }
        } else {
            state.leads.splice(index, 1);
        }
        applyFilters(); 
    }
}

// --- RENDERIZAÇÃO ---
function renderLeads(leadsToRender) {
    leadsBody.innerHTML = '';
    resultCount.innerText = leadsToRender.length;

    if (leadsToRender.length === 0) {
        leadsBody.innerHTML = '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';
        paginationControls.classList.add('hidden');
        return;
    }

    const totalPages = Math.ceil(leadsToRender.length / state.itemsPerPage);
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const paginatedLeads = leadsToRender.slice(start, end);

    paginatedLeads.forEach((lead) => {
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

        // Indicador de Sync (Nuvem ou Local)
        let syncIcon = '';
        if (state.isShowingSaved) {
            if (lead.firestoreId) {
                syncIcon = '<i class="fas fa-cloud" title="Sincronizado na Nuvem" style="color:var(--primary-color); margin-left:5px;"></i>';
            } else {
                syncIcon = '<i class="fas fa-save" title="Salvo apenas Localmente" style="color:var(--secondary-color); margin-left:5px;"></i>';
            }
        }
        
        row.innerHTML = `
            <td>
                <div class="lead-info-primary">
                    <span class="lead-name">${lead.name} ${syncIcon}</span>
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

// --- Modal de Mensagem ---
function openMessageModal(leadIndex) {
    const lead = state.leads[leadIndex];
    const modal = document.getElementById('message-modal');
    const textArea = document.getElementById('generated-message');
    const btnWhats = document.getElementById('btn-send-whatsapp');
    const selectTemplate = document.getElementById('modal-template-select');

    selectTemplate.innerHTML = '';
    state.templates.forEach(tpl => {
        const option = document.createElement('option');
        option.value = tpl.id;
        option.innerText = tpl.name + (tpl.isDefault ? ' (Padrão)' : '');
        if (tpl.isDefault) option.selected = true;
        selectTemplate.appendChild(option);
    });
    
    const currentDashboardText = document.getElementById('message-template-input').value;
    const customOption = document.createElement('option');
    customOption.value = 'custom_dashboard';
    customOption.innerText = '📝 Texto Editado na Tela Principal';
    selectTemplate.appendChild(customOption);

    const generateText = (templateContent) => {
        const nichoVal = lead.niche || "";
        const cidadeVal = lead.address ? lead.address.split(',')[0] : "sua cidade";
        const estadoVal = ""; 

        let message = templateContent
            .replace(/{nicho}/g, nichoVal)
            .replace(/{cidade}/g, cidadeVal)
            .replace(/{estado}/g, estadoVal);

        return message.replace(/\s+/g, ' ').trim();
    };

    selectTemplate.onchange = () => {
        let content = "";
        if (selectTemplate.value === 'custom_dashboard') {
            content = currentDashboardText;
        } else {
            const selectedTpl = state.templates.find(t => t.id === selectTemplate.value);
            content = selectedTpl ? selectedTpl.content : "";
        }
        textArea.value = generateText(content);
        updateWhatsAppLink(textArea.value);
    };

    const updateWhatsAppLink = (msg) => {
        const cleanPhone = lead.phone.replace(/\D/g, '');
        if (cleanPhone) {
            const phoneParam = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
            btnWhats.href = `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`;
            btnWhats.classList.remove('hidden');
        } else {
            btnWhats.href = "#";
            btnWhats.classList.add('hidden');
        }
    };
    
    textArea.oninput = () => updateWhatsAppLink(textArea.value);
    selectTemplate.onchange();
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
        // ALTERAÇÃO: Passa o Nome para o login
        login(document.getElementById('login-email').value, document.getElementById('login-password').value, document.getElementById('login-name').value);
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

    // Listener para o botão de Sync
    if(btnSyncData) {
        btnSyncData.onclick = syncSystem;
    }
}

function toggleAuthBox(type) {
    loginBox.classList.add('hidden');
    registerBox.classList.add('hidden');
    forgotBox.classList.add('hidden');
    if (type === 'login') loginBox.classList.remove('hidden');
    if (type === 'register') registerBox.classList.remove('hidden');
    if (type === 'forgot') forgotBox.classList.remove('hidden');
}
