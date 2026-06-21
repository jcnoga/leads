# Adaptação para rodar 100% no plano gratuito (sem Blaze)

Este projeto foi adaptado para não exigir o plano Blaze (pago) do Firebase. Este documento explica exatamente o que mudou em relação à versão com Cloud Functions e por quê — vale a pena ler antes do deploy.

## Por que o Blaze era necessário antes

O Firebase exige o plano Blaze (pay-as-you-go, com cartão cadastrado) para **qualquer** deploy de Cloud Functions — mesmo que o uso real fique zerado, dentro da faixa gratuita do próprio Blaze. Não é uma questão de volume de uso: é um requisito de infraestrutura (Cloud Build e Artifact Registry, usados para empacotar a função, não existem no plano Spark). Não há como contornar isso mantendo Cloud Functions no projeto.

## O que mudou

| Antes (com Cloud Functions / Blaze) | Agora (Spark, gratuito) |
|---|---|
| Créditos, promoção a admin e configuração global alterados por Cloud Functions, usando o Admin SDK | Alterados diretamente pelo cliente, protegidos por regras do Firestore mais rígidas (`firestore.rules`) |
| Perfil do usuário criado por um gatilho de Auth no servidor | Criado pelo próprio cliente no cadastro, com as regras obrigando os valores padrão (não dá pra burlar) |
| Busca de leads (chamada à Serper API) feita dentro de uma Cloud Function, escondendo a chave | Feita por um proxy separado no **Cloudflare Workers** (gratuito, sem cartão), escondendo a chave da mesma forma |
| Primeiro administrador promovido automaticamente por e-mail bootstrap | Primeiro administrador precisa ser promovido manualmente, uma única vez, pelo Console do Firebase (veja README) |

## Como a segurança continua garantida sem servidor próprio

As **Firestore Security Rules** rodam nos servidores do Firebase, não no navegador — então, mesmo sem Cloud Functions, elas continuam sendo a barreira real (são a mesma tecnologia que já protegia o banco antes; só que agora também assumem o papel que era das Functions). O ponto-chave da nova `firestore.rules`:

- Um usuário comum só pode **diminuir** o próprio saldo de créditos (gasto em busca), nunca aumentar — e nunca abaixo de zero.
- Só quem **já é** administrador (a regra verifica isso lendo o próprio documento de quem fez a requisição) pode editar `credits`/`isAdmin` de **outro** usuário, zerar o próprio saldo arbitrariamente, ou alterar a configuração global.
- O cadastro de uma conta nova só é aceito se `credits` e `isAdmin` baterem exatamente com os valores padrão — um payload manipulado no console do navegador é rejeitado pelo Firestore antes mesmo de chegar ao banco.
- Toda alteração sensível ainda grava uma entrada em `auditLog`, e ninguém consegue forjar um registro em nome de outra pessoa.

A única coisa que regra de Firestore **não pode** proteger é a chave da Serper API, porque chamar uma API externa não é uma operação de banco de dados. Por isso ela continua escondida — só que agora num Worker do Cloudflare em vez de uma Cloud Function.

## Trade-off a conhecer: o Worker não verifica créditos antes de chamar a Serper

O Worker confirma que quem está chamando tem uma conta válida no seu Firebase (token verificado de verdade, não é só "confiar no cliente"), mas ele **não** consulta o saldo de créditos no Firestore antes de consultar a Serper — isso é feito depois, do lado do cliente, ao gravar o novo saldo. Na prática: um usuário cadastrado, mesmo com saldo zerado, que descobrisse a URL do Worker e chamasse ela diretamente (fora da interface) conseguiria gerar buscas reais sem gastar créditos no seu app.

Para uma ferramenta de uso próprio ou com poucos clientes de confiança (o cenário atual), esse risco é baixo. Se um dia isso virar um produto com muitos usuários externos, dois caminhos resolvem isso por completo:
1. Fazer o Worker também checar o saldo no Firestore via REST API (usando o token do próprio usuário) antes de chamar a Serper — dá mais umas 20-30 linhas no `worker.js`, ainda gratuito.
2. Migrar a função de busca de volta para uma Cloud Function (aí sim valendo a pena assinar o Blaze, com o app já gerando receita para cobrir o custo).

## Arquivos removidos/adicionados nesta adaptação

- **Removido:** pasta `functions/` inteira.
- **Adicionado:** `cloudflare-proxy/worker.js` e `cloudflare-proxy/wrangler.toml`.
- **Reescrito:** `firestore.rules`, `script.js` (funções de crédito/admin/busca), `firebase-config.js`, `firebase.json`, `index.html` (removida a tag do SDK de Cloud Functions).
