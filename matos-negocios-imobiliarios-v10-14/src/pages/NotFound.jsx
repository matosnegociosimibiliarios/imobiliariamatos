import React from 'react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
export default function NotFound() {
  return <main className="section"><SeoHead title="Página não encontrada" description="A página solicitada não foi encontrada." canonicalPath={window.location.pathname} robots="noindex,nofollow" /><div className="empty-state not-found-page"><span className="not-found-code">404</span><h1>Página não encontrada</h1><p>O endereço pode ter mudado ou não existir.</p><div className="not-found-actions"><Link className="button" to="/">Início</Link><Link className="admin-link-button" to="/comprar">Ver imóveis</Link></div></div></main>;
}
