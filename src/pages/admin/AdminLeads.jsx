import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createManualLead, getLeads, updateLeadStatus } from '../../services/admin';
import {
  LEAD_STATUSES,
  formatCurrency,
  formatDateTime,
  makeWhatsAppUrl,
  originLabel,
} from '../../services/crm';

const ORIGIN_FILTERS = [
  ['', 'Todas as origens'],
  ['site', 'Site'],
  ['instagram', 'Instagram'],
  ['whatsapp', 'WhatsApp'],
  ['facebook', 'Facebook'],
  ['meta', 'Meta'],
  ['manual', 'Manual'],
];

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', whatsapp: '', email: '', message: '' });

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

  useEffect(() => { load(); }, []);

  const visibleLeads = useMemo(() => {
    const term = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const platform =
        lead.initial_source_platform || lead.source_platform ||
        (['instagram','facebook','whatsapp','meta'].includes(lead.source)
          ? lead.source
          : 'site');

      const originOk = !origin || platform === origin;
      const searchOk = !term || [
        lead.name,
        lead.whatsapp,
        lead.email,
        lead.property?.code,
        lead.property?.title,
        lead.initial_source_detail,
        lead.last_source_detail,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));

      return originOk && searchOk;
    });
  }, [leads, search, origin]);

  async function submitManualLead(event) {
    event.preventDefault();
    if (form.name.trim().length < 2 || form.whatsapp.replace(/\D/g, '').length < 10) {
      setMessage('Informe o nome e um WhatsApp válido.');
      return;
    }
    setSaving(true);
    const { error } = await createManualLead(form);
    setSaving(false);
    if (error) { setMessage('Não foi possível cadastrar o cliente.'); return; }
    setForm({ name: '', whatsapp: '', email: '', message: '' });
    setShowForm(false);
    setMessage('Cliente cadastrado com sucesso.');
    await load();
  }

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
        <button type="button" className="admin-button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Cancelar' : '+ Novo cliente'}
        </button>
      </div>

      {showForm && (
        <form className="admin-panel" onSubmit={submitManualLead} style={{display:'grid',gap:12,marginBottom:16}}>
          <h2 style={{margin:0}}>Cadastrar cliente</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
            <label>Nome *<input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></label>
            <label>WhatsApp *<input required placeholder="(32) 99999-9999" value={form.whatsapp} onChange={(e)=>setForm({...form,whatsapp:e.target.value})} /></label>
            <label>E-mail<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></label>
          </div>
          <label>Observação<textarea rows="3" value={form.message} onChange={(e)=>setForm({...form,message:e.target.value})} /></label>
          <div><button className="admin-button" type="submit" disabled={saving}>{saving?'Salvando...':'Salvar cliente'}</button></div>
        </form>
      )}

      <div className="crm-toolbar crm-toolbar-multichannel">
        <input
          type="search"
          placeholder="Buscar cliente, telefone ou imóvel..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select value={origin} onChange={(event) => setOrigin(event.target.value)}>
          {ORIGIN_FILTERS.map(([value, label]) => (
            <option value={value} key={value || 'all'}>{label}</option>
          ))}
        </select>

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
                      const whatsappUrl = makeWhatsAppUrl(lead.whatsapp, lead.name);
                      const platform = lead.initial_source_platform || lead.source_platform || 'site';
                      const channel = lead.initial_source_channel || lead.source_channel || 'form';

                      return (
                        <article className="crm-card" key={lead.id}>
                          <Link className="crm-card-main" to={`/admin/leads/${lead.id}`}>
                            <div className="crm-card-title-row">
                              <strong>{lead.name}</strong>
                              <span className={`origin-badge origin-${platform}`}>
                                {originLabel(platform, channel)}
                              </span>
                            </div>

                            <span>
                              {lead.whatsapp || (lead.source_platform === 'instagram'
                                ? 'Instagram Direct'
                                : 'Sem telefone')}
                            </span>

                            {lead.last_inbound_message && (
                              <small className="crm-instagram-preview">
                                {lead.last_inbound_message}
                              </small>
                            )}

                            {lead.property && (
                              <small>{lead.property.code} — {lead.property.title}</small>
                            )}

                            {lead.next_action_at && (
                              <div className="crm-next-action">
                                <b>Próxima ação</b>
                                <span>{lead.next_action_text || 'Atender cliente'}</span>
                                <small>{formatDateTime(lead.next_action_at)}</small>
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
                              onChange={(event) => changeStatus(lead.id, event.target.value)}
                              aria-label="Mover lead"
                            >
                              {LEAD_STATUSES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>

                            {whatsappUrl && (
                              <a href={whatsappUrl} target="_blank" rel="noreferrer">
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
