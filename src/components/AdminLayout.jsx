import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from '../services/auth';
import { getUnreadInstagramCount, getUnreadWhatsAppCount } from '../services/admin';
import { ROLE_LABELS, can, getAccessContext } from '../services/team';

const NAV_SECTIONS = [
  {
    key: 'general',
    label: 'Geral',
    description: 'Configurações e visão da empresa',
    items: [
      { to: '/admin', end: true, label: 'Visão geral', permission: 'dashboard.view' },
      { to: '/admin/gestao', label: 'Painel gerencial', permission: 'management.view' },
      { to: '/admin/relatorios', label: 'Relatórios', permission: 'reports.view' },
      { to: '/admin/equipe', label: 'Equipe e permissões', permission: 'team.view' },
      { to: '/admin/integracoes', label: 'Integrações', permission: 'integrations.manage' },
      { to: '/admin/saude', label: 'Saúde do sistema', permission: 'health.view' },
    ],
  },
  {
    key: 'purchase',
    label: 'Compra',
    description: 'Captação, atendimento e vendas',
    items: [
      { to: '/admin/imoveis', label: 'Imóveis', permission: 'properties.view' },
      { to: '/admin/imoveis/novo', label: 'Novo imóvel', permission: 'properties.manage' },
      { to: '/admin/captacoes', label: 'Captações', permission: 'captures.view' },
      { to: '/admin/leads', label: 'Funil de clientes', permission: 'leads.view' },
      { to: '/admin/mensagens', label: 'Mensagens Instagram', permission: 'messages.view', badge: 'instagram' },
      { to: '/admin/whatsapp', label: 'Mensagens WhatsApp', permission: 'messages.view', badge: 'whatsapp' },
      { to: '/admin/acoes', label: 'Rotina de hoje', permission: 'leads.view' },
      { to: '/admin/agendamentos', label: 'Agendamentos', permission: 'appointments.view' },
      { to: '/admin/propostas', label: 'Propostas', permission: 'proposals.view' },
      { to: '/admin/negocios', label: 'Negócios fechados', permission: 'deals.view' },
      { to: '/admin/documentos', label: 'Documentos', permission: 'documents.view' },
    ],
  },
  {
    key: 'rentals',
    label: 'Locação',
    description: 'Área reservada para a próxima etapa',
    items: [
      { to: '/admin/locacao', label: 'Painel de locação', permission: 'properties.view' },
    ],
  },
  {
    key: 'finance',
    label: 'Financeiro',
    description: 'Financeiro da empresa',
    items: [
      { to: '/admin/financeiro', label: 'Financeiro da empresa', permission: 'financial.view' },
    ],
  },
];

function pathMatchesItem(pathname, item) {
  if (item.to === '/admin') return pathname === '/admin';
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function sectionForPath(pathname, sections) {
  return sections.find((section) => section.items.some((item) => pathMatchesItem(pathname, item)))?.key || 'general';
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadInstagram, setUnreadInstagram] = useState(0);
  const [unreadWhatsApp, setUnreadWhatsApp] = useState(0);
  const [access, setAccess] = useState(null);
  const [openSection, setOpenSection] = useState('general');

  useEffect(() => {
    let active = true;
    getAccessContext().then((result) => {
      if (active && !result.error) setAccess(result.data || null);
    });
    return () => { active = false; };
  }, []);

  async function loadUnread() {
    if (!can(access, 'messages.view')) return;
    try {
      const [instagramResult, whatsappResult] = await Promise.all([
        getUnreadInstagramCount(),
        getUnreadWhatsAppCount(),
      ]);
      if (!instagramResult.error) setUnreadInstagram(Number(instagramResult.data || 0));
      if (!whatsappResult.error) setUnreadWhatsApp(Number(whatsappResult.data || 0));
    } catch (error) {
      console.warn('Não foi possível atualizar os contadores de mensagens.', error);
    }
  }

  useEffect(() => {
    if (!access) return undefined;
    let interval = null;

    const startPolling = () => {
      if (interval) window.clearInterval(interval);
      if (document.visibilityState !== 'visible') return;
      loadUnread();
      interval = window.setInterval(loadUnread, 15000);
    };

    const handleVisibility = () => startPolling();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (interval) window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [access]);

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const visibleSections = useMemo(
    () => NAV_SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => access && can(access, item.permission)),
      }))
      .filter((section) => section.items.length > 0),
    [access]
  );

  useEffect(() => {
    if (!visibleSections.length) return;
    setOpenSection(sectionForPath(location.pathname, visibleSections));
  }, [location.pathname, visibleSections]);

  function badgeValue(type) {
    const value = type === 'instagram' ? unreadInstagram : type === 'whatsapp' ? unreadWhatsApp : 0;
    if (!value) return null;
    return value > 99 ? '99+' : value;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>Matos</strong>
            <small>{access?.organization_name || 'Painel administrativo'}</small>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Menu administrativo">
          {visibleSections.map((section) => {
            const isOpen = openSection === section.key;
            const hasActiveItem = section.items.some((item) => pathMatchesItem(location.pathname, item));

            return (
              <section className={`admin-nav-section${hasActiveItem ? ' is-active' : ''}`} key={section.key}>
                <button
                  type="button"
                  className="admin-nav-section-button"
                  onClick={() => setOpenSection(isOpen ? '' : section.key)}
                  aria-expanded={isOpen}
                >
                  <span>
                    <strong>{section.label}</strong>
                    <small>{section.description}</small>
                  </span>
                  <b aria-hidden="true">{isOpen ? '−' : '+'}</b>
                </button>

                {isOpen && (
                  <div className="admin-nav-section-items">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        end={item.end}
                        to={item.to}
                        className={item.badge ? 'admin-nav-with-badge' : undefined}
                      >
                        <span>{item.label}</span>
                        {item.badge && badgeValue(item.badge) && <b>{badgeValue(item.badge)}</b>}
                      </NavLink>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <div className="admin-sidebar-bottom">
          {access && (
            <div className="admin-current-user">
              <strong>{access.full_name || access.email || 'Usuário'}</strong>
              <small>{ROLE_LABELS[access.role] || access.role}</small>
            </div>
          )}
          <a href="/" target="_blank" rel="noreferrer">Ver site público</a>
          <button type="button" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet context={{ access }} />
      </main>
    </div>
  );
}
