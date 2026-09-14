import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getOwnerCaptures,
  updateOwnerCapture,
} from '../../services/admin';
import {
  CAPTURE_STATUSES,
} from '../../services/captures';
import {
  formatCurrency,
  formatDateTime,
  makeWhatsAppUrl,
} from '../../services/crm';

export default function AdminCaptures() {
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);

    const { data, error } = await getOwnerCaptures();

    if (error) {
      setMessage('Não foi possível carregar as captações.');
      setCaptures([]);
    } else {
      setMessage('');
      setCaptures(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return captures;

    return captures.filter((item) =>
      [
        item.owner_name,
        item.whatsapp,
        item.property_type,
        item.city_name,
        item.neighborhood_name,
        item.converted_property?.code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [captures, search]);

  async function changeStatus(id, status) {
    const { error } = await updateOwnerCapture(id, { status });

    if (error) {
      setMessage('Não foi possível mover a captação.');
      return;
    }

    setCaptures((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );
  }

  return (
    <div className="admin-page crm-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Proprietários</span>
          <h1>Funil de captações</h1>
        </div>

        <a
          className="admin-link-button"
          href="/anuncie-seu-imovel"
          target="_blank"
          rel="noreferrer"
        >
          Ver formulário público
        </a>
      </div>

      <div className="crm-toolbar">
        <input
          type="search"
          placeholder="Buscar proprietário, telefone, cidade ou imóvel..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <span>
          {visible.length} captação{visible.length === 1 ? '' : 'ões'}
        </span>
      </div>

      {message && <div className="admin-message">{message}</div>}

      {loading ? (
        <section className="admin-panel">Carregando...</section>
      ) : (
        <div className="crm-board capture-board">
          {CAPTURE_STATUSES.map((status) => {
            const columnItems = visible.filter(
              (item) => item.status === status.value
            );

            return (
              <section
                className={`crm-column capture-column capture-column-${status.value}`}
                key={status.value}
              >
                <header className="crm-column-header">
                  <strong>{status.label}</strong>
                  <span>{columnItems.length}</span>
                </header>

                <div className="crm-column-body">
                  {columnItems.length === 0 ? (
                    <div className="crm-empty-column">Nenhuma captação</div>
                  ) : (
                    columnItems.map((item) => {
                      const whatsappUrl = makeWhatsAppUrl(
                        item.whatsapp,
                        item.owner_name
                      );

                      return (
                        <article className="crm-card" key={item.id}>
                          <Link
                            className="crm-card-main"
                            to={`/admin/captacoes/${item.id}`}
                          >
                            <strong>{item.owner_name}</strong>
                            <span>{item.whatsapp}</span>

                            <small>
                              {item.property_type} · {item.neighborhood_name
                                ? `${item.neighborhood_name}, `
                                : ''}
                              {item.city_name}/{item.state_code}
                            </small>

                            <small>
                              {item.request_type === 'valuation'
                                ? 'Solicitou avaliação'
                                : 'Quer anunciar'}
                            </small>

                            {item.asking_value != null && (
                              <div className="crm-deal-value">
                                Pretensão: {formatCurrency(item.asking_value)}
                              </div>
                            )}

                            {item.next_action_at && (
                              <div className="crm-next-action">
                                <b>Próxima ação</b>
                                <span>
                                  {item.next_action_text || 'Atender proprietário'}
                                </span>
                                <small>
                                  {formatDateTime(item.next_action_at)}
                                </small>
                              </div>
                            )}

                            {item.converted_property && (
                              <div className="capture-property-created">
                                {item.converted_property.code} criado
                              </div>
                            )}
                          </Link>

                          <div className="crm-card-footer">
                            <select
                              value={item.status}
                              onChange={(event) =>
                                changeStatus(item.id, event.target.value)
                              }
                            >
                              {CAPTURE_STATUSES.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>

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
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
