import { db, envStatus, getSupabaseAdminConfig, requireAdmin } from './_meta.js';

function ok(name, detail = null, latencyMs = null) {
  return { name, status: 'ok', detail, latency_ms: latencyMs };
}

function pending(name, detail = null) {
  return { name, status: 'pending', detail };
}

function fail(name, detail = null, latencyMs = null) {
  return { name, status: 'error', detail, latency_ms: latencyMs };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const user = await requireAdmin(req, 'health.view');
    const checks = [];

    const started = Date.now();
    try {
      const rows = await db('profiles?select=id&limit=1');
      checks.push(ok('Banco de dados', `Supabase respondeu corretamente (${rows?.length ?? 0} registro de teste).`, Date.now() - started));
    } catch (error) {
      checks.push(fail('Banco de dados', error?.message || 'Falha ao consultar o Supabase.', Date.now() - started));
    }

    const env = envStatus(req);
    checks.push(env.supabase_service_role
      ? ok('Servidor seguro', 'Chave administrativa do Supabase configurada somente no servidor.')
      : fail('Servidor seguro', 'SUPABASE_SERVICE_ROLE_KEY não configurada.'));

    if (env.supabase_service_role) {
      try {
        const { url, key } = getSupabaseAdminConfig();
        for (const [bucket, label] of [['property-images', 'Fotos dos imóveis'], ['crm-documents', 'Documentos do CRM']]) {
          const storageStarted = Date.now();
          const response = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          });
          if (response.ok) {
            checks.push(ok(label, `Bucket ${bucket} disponível.`, Date.now() - storageStarted));
          } else {
            checks.push(fail(label, `Bucket ${bucket} não respondeu corretamente (${response.status}).`, Date.now() - storageStarted));
          }
        }
      } catch (error) {
        checks.push(fail('Storage do Supabase', error?.message || 'Não foi possível verificar os arquivos.'));
      }
    }

    checks.push(env.webhook_verify_token && env.meta_app_secret
      ? ok('Webhook Meta', 'Token de verificação e segredo do app configurados.')
      : fail('Webhook Meta', 'Configuração de segurança do webhook incompleta.'));

    checks.push(env.instagram_access_token && env.instagram_user_id
      ? ok('Instagram', 'Integração configurada no servidor.')
      : pending('Instagram', 'Integração ainda não está completamente configurada.'));

    checks.push(env.whatsapp_access_token && env.whatsapp_phone_number_id && env.whatsapp_business_account_id
      ? ok('WhatsApp', 'Integração de produção configurada no servidor.')
      : pending('WhatsApp', 'Estrutura pronta, aguardando ativação oficial do número/API.'));

    let lastIntegration = null;
    try {
      const rows = await db('integration_events?select=platform,event_type,status,error_message,created_at&order=created_at.desc&limit=1');
      lastIntegration = rows?.[0] || null;
    } catch {}

    const hasError = checks.some((item) => item.status === 'error');
    return res.status(hasError ? 207 : 200).json({
      status: hasError ? 'attention' : 'ok',
      checked_at: new Date().toISOString(),
      admin_user_id: user.id,
      checks,
      last_integration_event: lastIntegration,
      graph_version: env.graph_version,
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error?.message || 'Falha no diagnóstico do sistema.' });
  }
}
