import React from 'react';
import PageTracker from './PageTracker';
import { Link, NavLink, Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="site-shell">
      <PageTracker />
      <header className="header premium-header">
        <Link className="brand premium-brand" to="/">
          <img className="brand-logo" src="/crm-beta-logo.webp" alt="Imobiliária Matos" />
          <span className="brand-wordmark">
            <strong>MATOS</strong>
            <small>IMOBILIÁRIA</small>
          </span>
        </Link>
        <nav className="nav" aria-label="Navegação principal">
          <NavLink to="/comprar">Comprar</NavLink>
          <NavLink to="/alugar">Alugar</NavLink>
          <NavLink to="/anuncie-seu-imovel">Vender</NavLink>
          <NavLink to="/avaliacao-do-imovel">Avaliar</NavLink>
          <a href="/#sobre">Sobre</a>
        </nav>
        <Link className="client-area-button" to="/login">Área do Cliente</Link>
      </header>

      <Outlet />

      <footer className="footer premium-footer" id="contato">
        <div className="footer-brand">
          <img className="footer-logo" src="/crm-beta-logo.webp" alt="" />
          <div><strong>IMOBILIÁRIA MATOS</strong><p>Imóveis, atendimento e negócios em Ressaquinha e região.</p></div>
        </div>
        <div className="footer-links">
          <Link to="/comprar">Comprar</Link><Link to="/alugar">Alugar</Link><Link to="/anuncie-seu-imovel">Vender</Link><Link to="/avaliacao-do-imovel">Avaliar</Link><Link to="/politica-de-privacidade">Privacidade</Link>
        </div>
        <p className="footer-note">© 2026 Imobiliária Matos. CRECI: cadastro institucional em atualização.</p>
      </footer>
    </div>
  );
}
