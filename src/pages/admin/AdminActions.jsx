import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUpcomingActions } from '../../services/admin';
import {
  STATUS_LABELS,
  formatDateTime,
  makeWhatsAppUrl,
} from '../../services/crm';

export default function AdminActions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await getUpcomingActions();
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  const now = Date.now();

  const overdue = useMemo(
    () =>
      items.filter(
        (item) =>
          item.next_action_at &&
          new Date(item.next_action_at).getTime() < now
      ),
    [items, now]
  );

  const upcoming = useMemo(
    () =>
      items.filter(
        (item) =>
          item.next_action_at &&
          new Date(item.next_action_at).getTime() >= now
      ),
    [items, now]
  );

  function renderItem(item, overdueItem = false) {
    const whatsappUrl = makeWhatsAppUrl(item.whatsapp, item.name);

    return (
      <article
        className={`action-card ${overdueItem ? 'overdue' : ''}`}
        key={item.id}
      >
        <div>
          <small>
            {overdueItem ? 'Atrasado' : STATUS_LABELS[item.status]}
          </small>
          <h3>{item.name}</h3>
          <p>{item.next_action_text || 'Atender cliente'}</p>
          <strong>{formatDateTime(item.next_action_at)}</strong>

          {item.property && (
            <span>
              {item.property.code} — {item.property.title}
            </span>
          )}
        </div>

        <div className="action-card-buttons">
          <Link to={`/admin/leads/${item.id}`}>Abrir ficha</Link>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Rotina comercial</span>
          <h1>Próximas ações</h1>
        </div>
      </div>

      {loading ? (
        <section className="admin-panel">Carregando...</section>
      ) : (
        <>
          <section className="admin-panel">
            <div className="action-section-title">
              <h2>Atrasadas</h2>
              <span>{overdue.length}</span>
            </div>

            <div className="actions-list">
              {overdue.length === 0 ? (
                <p>Nenhuma ação atrasada.</p>
              ) : (
                overdue.map((item) => renderItem(item, true))
              )}
            </div>
          </section>

          <section className="admin-panel">
            <div className="action-section-title">
              <h2>Próximas</h2>
              <span>{upcoming.length}</span>
            </div>

            <div className="actions-list">
              {upcoming.length === 0 ? (
                <p>Nenhuma próxima ação cadastrada.</p>
              ) : (
                upcoming.map((item) => renderItem(item))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
