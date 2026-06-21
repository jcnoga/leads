# LeadScraper Pro

Prospecção de leads (Google Maps via Serper API) com gestão de créditos, qualificação automática, mensagens de WhatsApp e painel administrativo — backend 100% seguro em Cloud Functions, dados em Firestore.

Veja `AUDITORIA.md` para o relatório completo dos bugs/vulnerabilidades encontrados no código original e o que foi corrigido.

## Estrutura do projeto

```
leadscraper-pro/
├── index.html              # interface (raiz = pasta publicada no Firebase Hosting)
├── style.css                # design system "Radar de Sinal"
├── script.js                 # lógica do frontend
├── firebase-config.js       # config pública do Firebase (preencher)
├── firestore.rules          # regras de segurança
├── firestore.indexes.json   # índices compostos necessários
├── firebase.json            # configuração de hosting/functions/firestore
├── .firebaserc               # ID do projeto Firebase (preencher)
└── functions/
    ├── index.js              # Cloud Functions (créditos, admin, busca de leads)
    └── package.json
```

## Pré-requisitos

- Conta no [Firebase](https://console.firebase.google.com) com plano **Blaze** (pay-as-you-go) — necessário para Cloud Functions chamarem APIs externas (a Serper). O uso típico desta ferramenta fica dentro da faixa gratuita do Blaze.
- Node.js 20+ e `npm` instalados localmente.
- Uma chave de API em [serper.dev](https://serper.dev).

## 1. Criar o projeto Firebase

1. Crie um projeto em console.firebase.google.com.
2. Ative **Authentication** → método **E-mail/senha**.
3. Ative **Firestore Database** (modo produção, escolha a região `southamerica-east1` para ficar junto das Functions).
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

Se quiser usar o e-mail de administrador padrão (promovido automaticamente no primeiro cadastro), edite a constante `ADMIN_BOOTSTRAP_EMAIL` em `functions/index.js` antes do deploy. Qualquer outro usuário pode ser promovido depois pela própria tela de administração.

## 3. Configurar a chave da Serper API (nunca vai para o cliente)

```bash
cd functions
npm install
firebase functions:secrets:set SERPER_API_KEY
# cole a chave da serper.dev quando solicitado
cd ..
```

## 4. Deploy

```bash
# Regras e índices do Firestore
firebase deploy --only firestore:rules,firestore:indexes

# Cloud Functions
firebase deploy --only functions

# Hosting (interface)
firebase deploy --only hosting
```

Após o deploy, o Firebase mostra a URL pública (algo como `https://SEU_PROJETO.web.app`).

## 5. Primeiro acesso

1. Acesse a URL publicada e clique em "Criar conta" usando o e-mail definido em `ADMIN_BOOTSTRAP_EMAIL`.
2. Essa conta já nasce como superadministrador e recebe os créditos iniciais padrão.
3. Em **Configurações → Administração**, ajuste o limite de leads por busca, adicione créditos para outros usuários ou promova novos administradores.

## Atualizações futuras

- **Frontend** (`index.html`, `style.css`, `script.js`, `firebase-config.js`): `firebase deploy --only hosting`.
- **Backend** (`functions/index.js`): `firebase deploy --only functions`.
- **Regras de segurança**: sempre que mudar `firestore.rules`, rode `firebase deploy --only firestore:rules`.

## Local/testes (opcional)

```bash
firebase emulators:start
```

Os emuladores sobem Auth, Firestore, Functions e Hosting localmente — útil para testar mudanças sem afetar dados reais. Lembre de configurar `firebase-config.js` para apontar para os emuladores caso use esse fluxo (não incluído por padrão neste pacote, para manter o deploy de produção simples).
