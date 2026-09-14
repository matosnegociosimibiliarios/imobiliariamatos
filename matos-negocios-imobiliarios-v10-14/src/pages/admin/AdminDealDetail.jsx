import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getDeal,
  getDealStatusHistory,
  updateDeal,
  updateDealDocument,
} from '../../services/admin';
import DocumentManager from '../../components/DocumentManager';
import ResponsibleSelect from '../../components/ResponsibleSelect';
import {
  COMMISSION_STATUS_LABELS,
  DEAL_STATUSES,
  DEAL_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
  commissionReceivable,
  formatCurrency,
  formatDate,
  formatDateTime,
  makeWhatsAppUrl,
} from '../../services/crm';

const COMMISSION_PAYERS = {
  seller: 'Vendedor / proprietário',
  buyer: 'Comprador',
  both: 'Comprador e vendedor',
  other: 'Outro',
};

const FINANCING_LABELS = {
  not_applicable: 'Não se aplica',
  pending: 'Pendente',
  analysis: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Reprovado',
  contracted: 'Contratado',
};

const CONTRACT_LABELS = { pending: 'Pendente', sent: 'Enviado', signed: 'Assinado' };
const DEED_LABELS = { not_applicable: 'Não se aplica', pending: 'Pendente', scheduled: 'Agendada', signed: 'Assinada' };
const REGISTRY_LABELS = { not_applicable: 'Não se aplica', pending: 'Pendente', submitted: 'Protocolado', completed: 'Concluído' };
const PARTY_LABELS = { buyer: 'Comprador', seller: 'Vendedor', transaction: 'Negócio / imóvel' };

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

export default function AdminDealDetail() {
  const { id } = useParams();
  const [deal, setDeal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyDocument, setBusyDocument] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    status: 'documents',
    sale_value: '',
    commission_percent: '',
    commission_value: '',
    commission_payer: '',
    commission_received_amount: '',
    commission_due_date: '',
    financing_required: false,
    financing_status: 'not_applicable',
    contract_status: 'pending',
    deed_status: 'pending',
    registry_status: 'pending',
    pending_issues: '',
    notes: '',
  });

  async function load() {
    setLoading(true);
    const [dealResult, historyResult] = await Promise.all([
      getDeal(id),
      getDealStatusHistory(id),
    ]);

    if (dealResult.error || !dealResult.data) {
      setMessage('Negócio não encontrado.');
      setLoading(false);
      return;
    }

    const data = dealResult.data;
    setDeal(data);
    setHistory(historyResult.data || []);
    setForm({
      status: data.status || 'documents',
      sale_value: data.sale_value ?? '',
      commission_percent: data.commission_percent ?? '',
      commission_value: data.commission_value ?? '',
      commission_payer: data.commission_payer || '',
      commission_received_amount: data.commission_received_amount ?? 0,
      commission_due_date: data.commission_due_date || '',
      financing_required: Boolean(data.financing_required),
      financing_status: data.financing_status || 'not_applicable',
      contract_status: data.contract_status || 'pending',
      deed_status: data.deed_status || 'pending',
      registry_status: data.registry_status || 'pending',
      pending_issues: data.pending_issues || '',
      notes: data.notes || '',
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  function field(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'financing_required' && !checked ? { financing_status: 'not_applicable' } : {}),
      ...(name === 'financing_required' && checked && current.financing_status === 'not_applicable' ? { financing_status: 'pending' } : {}),
    }));
  }

  const calculatedCommission = useMemo(() => {
    const sale = Number(form.sale_value || 0);
    const percent = Number(form.commission_percent || 0);
    return sale > 0 && percent > 0 ? sale * percent / 100 : null;
  }, [form.sale_value, form.commission_percent]);

  const documentsByParty = useMemo(() => {
    const grouped = { buyer: [], seller: [], transaction: [] };
    for (const doc of deal?.documents || []) {
      if (grouped[doc.party]) grouped[doc.party].push(doc);
    }
    Object.values(grouped).forEach((items) => items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    return grouped;
  }, [deal]);

  const whatsappUrl = makeWhatsAppUrl(deal?.lead?.whatsapp, deal?.lead?.name);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const commissionValue = calculatedCommission !== null
      ? Number(calculatedCommission.toFixed(2))
      : numberOrNull(form.commission_value);

    const payload = {
      status: form.status,
      sale_value: numberOrNull(form.sale_value),
      commission_percent: numberOrNull(form.commission_percent),
      commission_value: commissionValue,
      commission_payer: form.commission_payer || null,
      commission_received_amount: numberOrNull(form.commission_received_amount) || 0,
      commission_due_date: form.commission_due_date || null,
      financing_required: Boolean(form.financing_required),
      financing_status: form.financing_required ? form.financing_status : 'not_applicable',
      contract_status: form.contract_status,
      deed_status: form.deed_status,
      registry_status: form.registry_status,
      pending_issues: form.pending_issues.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = await updateDeal(id, payload);
    if (result.error) {
      setMessage(`Não foi possível salvar: ${result.error.message}`);
    } else {
      setMessage('Fechamento atualizado.');
      await load();
    }
    setSaving(false);
  }

  async function changeDocument(document, status) {
    setBusyDocument(document.id);
    setMessage('');
    const result = await updateDealDocument(document.id, { status });
    if (result.error) {
      setMessage(`Não foi possível atualizar o documento: ${result.error.message}`);
    } else {
      const nextDocuments = (deal.documents || []).map((item) => item.id === document.id ? result.data : item);
      setDeal((current) => ({ ...current, documents: nextDocuments }));
    }
    setBusyDocument('');
  }

  async function receiveFullCommission() {
    if (!deal?.commission_value) return;
    setSaving(true);
    const result = await updateDeal(id, { commission_received_amount: deal.commission_value });
    if (result.error) setMessage(`Não foi possível registrar o recebimento: ${result.error.message}`);
    else {
      setMessage('Comissão marcada como recebida.');
      await load();
    }
    setSaving(false);
  }

  if (loading) return <div className="admin-loading">Carregando fechamento...</div>;
  if (!deal) return <div className="admin-page"><div className="admin-message">{message || 'Negócio não encontrado.'}</div></div>;

  const receivable = commissionReceivable(deal);
  const docs = deal.documents || [];
  const docsDone = docs.filter((doc) => ['validated', 'not_applicable'].includes(doc.status)).length;

  return (
    <div className="admin-page deal-detail-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Fechamento e pós-venda</span>
          <h1>{deal.code}</h1>
          <p>{deal.lead?.name || 'Cliente'} · {DEAL_STATUS_LABELS[deal.status] || deal.status}</p>
        </div>
        <div className="admin-page-actions">
          <ResponsibleSelect
            table="deals"
            recordId={deal.id}
            value={deal.assigned_to}
            compact
            onChange={(next) => setDeal((current) => ({ ...current, assigned_to: next }))}
          />
          <Link className="admin-link-button" to="/admin/negocios">Voltar aos negócios</Link>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="deal-detail-grid">
        <div className="deal-main-column">
          <form className="admin-panel deal-form" onSubmit={save}>
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">Andamento</span>
                <h2>Dados do fechamento</h2>
              </div>
              <span className={`deal-status ${form.status}`}>{DEAL_STATUS_LABELS[form.status] || form.status}</span>
            </div>

            <label>
              Etapa do fechamento
              <select name="status" value={form.status} onChange={field}>
                {DEAL_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <div className="deal-form-grid">
              <label>
                Valor final do negócio
                <input type="number" min="0" step="0.01" name="sale_value" value={form.sale_value} onChange={field} />
              </label>
              <label>
                Quem paga a comissão
                <select name="commission_payer" value={form.commission_payer} onChange={field}>
                  <option value="">Não informado</option>
                  {Object.entries(COMMISSION_PAYERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <div className="deal-form-grid deal-form-grid-3">
              <label>
                Comissão (%)
                <input type="number" min="0" max="100" step="0.01" name="commission_percent" value={form.commission_percent} onChange={field} placeholder="Ex.: 6" />
              </label>
              <label>
                Comissão total
                <input type="number" min="0" step="0.01" name="commission_value" value={calculatedCommission !== null ? calculatedCommission.toFixed(2) : form.commission_value} onChange={field} disabled={calculatedCommission !== null} />
              </label>
              <label>
                Já recebida
                <input type="number" min="0" step="0.01" name="commission_received_amount" value={form.commission_received_amount} onChange={field} />
              </label>
            </div>

            <div className="deal-form-grid">
              <label>
                Previsão de recebimento da comissão
                <input type="date" name="commission_due_date" value={form.commission_due_date} onChange={field} />
              </label>
              <div className="commission-preview">
                <span>Situação atual</span>
                <strong>{COMMISSION_STATUS_LABELS[deal.commission_status] || deal.commission_status}</strong>
                <small>A receber: {formatCurrency(receivable)}</small>
              </div>
            </div>

            <h2>Contrato, financiamento e registro</h2>

            <label className="deal-checkbox-label">
              <input type="checkbox" name="financing_required" checked={form.financing_required} onChange={field} />
              <span>Este negócio depende de financiamento</span>
            </label>

            <div className="deal-form-grid deal-form-grid-3">
              <label>
                Financiamento
                <select name="financing_status" value={form.financing_status} onChange={field} disabled={!form.financing_required}>
                  {Object.entries(FINANCING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                Contrato
                <select name="contract_status" value={form.contract_status} onChange={field}>
                  {Object.entries(CONTRACT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                Escritura
                <select name="deed_status" value={form.deed_status} onChange={field}>
                  {Object.entries(DEED_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <label>
              Registro do imóvel
              <select name="registry_status" value={form.registry_status} onChange={field}>
                {Object.entries(REGISTRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label>
              Pendências
              <textarea rows="4" name="pending_issues" value={form.pending_issues} onChange={field} placeholder="Ex.: falta matrícula atualizada, aguardar banco, assinatura do vendedor..." />
            </label>

            <label>
              Observações internas
              <textarea rows="4" name="notes" value={form.notes} onChange={field} placeholder="Informações importantes sobre o fechamento." />
            </label>

            {form.status === 'completed' && (
              <div className="deal-warning">Ao salvar como concluído, o imóvel será marcado como vendido ou alugado e sairá da listagem pública.</div>
            )}

            <button className="button full-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar fechamento'}</button>
          </form>

          <section className="admin-panel">
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">Checklist</span>
                <h2>Documentação</h2>
              </div>
              <strong>{docsDone}/{docs.length}</strong>
            </div>
            <p className="deal-help">Use o checklist como controle interno. A necessidade de cada documento pode variar conforme o negócio e o cartório.</p>

            <div className="deal-document-groups">
              {Object.entries(documentsByParty).map(([party, items]) => (
                <div className="deal-document-group" key={party}>
                  <h3>{PARTY_LABELS[party]}</h3>
                  {items.map((document) => (
                    <div className="deal-document-row" key={document.id}>
                      <span>{document.label}</span>
                      <select
                        value={document.status}
                        onChange={(event) => changeDocument(document, event.target.value)}
                        disabled={busyDocument === document.id}
                      >
                        {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="deal-side-column">
          <section className="admin-panel deal-summary-card">
            <h2>Resumo</h2>
            <span>Cliente</span><strong>{deal.lead?.name || '—'}</strong>
            <span>Imóvel</span><strong>{deal.property ? `${deal.property.code} — ${deal.property.title}` : '—'}</strong>
            <span>Proposta</span><strong>{deal.proposal?.code || '—'}</strong>
            <span>Valor</span><strong>{formatCurrency(deal.sale_value)}</strong>
            <span>Comissão</span><strong>{formatCurrency(deal.commission_value)}</strong>
            <span>Recebida</span><strong>{formatCurrency(deal.commission_received_amount)}</strong>
            <span>A receber</span><strong>{formatCurrency(receivable)}</strong>

            <div className="proposal-side-actions">
              {deal.lead?.id && <Link to={`/admin/leads/${deal.lead.id}`}>Abrir cliente</Link>}
              {deal.proposal?.id && <Link to={`/admin/propostas/${deal.proposal.id}`}>Abrir proposta</Link>}
              {deal.property?.slug && <a href={`/imovel/${deal.property.slug}`} target="_blank" rel="noreferrer">Ver imóvel</a>}
              {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          </section>

          {deal.commission_status !== 'received' && Number(deal.commission_value || 0) > 0 && (
            <section className="admin-panel commission-card">
              <span className="eyebrow">Financeiro</span>
              <h2>Comissão a receber</h2>
              <strong>{formatCurrency(receivable)}</strong>
              {deal.commission_due_date && <p>Previsão: {formatDate(deal.commission_due_date)}</p>}
              <button type="button" className="button full-button" onClick={receiveFullCommission} disabled={saving}>Marcar comissão como recebida</button>
            </section>
          )}

          {deal.commission_status === 'received' && (
            <section className="admin-panel crm-success-panel">
              <span>Comissão recebida</span>
              <strong>{formatCurrency(deal.commission_value)}</strong>
              <small>{deal.commission_received_at ? formatDateTime(deal.commission_received_at) : 'Recebimento registrado'}</small>
            </section>
          )}

          <section className="admin-panel">
            <h2>Histórico do fechamento</h2>
            <div className="lead-history">
              {history.length === 0 ? <p>Nenhuma mudança registrada.</p> : history.map((item) => (
                <article key={item.id}>
                  <span className="history-dot" />
                  <div>
                    <strong>{item.from_status ? `${DEAL_STATUS_LABELS[item.from_status] || item.from_status} → ` : 'Criado em '}{DEAL_STATUS_LABELS[item.to_status] || item.to_status}</strong>
                    <small>{formatDateTime(item.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-panel proposal-timestamps">
            <h2>Datas</h2>
            <p>Criado: <strong>{formatDateTime(deal.created_at)}</strong></p>
            {deal.completed_at && <p>Concluído: <strong>{formatDateTime(deal.completed_at)}</strong></p>}
            {deal.cancelled_at && <p>Cancelado: <strong>{formatDateTime(deal.cancelled_at)}</strong></p>}
          </section>
        </aside>
      </div>
      <DocumentManager contextType="deal" contextId={deal.id} contextLabel={`${deal.code} — ${deal.lead?.name || 'Cliente'}`} />
    </div>
  );
}
