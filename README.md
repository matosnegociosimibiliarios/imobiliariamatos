# Matos Negócios Imobiliários — Versão 10

## O que entra nesta versão

### SEO e aquisição
- títulos e descrições por página
- canonical
- dados estruturados básicos
- páginas locais por cidade e tipo de imóvel
- sitemap dinâmico em `/sitemap.xml`
- robots em `/robots.txt`
- filtros de Comprar e Alugar funcionando
- busca da Home funcionando
- compartilhamento de imóvel
- rastreamento de busca, WhatsApp, formulários, agendamentos e compartilhamentos

### Instagram / Meta → CRM
A estrutura fica pronta para duas entradas automáticas:

1. **Instagram Direct**
   - nova mensagem recebida cria um lead no CRM
   - mensagens seguintes atualizam o mesmo lead
   - origem fica `Instagram / Direct`
   - última mensagem aparece na ficha do cliente

2. **Formulários de anúncios da Meta (Facebook/Instagram Lead Ads)**
   - webhook recebe `leadgen_id`
   - servidor consulta a Graph API
   - nome, telefone/e-mail e dados disponíveis do anúncio entram no CRM
   - origem fica identificada como Lead Ads

### Painel
Nova página: `/admin/integracoes`

Ela mostra:
- status das variáveis de conexão
- URL do webhook
- quantidade de leads do Direct
- quantidade de leads de formulários Meta
- mensagens recebidas
- últimos eventos da integração

## ETAPA 1 — Antes de publicar a Versão 10
Execute no Supabase:

`SUPABASE_V10_SETUP.sql`

## ETAPA 2 — Publicar no GitHub/Vercel
Publique normalmente esta versão.

## ETAPA 3 — Variáveis de ambiente da Vercel
As integrações externas só ficam ativas depois da configuração da Meta.
Crie na Vercel, como variáveis de servidor:

- `SUPABASE_SERVICE_ROLE_KEY` — chave service_role do Supabase. **Nunca use prefixo VITE_.**
- `META_WEBHOOK_VERIFY_TOKEN` — uma senha/token que você mesmo cria para validar o webhook.
- `META_APP_SECRET` — segredo do aplicativo Meta.
- `META_INSTAGRAM_ACCESS_TOKEN` — token do Instagram profissional para mensagens.
- `META_INSTAGRAM_USER_ID` — ID da conta profissional do Instagram.
- `META_LEAD_ADS_ACCESS_TOKEN` — token com acesso de recuperação de leads dos formulários.
- `META_GRAPH_API_VERSION` — use `v26.0` nesta versão, salvo mudança futura da Meta.

Depois de alterar variáveis da Vercel, faça uma nova implantação.

## ETAPA 4 — Meta for Developers
No aplicativo Meta, configure o callback de Webhooks para:

`https://imobiliariamatos.vercel.app/api/meta-webhook`

O Verify Token deve ser exatamente o mesmo valor colocado em `META_WEBHOOK_VERIFY_TOKEN`.

Para mensagens do Instagram, habilite os eventos de mensagens compatíveis com sua configuração do Instagram Professional.
Para Lead Ads, assine o campo `leadgen` da Página usada nos formulários.

## Segurança
- Tokens e service_role ficam somente na Vercel.
- Nenhum token secreto é enviado ao navegador.
- O painel exibe apenas se uma variável está configurada, nunca o valor do token.
- Se `META_APP_SECRET` estiver configurado, o webhook valida `x-hub-signature-256`.

## Observação
A conexão final depende da conta profissional do Instagram, do aplicativo Meta e das permissões aprovadas/disponíveis para a conta. O código desta versão deixa o site e o CRM preparados; a ativação final é feita no painel da Meta e na Vercel.


## V10.1
- Política de Privacidade pública em `/politica-de-privacidade`
- Instruções de exclusão de dados em `/exclusao-de-dados`
- Link de Privacidade no rodapé


## V10.2 — Caixa de atendimento do Instagram

- Nova tela `/admin/mensagens` com conversas do Instagram Direct.
- Histórico de mensagens recebidas e enviadas.
- Resposta ao Direct diretamente pelo CRM.
- Contador de mensagens não lidas.
- Atualização automática da conversa a cada poucos segundos.
- Mensagens enviadas pelo próprio Instagram também podem aparecer no histórico por meio do webhook de eco.
- A ficha do cliente passa a ter a conversa completa e campo de resposta.

### Instalação
Antes de publicar os arquivos da V10.2, execute `SUPABASE_V10_2_SETUP.sql` no Editor SQL do Supabase.

Não é necessário criar novas variáveis na Vercel. A V10.2 usa as mesmas configurações Meta/Instagram já validadas na V10.1.

## V10.2.1
Correção do envio de respostas do Instagram pelo CRM:
- corrige a leitura do token de sessão administrativa no endpoint `/api/instagram-send`;
- não altera banco de dados;
- não exige novas variáveis de ambiente;
- não exige nova configuração na Meta.


## Versão 10.3 — origem e operação multicanal

### Novidades
- origem inicial do lead e última origem registrada separadamente;
- histórico de canais do cliente;
- prevenção de duplicados nos formulários do site por WhatsApp/e-mail;
- Instagram continua deduplicando pelo identificador da própria conta;
- filtro do funil por origem: Site, Instagram, WhatsApp, Facebook, Meta e Manual;
- selo de origem visível nos cards do funil;
- contador de mensagens não lidas no menu administrativo;
- abertura da conversa marca mensagens como lidas;
- opção para marcar uma conversa novamente como não lida;
- respostas rápidas no atendimento do Instagram;
- painel com leads, visitas, fechamentos, valor vendido e comissão por canal;
- estrutura já preparada para futuras integrações com WhatsApp e Facebook.

### Instalação
Antes de publicar os arquivos da 10.3, execute no Supabase:
`SUPABASE_V10_3_SETUP.sql`

Depois publique normalmente no GitHub/Vercel.

Nenhuma variável nova de ambiente é necessária para esta versão.

## Versão 10.4 — WhatsApp Business no CRM

Esta versão prepara o CRM para centralizar o WhatsApp Business junto com Site e Instagram.

### O que foi adicionado

- webhook único da Meta reconhece Instagram e WhatsApp;
- mensagens recebidas pelo WhatsApp criam ou atualizam o lead;
- se o telefone já existir no CRM, a conversa do WhatsApp é vinculada ao mesmo cliente;
- origem inicial é preservada e a última origem passa a registrar WhatsApp quando houver novo contato;
- nova tela **Mensagens WhatsApp** no painel administrativo;
- resposta pelo CRM durante a janela de atendimento permitida pela Meta;
- status de mensagem enviada, entregue, lida ou com falha;
- contadores separados de mensagens não lidas do Instagram e WhatsApp;
- métricas separadas por canal na tela Integrações.

### Antes de publicar

Execute no Supabase:

`SUPABASE_V10_4_SETUP.sql`

### Variáveis da Vercel para ativar o número real

Depois que o número oficial for conectado à Plataforma do WhatsApp Business, configure em **Produção**:

- `META_WHATSAPP_ACCESS_TOKEN` — token da API do WhatsApp. Nunca expor no navegador.
- `META_WHATSAPP_PHONE_NUMBER_ID` — ID do número de telefone fornecido pela Meta.
- `META_WHATSAPP_BUSINESS_ACCOUNT_ID` — ID da conta do WhatsApp Business (recomendado para diagnóstico e futuras funções).

As variáveis existentes continuam sendo usadas:

- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Webhook

Use o mesmo callback já validado:

`https://imobiliariamatos.vercel.app/api/meta-webhook`

No WhatsApp, o campo de webhook **messages** precisa estar assinado para receber mensagens e atualizações de status.

### Segurança

Tokens do WhatsApp, segredo do app e chave service role ficam somente na Vercel. Nenhum deles deve usar prefixo `VITE_`.
