import React, { useEffect, useState } from 'react';
import PageTracker from './PageTracker';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { getAgencySettings } from '../services/properties';

export default function PublicLayout() {
  const [agency,setAgency]=useState(null);
  useEffect(()=>{ getAgencySettings().then(({data})=>setAgency(data||null)); },[]);
  const name=agency?.trade_name||agency?.agency_name||'Imobiliária';
  const logo=agency?.logo_url||'/crm-beta-logo.webp';
  const creci=agency?.creci ? `CRECI: ${agency.creci}` : 'CRECI: cadastro institucional em atualização.';
  return (
    <div className="site-shell" style={{'--agency-primary':agency?.primary_color||undefined,'--agency-secondary':agency?.secondary_color||undefined}}>
      <PageTracker />
      <header className="header premium-header">
        <Link className="brand premium-brand" to="/">
          <img className="brand-logo" src={logo} alt={name} />
          <span className="brand-wordmark"><strong>{name}</strong>{agency?.slogan&&<small>{agency.slogan}</small>}</span>
        </Link>
        <nav className="nav" aria-label="Navegação principal"><NavLink to="/comprar">Comprar</NavLink><NavLink to="/alugar">Alugar</NavLink><NavLink to="/anuncie-seu-imovel">Vender</NavLink><NavLink to="/avaliacao-do-imovel">Avaliar</NavLink><a href="/#sobre">Sobre</a></nav>
        <Link className="client-area-button" to="/login">Área do Cliente</Link>
      </header>
      <Outlet context={{agency}} />
      <footer className="footer premium-footer" id="contato">
        <div className="footer-brand"><img className="footer-logo" src={logo} alt="" /><div><strong>{name}</strong><p>{agency?.public_address||'Imóveis, atendimento e negócios com gestão integrada.'}</p></div></div>
        <div className="footer-links"><Link to="/comprar">Comprar</Link><Link to="/alugar">Alugar</Link><Link to="/anuncie-seu-imovel">Vender</Link><Link to="/avaliacao-do-imovel">Avaliar</Link><Link to="/politica-de-privacidade">Privacidade</Link></div>
        <p className="footer-note">© {new Date().getFullYear()} {name}. {creci}</p>
      </footer>
    </div>
  );
}