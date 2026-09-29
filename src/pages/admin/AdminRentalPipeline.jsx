import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../services/crm';
import { RENTAL_PROCESS_STAGE_LABELS, getRentalProcesses, getRentalFormOptions, saveRentalProcess } from '../../services/rentals';

const STAGES = ['interested','visit','proposal','screening','contract','occupied','renewal','vacated','lost'];

export default function AdminRentalPipeline() {
  const [processes,setProcesses]=useState([]);
  const [options,setOptions]=useState({properties:[],leads:[]});
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [creating,setCreating]=useState(false);
  const [newProcess,setNewProcess]=useState({property_id:'',lead_id:''});
  const [dragged,setDragged]=useState(null);

  async function load(){
    setLoading(true);
    const [a,b]=await Promise.all([getRentalProcesses(),getRentalFormOptions()]);
    setProcesses(a.data||[]); setOptions(b.data||{properties:[],leads:[]});
    if(a.error||b.error)setMessage('Não foi possível carregar todo o pipeline.');
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  const filtered=useMemo(()=>{
    const t=search.trim().toLowerCase();
    return processes.filter(p=>!t||[p.property?.code,p.property?.title,p.lead?.name,p.lead?.whatsapp].some(v=>String(v||'').toLowerCase().includes(t)));
  },[processes,search]);

  async function move(process,stage){
    if(!process||process.stage===stage)return;
    setMessage('');
    const payload={stage};
    if(stage==='screening'&&!process.analysis_status)payload.analysis_status='pending';
    const r=await saveRentalProcess(payload,process.id);
    if(r.error)setMessage(r.error.message||'Não foi possível mover o processo.'); else await load();
  }

  async function createProcess(e){
    e.preventDefault();
    if(!newProcess.property_id||!newProcess.lead_id){setMessage('Selecione o imóvel e o interessado.');return;}
    const property=options.properties.find(x=>x.id===newProcess.property_id);
    const r=await saveRentalProcess({
      property_id:newProcess.property_id,lead_id:newProcess.lead_id,stage:'interested',
      analysis_status:'pending',proposal_rent:property?.rent_price||null,next_action_at:new Date().toISOString()
    });
    if(r.error)setMessage(r.error.message||'Não foi possível criar o processo.');
    else{setCreating(false);setNewProcess({property_id:'',lead_id:''});await load();}
  }

  return <div className="admin-page">
    <div className="admin-page-header">
      <div><span className="eyebrow">Pré-contrato</span><h1>Pipeline de Locação</h1><p>Do interesse até a ocupação, renovação ou desocupação.</p></div>
      <button className="button" type="button" onClick={()=>setCreating(v=>!v)}>{creating?'Cancelar':'Novo processo'}</button>
    </div>
    {message&&<div className="admin-message">{message}</div>}
    {creating&&<form className="admin-panel admin-form-grid three" onSubmit={createProcess}>
      <label>Imóvel<select value={newProcess.property_id} onChange={e=>setNewProcess(v=>({...v,property_id:e.target.value}))} required><option value="">Selecione</option>{options.properties.map(p=><option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}</select></label>
      <label>Interessado<select value={newProcess.lead_id} onChange={e=>setNewProcess(v=>({...v,lead_id:e.target.value}))} required><option value="">Selecione</option>{options.leads.map(l=><option key={l.id} value={l.id}>{l.name||l.whatsapp||l.email||'Cliente'}</option>)}</select></label>
      <div style={{alignSelf:'end'}}><button className="button" type="submit">Criar processo</button></div>
    </form>}
    <section className="admin-panel" style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'end'}}>
      <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800}}>Buscar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Imóvel, interessado ou WhatsApp..." /></label>
      <Link className="admin-link-button" to="/admin/locacoes">Contratos</Link>
    </section>
    {loading?<div className="admin-panel">Carregando pipeline...</div>:<div className="rental-pipeline-board" style={{display:'grid',gridTemplateColumns:'repeat(9,minmax(245px,1fr))',gap:12,overflowX:'auto',paddingBottom:8}}>
      {STAGES.map(stage=>{
        const items=filtered.filter(p=>p.stage===stage);
        return <section key={stage} className="admin-panel" style={{minHeight:280,padding:14}} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragged)move(dragged,stage);setDragged(null);}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:12}}><strong>{RENTAL_PROCESS_STAGE_LABELS[stage]}</strong><span>{items.length}</span></div>
          <div style={{display:'grid',gap:9}}>{items.map(p=><article key={p.id} draggable onDragStart={()=>setDragged(p)} onDragEnd={()=>setDragged(null)} style={{padding:12,border:'1px solid #e1e3e6',borderRadius:10,background:'#fff',cursor:'grab'}}>
            <strong>{p.property?.code||'Imóvel'}</strong><div style={{marginTop:4,fontWeight:700}}>{p.lead?.name||'Sem interessado'}</div>
            <small style={{display:'block',marginTop:4}}>{p.property?.title||''}</small>
            {p.proposal_rent&&<small style={{display:'block',marginTop:5}}>Proposta: {formatCurrency(p.proposal_rent)}</small>}
            {p.next_action_at&&<small style={{display:'block',marginTop:5}}>Próxima ação: {formatDate(p.next_action_at)}</small>}
            <Link className="admin-link-button" style={{display:'block',marginTop:9,textAlign:'center'}} to={`/admin/locacoes/processos/${p.id}`}>Abrir processo</Link>
          </article>)}
          {!items.length&&<small>Nenhum processo nesta etapa.</small>}</div>
        </section>;
      })}
    </div>}
  </div>;
}
