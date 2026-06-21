/**
 * Configuração do Firebase
 * -----------------------------------------------------------------------
 * Substitua os valores abaixo pelas credenciais do SEU projeto Firebase:
 * Console Firebase → ⚙️ Configurações do projeto → Geral → "Seus apps" →
 * app Web → ícone </> → copie o objeto firebaseConfig.
 *
 * Esses valores (apiKey, authDomain etc.) NÃO são secretos — são seguros
 * para ficarem no código do cliente. A segurança real do projeto vem das
 * Firestore Rules (firestore.rules) e das Cloud Functions (functions/),
 * não da ocultação deste objeto.
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

// Região das Cloud Functions — precisa bater com a REGION definida em functions/index.js
const FUNCTIONS_REGION = "southamerica-east1";
