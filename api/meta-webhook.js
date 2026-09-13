import { createLeadFromLeadAd, logIntegration, readRawBody, upsertInstagramDirectLead, verifyMetaSignature } from './_meta.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Falha na verificação do webhook.');
    }
    return;
  }

  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
    if (!verifyMetaSignature(rawBody, req.headers['x-hub-signature-256'])) {
      await logIntegration('signature_error', { status:'rejected', errorMessage:'Assinatura inválida.' });
      res.status(401).send('Invalid signature'); return;
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const tasks = [];

    for (const entry of payload.entry || []) {
      for (const event of entry.messaging || []) {
        if (!event?.sender?.id || !event?.message || event.message.is_echo) continue;
        if (process.env.META_INSTAGRAM_USER_ID && String(event.sender.id) === String(process.env.META_INSTAGRAM_USER_ID)) continue;
        const text = event.message.text || (event.message.attachments ? '[Mídia recebida no Instagram]' : '[Mensagem recebida no Instagram]');
        tasks.push(upsertInstagramDirectLead({ senderId:String(event.sender.id), messageId:event.message.mid || null, text, timestamp:event.timestamp || null, metadata:{ recipient_id:event.recipient?.id || null } }).then(() => logIntegration('instagram_direct_message', { externalEventId:event.message.mid || null, metadata:{ sender_id:event.sender.id } })));
      }

      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const value = change.value || {};
        if (!value.leadgen_id) continue;
        tasks.push(createLeadFromLeadAd({ leadgenId:String(value.leadgen_id), pageId:value.page_id || entry.id || null, formId:value.form_id || null, adId:value.ad_id || null }).then(() => logIntegration('lead_ads', { externalEventId:String(value.leadgen_id), metadata:{ page_id:value.page_id || null, form_id:value.form_id || null, ad_id:value.ad_id || null } })));
      }
    }

    await Promise.allSettled(tasks);
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error(error);
    await logIntegration('webhook_error', { status:'error', errorMessage:error.message });
    res.status(500).send('Webhook error');
  }
}
