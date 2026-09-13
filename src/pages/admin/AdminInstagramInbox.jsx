import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import InstagramConversation from '../../components/InstagramConversation';
import { getInstagramConversations } from '../../services/admin';
import { STATUS_LABELS, formatDateTime } from '../../services/crm';

function previewText(item) {
  return (
    item.last_inbound_message ||
    item.last_outbound_message ||
    'Conversa iniciada no Instagram'
  );
}

export default function AdminInstagramInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeId = searchParams.get('lead');

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);

    const result = await getInstagramConversations();

    if (result.error) {
      setError('Não foi possível carregar as conversas do Instagram.');
    } else {
      const rows = result.data || [];
      setItems(rows);
      setError('');

      if (!activeId && rows[0]?.id) {
        setSearchParams({ lead: rows[0].id }, { replace: true });
      }
    }

    if (!quiet) setLoading(false);
  }

  useEffect(() => {
    load();

    const interval = window.setInterval(() => {
      load({ quiet: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [activeId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) =>
      [item.name, item.last_inbound_message, item.last_outbound_message]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [items, search]);

  const active = items.find((item) => item.id === activeId) || null;
  const unreadTotal = items.reduce(
    (sum, item) => sum + Number(item.social_unread_count || 0),
    0
  );

  function selectLead(id) {
    setSearchParams({ lead: id });
  }

  return (
    <div className="admin-page ig-inbox-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Atendimento</span>
          <h1>Mensagens do Instagram</h1>
        </div>

        <div className="ig-inbox-summary">
          <strong>{unreadTotal}</strong>
          <span>não lidas</span>
        </div>
      </div>

      {error && <div className="admin-message">{error}</div>}

      <div className="ig-inbox-shell">
        <aside className="ig-inbox-list">
          <div className="ig-inbox-search">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversa..."
            />
          </div>

          <div className="ig-inbox-contacts">
            {loading ? (
              <p>Carregando...</p>
            ) : filtered.length === 0 ? (
              <p>Nenhuma conversa encontrada.</p>
            ) : (
              filtered.map((item) => (
                <button
                  type="button"
                  className={`ig-contact ${item.id === activeId ? 'active' : ''}`}
                  key={item.id}
                  onClick={() => selectLead(item.id)}
                >
                  <span className="ig-contact-avatar">
                    {String(item.name || 'I').slice(0, 1).toUpperCase()}
                  </span>

                  <span className="ig-contact-body">
                    <span className="ig-contact-row">
                      <strong>{item.name}</strong>
                      <small>
                        {formatDateTime(
                          item.last_message_at || item.last_inbound_at || item.created_at
                        )}
                      </small>
                    </span>

                    <span className="ig-contact-row">
                      <span className="ig-contact-preview">{previewText(item)}</span>
                      {Number(item.social_unread_count || 0) > 0 && (
                        <b className="ig-unread-badge">
                          {item.social_unread_count}
                        </b>
                      )}
                    </span>

                    <small className="ig-contact-status">
                      {STATUS_LABELS[item.status] || item.status}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="ig-inbox-chat">
          {active ? (
            <>
              <div className="ig-inbox-chat-top">
                <div>
                  <strong>{active.name}</strong>
                  <span>
                    {STATUS_LABELS[active.status] || active.status} · Instagram Direct
                  </span>
                </div>

                <Link to={`/admin/leads/${active.id}`}>
                  Abrir ficha do cliente
                </Link>
              </div>

              <InstagramConversation
                leadId={active.id}
                leadName={active.name}
                onActivity={() => load({ quiet: true })}
              />
            </>
          ) : (
            <div className="ig-inbox-empty">
              <h2>Selecione uma conversa</h2>
              <p>As mensagens recebidas no Instagram aparecerão aqui.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
