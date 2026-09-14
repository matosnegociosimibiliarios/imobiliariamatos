import React, { useEffect, useState } from 'react';
import { getAccessContext, can } from '../services/team';

const accessCache = { value: null, at: 0 };

async function loadAccess() {
  if (accessCache.value && Date.now() - accessCache.at < 30000) return accessCache.value;
  const result = await getAccessContext();
  if (result.error) throw result.error;
  accessCache.value = result.data;
  accessCache.at = Date.now();
  return result.data;
}

export function clearPermissionCache() {
  accessCache.value = null;
  accessCache.at = 0;
}

export default function PermissionRoute({ permission, children }) {
  const [state, setState] = useState({ loading: true, allowed: false });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const access = await loadAccess();
        if (active) setState({ loading: false, allowed: can(access, permission) });
      } catch {
        if (active) setState({ loading: false, allowed: false });
      }
    })();
    return () => { active = false; };
  }, [permission]);

  if (state.loading) return <div className="admin-loading">Verificando permissão...</div>;
  if (!state.allowed) {
    return (
      <div className="admin-denied">
        <h1>Acesso restrito</h1>
        <p>Seu perfil não possui permissão para abrir esta área.</p>
      </div>
    );
  }
  return children;
}
