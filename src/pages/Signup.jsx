import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createOrganization } from '../services/team';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', agency: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    if (form.password.length < 8) { setMessage('Use uma senha com pelo menos 8 caracteres.'); setBusy(false); return; }

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.name.trim(), agency_name: form.agency.trim() } },
    });
    if (error) { setMessage(error.message || 'Não foi possível criar a conta.'); setBusy(false); return; }
    if (!data?.session) { setMessage('Conta criada. Confirme seu e-mail e depois entre para concluir o cadastro.'); setBusy(false); return; }

    const organization = await createOrganization({ name: form.agency.trim() });
    if (organization.error) { setMessage(organization.error.message || 'Conta criada, mas não foi possível criar a imobiliária.'); setBusy(false); return; }
    navigate('/admin', { replace: true });
  }

  return <main className="login-page"><section className="login-card">
    <div className="admin-brand login-brand"><img className="admin-brand-logo login-brand-logo" src="/goi-logo.svg" alt="GOI" /><div><strong>GOI</strong><small>Gerenciador de Operações Imobiliárias</small></div></div>
    <h1>Começar teste gratuito</h1><p>Crie sua imobiliária e tenha 14 dias para testar o sistema.</p>
    <form onSubmit={submit} className="admin-form">
      <label>Seu nome<input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></label>
      <label>Nome da imobiliária<input required value={form.agency} onChange={(e)=>setForm({...form,agency:e.target.value})} /></label>
      <label>E-mail<input type="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></label>
      <label>Senha<input type="password" minLength="8" required value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} /></label>
      {message && <div className="admin-message">{message}</div>}
      <button className="button full-button" disabled={busy}>{busy ? 'Criando...' : 'Criar minha imobiliária'}</button>
    </form>
    <p>Já possui conta? <Link to="/login">Entrar</Link></p>
  </section></main>;
}