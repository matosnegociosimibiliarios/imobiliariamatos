import { supabase } from '../lib/supabase';

const DEFAULT_PREFERENCES = {
  enabled: true,
  instagram_enabled: true,
  whatsapp_enabled: true,
  forms_enabled: true,
};

export async function getNotificationPreferences(organizationId) {
  if (!organizationId) return { data: DEFAULT_PREFERENCES, error: null };

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { data: DEFAULT_PREFERENCES, error: userError };

  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('enabled,instagram_enabled,whatsapp_enabled,forms_enabled')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  return { data: { ...DEFAULT_PREFERENCES, ...(data || {}) }, error };
}

export async function saveNotificationPreferences(organizationId, preferences) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { data: null, error: userError || new Error('Usuário não autenticado.') };

  return supabase
    .from('user_notification_preferences')
    .upsert({
      organization_id: organizationId,
      user_id: user.id,
      enabled: preferences.enabled !== false,
      instagram_enabled: preferences.instagram_enabled !== false,
      whatsapp_enabled: preferences.whatsapp_enabled !== false,
      forms_enabled: preferences.forms_enabled !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,user_id' })
    .select()
    .single();
}


export async function getUnreadNotificationCounts(organizationId) {
  if (!organizationId) return { data: { instagram: 0, whatsapp: 0, form: 0, total: 0 }, error: null };
  const { data, error } = await supabase.rpc('admin_notification_unread_counts', {
    p_organization_id: organizationId,
  });
  return {
    data: {
      instagram: Number(data?.instagram || 0),
      whatsapp: Number(data?.whatsapp || 0),
      form: Number(data?.form || 0),
      total: Number(data?.total || 0),
    },
    error,
  };
}

export async function getNotificationFeed(organizationId, limit = 60) {
  if (!organizationId) return { data: [], error: null };

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { data: [], error: userError };

  const notifications = await supabase
    .from('app_notifications')
    .select('id,organization_id,kind,title,body,route,entity_type,entity_id,created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (notifications.error || !(notifications.data || []).length) return notifications;

  const ids = notifications.data.map((item) => item.id);
  const reads = await supabase
    .from('app_notification_reads')
    .select('notification_id')
    .eq('user_id', user.id)
    .in('notification_id', ids);

  if (reads.error) return { data: notifications.data, error: reads.error };

  const readIds = new Set((reads.data || []).map((item) => Number(item.notification_id)));
  return {
    data: notifications.data.map((item) => ({ ...item, read: readIds.has(Number(item.id)) })),
    error: null,
  };
}

export async function markNotificationRead(notificationId) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: userError || new Error('Usuário não autenticado.') };

  return supabase
    .from('app_notification_reads')
    .upsert({ notification_id: notificationId, user_id: user.id }, { onConflict: 'notification_id,user_id' });
}

export async function markNotificationsRead(notificationIds = []) {
  if (!notificationIds.length) return { error: null };

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: userError || new Error('Usuário não autenticado.') };

  return supabase
    .from('app_notification_reads')
    .upsert(
      notificationIds.map((notificationId) => ({ notification_id: notificationId, user_id: user.id })),
      { onConflict: 'notification_id,user_id' }
    );
}

export function subscribeToNotifications(organizationId, onNotification) {
  if (!organizationId) return null;

  const channel = supabase
    .channel('goi-global-notifications-' + organizationId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'app_notifications',
        filter: 'organization_id=eq.' + organizationId,
      },
      (payload) => onNotification?.(payload.new)
    )
    .subscribe();

  return channel;
}

export async function unsubscribeFromNotifications(channel) {
  if (!channel) return;
  await supabase.removeChannel(channel);
}

export function notificationEnabled(preferences, kind) {
  if (!preferences?.enabled) return false;
  if (kind === 'instagram') return preferences.instagram_enabled !== false;
  if (kind === 'whatsapp') return preferences.whatsapp_enabled !== false;
  if (kind === 'form') return preferences.forms_enabled !== false;
  return true;
}
