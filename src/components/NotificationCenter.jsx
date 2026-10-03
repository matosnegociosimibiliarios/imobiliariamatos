import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { can } from '../services/team';
import {
  getNotificationFeed,
  getNotificationPreferences,
  getUnreadNotificationCounts,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsRead,
  notificationEnabled,
  saveNotificationPreferences,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from '../services/notifications';

const KIND_LABELS = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  form: 'Formulário',
};

function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' h';
  return date.toLocaleDateString('pt-BR');
}

export default function NotificationCenter({ access }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [counts, setCounts] = useState({ instagram: 0, whatsapp: 0, form: 0, total: 0 });
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const toastTimer = useRef(null);

  const organizationId = access?.organization_id;

  function kindAllowed(kind) {
    if (kind === 'instagram' || kind === 'whatsapp') return can(access, 'messages.view');
    if (kind === 'form') return can(access, 'leads.view') || can(access, 'captures.view');
    return true;
  }

  function itemVisible(item, prefs = preferences) {
    return kindAllowed(item.kind) && notificationEnabled(prefs, item.kind);
  }

  async function load() {
    if (!organizationId) return;
    const [feedResult, prefResult, countResult] = await Promise.all([
      getNotificationFeed(organizationId),
      getNotificationPreferences(organizationId),
      getUnreadNotificationCounts(organizationId),
    ]);
    if (!feedResult.error) setItems(feedResult.data || []);
    if (!prefResult.error) setPreferences(prefResult.data);
    if (!countResult.error) setCounts(countResult.data);
  }

  useEffect(() => {
    load();
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !preferences) return undefined;

    const channel = subscribeToNotifications(organizationId, (notification) => {
      const item = { ...notification, read: false };
      setItems((current) => [item, ...current].slice(0, 60));
      setCounts((current) => ({
        ...current,
        [item.kind]: Number(current[item.kind] || 0) + 1,
        total: Number(current.total || 0) + 1,
      }));

      if (itemVisible(item, preferences)) {
        setToast(item);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 6500);
      }
    });

    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      unsubscribeFromNotifications(channel);
    };
  }, [
    organizationId,
    preferences?.enabled,
    preferences?.instagram_enabled,
    preferences?.whatsapp_enabled,
    preferences?.forms_enabled,
    access,
  ]);

  const visibleItems = useMemo(
    () => items.filter((item) => itemVisible(item)),
    [items, preferences, access]
  );

  const unreadItems = visibleItems.filter((item) => !item.read);
  const unreadCount = useMemo(() => {
    if (!preferences?.enabled) return 0;
    let total = 0;
    if (preferences.instagram_enabled !== false && kindAllowed('instagram')) total += Number(counts.instagram || 0);
    if (preferences.whatsapp_enabled !== false && kindAllowed('whatsapp')) total += Number(counts.whatsapp || 0);
    if (preferences.forms_enabled !== false && kindAllowed('form')) total += Number(counts.form || 0);
    return total;
  }, [counts, preferences, access]);

  async function openNotification(item) {
    if (!item.read) {
      await markNotificationRead(item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      setCounts((current) => ({
        ...current,
        [item.kind]: Math.max(0, Number(current[item.kind] || 0) - 1),
        total: Math.max(0, Number(current.total || 0) - 1),
      }));
    }
    setOpen(false);
    setToast(null);
    if (item.route) navigate(item.route);
  }

  async function markAllRead() {
    if (!unreadCount) return;
    const result = await markAllNotificationsRead(organizationId);
    if (result.error) return;
    setItems((current) => current.map((item) => itemVisible(item) ? { ...item, read: true } : item));
    const refreshed = await getUnreadNotificationCounts(organizationId);
    if (!refreshed.error) setCounts(refreshed.data);
  }

  async function updatePreference(key, value) {
    const next = { ...(preferences || {}), [key]: value };
    setPreferences(next);
    setSaving(true);
    const result = await saveNotificationPreferences(organizationId, next);
    setSaving(false);
    if (result.error) {
      setPreferences(preferences);
      window.alert('Não foi possível salvar a preferência de notificações.');
    }
  }

  return (
    <>
      <div className="goi-notification-center">
        <button
          type="button"
          className={"goi-notification-bell " + (unreadCount ? 'has-unread' : '')}
          onClick={() => { setOpen((value) => !value); setSettingsOpen(false); }}
          aria-label={"Notificações" + (unreadCount ? ': ' + unreadCount + ' não lidas' : '')}
        >
          <span aria-hidden="true">🔔</span>
          {unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}
        </button>

        {open && (
          <div className="goi-notification-panel">
            <div className="goi-notification-panel-head">
              <div><strong>Notificações</strong><small>{unreadCount ? unreadCount + ' não lida' + (unreadCount === 1 ? '' : 's') : 'Tudo em dia'}</small></div>
              <button type="button" onClick={() => setSettingsOpen((value) => !value)}>⚙</button>
            </div>

            {settingsOpen && preferences && (
              <div className="goi-notification-settings">
                <strong>Preferências deste usuário</strong>
                <label><span>Receber notificações</span><input type="checkbox" checked={preferences.enabled !== false} onChange={(e) => updatePreference('enabled', e.target.checked)} /></label>
                <label><span>Instagram</span><input type="checkbox" checked={preferences.instagram_enabled !== false} disabled={preferences.enabled === false} onChange={(e) => updatePreference('instagram_enabled', e.target.checked)} /></label>
                <label><span>WhatsApp</span><input type="checkbox" checked={preferences.whatsapp_enabled !== false} disabled={preferences.enabled === false} onChange={(e) => updatePreference('whatsapp_enabled', e.target.checked)} /></label>
                <label><span>Formulários do site</span><input type="checkbox" checked={preferences.forms_enabled !== false} disabled={preferences.enabled === false} onChange={(e) => updatePreference('forms_enabled', e.target.checked)} /></label>
                {saving && <small>Salvando...</small>}
              </div>
            )}

            <div className="goi-notification-actions">
              <span>Recentes</span>
              {unreadCount > 0 && <button type="button" onClick={markAllRead}>Marcar todas como lidas</button>}
            </div>

            <div className="goi-notification-list">
              {visibleItems.length === 0 && <div className="goi-notification-empty">Nenhuma notificação.</div>}
              {visibleItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={"goi-notification-item " + (!item.read ? 'unread' : '')}
                  onClick={() => openNotification(item)}
                >
                  <span className={"goi-notification-kind " + item.kind}>{item.kind === 'instagram' ? 'IG' : item.kind === 'whatsapp' ? 'WA' : 'F'}</span>
                  <span className="goi-notification-copy">
                    <strong>{item.title}</strong>
                    {item.body && <span>{item.body}</span>}
                    <small>{KIND_LABELS[item.kind] || 'GOI'} · {timeLabel(item.created_at)}</small>
                  </span>
                  {!item.read && <i />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && itemVisible(toast) && (
        <button type="button" className={"goi-notification-toast " + toast.kind} onClick={() => openNotification(toast)}>
          <span className="goi-notification-toast-icon">{toast.kind === 'instagram' ? 'IG' : toast.kind === 'whatsapp' ? 'WA' : 'F'}</span>
          <span><strong>{toast.title}</strong>{toast.body && <small>{toast.body}</small>}</span>
          <i>×</i>
        </button>
      )}
    </>
  );
}
