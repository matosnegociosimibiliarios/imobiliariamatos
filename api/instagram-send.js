import {
  db,
  logIntegration,
  requireAdmin,
  sendInstagramText,
} from './_meta.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    await requireAdmin(req);

    const leadId = String(req.body?.lead_id || '').trim();
    const text = String(req.body?.text || '').trim();

    if (!leadId || !text) {
      res.status(400).json({ error: 'Lead e mensagem são obrigatórios.' });
      return;
    }

    if (text.length > 1000) {
      res.status(400).json({ error: 'A mensagem deve ter no máximo 1000 caracteres.' });
      return;
    }

    const leads = await db(
      `leads?select=id,name,source_platform,source_channel,external_contact_id&` +
      `id=eq.${encodeURIComponent(leadId)}&limit=1`
    );

    const lead = leads?.[0];

    if (
      !lead ||
      lead.source_platform !== 'instagram' ||
      lead.source_channel !== 'direct' ||
      !lead.external_contact_id
    ) {
      res.status(400).json({
        error: 'Este contato não possui uma conversa válida do Instagram Direct.',
      });
      return;
    }

    const result = await sendInstagramText(lead.external_contact_id, text);
    const sentAt = new Date().toISOString();

    await db('social_messages?on_conflict=platform,external_message_id', {
      method: 'POST',
      body: {
        lead_id: lead.id,
        platform: 'instagram',
        channel: 'direct',
        external_message_id: result.message_id || null,
        external_sender_id: process.env.META_INSTAGRAM_USER_ID || null,
        external_recipient_id: lead.external_contact_id,
        direction: 'outbound',
        message_text: text,
        sent_at: sentAt,
        delivery_status: 'sent',
        metadata: {
          recipient_id: result.recipient_id || lead.external_contact_id,
          source: 'crm',
        },
      },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });

    await logIntegration('instagram_direct_outbound', {
      externalEventId: result.message_id || null,
      metadata: {
        lead_id: lead.id,
        recipient_id: lead.external_contact_id,
      },
    });

    res.status(200).json({
      ok: true,
      message_id: result.message_id || null,
      recipient_id: result.recipient_id || lead.external_contact_id,
      sent_at: sentAt,
    });
  } catch (error) {
    console.error(error);

    await logIntegration('instagram_direct_outbound_error', {
      status: 'error',
      errorMessage: error.message,
    });

    res.status(error.statusCode || 500).json({
      error:
        error.statusCode && error.statusCode < 500
          ? error.message
          : `Não foi possível enviar a mensagem. ${error.message || ''}`.trim(),
    });
  }
}
