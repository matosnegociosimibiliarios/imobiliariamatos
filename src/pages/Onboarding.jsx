import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createOrganization, getAccessContext } from '../services/team';

export default function Onboarding() {
  const navigate = useNavigate();
  const [state,setState]=useState({loading:true,authenticated:false});
  const [agency,setAgency]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setState({loading:false,authenticated:false});return;}
    const access=await getAccessContext();
    if(access.data&&!access.error){navigate('/admin',{replace:true});return;}
    setAgency(session.user?.user_metadata?.agency_name||'');
    setState({loading:false,authenticated:true});
  })();},[navigate]);

  async function submit(e){
    e.preventDefault(); setBusy(true); setMessage('');
    const result=await createOrganization({name:agency.trim()});
    if(result.error){setMessage(result.error.message||'Não foi possível criar sua imobiliária.');setBusy(false);return;}
    navigate('/admin',{replace:true});
  }
  if(state.loading)return <div className="admin-loading">Preparando sua conta...</div>;
  if(!state.authenticated)return <Navigate to="/login" replace />;
  return <main className="login-page"><section className="login-card">
    <div className="admin-brand login-brand"><img className="admin-brand-logo login-brand-logo" src="/goi-logo.svg" alt="GOI"/><div><strong>GOI</strong><small>Gerenciador de Operações Imobiliárias</small></div></div>
    <h1>Concluir cadastro</h1><p>Informe o nome da sua imobiliária para criar seu ambiente no GOI.</p>
    <form onSubmit={submit} className="admin-form"><label>Nome da imobiliária<input required value={agency} onChange={e=>setAgency(e.target.value)}/></label>
    {message&&<div className="admin-error">{message}</div>}<button className="button full-button" disabled={busy}>{busy?'Criando...':'Criar minha imobiliária'}</button></form>
  </section></main>;
}
