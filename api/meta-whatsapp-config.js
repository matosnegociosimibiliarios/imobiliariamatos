import { envStatus } from './_meta.js';

const DEFAULT_APP_ID = '1441246188102008';

export default function handler(req, res) {
  const status = envStatus(req);
  res.status(200).json({
    app_id: process.env.META_APP_ID || DEFAULT_APP_ID,
    config_id: process.env.META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || null,
    graph_version: status.graph_version,
    webhook_url: status.webhook_url,
  });
}
