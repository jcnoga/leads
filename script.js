/**
 * GERADOR DE LEADS PROFISSIONAL
 * Lógica da Aplicação Atualizada
 */

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
// SUBSTITUA COM SUAS CHAVES REAIS DO FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// --- Configurações Iniciais ---
const API_VALIDITY_DAYS = 30;
const ADMIN_EMAIL = "jcnvap@gmail.com";
const DEFAULT_TEMPLATE_TEXT = "Olá, tudo bem? 👋\nNotei que você atua como {nicho} em {cidade} {estado} e identifiquei que o seu negócio possui um grande potencial para atrair mais clientes por meio de algumas ações estratégicas no ambiente digital.\nTrabalho ajudando profissionais do seu setor a gerar mais oportunidades e fortalecer a presença online. Posso te mostrar um exemplo simples, sem compromisso?";

const DEFAULT_TEMPLATES = [
    { id: 'default', name: 'Padrão do Sistema', content: DEFAULT_TEMPLATE_TEXT, isDefault: true }
];

// --- Estado da Aplicação ---
const state = {
    apiKey: localStorage.getItem('serper_api_key') || '',
    apiExpiry: localStorage.getItem('serper_api_expiry') || null,
    user: null, // Será preenchido pelo Firebase Auth
    leads: [],
    lastSearch: { niche: '', city: '', state: '' },
    templates: JSON.parse(localStorage.getItem('msg_templates')) || DEFAULT_TEMPLATES,
    challengeNumber: 0
};

// --- Inicializa Firebase ---
let auth;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
} catch (e) {
    console.error("Erro ao inicializar Firebase. Verifique a configuração.", e);
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
const apiExpiryDateSpan = document.getElementById('api-expiry-date');

const leadsBody = document.getElementById('leads-body');
const resultsPanel = document.getElementById('results-panel');
const resultCount = document.getElementById('result-count');
const messageTemplateInput = document.getElementById('message-template-input');
const btnAdminReset = document.getElementById('btn-admin-reset');
const btnSearchLeads = document.getElementById('btn-search-leads');
const dataSourceBadge = document.getElementById('data-source-badge');

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Monitora estado do Firebase Auth
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
    
    // Carrega template salvo ou padrão
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

// --- Autenticação (Firebase) ---
function checkAuth() {
    if (state.user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        document.getElementById('user-name-display').innerText = state.user.name;
        
        // Verifica se é admin
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
            // Atualiza nome do usuário
            return userCredential.user.updateProfile({
                displayName: name
            });
        })
        .then(() => {
            alert("Conta criada com sucesso!");
            toggleAuthBox('login');
        })
        .catch((error) => {
            alert("Erro no cadastro: " + error.message);
        });
}

function logout() {
    if (auth) {
        auth.signOut();
    }
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
    if (confirm("ADMIN: Tem certeza que deseja zerar a validade da licença?")) {
        state.apiExpiry = 0; 
        localStorage.removeItem('serper_api_expiry');
        updateApiStatusUI();
        updateSearchButtonState();
        alert("Acesso zerado. A API agora consta como expirada.");
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
    
    // Limpar campos
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

// --- Validação e Gerenciamento da API ---
function isApiExpired() {
    // Se não tem chave ou não tem data de validade definida, considera "expirado/inativo"
    if (!state.apiKey) return true; 
    if (!state.apiExpiry) return true; 
    const now = new Date().getTime();
    return now > parseInt(state.apiExpiry);
}

function updateSearchButtonState() {
    const isExpired = isApiExpired();
    
    if (isExpired) {
        // Agora o botão PERMANECE ATIVO, mas com aviso visual de "Modo Simulado"
        // removemos a classe btn-disabled-red e o disabled = true da versão anterior
        btnSearchLeads.disabled = false;
        btnSearchLeads.classList.remove('btn-disabled-red');
        btnSearchLeads.innerHTML = '<i class="fas fa-search"></i> Buscar Leads (Modo Simulação)';
    } else {
        btnSearchLeads.disabled = false;
        btnSearchLeads.classList.remove('btn-disabled-red');
        btnSearchLeads.innerHTML = '<i class="fas fa-search"></i> Buscar Leads';
    }
}

function updateApiStatusUI() {
    // Esconde todos
    apiStatusWarning.classList.add('hidden');
    apiStatusSuccess.classList.add('hidden');
    apiStatusExpired.classList.add('hidden');
    document.getElementById('revalidation-area').classList.add('hidden');

    if (!state.apiKey) {
        apiStatusWarning.classList.remove('hidden');
        return;
    }

    if (isApiExpired()) {
        apiStatusExpired.classList.remove('hidden');
        document.getElementById('revalidation-area').classList.remove('hidden'); 
    } else {
        apiStatusSuccess.classList.remove('hidden');
        const expiryDate = new Date(parseInt(state.apiExpiry));
        apiExpiryDateSpan.innerText = expiryDate.toLocaleDateString();
        // Mantém a área de revalidação disponível caso queira renovar
        document.getElementById('revalidation-area').classList.remove('hidden'); 
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

    // Teste real na API
    const isValid = await testApiKey(key);

    if (isValid) {
        state.apiKey = key;
        localStorage.setItem('serper_api_key', key);
        
        // AQUI A MUDANÇA: Apenas salva, NÃO concede 30 dias.
        // O usuário deve usar a seção de "Liberação de Acesso"
        
        msg.innerText = "Chave salva com sucesso! Utilize a área abaixo para liberar os 30 dias de acesso.";
        msg.style.color = "orange";
        
        updateApiStatusUI();
    } else {
        msg.innerText = "Chave Inválida ou erro de conexão. Verifique e tente novamente.";
        msg.style.color = "red";
        alert("A chave informada não é válida na API de Busca.");
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
        console.error(error);
        return false;
    }
}

// --- Revalidação Matemática ---
function generateChallenge() {
    state.challengeNumber = Math.floor(Math.random() * 901) + 100;
    document.getElementById('challenge-number').innerText = state.challengeNumber;
    document.getElementById('challenge-response').value = '';
}

function verifyChallenge() {
    const userResponse = parseInt(document.getElementById('challenge-response').value);
    const expected = (state.challengeNumber + 13) * 9 + 1954;

    if (userResponse === expected) {
        alert("Contra-senha correta! Acesso liberado por 30 dias.");
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + API_VALIDITY_DAYS);
        state.apiExpiry = expiryDate.getTime();
        localStorage.setItem('serper_api_expiry', state.apiExpiry);
        
        updateApiStatusUI();
        document.getElementById('config-modal').classList.add('hidden');
    } else {
        alert("Contra-senha incorreta. Tente novamente.");
    }
}

// --- Lógica de Busca de Leads ---
async function searchLeads(event) {
    event.preventDefault();
    
    const niche = document.getElementById('niche').value;
    const city = document.getElementById('city').value;
    const stateInput = document.getElementById('state').value;
    const limit = document.getElementById('limit').value;

    state.lastSearch = { niche, city, state: stateInput };

    const query = `${niche} em ${city} ${stateInput}`.trim();
    leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Buscando leads... <i class="fas fa-spinner fa-spin"></i></td></tr>';
    resultsPanel.classList.remove('hidden');

    let leads = [];

    // Lógica principal: Verifica se tem chave E se não expirou
    if (state.apiKey && !isApiExpired()) {
        leads = await fetchRealLeads(query, limit);
        updateResultsBadge(true); // Dados Reais
    } else {
        // Se não tem chave OU está expirada -> Dados Fictícios
        leads = generateMockLeads(niche, city, stateInput, limit);
        updateResultsBadge(false); // Dados Simulados
        
        // Notificação opcional
        if (state.apiKey && isApiExpired()) {
            console.log("Licença não ativa. Exibindo dados simulados.");
        }
    }

    state.leads = leads;
    renderLeads(leads);
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
                rating: place.rating
            }));
        } else {
            return [];
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao conectar com a API de Busca. Verifique se sua chave ainda é válida.');
        return [];
    }
}

// --- Gerador de Dados Fictícios ---
function generateMockLeads(niche, city, uf, count) {
    const leads = [];
    const suffixes = ['Soluções', 'Associados', 'Consultoria', 'Comércio', 'Services', 'Ltda'];
    
    for (let i = 0; i < count; i++) {
        const fakeName = `${niche} ${suffixes[Math.floor(Math.random() * suffixes.length)]} ${i + 1}`;
        const fakePhone = `(34) 9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`;
        const location = city ? `${city} - ${uf}` : `Cidade Exemplo - ${uf || 'BR'}`;
        
        leads.push({
            name: fakeName,
            niche: niche,
            address: location,
            phone: fakePhone,
            website: `https://www.exemplo${i}.com.br`,
            rating: (Math.random() * 2 + 3).toFixed(1)
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
        
        const siteLink = lead.website 
            ? `<a href="${lead.website}" target="_blank"><i class="fas fa-external-link-alt"></i> Visitar</a>` 
            : '<span class="text-muted">-</span>';

        const whatsappLink = lead.phone !== 'Não informado' 
            ? `<button class="btn-action" onclick="openMessageModal(${index})"><i class="fab fa-whatsapp"></i> Abordar</button>`
            : '<span class="text-muted">Sem fone</span>';

        row.innerHTML = `
            <td><strong>${lead.name}</strong></td>
            <td>${lead.niche}</td>
            <td>${lead.address}</td>
            <td>${lead.phone}</td>
            <td>${siteLink}</td>
            <td>${whatsappLink}</td>
        `;
        leadsBody.appendChild(row);
    });
}

// --- Gerador de Mensagens Dinâmico ---
function openMessageModal(leadIndex) {
    const lead = state.leads[leadIndex];
    const modal = document.getElementById('message-modal');
    const textArea = document.getElementById('generated-message');
    const btnWhats = document.getElementById('btn-send-whatsapp');

    // Usa o template que está no campo da tela principal (já editado pelo usuário)
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

// --- Funções de Exportação ---
function exportToCSV() {
    if (state.leads.length === 0) { alert("Não há dados para exportar."); return; }

    const headers = ["Nome do Negócio", "Nicho", "Endereço", "Telefone", "Site", "Rating"];
    const rows = state.leads.map(lead => [
        `"${lead.name}"`, `"${lead.niche}"`, `"${lead.address}"`, `"${lead.phone}"`, `"${lead.website || ''}"`, `"${lead.rating || ''}"`
    ]);

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\r\n";
    rows.forEach(row => csvContent += row.join(",") + "\r\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_${state.lastSearch.niche}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToXLSX() {
    if (state.leads.length === 0) { alert("Não há dados para exportar."); return; }

    const dataForSheet = state.leads.map(lead => ({
        "Nome do Negócio": lead.name,
        "Nicho": lead.niche,
        "Endereço": lead.address,
        "Telefone": lead.phone,
        "Site": lead.website || "",
        "Avaliação": lead.rating || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `leads_${state.lastSearch.niche}_${Date.now()}.xlsx`);
}

// --- Gerenciamento de Eventos UI ---
function setupEventListeners() {
    // Auth
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

    // Search
    document.getElementById('lead-search-form').onsubmit = searchLeads;

    // Persistência template
    messageTemplateInput.addEventListener('input', () => {
        localStorage.setItem('current_draft_message', messageTemplateInput.value);
    });

    // Modals & Config
    document.getElementById('btn-config').onclick = () => {
        document.getElementById('api-key-input').value = state.apiKey;
        document.getElementById('config-modal').classList.remove('hidden');
        updateApiStatusUI();
    };
    document.querySelector('.close-modal').onclick = () => document.getElementById('config-modal').classList.add('hidden');
    document.querySelector('.close-modal-msg').onclick = () => document.getElementById('message-modal').classList.add('hidden');

    document.getElementById('save-api-key').onclick = validateAndSaveApiKey;
    document.getElementById('btn-admin-reset').onclick = resetAccess;
    
    // Config Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Revalidation Logic
    document.getElementById('btn-revalidate-trigger').onclick = () => {
        document.getElementById('btn-config').click();
    };
    document.getElementById('btn-generate-challenge').onclick = generateChallenge;
    document.getElementById('btn-verify-challenge').onclick = verifyChallenge;

    // Template Actions
    document.getElementById('btn-save-template').onclick = saveNewTemplate;
    document.getElementById('btn-load-default-msg').onclick = loadDefaultMessage;

    // Messages & Exports
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