import { supabaseRpc, db, GRAPH_VERSION } from './_meta.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const threshold = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const connections = await supabaseRpc('list_meta_instagram_connections_for_refresh', {
    p_before: threshold,
  });

  let refreshed = 0;
  let failed = 0;

  for (const connection of connections || []) {
    try {
      const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/refresh_access_token`);
      url.searchParams.set('grant_type', 'ig_refresh_token');
      url.searchParams.set('access_token', connection.access_token);

      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error || !data.access_token) {
        throw new Error(data.error?.message || 'Falha ao renovar token do Instagram.');
      }

      const expiresIn = Number(data.expires_in || 0);
      const expiresAt = expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

      await supabaseRpc('store_meta_instagram_connection', {
        p_organization_id: connection.organization_id,
        p_instagram_user_id: connection.instagram_user_id,
        p_username: connection.username,
        p_account_type: connection.account_type,
        p_access_token: data.access_token,
        p_scopes: connection.scopes || [],
        p_token_expires_at: expiresAt,
        p_metadata: {
          ...(connection.metadata || {}),
          refreshed_at: new Date().toISOString(),
          refresh_source: 'vercel_cron',
        },
      });

      refreshed += 1;
    } catch (error) {
      failed += 1;
      console.error('Falha ao renovar token do Instagram', {
        organization_id: connection.organization_id,
        instagram_user_id: connection.instagram_user_id,
        error: error.message,
      });

      try {
        await db('integration_events', {
          method: 'POST',
          body: {
            platform: 'meta',
            event_type: 'instagram_token_refresh_error',
            status: 'error',
            organization_id: connection.organization_id,
            error_message: error.message,
            metadata: { instagram_user_id: connection.instagram_user_id },
          },
          prefer: 'return=minimal',
        });
      } catch {}
    }
  }

  res.status(200).json({ ok: true, refreshed, failed });
}
