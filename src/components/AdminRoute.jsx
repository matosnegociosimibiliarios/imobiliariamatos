import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentProfile, getCurrentSession } from '../services/auth';

export default function AdminRoute() {
  const location = useLocation();
  const [state, setState] = useState({
    loading: true,
    authenticated: false,
    admin: false,
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const session = await getCurrentSession();

        if (!session) {
          if (active) {
            setState({ loading: false, authenticated: false, admin: false });
          }
          return;
        }

        const profile = await getCurrentProfile();

        if (active) {
          setState({
            loading: false,
            authenticated: true,
            admin: profile?.role === 'admin',
          });
        }
      } catch {
        if (active) {
          setState({ loading: false, authenticated: false, admin: false });
        }
      }
    })();

    return () => { active = false; };
  }, [location.pathname]);

  if (state.loading) {
    return <div className="admin-loading">Verificando acesso...</div>;
  }

  if (!state.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!state.admin) {
    return (
      <div className="admin-denied">
        <h1>Acesso não autorizado</h1>
        <p>Este usuário não possui permissão de administrador.</p>
      </div>
    );
  }

  return <Outlet />;
}
