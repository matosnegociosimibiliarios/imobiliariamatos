import {
  db,
  logIntegration,
  requireAdmin,
  sendWhatsAppText,
} from './_meta.js';

async function latestWhatsAppInbound(leadId) {
  const rows = await db(
    `social_messages?select=sent_at,created_at&lead_id=eq.${encodeURIComponent(leadId)}` +
      `&platform=eq.whatsapp&direction=eq.inbound&order=sent_at.desc.nullslast,created_at.desc&limit=1`
  );
  return rows?.[0] || null;
}

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

    if (text.length > 4096) {
      res.status(400).json({ error: 'A mensagem deve ter no máximo 4096 caracteres.' });
      return;
    }

    const leads = await db(
      `leads?select=id,name,whatsapp,whatsapp_wa_id,whatsapp_phone_number_id&` +
        `id=eq.${encodeURIComponent(leadId)}&limit=1`
    );

    const lead = leads?.[0];

    if (!lead?.whatsapp_wa_id) {
      res.status(400).json({
        error: 'Este contato ainda não possui uma conversa válida do WhatsApp Business.',
      });
      return;
    }

    const lastInbound = await latestWhatsAppInbound(lead.id);
    const lastInboundAt = lastInbound?.sent_at || lastInbound?.created_at;

    if (!lastInboundAt) {
      res.status(400).json({
        error: 'O cliente precisa iniciar a conversa no WhatsApp antes da resposta livre pelo CRM.',
      });
      return;
    }

    const elapsed = Date.now() - new Date(lastInboundAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (elapsed > twentyFourHours) {
      res.status(400).json({
        error: 'A janela de atendimento de 24 horas terminou. Para iniciar uma nova conversa será necessário usar um modelo aprovado pela Meta.',
      });
      return;
    }

    const result = await sendWhatsAppText(
      lead.whatsapp_wa_id,
      text,
      lead.whatsapp_phone_number_id || null
    );

    const messageId = result?.messages?.[0]?.id || null;
    const sentAt = new Date().toISOString();

    await db('social_messages?on_conflict=platform,external_message_id', {
      method: 'POST',
      body: {
        lead_id: lead.id,
        platform: 'whatsapp',
        channel: 'whatsapp',
        external_message_id: messageId,
        external_sender_id:
          lead.whatsapp_phone_number_id || process.env.META_WHATSAPP_PHONE_NUMBER_ID || null,
        external_recipient_id: lead.whatsapp_wa_id,
        direction: 'outbound',
        message_text: text,
        sent_at: sentAt,
        delivery_status: 'sent',
        metadata: {
          source: 'crm',
          wa_id: lead.whatsapp_wa_id,
          phone_number_id:
            lead.whatsapp_phone_number_id || process.env.META_WHATSAPP_PHONE_NUMBER_ID || null,
        },
      },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });

    await logIntegration('whatsapp_outbound', {
      externalEventId: messageId,
      metadata: {
        lead_id: lead.id,
        recipient_wa_id: lead.whatsapp_wa_id,
      },
    });

    res.status(200).json({
      ok: true,
      message_id: messageId,
      sent_at: sentAt,
    });
  } catch (error) {
    console.error(error);

    await logIntegration('whatsapp_outbound_error', {
      status: 'error',
      errorMessage: error.message,
      metadata: {
        meta_error: error.metaError || null,
      },
    });

    res.status(error.statusCode || 500).json({
      error:
        error.statusCode && error.statusCode < 500
          ? error.message
          : `Não foi possível enviar a mensagem pelo WhatsApp. ${error.message || ''}`.trim(),
    });
  }
}
