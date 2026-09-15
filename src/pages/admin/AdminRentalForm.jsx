import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ResponsibleSelect from '../../components/ResponsibleSelect';
import {
  RENTAL_GUARANTEE_LABELS,
  RENTAL_STATUS_LABELS,
  getRentalContract,
  getRentalFormOptions,
  numberOrNull,
  saveRentalContract,
} from '../../services/rentals';

const INITIAL = {
  property_id: '', lead_id: '', status: 'analysis',
  tenant_name: '', tenant_document: '', tenant_whatsapp: '', tenant_email: '', co_tenants: '',
  owner_name: '', owner_whatsapp: '', owner_email: '',
  start_date: '', end_date: '', monthly_rent: '', due_day: '10',
  administration_fee_percent: '', placement_fee_value: '', condominium_amount: '', property_tax_amount: '', property_tax_payer: 'tenant',
  guarantee_type: 'none', guarantee_value: '', guarantee_notes: '',
  adjustment_index: 'ipca', adjustment_percent: '', next_adjustment_date: '',
  utilities_notes: '', notes: '', assigned_to: '',
};

export default function AdminRentalForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [options, setOptions] = useState({ properties: [], leads: [] });
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const opts = await getRentalFormOptions();
      setOptions(opts.data || { properties: [], leads: [] });
      if (editing) {
        const result = await getRentalContract(id);
        if (result.error || !result.data) {
          setMessage('Não foi possível carregar o contrato.');
        } else {
          const data = result.data;
          setContract(data);
          setForm(Object.fromEntries(Object.keys(INITIAL).map((key) => [key, data[key] ?? INITIAL[key]])));
        }
      }
      setLoading(false);
    })();
  }, [editing, id]);

  function field(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectLead(event) {
    const leadId = event.target.value;
    const lead = options.leads.find((item) => item.id === leadId);
    setForm((current) => ({
      ...current,
      lead_id: leadId,
      tenant_name: current.tenant_name || lead?.name || '',
      tenant_whatsapp: current.tenant_whatsapp || lead?.whatsapp || '',
      tenant_email: current.tenant_email || lead?.email || '',
    }));
  }

  function selectProperty(event) {
    const propertyId = event.target.value;
    const property = options.properties.find((item) => item.id === propertyId);
    setForm((current) => ({
      ...current,
      property_id: propertyId,
      monthly_rent: current.monthly_rent || property?.rent_price || '',
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = {
      property_id: form.property_id,
      lead_id: form.lead_id || null,
      status: form.status,
      tenant_name: form.tenant_name.trim(),
      tenant_document: form.tenant_document.trim() || null,
      tenant_whatsapp: form.tenant_whatsapp.trim() || null,
      tenant_email: form.tenant_email.trim() || null,
      co_tenants: form.co_tenants.trim() || null,
      owner_name: form.owner_name.trim() || null,
      owner_whatsapp: form.owner_whatsapp.trim() || null,
      owner_email: form.owner_email.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      monthly_rent: numberOrNull(form.monthly_rent),
      due_day: Number(form.due_day || 10),
      administration_fee_percent: numberOrNull(form.administration_fee_percent) ?? 0,
      placement_fee_value: numberOrNull(form.placement_fee_value) ?? 0,
      condominium_amount: numberOrNull(form.condominium_amount) ?? 0,
      property_tax_amount: numberOrNull(form.property_tax_amount) ?? 0,
      property_tax_payer: form.property_tax_payer,
      guarantee_type: form.guarantee_type,
      guarantee_value: numberOrNull(form.guarantee_value),
      guarantee_notes: form.guarantee_notes.trim() || null,
      adjustment_index: form.adjustment_index,
      adjustment_percent: numberOrNull(form.adjustment_percent),
      next_adjustment_date: form.next_adjustment_date || null,
      utilities_notes: form.utilities_notes.trim() || null,
      notes: form.notes.trim() || null,
      assigned_to: form.assigned_to || null,
    };
    const result = await saveRentalContract(payload, editing ? id : null);
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível salvar o contrato.');
    } else {
      navigate(`/admin/locacoes/${result.data.id}`, { replace: true });
    }
    setSaving(false);
  }

  if (loading) return <div className="admin-loading">Carregando contrato...</div>;

  return (
    <div className="admin-page rental-form-page">
      <div className="admin-page-header">
        <div><span className="eyebrow">Gestão de locações</span><h1>{editing ? `Editar ${contract?.code || 'contrato'}` : 'Novo contrato de locação'}</h1></div>
        <div className="admin-page-actions">
          {editing && <Link className="admin-link-button" to={`/admin/locacoes/${id}`}>Abrir contrato</Link>}
          <Link className="admin-link-button" to="/admin/locacoes">Voltar</Link>
        </div>
      </div>
      {message && <div className="admin-message">{message}</div>}
      <form onSubmit={submit} className="rental-form">
        <section className="admin-panel">
          <h2>Imóvel e cliente</h2>
          <div className="admin-form-grid two">
            <label>Imóvel<select name="property_id" value={form.property_id} onChange={selectProperty} required><option value="">Selecione</option>{options.properties.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}</select></label>
            <label>Cliente do CRM (opcional)<select name="lead_id" value={form.lead_id} onChange={selectLead}><option value="">Sem vínculo</option>{options.leads.map((l) => <option key={l.id} value={l.id}>{l.name || l.whatsapp || l.email || 'Cliente'}</option>)}</select></label>
            <label>Status<select name="status" value={form.status} onChange={field}>{Object.entries(RENTAL_STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {editing ? <ResponsibleSelect table="rental_contracts" recordId={id} value={form.assigned_to} onChange={(next) => setForm((c) => ({ ...c, assigned_to: next || '' }))} /> : <label>Responsável<small>Após salvar, o responsável poderá ser alterado dentro do contrato.</small></label>}
          </div>
        </section>

        <section className="admin-panel">
          <h2>Locatário</h2>
          <div className="admin-form-grid three">
            <label>Nome completo<input name="tenant_name" value={form.tenant_name} onChange={field} required /></label>
            <label>CPF/CNPJ<input name="tenant_document" value={form.tenant_document} onChange={field} /></label>
            <label>WhatsApp<input name="tenant_whatsapp" value={form.tenant_whatsapp} onChange={field} /></label>
            <label>E-mail<input type="email" name="tenant_email" value={form.tenant_email} onChange={field} /></label>
            <label className="full">Outros locatários<textarea rows="2" name="co_tenants" value={form.co_tenants} onChange={field} /></label>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Proprietário</h2>
          <div className="admin-form-grid three">
            <label>Nome<input name="owner_name" value={form.owner_name} onChange={field} /></label>
            <label>WhatsApp<input name="owner_whatsapp" value={form.owner_whatsapp} onChange={field} /></label>
            <label>E-mail<input type="email" name="owner_email" value={form.owner_email} onChange={field} /></label>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Prazo e valores</h2>
          <div className="admin-form-grid three">
            <label>Início<input type="date" name="start_date" value={form.start_date} onChange={field} /></label>
            <label>Término<input type="date" name="end_date" value={form.end_date} onChange={field} /></label>
            <label>Dia do vencimento<input type="number" min="1" max="28" name="due_day" value={form.due_day} onChange={field} /></label>
            <label>Aluguel mensal<input type="number" step="0.01" name="monthly_rent" value={form.monthly_rent} onChange={field} /></label>
            <label>Taxa de administração (%)<input type="number" step="0.01" name="administration_fee_percent" value={form.administration_fee_percent} onChange={field} /></label>
            <label>Taxa de colocação<input type="number" step="0.01" name="placement_fee_value" value={form.placement_fee_value} onChange={field} /></label>
            <label>Condomínio<input type="number" step="0.01" name="condominium_amount" value={form.condominium_amount} onChange={field} /></label>
            <label>IPTU mensal/parcelado<input type="number" step="0.01" name="property_tax_amount" value={form.property_tax_amount} onChange={field} /></label>
            <label>Quem paga o IPTU<select name="property_tax_payer" value={form.property_tax_payer} onChange={field}><option value="tenant">Locatário</option><option value="owner">Proprietário</option><option value="included">Incluso no aluguel</option></select></label>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Garantia e reajuste</h2>
          <div className="admin-form-grid three">
            <label>Garantia<select name="guarantee_type" value={form.guarantee_type} onChange={field}>{Object.entries(RENTAL_GUARANTEE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Valor da garantia<input type="number" step="0.01" name="guarantee_value" value={form.guarantee_value} onChange={field} /></label>
            <label>Índice de reajuste<select name="adjustment_index" value={form.adjustment_index} onChange={field}><option value="ipca">IPCA</option><option value="igpm">IGP-M</option><option value="fixed">Percentual fixo</option><option value="none">Sem reajuste</option><option value="other">Outro</option></select></label>
            <label>Percentual de reajuste<input type="number" step="0.01" name="adjustment_percent" value={form.adjustment_percent} onChange={field} /></label>
            <label>Próximo reajuste<input type="date" name="next_adjustment_date" value={form.next_adjustment_date} onChange={field} /></label>
            <label className="full">Observações da garantia<textarea rows="2" name="guarantee_notes" value={form.guarantee_notes} onChange={field} /></label>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Observações</h2>
          <label>Água, luz, gás e outras responsabilidades<textarea rows="3" name="utilities_notes" value={form.utilities_notes} onChange={field} /></label>
          <label>Observações internas<textarea rows="4" name="notes" value={form.notes} onChange={field} /></label>
        </section>

        <div className="form-submit-row"><button className="button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar contrato'}</button></div>
      </form>
    </div>
  );
}
