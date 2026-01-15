const firebaseConfig = {
    apiKey: "AIzaSyB30QPE40atu__s4z3WlDBXHaryIE6asfE",
    authDomain: "consultor-3016e.firebaseapp.com",
    projectId: "consultor-3016e",
    storageBucket: "consultor-3016e.appspot.com",
    messagingSenderId: "819781871365",
    appId: "1:819781871365:web:a13d6930c8738a69af396c",
    measurementId: "G-C86JBXTK16"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- LÓGICA DA APLICAÇÃO ---

const app = document.getElementById('app');
const loginSection = document.getElementById('login-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const resetPasswordForm = document.getElementById('reset-password-form');
const forgotPasswordLink = document.querySelector('.forgot-password');
const toggleFormsLinks = document.querySelectorAll('.toggle-form');
const companyNameEl = document.getElementById('company-name');
const logoutBtn = document.getElementById('logoutBtn');
const saveDataBtn = document.getElementById('save-data');
const yearSelector = document.getElementById('year-selector');
const mainNav = document.getElementById('main-nav');
const tabContents = document.querySelectorAll('.tab-content');
const recalculateAnnualBtn = document.getElementById('recalculate-annual');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const exportPdfMonthlyBtn = document.getElementById('export-pdf-monthly');
const exportExcelMonthlyBtn = document.getElementById('export-excel-monthly');
const recalculateAllBtn = document.getElementById('recalculate-all');
const saveSettingsBtn = document.getElementById('save-settings');
const allowManualEditCheckbox = document.getElementById('allow-manual-edit');
const btnResetPopulateDemo = document.getElementById('btn-reset-populate-demo'); // Botão Reset+Simulação

// Botões de Relatório
const btnFullReport = document.getElementById('btn-full-report');
const btnExportDaily = document.getElementById('btn-export-daily');
const btnExportCompany = document.getElementById('btn-export-company');
const btnExportMonthlyInputs = document.getElementById('btn-export-monthly-inputs');
const btnExportAnnual = document.getElementById('btn-export-annual');
const btnExportEvolution = document.getElementById('btn-export-evolution');
const btnExportGlossary = document.getElementById('btn-export-glossary');
const btnExportConsultant = document.getElementById('btn-export-consultant');

// Botões XLSX (Novos)
const btnExportCompanyXLSX = document.getElementById('btn-export-company-xlsx');
const btnImportCompanyXLSX = document.getElementById('btn-import-company-xlsx');
const btnExportDailyXLSX = document.getElementById('btn-export-daily-xlsx');
const btnImportDailyXLSX = document.getElementById('btn-import-daily-xlsx');
const btnExportMonthlyXLSX = document.getElementById('btn-export-monthly-xlsx');
const btnImportMonthlyXLSX = document.getElementById('btn-import-monthly-xlsx');
const btnExportAnnualXLSX = document.getElementById('btn-export-annual-xlsx');
const btnExportEvolutionXLSX = document.getElementById('btn-export-evolution-xlsx');

// Botões de Backup
const btnBackupLocal = document.getElementById('btn-backup-local');
const btnRestoreLocal = document.getElementById('btn-restore-local');
const inputRestoreFile = document.getElementById('input-restore-file');

// Elementos da aba Diária
const dailyEntryForm = document.getElementById('daily-entry-form');
const dailyMonthSelector = document.getElementById('daily-month-selector');
const dailyMessageEl = document.getElementById('daily-message');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Elementos da aba Diagnóstico
const diagnosisForm = document.getElementById('diagnosis-form');

// Elementos da Nova Aba Consultor
const saveConsultantDiagnosisBtn = document.getElementById('save-consultant-diagnosis');
const consultantDiagnosisText = document.getElementById('consultant-diagnosis-text');

// Elementos de Desbloqueio e Acesso
const btnGenerateUnlockCode = document.getElementById('btn-generate-unlock-code');
const generatedCodeDisplay = document.getElementById('generated-code-display');
const btnTestAccess = document.getElementById('btn-test-access');
const btnResetAuth = document.getElementById('btn-reset-auth');
const accessStatusDisplay = document.getElementById('access-status-display');
const statusText = document.getElementById('status-text');
const expirationText = document.getElementById('expiration-text');
const daysLeftText = document.getElementById('days-left-text');

// Elementos da Área de Informação de Campos
const monthlyFieldInfoBox = document.getElementById('monthly-field-info');
const monthlyFieldText = document.getElementById('monthly-field-text');

// --- ESTADO DA APLICAÇÃO ---
let currentUser = null;
let currentYear = new Date().getFullYear();
let financialData = {};
let userSettings = {};
let currentlyEditingIndex = null;
const DEFAULT_COMPANY_NAME = 'Noga Consultoria'; 
const ADMIN_EMAIL = 'jcnvap@gmail.com'; 
const DEFAULT_TRIAL_DAYS = 0; 

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const INPUT_FIELDS = [
    'faturamento', 'numeroDeVendas', 'custosVariaveis', 'custosFixos', 'despesasOperacionais', 'depreciacao',
    'outrasReceitasDespesas', 'investimentos', 'financiamentosEntradas', 'amortizacaoDividas', 'aporteSocios',
    'distribuicaoLucros', 'impostos'
];

const FIELD_DESCRIPTIONS = {
    'faturamento': 'Receita bruta total obtida com a venda de produtos ou prestação de serviços no mês.',
    'numeroDeVendas': 'Quantidade total de transações comerciais (pedidos ou contratos) realizadas no mês.',
    'custosVariaveis': 'Gastos que aumentam ou diminuem conforme o volume de vendas (ex: matéria-prima, comissões).',
    'custosFixos': 'Gastos recorrentes que independem das vendas (ex: aluguel, salários administrativos, internet).',
    'despesasOperacionais': 'Gastos necessários para manter a operação, mas não ligados diretamente à produção (ex: marketing, escritório).',
    'depreciacao': 'Perda de valor mensal de equipamentos e bens da empresa (não é uma saída de caixa real).',
    'outrasReceitasDespesas': 'Entradas ou saídas atípicas, como rendimentos financeiros, multas ou venda de bens usados.',
    'investimentos': 'Saída de caixa para aquisição de ativos duráveis (CAPEX), como máquinas, veículos ou reformas.',
    'financiamentosEntradas': 'Dinheiro que entrou no caixa proveniente de empréstimos bancários ou financiamentos.',
    'amortizacaoDividas': 'Saída de caixa destinada ao pagamento do valor principal de empréstimos e dívidas.',
    'aporteSocios': 'Dinheiro injetado no caixa da empresa pelos próprios sócios ou investidores.',
    'distribuicaoLucros': 'Saída de caixa para pagamento de dividendos ou lucros aos sócios.',
    'impostos': 'Total de tributos pagos sobre o faturamento ou lucro (ex: DAS, ICMS, ISS, IRPJ).'
};

const GLOSSARY_DATA = {
    faturamento: {nome: "Faturamento", formula: "Preço de Venda × Quantidade Vendida", significado: "Valor total das vendas de produtos ou serviços em um período, antes de qualquer dedução.", exemplo: "Vender 100 produtos a R$50 cada gera um faturamento de R$5.000.", dica: "Aumente o faturamento com estratégias de marketing, diversificação de produtos ou ajuste de preços."},
    faturamentoMedio: {nome: "Faturamento Bruto Médio", formula: "Faturamento Anual Total / 12", significado: "A média mensal do seu faturamento bruto durante o ano. Ajuda a entender a sazonalidade e o desempenho de vendas consistente.", dica: "Compare a média com os meses individuais para identificar seus melhores períodos de venda e planejar campanhas."},
    volumeVendasMedio: {nome: "Volume de Vendas Médio", formula: "Número de Vendas Anual Total / 12", significado: "O número médio de vendas realizadas por mês. Indica a sua capacidade de atrair e converter clientes.", dica: "Se o volume médio for baixo, foque em estratégias de marketing para atrair mais clientes ou em otimizar sua taxa de conversão."},
    custosVariaveis: {nome: "Custos Variáveis (CV)", formula: "Custo por Unidade × Quantidade Vendida", significado: "Custos que variam diretamente com o volume de produção ou vendas, como matéria-prima e comissões.", exemplo: "Se o custo da matéria-prima de um produto é R$10, e você vende 100, seu CV é de R$1.000.", dica: "Negocie com fornecedores e otimize a produção para reduzir os custos variáveis por unidade."},
    custosFixos: {nome: "Custos Fixos (CF)", formula: "Soma dos custos que não variam com a produção", significado: "Custos que a empresa tem todo mês, independentemente de vender muito ou pouco, como aluguel e salários fixos.", exemplo: "Aluguel do escritório de R$2.000 e folha de pagamento de R$8.000 somam R$10.000 de custos fixos.", dica: "Revise periodicamente seus custos fixos para identificar oportunidades de redução sem impactar a operação."},
    lucroBruto: {nome: "Lucro Bruto", formula: "Faturamento - Custos Variáveis", significado: "Dinheiro que sobra das vendas após subtrair os custos diretos para produzir ou adquirir o que foi vendido.", exemplo: "Faturamento de R$10.000 e CV de R$4.000 resultam em Lucro Bruto de R$6.000.", dica: "É o primeiro indicador de rentabilidade do seu produto ou serviço."},
    markup: {nome: "Markup Divisor", formula: "((Faturamento - CV) / CV) × 100", significado: "Índice que mostra o quanto seu preço de venda está acima do custo variável do produto.", exemplo: "Custo de R$50 e venda por R$120 resulta em Markup de 140%.", dica: "Use o markup como base para sua estratégia de precificação, garantindo que ele cubra todos os custos e o lucro."},
    lucroOperacional: {nome: "Lucro Operacional", formula: "Lucro Bruto - Custos Fixos - Despesas Operacionais", significado: "Lucro gerado exclusivamente pela operação principal da empresa, antes de impostos e juros.", exemplo: "Lucro Bruto de R$6.000, com CF de R$3.000, resulta em Lucro Operacional de R$3.000.", dica: "Um lucro operacional positivo mostra que a atividade principal da sua empresa é rentável."},
    lucroLiquido: {nome: "Lucro Líquido", formula: "Lucro Operacional +/- Outras Receitas/Despesas - Impostos", significado: "O resultado final da empresa após todas as deduções. É o que realmente sobra para os sócios.", exemplo: "Lucro Operacional de R$3.000 menos R$500 de impostos resulta em Lucro Líquido de R$2.500.", dica: "É a métrica final de sucesso financeiro do negócio em um período."},
    margemLiquida: {nome: "Margem Líquida (%)", formula: "(Lucro Líquido / Faturamento) × 100", significado: "A porcentagem de cada real de faturamento que se transforma em lucro líquido.", exemplo: "Lucro de R$2.500 em um faturamento de R$10.000 resulta em uma margem de 25%.", dica: "Compare sua margem líquida com a média do seu setor para avaliar a competitividade."},
    pontoEquilibrio: {nome: "Ponto de Equilíbrio", formula: "Custos Fixos / (1 - (Custos Variáveis / Faturamento))", significado: "O valor mínimo de faturamento necessário para cobrir todos os custos, onde o lucro é zero.", exemplo: "Se seus custos fixos são R$5.000 e seus custos variáveis representam 60% do faturamento, seu Ponto de Equilíbrio é R$12.500.", dica: "Conhecer seu ponto de equilíbrio é vital para definir metas de vendas realistas e garantir a sobrevivência do negócio."},
    ticketMedio: {nome: "Ticket Médio", formula: "Faturamento Total / Número de Vendas", significado: "Valor médio que cada cliente gasta por compra.", exemplo: "Faturamento de R$10.000 com 100 vendas resulta em um Ticket Médio de R$100.", dica: "Crie combos, ofereça produtos complementares (cross-sell) e versões melhores (upsell) para aumentar o ticket médio."},
    depreciacao: {nome: "Depreciação", formula: "(Custo do Ativo - Valor Residual) / Vida Útil", significado: "É a perda de valor de um ativo (máquina, veículo) ao longo do tempo. É uma despesa que não representa saída de caixa.", exemplo: "Uma máquina de R$50.000 com vida útil de 5 anos deprecia R$10.000 por ano.", dica: "A depreciação reduz o lucro tributável, gerando economia de impostos, e é somada de volta no cálculo do fluxo de caixa."},
    fluxoCaixaOperacional: {nome: "Fluxo de Caixa Operacional (FCO)", formula: "Lucro Líquido + Depreciação", significado: "Mede o caixa efetivamente gerado pelas operações principais do negócio. É o coração financeiro da empresa.", exemplo: "Lucro de R$8.500 + Depreciação de R$1.000 = FCO de R$9.500.", dica: "Um FCO consistentemente positivo e crescente indica uma operação saudável e eficiente."},
    fluxoCaixaInvestimentos: {nome: "Fluxo de Caixa de Investimentos (FCI)", formula: "(-) Aquisição de Ativos (+) Venda de Ativos", significado: "Mostra o caixa utilizado na compra (CAPEX) ou gerado na venda de ativos de longo prazo, como máquinas e imóveis.", exemplo: "A compra de uma máquina por R$20.000 gera um FCI de -R$20.000.", dica: "Um FCI negativo indica que a empresa está investindo em seu crescimento futuro."},
    fluxoCaixaFinanciamentos: {nome: "Fluxo de Caixa de Financiamentos (FCF)", formula: "Novos Empréstimos - Pagamento de Dívidas + Aportes de Sócios - Distribuição de Lucros", significado: "Reflete as transações de caixa com proprietários (sócios) e credores (bancos).", exemplo: "Pegou R$30.000 de empréstimo e pagou R$5.000 aos sócios = FCF de +R$25.000.", dica: "Ajuda a entender como a empresa está financiando suas operações e seu crescimento."},
    fluxoCaixaLivre: {nome: "Fluxo de Caixa Livre (FCL)", formula: "FCO + FCI + FCF", significado: "A variação total de caixa no período. É a métrica mais importante para a saúde financeira de curto prazo.", exemplo: "FCO de R$9.500 + FCI de -R$20.000 + FCF de R$25.000 = FCL de +R$14.500.", dica: "Um FCL positivo significa que a empresa gerou mais caixa do que gastou, aumentando sua reserva financeira."}
};

// --- FUNÇÕES DE LÓGICA ---

function initialize() {
    auth.signOut().then(() => {
        auth.onAuthStateChanged(handleAuthStateChange);
    });
}

async function handleAuthStateChange(user) {
    try {
        if (user) {
            currentUser = user;
            [financialData, userSettings] = await Promise.all([
                loadDataFromFirestore(user.uid, 'financialData'),
                loadDataFromFirestore(user.uid, 'userSettings')
            ]);
            showApp();
        } else {
            currentUser = null;
            showLogin();
        }
    } catch (error) { console.error("Erro crítico na autenticação:", error); showLogin(); }
}

function handleLogin(e) { 
    e.preventDefault(); 
    
    // CORREÇÃO: Evita que o login seja processado se o formulário estiver oculto (ex: usuário tentando cadastrar)
    if (loginForm.style.display === 'none') return;

    const email = document.getElementById('login-user').value; 
    const pass = document.getElementById('login-password').value; 
    const errorEl = document.getElementById('login-error'); 
    errorEl.textContent = ''; 
    auth.signInWithEmailAndPassword(email, pass).catch(error => { errorEl.textContent = "Email ou senha inválidos."; }); 
}

function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-user').value;
    const company = document.getElementById('register-company').value;
    const pass = document.getElementById('register-password').value;
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    
    auth.createUserWithEmailAndPassword(email, pass)
        .then(userCredential => {
            const now = new Date();
            const expirationDate = new Date();
            expirationDate.setDate(now.getDate() + DEFAULT_TRIAL_DAYS);

            return db.collection('users').doc(userCredential.user.uid).set({ 
                email: userCredential.user.email, 
                company: company || DEFAULT_COMPANY_NAME, 
                createdAt: firebase.firestore.FieldValue.serverTimestamp() 
            }).then(() => {
                return db.collection('userSettings').doc(userCredential.user.uid).set({
                    corporateName: company || DEFAULT_COMPANY_NAME,
                    accessExpiration: expirationDate.toISOString(),
                    lastAccess: now.toISOString()
                }, { merge: true });
            });
        })
        .then(() => { 
            alert(`Cadastro realizado com sucesso! Acesso liberado conforme regra do sistema (${DEFAULT_TRIAL_DAYS} dias).`); 
            toggleForms('login'); 
        })
        .catch(error => {
            switch (error.code) {
                case 'auth/email-already-in-use': errorEl.textContent = "Este email já está cadastrado."; break;
                case 'auth/weak-password': errorEl.textContent = "A senha deve ter no mínimo 6 caracteres."; break;
                case 'auth/invalid-email': errorEl.textContent = "O formato do email é inválido."; break;
                default: errorEl.textContent = "Erro no cadastro. Verifique a config do Firebase."; console.error("Erro:", error); break;
            }
        });
}

function handlePasswordReset(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const messageEl = document.getElementById('reset-message');
    messageEl.textContent = 'Enviando...';
    messageEl.className = '';
    auth.sendPasswordResetEmail(email)
        .then(() => { messageEl.textContent = "Email de recuperação enviado! Verifique sua caixa de entrada e spam."; messageEl.className = 'success-message'; })
        .catch((error) => {
            messageEl.className = 'error-message';
            if (error.code === 'auth/user-not-found') messageEl.textContent = "Este email não está cadastrado.";
            else if (error.code === 'auth/invalid-email') messageEl.textContent = "O formato do email é inválido.";
            else messageEl.textContent = "Ocorreu um erro. Tente novamente.";
        });
}

async function deleteAccountAndData() {
    if (!currentUser) return;
    const confirmation = prompt("Atenção: Ação irreversível. Para excluir sua conta e todos os dados, digite 'EXCLUIR'.");
    if (confirmation !== 'EXCLUIR') { alert("Ação cancelada."); return; }
    try {
        await db.collection('financialData').doc(currentUser.uid).delete();
        await db.collection('userSettings').doc(currentUser.uid).delete();
        await db.collection('users').doc(currentUser.uid).delete();
        await currentUser.delete();
        alert("Conta e dados excluídos com sucesso.");
    } catch (error) {
        console.error("Erro ao excluir conta:", error);
        alert("Erro ao excluir conta. Pode ser necessário fazer login novamente por segurança.");
    }
}

function toggleForms(formToShow) {
    loginForm.style.display = formToShow === 'login' ? 'block' : 'none';
    registerForm.style.display = formToShow === 'register' ? 'block' : 'none';
    resetPasswordForm.style.display = formToShow === 'reset' ? 'block' : 'none';
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    document.getElementById('reset-message').textContent = '';
}

async function showApp() {
    loginSection.style.display = 'none';
    app.style.display = 'block';
    
    companyNameEl.textContent = userSettings.corporateName || DEFAULT_COMPANY_NAME;
    
    document.getElementById('business-type').value = userSettings.businessType || 'varejo';
    document.getElementById('benchmark-margem').value = (userSettings.benchmarkMargem != null) ? userSettings.benchmarkMargem : '';
    document.getElementById('benchmark-custos').value = (userSettings.benchmarkCustos != null) ? userSettings.benchmarkCustos : '';
    document.getElementById('benchmark-markup').value = (userSettings.benchmarkMarkup != null) ? userSettings.benchmarkMarkup : '';

    document.getElementById('diag-corporate-name').value = userSettings.corporateName || '';
    document.getElementById('diag-cnpj').value = userSettings.cnpj || '';
    document.getElementById('diag-responsible').value = userSettings.responsibleName || '';
    document.getElementById('diag-email').value = userSettings.contactEmail || '';
    document.getElementById('diag-phone').value = userSettings.phone || '';
    document.getElementById('diag-sector').value = userSettings.sector || 'Comércio';
    document.getElementById('diag-tax-regime').value = userSettings.taxRegime || 'Simples Nacional';

    document.getElementById('diag-erp').value = userSettings.hasErp || 'Não';
    document.getElementById('diag-instagram').value = userSettings.hasInstagram || 'Não';
    document.getElementById('diag-facebook').value = userSettings.hasFacebook || 'Não';
    document.getElementById('diag-landingpage').value = userSettings.hasLandingPage || 'Não';
    document.getElementById('diag-site').value = userSettings.hasSite || 'Não';
    document.getElementById('diag-ecommerce').value = userSettings.hasEcommerce || 'Não';
    document.getElementById('diag-ads').value = userSettings.hasAds || 'Não';
    document.getElementById('diag-marketplace').value = userSettings.marketplaceList || '';
    
    document.getElementById('diag-observations').value = userSettings.observations || '';
    
    consultantDiagnosisText.value = userSettings.consultantDiagnosis || '';

    allowManualEditCheckbox.checked = userSettings.allowManualEdit === true;

    const isAdmin = currentUser.email === ADMIN_EMAIL;
    const adminButtons = [btnTestAccess, btnResetAuth];
    adminButtons.forEach(btn => {
        if(btn) btn.style.display = isAdmin ? 'inline-block' : 'none';
    });
    if(btnGenerateUnlockCode) btnGenerateUnlockCode.style.display = 'inline-block';

    await checkAccessStatus();

    setupYearSelector();
    setupDailyMonthSelector();
    updateAllCalculations(); 
    renderGlossary();
    renderDailyEntries(currentYear, new Date().getMonth());
}

function showLogin() {
    app.style.display = 'none';
    loginSection.style.display = 'flex';
}

async function loadDataFromFirestore(userId, collection) {
    if (!userId || !collection) return {};
    try {
        const docRef = db.collection(collection).doc(userId);
        const doc = await docRef.get();
        return doc.exists ? doc.data() : {};
    } catch (error) { console.error(`Erro ao carregar dados da coleção ${collection}:`, error); return {}; }
}

async function saveDataToFirestore(userId, data, collection) {
    try { await db.collection(collection).doc(userId).set(data, { merge: true });
    } catch (error) { console.error(`Erro ao salvar dados na coleção ${collection}:`, error); alert('Falha ao salvar. Verifique sua conexão.'); throw error; }
}

async function saveMonthlyData() {
    if (!currentUser) return;
    if (!financialData[currentYear]) financialData[currentYear] = {};
    
    if (!allowManualEditCheckbox.checked) {
        aggregateDailyData(currentYear);
    }

    document.querySelectorAll('#monthly-inputs input').forEach(input => {
        const month = parseInt(input.dataset.month);
        const field = input.dataset.field;
        
        if (!financialData[currentYear][month]) {
            financialData[currentYear][month] = { dailyEntries: [] };
        }
        
        financialData[currentYear][month][field] = parseFloat(input.value) || 0;
    });

    try {
        await saveDataToFirestore(currentUser.uid, financialData, 'financialData');
        alert('Dados salvos na nuvem com sucesso!');
        updateAllCalculations(); 
    } catch (e) {}
}


async function saveBusinessSettings() {
    if (!currentUser) return;
    const settings = {
        ...userSettings,
        businessType: document.getElementById('business-type').value,
        benchmarkMargem: parseFloat(document.getElementById('benchmark-margem').value) || 0,
        benchmarkCustos: parseFloat(document.getElementById('benchmark-custos').value) || 0,
        benchmarkMarkup: parseFloat(document.getElementById('benchmark-markup').value) || 0,
        allowManualEdit: allowManualEditCheckbox.checked 
    };
    try { 
        await saveDataToFirestore(currentUser.uid, settings, 'userSettings'); 
        userSettings = settings; 
        alert('Configurações salvas com sucesso!');
    } catch (error) {
        console.error("Falha ao salvar configurações:", error);
    }
}

async function saveDiagnosisData(e) {
    if (e) e.preventDefault();
    if (!currentUser) return;

    const corporateName = document.getElementById('diag-corporate-name').value;
    const cnpj = document.getElementById('diag-cnpj').value;
    const responsibleName = document.getElementById('diag-responsible').value;
    const contactEmail = document.getElementById('diag-email').value;
    const phone = document.getElementById('diag-phone').value;
    const sector = document.getElementById('diag-sector').value;
    const taxRegime = document.getElementById('diag-tax-regime').value;

    const hasErp = document.getElementById('diag-erp').value;
    const hasInstagram = document.getElementById('diag-instagram').value;
    const hasFacebook = document.getElementById('diag-facebook').value;
    const hasLandingPage = document.getElementById('diag-landingpage').value;
    const hasSite = document.getElementById('diag-site').value;
    const hasEcommerce = document.getElementById('diag-ecommerce').value;
    const hasAds = document.getElementById('diag-ads').value;
    const marketplaceList = document.getElementById('diag-marketplace').value;
    const observations = document.getElementById('diag-observations').value;

    const settings = {
        ...userSettings,
        corporateName,
        cnpj,
        responsibleName,
        contactEmail,
        phone,
        sector,
        taxRegime,
        hasErp,
        hasInstagram,
        hasFacebook,
        hasLandingPage,
        hasSite,
        hasEcommerce,
        hasAds,
        marketplaceList,
        observations
    };

    try {
        await saveDataToFirestore(currentUser.uid, settings, 'userSettings');
        userSettings = settings;
        companyNameEl.textContent = corporateName || DEFAULT_COMPANY_NAME;
        if(e) alert('Dados do Diagnóstico Empresarial salvos com sucesso!');
    } catch (error) {
        console.error("Falha ao salvar diagnóstico:", error);
    }
}

async function saveConsultantDiagnosis() {
    if (!currentUser) return;
    const diagnosis = consultantDiagnosisText.value;

    const settings = {
        ...userSettings,
        consultantDiagnosis: diagnosis
    };

    try {
        await saveDataToFirestore(currentUser.uid, settings, 'userSettings');
        userSettings = settings;
        alert('Parecer do Consultor salvo com sucesso!');
    } catch (error) {
        console.error("Falha ao salvar parecer:", error);
    }
}

// === VERIFICAÇÃO E CONTROLE DE ACESSO ===

async function checkAccessStatus() {
    if (!currentUser) return;

    const now = new Date();
    
    let expirationDate = userSettings.accessExpiration ? new Date(userSettings.accessExpiration) : new Date(0); 
    let lastAccess = userSettings.lastAccess ? new Date(userSettings.lastAccess) : now;

    if (now.getTime() < lastAccess.getTime() - 60000) { 
        alert("Erro de Sincronização: A data do sistema parece incorreta (anterior ao último acesso). Por favor, ajuste o relógio.");
        lockAllTabs();
        return;
    }

    userSettings.lastAccess = now.toISOString();
    await saveDataToFirestore(currentUser.uid, { lastAccess: userSettings.lastAccess }, 'userSettings');

    const timeLeft = expirationDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

    if (timeLeft <= 0) {
        lockAllTabs();
        updateAccessDisplay("Expirado", expirationDate, 0);
    } else {
        unlockAllTabs();
        updateAccessDisplay("Ativo", expirationDate, daysLeft);
    }
}

function lockAllTabs() {
    // Lista de abas que DEVEM permanecer visíveis quando o crédito for 0.
    // Inclui 'entradas-diarias' para garantir acesso a novos usuários.
    const allowedTabs = ['diagnostico', 'entradas-diarias', 'entradas-mensais', 'configuracoes'];
    
    const allTabs = document.querySelectorAll('nav button');
    
    allTabs.forEach(tab => {
        if(allowedTabs.includes(tab.dataset.tab)) {
            // Remove a classe hidden-tab para garantir que seja exibida
            tab.classList.remove('hidden-tab');
        } else {
            // Adiciona a classe hidden-tab para ocultar as demais abas
            tab.classList.add('hidden-tab');
        }
    });

    // Lógica existente de controle do botão de desbloqueio
    if(btnGenerateUnlockCode) {
        btnGenerateUnlockCode.disabled = false;
        btnGenerateUnlockCode.style.backgroundColor = '#d4ac0d';
        btnGenerateUnlockCode.textContent = 'Gerar Código de Desbloqueio';
    }
}

function unlockAllTabs() {
    const hiddenTabs = document.querySelectorAll('.hidden-tab');
    hiddenTabs.forEach(tab => {
        tab.classList.remove('hidden-tab');
    });
    btnGenerateUnlockCode.disabled = true;
    btnGenerateUnlockCode.style.backgroundColor = '#ccc';
    btnGenerateUnlockCode.textContent = 'Sistema Desbloqueado';
}

function updateAccessDisplay(status, date, days) {
    accessStatusDisplay.style.display = 'block';
    statusText.textContent = status;
    statusText.style.color = status === "Ativo" ? "green" : "red";
    expirationText.textContent = date.toLocaleDateString('pt-BR');
    daysLeftText.textContent = days > 0 ? days : 0;
}

// === FUNÇÕES DE DESBLOQUEIO ===

async function handleUnlockTabs() {
    const CALC_OFFSET = 13;
    const CALC_MULTIPLIER = 9;
    const CALC_BASE = 1954;

    const randomNumber = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
    generatedCodeDisplay.textContent = randomNumber;
    
    const expectedBaseCode = (randomNumber + CALC_OFFSET) * CALC_MULTIPLIER + CALC_BASE;

    setTimeout(async () => {
        const userInput = prompt(`Código gerado: ${randomNumber}.\nDigite a contra-senha no formato: CÓDIGO-DIAS (ex: 5000-30).`);

        if (userInput) {
            const parts = userInput.split('-');
            const codeInput = parseInt(parts[0]);
            const daysInput = parts.length > 1 ? parseInt(parts[1]) : 30; 

            let isValid = false;
            // Senha mestra
            if (parts[0] === '130954') {
                isValid = true;
            } 
            else if (codeInput === expectedBaseCode && !isNaN(daysInput) && daysInput > 0) {
                isValid = true;
            }

            if (isValid) {
                const now = new Date();
                const newExpiration = new Date();
                newExpiration.setDate(now.getDate() + daysInput);

                userSettings.accessExpiration = newExpiration.toISOString();
                
                await saveDataToFirestore(currentUser.uid, { accessExpiration: userSettings.accessExpiration }, 'userSettings');
                
                alert(`Acesso liberado com sucesso por ${daysInput} dias!`);
                generatedCodeDisplay.textContent = "Desbloqueado";
                checkAccessStatus(); 
                
            } else {
                alert("Contra-senha inválida ou formato incorreto. Use CÓDIGO-DIAS.");
                generatedCodeDisplay.textContent = ""; 
            }
        } else {
             generatedCodeDisplay.textContent = ""; 
        }
    }, 200); 
}

async function addTestDay() {
    if (!currentUser) return;
    if(confirm("Adicionar 1 dia de teste para a conta atual?")) {
        const currentExp = userSettings.accessExpiration ? new Date(userSettings.accessExpiration) : new Date();
        const baseDate = currentExp < new Date() ? new Date() : currentExp;
        baseDate.setDate(baseDate.getDate() + 1);
        
        userSettings.accessExpiration = baseDate.toISOString();
        await saveDataToFirestore(currentUser.uid, { accessExpiration: userSettings.accessExpiration }, 'userSettings');
        alert("1 Dia de teste adicionado!");
        checkAccessStatus();
    }
}

async function resetAccess() {
    if (!currentUser) return;
    if(confirm("ATENÇÃO: Isso irá zerar o período de autorização e bloquear o sistema imediatamente. Continuar?")) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        userSettings.accessExpiration = yesterday.toISOString();
        await saveDataToFirestore(currentUser.uid, { accessExpiration: userSettings.accessExpiration }, 'userSettings');
        
        alert("Autorização zerada. O sistema foi bloqueado.");
        checkAccessStatus();
    }
}

btnGenerateUnlockCode.addEventListener('click', handleUnlockTabs);
btnTestAccess.addEventListener('click', addTestDay);
btnResetAuth.addEventListener('click', resetAccess);

// === FUNÇÕES DE DADOS DE DEMONSTRAÇÃO E RESET ===

// Função Auxiliar para Geração de Dados Diários Proporcionais
function generateDailySimulation(year, monthIndex, totals) {
    // Determina quantos dias exatos tem naquele mês/ano (trata bissextos)
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const entries = [];
    
    // Saldos restantes para distribuir (Garante coerência com o total mensal)
    let remFat = totals.faturamento;
    let remCustos = totals.custosVariaveis; // Mapeia para 'Comissão' no diário
    let remDesp = totals.despesasOperacionais;
    let remVendas = totals.numeroDeVendas;

    for (let day = 1; day <= daysInMonth; day++) {
        const isLastDay = day === daysInMonth;
        // Formato de data compatível com input type="date"
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        let dFat, dCustos, dDesp, dVendas;

        if (isLastDay) {
            // No último dia, lançamos exatamente o que sobrou para zerar a diferença (Matemática Exata)
            dFat = parseFloat(remFat.toFixed(2));
            dCustos = parseFloat(remCustos.toFixed(2));
            dDesp = parseFloat(remDesp.toFixed(2));
            dVendas = Math.round(remVendas);
        } else {
            // Distribuição Proporcional com leve variância (Simula realidade de comércio)
            // Variância entre 0.6x e 1.4x da média diária
            const variance = 0.6 + Math.random() * 0.8; 
            const daysLeft = (daysInMonth - day + 1);

            // Calcula a fatia do dia baseada no saldo restante dividido pelos dias que faltam
            dFat = parseFloat(((remFat / daysLeft) * variance).toFixed(2));
            dCustos = parseFloat(((remCustos / daysLeft) * variance).toFixed(2));
            dDesp = parseFloat(((remDesp / daysLeft) * variance).toFixed(2));
            dVendas = Math.round((remVendas / daysLeft) * variance);
        }

        // Proteção contra valores negativos (caso a variância seja muito agressiva em saldos baixos)
        dFat = Math.max(0, dFat);
        dCustos = Math.max(0, dCustos);
        dDesp = Math.max(0, dDesp);
        dVendas = Math.max(0, dVendas);

        // Atualiza saldos para o próximo dia
        remFat -= dFat;
        remCustos -= dCustos;
        remDesp -= dDesp;
        remVendas -= dVendas;

        entries.push({
            date: dateStr,
            faturamento: dFat,
            despesas: dDesp,
            comissao: dCustos, 
            outras: 0, // Campo 'Outras' zerado na simulação padrão
            vendas: dVendas
        });
    }
    return entries;
}

async function handleResetAndPopulateDemoData() {
    if (!currentUser) return;

    const confirmed = confirm(
        "AVISO: Esta ação irá ZERAR os dados atuais das abas 'Empresa', 'Valores Mensais' e 'Entradas Diárias', preenchendo-os com dados de simulação (Comércio R$ 60k).\n\n" +
        "Esta ação é irreversível e afetará os dados de todo o ano atual.\n\nDeseja continuar?"
    );

    if (!confirmed) return;

    // 1. Reset & Configurar Aba Empresa (Lógica Inalterada)
    const demoCompanyData = {
        corporateName: "Loja Modelo de Exemplo Ltda",
        cnpj: "12.345.678/0001-90",
        responsibleName: "João Empreendedor",
        contactEmail: currentUser.email,
        phone: "(11) 98765-4321",
        sector: "Comércio",
        taxRegime: "Simples Nacional",
        hasErp: "Sim",
        hasInstagram: "Sim",
        hasFacebook: "Sim",
        hasSite: "Sim",
        observations: "Dados gerados automaticamente para demonstração do sistema. Faturamento médio de R$ 60k com distribuição diária proporcional."
    };
    
    // Atualizar userSettings local e na UI (Lógica Inalterada)
    userSettings = { ...userSettings, ...demoCompanyData, allowManualEdit: true };
    document.getElementById('diag-corporate-name').value = demoCompanyData.corporateName;
    document.getElementById('diag-cnpj').value = demoCompanyData.cnpj;
    document.getElementById('diag-responsible').value = demoCompanyData.responsibleName;
    document.getElementById('diag-phone').value = demoCompanyData.phone;
    document.getElementById('diag-sector').value = demoCompanyData.sector;
    document.getElementById('diag-tax-regime').value = demoCompanyData.taxRegime;
    document.getElementById('diag-observations').value = demoCompanyData.observations;
    companyNameEl.textContent = demoCompanyData.corporateName;

    // 2. Reset & Preencher Entradas Mensais E Diárias
    if (!financialData[currentYear]) financialData[currentYear] = {};
    
    for (let i = 0; i < 12; i++) {
        // Simulação Mensal: Variação aleatória de +/- 10% em torno de 60k
        const variation = 1 + (Math.random() * 0.2 - 0.1); 
        const baseRevenue = 60000 * variation;
        
        // Definição dos Totais Mensais
        const monthFaturamento = parseFloat(baseRevenue.toFixed(2));
        const monthNumVendas = Math.floor(300 * variation);
        const monthCustosVar = parseFloat((baseRevenue * 0.45).toFixed(2)); // ~45%
        const monthDespesasOp = parseFloat((3000 + (Math.random() * 500)).toFixed(2));

        // --- Geração dos Lançamentos Diários ---
        // Chama a função auxiliar para distribuir o total mensal pelos dias do mês
        const generatedDailyEntries = generateDailySimulation(currentYear, i, {
            faturamento: monthFaturamento,
            custosVariaveis: monthCustosVar,
            despesasOperacionais: monthDespesasOp,
            numeroDeVendas: monthNumVendas
        });

        const monthlyData = {
            faturamento: monthFaturamento,
            numeroDeVendas: monthNumVendas,
            custosVariaveis: monthCustosVar,
            custosFixos: parseFloat((12000 + (Math.random() * 1000)).toFixed(2)),
            despesasOperacionais: monthDespesasOp,
            depreciacao: 500,
            outrasReceitasDespesas: 0,
            investimentos: i === 5 ? 5000 : 0, // Exemplo pontual
            financiamentosEntradas: 0,
            amortizacaoDividas: 0,
            aporteSocios: 0,
            distribuicaoLucros: 0,
            impostos: parseFloat((baseRevenue * 0.08).toFixed(2)), // ~8% Simples
            
            // Array preenchido com dados proporcionais
            dailyEntries: generatedDailyEntries 
        };

        financialData[currentYear][i] = monthlyData;
    }

    // 3. Finalização e Salvamento
    allowManualEditCheckbox.checked = true;

    try {
        await saveDataToFirestore(currentUser.uid, userSettings, 'userSettings');
        await saveDataToFirestore(currentUser.uid, financialData, 'financialData');
        
        updateAllCalculations(); 
        
        // Força a renderização da tabela diária para o mês selecionado atualmente
        const selectedMonth = parseInt(dailyMonthSelector.value) || 0;
        renderDailyEntries(currentYear, selectedMonth);

        alert("Simulação concluída! Dados mensais e diários gerados com sucesso.");
    } catch (error) {
        console.error("Erro ao preencher dados de demo:", error);
        alert("Erro ao salvar os dados simulados.");
    }
}

btnResetPopulateDemo.addEventListener('click', handleResetAndPopulateDemoData);


// === FUNÇÕES DE BACKUP E RESTORE ===

function exportLocalBackup() {
    if (!financialData || Object.keys(financialData).length === 0) {
        const confirmBackup = confirm("Parece que não há dados financeiros carregados. Deseja fazer o backup mesmo assim?");
        if (!confirmBackup) return;
    }

    const backupData = {
        financialData: JSON.parse(JSON.stringify(financialData)), 
        userSettings: JSON.parse(JSON.stringify(userSettings)), 
        exportDate: new Date().toISOString(),
        appVersion: "1.2"
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_financeiro_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importLocalBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("ATENÇÃO: Restaurar um backup substituirá TODOS os dados atuais da tela e salvará na nuvem (Firebase). Deseja continuar?")) {
        e.target.value = ''; 
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const parsedData = JSON.parse(event.target.result);
            if (!parsedData.financialData && !parsedData.userSettings) throw new Error("Arquivo de backup inválido.");

            financialData = parsedData.financialData || {};
            userSettings = parsedData.userSettings || {};

            await db.collection('financialData').doc(currentUser.uid).set(financialData); 
            await db.collection('userSettings').doc(currentUser.uid).set(userSettings);

            alert("Dados restaurados com sucesso!");
            
            const years = Object.keys(financialData).map(Number);
            if (years.length > 0) {
                currentYear = Math.max(...years);
                let yearExists = false;
                for(let opt of yearSelector.options){ if(parseInt(opt.value) === currentYear) yearExists = true; }
                if(!yearExists) {
                    const option = document.createElement('option');
                    option.value = currentYear; option.textContent = currentYear;
                    yearSelector.appendChild(option);
                }
                yearSelector.value = currentYear;
            }
            showApp(); 
        } catch (error) {
            console.error("Erro ao restaurar:", error);
            alert("Erro ao ler o arquivo de backup ou salvar no banco.");
        }
        e.target.value = ''; 
    };
    reader.readAsText(file);
}

// === FUNÇÕES XLSX ===

// Helper para criar planilha
function createSheetFromData(data, headers, sheetName) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
}

// Helper para ler arquivo Excel
function readXLSXFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            resolve(workbook);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// -- Aba Empresa --
function handleExportCompanyXLSX() {
    const formMap = {
        'Razão Social': userSettings.corporateName,
        'CNPJ': userSettings.cnpj,
        'Responsável': userSettings.responsibleName,
        'Email': userSettings.contactEmail,
        'Telefone': userSettings.phone,
        'Setor': userSettings.sector,
        'Regime': userSettings.taxRegime,
        'ERP': userSettings.hasErp,
        'Instagram': userSettings.hasInstagram,
        'Facebook': userSettings.hasFacebook,
        'Landing Page': userSettings.hasLandingPage,
        'Site': userSettings.hasSite,
        'E-commerce': userSettings.hasEcommerce,
        'Tráfego Pago': userSettings.hasAds,
        'Marketplace': userSettings.marketplaceList,
        'Observações': userSettings.observations
    };
    
    const rows = Object.entries(formMap);
    const wb = createSheetFromData(rows, ['Campo', 'Valor'], 'Dados Empresa');
    XLSX.writeFile(wb, `Empresa_${currentYear}.xlsx`);
}

async function handleImportCompanyXLSX(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const wb = await readXLSXFile(file);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }); // Array of arrays

        const fieldMapReverse = {
            'Razão Social': 'diag-corporate-name',
            'CNPJ': 'diag-cnpj',
            'Responsável': 'diag-responsible',
            'Email': 'diag-email',
            'Telefone': 'diag-phone',
            'Setor': 'diag-sector',
            'Regime': 'diag-tax-regime',
            'ERP': 'diag-erp',
            'Instagram': 'diag-instagram',
            'Facebook': 'diag-facebook',
            'Landing Page': 'diag-landingpage',
            'Site': 'diag-site',
            'E-commerce': 'diag-ecommerce',
            'Tráfego Pago': 'diag-ads',
            'Marketplace': 'diag-marketplace',
            'Observações': 'diag-observations'
        };

        let updated = false;
        data.forEach(row => {
            if (row.length >= 2) {
                const key = row[0];
                const value = row[1];
                const elementId = fieldMapReverse[key];
                if (elementId) {
                    const el = document.getElementById(elementId);
                    if (el) { el.value = value || ''; updated = true; }
                }
            }
        });

        if (updated) {
            saveDiagnosisData(null); // Salva no Firebase
            alert('Dados da empresa importados com sucesso!');
        }
    } catch (err) {
        console.error(err);
        alert('Erro ao importar arquivo. Verifique o formato.');
    }
    e.target.value = '';
}

// -- Aba Entradas Diárias --
function handleExportDailyXLSX() {
    const month = parseInt(dailyMonthSelector.value);
    const yearData = financialData[currentYear] || {};
    const monthData = yearData[month] || {};
    const entries = monthData.dailyEntries || [];

    if (entries.length === 0) {
        alert('Não há lançamentos para exportar neste mês.');
        return;
    }

    const rows = entries.map(e => [e.date, e.faturamento, e.despesas, e.comissao, e.outras, e.vendas]);
    const wb = createSheetFromData(rows, ['Data', 'Faturamento', 'Despesas', 'Comissão', 'Outras', 'Vendas'], `${MONTHS[month]}_Diario`);
    XLSX.writeFile(wb, `Diario_${currentYear}_${MONTHS[month]}.xlsx`);
}

async function handleImportDailyXLSX(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("A importação irá adicionar os lançamentos da planilha aos existentes. Continuar?")) {
        e.target.value = ''; return;
    }

    try {
        const wb = await readXLSXFile(file);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws); // Objects based on header

        const month = parseInt(dailyMonthSelector.value);
        if (!financialData[currentYear]) financialData[currentYear] = {};
        if (!financialData[currentYear][month]) financialData[currentYear][month] = { dailyEntries: [] };

        let addedCount = 0;
        data.forEach(row => {
            // Mapping assumptions based on Export headers
            const date = row['Data'] || row['date'];
            if (date) {
                financialData[currentYear][month].dailyEntries.push({
                    date: date,
                    faturamento: parseFloat(row['Faturamento'] || 0),
                    despesas: parseFloat(row['Despesas'] || 0),
                    comissao: parseFloat(row['Comissão'] || row['Comissao'] || 0),
                    outras: parseFloat(row['Outras'] || 0),
                    vendas: parseInt(row['Vendas'] || 0)
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            await saveDataToFirestore(currentUser.uid, financialData, 'financialData');
            updateAllCalculations();
            renderDailyEntries(currentYear, month);
            alert(`${addedCount} lançamentos importados com sucesso!`);
        } else {
            alert('Nenhum dado válido encontrado. Verifique os cabeçalhos (Data, Faturamento, Despesas...).');
        }

    } catch (err) {
        console.error(err);
        alert('Erro na importação. Verifique o arquivo.');
    }
    e.target.value = '';
}

// -- Aba Entradas Mensais --
function handleExportMonthlyXLSX() {
    const yearData = financialData[currentYear] || {};
    const headers = ['Mês', 'Faturamento', 'NumVendas', 'CustosVariaveis', 'CustosFixos', 'DespesasOp', 'Depreciacao', 'Outras', 'Investimentos', 'FinancEntradas', 'AmortDividas', 'AporteSocios', 'DistrLucros', 'Impostos'];
    
    const rows = MONTHS.map((m, i) => {
        const d = yearData[i] || {};
        return [
            m, 
            d.faturamento || 0, d.numeroDeVendas || 0, d.custosVariaveis || 0, d.custosFixos || 0, 
            d.despesasOperacionais || 0, d.depreciacao || 0, d.outrasReceitasDespesas || 0, 
            d.investimentos || 0, d.financiamentosEntradas || 0, d.amortizacaoDividas || 0, 
            d.aporteSocios || 0, d.distribuicaoLucros || 0, d.impostos || 0
        ];
    });

    const wb = createSheetFromData(rows, headers, `Mensal_${currentYear}`);
    XLSX.writeFile(wb, `Entradas_Mensais_${currentYear}.xlsx`);
}

async function handleImportMonthlyXLSX(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("A importação substituirá os dados manuais da tabela mensal para este ano. Continuar?")) {
        e.target.value = ''; return;
    }

    try {
        const wb = await readXLSXFile(file);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws); 

        if (!financialData[currentYear]) financialData[currentYear] = {};
        
        // Map Excel headers to JSON keys
        const mapKeys = {
            'Faturamento': 'faturamento', 'NumVendas': 'numeroDeVendas', 'CustosVariaveis': 'custosVariaveis',
            'CustosFixos': 'custosFixos', 'DespesasOp': 'despesasOperacionais', 'Depreciacao': 'depreciacao',
            'Outras': 'outrasReceitasDespesas', 'Investimentos': 'investimentos', 'FinancEntradas': 'financiamentosEntradas',
            'AmortDividas': 'amortizacaoDividas', 'AporteSocios': 'aporteSocios', 'DistrLucros': 'distribuicaoLucros',
            'Impostos': 'impostos'
        };

        data.forEach((row, idx) => {
            if (idx < 12) { // 12 months
                if (!financialData[currentYear][idx]) financialData[currentYear][idx] = { dailyEntries: [] };
                Object.keys(mapKeys).forEach(header => {
                    if (row[header] !== undefined) {
                        financialData[currentYear][idx][mapKeys[header]] = parseFloat(row[header]) || 0;
                    }
                });
            }
        });

        await saveDataToFirestore(currentUser.uid, financialData, 'financialData');
        updateAllCalculations();
        alert('Tabela mensal importada e salva!');

    } catch (err) {
        console.error(err);
        alert('Erro ao importar. Certifique-se de usar o mesmo modelo da exportação.');
    }
    e.target.value = '';
}

// -- Exportação apenas (Indicadores/Evolução) --
function handleExportAnnualXLSX() {
    const tableData = [];
    const yearData = financialData[currentYear] || {};
    let annualTotals = {}; 
    INPUT_FIELDS.forEach(field => annualTotals[field] = 0);
    
    for(let i=0; i<12; i++) { 
        if(yearData[i]) INPUT_FIELDS.forEach(field => annualTotals[field] += yearData[i][field] || 0);
    }
    const indicators = calculateIndicators(annualTotals);
    
    Object.keys(indicators).forEach(k => {
        tableData.push([k, indicators[k]]);
    });
    
    const wb = createSheetFromData(tableData, ['Indicador', 'Valor Total'], 'Indicadores Anuais');
    XLSX.writeFile(wb, `Indicadores_Anuais_${currentYear}.xlsx`);
}

function handleExportEvolutionXLSX() {
    const yearData = financialData[currentYear] || {};
    const rows = [];
    for(let i=0; i<12; i++) {
        const ind = calculateIndicators(yearData[i]);
        rows.push([MONTHS[i], ind.faturamento, ind.custosTotais, ind.lucroLiquido, ind.fluxoCaixaLivre]);
    }
    const wb = createSheetFromData(rows, ['Mês', 'Faturamento', 'Custos Totais', 'Lucro Líquido', 'Fluxo Caixa Livre'], 'Evolução');
    XLSX.writeFile(wb, `Evolucao_${currentYear}.xlsx`);
}


// === GERAÇÃO DE PDFS POR ABA (MANTIDO) ===

function generateCompanyPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(0, 95, 115);
    doc.text(`Dados da Empresa e Diagnóstico - ${currentYear}`, 14, 20);
    
    const companyData = [
        ["Razão Social", userSettings.corporateName || "-"],
        ["CNPJ", userSettings.cnpj || "-"],
        ["Responsável", userSettings.responsibleName || "-"],
        ["E-mail", userSettings.contactEmail || "-"],
        ["Telefone", userSettings.phone || "-"],
        ["Setor", userSettings.sector || "-"],
        ["Regime Tributário", userSettings.taxRegime || "-"],
        ["Utiliza ERP", userSettings.hasErp || "Não"],
        ["Instagram", userSettings.hasInstagram || "Não"],
        ["Facebook", userSettings.hasFacebook || "Não"],
        ["Site", userSettings.hasSite || "Não"],
        ["Loja Virtual", userSettings.hasEcommerce || "Não"],
        ["Tráfego Pago", userSettings.hasAds || "Não"],
        ["Marketplaces", userSettings.marketplaceList || "-"]
    ];

    doc.autoTable({
        startY: 30,
        head: [['Campo', 'Informação']],
        body: companyData,
        theme: 'striped',
        headStyles: { fillColor: [0, 95, 115] },
        styles: { fontSize: 10 }
    });

    if (userSettings.observations) {
        let currentY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Observações Gerais:", 14, currentY);
        doc.setFontSize(10);
        const splitObs = doc.splitTextToSize(userSettings.observations, 180);
        doc.text(splitObs, 14, currentY + 7);
    }
    doc.save(`Relatorio_Empresa_${currentYear}.pdf`);
}

function generateMonthlyInputsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l'); 
    doc.setFontSize(16);
    doc.setTextColor(0, 95, 115);
    doc.text(`Entradas Mensais Detalhadas - ${currentYear}`, 14, 20);

    const monthlyData = [];
    const yearData = financialData[currentYear] || {};
    
    MONTHS.forEach((month, index) => {
        const data = yearData[index] || {};
        const row = [
            month,
            formatCurrency(data.faturamento),
            data.numeroDeVendas || 0,
            formatCurrency(data.custosVariaveis),
            formatCurrency(data.custosFixos),
            formatCurrency(data.despesasOperacionais),
            formatCurrency(data.outrasReceitasDespesas),
            formatCurrency(data.investimentos),
            formatCurrency(data.financiamentosEntradas),
            formatCurrency(data.amortizacaoDividas),
            formatCurrency(data.impostos)
        ];
        monthlyData.push(row);
    });

    doc.autoTable({
        startY: 30,
        head: [['Mês', 'Fat.', 'Vendas', 'C.Var.', 'C.Fix.', 'Desp.Op.', 'Outras', 'Invest.', 'Financ.', 'Amort.', 'Imp.']],
        body: monthlyData,
        theme: 'grid',
        headStyles: { fillColor: [10, 147, 150], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });
    doc.save(`Entradas_Mensais_${currentYear}.pdf`);
}

function generateAnnualIndicatorsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(0, 95, 115);
    doc.text(`Indicadores Anuais - ${currentYear}`, 14, 20);

    let annualTotals = {}; 
    INPUT_FIELDS.forEach(field => annualTotals[field] = 0);
    const yearData = financialData[currentYear] || {};
    let monthsWithDataCount = 0;
    for(let i=0; i<12; i++) { 
        if(yearData[i]) {
            INPUT_FIELDS.forEach(field => annualTotals[field] += yearData[i][field] || 0);
            if((yearData[i].faturamento > 0) || (yearData[i].custosVariaveis > 0) || (yearData[i].custosFixos > 0)) monthsWithDataCount++;
        }
    }
    const divisor = monthsWithDataCount > 0 ? monthsWithDataCount : 1;
    const annualIndicators = calculateIndicators(annualTotals);

    const summaryData = [
        ["Faturamento Total", formatCurrency(annualIndicators.faturamento)],
        ["Faturamento Médio Mensal", formatCurrency(annualIndicators.faturamento / divisor)],
        ["Volume de Vendas Médio", (annualTotals.numeroDeVendas / divisor).toFixed(1)],
        ["Lucro Líquido Total", formatCurrency(annualIndicators.lucroLiquido)],
        ["Margem Líquida Média", formatPercent(annualIndicators.margemLiquida)],
        ["Markup Médio", formatPercent(annualIndicators.markup)],
        ["Fluxo de Caixa Livre Total", formatCurrency(annualIndicators.fluxoCaixaLivre)],
        ["Ponto de Equilíbrio Médio", formatCurrency(annualIndicators.pontoEquilibrio / divisor)]
    ];

    doc.autoTable({
        startY: 30,
        body: summaryData,
        theme: 'grid',
        styles: { fontSize: 12, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, halign: 'right' } }
    });
    doc.save(`Indicadores_Anuais_${currentYear}.pdf`);
}

function generateEvolutionPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(0, 95, 115);
    doc.text(`Evolução Gráfica do Negócio - ${currentYear}`, 14, 20);
    
    let currentY = 30;
    const chart1 = document.getElementById('monthlyEvolutionChart');
    if (chart1) {
        const img1 = chart1.toDataURL('image/png');
        doc.addImage(img1, 'PNG', 14, currentY + 10, 180, 90);
        currentY += 100;
    }

    const chart2 = document.getElementById('cashFlowChart');
    if (chart2) {
        const img2 = chart2.toDataURL('image/png');
        doc.addImage(img2, 'PNG', 14, currentY, 180, 90);
    }
    doc.save(`Evolucao_Grafica_${currentYear}.pdf`);
}

function generateGlossaryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(0, 95, 115);
    doc.text("Glossário de Termos Financeiros", 14, 20);
    
    let currentY = 30;
    doc.setFontSize(10);
    doc.setTextColor(0);

    Object.keys(GLOSSARY_DATA).sort().forEach(key => {
        const item = GLOSSARY_DATA[key];
        if (currentY > 270) { doc.addPage(); currentY = 20; }
        
        doc.setFont(undefined, 'bold');
        doc.text(item.nome, 14, currentY);
        currentY += 5;
        
        doc.setFont(undefined, 'normal');
        const text = `Significado: ${item.significado}\nFórmula: ${item.formula}`;
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 14, currentY);
        currentY += (splitText.length * 5) + 10;
    });
    doc.save("Glossario_Financeiro.pdf");
}

function generateConsultantDiagnosisPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(0, 95, 115);
    doc.text(`Parecer do Consultor - ${currentYear}`, 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(0);
    const diagnosisText = userSettings.consultantDiagnosis || "Nenhum diagnóstico registrado.";
    const splitDiagnosis = doc.splitTextToSize(diagnosisText, pageWidth - 28);
    doc.text(splitDiagnosis, 14, currentY);

    doc.save(`Parecer_Consultor_${currentYear}.pdf`);
}

function generateFullReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    doc.setFontSize(18);
    doc.setTextColor(0, 95, 115);
    doc.text(`Relatório Financeiro Integrado - ${currentYear}`, 14, currentY);
    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text(`Empresa: ${userSettings.corporateName || 'Não informada'}`, 14, currentY + 10);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, currentY + 17);
    
    currentY += 30;

    doc.setFontSize(14);
    doc.setTextColor(0, 95, 115);
    doc.text("1. Dados da Empresa e Presença Digital", 14, currentY);
    currentY += 10;

    const companyData = [
        ["Razão Social", userSettings.corporateName || "-"],
        ["CNPJ", userSettings.cnpj || "-"],
        ["Responsável", userSettings.responsibleName || "-"],
        ["E-mail", userSettings.contactEmail || "-"],
        ["Telefone", userSettings.phone || "-"],
        ["Setor", userSettings.sector || "-"],
        ["Regime Tributário", userSettings.taxRegime || "-"],
        ["Utiliza ERP", userSettings.hasErp || "Não"],
        ["Instagram", userSettings.hasInstagram || "Não"],
        ["Facebook", userSettings.hasFacebook || "Não"],
        ["Site", userSettings.hasSite || "Não"],
        ["Loja Virtual", userSettings.hasEcommerce || "Não"],
        ["Tráfego Pago", userSettings.hasAds || "Não"],
        ["Marketplaces", userSettings.marketplaceList || "-"]
    ];

    doc.autoTable({
        startY: currentY,
        head: [['Campo', 'Informação']],
        body: companyData,
        theme: 'striped',
        headStyles: { fillColor: [0, 95, 115] },
        styles: { fontSize: 10 }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    if (userSettings.observations) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Observações Gerais:", 14, currentY);
        currentY += 7;
        doc.setFontSize(10);
        const splitObs = doc.splitTextToSize(userSettings.observations, pageWidth - 28);
        doc.text(splitObs, 14, currentY);
        currentY += (splitObs.length * 5) + 15;
    }

    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.setTextColor(0, 95, 115);
    doc.text("2. Entradas Mensais Detalhadas", 14, currentY);
    
    const monthlyData = [];
    const yearData = financialData[currentYear] || {};
    
    MONTHS.forEach((month, index) => {
        const data = yearData[index] || {};
        const row = [
            month,
            formatCurrency(data.faturamento),
            data.numeroDeVendas || 0,
            formatCurrency(data.custosVariaveis),
            formatCurrency(data.custosFixos),
            formatCurrency(data.despesasOperacionais),
            formatCurrency(data.outrasReceitasDespesas),
            formatCurrency(data.investimentos),
            formatCurrency(data.financiamentosEntradas),
            formatCurrency(data.amortizacaoDividas),
            formatCurrency(data.impostos)
        ];
        monthlyData.push(row);
    });

    doc.autoTable({
        startY: currentY + 10,
        head: [['Mês', 'Fat.', 'Vendas', 'C.Var.', 'C.Fix.', 'Desp.Op.', 'Outras', 'Invest.', 'Financ.', 'Amort.', 'Imp.']],
        body: monthlyData,
        theme: 'grid',
        headStyles: { fillColor: [10, 147, 150], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });

    doc.addPage();
    currentY = 20;
    doc.setFontSize(14);
    doc.setTextColor(0, 95, 115);
    doc.text("3. Indicadores Financeiros Mensais", 14, currentY);

    const indicatorsData = [];
    MONTHS.forEach((month, index) => {
        const indicators = calculateIndicators(yearData[index]);
        indicatorsData.push([
            month,
            formatCurrency(indicators.lucroLiquido),
            formatPercent(indicators.margemLiquida),
            formatPercent(indicators.markup),
            formatCurrency(indicators.fluxoCaixaOperacional),
            formatCurrency(indicators.fluxoCaixaInvestimentos),
            formatCurrency(indicators.fluxoCaixaFinanciamentos),
            formatCurrency(indicators.fluxoCaixaLivre)
        ]);
    });

    doc.autoTable({
        startY: currentY + 10,
        head: [['Mês', 'Lucro Líq.', 'Margem %', 'Markup %', 'FCO', 'FCI', 'FCF', 'FCL']],
        body: indicatorsData,
        theme: 'grid',
        headStyles: { fillColor: [42, 157, 143] },
        styles: { fontSize: 8 }
    });

    currentY = doc.lastAutoTable.finalY + 20;
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    
    doc.setFontSize(14);
    doc.setTextColor(0, 95, 115);
    doc.text("4. Resumo de Indicadores Anuais", 14, currentY);
    currentY += 10;

    let annualTotals = {}; 
    INPUT_FIELDS.forEach(field => annualTotals[field] = 0);
    let monthsWithDataCount = 0;
    for(let i=0; i<12; i++) { 
        if(yearData[i]) {
            INPUT_FIELDS.forEach(field => annualTotals[field] += yearData[i][field] || 0);
            if((yearData[i].faturamento > 0) || (yearData[i].custosVariaveis > 0) || (yearData[i].custosFixos > 0)) monthsWithDataCount++;
        }
    }
    const divisor = monthsWithDataCount > 0 ? monthsWithDataCount : 1;
    const annualIndicators = calculateIndicators(annualTotals);

    const summaryData = [
        ["Faturamento Total", formatCurrency(annualIndicators.faturamento)],
        ["Faturamento Médio Mensal", formatCurrency(annualIndicators.faturamento / divisor)],
        ["Volume de Vendas Médio", (annualTotals.numeroDeVendas / divisor).toFixed(1)],
        ["Lucro Líquido Total", formatCurrency(annualIndicators.lucroLiquido)],
        ["Margem Líquida Média", formatPercent(annualIndicators.margemLiquida)],
        ["Markup Médio", formatPercent(annualIndicators.markup)],
        ["Fluxo de Caixa Livre Total", formatCurrency(annualIndicators.fluxoCaixaLivre)],
        ["Ponto de Equilíbrio Médio", formatCurrency(annualIndicators.pontoEquilibrio / divisor)]
    ];

    doc.autoTable({
        startY: currentY,
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 11, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, halign: 'right' } }
    });

    doc.addPage();
    currentY = 20;
    doc.setFontSize(14);
    doc.setTextColor(0, 95, 115);
    doc.text("5. Evolução Gráfica do Negócio", 14, currentY);
    
    const chart1 = document.getElementById('monthlyEvolutionChart');
    if (chart1) {
        const img1 = chart1.toDataURL('image/png');
        doc.addImage(img1, 'PNG', 14, currentY + 10, 180, 90);
        currentY += 110;
    }

    const chart2 = document.getElementById('cashFlowChart');
    if (chart2) {
        const img2 = chart2.toDataURL('image/png');
        doc.addImage(img2, 'PNG', 14, currentY, 180, 90);
    }

    doc.addPage();
    currentY = 20;
    doc.setFontSize(14);
    doc.setTextColor(0, 95, 115);
    doc.text("6. Diagnóstico do Consultor", 14, currentY);
    
    currentY += 15;
    doc.setFontSize(11);
    doc.setTextColor(0);
    
    const diagnosisText = userSettings.consultantDiagnosis || "Nenhum diagnóstico registrado.";
    const splitDiagnosis = doc.splitTextToSize(diagnosisText, pageWidth - 28);
    doc.text(splitDiagnosis, 14, currentY);

    doc.save(`Relatorio_Financeiro_Completo_${currentYear}.pdf`);
}

function generateDailyReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let currentY = 20;

    doc.setFontSize(18);
    doc.setTextColor(46, 134, 222); 
    doc.text(`Relatório de Movimentação Diária - ${currentYear}`, 14, currentY);
    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text(`Empresa: ${userSettings.corporateName || 'Não informada'}`, 14, currentY + 10);
    currentY += 20;

    let hasDailyData = false;
    const yearData = financialData[currentYear] || {};

    MONTHS.forEach((month, index) => {
        if (yearData[index] && yearData[index].dailyEntries && yearData[index].dailyEntries.length > 0) {
            hasDailyData = true;
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text(`Mês: ${month}`, 14, currentY);
            currentY += 5;
            const dailyRows = yearData[index].dailyEntries.map(entry => [
                new Date(entry.date + 'T00:00:00-03:00').toLocaleDateString('pt-BR'),
                formatCurrency(parseFloat(entry.faturamento)),
                formatCurrency(parseFloat(entry.despesas)),
                formatCurrency(parseFloat(entry.comissao)),
                formatCurrency(parseFloat(entry.outras)),
                entry.vendas
            ]);
            doc.autoTable({
                startY: currentY,
                head: [['Data', 'Faturamento', 'Despesas', 'Comissão', 'Outras', 'Vendas']],
                body: dailyRows,
                theme: 'striped',
                headStyles: { fillColor: [46, 134, 222] },
                styles: { fontSize: 8 },
                margin: { left: 14 }
            });
            currentY = doc.lastAutoTable.finalY + 15;
        }
    });

    if (!hasDailyData) {
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text("Não há lançamentos diários registrados para este ano.", 14, currentY);
    }
    doc.save(`Relatorio_Diario_${currentYear}.pdf`);
}

btnFullReport.addEventListener('click', generateFullReport);
btnExportDaily.addEventListener('click', generateDailyReport);
btnExportCompany.addEventListener('click', generateCompanyPDF);
btnExportMonthlyInputs.addEventListener('click', generateMonthlyInputsPDF);
btnExportAnnual.addEventListener('click', generateAnnualIndicatorsPDF);
btnExportEvolution.addEventListener('click', generateEvolutionPDF);
btnExportGlossary.addEventListener('click', generateGlossaryPDF);
btnExportConsultant.addEventListener('click', generateConsultantDiagnosisPDF);


function setupYearSelector() {
    const current = new Date().getFullYear();
    yearSelector.innerHTML = '';
    for (let i = current + 5; i >= current - 5; i--) {
        const option = document.createElement('option');
        option.value = i; option.textContent = i; option.selected = (i === currentYear);
        yearSelector.appendChild(option);
    }
}

function setupDailyMonthSelector() {
    dailyMonthSelector.innerHTML = '';
    MONTHS.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        option.selected = (index === new Date().getMonth());
        dailyMonthSelector.appendChild(option);
    });
}

function aggregateDailyData(year) {
    if (!financialData[year]) return;

    for (let i = 0; i < 12; i++) {
        const monthData = financialData[year][i];
        
        if (!monthData) continue;

        if (monthData.dailyEntries && monthData.dailyEntries.length > 0) {
            const totals = monthData.dailyEntries.reduce((acc, entry) => {
                acc.faturamento += parseFloat(entry.faturamento) || 0;
                acc.despesasOperacionais += parseFloat(entry.despesas) || 0;
                acc.numeroDeVendas += parseInt(entry.vendas) || 0;
                acc.custosVariaveis += parseFloat(entry.comissao) || 0;
                acc.outrasReceitasDespesas += parseFloat(entry.outras) || 0;
                return acc;
            }, { faturamento: 0, despesasOperacionais: 0, numeroDeVendas: 0, custosVariaveis: 0, outrasReceitasDespesas: 0 });
            
            monthData.faturamento = totals.faturamento;
            monthData.despesasOperacionais = totals.despesasOperacionais;
            monthData.numeroDeVendas = totals.numeroDeVendas;
            monthData.custosVariaveis = totals.custosVariaveis;
            monthData.outrasReceitasDespesas = totals.outrasReceitasDespesas;
        } else {
            monthData.faturamento = 0;
            monthData.despesasOperacionais = 0;
            monthData.numeroDeVendas = 0;
            monthData.custosVariaveis = 0;
            monthData.outrasReceitasDespesas = 0;
        }
    }
}

function showFieldDescription(fieldName) {
    const description = FIELD_DESCRIPTIONS[fieldName];
    if (description) {
        monthlyFieldText.innerHTML = `<strong>${fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim()}:</strong> ${description}`;
        monthlyFieldInfoBox.style.display = 'flex';
    }
}

function loadYearData(year) {
    const tableBody = document.querySelector('#monthly-inputs tbody');
    tableBody.innerHTML = '';
    
    if (!financialData[year]) financialData[year] = {};

    const yearData = financialData[year];
    const isManualEditAllowed = allowManualEditCheckbox.checked;

    MONTHS.forEach((month, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${month}</td>`;
        
        if (!yearData[index]) yearData[index] = { dailyEntries: [] };
        const monthData = yearData[index];

        INPUT_FIELDS.forEach(field => {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.dataset.month = index;
            input.dataset.field = field;
            input.value = monthData[field] || '';
            input.placeholder = "0.00";

            const isAutoCalculatedField = ['faturamento', 'despesasOperacionais', 'numeroDeVendas', 'custosVariaveis', 'outrasReceitasDespesas'].includes(field);
            input.readOnly = isAutoCalculatedField && !isManualEditAllowed;

            input.addEventListener('focus', () => showFieldDescription(field));

            td.appendChild(input);
            row.appendChild(td);
        });
        tableBody.appendChild(row);
    });
}

function calculateIndicators(data = {}) {
    const inputs = {}; INPUT_FIELDS.forEach(field => inputs[field] = data[field] || 0);
    const {faturamento, custosVariaveis, custosFixos, despesasOperacionais, outrasReceitasDespesas, numeroDeVendas, impostos, depreciacao, investimentos, financiamentosEntradas, amortizacaoDividas, aporteSocios, distribuicaoLucros} = inputs;
    const lucroBruto = faturamento - custosVariaveis;
    const lucroOperacional = lucroBruto - custosFixos - despesasOperacionais;
    const lucroAntesImpostos = lucroOperacional + outrasReceitasDespesas;
    const lucroLiquido = lucroAntesImpostos - impostos;
    const margemLiquida = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;
    const markup = custosVariaveis > 0 ? ((faturamento - custosVariaveis) / custosVariaveis) * 100 : 0;
    
    const custosFixosTotais = custosFixos + despesasOperacionais;
    const indiceMargemContribuicao = faturamento > 0 ? 1 - (custosVariaveis / faturamento) : 0;
    const pontoEquilibrio = indiceMargemContribuicao > 0 ? custosFixosTotais / indiceMargemContribuicao : 0;

    const fluxoCaixaOperacional = lucroLiquido + depreciacao;
    const fluxoCaixaInvestimentos = -investimentos;
    const fluxoCaixaFinanciamentos = financiamentosEntradas - amortizacaoDividas + aporteSocios - distribuicaoLucros;
    const fluxoCaixaLivre = fluxoCaixaOperacional + fluxoCaixaInvestimentos + fluxoCaixaFinanciamentos;
    
    return { 
        lucroLiquido, margemLiquida, markup, pontoEquilibrio,
        fluxoCaixaOperacional, fluxoCaixaInvestimentos, fluxoCaixaFinanciamentos, fluxoCaixaLivre, 
        faturamento, custosTotais: custosFixos + custosVariaveis + despesasOperacionais,
        custosVariaveis, numeroDeVendas
    };
}

function generateBusinessAdvice(indicators, settings) {
    const adviceList = [];
    const { benchmarkMargem = 0, benchmarkCustos = 0, benchmarkMarkup = 0, businessType } = settings;
    if (benchmarkMargem > 0 && indicators.margemLiquida < benchmarkMargem) {
        let conselho = { titulo: "Margem Líquida Abaixo da Meta", texto: `Sua margem líquida (${formatPercent(indicators.margemLiquida)}) está abaixo da sua meta de ${formatPercent(benchmarkMargem)}. Isso significa que os custos e despesas estão consumindo uma fatia muito grande do seu faturamento.`};
        if (businessType === 'varejo' || businessType === 'ecommerce') conselho.acao = "Crie um programa de fidelidade para aumentar a recorrência. Uma <strong>landing page</strong> para capturar emails e uma estratégia de email marketing podem ajudar a aumentar as vendas para a mesma base de clientes.";
        else conselho.acao = "Revise sua precificação. Utilize suas <strong>redes sociais</strong> para comunicar o valor agregado do seu serviço, justificando um preço maior.";
        adviceList.push(conselho);
    }
    if (benchmarkMarkup > 0 && indicators.markup < benchmarkMarkup) {
        adviceList.push({ titulo: "Markup Abaixo da Meta", texto: `Seu markup médio (${formatPercent(indicators.markup)}) está abaixo do mínimo desejado de ${formatPercent(benchmarkMarkup)}. Isso impacta diretamente sua capacidade de gerar lucro bruto.`, acao: "Otimize sua precificação. Se vender online, utilize um <strong>e-commerce</strong> que permita testes A/B de preços. Considere também vender em <strong>marketplaces</strong> para alcançar um público maior." });
    }
    const custoVariavelPercent = indicators.faturamento > 0 ? (indicators.custosTotais / indicators.faturamento) * 100 : 0;
    if (benchmarkCustos > 0 && custoVariavelPercent > benchmarkCustos) {
         adviceList.push({ titulo: "Custos Totais Elevados", texto: `Seus custos totais representam ${formatPercent(custoVariavelPercent)} do faturamento, acima da sua meta de ${formatPercent(benchmarkCustos)}.`, acao: "Busque renegociar com seus fornecedores e revise suas despesas fixas. Considere um sistema de gestão (ERP) simples para controlar melhor as compras. A criação de um <strong>site institucional</strong> pode atrair novos fornecedores." });
    }
    if (adviceList.length === 0) {
        adviceList.push({ titulo: "Parabéns, seus indicadores estão ótimos!", texto: "Todos os seus principais indicadores estão dentro das metas que você definiu. Continue monitorando para manter o bom desempenho.", acao: "O próximo passo pode ser a expansão. Use o tráfego pago nas <strong>redes sociais</strong> para testar novos públicos ou explore a venda em novos canais, como um <strong>e-commerce</strong> próprio." });
    }
    return adviceList;
}

function updateAllCalculations() { 
    if (!allowManualEditCheckbox.checked) {
        aggregateDailyData(currentYear);
    }
    loadYearData(currentYear);
    renderMonthlyIndicators(); 
    renderAnnualIndicators(); 
}
    
function renderMonthlyIndicators() {
    const tableBody = document.querySelector('#monthly-indicators-table tbody');
    tableBody.innerHTML = '';
    const yearData = financialData[currentYear] || {};
    MONTHS.forEach((month, index) => {
        const indicators = calculateIndicators(yearData[index]);
        const row = document.createElement('tr');
        row.innerHTML = `<td>${month}</td><td class="${indicators.lucroLiquido >= 0 ? 'positive' : 'negative'}">${formatCurrency(indicators.lucroLiquido)}</td><td class="${indicators.margemLiquida >= 0 ? 'positive' : 'negative'}">${formatPercent(indicators.margemLiquida)}</td><td class="${indicators.markup >= 0 ? 'positive' : 'negative'}">${formatPercent(indicators.markup)}</td><td class="${indicators.fluxoCaixaOperacional >= 0 ? 'positive' : 'negative'}">${formatCurrency(indicators.fluxoCaixaOperacional)}</td><td class="${indicators.fluxoCaixaInvestimentos >= 0 ? 'positive' : 'negative'}">${formatCurrency(indicators.fluxoCaixaInvestimentos)}</td><td class="${indicators.fluxoCaixaFinanciamentos >= 0 ? 'positive' : 'negative'}">${formatCurrency(indicators.fluxoCaixaFinanciamentos)}</td><td class="${indicators.fluxoCaixaLivre >= 0 ? 'positive' : 'negative'}"><strong>${formatCurrency(indicators.fluxoCaixaLivre)}</strong></td>`;
        tableBody.appendChild(row);
    });
}

async function renderAnnualIndicators() {
    const container = document.getElementById('annual-indicators-content');
    container.innerHTML = '';
    const yearData = financialData[currentYear] || {};
    let annualTotals = {}; 
    INPUT_FIELDS.forEach(field => annualTotals[field] = 0);
    let monthsWithDataCount = 0;
    for(let i=0; i<12; i++) { 
        if(yearData[i]) {
            INPUT_FIELDS.forEach(field => annualTotals[field] += yearData[i][field] || 0);
            if((yearData[i].faturamento > 0) || (yearData[i].custosVariaveis > 0) || (yearData[i].custosFixos > 0)) monthsWithDataCount++;
        }
    }
    const divisor = monthsWithDataCount > 0 ? monthsWithDataCount : 1;
    const annualIndicators = calculateIndicators(annualTotals);

    const displayIndicators = { ...annualIndicators };
    displayIndicators.faturamentoMedio = (annualTotals.faturamento / divisor) || 0;
    displayIndicators.volumeVendasMedio = (annualTotals.numeroDeVendas / divisor) || 0;
    displayIndicators.cmv = annualTotals.custosVariaveis; 
    displayIndicators.pontoEquilibrioMedio = (annualIndicators.pontoEquilibrio / divisor) || 0;

    const categories = {
        "Desempenho de Vendas": ['faturamentoMedio', 'volumeVendasMedio'],
        "Rentabilidade e Lucro": ['lucroLiquido', 'margemLiquida', 'markup', 'cmv', 'pontoEquilibrioMedio'],
        "Fluxo de Caixa": ['fluxoCaixaLivre', 'fluxoCaixaOperacional', 'fluxoCaixaInvestimentos', 'fluxoCaixaFinanciamentos']
    };

    for (const categoryName in categories) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'card-category';
        categoryDiv.innerHTML = `<h2>${categoryName}</h2>`;
        const gridDiv = document.createElement('div');
        gridDiv.className = 'indicators-grid';
        categories[categoryName].forEach(key => {
            const glossaryKey = key === 'cmv' ? 'custosVariaveis' : (key === 'pontoEquilibrioMedio' ? 'pontoEquilibrio' : key);
            const cardTitle = key === 'cmv' ? 'Custo da Mercadoria Vendida (CMV)' : (key === 'pontoEquilibrioMedio' ? 'Ponto de Equilíbrio Médio' : GLOSSARY_DATA[glossaryKey]?.nome);
            const indicatorInfo = GLOSSARY_DATA[glossaryKey];
            if (!indicatorInfo) return;
            const value = displayIndicators[key];
            let formattedValue;
            if(key === 'volumeVendasMedio'){ formattedValue = (value || 0).toFixed(1).replace('.', ','); } 
            else if (key.includes('margem') || key.includes('markup')) { formattedValue = formatPercent(value); } 
            else { formattedValue = formatCurrency(value); }
            gridDiv.innerHTML += `<div class="card"><h3>${cardTitle}</h3><div class="value ${value >= 0 ? 'positive' : 'negative'}">${formattedValue}</div><p class="explanation">${indicatorInfo.significado}</p></div>`;
        });
        categoryDiv.appendChild(gridDiv);
        container.appendChild(categoryDiv);
    }
    
    const adviceContainer = document.getElementById('advice-container');
    if(userSettings && userSettings.businessType){
        const adviceList = generateBusinessAdvice(annualIndicators, userSettings);
        adviceContainer.innerHTML = '';
        adviceList.forEach(advice => {
            const adviceCard = document.createElement('div');
            adviceCard.className = 'card';
            adviceCard.innerHTML = `<h3>${advice.titulo}</h3><p>${advice.texto}</p><hr style="margin: 10px 0;"><p><strong>Ação Sugerida:</strong> ${advice.acao}</p>`;
            adviceContainer.appendChild(adviceCard);
        });
    } else {
        adviceContainer.innerHTML = `<p>Preencha suas metas na aba 'Configurações' para receber conselhos personalizados.</p>`;
    }
}
    
let chartInstances = {};
function renderAllCharts() {
    const yearData = financialData[currentYear] || {};
    const labels = MONTHS;
    const chartData = { faturamento: [], custosTotais: [], lucroLiquido: [], fluxoCaixaLivre: [] };
    for(let i=0; i<12; i++) {
        const indicators = calculateIndicators(yearData[i]);
        chartData.faturamento.push(indicators.faturamento);
        chartData.custosTotais.push(indicators.custosTotais);
        chartData.lucroLiquido.push(indicators.lucroLiquido);
        chartData.fluxoCaixaLivre.push(indicators.fluxoCaixaLivre);
    }
    const chartConfigs = {
        monthlyEvolutionChart: { type: 'line', data: { labels, datasets: [ { label: 'Faturamento', data: chartData.faturamento, borderColor: '#0a9396', fill: false, tension: 0.1 }, { label: 'Custos Totais', data: chartData.custosTotais, borderColor: '#e76f51', fill: false, tension: 0.1 }, { label: 'Lucro Líquido', data: chartData.lucroLiquido, borderColor: '#2a9d8f', fill: false, tension: 0.1 } ]}},
        cashFlowChart: { type: 'bar', data: { labels, datasets: [ { label: 'Fluxo de Caixa Livre', data: chartData.fluxoCaixaLivre, backgroundColor: (ctx) => (ctx.raw >= 0 ? '#2a9d8f' : '#e76f51') } ]}}
    };
    for (const id in chartConfigs) {
        if(chartInstances[id]) chartInstances[id].destroy();
        const canvas = document.getElementById(id);
        if(canvas) chartInstances[id] = new Chart(canvas.getContext('2d'), chartConfigs[id]);
    }
}

// CORREÇÃO DE SEGURANÇA (XSS): Usando createElement em vez de innerHTML
function renderDailyEntries(year, month) {
    const tableBody = document.querySelector('#daily-entries-table tbody');
    tableBody.innerHTML = ''; // Limpa a tabela
    
    if (!financialData[year] || !financialData[year][month] || !financialData[year][month].dailyEntries) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7">Nenhum lançamento para este mês.</td>';
        tableBody.appendChild(tr);
        return;
    }

    const entries = financialData[year][month].dailyEntries;
    if (entries.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7">Nenhum lançamento para este mês.</td>';
        tableBody.appendChild(tr);
        return;
    }
    
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    entries.forEach((entry, index) => {
        const row = document.createElement('tr');
        
        // Cria cada célula de forma segura
        const createCell = (text) => {
            const td = document.createElement('td');
            td.textContent = text;
            return td;
        };

        const formattedDate = new Date(entry.date + 'T00:00:00-03:00').toLocaleDateString('pt-BR');

        row.appendChild(createCell(formattedDate));
        row.appendChild(createCell(formatCurrency(parseFloat(entry.faturamento))));
        row.appendChild(createCell(formatCurrency(parseFloat(entry.despesas))));
        row.appendChild(createCell(formatCurrency(parseFloat(entry.comissao))));
        row.appendChild(createCell(formatCurrency(parseFloat(entry.outras))));
        row.appendChild(createCell(entry.vendas));

        // Botões de ação (HTML seguro pois é controlado por nós)
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `<button class="action-btn edit-btn" onclick="handleEditDailyEntry(${year}, ${month}, ${index})">Editar</button><button class="action-btn delete-btn" onclick="handleDeleteDailyEntry(${year}, ${month}, ${index})">Excluir</button>`;
        row.appendChild(actionsTd);

        tableBody.appendChild(row);
    });
}

function renderGlossary() {
    const container = document.getElementById('glossary-container');
    container.innerHTML = '';
    Object.keys(GLOSSARY_DATA).sort((a,b) => GLOSSARY_DATA[a].nome.localeCompare(GLOSSARY_DATA[b].nome)).forEach(key => {
        const item = GLOSSARY_DATA[key];
        const div = document.createElement('div');
        div.className = 'glossary-item';
        div.innerHTML = `<div class="glossary-header">${item.nome}</div><div class="glossary-content"><div><p><strong>Fórmula:</strong> ${item.formula}</p><p><strong>Significado:</strong> ${item.significado}</p><p><strong>Exemplo:</strong> ${item.exemplo}</p><p><strong>Dica:</strong> ${item.dica}</p></div></div>`;
        container.appendChild(div);
    });
    container.querySelectorAll('.glossary-header').forEach(header => {
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });
}
    
function exportMonthlyToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Indicadores Mensais - ${currentYear}`, 14, 15);
    doc.autoTable({ html: '#monthly-indicators-table', startY: 20, theme: 'grid', headStyles: { fillColor: [0, 95, 115] } });
    doc.save(`Indicadores_${currentYear}.pdf`);
}
function exportMonthlyToExcel() {
    const wb = XLSX.utils.table_to_book(document.getElementById('monthly-indicators-table'), {sheet: 'Indicadores Mensais'});
    XLSX.writeFile(wb, `Indicadores_${currentYear}.xlsx`);
}

const formatCurrency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPercent = (v) => (v || 0).toFixed(2).replace('.', ',') + '%';


// --- ATRIBUIÇÃO DE EVENTOS ---
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
resetPasswordForm.addEventListener('submit', handlePasswordReset);
forgotPasswordLink.addEventListener('click', () => toggleForms('reset'));
toggleFormsLinks.forEach(link => {
    link.addEventListener('click', (e) => toggleForms(e.target.dataset.form));
});
logoutBtn.addEventListener('click', () => auth.signOut());
deleteAccountBtn.addEventListener('click', deleteAccountAndData);
saveDataBtn.addEventListener('click', saveMonthlyData);
saveSettingsBtn.addEventListener('click', saveBusinessSettings);
recalculateAllBtn.addEventListener('click', updateAllCalculations);

// Eventos de Backup
btnBackupLocal.addEventListener('click', exportLocalBackup);
btnRestoreLocal.addEventListener('click', () => inputRestoreFile.click());
inputRestoreFile.addEventListener('change', importLocalBackup);

// Evento da aba Diagnóstico
diagnosisForm.addEventListener('submit', saveDiagnosisData);

// Evento da Nova Aba Consultor
saveConsultantDiagnosisBtn.addEventListener('click', saveConsultantDiagnosis);

// Evento de Desbloqueio
btnGenerateUnlockCode.addEventListener('click', handleUnlockTabs);

// Eventos XLSX (Novos)
btnExportCompanyXLSX.addEventListener('click', handleExportCompanyXLSX);
btnImportCompanyXLSX.addEventListener('change', handleImportCompanyXLSX);
btnExportDailyXLSX.addEventListener('click', handleExportDailyXLSX);
btnImportDailyXLSX.addEventListener('change', handleImportDailyXLSX);
btnExportMonthlyXLSX.addEventListener('click', handleExportMonthlyXLSX);
btnImportMonthlyXLSX.addEventListener('change', handleImportMonthlyXLSX);
document.getElementById('export-excel-monthly').addEventListener('click', exportMonthlyToExcel); // Existente

mainNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        const tabId = e.target.dataset.tab;
        document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
        if (tabId === 'evolucao') renderAllCharts();
        if (tabId === 'indicadores-anuais') renderAnnualIndicators();
        if (tabId === 'entradas-diarias') {
            const selectedMonth = parseInt(dailyMonthSelector.value);
            renderDailyEntries(currentYear, selectedMonth);
        }
    }
});

yearSelector.addEventListener('change', (e) => {
    currentYear = parseInt(e.target.value);
    updateAllCalculations();
    const selectedMonth = parseInt(dailyMonthSelector.value);
    renderDailyEntries(currentYear, selectedMonth);
});

allowManualEditCheckbox.addEventListener('change', () => {
    updateAllCalculations();
});

recalculateAnnualBtn.addEventListener('click', renderAnnualIndicators);
exportPdfMonthlyBtn.addEventListener('click', exportMonthlyToPDF);


// *** FUNÇÕES E EVENTOS DA ABA DIÁRIA ***

function handleEditDailyEntry(year, month, index) {
    currentlyEditingIndex = { year, month, index };
    const entry = financialData[year][month].dailyEntries[index];
    
    document.getElementById('daily-date').value = entry.date;
    document.getElementById('daily-faturamento').value = entry.faturamento;
    document.getElementById('daily-despesas').value = entry.despesas;
    document.getElementById('daily-comissao').value = entry.comissao || '';
    document.getElementById('daily-outras').value = entry.outras || '';
    document.getElementById('daily-vendas').value = entry.vendas;
    
    document.querySelector('#daily-entry-form button[type="submit"]').textContent = 'Atualizar Lançamento';
    cancelEditBtn.style.display = 'block';
    dailyEntryForm.scrollIntoView({ behavior: 'smooth' });
}

async function handleDeleteDailyEntry(year, month, index) {
    if (confirm('Tem certeza de que deseja excluir este lançamento?')) {
        financialData[year][month].dailyEntries.splice(index, 1);
        
        await saveDataToFirestore(currentUser.uid, financialData, 'financialData');
        updateAllCalculations();
        renderDailyEntries(year, month);

        dailyMessageEl.textContent = 'Lançamento excluído com sucesso!';
        setTimeout(() => dailyMessageEl.textContent = '', 3000);
    }
}

function resetDailyFormState() {
    currentlyEditingIndex = null;
    dailyEntryForm.reset();
    document.querySelector('#daily-entry-form button[type="submit"]').textContent = 'Adicionar Lançamento';
    cancelEditBtn.style.display = 'none';
}

cancelEditBtn.addEventListener('click', resetDailyFormState);

dailyMonthSelector.addEventListener('change', (e) => {
    const selectedMonth = parseInt(e.target.value);
    renderDailyEntries(currentYear, selectedMonth);
});

dailyEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('daily-date').value;
    const faturamento = document.getElementById('daily-faturamento').value;
    const despesas = document.getElementById('daily-despesas').value;
    const comissao = document.getElementById('daily-comissao').value;
    const outras = document.getElementById('daily-outras').value;
    const vendas = document.getElementById('daily-vendas').value;
    const month = parseInt(dailyMonthSelector.value);
    
    let message = '';

    const newEntry = { date, faturamento, despesas, comissao, outras, vendas };

    if (currentlyEditingIndex !== null) {
        const { year, month: editMonth, index } = currentlyEditingIndex;
        financialData[year][editMonth].dailyEntries[index] = newEntry;
        message = 'Lançamento atualizado com sucesso!';
    } else {
        if (!financialData[currentYear]) financialData[currentYear] = {};
        if (!financialData[currentYear][month]) {
            financialData[currentYear][month] = { dailyEntries: [] };
        } else if (!financialData[currentYear][month].dailyEntries) {
            financialData[currentYear][month].dailyEntries = [];
        }
        
        financialData[currentYear][month].dailyEntries.push(newEntry);
        message = 'Lançamento adicionado com sucesso!';
    }
    
    await saveDataToFirestore(currentUser.uid, financialData, 'financialData');
    updateAllCalculations();
    renderDailyEntries(currentYear, month);
    
    resetDailyFormState();
    dailyMessageEl.textContent = message;
    setTimeout(() => dailyMessageEl.textContent = '', 3000);
});

// --- INICIALIZAÇÃO ---
initialize();