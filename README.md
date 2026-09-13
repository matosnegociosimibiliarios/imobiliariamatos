# Matos Negócios Imobiliários — Versão 8

## CRM de atendimento

Esta versão transforma a área de leads em um CRM comercial.

### Funil visual
Etapas:
- Novo
- Contatado
- Qualificado
- Visita
- Proposta
- Fechado
- Perdido

É possível mover o cliente de etapa diretamente no funil.

### Ficha do cliente
Cada lead passa a ter:
- dados de contato
- imóvel de interesse
- mensagem inicial
- origem
- histórico das etapas
- anotações de atendimento
- próxima ação
- data e horário da próxima ação
- motivo de perda
- valor do negócio
- valor da comissão
- visitas solicitadas
- botão direto de WhatsApp

### Próximas ações
Nova tela administrativa para:
- ações atrasadas
- próximas ações
- acesso rápido ao cliente
- WhatsApp

### Indicadores
O painel passa a mostrar:
- visitantes
- leads
- agendamentos
- propostas
- fechados
- conversão de lead em venda
- valor total fechado
- comissão total
- motivos de perda
- imóveis que mais geram leads

## Instalação

ANTES de publicar a Versão 8:

1. Abra `SUPABASE_CRM_SETUP.sql`.
2. Copie todo o conteúdo.
3. Execute no Editor SQL do Supabase.
4. Confirme que apareceu sucesso.
5. Depois publique os arquivos da Versão 8 no GitHub/Vercel.

## Segurança
- Os dados do CRM continuam protegidos por RLS.
- Apenas administrador autenticado pode ler ou alterar anotações, histórico e dados comerciais.
- Nenhuma chave secreta é colocada no navegador.
