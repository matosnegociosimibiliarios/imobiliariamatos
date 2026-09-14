# Integração WhatsApp Business — versão 10.4

## Fluxo

Cliente → WhatsApp Business → Meta Webhook → `/api/meta-webhook` → Supabase → CRM → `/api/whatsapp-send` → WhatsApp.

## Recebimento

O webhook reconhece eventos com `object = whatsapp_business_account` e `field = messages`. Mensagens recebidas são salvas em `social_messages` com `platform = whatsapp`.

O CRM procura primeiro um lead com o mesmo `whatsapp_wa_id`. Se não encontrar, tenta associar pelo telefone normalizado. Isso evita criar outro cliente quando alguém que entrou pelo site depois conversa no WhatsApp.

## Resposta

A resposta livre pelo CRM usa `POST /{PHONE_NUMBER_ID}/messages` da Cloud API. A versão 10.4 permite resposta quando existe uma mensagem recebida do cliente dentro da janela de atendimento de 24 horas. Fora dela, o CRM informa que será necessário um modelo aprovado pela Meta.

## Variáveis de servidor

- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_BUSINESS_ACCOUNT_ID`

Não registrar tokens neste arquivo.
