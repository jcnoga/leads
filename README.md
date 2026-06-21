PODE RODAR COM ESSA RUL:  https://leadscraperpro.web.app



# LeadScraper Pro

Prospecção de leads (Google Maps via Serper API) com gestão de créditos, qualificação automática, mensagens de WhatsApp e painel administrativo — rodando inteiramente em planos gratuitos: **Firebase Spark** (Auth + Firestore + Hosting) e **Cloudflare Workers** (proxy que esconde a chave da API de busca).

Não precisa de cartão de crédito em lugar nenhum.

Leia também:
- `AUDITORIA.md` — relatório dos bugs/vulnerabilidades do app original e o que foi corrigido.
- `PLANO-GRATUITO.md` — o que mudou para tirar a dependência do plano pago do Firebase e os trade-offs envolvidos.

## Estrutura do projeto

```
leadscraper-pro/
├── index.html                # interface (raiz = pasta publicada no Firebase Hosting)
├── style.css                  # design system "Radar de Sinal"
├── script.js                   # lógica do frontend
├── firebase-config.js         # config pública do Firebase + URL do proxy (preencher)
├── firestore.rules            # regras de segurança (créditos, admin, etc.)
├── firestore.indexes.json     # índices compostos necessários
├── firebase.json              # configuração de hosting/firestore
├── .firebaserc                  # ID do projeto Firebase (preencher)
└── cloudflare-proxy/
    ├── worker.js                # proxy que esconde a chave da Serper API
    └── wrangler.toml
```

## Pré-requisitos

- Conta gratuita no [Firebase](https://console.firebase.google.com) (plano **Spark**, sem cartão).
- Conta gratuita no [Cloudflare](https://dash.cloudflare.com/sign-up) (Workers, sem cartão).
- Uma chave de API em [serper.dev](https://serper.dev) (tem cota gratuita mensal).
- Node.js 20+ instalado localmente.

## 1. Criar o projeto Firebase

1. Crie um projeto em console.firebase.google.com. **Não é preciso fazer upgrade para Blaze** — deixe no plano Spark.
2. Ative **Authentication** → método **E-mail/senha**.
3. Ative **Firestore Database** (modo produção).
4. Em **Configurações do projeto → Geral → Seus apps**, crie um app Web e copie o objeto `firebaseConfig`.

## 2. Configurar o projeto local

```bash
npm install -g firebase-tools
firebase login

cd leadscraper-pro
firebase use --add        # selecione o projeto criado e confirme o alias "default"
```

Edite `.firebaserc` e confirme que o `projectId` corresponde ao seu projeto.

Edite `firebase-config.js` e substitua os valores de exemplo pelos do seu app Web (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

## 3. Publicar o proxy de busca no Cloudflare Workers

```bash
npm install -g wrangler
wrangler login

cd cloudflare-proxy
wrangler secret put SERPER_API_KEY
# cole a chave da serper.dev quando solicitado

wrangler secret put FIREBASE_API_KEY
# cole o mesmo "apiKey" usado em firebase-config.js (não é secreto por
# natureza, mas fica mais organizado guardá-lo como secret do worker)

wrangler deploy
```

O comando final mostra a URL publicada (algo como `https://leadscraper-proxy.SEU-USUARIO.workers.dev`). Copie essa URL e cole na constante `LEAD_SEARCH_PROXY_URL` em `firebase-config.js`.

Antes de divulgar o app, edite `cloudflare-proxy/wrangler.toml` e troque `ALLOWED_ORIGIN = "*"` pela URL real do seu site publicado (ex: `https://seuprojeto.web.app`), depois rode `wrangler deploy` de novo.

## 4. Deploy do Firebase

```bash
cd .. # voltar para a raiz do projeto (fora de cloudflare-proxy)

firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting
```

Após o deploy, o Firebase mostra a URL pública (algo como `https://SEU_PROJETO.web.app`).

## 5. Primeiro acesso e primeiro administrador

1. Acesse a URL publicada e crie sua conta normalmente em "Criar conta".
2. Como não há mais um e-mail de bootstrap automático, promova essa primeira conta a administrador manualmente, uma única vez:
   - No Console do Firebase, vá em **Firestore Database → Dados**.
   - Abra a coleção `users` e encontre o documento com o seu `uid` (o e-mail aparece no campo `email`).
   - Edite o campo `isAdmin` de `false` para `true`.
3. Faça login novamente (ou recarregue a página) — a aba "Administração" aparecerá em Configurações. A partir daí, use a própria interface para promover outros administradores ou conceder créditos.

## Atualizações futuras

- **Frontend** (`index.html`, `style.css`, `script.js`, `firebase-config.js`): `firebase deploy --only hosting`.
- **Regras de segurança**: sempre que mudar `firestore.rules`, rode `firebase deploy --only firestore:rules`.
- **Proxy de busca**: sempre que mudar `cloudflare-proxy/worker.js`, rode `wrangler deploy` de dentro da pasta `cloudflare-proxy`.

## Local/testes (opcional)

```bash
firebase emulators:start --only auth,firestore,hosting
```

Sobe Auth, Firestore e Hosting localmente. O proxy do Cloudflare Workers não tem emulador equivalente simples — para testar a busca de leads localmente, aponte `LEAD_SEARCH_PROXY_URL` para o Worker já publicado em produção (ele aceita chamadas de qualquer origem enquanto `ALLOWED_ORIGIN` estiver como `"*"`).
