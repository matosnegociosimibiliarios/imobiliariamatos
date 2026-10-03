import React,{useEffect,useMemo,useState} from 'react';
import {Navigate} from 'react-router-dom';
import {getPlatformAdminOverview,isPlatformAdmin} from '../../services/saas';

const PLAN={internal:'Vitalício',starter:'Essencial',professional:'Profissional',business:'Empresarial'};
const STATUS={active:'Ativo',trial:'Teste grátis',past_due:'Em atraso',cancelled:'Cancelado',blocked:'Bloqueado'};
const STAGE={internal:'Vitalício',trial:'Teste grátis',paid:'Pago',inactive:'Inativo'};

export default function PlatformAdmin(){
  const [allowed,setAllowed]=useState(null);
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  useEffect(()=>{(async()=>{const a=await isPlatformAdmin();if(a.error||!a.data){setAllowed(false);return;}setAllowed(true);const r=await getPlatformAdminOverview();if(r.error)setError(r.error.message||'Não foi possível carregar os clientes.');else setData(r.data||{});})();},[]);
  const organizations=useMemo(()=>{const q=search.trim().toLowerCase();const list=data?.organizations||[];return q?list.filter(o=>[o.name,o.slug,o.plan_code,o.status,o.subscription_status].some(v=>String(v||'').toLowerCase().includes(q))):list;},[data,search]);
  if(allowed===false)return <Navigate to="/admin" replace/>;
  return <div className="admin-page">
    <div className="admin-page-header"><div><span className="eyebrow">Administração da plataforma</span><h1>Imobiliárias clientes</h1><p>Acompanhe as imobiliárias, planos, assinaturas e uso do sistema.</p></div></div>
    {error&&<div className="admin-error">{error}</div>}
    <div className="management-metrics-grid">
      <article className="admin-card"><small>Imobiliárias</small><h2>{data?.summary?.organizations??'—'}</h2></article>
      <article className="admin-card"><small>Ativas</small><h2>{data?.summary?.active??'—'}</h2></article>
      <article className="admin-card"><small>Em teste</small><h2>{data?.summary?.trial??'—'}</h2></article>
      <article className="admin-card"><small>Planos pagos</small><h2>{data?.summary?.paid??'—'}</h2></article>
      <article className="admin-card"><small>Receita mensal contratada</small><h2>{data?.summary?.mrr==null?'—':Number(data.summary.mrr).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</h2></article>
    </div>
    <section className="admin-panel" style={{marginTop:20}}>
      <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><div><h2 style={{marginBottom:4}}>Clientes do GOI</h2><p style={{margin:0}}>Sua Imobiliária Matos aparece como acesso Vitalício.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar imobiliária ou plano" style={{minWidth:260,padding:'10px 12px'}}/></div>
      <div style={{overflowX:'auto',marginTop:16}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th align="left">Imobiliária</th><th align="left">Plano</th><th align="left">Situação</th><th align="left">Categoria</th><th align="left">Assinatura</th><th align="left">Valor/mês</th><th>Usuários</th><th>Imóveis</th><th align="left">Criada em</th></tr></thead><tbody>
      {organizations.map(o=><tr key={o.id} style={{borderTop:'1px solid rgba(127,127,127,.2)'}}><td style={{padding:'12px 8px'}}><strong>{o.name}</strong><br/><small>{o.slug}</small></td><td style={{padding:'12px 8px'}}>{PLAN[o.plan_code]||o.plan_code||'—'}</td><td style={{padding:'12px 8px'}}>{STATUS[o.status]||o.status||'—'}</td><td style={{padding:'12px 8px'}}><strong>{STAGE[o.customer_stage]||o.customer_stage||'—'}</strong></td><td style={{padding:'12px 8px'}}>{o.plan_code==='internal'?'Vitalício':(STATUS[o.subscription_status]||o.subscription_status||'Sem pagamento')}</td><td style={{padding:'12px 8px'}}>{o.plan_code==='internal'?'—':Number(o.monthly_price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td align="center">{o.users}</td><td align="center">{o.properties}</td><td style={{padding:'12px 8px'}}>{o.created_at?new Date(o.created_at).toLocaleDateString('pt-BR'):'—'}</td></tr>)}
      {!organizations.length&&<tr><td colSpan="9" style={{padding:20,textAlign:'center'}}>Nenhuma imobiliária encontrada.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}