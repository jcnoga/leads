/**
 * Configuração do Firebase
 * -----------------------------------------------------------------------
 * Substitua os valores abaixo pelas credenciais do SEU projeto Firebase:
 * Console Firebase → ⚙️ Configurações do projeto → Geral → "Seus apps" →
 * app Web → ícone </> → copie o objeto firebaseConfig.
 *
 * Esses valores (apiKey, authDomain etc.) NÃO são secretos — são seguros
 * para ficarem no código do cliente. A segurança real do projeto vem das
 * Firestore Rules (firestore.rules).
 *
 * Este projeto roda inteiramente no plano gratuito (Spark) do Firebase —
 * sem Cloud Functions, não é necessário cadastrar cartão de crédito.
 * -----------------------------------------------------------------------
 */
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};

firebase.initializeApp(firebaseConfig);

// URL do Cloudflare Worker que faz a busca de leads sem expor a chave da
// Serper API no navegador (ver cloudflare-proxy/README — ou a seção
// correspondente no README principal). Preencha após o deploy do worker.
const LEAD_SEARCH_PROXY_URL = "https://leadscraper-proxy.SEU-USUARIO.workers.dev";
