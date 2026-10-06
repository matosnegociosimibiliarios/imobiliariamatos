import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/auth';

export default function ForgotPassword() {
  const [email,setEmail]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function handleSubmit(event){
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    const { error: resetError } = await requestPasswordReset(email.trim());
    if(resetError){
      setError('Não foi possível enviar o link agora. Confira o e-mail e tente novamente.');
      setSubmitting(false);
      return;
    }
    setMessage('Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
    setSubmitting(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="admin-brand login-brand">
          <img className="admin-brand-logo login-brand-logo" src="/goi-logo.svg" alt="GOI" />
          <div><strong>GOI</strong><small>Gerenciador de Operações Imobiliárias</small></div>
        </div>
        <h1>Recuperar senha</h1>
        <p className="login-helper-text">Informe o e-mail usado no GOI. Enviaremos um link para redefinir sua senha.</p>
        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            E-mail
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" />
          </label>
          {message && <div className="admin-message">{message}</div>}
          {error && <div className="admin-error">{error}</div>}
          <button className="button full-button" disabled={submitting}>{submitting?'Enviando...':'Enviar link de recuperação'}</button>
        </form>
        <p className="login-signup-link"><Link to="/login">Voltar para o login</Link></p>
      </section>
    </main>
  );
}
