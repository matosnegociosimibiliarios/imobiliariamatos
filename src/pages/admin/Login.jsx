import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentSession, signIn } from '../../services/auth';
import { getAccessContext } from '../../services/team';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [alreadyLogged, setAlreadyLogged] = useState(false);

  React.useEffect(() => {
    (async () => {
      const session = await getCurrentSession();
      if (session) { const access = await getAccessContext(); if (access.data && !access.error) setAlreadyLogged(true); else navigate('/onboarding', { replace: true }); }
    })();
  }, []);

  if (alreadyLogged) {
    return <Navigate to="/admin/gestao" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    const { error } = await signIn(email.trim(), password);

    if (error) {
      setErrorMessage('E-mail ou senha inválidos.');
      setSubmitting(false);
      return;
    }

    const access = await getAccessContext();
    if (!access.data || access.error) { navigate('/onboarding', { replace: true }); return; }
    const target = location.state?.from || '/admin/gestao';
    navigate(target, { replace: true });
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="admin-brand login-brand">
          <img className="admin-brand-logo login-brand-logo" src="/goi-logo.svg" alt="GOI" />
          <div>
            <strong>GOI</strong>
            <small>Gerenciador de Operações Imobiliárias</small>
          </div>
        </div>

        <h1>Entrar no painel</h1>

        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            Senha
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          <div className="login-forgot-row">
            <Link to="/esqueci-senha">Esqueci minha senha</Link>
          </div>

          {errorMessage && (
            <div className="admin-error">{errorMessage}</div>
          )}

          <button className="button full-button" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="login-signup-link">Ainda não possui conta? <Link to="/cadastro">Criar minha imobiliária</Link></p>
      </section>
    </main>
  );
}
