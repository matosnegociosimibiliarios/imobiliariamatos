import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../services/crm';
import {
  RENTAL_PROCESS_STAGE_LABELS,
  getRentalProcesses,
  getRentalFormOptions,
  saveRentalProcess,
} from '../../services/rentals';

const STAGES = Object.keys(RENTAL_PROCESS_STAGE_LABELS);
const stageColor = (stage) => stage === 'lost' ? '#8f0008' : stage === 'occupied' ? '#24643b' : '#555b63';

export default function AdminRentalPipeline() {
  const [processes, setProcesses] = useState([]);
  const [options, setOptions] = useState({ properties: [], leads: [] });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const [processResult, optionResult] = await Promise.all([getRentalProcesses(), getRentalFormOptions()]);
    setProcesses(processResult.data || []);
    setOptions(optionResult.data || { properties: [], leads: [] });
    if (processResult.error || optionResult.error) setMessage('Não foi possível carregar todo o pipeline.');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return processes.filter((p) => !term || [
      p.property?.code, p.property?.title, p.lead?.name, p.lead?.whatsapp,
    ].some((v) => String(v || '').toLowerCase().includes(term)));
  }, [processes, search]);

  async function move(process, stage) {
    setMessage('');
    const result = await saveRentalProcess({
      stage,
      stage_entered_at: new Date().toISOString(),
      lost_reason: stage === 'lost' ? (process.lost_reason || 'Sem motivo informado') : null,
    }, process.id);
    if (result.error) setMessage(result.error.message || 'Não foi possível mover o processo.');
    else await load();
  }

  async function createProcess() {
    if (!options.properties.length) {
      setMessage('Cadastre um imóvel para locação antes de criar um processo.');
      return;
    }
    const property = options.properties[0];
    const lead = options.leads[0];
    const result = await saveRentalProcess({
      property_id: property.id,
      lead_id: lead?.id || null,
      stage: 'interested',
      analysis_status: 'pending',
      proposal_rent: property.rent_price || null,
      next_action_at: new Date().toISOString(),
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível criar o processo.');
    else await load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Pré-contrato</span>
          <h1>Pipeline de Locação</h1>
          <p>Interesse, visita, proposta, análise cadastral, contrato, ocupação, renovação e saída.</p>
        </div>
        <button className="button" type="button" onClick={createProcess}>Novo processo</button>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <section className="admin-panel" style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'end'}}>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800}}>Buscar
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Imóvel, interessado ou WhatsApp..." />
        </label>
        <Link className="admin-link-button" to="/admin/locacoes">Contratos assinados</Link>
      </section>

      {loading ? <div className="admin-panel">Carregando pipeline...</div> : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(250px,1fr))',gap:12,overflowX:'auto',paddingBottom:8}}>
          {STAGES.filter((stage) => !['available','occupied','renewal','vacated'].includes(stage) || processes.some((p)=>p.stage===stage)).map((stage) => {
            const items = filtered.filter((p)=>p.stage===stage);
            return (
              <section key={stage} className="admin-panel" style={{minHeight:260,padding:14}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',marginBottom:12}}>
                  <strong style={{color:stageColor(stage)}}>{RENTAL_PROCESS_STAGE_LABELS[stage]}</strong>
                  <span>{items.length}</span>
                </div>
                <div style={{display:'grid',gap:9}}>
                  {items.map((p)=>(
                    <article key={p.id} style={{padding:12,border:'1px solid #e1e3e6',borderRadius:10,background:'#fff'}}>
                      <strong>{p.property?.code || 'Imóvel'}</strong>
                      <div style={{marginTop:4,fontWeight:700}}>{p.lead?.name || 'Sem interessado'}</div>
                      <small style={{display:'block',color:'#737981',marginTop:4}}>{p.property?.title || ''}</small>
                      <small style={{display:'block',color:'#737981',marginTop:5}}>Próxima ação: {formatDate(p.next_action_at)}</small>
                      {p.proposal_rent && <small style={{display:'block',marginTop:5}}>Proposta: {formatCurrency(p.proposal_rent)}</small>}
                      <div style={{display:'flex',gap:5,marginTop:9}}>
                        <select style={{flex:1,padding:'7px 8px'}} value={p.stage} onChange={(e)=>move(p,e.target.value)}>
                          {STAGES.map((v)=><option key={v} value={v}>{RENTAL_PROCESS_STAGE_LABELS[v]}</option>)}
                        </select>
                      </div>
                    </article>
                  ))}
                  {!items.length && <small style={{color:'#8a928d'}}>Nenhum processo nesta etapa.</small>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
