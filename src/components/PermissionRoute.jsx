import React, { useEffect, useState } from 'react';
import { getAccessContext, can } from '../services/team';
import { getSaasEntitlement, hasSaasFeature } from '../services/saas';

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

const PERMISSION_FEATURE = {
  'financial.view': 'finance',
  'rentals.view': 'rentals',
  'rentals.manage': 'rentals',
  'integrations.manage': 'integrations',
};

export default function PermissionRoute({ permission, children }) {
  const [state, setState] = useState({ loading: true, allowed: false, planBlocked: false });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const access = await loadAccess();
        const feature = PERMISSION_FEATURE[permission];
        let planAllowed = true;
        if (feature) {
          const entitlementResult = await getSaasEntitlement();
          if (entitlementResult.error) throw entitlementResult.error;
          planAllowed = hasSaasFeature(entitlementResult.data, feature);
        }
        if (active) setState({ loading: false, allowed: can(access, permission) && planAllowed, planBlocked: !planAllowed });
      } catch {
        if (active) setState({ loading: false, allowed: false, planBlocked: false });
      }
    })();
    return () => { active = false; };
  }, [permission]);

  if (state.loading) return <div className="admin-loading">Verificando permissão...</div>;
  if (!state.allowed) {
    return (
      <div className="admin-denied">
        <h1>{state.planBlocked ? 'Recurso não incluído no seu plano' : 'Acesso restrito'}</h1>
        <p>{state.planBlocked ? 'Este módulo está disponível em um plano superior. Consulte os planos para liberar o recurso.' : 'Seu perfil não possui permissão para abrir esta área.'}</p>
      </div>
    );
  }
  return children;
}
