import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../services/tracking';

export default function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;

    const pageType =
      location.pathname === '/'
        ? 'home'
        : location.pathname.startsWith('/comprar')
        ? 'buy'
        : location.pathname.startsWith('/alugar')
        ? 'rent'
        : location.pathname.startsWith('/imovel/')
        ? 'property'
        : 'other';

    trackPageView({
      path,
      pageType,
    });
  }, [location.pathname, location.search]);

  return null;
}
