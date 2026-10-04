import { db, getWhatsAppConnection, GRAPH_VERSION, normalizePhoneDigits } from './_meta.js';

function addFrequency(value, frequency) {
  const date = new Date(value || Date.now());
  if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else if (frequency === 'biweekly') date.setUTCDate(date.getUTCDate() + 14);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

function daysBetween(from, to = new Date()) {
  const start = new Date(from || Date.now());
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86400000));
}

const FEEDBACK_LABELS = {
  liked: 'Gostou',
  not_liked: 'Não gostou',
  expensive: 'Achou caro',
  old: 'Imóvel antigo',
  needs_renovation: 'Precisa de reforma',
  location: 'Localização não agradou',
  small: 'Achou pequeno',
  large: 'Achou grande demais',
  no_parking: 'Falta de vaga',
  documentation: 'Documentação',
  other: 'Outro',
};

function feedbackSummary(leads, appointments, proposals) {
  const codes = [
    ...(leads || []).map((item) => item.property_feedback_code),
    ...(appointments || []).map((item) => item.feedback_code),
    ...(proposals || []).map((item) => item.feedback_code),
  ].filter(Boolean);

  if (!codes.length) return 'Nenhum parecer registrado no período.';

  const counts = codes.reduce((acc, code) => {
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${FEEDBACK_LABELS[code] || 'Outro'}: ${count}`)
    .join(' | ');
}

function textReport({ agencyName, property, management, leads, appointments, proposals, periodStart, periodEnd }) {
  const startedAt = management?.listing_started_at || property.published_at || property.created_at;
  const completedVisits = appointments.filter((item) => item.status === 'completed').length;
  const feedback = feedbackSummary(leads, appointments, proposals);

  return [
    `${agencyName || 'Imobiliária'} — Relatório do imóvel`,
    `${property.code} — ${property.title}`,
    `Período: ${periodStart} a ${periodEnd}`,
    '',
    `Tempo anunciado: ${daysBetween(startedAt)} dias`,
    `Clientes atendidos: ${leads.length}`,
    `Visitas realizadas: ${completedVisits}`,
    `Propostas recebidas: ${proposals.length}`,
    `Pareceres: ${feedback}`,
    '',
    'Este relatório foi gerado automaticamente pelo GOI.',
  ].join('\n');
}

function htmlReport(data) {
  const text = textReport(data);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.5"><div style="max-width:680px;margin:auto"><h2 style="margin-bottom:4px">${data.agencyName || 'Imobiliária'}</h2><p style="margin-top:0;color:#667085">Relatório de acompanhamento do imóvel</p><div style="white-space:pre-line;background:#f8fafc;border:1px solid #e4e9ef;border-radius:12px;padding:18px">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div></body></html>`;
}

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error('E-mail automático ainda não configurado no servidor (Resend).');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Resend ${response.status}`);
  return data;
}

async function sendWhatsAppTemplate({ organizationId, to, templateName, language = 'pt_BR', params = [] }) {
  if (!templateName) throw new Error('Informe um modelo de WhatsApp aprovado pela Meta para o relatório.');

  const connection = await getWhatsAppConnection(organizationId);
  const token = connection?.access_token || process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = connection?.phone_number_id || process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error('WhatsApp Business não configurado para esta imobiliária.');

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhoneDigits(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [{
          type: 'body',
          parameters: params.map((value) => ({ type: 'text', text: String(value) })),
        }],
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.message || `WhatsApp API ${response.status}`);
  return data;
}

async function buildReport(setting) {
  const propertyRows = await db(
    `properties?select=id,code,title,purpose,status,sale_price,rent_price,published_at,created_at&id=eq.${encodeURIComponent(setting.property_id)}&organization_id=eq.${encodeURIComponent(setting.organization_id)}&limit=1`
  );
  const property = propertyRows?.[0];
  if (!property) throw new Error('Imóvel não encontrado.');

  const managementRows = await db(
    `property_management?select=owner_name,owner_email,owner_whatsapp,listing_started_at&property_id=eq.${encodeURIComponent(property.id)}&organization_id=eq.${encodeURIComponent(setting.organization_id)}&limit=1`
  );
  const management = managementRows?.[0] || null;

  const end = new Date();
  const start = setting.last_sent_at
    ? new Date(setting.last_sent_at)
    : new Date(Date.now() - 30 * 86400000);

  const startIso = start.toISOString();
  const [leads, appointments, proposals, agencyRows] = await Promise.all([
    db(`leads?select=id,name,assigned_to,property_feedback_code,property_feedback_notes,created_at&property_id=eq.${encodeURIComponent(property.id)}&created_at=gte.${encodeURIComponent(startIso)}`),
    db(`appointments?select=id,status,assigned_to,feedback_code,feedback_notes,scheduled_at,created_at&property_id=eq.${encodeURIComponent(property.id)}&created_at=gte.${encodeURIComponent(startIso)}`),
    db(`proposals?select=id,status,assigned_to,feedback_code,feedback_notes,created_at&property_id=eq.${encodeURIComponent(property.id)}&created_at=gte.${encodeURIComponent(startIso)}`),
    db(`agency_public_settings?select=agency_name&organization_id=eq.${encodeURIComponent(setting.organization_id)}&limit=1`),
  ]);

  const agencyName = agencyRows?.[0]?.agency_name || 'Imobiliária';
  const periodStart = start.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const periodEnd = end.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const completedVisits = (appointments || []).filter((item) => item.status === 'completed').length;
  const feedback = feedbackSummary(leads || [], appointments || [], proposals || []);

  return {
    agencyName,
    property,
    management,
    leads: leads || [],
    appointments: appointments || [],
    proposals: proposals || [],
    periodStart,
    periodEnd,
    summary: {
      days_announced: daysBetween(management?.listing_started_at || property.published_at || property.created_at),
      clients: (leads || []).length,
      completed_visits: completedVisits,
      proposals: (proposals || []).length,
      feedback,
    },
  };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const settings = await db(
      `property_owner_report_settings?select=*&enabled=eq.true&next_send_at=not.is.null&next_send_at=lte.${encodeURIComponent(now)}&order=next_send_at.asc&limit=50`
    );

    const results = [];

    for (const setting of settings || []) {
      let report = null;
      let emailSent = false;
      let whatsappSent = false;
      const errors = [];

      try {
        report = await buildReport(setting);

        if (['email', 'both'].includes(setting.channel)) {
          const email = setting.recipient_email || report.management?.owner_email;
          if (!email) errors.push('E-mail do proprietário não informado.');
          else {
            try {
              await sendEmail(
                email,
                `Relatório do imóvel ${report.property.code} — ${report.property.title}`,
                htmlReport(report)
              );
              emailSent = true;
            } catch (error) {
              errors.push(error.message);
            }
          }
        }

        if (['whatsapp', 'both'].includes(setting.channel)) {
          const whatsapp = setting.recipient_whatsapp || report.management?.owner_whatsapp;
          if (!whatsapp) errors.push('WhatsApp do proprietário não informado.');
          else {
            try {
              await sendWhatsAppTemplate({
                organizationId: setting.organization_id,
                to: whatsapp,
                templateName: setting.whatsapp_template_name || process.env.META_OWNER_REPORT_TEMPLATE_NAME,
                params: [
                  `${report.property.code} — ${report.property.title}`,
                  `${report.periodStart} a ${report.periodEnd}`,
                  report.summary.clients,
                  report.summary.completed_visits,
                  report.summary.proposals,
                  report.summary.feedback.slice(0, 700),
                ],
              });
              whatsappSent = true;
            } catch (error) {
              errors.push(error.message);
            }
          }
        }

        const sentAny = emailSent || whatsappSent;
        const requestedCount = setting.channel === 'both' ? 2 : 1;
        const sentCount = Number(emailSent) + Number(whatsappSent);
        const status = sentCount === requestedCount ? 'sent' : sentAny ? 'partial' : 'error';
        const sentAt = sentAny ? new Date().toISOString() : null;

        await db('property_owner_report_history', {
          method: 'POST',
          body: {
            organization_id: setting.organization_id,
            property_id: setting.property_id,
            settings_id: setting.id,
            channel: setting.channel,
            status,
            period_start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
            period_end: new Date().toISOString().slice(0, 10),
            summary: report.summary,
            error_message: errors.join(' | ') || null,
            sent_at: sentAt,
          },
          prefer: 'return=minimal',
        });

        await db(`property_owner_report_settings?id=eq.${encodeURIComponent(setting.id)}`, {
          method: 'PATCH',
          body: {
            last_sent_at: sentAt || setting.last_sent_at,
            next_send_at: addFrequency(setting.next_send_at || now, setting.frequency),
            updated_at: new Date().toISOString(),
          },
          prefer: 'return=minimal',
        });

        results.push({ id: setting.id, status, emailSent, whatsappSent, errors });
      } catch (error) {
        await db('property_owner_report_history', {
          method: 'POST',
          body: {
            organization_id: setting.organization_id,
            property_id: setting.property_id,
            settings_id: setting.id,
            channel: setting.channel,
            status: 'error',
            summary: report?.summary || {},
            error_message: error.message,
          },
          prefer: 'return=minimal',
        });
        results.push({ id: setting.id, status: 'error', errors: [error.message] });
      }
    }

    res.status(200).json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Falha ao processar relatórios automáticos.' });
  }
}
