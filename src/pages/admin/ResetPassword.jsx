import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword } from '../../services/auth';

export default function ResetPassword() {
  const navigate=useNavigate();
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState(false);

  async function handleSubmit(event){
    event.preventDefault();
    setError('');
    if(password.length<6){
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if(password!==confirm){
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    if(updateError){
      setError('Não foi possível redefinir a senha. Abra novamente o link enviado por e-mail.');
      setSubmitting(false);
      return;
    }
    setSuccess(true);
    setSubmitting(false);
    window.setTimeout(()=>navigate('/login',{replace:true}),1200);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="admin-brand login-brand">
          <img className="admin-brand-logo login-brand-logo" src="/goi-logo.svg" alt="GOI" />
          <div><strong>GOI</strong><small>Gerenciador de Operações Imobiliárias</small></div>
        </div>
        <h1>Criar nova senha</h1>
        {success ? (
          <div className="admin-message">Senha alterada com sucesso. Você será direcionado para o login.</div>
        ) : (
          <form onSubmit={handleSubmit} className="admin-form">
            <label>
              Nova senha
              <div className="password-field">
                <input type={showPassword?'text':'password'} required value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password" />
                <button type="button" className="password-toggle" onClick={()=>setShowPassword((v)=>!v)}>{showPassword?'Ocultar':'Mostrar'}</button>
              </div>
            </label>
            <label>
              Confirmar nova senha
              <input type={showPassword?'text':'password'} required value={confirm} onChange={(e)=>setConfirm(e.target.value)} autoComplete="new-password" />
            </label>
            {error && <div className="admin-error">{error}</div>}
            <button className="button full-button" disabled={submitting}>{submitting?'Salvando...':'Salvar nova senha'}</button>
          </form>
        )}
        <p className="login-signup-link"><Link to="/login">Voltar para o login</Link></p>
      </section>
    </main>
  );
}
