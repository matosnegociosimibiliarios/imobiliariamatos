import {
  createLeadFromLeadAd,
  logIntegration,
  readRawBody,
  updateWhatsAppDeliveryStatus,
  upsertWhatsAppInboundMessage,
  verifyMetaSignature,
} from './_meta.js';
import {
  getInstagramConnectionByUserId,
  storeInstagramOutboundEchoForOrganization,
  touchInstagramWebhook,
  upsertInstagramDirectLeadForOrganization,
} from './_instagram.js';

export const config = { api: { bodyParser: false } };

function whatsappMessageText(message) {
  if (!message) return '[Mensagem recebida no WhatsApp]';

  switch (message.type) {
    case 'text':
      return message.text?.body || '[Mensagem de texto recebida no WhatsApp]';
    case 'image':
      return message.image?.caption
        ? `[Imagem] ${message.image.caption}`
        : '[Imagem recebida no WhatsApp]';
    case 'video':
      return message.video?.caption
        ? `[Vídeo] ${message.video.caption}`
        : '[Vídeo recebido no WhatsApp]';
    case 'audio':
      return '[Áudio recebido no WhatsApp]';
    case 'document':
      return message.document?.filename
        ? `[Documento recebido: ${message.document.filename}]`
        : '[Documento recebido no WhatsApp]';
    case 'sticker':
      return '[Figurinha recebida no WhatsApp]';
    case 'location':
      return '[Localização recebida no WhatsApp]';
    case 'contacts':
      return '[Contato compartilhado no WhatsApp]';
    case 'button':
      return message.button?.text || '[Resposta por botão no WhatsApp]';
    case 'interactive':
      return (
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        '[Resposta interativa no WhatsApp]'
      );
    case 'order':
      return '[Pedido recebido no WhatsApp]';
    case 'system':
      return message.system?.body || '[Mensagem de sistema do WhatsApp]';
    default:
      return `[${message.type || 'Mensagem'} recebida no WhatsApp]`;
  }
}

function whatsappContactName(value, senderWaId) {
  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
  const contact = contacts.find((item) => String(item?.wa_id || '') === String(senderWaId)) || contacts[0];
  return contact?.profile?.name || null;
}

async function processWhatsAppChange(change, entryId) {
  if (change?.field !== 'messages') return [];

  const value = change.value || {};
  const phoneNumberId = value.metadata?.phone_number_id || null;
  const displayPhoneNumber = value.metadata?.display_phone_number || null;
  const tasks = [];

  for (const message of value.messages || []) {
    const senderWaId = message?.from;
    if (!senderWaId) continue;

    const text = whatsappMessageText(message);
    const profileName = whatsappContactName(value, senderWaId);

    tasks.push(
      upsertWhatsAppInboundMessage({
        senderWaId: String(senderWaId),
        profileName,
        messageId: message.id || null,
        text,
        timestamp: message.timestamp || null,
        phoneNumberId,
        displayPhoneNumber,
        messageType: message.type || 'unknown',
        metadata: {
          context: message.context || null,
          raw_message: message,
          waba_id: entryId || null,
        },
      }).then(() =>
        logIntegration('whatsapp_message', {
          externalEventId: message.id || null,
          metadata: {
            sender_wa_id: senderWaId,
            phone_number_id: phoneNumberId,
            message_type: message.type || null,
          },
        })
      )
    );
  }

  for (const status of value.statuses || []) {
    tasks.push(
      updateWhatsAppDeliveryStatus({
        messageId: status.id || null,
        status: status.status || null,
        timestamp: status.timestamp || null,
        recipientId: status.recipient_id || null,
        errors: status.errors || [],
        metadata: {
          conversation: status.conversation || null,
          pricing: status.pricing || null,
          phone_number_id: phoneNumberId,
          waba_id: entryId || null,
        },
      }).then(() =>
        logIntegration('whatsapp_delivery_status', {
          externalEventId: status.id || null,
          status: status.status === 'failed' ? 'error' : 'received',
          errorMessage:
            status.status === 'failed'
              ? (status.errors || [])
                  .map((item) => item?.message || item?.title || item?.code)
                  .filter(Boolean)
                  .join(' | ') || 'Falha no envio pelo WhatsApp.'
              : null,
          metadata: {
            delivery_status: status.status || null,
            recipient_id: status.recipient_id || null,
          },
        })
      )
    );
  }

  return tasks;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (
      mode === 'subscribe' &&
      token &&
      token === process.env.META_WEBHOOK_VERIFY_TOKEN
    ) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Falha na verificação do webhook.');
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  let rawBody = '';

  try {
    rawBody = await readRawBody(req);

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const signatureSecret =
      payload.object === 'instagram'
        ? (process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET)
        : process.env.META_APP_SECRET;

    if (!verifyMetaSignature(rawBody, req.headers['x-hub-signature-256'], signatureSecret)) {
      await logIntegration('signature_error', {
        status: 'rejected',
        errorMessage: 'Assinatura inválida.',
      });
      res.status(401).send('Invalid signature');
      return;
    }
    const tasks = [];

    for (const entry of payload.entry || []) {
      // Instagram Direct: entry.id identifica a conta profissional conectada.
      const instagramConnection = entry.id
        ? await getInstagramConnectionByUserId(String(entry.id))
        : null;

      if (instagramConnection?.organization_id) {
        await touchInstagramWebhook(String(entry.id));

        for (const event of entry.messaging || []) {
          if (!event?.message) continue;

          const text =
            event.message.text ||
            (event.message.attachments
              ? '[Mídia recebida no Instagram]'
              : '[Mensagem recebida no Instagram]');

          const metadata = {
            recipient_id: event.recipient?.id || null,
            sender_id: event.sender?.id || null,
            attachments: event.message.attachments || [],
            is_echo: Boolean(event.message.is_echo),
            instagram_user_id: String(entry.id),
            instagram_username: instagramConnection.username || null,
          };

          if (event.message.is_echo) {
            const recipientId = event.recipient?.id;
            if (!recipientId) continue;

            tasks.push(
              storeInstagramOutboundEchoForOrganization({
                organizationId: instagramConnection.organization_id,
                recipientId: String(recipientId),
                messageId: event.message.mid || null,
                text,
                timestamp: event.timestamp || null,
                metadata,
              }).then(() =>
                logIntegration('instagram_direct_outbound_echo', {
                  externalEventId: event.message.mid || null,
                  metadata: { recipient_id: recipientId, organization_id: instagramConnection.organization_id },
                })
              )
            );
            continue;
          }

          if (!event?.sender?.id) continue;

          tasks.push(
            upsertInstagramDirectLeadForOrganization({
              organizationId: instagramConnection.organization_id,
              senderId: String(event.sender.id),
              messageId: event.message.mid || null,
              text,
              timestamp: event.timestamp || null,
              metadata,
            }).then(() =>
              logIntegration('instagram_direct_message', {
                externalEventId: event.message.mid || null,
                metadata: { sender_id: event.sender.id },
                organizationId: instagramConnection.organization_id,
              })
            )
          );
        }
      }

      // WhatsApp e Lead Ads usam entry.changes.
      for (const change of entry.changes || []) {
        if (change.field === 'messages') {
          const whatsappTasks = await processWhatsAppChange(change, entry.id || null);
          tasks.push(...whatsappTasks);
          continue;
        }

        if (change.field !== 'leadgen') continue;

        const value = change.value || {};
        if (!value.leadgen_id) continue;

        tasks.push(
          createLeadFromLeadAd({
            leadgenId: String(value.leadgen_id),
            pageId: value.page_id || entry.id || null,
            formId: value.form_id || null,
            adId: value.ad_id || null,
          }).then(() =>
            logIntegration('lead_ads', {
              externalEventId: String(value.leadgen_id),
              metadata: {
                page_id: value.page_id || null,
                form_id: value.form_id || null,
                ad_id: value.ad_id || null,
              },
            })
          )
        );
      }
    }

    const results = await Promise.allSettled(tasks);
    const rejected = results.filter((item) => item.status === 'rejected');

    for (const item of rejected) {
      console.error('Falha ao processar evento da Meta:', item.reason);
    }

    // Meta recomenda resposta 200 rápida. Falhas individuais ficam registradas nos logs.
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error(error);
    await logIntegration('webhook_error', {
      status: 'error',
      errorMessage: error.message,
    });
    res.status(500).send('Webhook error');
  }
}
