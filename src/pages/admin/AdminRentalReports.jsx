import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../services/crm';
import { RENTAL_STATUS_LABELS, RENTAL_PAYMENT_STATUS_LABELS } from '../../services/rentals';

const TYPES = [
  ['contracts', 'Contratos'],
  ['receivables', 'Recebimentos'],
  ['delinquency', 'Inadimplência'],
  ['transfers', 'Repasses aos proprietários'],
];

const pad = (v) => String(v).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); };
const firstDay = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-01'; };
const dateOnly = (v) => v ? String(v).slice(0, 10) : '';
const inPeriod = (v, start, end) => { const d = dateOnly(v); return (!start || d >= start) && (!end || d <= end); };
const moneyNumber = (v) => Number(v || 0);
const propertyLabel = (p) => p ? ((p.code || '') + ' ' + (p.title || '')).trim() : '—';

function downloadCsv(filename, columns, rows) {
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [
    columns.map((c) => esc(c.label)).join(';'),
    ...rows.map((row) => columns.map((c) => esc(row[c.key])).join(';')),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename + '.csv'; a.click(); URL.revokeObjectURL(url);
}

function printReport(title, columns, rows) {
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) return;
  const head = columns.map((c) => '<th>' + c.label + '</th>').join('');
  const body = rows.map((row) => '<tr>' + columns.map((c) => '<td>' + String(row[c.key] ?? '—') + '</td>').join('') + '</tr>').join('');
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + title + '</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#172019;font-size:10px}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8dfda;padding:6px;text-align:left}th{background:#f0f4f1}</style></head><body><h1>' + title + '</h1><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),200);<\/script></body></html>');
  popup.document.close();
}

export default function AdminRentalReports() {
  const [data, setData] = useState({ contracts: [], payments: [], transfers: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('contracts');
  const [start, setStart] = useState(firstDay());
  const [end, setEnd] = useState(today());
  const [status, setStatus] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [contracts, payments, transfers] = await Promise.all([
        supabase.from('rental_contracts').select('id,code,status,tenant_name,owner_name,start_date,end_date,monthly_rent,administration_fee_percent,property:properties(code,title,city:cities(name))').order('created_at', { ascending: false }),
        supabase.from('rental_payments').select('id,contract_id,reference_month,due_date,total_due,paid_amount,paid_at,payment_method,status,management_fee,owner_net_amount,contract:rental_contracts(code,tenant_name,owner_name,property:properties(code,title))').order('reference_month', { ascending: false }),
        supabase.from('rental_transfers').select('id,contract_id,gross_received,admin_fee,other_expenses,transfer_value,status,due_date,paid_at,contract:rental_contracts(code,owner_name,tenant_name,property:properties(code,title))').order('due_date', { ascending: false }),
      ]);
      const error = contracts.error || payments.error || transfers.error;
      if (error) setMessage(error.message || 'Não foi possível carregar os dados de locação.');
      setData({ contracts: contracts.data || [], payments: payments.data || [], transfers: transfers.data || [] });
      setLoading(false);
    })();
  }, []);

  const current = useMemo(() => {
    if (type === 'contracts') {
      const rows = data.contracts
        .filter((c) => (!c.start_date || c.start_date <= end) && (!c.end_date || c.end_date >= start) && (status === 'all' || c.status === status))
        .map((c) => ({
          code: c.code, tenant: c.tenant_name, owner: c.owner_name, property: propertyLabel(c.property),
          city: c.property?.city?.name || '—', status: RENTAL_STATUS_LABELS[c.status] || c.status,
          start: formatDate(c.start_date), end: formatDate(c.end_date), rent: formatCurrency(c.monthly_rent),
          fee: c.administration_fee_percent == null ? '—' : c.administration_fee_percent + '%',
        }));
      return {
        title: 'Relatório de contratos de locação',
        columns: [['code','Contrato'],['tenant','Inquilino'],['owner','Proprietário'],['property','Imóvel'],['city','Cidade'],['status','Situação'],['start','Início'],['end','Fim'],['rent','Aluguel'],['fee','Administração']].map(([key,label]) => ({key,label})),
        rows,
        stats: [['Contratos', rows.length], ['Ativos', rows.filter((r) => r.status === 'Ativo').length], ['Aluguel mensal', formatCurrency(data.contracts.filter((c) => (!c.start_date || c.start_date <= end) && (!c.end_date || c.end_date >= start) && c.status === 'active').reduce((s,c) => s + moneyNumber(c.monthly_rent), 0))]],
      };
    }

    if (type === 'transfers') {
      const rows = data.transfers
        .filter((t) => inPeriod(t.due_date, start, end) && (status === 'all' || t.status === status))
        .map((t) => ({
          code: t.contract?.code || '—', owner: t.contract?.owner_name || '—', tenant: t.contract?.tenant_name || '—',
          property: propertyLabel(t.contract?.property), due: formatDate(t.due_date), paid: formatDate(t.paid_at),
          status: t.status || '—', gross: formatCurrency(t.gross_received), fee: formatCurrency(t.admin_fee),
          expenses: formatCurrency(t.other_expenses), transfer: formatCurrency(t.transfer_value),
        }));
      const filtered = data.transfers.filter((t) => inPeriod(t.due_date,start,end));
      return {
        title: 'Relatório de repasses aos proprietários',
        columns: [['code','Contrato'],['owner','Proprietário'],['tenant','Inquilino'],['property','Imóvel'],['due','Vencimento'],['paid','Pago em'],['status','Situação'],['gross','Recebido'],['fee','Administração'],['expenses','Despesas'],['transfer','Repasse']].map(([key,label]) => ({key,label})),
        rows,
        stats: [['Repasses', rows.length], ['Valor bruto', formatCurrency(filtered.reduce((s,t) => s + moneyNumber(t.gross_received),0))], ['Valor repassado', formatCurrency(filtered.reduce((s,t) => s + moneyNumber(t.transfer_value),0))]],
      };
    }

    const payments = data.payments.filter((p) => inPeriod(p.due_date,start,end) && (status === 'all' || p.status === status));
    const rows = payments.map((p) => ({
      code: p.contract?.code || '—', tenant: p.contract?.tenant_name || '—', owner: p.contract?.owner_name || '—',
      property: propertyLabel(p.contract?.property), reference: formatDate(p.reference_month), due: formatDate(p.due_date),
      status: RENTAL_PAYMENT_STATUS_LABELS[p.status] || p.status, dueValue: formatCurrency(p.total_due),
      paid: formatCurrency(p.paid_amount), balance: formatCurrency(Math.max(moneyNumber(p.total_due)-moneyNumber(p.paid_amount),0)),
      paidAt: formatDate(p.paid_at), fee: formatCurrency(p.management_fee), ownerNet: formatCurrency(p.owner_net_amount),
    }));
    const finalRows = type === 'delinquency' ? rows.filter((r) => r.status === 'Atrasado' || r.status === 'Parcial') : rows;
    return {
      title: type === 'delinquency' ? 'Relatório de inadimplência de locações' : 'Relatório de recebimentos de locações',
      columns: [['code','Contrato'],['tenant','Inquilino'],['owner','Proprietário'],['property','Imóvel'],['reference','Referência'],['due','Vencimento'],['status','Situação'],['dueValue','Devido'],['paid','Recebido'],['balance','Saldo'],['paidAt','Pago em'],['fee','Administração'],['ownerNet','Líquido proprietário']].map(([key,label]) => ({key,label})),
      rows: finalRows,
      stats: type === 'delinquency'
        ? [['Títulos', finalRows.length], ['Saldo', formatCurrency(finalRows.reduce((s,r) => s + Number(String(r.balance).replace(/[^0-9,-]/g,'').replace('.','').replace(',','.') || 0),0))]]
        : [['Títulos', rows.length], ['Devido', formatCurrency(payments.reduce((s,p) => s + moneyNumber(p.total_due),0))], ['Recebido', formatCurrency(payments.reduce((s,p) => s + moneyNumber(p.paid_amount),0))]],
    };
  }, [data,type,start,end,status]);

  const statusOptions = type === 'contracts'
    ? Object.entries(RENTAL_STATUS_LABELS)
    : type === 'receivables' || type === 'delinquency'
      ? Object.entries(RENTAL_PAYMENT_STATUS_LABELS)
      : Array.from(new Set(data.transfers.map((t) => t.status).filter(Boolean))).map((v) => [v,v]);

  return <div className="admin-page">
    <div className="admin-page-header">
      <div><span className="eyebrow">Gestão financeira e operacional</span><h1>Relatórios de Locação</h1><p>Contratos, recebimentos, inadimplência e repasses em uma visão operacional.</p></div>
    </div>
    <section className="admin-panel">
      <div className="reports-filter-grid">
        <label>Relatório<select value={type} onChange={(e)=>setType(e.target.value)}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>De<input type="date" value={start} onChange={(e)=>setStart(e.target.value)}/></label>
        <label>Até<input type="date" value={end} onChange={(e)=>setEnd(e.target.value)}/></label>
        <label>Situação<select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">Todas</option>{statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <div className="reports-actions">
        <button className="button" type="button" disabled={loading || !current.rows.length} onClick={()=>downloadCsv('relatorio-locacao-' + type + '-' + start + '-' + end,current.columns,current.rows)}>Baixar CSV</button>
        <button type="button" disabled={loading || !current.rows.length} onClick={()=>printReport(current.title,current.columns,current.rows)}>Gerar PDF</button>
      </div>
    </section>
    {message && <div className="admin-panel">{message}</div>}
    {loading ? <div className="admin-panel">Carregando...</div> : <>
      <div className="reports-stats">{current.stats.map(([label,value])=><article className="admin-panel" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <section className="admin-panel reports-result-panel">
        <div className="panel-title-row"><div><span className="eyebrow">{formatDate(start)} a {formatDate(end)}</span><h2>{current.title}</h2></div><small>{current.rows.length} registro(s)</small></div>
        {current.rows.length === 0 ? <p>Nenhum registro encontrado com os filtros selecionados.</p> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr>{current.columns.map((c)=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{current.rows.map((row,i)=><tr key={i}>{current.columns.map((c)=><td key={c.key}>{row[c.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>}
      </section>
    </>}
  </div>;
}
