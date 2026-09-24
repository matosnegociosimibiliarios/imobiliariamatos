import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentSession, signIn } from '../../services/auth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [alreadyLogged, setAlreadyLogged] = useState(false);

  React.useEffect(() => {
    (async () => {
      const session = await getCurrentSession();
      if (session) setAlreadyLogged(true);
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

    const target = location.state?.from || '/admin/gestao';
    navigate(target, { replace: true });
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="admin-brand login-brand">
          <img className="admin-brand-logo login-brand-logo" src="/crm-beta-logo.webp" alt="CRM Beta" />
          <div>
            <strong>CRM Beta</strong>
            <small>Acesso administrativo</small>
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
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {errorMessage && (
            <div className="admin-error">{errorMessage}</div>
          )}

          <button className="button full-button" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
