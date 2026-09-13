import React from 'react';
import PageTracker from './PageTracker';
import { Link, NavLink, Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="site-shell">
      <PageTracker />
      <header className="header">
        <Link className="brand" to="/">
          <span className="brand-mark">M</span>
          <span>
            <strong>Matos</strong>
            <small>Negócios Imobiliários</small>
          </span>
        </Link>

        <nav className="nav" aria-label="Navegação principal">
          <NavLink to="/comprar">Comprar</NavLink>
          <NavLink to="/alugar">Alugar</NavLink>
          <NavLink to="/anuncie-seu-imovel">Anuncie seu imóvel</NavLink>
          <NavLink to="/avaliacao-do-imovel">Avalie seu imóvel</NavLink>
          <a href="/#sobre">Sobre</a>
        </nav>

        <a className="button button-small" href="/#contato">Contato</a>
      </header>

      <Outlet />

      <footer className="footer" id="contato">
        <div>
          <strong>Matos Negócios Imobiliários</strong>
          <p>Comprar, alugar, anunciar e avaliar imóveis.</p>
        </div>

        <div className="footer-links">
          <Link to="/">Início</Link>
          <Link to="/comprar">Comprar</Link>
          <Link to="/alugar">Alugar</Link>
          <Link to="/anuncie-seu-imovel">Anunciar</Link>
          <Link to="/avaliacao-do-imovel">Avaliação</Link>
        </div>

        <p className="footer-note">© 2026 Matos Negócios Imobiliários.</p>
      </footer>
    </div>
  );
}
