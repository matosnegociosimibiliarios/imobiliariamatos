import { db, envStatus, getWhatsAppConnection } from './_meta.js';

const DEFAULT_APP_ID = '1441246188102008';

export default async function handler(req, res) {
  const status = await envStatus(req);
  let connection = null;

  try {
    const organizations = await db('organizations?select=id&limit=1');
    if (organizations?.[0]?.id) {
      connection = await getWhatsAppConnection(organizations[0].id);
    }
  } catch (error) {
    console.warn('Não foi possível carregar a conexão do WhatsApp:', error.message);
  }

  res.status(200).json({
    app_id: process.env.META_APP_ID || DEFAULT_APP_ID,
    config_id: process.env.META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || null,
    graph_version: status.graph_version,
    webhook_url: status.webhook_url,
    connected: Boolean(connection?.access_token && connection?.phone_number_id),
    phone_number_id: connection?.phone_number_id || null,
    display_phone_number: connection?.display_phone_number || null,
    waba_id: connection?.waba_id || null,
  });
}
