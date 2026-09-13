import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from '../services/auth';
import { getUnreadInstagramCount } from '../services/admin';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [unreadInstagram, setUnreadInstagram] = useState(0);

  async function loadUnread() {
    const { data } = await getUnreadInstagramCount();
    setUnreadInstagram(Number(data || 0));
  }

  useEffect(() => {
    loadUnread();
    const interval = window.setInterval(loadUnread, 10000);
    return () => window.clearInterval(interval);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>Matos</strong>
            <small>Painel administrativo</small>
          </div>
        </div>

        <nav className="admin-nav">
          <NavLink end to="/admin">Visão geral</NavLink>
          <NavLink to="/admin/imoveis">Imóveis</NavLink>
          <NavLink to="/admin/mensagens" className="admin-nav-with-badge">
            <span>Mensagens Instagram</span>
            {unreadInstagram > 0 && (
              <b>{unreadInstagram > 99 ? '99+' : unreadInstagram}</b>
            )}
          </NavLink>
          <NavLink to="/admin/leads">Funil de clientes</NavLink>
          <NavLink to="/admin/acoes">Próximas ações</NavLink>
          <NavLink to="/admin/agendamentos">Agendamentos</NavLink>
          <NavLink to="/admin/captacoes">Captações</NavLink>
          <NavLink to="/admin/integracoes">Integrações</NavLink>
          <NavLink to="/admin/imoveis/novo">Novo imóvel</NavLink>
        </nav>

        <div className="admin-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer">Ver site público</a>
          <button type="button" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
