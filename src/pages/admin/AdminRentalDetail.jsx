import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DocumentManager from '../../components/DocumentManager';
import ResponsibleSelect from '../../components/ResponsibleSelect';
import { formatCurrency, formatDate, formatDateTime, makeWhatsAppUrl } from '../../services/crm';
import {
  RENTAL_GUARANTEE_LABELS,
  RENTAL_INSPECTION_LABELS,
  RENTAL_MAINTENANCE_STATUS_LABELS,
  RENTAL_PAYMENT_STATUS_LABELS,
  RENTAL_STATUS_LABELS,
  createRentalInspection,
  createRentalMaintenance,
  generateRentalPayments,
  getRentalTransfers,
  registerRentalPayment,
  createRentalTransferForPayment,
  registerRentalTransfer,
  getRentalChecklist,
  getRentalContract,
  getRentalHistory,
  getRentalInspections,
  getRentalMaintenance,
  getRentalPayments,
  saveRentalContract,
  updateRentalChecklistItem,
  updateRentalInspection,
  updateRentalMaintenance,
  updateRentalPayment,
} from '../../services/rentals';

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function monthLabel(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

const DOC_STATUS = {
  pending: 'Pendente',
  received: 'Recebido',
  validated: 'Validado',
  not_applicable: 'Não se aplica',
};

export default function AdminRentalDetail() {
  const { id } = useParams();
  const [contract, setContract] = useState(null);
  const [payments, setPayments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [inspectionForm, setInspectionForm] = useState({ inspection_type: 'entry', scheduled_at: '', notes: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ title: '', description: '', priority: 'normal', responsibility: 'pending', due_at: '', estimated_cost: '' });

  async function load() {
    setLoading(true);
    const [contractResult, paymentResult, transferResult, inspectionResult, maintenanceResult, checklistResult, historyResult] = await Promise.all([
      getRentalContract(id),
      getRentalPayments(id),
      getRentalTransfers(id),
      getRentalInspections(id),
      getRentalMaintenance(id),
      getRentalChecklist(id),
      getRentalHistory(id),
    ]);
    setContract(contractResult.data || null);
    setPayments(paymentResult.data || []);
    setTransfers(transferResult.data || []);
    setInspections(inspectionResult.data || []);
    setMaintenance(maintenanceResult.data || []);
    setChecklist(checklistResult.data || []);
    setHistory(historyResult.data || []);
    if (contractResult.error || paymentResult.error || transferResult.error || inspectionResult.error || maintenanceResult.error || checklistResult.error || historyResult.error) {
      setMessage('Algumas informações do contrato não puderam ser carregadas.');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  const paymentSummary = useMemo(() => {
    return payments.reduce((acc, item) => {
      acc.due += Number(item.total_due || 0);
      acc.paid += Number(item.paid_amount || 0);
      if (['pending','partial','overdue'].includes(item.status) && new Date(`${item.due_date}T23:59:59`) < new Date()) {
        acc.overdue += Math.max(Number(item.total_due || 0) - Number(item.paid_amount || 0), 0);
      }
      return acc;
    }, { due: 0, paid: 0, overdue: 0 });
  }, [payments]);

  async function changeStatus(status) {
    setBusy('status'); setMessage('');
    const result = await saveRentalContract({ status }, id);
    if (result.error) setMessage(result.error.message || 'Não foi possível alterar o status.');
    else await load();
    setBusy('');
  }

  async function generatePayments() {
    setBusy('generate'); setMessage('');
    const result = await generateRentalPayments(id);
    if (result.error) setMessage(result.error.message || 'Não foi possível gerar as cobranças.');
    else { setMessage(`${result.data || 0} competência(s) processada(s).`); await load(); }
    setBusy('');
  }

  async function registerPayment(item) {
    const value = window.prompt('Valor recebido:', String(item.total_due || ''));
    if (value === null) return;
    const method = window.prompt('Forma de pagamento (Pix, transferência, dinheiro...):', item.payment_method || 'Pix');
    setBusy(`pay-${item.id}`); setMessage('');
    const result = await registerRentalPayment(item.id, { paid_amount: Number(String(value).replace(',', '.')) || 0, payment_method: method || null });
    if (result.error) setMessage(result.error.message || 'Não foi possível registrar o pagamento.');
    else await load();
    setBusy('');
  }

  async function addInspection(event) {
    event.preventDefault();
    setBusy('inspection-new'); setMessage('');
    const result = await createRentalInspection({
      contract_id: id,
      property_id: contract.property_id,
      inspection_type: inspectionForm.inspection_type,
      scheduled_at: inspectionForm.scheduled_at ? new Date(inspectionForm.scheduled_at).toISOString() : null,
      notes: inspectionForm.notes.trim() || null,
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível criar a vistoria.');
    else { setInspectionForm({ inspection_type: 'entry', scheduled_at: '', notes: '' }); await load(); }
    setBusy('');
  }

  async function completeInspection(item) {
    setBusy(`inspection-${item.id}`);
    const result = await updateRentalInspection(item.id, { status: 'completed', completed_at: new Date().toISOString() });
    if (result.error) setMessage(result.error.message || 'Não foi possível concluir a vistoria.');
    else await load();
    setBusy('');
  }

  async function addMaintenance(event) {
    event.preventDefault();
    setBusy('maintenance-new'); setMessage('');
    const result = await createRentalMaintenance({
      contract_id: id,
      property_id: contract.property_id,
      title: maintenanceForm.title.trim(),
      description: maintenanceForm.description.trim() || null,
      priority: maintenanceForm.priority,
      responsibility: maintenanceForm.responsibility,
      due_at: maintenanceForm.due_at ? new Date(maintenanceForm.due_at).toISOString() : null,
      estimated_cost: maintenanceForm.estimated_cost === '' ? null : Number(maintenanceForm.estimated_cost),
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível abrir a manutenção.');
    else { setMaintenanceForm({ title: '', description: '', priority: 'normal', responsibility: 'pending', due_at: '', estimated_cost: '' }); await load(); }
    setBusy('');
  }

  async function completeMaintenance(item) {
    const actual = window.prompt('Custo real da manutenção (opcional):', item.actual_cost ?? item.estimated_cost ?? '');
    setBusy(`maintenance-${item.id}`);
    const result = await updateRentalMaintenance(item.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_cost: actual === null || actual === '' ? item.actual_cost : Number(String(actual).replace(',', '.')),
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível concluir a manutenção.');
    else await load();
    setBusy('');
  }

  async function checklistStatus(item, status) {
    setBusy(`doc-${item.id}`);
    const result = await updateRentalChecklistItem(item.id, { status });
    if (result.error) setMessage(result.error.message || 'Não foi possível atualizar o checklist.');
    else await load();
    setBusy('');
  }

  if (loading) return <div className="admin-loading">Carregando contrato...</div>;
  if (!contract) return <div className="admin-page"><div className="admin-message">Contrato não encontrado.</div></div>;

  const tenantWhatsApp = makeWhatsAppUrl(contract.tenant_whatsapp, contract.tenant_name);
  const ownerWhatsApp = makeWhatsAppUrl(contract.owner_whatsapp, contract.owner_name);

  return (
    <div className="admin-page rental-detail-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Contrato de locação</span>
          <h1>{contract.code} — {contract.tenant_name}</h1>
          <p>{contract.property ? `${contract.property.code} — ${contract.property.title}` : 'Imóvel não localizado'}</p>
        </div>
        <div className="admin-page-actions">
          <Link className="admin-link-button" to={`/admin/locacoes/${id}/editar`}>Editar contrato</Link>
          <Link className="admin-link-button" to="/admin/locacoes">Voltar</Link>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="rental-detail-metrics">
        <article><span>Status</span><strong>{RENTAL_STATUS_LABELS[contract.status] || contract.status}</strong></article>
        <article><span>Aluguel</span><strong>{formatCurrency(contract.monthly_rent)}</strong></article>
        <article><span>Total previsto</span><strong>{formatCurrency(paymentSummary.due)}</strong></article>
        <article><span>Total recebido</span><strong>{formatCurrency(paymentSummary.paid)}</strong></article>
        <article className={paymentSummary.overdue > 0 ? 'attention' : ''}><span>Em atraso</span><strong>{formatCurrency(paymentSummary.overdue)}</strong></article>
      </div>

      <section className="admin-panel rental-overview-grid">
        <div>
          <h2>Resumo do contrato</h2>
          <dl className="rental-summary-list">
            <div><dt>Período</dt><dd>{formatDate(contract.start_date)} → {formatDate(contract.end_date)}</dd></div>
            <div><dt>Vencimento</dt><dd>Dia {contract.due_day}</dd></div>
            <div><dt>Administração</dt><dd>{Number(contract.administration_fee_percent || 0).toLocaleString('pt-BR')}%</dd></div>
            <div><dt>Garantia</dt><dd>{RENTAL_GUARANTEE_LABELS[contract.guarantee_type] || contract.guarantee_type} {contract.guarantee_value ? `· ${formatCurrency(contract.guarantee_value)}` : ''}</dd></div>
            <div><dt>Reajuste</dt><dd>{String(contract.adjustment_index || 'none').toUpperCase()} {contract.next_adjustment_date ? `· ${formatDate(contract.next_adjustment_date)}` : ''}</dd></div>
          </dl>
        </div>
        <div>
          <h2>Andamento</h2>
          <label>Status do contrato<select value={contract.status} onChange={(e) => changeStatus(e.target.value)} disabled={busy === 'status'}>{Object.entries(RENTAL_STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <ResponsibleSelect table="rental_contracts" recordId={id} value={contract.assigned_to} onChange={() => load()} />
        </div>
      </section>

      <section className="admin-panel rental-parties-grid">
        <div><h2>Locatário</h2><p><strong>{contract.tenant_name}</strong></p><p>{contract.tenant_document || 'Documento não informado'}</p><p>{contract.tenant_whatsapp || 'WhatsApp não informado'}</p>{tenantWhatsApp && <a className="admin-link-button" href={tenantWhatsApp} target="_blank" rel="noreferrer">Falar no WhatsApp</a>}</div>
        <div><h2>Proprietário</h2><p><strong>{contract.owner_name || 'Não informado'}</strong></p><p>{contract.owner_whatsapp || 'WhatsApp não informado'}</p><p>{contract.owner_email || ''}</p>{ownerWhatsApp && <a className="admin-link-button" href={ownerWhatsApp} target="_blank" rel="noreferrer">Falar no WhatsApp</a>}</div>
      </section>

      <section className="admin-panel">
        <div className="panel-title-row"><div><span className="eyebrow">Financeiro</span><h2>Cobranças mensais</h2></div><button className="button" type="button" onClick={generatePayments} disabled={busy === 'generate'}>{busy === 'generate' ? 'Gerando...' : 'Gerar / atualizar cobranças'}</button></div>
        <p className="routine-section-help">Gera as competências entre o início e o fim do contrato. Cobranças já pagas não são alteradas.</p>
        <div className="rental-payment-table-wrap">
          <table className="rental-table"><thead><tr><th>Competência</th><th>Vencimento</th><th>Total</th><th>Recebido</th><th>Taxa</th><th>Líquido proprietário</th><th>Status</th><th></th></tr></thead><tbody>
            {payments.length === 0 ? <tr><td colSpan="8">Nenhuma cobrança gerada.</td></tr> : payments.map((item) => <tr key={item.id}>
              <td>{monthLabel(item.reference_month)}</td><td>{formatDate(item.due_date)}</td><td>{formatCurrency(item.total_due)}</td><td>{formatCurrency(item.paid_amount)}</td><td>{formatCurrency(item.management_fee)}</td><td>{formatCurrency(item.owner_net_amount)}</td><td><span className={`rental-payment-status ${item.status}`}>{RENTAL_PAYMENT_STATUS_LABELS[item.status] || item.status}</span></td><td>{item.status !== 'paid' && item.status !== 'waived' ? <button type="button" className="secondary" onClick={() => registerPayment(item)} disabled={busy === `pay-${item.id}`}>Registrar pagamento</button> : <small>{item.paid_at ? formatDateTime(item.paid_at) : ''}</small>}</td>
            </tr>)}</tbody></table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-title-row"><div><span className="eyebrow">Repasses</span><h2>Repasses aos proprietários</h2></div><span>{transfers.filter((t) => t.status === 'pending').length} pendentes</span></div>
        <p className="routine-section-help">O recebimento fica separado do financeiro da empresa. Após o pagamento integral, gere o repasse para o proprietário.</p>
        <div className="rental-simple-list">
          {payments.filter((p) => p.status === 'paid').map((payment) => {
            const existing = transfers.find((t) => t.charge?.reference_month === payment.reference_month);
            return <article key={payment.id}>
              <div><strong>{monthLabel(payment.reference_month)}</strong><span>Recebido {formatCurrency(payment.paid_amount)} · Líquido proprietário {formatCurrency(payment.owner_net_amount)}</span></div>
              {!existing ? <button type="button" className="secondary" onClick={async () => { setBusy('transfer-' + payment.id); const r = await createRentalTransferForPayment(payment.id); if (r.error) setMessage(r.error.message || 'Não foi possível gerar o repasse.'); else await load(); setBusy(''); }} disabled={busy === 'transfer-' + payment.id}>Gerar repasse</button> : existing.status === 'paid' ? <span>Repassado · {formatCurrency(existing.transfer_value)}</span> : <div><span>Repasse pendente · {formatCurrency(existing.transfer_value)}</span><button type="button" className="secondary" onClick={async () => { setBusy('settle-transfer-' + existing.id); const r = await registerRentalTransfer(existing.id); if (r.error) setMessage(r.error.message || 'Não foi possível baixar o repasse.'); else await load(); setBusy(''); }} disabled={busy === 'settle-transfer-' + existing.id}>Marcar como repassado</button></div>}
            </article>;
          })}
          {payments.filter((p) => p.status === 'paid').length === 0 && <p>Nenhum pagamento integral registrado.</p>}
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-title-row"><div><span className="eyebrow">Vistorias</span><h2>Entrada, periódica e saída</h2></div><span>{inspections.length}</span></div>
        <form className="rental-inline-form" onSubmit={addInspection}>
          <select value={inspectionForm.inspection_type} onChange={(e) => setInspectionForm((c) => ({ ...c, inspection_type: e.target.value }))}>{Object.entries(RENTAL_INSPECTION_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input type="datetime-local" value={inspectionForm.scheduled_at} onChange={(e) => setInspectionForm((c) => ({ ...c, scheduled_at: e.target.value }))} required />
          <input value={inspectionForm.notes} onChange={(e) => setInspectionForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Observação" />
          <button className="button" disabled={busy === 'inspection-new'}>Agendar vistoria</button>
        </form>
        <div className="rental-simple-list">{inspections.length === 0 ? <p>Nenhuma vistoria cadastrada.</p> : inspections.map((item) => <article key={item.id}><div><strong>{RENTAL_INSPECTION_LABELS[item.inspection_type] || item.inspection_type}</strong><span>{item.scheduled_at ? formatDateTime(item.scheduled_at) : 'Sem data'} · {item.status === 'completed' ? 'Concluída' : item.status === 'cancelled' ? 'Cancelada' : 'Agendada'}</span>{item.notes && <small>{item.notes}</small>}</div>{item.status === 'scheduled' && <button type="button" className="secondary" onClick={() => completeInspection(item)} disabled={busy === `inspection-${item.id}`}>Concluir</button>}</article>)}</div>
      </section>

      <section className="admin-panel">
        <div className="panel-title-row"><div><span className="eyebrow">Manutenção</span><h2>Chamados e responsabilidades</h2></div><span>{maintenance.filter((m) => !['completed','cancelled'].includes(m.status)).length} abertas</span></div>
        <form className="rental-maintenance-form" onSubmit={addMaintenance}>
          <input value={maintenanceForm.title} onChange={(e) => setMaintenanceForm((c) => ({ ...c, title: e.target.value }))} placeholder="Ex.: Vazamento na cozinha" required />
          <select value={maintenanceForm.priority} onChange={(e) => setMaintenanceForm((c) => ({ ...c, priority: e.target.value }))}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select>
          <select value={maintenanceForm.responsibility} onChange={(e) => setMaintenanceForm((c) => ({ ...c, responsibility: e.target.value }))}><option value="pending">Responsabilidade a definir</option><option value="owner">Proprietário</option><option value="tenant">Locatário</option><option value="agency">Imobiliária</option><option value="condominium">Condomínio</option></select>
          <input type="datetime-local" value={maintenanceForm.due_at} onChange={(e) => setMaintenanceForm((c) => ({ ...c, due_at: e.target.value }))} />
          <input type="number" step="0.01" value={maintenanceForm.estimated_cost} onChange={(e) => setMaintenanceForm((c) => ({ ...c, estimated_cost: e.target.value }))} placeholder="Custo estimado" />
          <textarea rows="2" value={maintenanceForm.description} onChange={(e) => setMaintenanceForm((c) => ({ ...c, description: e.target.value }))} placeholder="Descrição do problema" />
          <button className="button" disabled={busy === 'maintenance-new'}>Abrir manutenção</button>
        </form>
        <div className="rental-simple-list">{maintenance.length === 0 ? <p>Nenhuma manutenção cadastrada.</p> : maintenance.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{RENTAL_MAINTENANCE_STATUS_LABELS[item.status] || item.status} · Responsável: {item.responsibility}</span>{item.description && <small>{item.description}</small>}<small>{item.estimated_cost ? `Estimativa ${formatCurrency(item.estimated_cost)}` : ''}{item.actual_cost ? ` · Real ${formatCurrency(item.actual_cost)}` : ''}</small></div>{!['completed','cancelled'].includes(item.status) && <button type="button" className="secondary" onClick={() => completeMaintenance(item)} disabled={busy === `maintenance-${item.id}`}>Concluir</button>}</article>)}</div>
      </section>

      <section className="admin-panel">
        <div className="panel-title-row"><div><span className="eyebrow">Checklist</span><h2>Documentação da locação</h2></div><span>{checklist.filter((d) => d.status === 'validated').length}/{checklist.length}</span></div>
        <div className="rental-checklist">{checklist.map((item) => <article key={item.id}><div><strong>{item.label}</strong><small>{item.party}</small></div><select value={item.status} onChange={(e) => checklistStatus(item, e.target.value)} disabled={busy === `doc-${item.id}`}>{Object.entries(DOC_STATUS).map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></article>)}</div>
      </section>

      <DocumentManager contextType="rental" contextId={id} contextLabel={`${contract.code} — ${contract.tenant_name}`} />

      <section className="admin-panel">
        <div className="panel-title-row"><h2>Histórico de status</h2><span>{history.length}</span></div>
        <div className="rental-history">{history.length === 0 ? <p>Nenhuma mudança registrada.</p> : history.map((item) => <div key={item.id}><strong>{item.from_status ? `${RENTAL_STATUS_LABELS[item.from_status] || item.from_status} → ` : ''}{RENTAL_STATUS_LABELS[item.to_status] || item.to_status}</strong><span>{formatDateTime(item.created_at)}</span></div>)}</div>
      </section>
    </div>
  );
}
