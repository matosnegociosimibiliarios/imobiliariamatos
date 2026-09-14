import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentSession } from '../services/auth';
import { getAccessContext } from '../services/team';

export default function AdminRoute() {
  const location = useLocation();
  const [state, setState] = useState({
    loading: true,
    authenticated: false,
    authorized: false,
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const session = await getCurrentSession();

        if (!session) {
          if (active) setState({ loading: false, authenticated: false, authorized: false });
          return;
        }

        const accessResult = await getAccessContext();
        if (active) {
          setState({
            loading: false,
            authenticated: true,
            authorized: Boolean(accessResult.data && !accessResult.error),
          });
        }
      } catch {
        if (active) setState({ loading: false, authenticated: false, authorized: false });
      }
    })();

    return () => { active = false; };
  }, [location.pathname]);

  if (state.loading) return <div className="admin-loading">Verificando acesso...</div>;
  if (!state.authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!state.authorized) {
    return (
      <div className="admin-denied">
        <h1>Acesso não autorizado</h1>
        <p>Seu usuário não está ativo em nenhuma empresa do CRM.</p>
      </div>
    );
  }

  return <Outlet />;
}
