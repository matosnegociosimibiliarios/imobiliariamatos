import {
  db,
  graphGet,
  logIntegration,
  requireAdmin,
  supabaseRpc,
  GRAPH_VERSION,
} from './_meta.js';

const DEFAULT_APP_ID = '1441246188102008';

async function exchangeCode(code) {
  const appId = process.env.META_APP_ID || DEFAULT_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    const error = new Error('META_APP_SECRET não configurado no servidor.');
    error.statusCode = 503;
    throw error;
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', code);

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error || !data.access_token) {
    const error = new Error(data.error?.message || `Meta OAuth ${response.status}`);
    error.statusCode = 400;
    error.metaError = data.error || null;
    throw error;
  }

  return data.access_token;
}

async function resolveOrganizationId(admin) {
  if (admin?.membership?.organization_id) return admin.membership.organization_id;
  const organizations = await db('organizations?select=id&limit=1');
  if (!organizations?.[0]?.id) throw new Error('Nenhuma organização ativa foi encontrada.');
  return organizations[0].id;
}

async function discoverPhoneNumber(accessToken, wabaId, requestedPhoneNumberId) {
  if (requestedPhoneNumberId) return requestedPhoneNumberId;
  if (!wabaId) return null;

  const data = await graphGet(
    `${encodeURIComponent(wabaId)}/phone_numbers`,
    accessToken,
    'id,display_phone_number,verified_name,is_on_biz_app,platform_type'
  );

  return data?.data?.[0]?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const admin = await requireAdmin(req, 'integrations.manage');

    const code = String(req.body?.code || '').trim();
    let wabaId = String(req.body?.waba_id || '').trim() || null;
    let phoneNumberId = String(req.body?.phone_number_id || '').trim() || null;
    const displayPhoneNumber = String(req.body?.display_phone_number || '').trim() || null;
    const sessionEvent = String(req.body?.session_event || '').trim() || null;

    if (!code) {
      res.status(400).json({ error: 'Código de autorização da Meta não recebido.' });
      return;
    }

    const accessToken = await exchangeCode(code);

    if (!wabaId) {
      const appId = process.env.META_APP_ID || DEFAULT_APP_ID;
      const appSecret = process.env.META_APP_SECRET;
      const debugUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`);
      debugUrl.searchParams.set('input_token', accessToken);
      debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`);

      const debugResponse = await fetch(debugUrl);
      const debugData = await debugResponse.json().catch(() => ({}));
      const targets = debugData?.data?.granular_scopes
        ?.flatMap((scope) => scope.target_ids || [])
        ?.filter(Boolean) || [];

      wabaId = targets[0] || null;
    }

    if (!wabaId) {
      throw new Error('A Meta não retornou a conta do WhatsApp Business selecionada.');
    }

    phoneNumberId = await discoverPhoneNumber(accessToken, wabaId, phoneNumberId);

    const subscribeResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(wabaId)}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const subscribeData = await subscribeResponse.json().catch(() => ({}));

    if (!subscribeResponse.ok || subscribeData.error) {
      const error = new Error(
        subscribeData.error?.message || `Meta webhook subscription ${subscribeResponse.status}`
      );
      error.statusCode = 400;
      error.metaError = subscribeData.error || null;
      throw error;
    }

    const organizationId = await resolveOrganizationId(admin);

    await supabaseRpc('store_meta_whatsapp_connection', {
      p_organization_id: organizationId,
      p_waba_id: wabaId,
      p_phone_number_id: phoneNumberId,
      p_display_phone_number: displayPhoneNumber,
      p_access_token: accessToken,
      p_metadata: {
        source: 'embedded_signup',
        session_event: sessionEvent,
        coexistence: sessionEvent === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
        connected_by_user_id: admin.id,
        connected_at: new Date().toISOString(),
      },
    });

    await logIntegration('whatsapp_embedded_signup_completed', {
      status: 'received',
      metadata: {
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        coexistence: sessionEvent === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
      },
    });

    res.status(200).json({
      ok: true,
      connected: true,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
      coexistence: sessionEvent === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
    });
  } catch (error) {
    console.error('Falha no Embedded Signup do WhatsApp:', error);

    await logIntegration('whatsapp_embedded_signup_error', {
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
          : 'Não foi possível concluir a conexão do WhatsApp Business.',
    });
  }
}
