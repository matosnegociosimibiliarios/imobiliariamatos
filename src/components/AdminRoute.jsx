import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentSession } from '../services/auth';
import { getAccessContext } from '../services/team';
import { getSaasEntitlement } from '../services/saas';

export default function AdminRoute() {
  const location = useLocation();
  const [state, setState] = useState({
    loading: true,
    authenticated: false,
    authorized: false,
    entitlement: null,
    error: false,
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const session = await getCurrentSession();

        if (!session) {
          if (active) setState({ loading: false, authenticated: false, authorized: false, entitlement: null, error: false });
          return;
        }

        const accessResult = await getAccessContext();
        const entitlementResult = accessResult.data && !accessResult.error ? await getSaasEntitlement() : { data: null };
        if (active) {
          setState({
            loading: false,
            authenticated: true,
            authorized: Boolean(accessResult.data && !accessResult.error),
            entitlement: entitlementResult.data || null,
            error: Boolean(accessResult.error),
          });
        }
      } catch {
        if (active) setState({ loading: false, authenticated: true, authorized: false, entitlement: null, error: true });
      }
    })();

    return () => { active = false; };
  }, [location.pathname]);

  if (state.loading) return <div className="admin-loading">Verificando acesso...</div>;
  if (!state.authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (state.error) return <div className="admin-loading">Não foi possível verificar seu acesso agora. Atualize a página em alguns instantes.</div>;
  if (!state.authorized) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
