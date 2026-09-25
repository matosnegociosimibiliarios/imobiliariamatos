import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../services/crm';
import {
  RENTAL_PAYMENT_STATUS_LABELS,
  RENTAL_STATUS_LABELS,
  applyRentalAdjustment,
  getRentalAdjustments,
  getRentalContracts,
  getRentalGuarantee,
  recordRentalCollectionAction,
  registerRentalPayment,
  registerRentalTransfer,
  saveRentalGuarantee,
  setRentalContractLifecycle,
  updateRentalTransferExpenses,
} from '../../services/rentals';

const TABS = [
  ['collection','Cobranças'],
  ['transfers','Repasses'],
  ['adjustments','Reajustes'],
  ['guarantees','Garantias'],
  ['lifecycle','Ciclo do contrato'],
];

const panel = { background:'#fff', border:'1px solid #d8dbe0', borderRadius:12, padding:18 };
const inputStyle = { width:'100%', padding:'9px 10px', border:'1px solid #d8dbe0', borderRadius:8, background:'#fff' };

export default function AdminRentalOperations() {
  const [tab,setTab]=useState('collection');
  const [contracts,setContracts]=useState([]);
  const [payments,setPayments]=useState([]);
  const [charges,setCharges]=useState([]);
  const [transfers,setTransfers]=useState([]);
  const [guarantees,setGuarantees]=useState({});
  const [adjustments,setAdjustments]=useState({});
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState('');
  const [search,setSearch]=useState('');

  async function load() {
    setLoading(true);
    const [c,p,ch,t] = await Promise.all([
      getRentalContracts(),
      supabase.from('rental_payments').select('*, contract:rental_contracts(id,code,tenant_name,owner_name,property_id)').order('due_date'),
      supabase.from('rental_charges').select('*').order('due_date'),
      supabase.from('rental_transfers').select('*, contract:rental_contracts(id,code,tenant_name,owner_name)').order('due_date'),
    ]);
    setContracts(c.data || []);
    setPayments(p.data || []);
    setCharges(ch.data || []);
    setTransfers(t.data || []);
    setLoading(false);
    if (c.error || p.error || ch.error || t.error) setMessage('Alguns dados da operação não puderam ser carregados.');
  }

  useEffect(()=>{ load(); },[]);

  const contractMap = useMemo(()=>new Map(contracts.map(c=>[c.id,c])),[contracts]);
  const visibleContracts = useMemo(()=>{
    const term=search.trim().toLowerCase();
    return contracts.filter(c=>!term || [c.code,c.tenant_name,c.owner_name,c.property?.code,c.property?.title].some(v=>String(v||'').toLowerCase().includes(term)));
  },[contracts,search]);

  async function payment(item) {
    const value=window.prompt('Valor recebido:',String(Math.max(Number(item.total_due||0)-Number(item.paid_amount||0),0)));
    if(value===null)return;
    setBusy('pay'+item.id); setMessage('');
    const r=await registerRentalPayment(item.id,{paid_amount:Number(String(value).replace(',','.'))||0});
    if(r.error)setMessage(r.error.message||'Não foi possível registrar o recebimento.'); else await load();
    setBusy('');
  }

  async function collection(item) {
    const charge=charges.find(c=>c.contract_id===item.contract_id && c.reference_month===item.reference_month);
    if(!charge){setMessage('A cobrança operacional correspondente ainda não foi sincronizada. Registre o recebimento primeiro.');return;}
    const notes=window.prompt('Observação da cobrança:','Contato realizado com o locatário.');
    if(notes===null)return;
    setBusy('col'+item.id);
    const r=await recordRentalCollectionAction(charge.id,{channel:'whatsapp',notes});
    if(r.error)setMessage(r.error.message||'Não foi possível registrar a cobrança.'); else setMessage('Ação de cobrança registrada.');
    setBusy('');
  }

  async function transferExpenses(t) {
    const value=window.prompt('Outras despesas do repasse:',String(t.other_expenses||0));
    if(value===null)return;
    setBusy('exp'+t.id);
    const r=await updateRentalTransferExpenses(t.id,Number(String(value).replace(',','.'))||0);
    if(r.error)setMessage(r.error.message||'Não foi possível atualizar as despesas.'); else await load();
    setBusy('');
  }

  async function settleTransfer(t) {
    setBusy('tr'+t.id);
    const r=await registerRentalTransfer(t.id);
    if(r.error)setMessage(r.error.message||'Não foi possível baixar o repasse.'); else await load();
    setBusy('');
  }

  async function adjustment(c) {
    const pct=window.prompt('Percentual do reajuste:',String(c.adjustment_percent ?? '0'));
    if(pct===null)return;
    const date=window.prompt('Data de vigência (AAAA-MM-DD):',c.next_adjustment_date || new Date().toISOString().slice(0,10));
    if(!date)return;
    const r=await applyRentalAdjustment(c.id,{index_name:c.adjustment_index || 'manual',index_percent:Number(String(pct).replace(',','.'))||0,effective_date:date,notes:'Reajuste aplicado pelo módulo de locação.'});
    if(r.error)setMessage(r.error.message||'Não foi possível aplicar o reajuste.'); else await load();
  }

  async function guarantee(c) {
    const type=window.prompt('Tipo (deposit, guarantor, insurance, capitalization, none, other):',c.guarantee_type || 'none');
    if(type===null)return;
    const value=window.prompt('Valor da caução/garantia:',String(c.guarantee_value || ''));
    if(value===null)return;
    const existing=guarantees[c.id];
    setBusy('g'+c.id);
    const r=await saveRentalGuarantee(c.id,{
      guarantee_type:type,
      deposit_value:type==='deposit' ? (Number(String(value).replace(',','.'))||null) : null,
      guarantor_name:existing?.guarantor_name || null,
      insurer_name:existing?.insurer_name || null,
      policy_number:existing?.policy_number || null,
      notes:existing?.notes || null,
    },existing?.id || null);
    if(r.error)setMessage(r.error.message||'Não foi possível salvar a garantia.'); else await loadGuarantee(c.id);
    setBusy('');
  }

  async function loadGuarantee(id) {
    const r=await getRentalGuarantee(id);
    if(!r.error)setGuarantees((v)=>({...v,[id]:r.data}));
  }

  async function lifecycle(c,action) {
    setBusy('life'+c.id+action);
    const r=await setRentalContractLifecycle(c.id,action);
    if(r.error)setMessage(r.error.message||'Não foi possível alterar o ciclo.'); else await load();
    setBusy('');
  }

  useEffect(()=>{
    if(tab==='guarantees') visibleContracts.forEach(c=>loadGuarantee(c.id));
    if(tab==='adjustments') visibleContracts.filter(c=>['active','ending'].includes(c.status)).forEach(async c=>{
      const r=await getRentalAdjustments(c.id);
      if(!r.error)setAdjustments(v=>({...v,[c.id]:r.data||[]}));
    });
  },[tab,search,visibleContracts.length]);

  const overdue=payments.filter(p=>['overdue','partial'].includes(p.status) || (p.status==='pending' && p.due_date<new Date().toISOString().slice(0,10)));
  const pendingTransfers=transfers.filter(t=>t.status!=='paid' && t.status!=='cancelled');

  return <div className="admin-page">
    <div className="admin-page-header">
      <div><span className="eyebrow">Operação de locação</span><h1>Central de Operações</h1><p>Cobrança, repasse, reajuste, garantia e ciclo contratual.</p></div>
      <Link className="admin-link-button" to="/admin/locacoes">Voltar para locações</Link>
    </div>
    {message && <div className="admin-message">{message}</div>}
    <section className="admin-panel" style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'end'}}>
      <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800}}>Buscar contrato
        <input style={inputStyle} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Contrato, locatário ou proprietário..." />
      </label>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {TABS.map(([v,l])=><button key={v} type="button" className={tab===v?'button':'secondary'} onClick={()=>setTab(v)}>{l}</button>)}
      </div>
    </section>
    {loading ? <div className="admin-panel">Carregando...</div> : <>
      {tab==='collection' && <section style={panel}>
        <div className="panel-title-row"><div><span className="eyebrow">Inadimplência</span><h2>Cobranças que exigem ação</h2></div><span>{overdue.length}</span></div>
        <div style={{display:'grid',gap:8}}>
          {overdue.map(p=><article key={p.id} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr auto auto',gap:12,alignItems:'center',padding:'12px 0',borderTop:'1px solid #ececee'}}>
            <div><strong>{p.contract?.code || 'Contrato'}</strong><small style={{display:'block',color:'#737981'}}>{p.contract?.tenant_name || 'Locatário'}</small></div>
            <span>{formatDate(p.due_date)}</span><span>{RENTAL_PAYMENT_STATUS_LABELS[p.status]||p.status} · {formatCurrency(Math.max(Number(p.total_due||0)-Number(p.paid_amount||0),0))}</span>
            <button className="secondary" onClick={()=>collection(p)} disabled={busy==='col'+p.id}>Registrar cobrança</button>
            <button className="secondary" onClick={()=>payment(p)} disabled={busy==='pay'+p.id}>Registrar recebimento</button>
          </article>)}
          {!overdue.length && <p>Nenhuma cobrança vencida ou parcial.</p>}
        </div>
      </section>}

      {tab==='transfers' && <section style={panel}>
        <div className="panel-title-row"><div><span className="eyebrow">Valores de terceiros</span><h2>Repasses pendentes</h2></div><span>{pendingTransfers.length}</span></div>
        <div style={{display:'grid',gap:8}}>
          {pendingTransfers.map(t=><article key={t.id} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr auto',gap:12,alignItems:'center',padding:'12px 0',borderTop:'1px solid #ececee'}}>
            <div><strong>{t.contract?.code}</strong><small style={{display:'block',color:'#737981'}}>{t.contract?.owner_name || 'Proprietário'}</small></div>
            <span>Bruto {formatCurrency(t.gross_received)}</span><span>Despesas {formatCurrency(t.other_expenses)}</span><span>Repasse {formatCurrency(t.transfer_value)}</span>
            <div style={{display:'flex',gap:6}}><button className="secondary" onClick={()=>transferExpenses(t)}>Despesas</button><button className="secondary" onClick={()=>settleTransfer(t)} disabled={busy==='tr'+t.id}>Baixar</button></div>
          </article>)}
          {!pendingTransfers.length && <p>Nenhum repasse pendente.</p>}
        </div>
      </section>}

      {tab==='adjustments' && <section style={panel}>
        <div className="panel-title-row"><div><span className="eyebrow">Reajuste contratual</span><h2>Aluguéis ativos</h2></div></div>
        <div style={{display:'grid',gap:10}}>
          {visibleContracts.filter(c=>['active','ending'].includes(c.status)).map(c=><article key={c.id} style={{display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr auto',gap:12,alignItems:'center',padding:'12px 0',borderTop:'1px solid #ececee'}}>
            <div><strong>{c.code}</strong><small style={{display:'block',color:'#737981'}}>{c.tenant_name}</small></div>
            <span>Atual {formatCurrency(c.monthly_rent)}</span><span>Próximo {formatDate(c.next_adjustment_date)} · {c.adjustment_index?.toUpperCase()}</span><button className="secondary" onClick={()=>adjustment(c)}>Aplicar reajuste</button>
            {adjustments[c.id]?.length>0 && <small style={{gridColumn:'1/-1',color:'#737981'}}>Último: {formatDate(adjustments[c.id][0].effective_date)} · {Number(adjustments[c.id][0].index_percent).toLocaleString('pt-BR')}% · {formatCurrency(adjustments[c.id][0].new_rent)}</small>}
          </article>)}
        </div>
      </section>}

      {tab==='guarantees' && <section style={panel}>
        <div className="panel-title-row"><div><span className="eyebrow">Garantia</span><h2>Controle de garantias</h2></div></div>
        <div style={{display:'grid',gap:10}}>
          {visibleContracts.map(c=>{const g=guarantees[c.id]; return <article key={c.id} style={{display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr auto',gap:12,alignItems:'center',padding:'12px 0',borderTop:'1px solid #ececee'}}>
            <div><strong>{c.code}</strong><small style={{display:'block',color:'#737981'}}>{c.tenant_name}</small></div>
            <span>{c.guarantee_type || 'none'}</span><span>{formatCurrency(g?.deposit_value || c.guarantee_value || 0)} · {g?.deposit_refund_status || 'n/a'}</span><button className="secondary" onClick={()=>guarantee(c)} disabled={busy==='g'+c.id}>Editar garantia</button>
          </article>})}
        </div>
      </section>}

      {tab==='lifecycle' && <section style={panel}>
        <div className="panel-title-row"><div><span className="eyebrow">Contrato</span><h2>Ciclo operacional</h2></div></div>
        <div style={{display:'grid',gap:10}}>
          {visibleContracts.map(c=><article key={c.id} style={{display:'grid',gridTemplateColumns:'1.3fr 1fr auto',gap:12,alignItems:'center',padding:'12px 0',borderTop:'1px solid #ececee'}}>
            <div><strong>{c.code}</strong><small style={{display:'block',color:'#737981'}}>{c.tenant_name} · {c.property?.title || ''}</small></div>
            <span>{RENTAL_STATUS_LABELS[c.status]||c.status}</span>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'flex-end'}}>
              {c.status==='awaiting_signature' && <button className="secondary" onClick={()=>lifecycle(c,'mark_signed')}>Assinado</button>}
              {['active','ending'].includes(c.status) && !c.move_in_at && <button className="secondary" onClick={()=>lifecycle(c,'move_in')}>Entrada</button>}
              {c.status==='active' && <button className="secondary" onClick={()=>lifecycle(c,'mark_ending')}>Em encerramento</button>}
              {['active','ending'].includes(c.status) && <button className="secondary" onClick={()=>lifecycle(c,'move_out')}>Saída</button>}
              {c.status==='ended' && <button className="secondary" onClick={()=>lifecycle(c,'reactivate')}>Reativar</button>}
              {!['ended','cancelled'].includes(c.status) && <button className="secondary" onClick={()=>lifecycle(c,'cancel')}>Cancelar</button>}
              <Link className="admin-link-button" to={`/admin/locacoes/${c.id}`}>Abrir</Link>
            </div>
          </article>)}
        </div>
      </section>}
    </>}
  </div>;
}
