import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSession(data.session || null);
        setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession || null);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    if (password.length < 8) {
      setMessage('Use uma senha com pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setMessage('As senhas não são iguais.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message || 'Não foi possível definir a senha.');
      setSaving(false);
      return;
    }
    setMessage('Senha criada. Abrindo o CRM...');
    window.setTimeout(() => navigate('/admin', { replace: true }), 700);
  }

  if (loading) return <div className="admin-loading">Validando convite...</div>;

  return (
    <main className="invite-page">
      <section className="invite-card">
        <span className="eyebrow">Matos Negócios Imobiliários</span>
        <h1>Ativar acesso ao CRM</h1>
        {!session ? (
          <>
            <p>Este convite não está mais ativo ou não foi reconhecido. Abra novamente o link recebido por e-mail.</p>
            <a className="button" href="/login">Ir para o login</a>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>Crie sua senha para acessar o painel com as permissões definidas pelo administrador.</p>
            <label>Nova senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
            <label>Confirmar senha<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>
            {message && <div className="admin-message">{message}</div>}
            <button className="button" disabled={saving}>{saving ? 'Salvando...' : 'Ativar meu acesso'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
