import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import InstagramConversation from '../../components/InstagramConversation';
import {
  addLeadNote,
  getLeadDetails,
  getLeadNotes,
  getLeadStatusHistory,
  getLeadSourceHistory,
  updateLead,
} from '../../services/admin';
import {
  LEAD_STATUSES,
  STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  makeWhatsAppUrl,
  toDateTimeLocal,
  originLabel,
} from '../../services/crm';

export default function AdminLeadDetail() {
  const { id } = useParams();

  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [sourceHistory, setSourceHistory] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    status: 'new',
    next_action_text: '',
    next_action_at: '',
    lost_reason: '',
    deal_value: '',
    commission_value: '',
  });

  async function load() {
    setLoading(true);

    const [leadResult, notesResult, historyResult, sourceHistoryResult] = await Promise.all([
      getLeadDetails(id),
      getLeadNotes(id),
      getLeadStatusHistory(id),
      getLeadSourceHistory(id),
    ]);

    if (leadResult.error || !leadResult.data) {
      setMessage('Lead não encontrado.');
      setLoading(false);
      return;
    }

    const data = leadResult.data;

    setLead(data);
    setNotes(notesResult.data || []);
    setHistory(historyResult.data || []);
    setSourceHistory(sourceHistoryResult.data || []);

    setForm({
      status: data.status || 'new',
      next_action_text: data.next_action_text || '',
      next_action_at: toDateTimeLocal(data.next_action_at),
      lost_reason: data.lost_reason || '',
      deal_value: data.deal_value ?? '',
      commission_value: data.commission_value ?? '',
    });

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function numberOrNull(value) {
    return value === '' ? null : Number(value);
  }

  async function save() {
    setSaving(true);
    setMessage('');

    const payload = {
      status: form.status,
      next_action_text: form.next_action_text.trim() || null,
      next_action_at: form.next_action_at
        ? new Date(form.next_action_at).toISOString()
        : null,
      lost_reason:
        form.status === 'lost'
          ? form.lost_reason.trim() || null
          : null,
      deal_value: numberOrNull(form.deal_value),
      commission_value: numberOrNull(form.commission_value),
    };

    const { error } = await updateLead(id, payload);

    if (error) {
      setMessage(`Não foi possível salvar: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage('Alterações salvas.');
    await load();
    setSaving(false);
  }

  async function addNote(event) {
    event.preventDefault();

    if (!noteText.trim()) return;

    const { error } = await addLeadNote(id, noteText);

    if (error) {
      setMessage('Não foi possível salvar a anotação.');
      return;
    }

    setNoteText('');

    const result = await getLeadNotes(id);
    setNotes(result.data || []);
  }

  const whatsappUrl = useMemo(
    () => makeWhatsAppUrl(lead?.whatsapp, lead?.name),
    [lead]
  );

  if (loading) {
    return <div className="admin-loading">Carregando cliente...</div>;
  }

  if (!lead) {
    return (
      <div className="admin-page">
        <div className="admin-message">{message || 'Lead não encontrado.'}</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Ficha do cliente</span>
          <h1>{lead.name}</h1>
        </div>

        <Link className="admin-link-button" to="/admin/leads">
          Voltar ao funil
        </Link>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="lead-detail-grid">
        <div>
          <section className="admin-panel">
            <div className="lead-profile-header">
              <div>
                <h2>Contato</h2>
                <p>{lead.whatsapp || (lead.source_platform === 'instagram' ? 'Contato pelo Instagram Direct' : 'Telefone não informado')}</p>
                {lead.email && <p>{lead.email}</p>}
              </div>

              {whatsappUrl && (
                <a
                  className="button"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir WhatsApp
                </a>
              )}
            </div>

            {lead.message && (
              <div className="lead-original-message">
                <strong>Mensagem inicial</strong>
                <p>{lead.message}</p>
              </div>
            )}

            <div className="lead-meta-grid">
              <div>
                <span>Origem</span>
                <strong>{lead.source_detail || lead.source}</strong>
              </div>

              <div>
                <span>Recebido em</span>
                <strong>{formatDateTime(lead.created_at)}</strong>
              </div>

              <div>
                <span>Etapa atual</span>
                <strong>{STATUS_LABELS[lead.status] || lead.status}</strong>
              </div>
            </div>
          </section>

          {lead.property && (
            <section className="admin-panel">
              <h2>Imóvel de interesse</h2>

              <div className="lead-property-box">
                <div>
                  <strong>{lead.property.code}</strong>
                  <h3>{lead.property.title}</h3>
                  <p>{lead.property.public_location_text}</p>
                </div>

                <a
                  className="admin-link-button"
                  href={`/imovel/${lead.property.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver imóvel
                </a>
              </div>
            </section>
          )}

          <section className="admin-panel">
            <h2>Origem do cliente</h2>

            <div className="lead-meta-grid">
              <div>
                <span>Origem inicial</span>
                <strong>
                  {originLabel(
                    lead.initial_source_platform || lead.source_platform || 'site',
                    lead.initial_source_channel || lead.source_channel || 'form',
                    lead.initial_source_detail || lead.source_detail
                  )}
                </strong>
              </div>

              <div>
                <span>Última origem</span>
                <strong>
                  {originLabel(
                    lead.last_source_platform || lead.source_platform || 'site',
                    lead.last_source_channel || lead.source_channel || 'form',
                    lead.last_source_detail || lead.source_detail
                  )}
                </strong>
              </div>

              <div>
                <span>Último contato de origem</span>
                <strong>{formatDateTime(lead.last_source_at || lead.created_at)}</strong>
              </div>
            </div>

            {lead.campaign_name && (
              <div className="lead-original-message">
                <strong>Campanha</strong>
                <p>{lead.campaign_name}{lead.ad_name ? ` · ${lead.ad_name}` : ''}</p>
              </div>
            )}

            {sourceHistory.length > 1 && (
              <div className="source-history-list">
                <strong>Histórico de canais</strong>
                {sourceHistory.map((item) => (
                  <div key={item.id}>
                    <span>{originLabel(item.platform, item.channel, item.detail)}</span>
                    <small>{formatDateTime(item.occurred_at)}</small>
                  </div>
                ))}
              </div>
            )}
          </section>

          {lead.source_platform === 'instagram' && lead.source_channel === 'direct' && (
            <section className="admin-panel">
              <div className="panel-title-row">
                <h2>Conversa no Instagram</h2>
                <Link to={`/admin/mensagens?lead=${lead.id}`}>Abrir caixa de mensagens</Link>
              </div>

              <InstagramConversation
                leadId={lead.id}
                leadName={lead.name}
                compact
              />
            </section>
          )}
          <section className="admin-panel">
            <h2>Anotações do atendimento</h2>

            <form className="lead-note-form" onSubmit={addNote}>
              <textarea
                rows="4"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Ex.: Cliente procura casa até R$ 300 mil, com 3 quartos e garagem."
              />

              <button className="button">Adicionar anotação</button>
            </form>

            <div className="lead-notes-list">
              {notes.length === 0 ? (
                <p>Nenhuma anotação ainda.</p>
              ) : (
                notes.map((note) => (
                  <article key={note.id}>
                    <p>{note.note}</p>
                    <small>{formatDateTime(note.created_at)}</small>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-panel">
            <h2>Histórico do funil</h2>

            <div className="lead-history">
              {history.length === 0 ? (
                <p>Ainda não houve mudança de etapa.</p>
              ) : (
                history.map((item) => (
                  <article key={item.id}>
                    <span className="history-dot" />
                    <div>
                      <strong>
                        {STATUS_LABELS[item.from_status] || item.from_status || 'Entrada'}
                        {' → '}
                        {STATUS_LABELS[item.to_status] || item.to_status}
                      </strong>
                      <small>{formatDateTime(item.created_at)}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside>
          <section className="admin-panel lead-crm-panel">
            <h2>Controle da negociação</h2>

            <label>
              Etapa do cliente
              <select
                name="status"
                value={form.status}
                onChange={updateField}
              >
                {LEAD_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Próxima ação
              <input
                name="next_action_text"
                value={form.next_action_text}
                onChange={updateField}
                placeholder="Ex.: ligar para confirmar visita"
                disabled={form.status === 'won' || form.status === 'lost'}
              />
            </label>

            <label>
              Quando fazer
              <input
                type="datetime-local"
                name="next_action_at"
                value={form.next_action_at}
                onChange={updateField}
                disabled={form.status === 'won' || form.status === 'lost'}
              />
            </label>

            {form.status === 'lost' && (
              <label>
                Motivo da perda
                <select
                  name="lost_reason"
                  value={form.lost_reason}
                  onChange={updateField}
                >
                  <option value="">Selecione</option>
                  <option value="Preço acima do orçamento">
                    Preço acima do orçamento
                  </option>
                  <option value="Não gostou do imóvel">
                    Não gostou do imóvel
                  </option>
                  <option value="Localização">
                    Localização
                  </option>
                  <option value="Financiamento não aprovado">
                    Financiamento não aprovado
                  </option>
                  <option value="Comprou com outro corretor">
                    Comprou com outro corretor
                  </option>
                  <option value="Desistiu da compra">
                    Desistiu da compra
                  </option>
                  <option value="Sem retorno do cliente">
                    Sem retorno do cliente
                  </option>
                  <option value="Outro">Outro</option>
                </select>
              </label>
            )}

            <div className="crm-money-grid">
              <label>
                Valor do negócio
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="deal_value"
                  value={form.deal_value}
                  onChange={updateField}
                  placeholder="0,00"
                />
              </label>

              <label>
                Comissão
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="commission_value"
                  value={form.commission_value}
                  onChange={updateField}
                  placeholder="0,00"
                />
              </label>
            </div>

            <button
              type="button"
              className="button full-button"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar atendimento'}
            </button>
          </section>

          {lead.appointments?.length > 0 && (
            <section className="admin-panel">
              <h2>Visitas solicitadas</h2>

              <div className="lead-appointments-list">
                {lead.appointments.map((appointment) => (
                  <article key={appointment.id}>
                    <strong>{appointment.requested_date || 'Data a combinar'}</strong>
                    <span>{appointment.requested_time || ''}</span>
                    <small>{appointment.status}</small>
                  </article>
                ))}
              </div>
            </section>
          )}

          {lead.status === 'won' && (
            <section className="admin-panel crm-success-panel">
              <span>Negócio fechado</span>
              <strong>{formatCurrency(lead.deal_value)}</strong>
              <small>
                Comissão: {formatCurrency(lead.commission_value)}
              </small>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
