import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getPropertyManagementDetail,
  savePropertyManagement,
  updatePropertyDocument,
} from '../../services/propertyManagement';
import DocumentManager from '../../components/DocumentManager';
import ResponsibleSelect from '../../components/ResponsibleSelect';
import {
  DEAL_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  makeWhatsAppUrl,
} from '../../services/crm';

const PROPERTY_STATUS_LABELS = {
  draft: 'Rascunho',
  published: 'Publicado',
  reserved: 'Reservado',
  sold: 'Vendido',
  rented: 'Alugado',
  inactive: 'Inativo',
};

const AUTH_LABELS = {
  pending: 'Pendente',
  authorized: 'Autorizado',
  expired: 'Vencido',
  not_required: 'Não se aplica',
};

const COMMISSION_PAYER_LABELS = {
  seller: 'Proprietário / vendedor',
  buyer: 'Comprador',
  both: 'Ambos',
  other: 'Outro',
};

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function isoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

export default function AdminPropertyManagement() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [busyDocument, setBusyDocument] = useState('');

  async function load() {
    setLoading(true);
    const result = await getPropertyManagementDetail(id);
    if (result.error || !result.data) {
      setMessage('Não foi possível carregar a gestão deste imóvel.');
      setData(null);
      setLoading(false);
      return;
    }

    setData(result.data);
    const management = result.data.management || {};
    setForm({
      owner_name: management.owner_name || '',
      owner_whatsapp: management.owner_whatsapp || '',
      owner_email: management.owner_email || '',
      listing_started_at: toDateInput(management.listing_started_at),
      authorization_status: management.authorization_status || 'pending',
      authorization_signed_at: toDateInput(management.authorization_signed_at),
      authorization_expires_at: toDateInput(management.authorization_expires_at),
      exclusivity: Boolean(management.exclusivity),
      exclusivity_until: toDateInput(management.exclusivity_until),
      commission_percent: management.commission_percent ?? '',
      commission_payer: management.commission_payer || 'seller',
      next_review_at: toDateTimeInput(management.next_review_at),
      internal_notes: management.internal_notes || '',
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function saveManagement(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const payload = {
      owner_name: form.owner_name.trim() || null,
      owner_whatsapp: form.owner_whatsapp.trim() || null,
      owner_email: form.owner_email.trim() || null,
      listing_started_at: form.listing_started_at || new Date().toISOString().slice(0, 10),
      authorization_status: form.authorization_status,
      authorization_signed_at: form.authorization_signed_at || null,
      authorization_expires_at: form.authorization_expires_at || null,
      exclusivity: Boolean(form.exclusivity),
      exclusivity_until: form.exclusivity ? (form.exclusivity_until || null) : null,
      commission_percent: numberOrNull(form.commission_percent),
      commission_payer: form.commission_payer,
      next_review_at: isoOrNull(form.next_review_at),
      internal_notes: form.internal_notes.trim() || null,
    };

    const result = await savePropertyManagement(id, payload);
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível salvar a gestão do imóvel.');
    } else {
      setMessage('Gestão do imóvel atualizada.');
      await load();
    }
    setSaving(false);
  }

  async function changeDocument(document, status) {
    setBusyDocument(document.id);
    setMessage('');
    const result = await updatePropertyDocument(document.id, id, { status });
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível atualizar o documento.');
    } else {
      await load();
    }
    setBusyDocument('');
  }

  const property = data?.property;
  const metrics = data?.metrics || {};
  const alerts = data?.alerts || [];
  const whatsappUrl = useMemo(
    () => makeWhatsAppUrl(form.owner_whatsapp, form.owner_name),
    [form.owner_whatsapp, form.owner_name]
  );

  if (loading) return <div className="admin-loading">Carregando gestão do imóvel...</div>;
  if (!data || !property) return <div className="admin-page"><div className="admin-message">{message || 'Imóvel não encontrado.'}</div></div>;

  return (
    <div className="admin-page property-management-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Gestão do imóvel</span>
          <h1>{property.code} — {property.title}</h1>
          <p>{property.public_location_text || 'Localização não informada'}</p>
        </div>
        <div className="admin-page-actions property-team-actions">
          <ResponsibleSelect
            table="properties"
            recordId={property.id}
            value={property.assigned_to}
            compact
            onChange={(next) => setData((current) => ({
              ...current,
              property: { ...current.property, assigned_to: next },
            }))}
          />
          <Link className="admin-link-button" to={`/admin/imoveis/${property.id}/editar`}>Editar anúncio</Link>
          <Link className="admin-link-button" to="/admin/imoveis">Voltar</Link>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="property-management-metrics">
        <article><span>Dias em carteira</span><strong>{metrics.days_in_portfolio || 0}</strong></article>
        <article><span>Leads</span><strong>{metrics.leads_count || 0}</strong></article>
        <article><span>Visitas</span><strong>{metrics.visits_count || 0}</strong></article>
        <article><span>Propostas</span><strong>{metrics.proposals_count || 0}</strong></article>
        <article><span>Negócios</span><strong>{metrics.deals_count || 0}</strong></article>
        <article><span>Sem interação</span><strong>{metrics.inactive_days || 0} dias</strong></article>
      </div>

      {alerts.length > 0 && (
        <section className="admin-panel property-alert-panel">
          <div><span className="eyebrow">Atenção</span><h2>{alerts.length} ponto{alerts.length === 1 ? '' : 's'} para revisar</h2></div>
          <div className="property-alert-chips">{alerts.map((alert) => <span key={alert}>{alert}</span>)}</div>
        </section>
      )}

      <form className="admin-form" onSubmit={saveManagement}>
        <section className="admin-panel">
          <div className="property-section-heading">
            <div><span className="eyebrow">Relacionamento</span><h2>Proprietário</h2></div>
            {data.management?.source_capture_id && <Link to={`/admin/captacoes/${data.management.source_capture_id}`}>Abrir captação original</Link>}
          </div>
          <div className="admin-form-grid three">
            <label>Nome do proprietário<input name="owner_name" value={form.owner_name} onChange={updateField} /></label>
            <label>WhatsApp<input name="owner_whatsapp" value={form.owner_whatsapp} onChange={updateField} /></label>
            <label>E-mail<input type="email" name="owner_email" value={form.owner_email} onChange={updateField} /></label>
          </div>
          {whatsappUrl && <a className="admin-link-button inline-action" href={whatsappUrl} target="_blank" rel="noreferrer">Falar com proprietário no WhatsApp</a>}
        </section>

        <section className="admin-panel">
          <span className="eyebrow">Condições comerciais</span>
          <h2>Autorização, exclusividade e comissão</h2>
          <div className="admin-form-grid three">
            <label>Entrada na carteira<input type="date" name="listing_started_at" value={form.listing_started_at} onChange={updateField} /></label>
            <label>Status da autorização<select name="authorization_status" value={form.authorization_status} onChange={updateField}><option value="pending">Pendente</option><option value="authorized">Autorizado</option><option value="expired">Vencido</option><option value="not_required">Não se aplica</option></select></label>
            <label>Autorização assinada em<input type="date" name="authorization_signed_at" value={form.authorization_signed_at} onChange={updateField} /></label>
            <label>Autorização válida até<input type="date" name="authorization_expires_at" value={form.authorization_expires_at} onChange={updateField} /></label>
            <label>Comissão (%)<input type="number" min="0" max="100" step="0.01" name="commission_percent" value={form.commission_percent} onChange={updateField} /></label>
            <label>Quem paga a comissão<select name="commission_payer" value={form.commission_payer} onChange={updateField}>{Object.entries(COMMISSION_PAYER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="admin-checkboxes property-exclusivity-row">
            <label><input type="checkbox" name="exclusivity" checked={form.exclusivity} onChange={updateField} /> Captação com exclusividade</label>
            {form.exclusivity && <label>Exclusividade até<input type="date" name="exclusivity_until" value={form.exclusivity_until} onChange={updateField} /></label>}
          </div>
          <div className="admin-form-grid two">
            <label>Próxima revisão do imóvel<input type="datetime-local" name="next_review_at" value={form.next_review_at} onChange={updateField} /></label>
            <label className="full">Observações internas<textarea rows="4" name="internal_notes" value={form.internal_notes} onChange={updateField} placeholder="Negociação com proprietário, ajustes de preço, pendências..." /></label>
          </div>
          <div className="admin-save-bar"><button className="button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar gestão'}</button></div>
        </section>
      </form>

      <section className="admin-panel">
        <div className="property-section-heading">
          <div><span className="eyebrow">Checklist</span><h2>Documentação do imóvel</h2></div>
          <span className={`property-document-summary ${data.management?.documentation_status || 'pending'}`}>{data.management?.documentation_status === 'complete' ? 'Completa' : data.management?.documentation_status === 'partial' ? 'Parcial' : 'Pendente'}</span>
        </div>
        <div className="property-document-list">
          {data.documents.map((document) => (
            <div className="property-document-row" key={document.id}>
              <div><strong>{document.label}</strong><small>{document.validated_at ? `Validado em ${formatDateTime(document.validated_at)}` : document.received_at ? `Recebido em ${formatDateTime(document.received_at)}` : 'Ainda sem confirmação'}</small></div>
              <select value={document.status} disabled={busyDocument === document.id} onChange={(event) => changeDocument(document, event.target.value)}>
                {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <span className="eyebrow">Desempenho</span>
        <h2>Movimentação comercial</h2>
        <div className="property-activity-grid">
          <div><h3>Leads</h3>{data.leads.length === 0 ? <p>Nenhum lead.</p> : data.leads.slice(0, 8).map((lead) => <Link key={lead.id} to={`/admin/leads/${lead.id}`}><strong>{lead.name || 'Cliente'}</strong><span>{STATUS_LABELS[lead.status] || lead.status} · {formatDateTime(lead.created_at)}</span></Link>)}</div>
          <div><h3>Visitas</h3>{data.appointments.length === 0 ? <p>Nenhuma visita.</p> : data.appointments.slice(0, 8).map((visit) => <div key={visit.id}><strong>{visit.lead?.name || 'Cliente'}</strong><span>{visit.status} · {visit.scheduled_at ? formatDateTime(visit.scheduled_at) : formatDateTime(visit.created_at)}</span></div>)}</div>
          <div><h3>Propostas</h3>{data.proposals.length === 0 ? <p>Nenhuma proposta.</p> : data.proposals.slice(0, 8).map((proposal) => <Link key={proposal.id} to={`/admin/propostas/${proposal.id}`}><strong>{proposal.code} · {formatCurrency(proposal.proposal_value)}</strong><span>{PROPOSAL_STATUS_LABELS[proposal.status] || proposal.status} · {proposal.lead?.name || 'Cliente'}</span></Link>)}</div>
          <div><h3>Negócios</h3>{data.deals.length === 0 ? <p>Nenhum negócio.</p> : data.deals.slice(0, 8).map((deal) => <Link key={deal.id} to={`/admin/negocios/${deal.id}`}><strong>{deal.code} · {formatCurrency(deal.sale_value)}</strong><span>{DEAL_STATUS_LABELS[deal.status] || deal.status} · {deal.lead?.name || 'Cliente'}</span></Link>)}</div>
        </div>
      </section>

      <div className="property-history-grid">
        <section className="admin-panel">
          <span className="eyebrow">Preço</span><h2>Histórico de valores</h2>
          <div className="property-history-list">
            {data.priceHistory.length === 0 ? <p>Sem alterações registradas.</p> : data.priceHistory.map((item) => <div key={item.id}><div><strong>{item.price_type === 'sale' ? 'Venda' : 'Aluguel'}</strong><span>{formatDateTime(item.created_at)}</span></div><p>{item.old_price == null ? 'Valor inicial' : formatCurrency(item.old_price)} → <strong>{formatCurrency(item.new_price)}</strong></p></div>)}
          </div>
        </section>
        <section className="admin-panel">
          <span className="eyebrow">Situação</span><h2>Histórico de status</h2>
          <div className="property-history-list">
            {data.statusHistory.length === 0 ? <p>Sem alterações registradas.</p> : data.statusHistory.map((item) => <div key={item.id}><div><strong>{PROPERTY_STATUS_LABELS[item.to_status] || item.to_status}</strong><span>{formatDateTime(item.created_at)}</span></div><p>{item.from_status ? `${PROPERTY_STATUS_LABELS[item.from_status] || item.from_status} → ` : 'Status inicial: '}<strong>{PROPERTY_STATUS_LABELS[item.to_status] || item.to_status}</strong></p></div>)}
          </div>
        </section>
      </div>

      <section className="admin-panel property-overview-panel">
        <span className="eyebrow">Resumo</span><h2>Situação atual do imóvel</h2>
        <div className="property-overview-grid">
          <div><span>Status</span><strong>{PROPERTY_STATUS_LABELS[property.status] || property.status}</strong></div>
          <div><span>Autorização</span><strong>{AUTH_LABELS[data.management?.authorization_status] || 'Pendente'}</strong></div>
          <div><span>Documentação</span><strong>{data.management?.documentation_status === 'complete' ? 'Completa' : data.management?.documentation_status === 'partial' ? 'Parcial' : 'Pendente'}</strong></div>
          <div><span>Última interação</span><strong>{metrics.last_activity_at ? formatDateTime(metrics.last_activity_at) : 'Sem interação'}</strong></div>
        </div>
      </section>
      <DocumentManager contextType="property" contextId={property.id} contextLabel={`${property.code} — ${property.title}`} />
    </div>
  );
}
