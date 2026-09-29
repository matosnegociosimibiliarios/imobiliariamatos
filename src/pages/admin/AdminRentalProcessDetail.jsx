import React,{useEffect,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {formatCurrency,formatDateTime} from '../../services/crm';
import {RENTAL_PROCESS_STAGE_LABELS,convertRentalProcessToContract,getRentalProcess,getRentalProcessHistory,saveRentalProcess} from '../../services/rentals';

const ANALYSIS={pending:'Pendente',approved:'Aprovada',rejected:'Reprovada'};
const PROPOSAL={pending:'Pendente',accepted:'Aceita',rejected:'Recusada'};

export default function AdminRentalProcessDetail(){
  const {id}=useParams(); const navigate=useNavigate();
  const [process,setProcess]=useState(null); const [history,setHistory]=useState([]);
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');

  async function load(){
    setLoading(true);
    const [a,b]=await Promise.all([getRentalProcess(id),getRentalProcessHistory(id)]);
    setProcess(a.data||null);setHistory(b.data||[]);
    if(a.error||b.error)setMessage('Algumas informações não puderam ser carregadas.');
    setLoading(false);
  }
  useEffect(()=>{load();},[id]);

  async function patch(payload,success='Alteração salva.'){
    setBusy(true);setMessage('');
    const r=await saveRentalProcess(payload,id);
    if(r.error)setMessage(r.error.message||'Não foi possível salvar.');else{setMessage(success);await load();}
    setBusy(false);
  }

  async function scheduleVisit(){
    const value=window.prompt('Data e hora da visita (AAAA-MM-DD HH:MM):',process.visit_at?String(process.visit_at).slice(0,16).replace('T',' '):'');
    if(!value)return;
    const d=new Date(value.replace(' ','T'));
    if(Number.isNaN(d.getTime())){setMessage('Data da visita inválida.');return;}
    await patch({visit_at:d.toISOString(),next_action_at:d.toISOString(),stage:'visit'},'Visita agendada.');
  }

  async function saveProposal(){
    const value=window.prompt('Valor proposto para o aluguel:',String(process.proposal_rent||process.property?.rent_price||''));
    if(value===null)return;
    const notes=window.prompt('Observação da proposta:',process.proposal_notes||'');
    await patch({proposal_rent:Number(String(value).replace(',','.'))||null,proposal_notes:notes||null,proposal_status:'pending',stage:'proposal'},'Proposta registrada.');
  }

  async function decideProposal(status){
    await patch({proposal_status:status,stage:status==='accepted'?'screening':status==='rejected'?'lost':'proposal',lost_reason:status==='rejected'?'Proposta recusada':null},status==='accepted'?'Proposta aceita. Processo enviado para análise.':'Proposta recusada.');
  }

  async function decideAnalysis(status){
    const notes=window.prompt('Observação da análise cadastral:',process.analysis_notes||'');
    await patch({analysis_status:status,analysis_notes:notes||null,analysis_decided_at:new Date().toISOString(),stage:status==='approved'?'contract':status==='rejected'?'lost':'screening',lost_reason:status==='rejected'?'Análise cadastral reprovada':null},status==='approved'?'Análise aprovada. Processo pronto para contrato.':'Análise reprovada.');
  }

  async function createContract(){
    setBusy(true);setMessage('');
    const r=await convertRentalProcessToContract(process);
    setBusy(false);
    if(r.error){setMessage(r.error.message||'Não foi possível criar o contrato.');return;}
    navigate(`/admin/locacoes/${r.data.id}/editar`);
  }

  if(loading)return <div className="admin-loading">Carregando processo...</div>;
  if(!process)return <div className="admin-page"><div className="admin-message">Processo não encontrado.</div></div>;

  return <div className="admin-page">
    <div className="admin-page-header"><div><span className="eyebrow">Processo de locação</span><h1>{process.lead?.name||'Interessado'}</h1><p>{process.property?.code} — {process.property?.title}</p></div><Link className="admin-link-button" to="/admin/locacoes/pipeline">Voltar ao pipeline</Link></div>
    {message&&<div className="admin-message">{message}</div>}
    <div className="rental-detail-metrics">
      <article><span>Etapa</span><strong>{RENTAL_PROCESS_STAGE_LABELS[process.stage]||process.stage}</strong></article>
      <article><span>Aluguel anunciado</span><strong>{formatCurrency(process.property?.rent_price)}</strong></article>
      <article><span>Proposta</span><strong>{formatCurrency(process.proposal_rent)}</strong></article>
      <article><span>Análise</span><strong>{ANALYSIS[process.analysis_status]||'Pendente'}</strong></article>
    </div>

    <section className="admin-panel rental-parties-grid">
      <div><h2>Interessado</h2><p><strong>{process.lead?.name||'—'}</strong></p><p>{process.lead?.whatsapp||'WhatsApp não informado'}</p><p>{process.lead?.email||'E-mail não informado'}</p>{process.lead?.message&&<small>{process.lead.message}</small>}</div>
      <div><h2>Imóvel</h2><p><strong>{process.property?.code} — {process.property?.title}</strong></p><p>{process.property?.public_location_text||''}</p><p>{formatCurrency(process.property?.rent_price)}</p></div>
    </section>

    <section className="admin-panel"><div className="panel-title-row"><div><span className="eyebrow">1. Visita</span><h2>Agendamento</h2></div><button className="button" disabled={busy} onClick={scheduleVisit}>{process.visit_at?'Reagendar':'Agendar visita'}</button></div><p>{process.visit_at?`Visita: ${formatDateTime(process.visit_at)}`:'Nenhuma visita agendada.'}</p></section>

    <section className="admin-panel"><div className="panel-title-row"><div><span className="eyebrow">2. Proposta</span><h2>Negociação do aluguel</h2></div><button className="button" disabled={busy} onClick={saveProposal}>Registrar proposta</button></div>
      <p>Valor: <strong>{formatCurrency(process.proposal_rent)}</strong> · Situação: <strong>{PROPOSAL[process.proposal_status]||'Não registrada'}</strong></p>{process.proposal_notes&&<p>{process.proposal_notes}</p>}
      {process.proposal_status==='pending'&&<div className="admin-page-actions"><button className="button" disabled={busy} onClick={()=>decideProposal('accepted')}>Aceitar proposta</button><button className="secondary" disabled={busy} onClick={()=>decideProposal('rejected')}>Recusar</button></div>}
    </section>

    <section className="admin-panel"><div className="panel-title-row"><div><span className="eyebrow">3. Análise cadastral</span><h2>Documentos e aprovação</h2></div><span>{ANALYSIS[process.analysis_status]||'Pendente'}</span></div>
      <div className="admin-form-grid three">
        <label>Renda declarada<input type="number" step="0.01" defaultValue={process.declared_income||''} onBlur={e=>patch({declared_income:e.target.value?Number(e.target.value):null},'Renda atualizada.')} /></label>
        <label><input type="checkbox" defaultChecked={Boolean(process.documents_presented)} onChange={e=>patch({documents_presented:e.target.checked},'Checklist atualizado.')} /> Documentos apresentados</label>
        <label><input type="checkbox" defaultChecked={Boolean(process.income_proof_presented)} onChange={e=>patch({income_proof_presented:e.target.checked},'Checklist atualizado.')} /> Comprovante de renda</label>
      </div>
      <div className="admin-page-actions" style={{marginTop:12}}><button className="button" disabled={busy} onClick={()=>decideAnalysis('approved')}>Aprovar análise</button><button className="secondary" disabled={busy} onClick={()=>decideAnalysis('rejected')}>Reprovar</button></div>
      {process.analysis_notes&&<p>{process.analysis_notes}</p>}
    </section>

    <section className="admin-panel"><div className="panel-title-row"><div><span className="eyebrow">4. Contrato</span><h2>Converter sem recadastrar</h2></div></div>
      {process.contract_id?<Link className="button" to={`/admin/locacoes/${process.contract_id}`}>Abrir contrato</Link>:<button className="button" disabled={busy||process.analysis_status!=='approved'} onClick={createContract}>Criar contrato com estes dados</button>}
      {process.analysis_status!=='approved'&&!process.contract_id&&<p className="routine-section-help">A análise cadastral precisa estar aprovada antes da criação do contrato.</p>}
    </section>

    <section className="admin-panel"><div className="panel-title-row"><h2>Histórico do processo</h2><span>{history.length}</span></div>
      <div className="rental-history">{history.length?history.map(h=><div key={h.id}><strong>{h.from_stage?`${RENTAL_PROCESS_STAGE_LABELS[h.from_stage]||h.from_stage} → `:''}{RENTAL_PROCESS_STAGE_LABELS[h.to_stage]||h.to_stage}</strong><span>{formatDateTime(h.created_at)}</span></div>):<p>Nenhuma mudança registrada.</p>}</div>
    </section>
  </div>;
}
