import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { envStatus, getSupabaseAdminConfig, requireAdmin } from './_meta.js';
import { getInstagramConnectionForOrganization } from './_instagram.js';

function adminClient() {
  const { url, key } = getSupabaseAdminConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function inferPlan(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('essencial')) return 'starter';
  if (value.includes('profissional')) return 'professional';
  if (value.includes('empresarial')) return 'business';
  return null;
}

async function handleKiwify(req, res) {
  const supabase = adminClient();
  const { data: config, error: configError } = await supabase.from('saas_billing_provider_config').select('webhook_token,is_active').eq('provider','kiwify').maybeSingle();
  if (configError || !config?.is_active || !config?.webhook_token) return res.status(503).json({ error: 'Kiwify ainda não configurada.' });

  const signature = String(req.query?.signature || req.headers?.['x-kiwify-signature'] || '');
  const serialized = JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha1', config.webhook_token).update(serialized).digest('hex');
  if (!signature || !safeEqual(signature, expected)) return res.status(401).json({ error: 'Assinatura inválida.' });

  const body = req.body || {};
  const eventType = String(body.webhook_event_type || body.order_status || 'unknown');
  const orderId = String(body.order_id || '');
  const subscriptionId = String(body.Subscription?.subscription_id || body.Subscription?.id || body.subscription_id || '');
  const productId = String(body.Product?.product_id || '');
  const productName = String(body.Product?.product_name || '');
  const eventKey = [orderId || subscriptionId || 'unknown', eventType].join(':');

  let organizationId = String(body.TrackingParameters?.sck || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) organizationId = '';

  if (organizationId) {
    const { data: org } = await supabase.from('organizations').select('id').eq('id', organizationId).maybeSingle();
    if (!org) organizationId = '';
  }

  if (!organizationId && body.Customer?.email) {
    const email = String(body.Customer.email).trim().toLowerCase();
    const { data: profile } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (profile?.id) {
      const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', profile.id).eq('status','active').in('role',['owner','admin']).limit(1).maybeSingle();
      organizationId = membership?.organization_id || '';
    }
  }

  let planCode = null;
  if (productId) {
    const { data: mapped } = await supabase.from('saas_billing_products').select('plan_code').eq('provider','kiwify').eq('provider_product_id',productId).maybeSingle();
    planCode = mapped?.plan_code || null;
  }
  planCode ||= inferPlan(productName);

  const { error: eventError } = await supabase.from('saas_billing_webhook_events').insert({
    provider:'kiwify', event_key:eventKey, order_id:orderId || null, event_type:eventType,
    provider_product_id:productId || null, provider_subscription_id:subscriptionId || null,
    organization_id:organizationId || null
  });
  if (eventError?.code === '23505') return res.status(200).json({ ok:true, duplicate:true });
  if (eventError) throw eventError;

  if (!organizationId || !planCode) {
    await supabase.from('saas_billing_webhook_events').update({processing_error:'Organização ou plano não identificado.'}).eq('provider','kiwify').eq('event_key',eventKey);
    return res.status(202).json({ ok:true, pending_mapping:true });
  }

  if (productId) await supabase.from('saas_billing_products').upsert({provider:'kiwify',provider_product_id:productId,plan_code:planCode,product_name:productName,updated_at:new Date().toISOString()},{onConflict:'provider,provider_product_id'});

  const normalizedEvent = eventType.toLowerCase().trim();
  const positive = ['order_approved','subscription_renewed','compra_aprovada','assinatura_renovada'].includes(normalizedEvent) || (normalizedEvent === 'paid' && body.order_status === 'paid');
  const cancelled = ['subscription_canceled','subscription_cancelled','order_refunded','refund','chargeback','assinatura_cancelada','reembolso'].includes(normalizedEvent);
  const late = ['subscription_late','subscription_overdue','assinatura_atrasada'].includes(normalizedEvent);
  const nextPayment = body.Subscription?.next_payment || body.Subscription?.customer_access?.access_until || null;
  const now = new Date();
  const graceUntil = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000)).toISOString();

  if (positive) {
    await supabase.from('saas_subscriptions').upsert({
      organization_id:organizationId, plan_code:planCode, status:'active', billing_cycle:'monthly',
      provider:'kiwify', provider_subscription_id:subscriptionId || null,
      current_period_start:now.toISOString(), current_period_end:nextPayment,
      grace_period_ends_at:null, cancel_at_period_end:false, updated_at:now.toISOString()
    },{onConflict:'organization_id'});
    await supabase.from('organizations').update({status:'active',plan_code:planCode,updated_at:new Date().toISOString()}).eq('id',organizationId);
  } else if (late) {
    await supabase.from('saas_subscriptions').update({status:'past_due',grace_period_ends_at:graceUntil,updated_at:now.toISOString()}).eq('organization_id',organizationId);
  } else if (cancelled) {
    const isSubscriptionCancel = ['subscription_canceled','subscription_cancelled','assinatura_cancelada'].includes(normalizedEvent);
    const status = isSubscriptionCancel ? 'cancelled' : 'blocked';
    const update = {status,cancel_at_period_end:isSubscriptionCancel,grace_period_ends_at:null,updated_at:now.toISOString()};
    if (!isSubscriptionCancel) update.current_period_end = now.toISOString();
    await supabase.from('saas_subscriptions').update(update).eq('organization_id',organizationId);
  }

  await supabase.from('saas_billing_webhook_events').update({processed:true,processing_error:null}).eq('provider','kiwify').eq('event_key',eventKey);
  return res.status(200).json({ ok:true });
}

export default async function handler(req, res) {
  if (req.method === 'POST' && (req.url || '').includes('kiwify-webhook')) {
    try { return await handleKiwify(req, res); }
    catch (error) { return res.status(500).json({ error: 'Falha ao processar webhook.' }); }
  }
  try {
    const admin = await requireAdmin(req, 'integrations.manage');
    const status = await envStatus(req);
    const organizationId = admin.membership?.organization_id || null;
    const instagram = organizationId ? await getInstagramConnectionForOrganization(organizationId) : null;
    res.status(200).json({
      ...status,
      instagram_connected: Boolean(instagram?.status === 'connected' && instagram?.instagram_user_id),
      instagram_username: instagram?.username || null,
      instagram_user_id: instagram?.instagram_user_id || null,
      instagram_token_expires_at: instagram?.token_expires_at || null,
      instagram_scopes: instagram?.scopes || [],
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Não foi possível verificar as integrações.' });
  }
}
