import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from '../services/auth';
import { getUnreadInstagramCount, getUnreadWhatsAppCount } from '../services/admin';
import { ROLE_LABELS, can, getAccessContext } from '../services/team';

const NAV_SECTIONS = [
  {
    title: 'Visão Geral',
    items: [
      { to: '/admin/gestao', label: 'Metas', permission: 'management.view' },
      { to: '/admin/relatorios', label: 'Relatórios', permission: 'reports.view' },
      { to: '/admin/leads', label: 'Funil de Clientes', permission: 'leads.view' },
      { to: '/admin/propostas', label: 'Propostas', permission: 'proposals.view' },
      { to: '/admin/negocios', label: 'Negócios Fechados', permission: 'deals.view' },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { to: '/admin/acoes', label: 'Rotina de Hoje', permission: 'leads.view' },
      { to: '/admin/mensagens', label: 'Mensagens Instagram', permission: 'messages.view', badge: 'instagram' },
      { to: '/admin/whatsapp', label: 'WhatsApp', permission: 'messages.view', badge: 'whatsapp' },
      { to: '/admin/agendamentos', label: 'Agendamentos', permission: 'appointments.view' },
      { to: '/admin/imoveis', label: 'Imóveis', permission: 'properties.view' },
      { to: '/admin/captacoes', label: 'Captação', permission: 'captures.view' },
      { to: '/admin/documentos', label: 'Documentos', permission: 'documents.view' },
    ],
  },
  {
    title: 'Locação',
    comingSoon: true,
  },
  {
    title: 'Financeiro',
    comingSoon: true,
  },
  {
    title: 'Administração',
    items: [
      { to: '/admin/equipe', label: 'Equipe e Permissões', permission: 'team.view' },
      { to: '/admin/integracoes', label: 'Integrações', permission: 'integrations.manage' },
      { to: '/admin/saude', label: 'Saúde do Sistema', permission: 'health.view' },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [unreadInstagram, setUnreadInstagram] = useState(0);
  const [unreadWhatsApp, setUnreadWhatsApp] = useState(0);
  const [access, setAccess] = useState(null);

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

  function handleSubscription() {
    window.alert('A assinatura da versão paga será habilitada na fase comercial do CRM. O botão já está reservado no menu para essa etapa.');
  }

  const visibleSections = useMemo(() => {
    if (!access) return [];
    return NAV_SECTIONS.map((section) => {
      if (section.comingSoon) return section;
      return {
        ...section,
        items: (section.items || []).filter((item) => can(access, item.permission)),
      };
    }).filter((section) => section.comingSoon || (section.items || []).length > 0);
  }, [access]);

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
          {visibleSections.map((section) => (
            <section className="admin-nav-section" key={section.title}>
              <h2 className="admin-nav-section-title">{section.title}</h2>
              {section.comingSoon ? (
                <div className="admin-nav-placeholder" aria-disabled="true">Área em breve</div>
              ) : (
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
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          {access && (
            <div className="admin-current-user">
              <strong>{access.full_name || access.email || 'Usuário'}</strong>
              <small>{ROLE_LABELS[access.role] || access.role}</small>
            </div>
          )}
          <a href="/" target="_blank" rel="noreferrer">Ver Site Público</a>
          <button type="button" className="admin-subscription-button" onClick={handleSubscription}>
            Assinar versão paga
          </button>
          <button type="button" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet context={{ access }} />
      </main>
    </div>
  );
}
