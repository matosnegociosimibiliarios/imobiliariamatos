# Matos Negócios Imobiliários — Versão 7

## O que entra nesta versão

### Visitantes
- Registro anônimo de páginas visitadas
- Sessão anônima salva no navegador
- Página visitada
- Imóvel visitado
- Referência
- UTM source / medium / campaign
- Sem IP e sem captura automática de dados pessoais

### Leads
- Formulário de interesse na página do imóvel
- Nome
- WhatsApp
- E-mail opcional
- Mensagem
- Imóvel de origem
- Sessão de origem
- Status do atendimento

### Agendamentos
- Solicitação de visita
- Data desejada
- Horário desejado
- Status do agendamento

### Painel
- Visitantes únicos
- Visualizações
- Leads
- Agendamentos
- Fechados
- Taxa visitante → lead
- Taxa lead → agendamento
- Origem dos leads
- Imóveis que mais geram leads
- Tela de Leads
- Tela de Agendamentos

## Antes de publicar
Execute no Supabase:
`SUPABASE_LEADS_SETUP.sql`

Depois publique esta versão no GitHub/Vercel.

## Segurança
- Visitante pode inserir visita, lead e pedido de agendamento.
- Visitante não pode ler a base de leads.
- Somente administrador pode ler e editar leads, visitas e agendamentos.
