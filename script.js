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

// --- HELPER INDEXEDDB ---
const dbHelper = {
    dbName: 'LeadsManagerDB',
    version: 1,
    db: null,

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                // Store para Usuários
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'email' });
                }
                
                // Store para Leads (Contatos)
                if (!db.objectStoreNames.contains('leads')) {
                    const store = db.createObjectStore('leads', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('userEmail', 'userEmail', { unique: false });
                    store.createIndex('phone', 'phone', { unique: false });
                }

                // Store para Configurações/Sessão
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Store para Templates
                if (!db.objectStoreNames.contains('templates')) {
                    db.createObjectStore('templates', { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            request.onerror = (e) => reject("Erro ao abrir DB: " + e.target.error);
        });
    },

    async add(storeName, data) {
        return this.transaction(storeName, 'readwrite', store => store.put(data));
    },

    async get(storeName, key) {
        return this.transaction(storeName, 'readonly', store => store.get(key));
    },

    async getAll(storeName) {
        return this.transaction(storeName, 'readonly', store => store.getAll());
    },

    async delete(storeName, key) {
        return this.transaction(storeName, 'readwrite', store => store.delete(key));
    },

    async getLeadsByUser(email) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB não inicializado");
            const tx = this.db.transaction('leads', 'readonly');
            const store = tx.objectStore('leads');
            const index = store.index('userEmail');
            const request = index.getAll(email);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB não inicializado");
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = callback(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async setSetting(key, value) {
        return this.add('settings', { key, value });
    },

    async getSetting(key) {
        const result = await this.get('settings', key);
        return result ? result.value : null;
    }
};

// --- Configurações Iniciais ---
const ADMIN_EMAIL = "jcnvap@gmail.com";
const DEFAULT_TEMPLATE_TEXT = "Olá, tudo bem? 👋\nNotei que você atua como {nicho} em {cidade} {estado} e identifiquei que o seu negócio possui um grande potencial para atrair mais clientes por meio de algumas ações estratégicas no ambiente digital.\nTrabalho ajudando profissionais do seu setor a gerar mais oportunidades e fortalecer a presença online. Posso te mostrar um exemplo simples, sem compromisso?";

const DEFAULT_TEMPLATES = [
    { id: 'default', name: 'Padrão do Sistema', content: DEFAULT_TEMPLATE_TEXT, isDefault: true }
];

// --- Estado da Aplicação ---
const state = {
    providerId: 'KEY_1', 
    apiKey: '', 
    leadsBalance: 0,
    user: null, 
    leads: [],
    lastSearch: { niche: '', city: '', state: '' },
    templates: [],
    challengeNumber: 0,
    currentLeadIndex: null,
    appMode: 'hybrid', 
    currentPage: 1,
    itemsPerPage: 10,
    isShowingSaved: false 
};

// Variável de controle para edição
let editingTemplateId = null; 

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

const registerModeSelect = document.getElementById('register-mode-select'); 
const btnBackup = document.getElementById('btn-backup');
const btnRestoreTrigger = document.getElementById('btn-restore-trigger');
const restoreFileInput = document.getElementById('restore-file-input');
const btnSaveDbDirect = document.getElementById('btn-save-db-direct');
const btnShowSavedLeads = document.getElementById('btn-show-saved-leads');
const paginationControls = document.getElementById('pagination-controls');
const resultsTitle = document.getElementById('results-title');
const btnSyncData = document.getElementById('btn-sync-data');

// --- Elementos para Importação ---
const btnImportXLSX = document.getElementById('btn-import-xlsx');
const importFileInput = document.getElementById('import-file-input');


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await dbHelper.open();
        await migrateLocalStorageToIndexedDB();
    } catch (e) {
        console.error("Falha fatal ao abrir IndexedDB:", e);
        alert("Erro ao carregar banco de dados local. Recarregue a página.");
        return;
    }

    state.providerId = (await dbHelper.getSetting('selected_provider_id')) || 'KEY_1';
    state.leadsBalance = parseInt((await dbHelper.getSetting('leads_balance'))) || 0;
    
    state.appMode = (await dbHelper.getSetting('app_mode')) || 'hybrid';
    
    const storageModeSelect = document.getElementById('app-storage-mode');
    if (storageModeSelect) {
        storageModeSelect.value = state.appMode;
    }

    if (state.providerId && API_KEYS_CONFIG[state.providerId]) {
        state.apiKey = API_KEYS_CONFIG[state.providerId];
    } else {
        state.apiKey = API_KEYS_CONFIG['KEY_1'];
    }

    const savedTemplates = await dbHelper.getAll('templates');
    state.templates = savedTemplates.length > 0 ? savedTemplates : DEFAULT_TEMPLATES;
    if(savedTemplates.length === 0) {
        await dbHelper.add('templates', DEFAULT_TEMPLATES[0]);
    }

    if (auth) {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                if (state.user) {
                    state.user.uid = user.uid;
                    state.user.source = state.appMode;
                } else {
                    state.user = {
                        name: user.displayName || user.email,
                        email: user.email,
                        uid: user.uid,
                        source: state.appMode
                    };
                }
                await dbHelper.setSetting('local_session_user', state.user);
                checkAuth();
            }
        });
    }

    const localSession = await dbHelper.getSetting('local_session_user');
    if (localSession && !state.user) {
        state.user = localSession;
        checkAuth();
    }

    setupEventListeners();
    setupFilterListeners();
    setupVisualFeedback(); 
    
    const savedMsg = await dbHelper.getSetting('current_draft_message');
    if (savedMsg) {
        messageTemplateInput.value = savedMsg;
    } else {
        loadDefaultMessage();
    }

    updateApiStatusUI();
    renderTemplatesList();
    updateSearchButtonState();
    updateUIByMode();
});

function updateUIByMode() {
    const appModeDisplay = document.getElementById('app-mode-display');
    if (appModeDisplay) {
        let label = ' (Híbrido)';
        if (state.appMode === 'local') label = ' (Local)';
        if (state.appMode === 'cloud') label = ' (Nuvem)';
        appModeDisplay.innerText = label;
    }

    if (state.appMode === 'hybrid') {
        btnSyncData.classList.remove('hidden');
    } else {
        btnSyncData.classList.add('hidden');
    }
}

async function saveStorageMode() {
    const select = document.getElementById('app-storage-mode');
    const newMode = select.value;
    
    state.appMode = newMode;
    await dbHelper.setSetting('app_mode', newMode);
    
    alert(`Modo de armazenamento alterado para: ${newMode.toUpperCase()}.\nAlgumas funcionalidades podem mudar.`);
    updateUIByMode();
    document.getElementById('config-modal').classList.add('hidden');
}

async function migrateLocalStorageToIndexedDB() {
    const migrated = localStorage.getItem('idb_migrated_v1');
    if (migrated) return;

    console.log("Iniciando migração para IndexedDB...");
    try {
        const localUsers = JSON.parse(localStorage.getItem('local_users_db') || '[]');
        for (const u of localUsers) {
            await dbHelper.add('users', u);
        }

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('local_leads_')) {
                const email = key.replace('local_leads_', '');
                const leads = JSON.parse(localStorage.getItem(key) || '[]');
                for (const l of leads) {
                    const leadToSave = { ...l, userEmail: email };
                    delete leadToSave.id; 
                    await dbHelper.add('leads', leadToSave);
                }
            }
        }

        const balance = localStorage.getItem('leads_balance');
        if (balance) await dbHelper.setSetting('leads_balance', balance);
        
        const provId = localStorage.getItem('selected_provider_id');
        if (provId) await dbHelper.setSetting('selected_provider_id', provId);

        localStorage.setItem('idb_migrated_v1', 'true');
        console.log("Migração concluída.");
    } catch (err) {
        console.error("Erro na migração:", err);
    }
}

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
        if(input.value) handleInput({ target: input });
    });
}

async function filterInvalidAndDuplicateLeads(newLeads) {
    let existingLeads = [];
    
    if (state.user) {
        if (state.appMode === 'cloud' && auth.currentUser) {
            if (state.isShowingSaved) existingLeads = state.leads;
        } else {
            existingLeads = await dbHelper.getLeadsByUser(state.user.email);
        }
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

function checkAuth() {
    if (state.user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        
        updateUIByMode(); 
        
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

async function login(email, password, name) {
    let userFound = await dbHelper.get('users', email);
    let loginSuccess = false;

    if (userFound && userFound.password === password) {
        if (name && name.trim() !== "" && (!userFound.name || userFound.name !== name)) {
            userFound.name = name;
            await dbHelper.add('users', userFound);
        }

        state.user = {
            name: userFound.name,
            email: userFound.email,
            uid: userFound.uid || 'local_' + Date.now(),
            source: 'local'
        };
        
        await dbHelper.setSetting('local_session_user', state.user);
        loginSuccess = true;
        
        if (auth) {
             auth.signInWithEmailAndPassword(email, password)
                 .then(async (cred) => {
                     state.user.uid = cred.user.uid;
                     state.user.source = state.appMode;
                     await dbHelper.setSetting('local_session_user', state.user);
                 })
                 .catch(err => console.log("Login Firebase bg falhou:", err));
        }
        
        checkAuth();
        return;
    }

    if (!loginSuccess) {
        if (!auth) return alert("Firebase não configurado.");
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const fbUser = userCredential.user;
            
            const finalName = name || fbUser.displayName || email.split('@')[0];

            if (name && fbUser.displayName !== name) {
                await fbUser.updateProfile({ displayName: name });
            }

            const newUserLocal = {
                name: finalName,
                email: email,
                password: password, 
                uid: fbUser.uid,
                mode: 'hybrid'
            };
            await dbHelper.add('users', newUserLocal);

            state.user = {
                name: finalName,
                email: email,
                uid: fbUser.uid,
                source: state.appMode
            };
            await dbHelper.setSetting('local_session_user', state.user);
            
            checkAuth();
        } catch (error) {
            alert("Erro no login: " + error.message);
        }
    }
}

async function register(name, email, password) {
    const existingUser = await dbHelper.get('users', email);
    
    // VERIFICAÇÃO SE USUÁRIO JÁ EXISTE LOCALMENTE
    if (existingUser) {
        if (!auth) return alert("Usuário já existe localmente (Modo Offline).");

        // Tenta criar na nuvem para verificar se existe lá
        auth.createUserWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                // SUCESSO: Usuário não existia na nuvem, foi criado agora.
                const uid = userCredential.user.uid;
                
                // 1. Atualiza dados locais
                existingUser.uid = uid;
                if (name) existingUser.name = name;
                await dbHelper.add('users', existingUser);
                
                // 2. Atualiza Perfil no Auth
                await userCredential.user.updateProfile({ displayName: name });

                // 3. CORREÇÃO: Cria o documento do usuário no Firestore (Banco de Dados)
                await db.collection('users').doc(uid).set({
                    name: name,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    source: 'sync_creation'
                });
                
                alert("Conta local encontrada. Sincronização com a nuvem realizada com sucesso!");
                toggleAuthBox('login');
            })
            .catch(async (error) => {
                if (error.code === 'auth/email-already-in-use') {
                    // ERRO: Usuário já existe na nuvem.
                    try {
                        const loginCred = await auth.signInWithEmailAndPassword(email, password);
                        // Sucesso no login: Vincula IDs
                        existingUser.uid = loginCred.user.uid;
                        await dbHelper.add('users', existingUser);
                        
                        // Garante que o documento existe no Firestore mesmo se já existia no Auth
                        await db.collection('users').doc(loginCred.user.uid).set({
                            name: name || existingUser.name,
                            email: email,
                            lastSync: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }); // Merge para não sobrescrever dados existentes
                        
                        alert("Usuário já existe em ambos. Contas vinculadas com sucesso!");
                        toggleAuthBox('login');
                    } catch (loginErr) {
                        alert("Usuário existe localmente e na nuvem, mas as credenciais não conferem. Impossível vincular automaticamente.");
                    }
                } else {
                    alert("Usuário existe localmente. Erro ao conectar com nuvem: " + error.message);
                }
            });
        return; // Interrompe o fluxo padrão de criação
    }

    // FLUXO PADRÃO PARA NOVOS USUÁRIOS (Sem registro local prévio)
    const newUser = {
        name: name,
        email: email,
        password: password,
        uid: 'local_' + Date.now(),
        mode: 'hybrid' 
    };
    await dbHelper.add('users', newUser);
    
    await dbHelper.setSetting('leads_balance', 50);
    state.leadsBalance = 50;

    if (auth) {
        auth.createUserWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                const uid = userCredential.user.uid;
                
                // 1. Atualiza UID local com o da nuvem
                newUser.uid = uid;
                await dbHelper.add('users', newUser);
                
                // 2. Atualiza Auth Profile
                await userCredential.user.updateProfile({ displayName: name });

                // 3. CORREÇÃO: Cria o documento do usuário no Firestore (Banco de Dados)
                await db.collection('users').doc(uid).set({
                    name: name,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    leadsBalance: 50 // Inicia saldo na nuvem também
                });

                alert("Conta criada com sucesso! Você pode fazer login.");
                toggleAuthBox('login');
            })
            .catch((error) => {
                if(error.code === 'auth/email-already-in-use') {
                    alert("Conta criada localmente. O e-mail já existia na nuvem. Faça login para sincronizar.");
                    toggleAuthBox('login');
                } else {
                    alert("Conta criada LOCALMENTE. Erro na nuvem: " + error.message);
                    toggleAuthBox('login');
                }
            });
    } else {
        alert("Conta local criada com sucesso!");
        toggleAuthBox('login');
    }
}
async function logout() {
    state.user = null;
    await dbHelper.delete('settings', 'local_session_user'); 
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

// --- SINCRONIZAÇÃO ROBUSTA ---
async function syncSystem() {
    if (!state.user) return alert("Faça login para sincronizar.");
    if (!navigator.onLine) return alert("Sem conexão com a internet.");

    const btn = document.getElementById('btn-sync-data');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    btn.disabled = true;

    try {
        if (!auth.currentUser) {
            const currentUserLocal = await dbHelper.get('users', state.user.email);
            
            if (currentUserLocal) {
                try {
                    await auth.signInWithEmailAndPassword(currentUserLocal.email, currentUserLocal.password);
                } catch (authErr) {
                    if (authErr.code === 'auth/user-not-found') {
                        await auth.createUserWithEmailAndPassword(currentUserLocal.email, currentUserLocal.password);
                        await auth.currentUser.updateProfile({ displayName: currentUserLocal.name });
                    } else if (authErr.code === 'auth/wrong-password') {
                        throw new Error("Conflito de senha na nuvem. Faça login manualmente.");
                    } else {
                        throw authErr;
                    }
                }
                if(auth.currentUser) state.user.uid = auth.currentUser.uid;
            }
        }

        const localLeads = await dbHelper.getLeadsByUser(state.user.email);
        
        let syncedCount = 0;
        let errorCount = 0;

        const leadsToSync = localLeads.filter(lead => !lead.firestoreId);

        if (leadsToSync.length === 0) {
            alert("Todos os leads locais já estão sincronizados!");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        for (const lead of leadsToSync) {
            try {
                const leadToSend = { ...lead };
                delete leadToSend.id; 
                delete leadToSend.isMock;
                
                Object.keys(leadToSend).forEach(key => {
                    if (leadToSend[key] === undefined) leadToSend[key] = null;
                });
                
                if (!leadToSend.createdAt) leadToSend.createdAt = firebase.firestore.FieldValue.serverTimestamp();

                const docRef = await db.collection('users').doc(state.user.uid).collection('leads').add(leadToSend);

                lead.firestoreId = docRef.id;
                await dbHelper.add('leads', lead);
                
                syncedCount++;

            } catch (err) {
                console.error(`Erro ao sincronizar lead ${lead.name}:`, err);
                errorCount++;
            }
        }

        let msg = `Sincronização concluída.\nEnviados com sucesso: ${syncedCount}`;
        if (errorCount > 0) {
            msg += `\nFalhas: ${errorCount} (Verifique conexão e tente novamente).`;
        }
        alert(msg);

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

async function resetAccess() {
    if (confirm("ADMIN: Deseja zerar o saldo de leads?")) {
        state.leadsBalance = 0; 
        await dbHelper.setSetting('leads_balance', 0);
        updateApiStatusUI();
        updateSearchButtonState();
        alert("Saldo zerado.");
    }
}

async function addAdminLeads() {
    if (confirm("ADMIN: Adicionar 10 leads ao saldo?")) {
        state.leadsBalance += 10;
        await dbHelper.setSetting('leads_balance', state.leadsBalance);
        updateApiStatusUI();
        updateSearchButtonState();
        alert("10 leads adicionados.");
    }
}

function loadDefaultMessage() {
    const defaultTpl = state.templates.find(t => t.isDefault) || state.templates[0];
    if (defaultTpl) {
        messageTemplateInput.value = defaultTpl.content;
        dbHelper.setSetting('current_draft_message', defaultTpl.content);
    }
}

async function saveNewTemplate() {
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
            await dbHelper.add('templates', state.templates[index]);
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
        await dbHelper.add('templates', newTpl);
        alert("Modelo salvo com sucesso!");
    }

    state.templates = await dbHelper.getAll('templates');
    nameInput.value = '';
    contentInput.value = '';
    
    renderTemplatesList();
}

async function editTemplate(id) {
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

async function deleteTemplate(id) {
    if (confirm("Deseja excluir este modelo?")) {
        await dbHelper.delete('templates', id);
        state.templates = state.templates.filter(t => t.id !== id);
        renderTemplatesList();
    }
}

async function setDefaultTemplate(id) {
    state.templates.forEach(t => t.isDefault = (t.id === id));
    for(const t of state.templates) {
        await dbHelper.add('templates', t);
    }
    
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
    await dbHelper.setSetting('selected_provider_id', selectedProvider);
    
    msg.innerText = "Preferência salva com sucesso! Adquira créditos abaixo para usar dados reais.";
    msg.style.color = "orange";
    
    updateApiStatusUI();
}

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

async function verifyChallenge() {
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
        await dbHelper.setSetting('leads_balance', state.leadsBalance);
        
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

// --- CARREGAR MEUS CONTATOS (ALTERADO PARA SUPORTAR MODOS) ---
async function loadMyContacts() {
    if (!state.user) return alert("Faça login para ver seus contatos.");

    // Reset UI
    leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando contatos... <i class="fas fa-spinner fa-spin"></i></td></tr>';
    resultsPanel.classList.remove('hidden');
    state.isShowingSaved = true;
    state.currentPage = 1; 
    
    resultsTitle.innerHTML = 'Meus Contatos <span class="badge-real">(Salvos)</span>: <span id="result-count">...</span>';
    dataSourceBadge.classList.add('hidden'); 

    let loadedLeads = [];

    // ALTERAÇÃO: Lógica de carregamento baseada no modo
    if (state.appMode === 'cloud') {
        if (!auth.currentUser) {
            alert("Modo Nuvem requer login ativo no Firebase.");
            leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Erro: Não conectado à nuvem.</td></tr>';
            return;
        }
        try {
            const snapshot = await db.collection('users').doc(auth.currentUser.uid).collection('leads').orderBy('createdAt', 'desc').get();
            loadedLeads = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
        } catch (e) {
            console.error("Erro ao buscar da nuvem:", e);
            alert("Erro ao buscar dados da nuvem.");
        }
    } else {
        // Modo Local ou Híbrido: Carrega do IndexedDB
        loadedLeads = await dbHelper.getLeadsByUser(state.user.email);
        
        // Fallback nuvem no modo Híbrido se local estiver vazio
        if (state.appMode === 'hybrid' && loadedLeads.length === 0 && auth && auth.currentUser) {
            try {
                const snapshot = await db.collection('users').doc(auth.currentUser.uid).collection('leads').get();
                const cloudLeads = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
                
                if (cloudLeads.length > 0) {
                    loadedLeads = cloudLeads;
                    for(const l of loadedLeads) {
                        l.userEmail = state.user.email;
                        const toSave = {...l};
                        delete toSave.id; 
                        await dbHelper.add('leads', toSave);
                    }
                }
            } catch (e) {
                console.log("Sem leads locais e sem conexão para baixar.");
            }
        }
    }

    state.leads = loadedLeads;
    populateNicheFilter(state.leads);
    applyFilters(); 
}

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
                await dbHelper.setSetting('leads_balance', state.leadsBalance);
                
                updateApiStatusUI();
                updateResultsBadge(true);
                
                if (state.appMode === 'cloud') {
                     // No modo Cloud, salva direto na nuvem, mas sem bloquear a UI se falhar
                     await saveLeadsToFirestore(leads, niche);
                } else {
                    // Local ou Híbrido: Salva no IndexedDB
                    await saveLeadsToLocal(leads, niche);
                }
            } else {
                alert("A busca retornou resultados, mas todos já existiam no seu banco de dados ou eram inválidos.");
            }
        } else {
            updateResultsBadge(true); 
        }
    } else {
        let rawMocks = generateMockLeads(niche, city, stateInput, limit);
        leads = rawMocks; 
        updateResultsBadge(false);
    }

    state.leads = leads;
    
    populateNicheFilter(leads);
    applyFilters(); 
}

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

// --- PERSISTÊNCIA (ALTERADO PARA SUPORTAR MODOS) ---

async function saveCurrentLeadsToDB() {
    if(state.leads.length === 0) return alert("Nenhum lead para salvar.");
    if(state.leads.some(l => l.isMock)) return alert("Atenção: Leads fictícios da simulação não podem ser salvos no banco.");

    if(!confirm(`Deseja salvar a lista?`)) return;

    const niche = state.lastSearch.niche || 'Lista Manual';
    const validLeads = await filterInvalidAndDuplicateLeads(state.leads);
    
    if (validLeads.length === 0) {
        return alert("Todos os leads desta lista já foram salvos anteriormente.");
    }

    if (state.appMode === 'cloud') {
        await saveLeadsToFirestore(validLeads, niche);
        alert("Dados salvos na NUVEM com sucesso!");
    } else if (state.appMode === 'local') {
        await saveLeadsToLocal(validLeads, niche);
        alert("Dados salvos LOCALMENTE (Modo Local).");
    } else {
        // Híbrido
        await saveLeadsToLocal(validLeads, niche);
        if (navigator.onLine) {
            alert("Dados salvos localmente! Clique em 'Sync Nuvem' para enviar ao Firebase.");
        } else {
            alert("Dados salvos OFFLINE. Sincronize quando tiver internet.");
        }
    }
}

async function saveLeadsToLocal(leads, niche) {
    if (!state.user) return;
    
    const currentData = await dbHelper.getLeadsByUser(state.user.email);
    
    for (const lead of leads) {
        const exists = currentData.some(d => d.name === lead.name && d.phone === lead.phone);
        if (!exists) {
            const leadToSave = {
                ...lead,
                userEmail: state.user.email,
                searchNiche: niche,
                leadStatus: lead.leadStatus || 'Novo',
                followUpNotes: lead.followUpNotes || '',
                createdAt: new Date().toISOString(),
                firestoreId: null
            };

            delete leadToSave._originalIndex;
            delete leadToSave.isMock;
            if (typeof leadToSave.id === 'string' && leadToSave.id.startsWith('mock')) delete leadToSave.id;

            await dbHelper.add('leads', leadToSave);
        }
    }
    console.log("Leads salvos no IndexedDB.");
}

// --- NOVA FUNÇÃO: Salvar Direto no Firestore (Modo Cloud) ---
async function saveLeadsToFirestore(leads, niche) {
    if (!state.user || !auth.currentUser) return alert("Erro: Login necessário para salvar na nuvem.");

    let savedCount = 0;
    const batch = db.batch(); 
    let operationCounter = 0;
    
    try {
        for (const lead of leads) {
            const docRef = db.collection('users').doc(auth.currentUser.uid).collection('leads').doc();
            
            const leadToSend = {
                ...lead,
                searchNiche: niche,
                leadStatus: lead.leadStatus || 'Novo',
                followUpNotes: lead.followUpNotes || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            delete leadToSend._originalIndex;
            delete leadToSend.isMock;
            delete leadToSend.id; 
            delete leadToSend.firestoreId;

            batch.set(docRef, leadToSend);
            operationCounter++;
            savedCount++;

            if (operationCounter >= 450) {
                await batch.commit();
                operationCounter = 0;
            }
        }

        if (operationCounter > 0) {
            await batch.commit();
        }
        
        console.log(`Leads salvos na nuvem: ${savedCount}`);
        
    } catch(e) {
        console.error("Erro ao salvar lead na nuvem:", e);
        if (e.code === 'permission-denied') {
            alert("Erro de Permissão: O banco de dados recusou a gravação.\nVerifique se as Regras de Segurança no Console do Firebase estão configuradas corretamente.");
        } else {
            alert("Erro ao salvar na nuvem: " + e.message);
        }
    }
}

async function backupData() {
    let leads = [];
    if(state.user) {
        leads = await dbHelper.getLeadsByUser(state.user.email);
    }
    const templates = await dbHelper.getAll('templates');
    const users = await dbHelper.getAll('users');

    const backupObj = {
        version: "2.0-idb",
        timestamp: new Date().toISOString(),
        userEmail: state.user ? state.user.email : 'anon',
        leadsBalance: await dbHelper.getSetting('leads_balance'),
        templates: templates,
        leads: leads,
        usersDb: users
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
    reader.onload = async function(e) {
        try {
            const backupObj = JSON.parse(e.target.result);
            if (confirm("Isso substituirá/mesclará seus dados locais atuais. Deseja continuar?")) {
                
                if(backupObj.leadsBalance) await dbHelper.setSetting('leads_balance', backupObj.leadsBalance);
                
                if(backupObj.templates && Array.isArray(backupObj.templates)) {
                    for(const t of backupObj.templates) {
                        await dbHelper.add('templates', t);
                    }
                }

                if(backupObj.usersDb && Array.isArray(backupObj.usersDb)) {
                    for(const u of backupObj.usersDb) {
                        await dbHelper.add('users', u);
                    }
                }
                
                if (backupObj.version === "2.0-idb" && Array.isArray(backupObj.leads)) {
                    for(const l of backupObj.leads) {
                        if(state.user && !l.userEmail) l.userEmail = state.user.email;
                        delete l.id; 
                        await dbHelper.add('leads', l);
                    }
                } else if (backupObj.leads && typeof backupObj.leads === 'string' && state.user) {
                    const parsedLeads = JSON.parse(backupObj.leads);
                    for(const l of parsedLeads) {
                        l.userEmail = state.user.email;
                        await dbHelper.add('leads', l);
                    }
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

// --- NOVA FUNÇÃO: Importar de XLSX ---
async function importFromXLSX(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    event.target.value = '';

    if (!file.name.endsWith('.xlsx')) {
        alert("Erro: O sistema aceita exclusivamente arquivos no formato .xlsx");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("O arquivo parece estar vazio ou em um formato incorreto.");
                return;
            }

            const newLeads = [];
            for (const row of jsonData) {
                const normalizedRow = {};
                for (const key in row) {
                    normalizedRow[key.toLowerCase().trim()] = row[key];
                }

                const lead = {
                    name: normalizedRow['nome da loja'] || '',
                    phone: String(normalizedRow['celular'] || ''),
                    address: normalizedRow['endereço'] || '',
                    niche: normalizedRow['nicho'] || '',
                    leadStatus: 'Novo',
                    website: null,
                    rating: null,
                    ratingCount: 0,
                    followUpNotes: 'Importado via XLSX'
                };
                newLeads.push(lead);
            }

            const niche = 'Importado XLSX';
            if (state.appMode === 'cloud') {
                await saveLeadsToFirestore(newLeads, niche);
            } else { 
                await saveLeadsToLocal(newLeads, niche);
            }

            alert(`Importação concluída com sucesso!\n${newLeads.length} registros foram importados.`);

            if (state.isShowingSaved) {
                loadMyContacts();
            }

        } catch (error) {
            console.error("Erro ao importar arquivo XLSX:", error);
            alert("Ocorreu um erro ao processar o arquivo. Verifique se o formato está correto e as colunas nomeadas como esperado (nome da loja, celular, endereço, nicho).");
        }
    };

    reader.onerror = (error) => {
        console.error("Erro ao ler o arquivo:", error);
        alert("Não foi possível ler o arquivo selecionado.");
    };

    reader.readAsArrayBuffer(file);
}


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

async function saveLeadDetails() {
    if (state.currentLeadIndex === null) return;
    
    const lead = state.leads[state.currentLeadIndex];
    lead.leadStatus = detailStatus.value;
    lead.followUpNotes = detailNotes.value;
    
    if (state.isShowingSaved) {
        if (state.appMode === 'cloud' && lead.firestoreId && auth.currentUser) {
            db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).update({
                leadStatus: lead.leadStatus,
                followUpNotes: lead.followUpNotes
            }).catch(err => console.error("Erro update firestore", err));
            alert("Alterações salvas na nuvem!");
        } else {
            if (lead.id) {
                await dbHelper.add('leads', lead);
            }
            
            if (state.appMode === 'hybrid' && lead.firestoreId && auth.currentUser) {
                db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).update({
                    leadStatus: lead.leadStatus,
                    followUpNotes: lead.followUpNotes
                }).catch(err => console.error("Erro update firestore", err));
            }
            alert("Alterações salvas!");
        }
        
        loadMyContacts();
    } else {
        alert("Alterações salvas na memória (lista temporária). Salve a lista para persistir.");
    }
    
    leadDetailsModal.classList.add('hidden');
    applyFilters();
}

async function deleteLead(index) {
    if (confirm("Tem certeza que deseja excluir este lead?")) {
        if (state.isShowingSaved) {
            const lead = state.leads[index];
            
            if (state.appMode === 'cloud' && lead.firestoreId && auth.currentUser) {
                db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).delete()
                    .catch(err => console.error("Erro ao deletar na nuvem", err));
            } else {
                if (lead.id) {
                    await dbHelper.delete('leads', lead.id);
                }
                
                if (state.appMode === 'hybrid' && lead.firestoreId && auth.currentUser) {
                    db.collection('users').doc(auth.currentUser.uid).collection('leads').doc(lead.firestoreId).delete()
                    .catch(err => console.error("Erro ao deletar na nuvem", err));
                }
            }

            state.leads.splice(index, 1);
        } else {
            state.leads.splice(index, 1);
        }
        applyFilters(); 
    }
}

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

        let syncIcon = '';
        if (state.isShowingSaved) {
            if (lead.firestoreId) {
                syncIcon = '<i class="fas fa-cloud" title="Sincronizado na Nuvem" style="color:var(--primary-color); margin-left:5px;"></i>';
            } else if (state.appMode === 'local') {
                syncIcon = '<i class="fas fa-hdd" title="Salvo Localmente" style="color:var(--secondary-color); margin-left:5px;"></i>';
            } else {
                syncIcon = '<i class="fas fa-save" title="Aguardando Sync" style="color:var(--warning-text); margin-left:5px;"></i>';
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
            isMock: true,
            id: 'mock_' + i + '_' + Date.now() 
        });
    }
    return leads;
}

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

// --- NOVA FUNÇÃO ---
// --- NOVA FUNÇÃO ---
async function cleanupNiches() {
    if (!confirm("Esta ação irá varrer seu banco de dados local para padronizar e preencher nichos vazios de 'Pet Shops' e 'Salões de Beleza' com base no nome do estabelecimento. Deseja continuar?")) {
        return;
    }

    try {
        const allLeads = await dbHelper.getAll('leads');
        if (allLeads.length === 0) {
            alert("Nenhum lead encontrado no banco de dados local para otimizar.");
            return;
        }

        let petCount = 0;
        let salaoCount = 0;
        let updatedCount = 0;

        // Listas de palavras-chave para cada nicho
        const petKeywords = ['pet', 'ração', 'animal', 'veterinári', 'banho e tosa', 'agropecuária'];
        const salaoKeywords = ['salão', 'salao', 'studio', 'cabeleireiro', 'beleza', 'hair', 'estética', 'esmalteria', 'sobrancelha'];


        for (const lead of allLeads) {
            let needsUpdate = false;
            const lowerCaseName = lead.name.toLowerCase();
            const currentNiche = lead.niche ? lead.niche.trim() : "";

            // 1. Verifica se o nicho está vazio ou nulo
            if (!currentNiche) {
                // Verifica palavras-chave de Salão de Beleza
                if (salaoKeywords.some(keyword => lowerCaseName.includes(keyword))) {
                    lead.niche = 'Salão de Beleza';
                    salaoCount++;
                    needsUpdate = true;
                }
                // Se não for salão, verifica palavras-chave de Pet Shop
                else if (petKeywords.some(keyword => lowerCaseName.includes(keyword))) {
                    lead.niche = 'Pet Shop';
                    petCount++;
                    needsUpdate = true;
                }
            }
            // 2. Se o nicho já existe, verifica se está correto (lógica anterior)
            else {
                // Usando 'else if' para evitar que um "Salão Pet" seja classificado duas vezes
                if (petKeywords.some(keyword => lowerCaseName.includes(keyword))) {
                    if (lead.niche !== 'Pet Shop') {
                        lead.niche = 'Pet Shop';
                        petCount++;
                        needsUpdate = true;
                    }
                } else if (salaoKeywords.some(keyword => lowerCaseName.includes(keyword))) {
                    if (lead.niche !== 'Salão de Beleza') {
                        lead.niche = 'Salão de Beleza';
                        salaoCount++;
                        needsUpdate = true;
                    }
                }
            }


            if (needsUpdate) {
                await dbHelper.add('leads', lead); // 'add' é um 'put', então vai atualizar
                updatedCount++;
            }
        }

        alert(`Otimização concluída!\n\n- ${salaoCount} registros definidos como "Salão de Beleza".\n- ${petCount} registros definidos como "Pet Shop".\n\nTotal de leads modificados: ${updatedCount}.`);

        // Recarrega a lista se o usuário estiver vendo os contatos salvos
        if (state.isShowingSaved) {
            loadMyContacts();
        }

    } catch (error) {
        console.error("Erro ao otimizar nichos:", error);
        alert("Ocorreu um erro durante a otimização. Verifique o console para mais detalhes.");
    }
}

function setupEventListeners() {
    document.getElementById('link-register').onclick = (e) => { e.preventDefault(); toggleAuthBox('register'); };
    document.getElementById('link-login-reg').onclick = (e) => { e.preventDefault(); toggleAuthBox('login'); };
    document.getElementById('link-forgot').onclick = (e) => { e.preventDefault(); toggleAuthBox('forgot'); };
    document.getElementById('link-login-forgot').onclick = (e) => { e.preventDefault(); toggleAuthBox('login'); };

    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
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

    if(btnShowSavedLeads) {
        btnShowSavedLeads.onclick = loadMyContacts;
    }

    messageTemplateInput.addEventListener('input', () => {
        dbHelper.setSetting('current_draft_message', messageTemplateInput.value);
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

    if (btnImportXLSX) {
        btnImportXLSX.onclick = () => importFileInput.click();
    }
    if (importFileInput) {
        importFileInput.onchange = importFromXLSX;
    }


    if(btnSyncData) {
        btnSyncData.onclick = syncSystem;
    }

    const btnSaveStorageMode = document.getElementById('btn-save-storage-mode');
    if (btnSaveStorageMode) {
        btnSaveStorageMode.onclick = saveStorageMode;
    }

    // LISTENER PARA O NOVO BOTÃO
    const btnCleanupNiches = document.getElementById('btn-cleanup-niches');
    if (btnCleanupNiches) {
        btnCleanupNiches.onclick = cleanupNiches;
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