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

// URL do Cloudflare Worker que faz a busca de leads sem expor a chave da
// Serper API no navegador (ver cloudflare-proxy/README — ou a seção
// correspondente no README principal). Preencha após o deploy do worker.
const LEAD_SEARCH_PROXY_URL = "https://leadscraper-proxy.SEU-USUARIO.workers.dev";
