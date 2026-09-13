import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLeads, updateLeadStatus } from '../../services/admin';
import {
  LEAD_STATUSES,
  STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  makeWhatsAppUrl,
} from '../../services/crm';

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);

    const { data, error } = await getLeads();

    if (error) {
      setMessage('Não foi possível carregar os leads.');
      setLeads([]);
    } else {
      setMessage('');
      setLeads(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const visibleLeads = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return leads;

    return leads.filter((lead) => {
      return [
        lead.name,
        lead.whatsapp,
        lead.email,
        lead.property?.code,
        lead.property?.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [leads, search]);

  async function changeStatus(leadId, status) {
    const { error } = await updateLeadStatus(leadId, status);

    if (error) {
      setMessage('Não foi possível mover o lead.');
      return;
    }

    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId ? { ...lead, status } : lead
      )
    );
  }

  return (
    <div className="admin-page crm-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">CRM de atendimento</span>
          <h1>Funil de clientes</h1>
        </div>
      </div>

      <div className="crm-toolbar">
        <input
          type="search"
          placeholder="Buscar cliente, telefone ou imóvel..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <span>
          {visibleLeads.length} lead{visibleLeads.length === 1 ? '' : 's'}
        </span>
      </div>

      {message && <div className="admin-message">{message}</div>}

      {loading ? (
        <section className="admin-panel">Carregando...</section>
      ) : (
        <div className="crm-board">
          {LEAD_STATUSES.map((status) => {
            const columnLeads = visibleLeads.filter(
              (lead) => lead.status === status.value
            );

            return (
              <section
                className={`crm-column crm-column-${status.value}`}
                key={status.value}
              >
                <header className="crm-column-header">
                  <strong>{status.label}</strong>
                  <span>{columnLeads.length}</span>
                </header>

                <div className="crm-column-body">
                  {columnLeads.length === 0 ? (
                    <div className="crm-empty-column">Nenhum cliente</div>
                  ) : (
                    columnLeads.map((lead) => {
                      const whatsappUrl = makeWhatsAppUrl(
                        lead.whatsapp,
                        lead.name
                      );

                      return (
                        <article className="crm-card" key={lead.id}>
                          <Link
                            className="crm-card-main"
                            to={`/admin/leads/${lead.id}`}
                          >
                            <strong>{lead.name}</strong>

                            <span>{lead.whatsapp || (lead.source_platform === 'instagram' ? 'Instagram Direct' : 'Sem telefone')}</span>

                            {lead.last_inbound_message && <small className="crm-instagram-preview">{lead.last_inbound_message}</small>}

                            {lead.property && (
                              <small>
                                {lead.property.code} — {lead.property.title}
                              </small>
                            )}

                            {lead.next_action_at && (
                              <div className="crm-next-action">
                                <b>Próxima ação</b>
                                <span>
                                  {lead.next_action_text || 'Atender cliente'}
                                </span>
                                <small>
                                  {formatDateTime(lead.next_action_at)}
                                </small>
                              </div>
                            )}

                            {lead.deal_value != null && (
                              <div className="crm-deal-value">
                                {formatCurrency(lead.deal_value)}
                              </div>
                            )}
                          </Link>

                          <div className="crm-card-footer">
                            <select
                              value={lead.status}
                              onChange={(event) =>
                                changeStatus(lead.id, event.target.value)
                              }
                              aria-label="Mover lead"
                            >
                              {LEAD_STATUSES.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                >
                                  {item.label}
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
