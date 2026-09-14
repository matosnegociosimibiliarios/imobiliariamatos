import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate, formatDateTime, originLabel, STATUS_LABELS, PROPOSAL_STATUS_LABELS, DEAL_STATUS_LABELS, COMMISSION_STATUS_LABELS } from '../../services/crm';
import { getReportsDataset } from '../../services/reports';

const REPORT_TYPES = [
  ['leads', 'Leads'],
  ['funil', 'Funil comercial'],
  ['imoveis', 'Imóveis'],
  ['captacoes', 'Captações'],
  ['visitas', 'Visitas'],
  ['propostas', 'Propostas'],
  ['negocios', 'Negócios fechados'],
  ['comissoes', 'Comissões'],
  ['documentos', 'Documentos pendentes'],
  ['origens', 'Desempenho por origem'],
];

const APPOINTMENT_LABELS = {
  requested: 'Solicitada', confirmed: 'Confirmada', completed: 'Realizada', cancelled: 'Cancelada', no_show: 'Não compareceu',
};
const CAPTURE_LABELS = {
  new: 'Novo contato', evaluation: 'Avaliação', documents: 'Documentação', authorized: 'Autorizado', published: 'Publicado', lost: 'Perdido',
};
const PROPERTY_LABELS = {
  draft: 'Rascunho', published: 'Publicado', sold: 'Vendido', rented: 'Alugado', inactive: 'Inativo',
};
const DOC_LABELS = { pending: 'Pendente', received: 'Recebido', validated: 'Validado', not_applicable: 'Não se aplica', pending_review: 'Pendente de conferência', rejected: 'Com pendência', approved: 'Conferido' };

function pad(value) { return String(value).padStart(2, '0'); }
function firstDayOfMonth() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`; }
function todayValue() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function dateOnly(value) { return value ? String(value).slice(0, 10) : ''; }
function inPeriod(value, start, end) { const v = dateOnly(value); return !v || ((!start || v >= start) && (!end || v <= end)); }
function rowText(value) { return value === null || value === undefined || value === '' ? '—' : String(value); }
function escapeXml(value) { return rowText(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function escapeHtml(value) { return rowText(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function downloadExcel(filename, columns, rows) {
  const xmlRows = [columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.label)}</Data></Cell>`), ...rows.map((row) => columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(row[column.key])}</Data></Cell>`))]
    .map((cells) => `<Row>${cells.join('')}</Row>`).join('');
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Relatorio"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${filename}.xls`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function printPdf(title, periodText, columns, rows) {
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) { window.alert('O navegador bloqueou a janela do relatório. Permita pop-ups para gerar o PDF.'); return; }
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join('')}</tr>`).join('');
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#172019;font-size:10px}h1{font-size:20px;margin:0 0 4px}.meta{color:#5d6b61;margin-bottom:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8dfda;padding:6px;vertical-align:top;text-align:left}th{background:#f0f4f1;font-weight:700}tr:nth-child(even) td{background:#fafcfb}.footer{margin-top:12px;color:#68746c}</style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">Matos Negócios Imobiliários · ${escapeHtml(periodText)} · ${rows.length} registro(s)</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><div class="footer">Gerado pelo CRM Matos Negócios Imobiliários.</div><script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script></body></html>`);
  popup.document.close();
}

function cityOf(property) { return property?.city?.name || ''; }
function propertyLabel(property) { return property ? `${property.code || ''} ${property.title || ''}`.trim() : '—'; }
function sourceOf(lead) { return lead?.initial_source_platform || (['instagram','facebook','whatsapp','meta'].includes(lead?.source) ? lead.source : 'site') || 'site'; }

export default function AdminReports() {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [reportType, setReportType] = useState('leads');
  const [start, setStart] = useState(firstDayOfMonth());
  const [end, setEnd] = useState(todayValue());
  const [origin, setOrigin] = useState('all');
  const [city, setCity] = useState('all');
  const [propertyId, setPropertyId] = useState('all');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await getReportsDataset();
      if (result.error) setMessage(`Não foi possível carregar os relatórios: ${result.error.message}`);
      setDataset(result.data);
      setLoading(false);
    })();
  }, []);

  const maps = useMemo(() => {
    const properties = new Map((dataset?.properties || []).map((item) => [item.id, item]));
    const management = new Map((dataset?.management || []).map((item) => [item.property_id, item]));
    const leads = new Map((dataset?.leads || []).map((item) => [item.id, item]));
    const captures = new Map((dataset?.captures || []).map((item) => [item.id, item]));
    const proposals = new Map((dataset?.proposals || []).map((item) => [item.id, item]));
    const deals = new Map((dataset?.deals || []).map((item) => [item.id, item]));
    return { properties, management, leads, captures, proposals, deals };
  }, [dataset]);

  const cities = useMemo(() => Array.from(new Set((dataset?.properties || []).map(cityOf).concat((dataset?.captures || []).map((item) => item.city_name)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR')), [dataset]);

  const current = useMemo(() => {
    if (!dataset) return { title: '', columns: [], rows: [], stats: [] };
    const propertyMatches = (id) => propertyId === 'all' || id === propertyId;
    const cityMatches = (prop, fallback='') => city === 'all' || cityOf(prop) === city || fallback === city;
    const sourceMatches = (lead) => origin === 'all' || sourceOf(lead) === origin;
    const statusMatches = (value) => status === 'all' || value === status;

    if (reportType === 'leads') {
      const rows = dataset.leads.filter((lead)=>inPeriod(lead.created_at,start,end) && sourceMatches(lead) && propertyMatches(lead.property_id) && cityMatches(maps.properties.get(lead.property_id)) && statusMatches(lead.status)).map((lead)=>{
        const prop=maps.properties.get(lead.property_id); return { date:formatDateTime(lead.created_at), client:lead.name, whatsapp:lead.whatsapp, origin:originLabel(sourceOf(lead),lead.initial_source_channel), status:STATUS_LABELS[lead.status]||lead.status, property:propertyLabel(prop), city:cityOf(prop)||'—' };
      });
      return { title:'Relatório de leads', columns:[['date','Data'],['client','Cliente'],['whatsapp','WhatsApp'],['origin','Origem'],['status','Etapa'],['property','Imóvel'],['city','Cidade']].map(([key,label])=>({key,label})), rows, stats:[['Leads',rows.length]] };
    }

    if (reportType === 'visitas') {
      const filtered=dataset.appointments.filter((item)=>inPeriod(item.scheduled_at||item.requested_date||item.created_at,start,end));
      const rows=filtered.map((item)=>({item,lead:maps.leads.get(item.lead_id),prop:maps.properties.get(item.property_id)})).filter(({item,lead,prop})=>sourceMatches(lead)&&propertyMatches(item.property_id)&&cityMatches(prop)&&statusMatches(item.status)).map(({item,lead,prop})=>({date:item.scheduled_at?formatDateTime(item.scheduled_at):formatDate(item.requested_date),client:lead?.name||'—',property:propertyLabel(prop),city:cityOf(prop)||'—',status:APPOINTMENT_LABELS[item.status]||item.status,origin:originLabel(sourceOf(lead),lead?.initial_source_channel)}));
      return { title:'Relatório de visitas', columns:[['date','Data'],['client','Cliente'],['property','Imóvel'],['city','Cidade'],['status','Situação'],['origin','Origem']].map(([key,label])=>({key,label})), rows, stats:[['Visitas',rows.length],['Realizadas',rows.filter(r=>r.status==='Realizada').length]] };
    }

    if (reportType === 'captacoes') {
      const rows=dataset.captures.filter((item)=>inPeriod(item.created_at,start,end)&&propertyMatches(item.converted_property_id)&&cityMatches(maps.properties.get(item.converted_property_id),item.city_name)&&statusMatches(item.status)&& (origin==='all'||(item.source||'site')===origin)).map((item)=>({date:formatDateTime(item.created_at),owner:item.owner_name,whatsapp:item.whatsapp,city:item.city_name||'—',type:item.property_type,purpose:item.purpose==='rent'?'Locação':item.purpose==='sale_and_rent'?'Venda e locação':'Venda',status:CAPTURE_LABELS[item.status]||item.status,value:formatCurrency(item.evaluation_value||item.asking_value)}));
      return { title:'Relatório de captações', columns:[['date','Data'],['owner','Proprietário'],['whatsapp','WhatsApp'],['city','Cidade'],['type','Tipo'],['purpose','Finalidade'],['status','Etapa'],['value','Valor']].map(([key,label])=>({key,label})), rows, stats:[['Captações',rows.length],['Publicadas',rows.filter(r=>r.status==='Publicado').length]] };
    }

    if (reportType === 'propostas') {
      const rows=dataset.proposals.filter((item)=>inPeriod(item.created_at,start,end)).map((item)=>({item,lead:maps.leads.get(item.lead_id),prop:maps.properties.get(item.property_id)})).filter(({item,lead,prop})=>sourceMatches(lead)&&propertyMatches(item.property_id)&&cityMatches(prop)&&statusMatches(item.status)).map(({item,lead,prop})=>({date:formatDateTime(item.created_at),code:item.code,client:lead?.name||'—',property:propertyLabel(prop),city:cityOf(prop)||'—',status:PROPOSAL_STATUS_LABELS[item.status]||item.status,value:formatCurrency(item.proposal_value),validity:formatDate(item.valid_until),origin:originLabel(sourceOf(lead),lead?.initial_source_channel)}));
      return { title:'Relatório de propostas', columns:[['date','Data'],['code','Código'],['client','Cliente'],['property','Imóvel'],['city','Cidade'],['status','Situação'],['value','Valor'],['validity','Validade'],['origin','Origem']].map(([key,label])=>({key,label})), rows, stats:[['Propostas',rows.length],['Aceitas',rows.filter(r=>r.status==='Aceita').length]] };
    }

    if (reportType === 'negocios' || reportType === 'comissoes') {
      const base=dataset.deals.filter((item)=>inPeriod(item.completed_at||item.created_at,start,end)).map((item)=>({item,lead:maps.leads.get(item.lead_id),prop:maps.properties.get(item.property_id)})).filter(({item,lead,prop})=>sourceMatches(lead)&&propertyMatches(item.property_id)&&cityMatches(prop)&&(status==='all'|| (reportType==='comissoes'?item.commission_status:item.status)===status));
      if(reportType==='comissoes'){
        const rows=base.map(({item,lead,prop})=>({date:formatDateTime(item.completed_at||item.created_at),code:item.code,client:lead?.name||'—',property:propertyLabel(prop),sale:formatCurrency(item.sale_value),commission:formatCurrency(item.commission_value),received:formatCurrency(item.commission_received_amount),receivable:formatCurrency(Math.max(Number(item.commission_value||0)-Number(item.commission_received_amount||0),0)),status:COMMISSION_STATUS_LABELS[item.commission_status]||item.commission_status,due:formatDate(item.commission_due_date)}));
        return { title:'Relatório de comissões', columns:[['date','Data'],['code','Negócio'],['client','Cliente'],['property','Imóvel'],['sale','Venda'],['commission','Comissão'],['received','Recebida'],['receivable','A receber'],['status','Situação'],['due','Previsão']].map(([key,label])=>({key,label})), rows, stats:[['Negócios',rows.length],['Comissão total',formatCurrency(base.reduce((s,{item})=>s+Number(item.commission_value||0),0))],['Recebida',formatCurrency(base.reduce((s,{item})=>s+Number(item.commission_received_amount||0),0))]] };
      }
      const rows=base.map(({item,lead,prop})=>({date:formatDateTime(item.completed_at||item.created_at),code:item.code,client:lead?.name||'—',property:propertyLabel(prop),city:cityOf(prop)||'—',status:DEAL_STATUS_LABELS[item.status]||item.status,sale:formatCurrency(item.sale_value),commission:formatCurrency(item.commission_value),origin:originLabel(sourceOf(lead),lead?.initial_source_channel)}));
      return { title:'Relatório de negócios fechados', columns:[['date','Data'],['code','Código'],['client','Cliente'],['property','Imóvel'],['city','Cidade'],['status','Situação'],['sale','Valor vendido'],['commission','Comissão'],['origin','Origem']].map(([key,label])=>({key,label})), rows, stats:[['Negócios',rows.length],['Valor vendido',formatCurrency(base.reduce((s,{item})=>s+Number(item.sale_value||0),0))]] };
    }

    if (reportType === 'imoveis') {
      const rows=dataset.properties.filter((prop)=>inPeriod(prop.created_at,start,end)&&propertyMatches(prop.id)&&cityMatches(prop)&&statusMatches(prop.status)).map((prop)=>{const mg=maps.management.get(prop.id); const started=mg?.listing_started_at?new Date(`${mg.listing_started_at}T12:00:00`):new Date(prop.created_at); const days=Math.max(0,Math.floor((Date.now()-started.getTime())/86400000)); return {code:prop.code,title:prop.title,city:cityOf(prop)||'—',type:prop.property_type,purpose:prop.purpose==='rent'?'Locação':'Venda',status:PROPERTY_LABELS[prop.status]||prop.status,price:formatCurrency(prop.purpose==='rent'?prop.rent_price:prop.sale_price),days:`${days} dia(s)`,owner:mg?.owner_name||'—',documents:mg?.documentation_status==='complete'?'Completa':mg?.documentation_status==='partial'?'Parcial':'Pendente'};});
      return { title:'Relatório de imóveis', columns:[['code','Código'],['title','Imóvel'],['city','Cidade'],['type','Tipo'],['purpose','Finalidade'],['status','Situação'],['price','Preço'],['days','Dias em carteira'],['owner','Proprietário'],['documents','Documentação']].map(([key,label])=>({key,label})), rows, stats:[['Imóveis',rows.length],['Publicados',rows.filter(r=>r.status==='Publicado').length]] };
    }

    if (reportType === 'documentos') {
      const rows=[];
      dataset.crmDocuments.filter((doc)=>inPeriod(doc.created_at,start,end)&&doc.status!=='approved').forEach((doc)=>{const prop=maps.properties.get(doc.property_id); if(!propertyMatches(doc.property_id)||!cityMatches(prop))return; rows.push({context:doc.property_id?propertyLabel(prop):doc.lead_id?maps.leads.get(doc.lead_id)?.name||'Cliente':doc.capture_id?maps.captures.get(doc.capture_id)?.owner_name||'Captação':doc.deal_id?maps.deals.get(doc.deal_id)?.code||'Negócio':'CRM',document:doc.title,status:DOC_LABELS[doc.status]||doc.status,expiry:formatDate(doc.expires_at),type:'Arquivo'});});
      dataset.propertyDocuments.filter((doc)=>!['validated','not_applicable'].includes(doc.status)).forEach((doc)=>{const prop=maps.properties.get(doc.property_id); if(!propertyMatches(doc.property_id)||!cityMatches(prop))return; rows.push({context:propertyLabel(prop),document:doc.label,status:DOC_LABELS[doc.status]||doc.status,expiry:'—',type:'Checklist do imóvel'});});
      dataset.captureDocuments.filter((doc)=>!['received','not_applicable'].includes(doc.status)).forEach((doc)=>{const cap=maps.captures.get(doc.capture_id); if(city!=='all'&&cap?.city_name!==city)return; rows.push({context:cap?.owner_name||'Captação',document:doc.label,status:DOC_LABELS[doc.status]||doc.status,expiry:'—',type:'Checklist da captação'});});
      dataset.dealDocuments.filter((doc)=>!['validated','not_applicable'].includes(doc.status)).forEach((doc)=>{const deal=maps.deals.get(doc.deal_id); const prop=maps.properties.get(deal?.property_id); if(!propertyMatches(deal?.property_id)||!cityMatches(prop))return; rows.push({context:deal?.code||'Negócio',document:doc.label,status:DOC_LABELS[doc.status]||doc.status,expiry:'—',type:'Checklist do negócio'});});
      const filtered=status==='all'?rows:rows.filter(r=>r.status===status);
      return { title:'Relatório de documentos pendentes', columns:[['context','Vínculo'],['document','Documento'],['type','Origem'],['status','Situação'],['expiry','Validade']].map(([key,label])=>({key,label})), rows:filtered, stats:[['Pendências',filtered.length]] };
    }

    if (reportType === 'origens') {
      const leads=dataset.leads.filter((lead)=>inPeriod(lead.created_at,start,end)&&sourceMatches(lead)&&propertyMatches(lead.property_id)&&cityMatches(maps.properties.get(lead.property_id)));
      const groups=new Map();
      leads.forEach((lead)=>{const key=sourceOf(lead); if(!groups.has(key))groups.set(key,{platform:key,leads:0,visits:0,proposals:0,deals:0,sales:0,commission:0}); groups.get(key).leads+=1;});
      const includeLead=(leadId)=>leads.some(l=>l.id===leadId);
      dataset.appointments.filter(a=>includeLead(a.lead_id)&&a.status==='completed').forEach(a=>{const key=sourceOf(maps.leads.get(a.lead_id)); if(groups.has(key))groups.get(key).visits+=1;});
      dataset.proposals.filter(p=>includeLead(p.lead_id)).forEach(p=>{const key=sourceOf(maps.leads.get(p.lead_id)); if(groups.has(key))groups.get(key).proposals+=1;});
      dataset.deals.filter(d=>includeLead(d.lead_id)&&d.status!=='cancelled').forEach(d=>{const key=sourceOf(maps.leads.get(d.lead_id)); if(groups.has(key)){const g=groups.get(key); g.deals+=1; g.sales+=Number(d.sale_value||0); g.commission+=Number(d.commission_value||0);}});
      const rows=Array.from(groups.values()).map(g=>({origin:originLabel(g.platform),leads:g.leads,visits:g.visits,proposals:g.proposals,deals:g.deals,conversion:g.leads?`${((g.deals/g.leads)*100).toFixed(1)}%`:'0%',sales:formatCurrency(g.sales),commission:formatCurrency(g.commission)}));
      return { title:'Desempenho por origem', columns:[['origin','Origem'],['leads','Leads'],['visits','Visitas'],['proposals','Propostas'],['deals','Negócios'],['conversion','Conversão'],['sales','Valor vendido'],['commission','Comissão']].map(([key,label])=>({key,label})), rows, stats:[['Origens',rows.length],['Leads',leads.length]] };
    }

    // Funil comercial
    const leads=dataset.leads.filter((lead)=>inPeriod(lead.created_at,start,end)&&sourceMatches(lead)&&propertyMatches(lead.property_id)&&cityMatches(maps.properties.get(lead.property_id)));
    const leadIds=new Set(leads.map(l=>l.id));
    const visits=dataset.appointments.filter(a=>leadIds.has(a.lead_id)&&a.status==='completed').length;
    const proposals=dataset.proposals.filter(p=>leadIds.has(p.lead_id)).length;
    const deals=dataset.deals.filter(d=>leadIds.has(d.lead_id)&&d.status!=='cancelled').length;
    const rows=[
      {stage:'Leads',count:leads.length,conversion:'100%'},
      {stage:'Visitas realizadas',count:visits,conversion:leads.length?`${((visits/leads.length)*100).toFixed(1)}%`:'0%'},
      {stage:'Propostas',count:proposals,conversion:visits?`${((proposals/visits)*100).toFixed(1)}%`:'0%'},
      {stage:'Negócios',count:deals,conversion:proposals?`${((deals/proposals)*100).toFixed(1)}%`:'0%'},
    ];
    return { title:'Relatório do funil comercial', columns:[['stage','Etapa'],['count','Quantidade'],['conversion','Conversão da etapa anterior']].map(([key,label])=>({key,label})), rows, stats:[['Conversão lead → negócio',leads.length?`${((deals/leads.length)*100).toFixed(1)}%`:'0%']] };
  }, [dataset,reportType,start,end,origin,city,propertyId,status,maps]);

  const statusOptions=useMemo(()=>{
    if(reportType==='leads')return Object.entries(STATUS_LABELS);
    if(reportType==='visitas')return Object.entries(APPOINTMENT_LABELS);
    if(reportType==='captacoes')return Object.entries(CAPTURE_LABELS);
    if(reportType==='propostas')return Object.entries(PROPOSAL_STATUS_LABELS);
    if(reportType==='negocios')return Object.entries(DEAL_STATUS_LABELS);
    if(reportType==='comissoes')return Object.entries(COMMISSION_STATUS_LABELS);
    if(reportType==='imoveis')return Object.entries(PROPERTY_LABELS);
    return [];
  },[reportType]);

  useEffect(()=>setStatus('all'),[reportType]);
  const periodText=`${formatDate(start)} a ${formatDate(end)}`;
  const reportFile=`relatorio-${reportType}-${start}-${end}`;

  return <div className="admin-page reports-page">
    <div className="admin-page-header">
      <div><span className="eyebrow">Análise e prestação de contas</span><h1>Relatórios</h1><p>Filtre os dados da imobiliária e exporte para Excel ou PDF.</p></div>
    </div>

    {message&&<div className="admin-panel reports-message">{message}</div>}

    <section className="admin-panel reports-filter-panel">
      <div className="reports-filter-grid">
        <label>Relatório<select value={reportType} onChange={e=>setReportType(e.target.value)}>{REPORT_TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>De<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>Até<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <label>Origem<select value={origin} onChange={e=>setOrigin(e.target.value)}><option value="all">Todas</option><option value="site">Site</option><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="facebook">Facebook</option><option value="manual">Manual</option></select></label>
        <label>Cidade<select value={city} onChange={e=>setCity(e.target.value)}><option value="all">Todas</option>{cities.map(item=><option key={item}>{item}</option>)}</select></label>
        <label>Imóvel<select value={propertyId} onChange={e=>setPropertyId(e.target.value)}><option value="all">Todos</option>{(dataset?.properties||[]).map(item=><option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select></label>
        {statusOptions.length>0&&<label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todas</option>{statusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
      </div>
      <div className="reports-actions">
        <button className="button" type="button" disabled={loading||!current.rows.length} onClick={()=>downloadExcel(reportFile,current.columns,current.rows)}>Baixar Excel</button>
        <button type="button" disabled={loading||!current.rows.length} onClick={()=>printPdf(current.title,periodText,current.columns,current.rows)}>Gerar PDF</button>
      </div>
    </section>

    {loading?<div className="admin-panel">Carregando relatórios...</div>:<>
      <div className="reports-stats">{current.stats.map(([label,value])=><article className="admin-panel" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <section className="admin-panel reports-result-panel">
        <div className="panel-title-row"><div><span className="eyebrow">{periodText}</span><h2>{current.title}</h2></div><small>{current.rows.length} registro(s)</small></div>
        {current.rows.length===0?<p>Nenhum registro encontrado com os filtros selecionados.</p>:<div className="reports-table-wrap"><table className="reports-table"><thead><tr>{current.columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{current.rows.map((row,index)=><tr key={index}>{current.columns.map(c=><td key={c.key}>{rowText(row[c.key])}</td>)}</tr>)}</tbody></table></div>}
      </section>
    </>}
  </div>;
}
