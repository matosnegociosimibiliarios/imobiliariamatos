# Ativação Instagram / Meta — Versão 10

A Versão 10 já contém o endpoint que recebe contatos da Meta e cria leads no CRM.
A ativação depende de uma conta profissional do Instagram e de um aplicativo no Meta for Developers.

## Fluxo 1 — Instagram Direct

Quando alguém iniciar uma conversa com a conta profissional:

1. A Meta envia o evento para `/api/meta-webhook`.
2. O site identifica o remetente pelo ID fornecido pela plataforma.
3. Se ainda não existir, cria um lead em **Novo**.
4. Se já existir, atualiza a última mensagem sem duplicar o contato.
5. A ficha do CRM mostra origem `Instagram / Direct` e o histórico de mensagens recebidas.

Para a configuração moderna **Instagram API with Instagram Login**, use as permissões disponibilizadas pela Meta para a conta profissional, incluindo `instagram_business_manage_messages` quando exigida para mensagens.

## Fluxo 2 — Formulários de anúncios da Meta

Quando um formulário instantâneo de anúncio for preenchido:

1. O webhook recebe um `leadgen_id`.
2. O servidor consulta a Graph API usando `META_LEAD_ADS_ACCESS_TOKEN`.
3. O CRM recebe nome, telefone/e-mail e metadados disponíveis do anúncio/campanha.
4. O lead entra no mesmo funil comercial.

A conta/app precisa ter as permissões de Lead Ads aplicáveis, incluindo `leads_retrieval`, e a Página usada nos anúncios precisa estar assinada no campo `leadgen`.

## Variáveis na Vercel

Nunca coloque segredos em variáveis iniciadas por `VITE_`.

- `SUPABASE_SERVICE_ROLE_KEY`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_INSTAGRAM_ACCESS_TOKEN`
- `META_INSTAGRAM_USER_ID`
- `META_LEAD_ADS_ACCESS_TOKEN`
- `META_GRAPH_API_VERSION=v26.0`

## Webhook

Callback:

`https://imobiliariamatos.vercel.app/api/meta-webhook`

O **Verify Token** cadastrado na Meta deve ser exatamente o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN` na Vercel.

Depois de adicionar ou alterar variáveis na Vercel, faça uma nova implantação.

## Teste

No painel do site abra:

`/admin/integracoes`

A tela informa quais partes da configuração estão presentes e mostra os últimos eventos recebidos sem revelar os tokens.


## Camada 3 — conexão por imobiliária

A conexão do Instagram deixou de depender de um token global. Cada organização pode autorizar sua própria conta profissional pelo fluxo oficial Instagram Business Login.

Fluxo:
1. O administrador informa opcionalmente o @ no CRM.
2. O CRM cria um state temporário vinculado à organização ativa e ao usuário autenticado.
3. O usuário autoriza a conta em `https://www.instagram.com/oauth/authorize`.
4. O backend troca o código por token de curta duração e depois por token de longa duração.
5. O CRM identifica o Instagram autorizado, confere o @ informado e grava o token no Vault da organização.
6. O backend inscreve automaticamente a conta em `messages,messaging_seen`.
7. O webhook roteia cada evento pelo Instagram User ID para a organização correta.
8. O envio de mensagens usa o token da organização, nunca um token global.
9. Tokens próximos do vencimento são renovados diariamente por Cron.

Variáveis usadas pelo fluxo:
- `META_INSTAGRAM_APP_ID` — ID do aplicativo do produto Instagram Business Login.
- `META_INSTAGRAM_APP_SECRET` — segredo do aplicativo do Instagram.
- `META_INSTAGRAM_REDIRECT_URI` — opcional; padrão de produção: `https://imobiliariamatos.vercel.app/api/instagram-callback`.
- `CRON_SECRET` — segredo usado para autorizar o job diário de renovação.

Os tokens das imobiliárias não são expostos ao navegador.
