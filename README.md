# Matos Negócios Imobiliários — V10.7

## V10.6 — Propostas e acompanhamento comercial

Esta versão cria um controle próprio de propostas dentro do CRM, ligado ao cliente e ao imóvel.

### O que foi acrescentado

- nova área **Propostas** no menu administrativo;
- proposta vinculada ao **cliente** e ao **imóvel**;
- código automático `PROP-0001`, `PROP-0002`...;
- valor proposto, forma de pagamento, condições e validade;
- etapas **Rascunho → Enviada → Em negociação → Aceita → Recusada → Expirada**;
- próximo retorno da proposta com data e hora;
- motivo de recusa;
- histórico automático das mudanças de situação;
- propostas aceitas podem ser transformadas em **negócio fechado** com um clique;
- propostas aparecem também dentro da ficha do cliente;
- painel de propostas com valor em aberto, taxa de aceite e conversão de proposta em venda;
- propostas vencidas são atualizadas automaticamente ao abrir o CRM;
- **Rotina de hoje** passa a alertar sobre retornos de propostas e propostas que vencem em até 3 dias;
- Visão geral passa a mostrar propostas abertas e alertas comerciais.

### Instalação

Antes de publicar os arquivos da V10.6, execute no Supabase:

`SUPABASE_V10_6_SETUP.sql`

Depois publique normalmente no GitHub/Vercel e faça `Ctrl + F5` no painel.

### Variáveis de ambiente

Nenhuma variável nova na Vercel é necessária para esta versão.

---

# Matos Negócios Imobiliários — V10.5

## V10.5 — Gestão diária do CRM

Esta versão transforma **Próximas ações** em uma central de rotina comercial, usando a estrutura de dados que já existe no CRM. **Não exige novo SQL nem novas variáveis de ambiente.**

### O que foi acrescentado

- **Rotina de hoje** no menu administrativo.
- Resumo com **ações atrasadas, ações para hoje, visitas de hoje, atendimentos sem próxima ação e propostas abertas**.
- Clientes e captações no mesmo centro de comando.
- Filtro rápido por **Tudo / Clientes / Captações**.
- Botões para **concluir uma ação**, **reagendar para amanhã às 9h** ou **reagendar para +7 dias** sem abrir a ficha.
- Ao concluir uma ação, o CRM limpa a próxima ação e registra a conclusão nas **notas/histórico da ficha**.
- Visitas de hoje com ações rápidas para **Confirmar** e **Marcar como realizada**.
- Lista de clientes e captações **sem próxima ação**, priorizada pelo tempo sem atividade.
- Área específica de **propostas em aberto**.
- Bloco **O que precisa de atenção hoje** na Visão geral do painel.
- Próximos 7 dias reúne ações e visitas futuras.

### Publicação

1. Envie os arquivos desta versão para o mesmo repositório no GitHub.
2. Aguarde a implantação automática da Vercel.
3. Faça `Ctrl + F5` no painel.
4. Abra **Rotina de hoje**.

### Banco de dados

Nenhuma alteração de banco é necessária nesta versão. A V10.5 usa os campos e tabelas já existentes nas versões anteriores.

---

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

## V10.7 — Fechamento, documentação e comissão

A versão 10.7 adiciona a etapa pós-venda ao CRM:

- área **Negócios fechados**;
- código automático `NEG-0001`;
- valor final do negócio;
- comissão por percentual ou valor;
- controle de quem paga a comissão;
- comissão pendente, parcial ou recebida;
- previsão e data real de recebimento;
- checklist de documentos do comprador, vendedor e do negócio;
- acompanhamento de contrato, financiamento, escritura e registro;
- pendências e observações internas;
- histórico das etapas do fechamento;
- métricas de valor vendido, comissão total, recebida e a receber;
- negócios fechados na V10.6 são importados automaticamente para a nova área quando o SQL da V10.7 é executado.

### Instalação

1. Execute `SUPABASE_V10_7_SETUP.sql` no Supabase.
2. Depois publique os arquivos da V10.7 no GitHub/Vercel.
3. Não são necessárias novas variáveis de ambiente.

## Versão 10.8 — Gestão de imóveis e proprietários

A 10.8 transforma a área **Imóveis** em uma carteira gerencial, conectando o anúncio ao proprietário, à documentação e ao desempenho comercial.

Principais recursos:
- proprietário vinculado ao imóvel, com WhatsApp e e-mail;
- vínculo automático com a captação que originou o imóvel;
- controle de autorização para venda/locação e validade;
- controle de exclusividade e vencimento;
- percentual e responsável pelo pagamento da comissão;
- checklist documental do imóvel e do proprietário;
- dias em carteira e dias sem interação;
- indicadores por imóvel: leads, visitas, propostas e negócios;
- histórico automático de alterações de preço;
- histórico automático de status do imóvel;
- alertas para imóvel parado há 30 dias, autorização pendente/vencendo, exclusividade vencendo, documentação incompleta e revisão atrasada;
- imóveis com atenção também aparecem em **Rotina de hoje**;
- nova tela `/admin/imoveis/:id/gestao`.

### Instalação da 10.8
1. Execute `SUPABASE_V10_8_SETUP.sql` no Supabase SQL Editor.
2. Depois publique os arquivos desta versão no GitHub/Vercel.
3. Não são necessárias novas variáveis de ambiente.

## Versão 10.9 — Central de documentos e arquivos

A 10.9 adiciona uma central privada de documentos ao CRM.

### O que foi incluído
- nova área **Documentos** no painel administrativo;
- upload de PDF, imagem, Word, Excel, TXT e CSV;
- arquivos privados no Supabase Storage, acessíveis apenas por administrador autenticado;
- vínculo do documento com **imóvel, cliente, captação, proposta ou negócio fechado**;
- categoria, situação, data do documento, validade e observações;
- situação **Pendente de conferência / Conferido / Com pendência**;
- alertas de documentos vencidos ou que vencem em até 30 dias na **Rotina de hoje**;
- visão central dos itens que ainda faltam nos checklists de captação, imóvel e fechamento;
- anexos diretamente dentro das fichas de cliente, captação, proposta, imóvel e negócio fechado;
- ao anexar um arquivo a um item de checklist, o item passa automaticamente de **Pendente** para **Recebido**;
- URLs temporárias assinadas para abrir arquivos privados.

### Instalação
1. Execute `SUPABASE_V10_9_SETUP.sql` no Editor SQL do Supabase.
2. Depois publique os arquivos desta versão no GitHub/Vercel.
3. Não é necessário criar nova variável de ambiente.

### Segurança
O bucket `crm-documents` é privado. Não transforme esse bucket em público.
