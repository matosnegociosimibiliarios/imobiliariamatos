import React, { useEffect, useState } from 'react';
import PageTracker from './PageTracker';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { getAgencySettings, publicTenantPath } from '../services/properties';

export default function PublicLayout() {
  const [agency,setAgency]=useState(null);
  useEffect(()=>{ getAgencySettings().then(({data})=>setAgency(data||null)); },[]);
  const name=agency?.trade_name||agency?.agency_name||'Imobiliária';
  const logo=agency?.logo_url||null;
  const creci=agency?.creci ? `CRECI: ${agency.creci}` : 'CRECI: cadastro institucional em atualização.';
  const serviceArea=agency?.service_area||null;
  return (
    <div className="site-shell" style={{'--accent':agency?.primary_color||'#214d34','--accent-2':agency?.secondary_color||agency?.primary_color||'#173824','--agency-primary':agency?.primary_color||undefined,'--agency-secondary':agency?.secondary_color||undefined}}>
      <PageTracker />
      <header className="header premium-header">
        <Link className="brand premium-brand" to={publicTenantPath('/')}>
          {logo && <img className="brand-logo" src={logo} alt={name} />}
          <span className="brand-wordmark"><strong>{name}</strong>{agency?.slogan&&<small>{agency.slogan}</small>}</span>
        </Link>
        <nav className="nav" aria-label="Navegação principal"><NavLink to={publicTenantPath('/comprar')}>Comprar</NavLink><NavLink to={publicTenantPath('/alugar')}>Alugar</NavLink><NavLink to={publicTenantPath('/anuncie-seu-imovel')}>Vender</NavLink><NavLink to={publicTenantPath('/avaliacao-do-imovel')}>Avaliar</NavLink><a href={publicTenantPath('/') + '#sobre'}>Sobre</a></nav>
        <Link className="client-area-button" to="/login">Área do Cliente</Link>
      </header>
      <Outlet context={{agency}} />
      <footer className="footer premium-footer" id="contato">
        <div className="footer-brand">{logo && <img className="footer-logo" src={logo} alt="" />}<div><strong>{name}</strong><p>{agency?.public_address || serviceArea || 'Imóveis, atendimento e negócios com gestão integrada.'}</p></div></div>
        <div className="footer-links"><Link to={publicTenantPath('/comprar')}>Comprar</Link><Link to={publicTenantPath('/alugar')}>Alugar</Link><Link to={publicTenantPath('/anuncie-seu-imovel')}>Vender</Link><Link to={publicTenantPath('/avaliacao-do-imovel')}>Avaliar</Link><Link to={publicTenantPath('/politica-de-privacidade')}>Privacidade</Link></div>
        <p className="footer-note">© {new Date().getFullYear()} {name}. {creci}</p>
      </footer>
    </div>
  );
}