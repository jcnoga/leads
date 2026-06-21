# Auditoria de segurança e funcionalidade — LeadScraper Pro

Relatório da revisão completa do código original (`scripts.js`, `index.html`, `style.css`) e da reescrita entregue neste pacote. Cada item indica a causa raiz encontrada e a correção aplicada.

## 1. Vulnerabilidades de segurança

### 1.1 Chave da API de leads exposta no navegador (crítico)
**Causa raiz:** em `scripts.js`, `API_KEYS.KEY_1` continha a chave da Serper API em texto puro, visível para qualquer pessoa em "Ver código-fonte" — e também ficaria exposta para sempre no histórico do Git assim que o projeto fosse versionado. Qualquer pessoa poderia copiar a chave e gerar custos na sua conta.
**Correção:** a busca de leads agora roda inteiramente no servidor (`functions/index.js`, função `searchLeads`), usando um *Secret* do Cloud Functions (`SERPER_API_KEY`). O navegador nunca recebe a chave — só envia nicho/cidade/UF/bairro/quantidade e recebe os resultados já prontos.

### 1.2 Falha de autorização nos campos `credits` e `isAdmin` (crítico)
**Causa raiz:** o código original escrevia `credits` e `isAdmin` diretamente no Firestore a partir do navegador (`db.collection('users').doc(uid).update({credits: ...})`). Sem regras de segurança restritivas, qualquer usuário autenticado poderia abrir o console do navegador e se autopromover a administrador ou zerar/inflar o próprio saldo. Não havia visibilidade das regras de segurança do projeto original para confirmar se isso estava de fato bloqueado — e mesmo que estivesse, isso é exatamente a causa do problema descrito a seguir.
**Correção:** `firestore.rules` agora impede explicitamente qualquer escrita do cliente que aumente `credits` ou altere `isAdmin`/`email` no próprio documento — um usuário comum só pode *diminuir* o próprio saldo (gasto em busca), nunca abaixo de zero. Alterações em nome de outro usuário (conceder créditos, promover a admin) só são aceitas se quem está fazendo a requisição já for administrador — verificado pela própria regra, lendo o documento do autor da chamada, não o documento-alvo. Essa validação roda nos servidores do Firebase (não no navegador), então não pode ser burlada manipulando o código do cliente. *(Nota: a primeira versão entregue deste projeto fazia essa validação por dentro de Cloud Functions com o Admin SDK; a versão atual, adaptada para rodar sem o plano pago do Firebase, faz a mesma validação diretamente nas regras do Firestore — ver `PLANO-GRATUITO.md`.)*

### 1.3 Causa raiz dos botões de crédito "que não funcionavam"
Esses dois pontos acima explicam o sintoma relatado no briefing: com regras de segurança corretas (como deveriam estar), a escrita direta do cliente em `credits`/`isAdmin` em nome de outro usuário, ou um aumento indevido do próprio saldo, é negada pelo Firestore — e como o código original não tinha nenhum `try/catch` em `consumeCredits`, `addCreditsToUser` ou `addSelfCredits`, a Promise rejeitada simplesmente não fazia nada visível: o botão "+10 leads (meu saldo)" e o botão "Adicionar créditos" pareciam travados, sem nenhum erro na tela. A correção do item 1.2 resolve a causa raiz; a nova interface também exibe mensagens de erro reais (`admin-self-msg`, `admin-credits-msg`) em vez de falhar em silêncio.

### 1.4 Bug de caixa alta/baixa em e-mail (causa de "usuário não encontrado")
**Causa raiz:** o cadastro salvava `email` exatamente como o usuário digitou (sem normalização), e a busca do admin usava `where('email','==', email)` com correspondência exata. Um cadastro feito como `Maria@Gmail.com` nunca seria encontrado se o admin digitasse `maria@gmail.com` (ou vice-versa) — resultando no alerta genérico "Usuário não encontrado", sem indicar a causa real.
**Correção:** o e-mail agora é normalizado para minúsculas tanto na criação da conta (gatilho `onUserCreate`, server-side) quanto em toda consulta administrativa (`normalizeEmail()` em `functions/index.js`).

## 2. Bugs funcionais

### 2.1 Botão "+10 leads" na verdade adicionava 150
**Causa raiz:** o `onclick` do botão chamava `addSelfCredits(150)`, mas o texto do botão dizia "+10 leads". Rótulo e comportamento nunca bateram.
**Correção:** a função que processa esse botão sempre adiciona exatamente 10 créditos, batendo com o texto do botão. Quantidades diferentes de crédito (para outros usuários) têm seu próprio fluxo dedicado, com campo de quantidade explícito na tela.

### 2.2 Limite de busca preso a ~20 resultados, mesmo pedindo 100+
**Causa raiz:** `fetchSerperLeads` fazia uma única chamada à API e cortava o array com `.slice(0, limit)` — pedir 100 ou 150 não tinha efeito porque a API só devolve cerca de 20 resultados por chamada.
**Correção:** a busca agora pagina automaticamente (parâmetro `page` da Serper, até 30 páginas), deduplicando por `cid` da empresa e, como reforço, por nome+endereço. Para assim que atingir o limite pedido (até o teto configurado pelo admin) ou quando a API parar de devolver resultados novos. Essa lógica roda no proxy (`cloudflare-proxy/worker.js`), que também é quem protege a chave da Serper.

### 2.3 Atualizações de crédito sem transação (condição de corrida)
**Causa raiz:** `consumeCredits`/`addCreditsToUser` liam o saldo, somavam em JavaScript e gravavam de volta — duas operações simultâneas (duas abas, ou uma busca concorrente com uma ação de admin) podiam se sobrescrever e perder créditos.
**Correção:** toda alteração de saldo agora roda dentro de `db.runTransaction(...)`, que lê e grava atomicamente, eliminando a condição de corrida e garantindo que o saldo nunca fique negativo.

### 2.4 Nenhuma trilha de auditoria
**Causa raiz:** nenhuma operação de crédito ou promoção a admin deixava qualquer registro — impossível saber depois quem alterou o quê.
**Correção:** toda ação sensível grava um documento em `auditLog` (quem fez, em quem, quantidade, saldo resultante, data/hora). Leitura restrita a administradores via `firestore.rules`.

### 2.5 Exportação CSV quebrava acentos no Excel
**Causa raiz:** `exportToCSV` gerava uma *data URI* (`data:text/csv;charset=utf-8,...`) sem o BOM (`\uFEFF`) que o Excel exige para reconhecer UTF-8 — nomes e endereços com acentuação apareciam corrompidos ao abrir no Excel/Windows. A *data URI* também tem limite de tamanho em alguns navegadores.
**Correção:** exportação agora usa `Blob` + `URL.createObjectURL` com BOM incluso, compatível com qualquer volume de leads e sem corrupção de acentos.

### 2.6 Edição de lead dependia de um array em memória
**Causa raiz:** `openEditLeadModal` procurava o lead por `id` dentro do array `currentLeads`; se o usuário tivesse acabado de pesquisar (leads ainda não salvos) o lead não tinha `id`, e a busca falhava silenciosamente com um alerta confuso.
**Correção:** a edição (`openEditLeadModal`) só é oferecida para leads já salvos na carteira (cada um com `id` real do Firestore); leads de uma busca recém-feita têm ação dedicada de "gerar abordagem" sem depender de edição prévia.

## 3. Melhorias de produto entregues (conforme briefing)

| Item do briefing | Como foi implementado |
|---|---|
| Botões de crédito corrigidos | Transações atômicas do Firestore + regras de segurança que validam quem pode alterar o quê (seção 1–2 acima; ver `PLANO-GRATUITO.md` para os detalhes da versão sem Cloud Functions) |
| Atualização em tempo real | `onSnapshot` em perfil, leads, mensagens e configuração global — qualquer alteração aparece instantaneamente, inclusive em outra aba |
| Registro de auditoria | Coleção `auditLog`, somente leitura para admins |
| Busca de até 150 leads (configurável) | Paginação automática da Serper (no proxy Cloudflare) + campo "Limite de leads por busca" no painel de administração (1–500) |
| Paginação até 150/página | Seletor "Por página" (25/50/100/150) na carteira de leads |
| Visual premium, responsivo, modo claro/escuro | Design system "Radar de Sinal" (`style.css`): tinta naval + dourado + teal, tipografia Fraunces/Inter/JetBrains Mono, tema salvo no perfil do usuário, totalmente responsivo |
| Painel com métricas e gráficos | Aba "Painel": cartões de KPI (carteira, quentes, convertidos, mensagens da semana) + gráficos de status e top nichos (Chart.js) |
| Qualificação de leads (quente/morno/frio) | Calculada no servidor a partir de nota e nº de avaliações (`scoreLead`), editável manualmente em cada lead |
| Prioridade de contato e última abordagem | Campo `lastContactAt`, atualizado automaticamente ao enviar/copiar uma mensagem; status avança de "Novo" para "Contatado" no primeiro contato |
| Editor de mensagens moderno, com variáveis | Modal de mensagem com texto editável e variáveis `{empresa}`, `{nicho}`, `{cidade}`, `{bairro}` |
| Histórico de envios e estatísticas | Aba "Mensagens": histórico completo + KPIs (total, últimos 7 dias, modelo mais usado) |
| Tabela e filtros avançados | Filtro por texto, bairro, status, score, nicho e avaliação mínima na carteira de leads |

## 4. Decisões de design explicadas

- **Coleções no nível raiz (`leads`, `messageLog`) com campo `ownerUid`**, em vez de subcoleções por usuário: simplifica os índices compostos e as regras de segurança, sem perda de isolamento entre contas (cada regra exige `ownerUid == request.auth.uid`).
- **Perfil do usuário criado pelo cliente no cadastro, com valores obrigados pelas regras**: a alternativa mais segura seria um gatilho de servidor, mas isso exigiria Cloud Functions (plano pago). As `firestore.rules` cobrem o mesmo risco, recusando qualquer tentativa de cadastro com `isAdmin: true` ou saldo inicial diferente do padrão.
- **Modo demonstração mantido**, mas sem custo: quando o saldo está zerado, a busca volta a gerar leads fictícios (claramente identificados) só no navegador, sem chamar o proxy de busca — preserva a experiência de demonstração do produto original sem repetir o problema de custo descontrolado.
- **Carregamento em memória com paginação no cliente**: adequado para o volume esperado (centenas a poucos milhares de leads por conta). Para contas com volume muito maior no futuro, o próximo passo natural é paginação no servidor com cursores (`startAfter`), sem necessidade de redesenhar o modelo de dados atual.
