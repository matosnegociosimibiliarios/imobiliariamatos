import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from '../services/auth';
import { getUnreadInstagramCount, getUnreadWhatsAppCount } from '../services/admin';
import { ROLE_LABELS, can, getAccessContext, getUserOrganizations, setActiveOrganization } from '../services/team';
import { setPublicOrganizationSlug } from '../services/properties';
import { getSaasEntitlement, hasSaasFeature, isActiveTrial, isPlatformAdmin } from '../services/saas';
import NotificationCenter from './NotificationCenter';
import InstallGoiButton from './InstallGoiButton';


const CHECKOUTS = {
  starter: 'https://pay.kiwify.com.br/ViNd6ty',
  professional: 'https://pay.kiwify.com.br/E2TbJyV',
  business: 'https://pay.kiwify.com.br/GiN0b0j',
};

function SubscriptionExpired({ entitlement }) {
  const organizationId = entitlement?.organization_id;
  const checkout = (code) => CHECKOUTS[code] + (organizationId ? '?sck=' + encodeURIComponent(organizationId) : '');

  return (
    <div className="admin-subscription-lock">
      <div className="admin-subscription-lock-card">
        <span className="eyebrow">Período de teste encerrado</span>
        <h1>Escolha um plano para continuar usando o GOI.</h1>
        <p>Seus dados continuam salvos. O acesso à conta permanece disponível, mas as funções do CRM ficam bloqueadas até a ativação de um plano.</p>
        <div className="admin-subscription-lock-plans">
          <article>
            <h2>Essencial</h2>
            <strong>R$ 49,90/mês</strong>
            <small>CRM comercial para operação essencial.</small>
            <a className="button" href={checkout('starter')} target="_blank" rel="noreferrer">Assinar Essencial</a>
          </article>
          <article className="featured">
            <h2>Profissional</h2>
            <strong>R$ 99,90/mês</strong>
            <small>Inclui locação, financeiro, integrações, site e avaliador rápido.</small>
            <a className="button" href={checkout('professional')} target="_blank" rel="noreferrer">Assinar Profissional</a>
          </article>
          <article>
            <h2>Empresarial</h2>
            <strong>R$ 199,90/mês</strong>
            <small>Todos os recursos, avaliador completo e limites ampliados.</small>
            <a className="button" href={checkout('business')} target="_blank" rel="noreferrer">Assinar Empresarial</a>
          </article>
        </div>
      </div>
    </div>
  );
}

const NAV_SECTIONS = [
  {
    title: 'Comercial',
    items: [
      { to: '/admin/leads', label: 'Clientes e Leads', permission: 'leads.view' },
      { to: '/admin/funil', label: 'Funil Comercial', permission: 'leads.view' },
      { to: '/admin/imoveis', label: 'Imóveis', permission: 'properties.view' },
      { to: '/admin/indicadores-imoveis', label: 'Indicadores de Imóveis', permission: 'properties.view' },
      { to: '/admin/captacoes', label: 'Captações', permission: 'captures.view' },
      { to: '/admin/propostas', label: 'Propostas', permission: 'proposals.view' },
      { to: '/admin/negocios', label: 'Negócios Fechados', permission: 'deals.view' },
    ],
  },
  {
    title: 'Atendimento',
    items: [
      { to: '/admin/mensagens', label: 'Mensagens Instagram', permission: 'messages.view', badge: 'instagram' },
      { to: '/admin/whatsapp', label: 'WhatsApp', permission: 'messages.view', badge: 'whatsapp' },
      { to: '/admin/agenda', label: 'Agenda e Tarefas', permission: 'appointments.view' },
    ],
  },
  {
    title: 'Locação',
    items: [
      { to: '/admin/locacoes', label: 'Visão Geral', permission: 'rentals.view' },
      { to: '/admin/locacoes/pipeline', label: 'Pipeline', permission: 'rentals.view' },
      { to: '/admin/locacoes/operacao', label: 'Operações', permission: 'rentals.manage' },
      { to: '/admin/locacoes/nova', label: 'Novo Contrato', permission: 'rentals.manage' },
      { to: '/admin/locacoes/relatorios', label: 'Relatórios', permission: 'rentals.view' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/admin/gestao', label: 'Painel Gerencial e Metas', permission: 'management.view' },
      { to: '/admin/relatorios', label: 'Relatórios', permission: 'reports.view' },
      { to: '/admin/documentos', label: 'Documentos', permission: 'documents.view' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { to: '/admin/equipe', label: 'Equipe e Permissões', permission: 'team.view' },
      { to: '/admin/integracoes', label: 'Integrações', permission: 'integrations.manage' },
      { to: '/admin/identidade', label: 'Site da Imobiliária', permission: 'integrations.manage' },
      { to: '/admin/saude', label: 'Saúde do Sistema', permission: 'health.view' },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openSections, setOpenSections] = useState({});
  const [unreadInstagram, setUnreadInstagram] = useState(0);
  const [unreadWhatsApp, setUnreadWhatsApp] = useState(0);
  const [access, setAccess] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [switchingOrganization, setSwitchingOrganization] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [entitlement, setEntitlement] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function loadContext() {
    const [accessResult, organizationsResult] = await Promise.all([getAccessContext(), getUserOrganizations()]);
    if (!accessResult.error) {
      setAccess(accessResult.data || null);
      setPublicOrganizationSlug(accessResult.data?.organization_slug);
    }
    if (!organizationsResult.error) setOrganizations(organizationsResult.data || []);
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    Promise.all([getAccessContext(), getUserOrganizations(), isPlatformAdmin(), getSaasEntitlement()]).then(([accessResult, organizationsResult, platformResult, entitlementResult]) => {
      if (!active) return;
      if (!accessResult.error) {
        setAccess(accessResult.data || null);
        setPublicOrganizationSlug(accessResult.data?.organization_slug);
      }
      if (!organizationsResult.error) setOrganizations(organizationsResult.data || []);
      if (!platformResult?.error) setPlatformAdmin(Boolean(platformResult?.data));
      if (!entitlementResult?.error) setEntitlement(entitlementResult?.data || null);
    });
    return () => { active = false; };
  }, []);

  async function handleOrganizationChange(event) {
    const organizationId = event.target.value;
    if (!organizationId || organizationId === access?.organization_id) return;
    setSwitchingOrganization(true);
    const result = await setActiveOrganization(organizationId);
    if (result.error) {
      window.alert(result.error.message || 'Não foi possível trocar de empresa.');
      setSwitchingOrganization(false);
      return;
    }
    await loadContext();
    setSwitchingOrganization(false);
    window.location.reload();
  }

  async function loadUnread() {
    if (!can(access, 'messages.view')) return;
    try {
      const [instagramResult, whatsappResult] = await Promise.all([getUnreadInstagramCount(), getUnreadWhatsAppCount()]);
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
  }, [access, entitlement]);

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const visibleSections = useMemo(() => {
    if (!access) return [];
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: (section.items || []).filter((item) => {
        if (!can(access, item.permission)) return false;
        if (item.permission?.startsWith('rentals.')) return hasSaasFeature(entitlement, 'rentals');
        if (item.permission?.startsWith('financial.')) return hasSaasFeature(entitlement, 'finance');
        if (item.to === '/admin/integracoes') return hasSaasFeature(entitlement, 'integrations');
        return true;
      }),
    })).filter((section) => (section.items || []).length > 0);
  }, [access, entitlement]);

  function sectionIsActive(section) {
    return section.items.some((item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/'));
  }

  function toggleSection(title) {
    setOpenSections((current) => ({ ...current, [title]: !(current[title] ?? false) }));
  }

  function badgeValue(type) {
    const value = type === 'instagram' ? unreadInstagram : type === 'whatsapp' ? unreadWhatsApp : 0;
    if (!value) return null;
    return value > 99 ? '99+' : value;
  }

  const activeTrial = isActiveTrial(entitlement);
  const subscriptionLocked = Boolean(entitlement && entitlement.access_allowed === false && entitlement.plan_code !== 'internal');

  return (
    <div className="admin-shell" style={{'--agency-primary': access?.primary_color || '#A60311', '--agency-secondary': access?.secondary_color || '#590209', '--accent': access?.primary_color || '#A60311', '--accent-2': access?.secondary_color || '#590209', '--crm-red': access?.primary_color || '#A60311', '--crm-red-dark': access?.secondary_color || '#590209'}}>
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        <div className="admin-brand-row">
          <div className="admin-brand">
            <img className="admin-brand-logo" src="/goi-logo.svg" alt="GOI" />
            <div>
              <strong>GOI</strong>
              <small>Gerenciador de Operações Imobiliárias</small>
            </div>
          </div>
          <button
            type="button"
            className="admin-mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>

        <div className="admin-mobile-quick-actions">
          {can(access, 'leads.view') && <NavLink to="/admin/acoes">Rotina de hoje</NavLink>}
          {can(access, 'properties.view') && hasSaasFeature(entitlement, 'valuation_quick') && <NavLink to="/admin/avaliar-imovel">Avaliador de imóveis</NavLink>}
        </div>

        {organizations.length > 1 && (
          <div className="admin-organization-switcher" style={{ padding: '0 16px 16px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Empresa ativa</label>
            <select value={access?.organization_id || ''} onChange={handleOrganizationChange} disabled={switchingOrganization} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: 'inherit' }}>
              {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            </select>
          </div>
        )}

        <nav className="admin-nav admin-nav-compact" aria-label="Menu administrativo" onClick={(event) => {
          if (event.target.closest('a')) setMobileMenuOpen(false);
        }}>
          {can(access, 'dashboard.view') && (
            <NavLink to="/admin" end className="admin-home-link">
              <span>Início</span>
            </NavLink>
          )}

          {can(access, 'properties.view') && hasSaasFeature(entitlement, 'valuation_quick') && (
            <NavLink to="/admin/avaliar-imovel" className="admin-quick-valuation-link">
              <span>Avaliar imóvel</span>
            </NavLink>
          )}

          {platformAdmin && (
            <NavLink to="/admin/plataforma"><span>Administração do GOI</span></NavLink>
          )}

          {can(access, 'financial.view') && hasSaasFeature(entitlement, 'finance') && (
            <NavLink to="/admin/financeiro">
              <span>Financeiro</span>
            </NavLink>
          )}

          {visibleSections.map((section) => {
            const active = sectionIsActive(section);
            const open = openSections[section.title] ?? active;
            const totalBadge = section.items.reduce((sum, item) => sum + Number(item.badge ? (item.badge === 'instagram' ? unreadInstagram : unreadWhatsApp) : 0), 0);
            return (
              <section className={`admin-nav-section admin-nav-group ${active ? 'is-active' : ''}`} key={section.title}>
                <button type="button" className="admin-nav-group-toggle" onClick={() => toggleSection(section.title)} aria-expanded={open}>
                  <span>{section.title}</span>
                  <span className="admin-nav-group-meta">
                    {totalBadge > 0 && <b>{totalBadge > 99 ? '99+' : totalBadge}</b>}
                    <i>{open ? '−' : '+'}</i>
                  </span>
                </button>
                {open && (
                  <div className="admin-nav-section-items admin-nav-submenu">
                    {section.items.map((item) => (
                      <NavLink key={item.to} end={item.end} to={item.to} className={item.badge ? 'admin-nav-with-badge' : undefined}>
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
          <InstallGoiButton />
          <button type="button" onClick={handleLogout}>Sair</button>
        </div>
      </aside>
      <main className="admin-main">
        {access && <NotificationCenter access={access} />}
        {activeTrial && entitlement?.trial_ends_at && <div className="admin-trial-banner">Teste gratuito completo ativo até {new Date(entitlement.trial_ends_at).toLocaleDateString('pt-BR')}. Todas as funções do GOI estão liberadas durante o teste. <NavLink to="/admin/plano">Ver planos</NavLink></div>}
        {subscriptionLocked
          ? <SubscriptionExpired entitlement={entitlement} />
          : <Outlet context={{ access, entitlement }} />}
      </main>
    </div>
  );
}
