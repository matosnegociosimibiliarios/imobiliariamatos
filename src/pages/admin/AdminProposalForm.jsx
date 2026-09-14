import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createProposal,
  closeLeadFromProposal,
  getProposal,
  getProposalFormOptions,
  getProposalStatusHistory,
  updateProposal,
} from '../../services/admin';
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  makeWhatsAppUrl,
  toDateTimeLocal,
} from '../../services/crm';

const REJECTION_REASONS = [
  'Valor não aceito',
  'Forma de pagamento não aceita',
  'Prazo não aceito',
  'Proprietário recusou',
  'Cliente desistiu',
  'Financiamento não aprovado',
  'Comprou outro imóvel',
  'Sem retorno',
  'Outro',
];

export default function AdminProposalForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [options, setOptions] = useState({ leads: [], properties: [] });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState({
    lead_id: searchParams.get('lead') || '',
    property_id: '',
    status: 'draft',
    proposal_value: '',
    payment_terms: '',
    conditions: '',
    valid_until: '',
    next_follow_up_text: 'Retornar sobre a proposta',
    next_follow_up_at: '',
    rejection_reason: '',
  });

  async function load() {
    setLoading(true);
    const optionsResult = await getProposalFormOptions();
    setOptions(optionsResult.data || { leads: [], properties: [] });

    if (isNew) {
      const leadId = searchParams.get('lead') || '';
      const lead = (optionsResult.data?.leads || []).find((item) => item.id === leadId);
      setForm((value) => ({
        ...value,
        lead_id: leadId,
        property_id: lead?.property_id || value.property_id,
      }));
      setLoading(false);
      return;
    }

    const [proposalResult, historyResult] = await Promise.all([
      getProposal(id),
      getProposalStatusHistory(id),
    ]);

    if (proposalResult.error || !proposalResult.data) {
      setMessage('Proposta não encontrada.');
      setLoading(false);
      return;
    }

    const data = proposalResult.data;
    setCurrent(data);
    setHistory(historyResult.data || []);
    setForm({
      lead_id: data.lead_id || '',
      property_id: data.property_id || '',
      status: data.status || 'draft',
      proposal_value: data.proposal_value ?? '',
      payment_terms: data.payment_terms || '',
      conditions: data.conditions || '',
      valid_until: data.valid_until || '',
      next_follow_up_text: data.next_follow_up_text || '',
      next_follow_up_at: toDateTimeLocal(data.next_follow_up_at),
      rejection_reason: data.rejection_reason || '',
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  function field(event) {
    const { name, value } = event.target;
    setForm((currentValue) => ({ ...currentValue, [name]: value }));
  }

  const selectedLead = useMemo(
    () => options.leads.find((item) => item.id === form.lead_id) || current?.lead || null,
    [options.leads, form.lead_id, current]
  );

  const selectedProperty = useMemo(
    () => options.properties.find((item) => item.id === form.property_id) || current?.property || null,
    [options.properties, form.property_id, current]
  );

  const whatsappUrl = makeWhatsAppUrl(selectedLead?.whatsapp, selectedLead?.name);

  async function closeDeal() {
    if (!current) return;
    setClosing(true);
    setMessage('');
    const result = await closeLeadFromProposal(current);
    if (result.error) {
      setMessage(`Não foi possível fechar o negócio: ${result.error.message}`);
    } else {
      setMessage('Negócio marcado como fechado na ficha do cliente.');
      await load();
    }
    setClosing(false);
  }

  async function save(event) {
    event.preventDefault();
    if (!form.lead_id) {
      setMessage('Selecione o cliente da proposta.');
      return;
    }

    setSaving(true);
    setMessage('');

    const payload = {
      lead_id: form.lead_id,
      property_id: form.property_id || null,
      status: form.status,
      proposal_value: form.proposal_value === '' ? null : Number(form.proposal_value),
      payment_terms: form.payment_terms.trim() || null,
      conditions: form.conditions.trim() || null,
      valid_until: form.valid_until || null,
      next_follow_up_text: ['accepted', 'rejected', 'expired'].includes(form.status)
        ? null
        : form.next_follow_up_text.trim() || null,
      next_follow_up_at: ['accepted', 'rejected', 'expired'].includes(form.status)
        ? null
        : form.next_follow_up_at
          ? new Date(form.next_follow_up_at).toISOString()
          : null,
      rejection_reason: form.status === 'rejected' ? form.rejection_reason || null : null,
    };

    const result = isNew
      ? await createProposal(payload)
      : await updateProposal(id, payload);

    if (result.error) {
      setMessage(`Não foi possível salvar: ${result.error.message}`);
      setSaving(false);
      return;
    }

    if (isNew) {
      navigate(`/admin/propostas/${result.data.id}`, { replace: true });
      return;
    }

    setMessage('Proposta atualizada.');
    await load();
    setSaving(false);
  }

  if (loading) return <div className="admin-loading">Carregando proposta...</div>;

  return (
    <div className="admin-page proposal-form-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Acompanhamento comercial</span>
          <h1>{isNew ? 'Nova proposta' : current?.code || 'Proposta'}</h1>
          {!isNew && <p>{PROPOSAL_STATUS_LABELS[current?.status] || current?.status}</p>}
        </div>
        <Link className="admin-link-button" to="/admin/propostas">Voltar às propostas</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="proposal-detail-grid">
        <form className="admin-panel proposal-form" onSubmit={save}>
          <h2>Dados da proposta</h2>

          <label>
            Cliente
            <select name="lead_id" value={form.lead_id} onChange={(event) => {
              field(event);
              const lead = options.leads.find((item) => item.id === event.target.value);
              if (lead?.property_id) setForm((value) => ({ ...value, lead_id: event.target.value, property_id: lead.property_id }));
            }} disabled={!isNew}>
              <option value="">Selecione o cliente</option>
              {options.leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.name}{lead.whatsapp ? ` — ${lead.whatsapp}` : ''}</option>
              ))}
            </select>
          </label>

          <label>
            Imóvel
            <select name="property_id" value={form.property_id} onChange={field}>
              <option value="">Sem imóvel definido</option>
              {options.properties.map((property) => (
                <option key={property.id} value={property.id}>{property.code} — {property.title}</option>
              ))}
            </select>
          </label>

          <div className="proposal-form-grid">
            <label>
              Valor proposto
              <input type="number" min="0" step="0.01" name="proposal_value" value={form.proposal_value} onChange={field} placeholder="0,00" />
            </label>
            <label>
              Validade
              <input type="date" name="valid_until" value={form.valid_until} onChange={field} />
            </label>
          </div>

          <label>
            Forma de pagamento
            <textarea rows="3" name="payment_terms" value={form.payment_terms} onChange={field} placeholder="Ex.: R$ 80 mil de entrada + financiamento do saldo." />
          </label>

          <label>
            Condições e observações
            <textarea rows="4" name="conditions" value={form.conditions} onChange={field} placeholder="Ex.: proposta condicionada à aprovação do financiamento e análise da documentação." />
          </label>

          <h2>Acompanhamento</h2>

          <label>
            Situação da proposta
            <select name="status" value={form.status} onChange={field}>
              {PROPOSAL_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          {form.status === 'rejected' && (
            <label>
              Motivo da recusa
              <select name="rejection_reason" value={form.rejection_reason} onChange={field}>
                <option value="">Selecione</option>
                {REJECTION_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
          )}

          {!['accepted', 'rejected', 'expired'].includes(form.status) && (
            <div className="proposal-form-grid">
              <label>
                Próximo retorno
                <input name="next_follow_up_text" value={form.next_follow_up_text} onChange={field} placeholder="Ex.: cobrar resposta do proprietário" />
              </label>
              <label>
                Quando retornar
                <input type="datetime-local" name="next_follow_up_at" value={form.next_follow_up_at} onChange={field} />
              </label>
            </div>
          )}

          <button className="button full-button" disabled={saving}>{saving ? 'Salvando...' : isNew ? 'Criar proposta' : 'Salvar proposta'}</button>
        </form>

        <aside className="proposal-side-column">
          <section className="admin-panel">
            <h2>Resumo</h2>
            <div className="proposal-summary-box">
              <span>Cliente</span><strong>{selectedLead?.name || 'Não selecionado'}</strong>
              <span>Imóvel</span><strong>{selectedProperty ? `${selectedProperty.code} — ${selectedProperty.title}` : 'Não definido'}</strong>
              <span>Valor</span><strong>{formatCurrency(form.proposal_value)}</strong>
              <span>Situação</span><strong>{PROPOSAL_STATUS_LABELS[form.status] || form.status}</strong>
            </div>
            <div className="proposal-side-actions">
              {selectedLead?.id && <Link to={`/admin/leads/${selectedLead.id}`}>Abrir cliente</Link>}
              {selectedProperty?.slug && <a href={`/imovel/${selectedProperty.slug}`} target="_blank" rel="noreferrer">Ver imóvel</a>}
              {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          </section>

          {!isNew && form.status === 'accepted' && (
            <section className="admin-panel crm-success-panel">
              <span>Proposta aceita</span>
              <strong>{formatCurrency(form.proposal_value)}</strong>
              {selectedLead?.status === 'won' ? (
                <small>O negócio já está marcado como fechado no funil.</small>
              ) : (
                <>
                  <small>Quando a venda estiver confirmada, feche o negócio para entrar nos indicadores de vendas e comissão.</small>
                  <button type="button" className="button full-button" onClick={closeDeal} disabled={closing}>
                    {closing ? 'Fechando...' : 'Marcar negócio como fechado'}
                  </button>
                </>
              )}
            </section>
          )}

          {!isNew && (
            <section className="admin-panel">
              <h2>Histórico da proposta</h2>
              <div className="lead-history">
                {history.length === 0 ? <p>Nenhuma mudança registrada.</p> : history.map((item) => (
                  <article key={item.id}>
                    <span className="history-dot" />
                    <div>
                      <strong>{item.from_status ? `${PROPOSAL_STATUS_LABELS[item.from_status] || item.from_status} → ` : 'Criada como '}{PROPOSAL_STATUS_LABELS[item.to_status] || item.to_status}</strong>
                      <small>{formatDateTime(item.created_at)}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {!isNew && current?.sent_at && <section className="admin-panel proposal-timestamps"><h2>Datas</h2><p>Enviada: <strong>{formatDateTime(current.sent_at)}</strong></p>{current.accepted_at && <p>Aceita: <strong>{formatDateTime(current.accepted_at)}</strong></p>}{current.rejected_at && <p>Recusada: <strong>{formatDateTime(current.rejected_at)}</strong></p>}</section>}
        </aside>
      </div>
    </div>
  );
}
