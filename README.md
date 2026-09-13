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
