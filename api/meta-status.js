import { envStatus, requireAdmin } from './_meta.js';
import { getInstagramConnectionForOrganization } from './_instagram.js';

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, 'integrations.manage');
    const status = await envStatus(req);
    const organizationId = admin.membership?.organization_id || null;
    const instagram = organizationId
      ? await getInstagramConnectionForOrganization(organizationId)
      : null;

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
