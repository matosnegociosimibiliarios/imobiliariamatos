import React, { useEffect, useMemo, useState } from 'react';
import {
  MEMBER_STATUS_LABELS,
  PERMISSION_CATALOG,
  ROLE_LABELS,
  getAccessContext,
  getRecentTeamActivity,
  getTeamMembers,
  getPortfolioSummary,
  transferTeamPortfolio,
  inviteTeamMember,
  updateTeamMember,
} from '../../services/team';
import { clearPermissionCache } from '../../components/PermissionRoute';

const ACTION_LABELS = { INSERT: 'criou', UPDATE: 'alterou', DELETE: 'excluiu' };
const TABLE_LABELS = {
  leads: 'cliente',
  properties: 'imóvel',
  appointments: 'agendamento',
  owner_captures: 'captação',
  proposals: 'proposta',
  deals: 'negócio',
  crm_documents: 'documento',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function MemberCard({ member, currentAccess, onSaved }) {
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const [overrides, setOverrides] = useState(member.permissions || {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const isSelf = member.user_id === currentAccess?.user_id;
  const isOwner = member.role === 'owner';
  const canEditOwner = currentAccess?.role === 'owner';

  async function save() {
    setSaving(true);
    setMessage('');
    const result = await updateTeamMember(member.id, {
      role,
      status,
      permissions: overrides,
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível salvar.');
    else {
      clearPermissionCache();
      setMessage('Permissões atualizadas.');
      onSaved?.();
    }
    setSaving(false);
  }

  function setOverride(key, value) {
    setOverrides((current) => ({ ...current, [key]: value }));
  }

  function clearOverride(key) {
    setOverrides((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of PERMISSION_CATALOG) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group).push(item);
    }
    return [...map.entries()];
  }, []);

  return (
    <article className="team-member-card">
      <div className="team-member-head">
        <div>
          <strong>{member.profile?.full_name || 'Usuário sem nome'}</strong>
          <span>{member.profile?.email || 'E-mail não informado'}</span>
          <small>{MEMBER_STATUS_LABELS[member.status] || member.status} · adicionado em {formatDate(member.created_at)}</small>
        </div>
        <span className={`team-role-badge ${member.role}`}>{ROLE_LABELS[member.role] || member.role}</span>
      </div>

      <div className="team-member-controls">
        <label>Função
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={saving || (isOwner && !canEditOwner)}>
            {currentAccess?.role === 'owner' && <option value="owner">Proprietário</option>}
            <option value="admin">Administrador</option>
            <option value="broker">Corretor</option>
            <option value="assistant">Assistente</option>
          </select>
        </label>
        <label>Situação
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saving || (isOwner && !canEditOwner) || isSelf}>
            <option value="active">Ativo</option>
            <option value="invited">Convidado</option>
            <option value="disabled">Desativado</option>
          </select>
        </label>
      </div>

      <details className="team-permissions-details">
        <summary>Permissões personalizadas</summary>
        <p>Deixe como “Padrão da função” para usar a configuração normal. Use exceções somente quando necessário.</p>
        <div className="team-permission-groups">
          {groups.map(([group, items]) => (
            <div key={group} className="team-permission-group">
              <strong>{group}</strong>
              {items.map((item) => {
                const current = Object.prototype.hasOwnProperty.call(overrides, item.key)
                  ? String(Boolean(overrides[item.key]))
                  : 'default';
                return (
                  <label key={item.key}>
                    <span>{item.label}</span>
                    <select value={current} onChange={(e) => {
                      if (e.target.value === 'default') clearOverride(item.key);
                      else setOverride(item.key, e.target.value === 'true');
                    }} disabled={saving}>
                      <option value="default">Padrão da função</option>
                      <option value="true">Permitir</option>
                      <option value="false">Bloquear</option>
                    </select>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </details>

      <div className="team-member-footer">
        {message && <span>{message}</span>}
        <button type="button" className="button" onClick={save} disabled={saving || (isOwner && !canEditOwner)}>
          {saving ? 'Salvando...' : 'Salvar acesso'}
        </button>
      </div>
    </article>
  );
}


const PORTFOLIO_TYPES = [
  { key: 'leads', label: 'Clientes' },
  { key: 'properties', label: 'Imóveis' },
  { key: 'appointments', label: 'Agendamentos' },
  { key: 'captures', label: 'Captações' },
  { key: 'proposals', label: 'Propostas' },
  { key: 'deals', label: 'Negócios fechados' },
];

function TransferPortfolioPanel({ members, access, onTransferred }) {
  const eligibleSources = members.filter((member) => member.user_id && member.status !== 'invited');
  const activeTargets = members.filter((member) => member.user_id && member.status === 'active');
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [message, setMessage] = useState('');
  const [resources, setResources] = useState({
    leads: true,
    properties: true,
    appointments: true,
    captures: true,
    proposals: true,
    deals: true,
  });

  const fromMember = members.find((member) => member.user_id === fromUserId);
  const toMember = members.find((member) => member.user_id === toUserId);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      setMessage('');
      setSummary(null);
      if (!fromUserId) return;
      setLoadingSummary(true);
      const result = await getPortfolioSummary(fromUserId);
      if (!cancelled) {
        if (result.error) setMessage(result.error.message || 'Não foi possível consultar a carteira.');
        else setSummary(result.data || {});
        setLoadingSummary(false);
      }
    }
    loadSummary();
    return () => { cancelled = true; };
  }, [fromUserId]);

  if (!['owner', 'admin'].includes(access?.role)) return null;

  const selectedCount = PORTFOLIO_TYPES.filter((item) => resources[item.key]).length;
  const estimatedTotal = PORTFOLIO_TYPES.reduce((sum, item) => {
    if (!resources[item.key]) return sum;
    return sum + Number(summary?.[item.key] || 0);
  }, 0);

  function toggleAll(value) {
    setResources(Object.fromEntries(PORTFOLIO_TYPES.map((item) => [item.key, value])));
  }

  async function transfer() {
    setMessage('');
    if (!fromUserId || !toUserId) {
      setMessage('Escolha quem entrega a carteira e quem vai receber.');
      return;
    }
    if (fromUserId === toUserId) {
      setMessage('Escolha usuários diferentes para origem e destino.');
      return;
    }
    if (!selectedCount) {
      setMessage('Selecione pelo menos um tipo de carteira.');
      return;
    }

    const sourceName = fromMember?.profile?.full_name || fromMember?.profile?.email || 'usuário de origem';
    const targetName = toMember?.profile?.full_name || toMember?.profile?.email || 'usuário de destino';
    const confirmation = window.confirm(
      `Transferir ${estimatedTotal} registro(s) selecionado(s) de ${sourceName} para ${targetName}?\n\nO histórico será preservado.`
    );
    if (!confirmation) return;

    setTransferring(true);
    const result = await transferTeamPortfolio({ fromUserId, toUserId, resources });
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível transferir a carteira.');
      setTransferring(false);
      return;
    }

    const total = Number(result.data?.total || 0);
    setMessage(total
      ? `Carteira transferida: ${total} registro(s) movido(s).`
      : 'Transferência concluída. Não havia registros nos tipos selecionados.');

    const refreshed = await getPortfolioSummary(fromUserId);
    if (!refreshed.error) setSummary(refreshed.data || {});
    setTransferring(false);
    onTransferred?.();
  }

  return (
    <section className="admin-card portfolio-transfer-panel">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Gestão da equipe</span>
          <h2>Transferir carteira</h2>
          <p>Mova clientes, imóveis e outros registros de um corretor para outro sem perder o histórico.</p>
        </div>
      </div>

      <div className="portfolio-transfer-users">
        <label>Quem entrega a carteira
          <select value={fromUserId} onChange={(e) => {
            setFromUserId(e.target.value);
            if (e.target.value === toUserId) setToUserId('');
          }}>
            <option value="">Selecione o usuário</option>
            {eligibleSources.map((member) => (
              <option key={member.id} value={member.user_id}>
                {member.profile?.full_name || member.profile?.email || 'Usuário'} · {ROLE_LABELS[member.role] || member.role}
                {member.status === 'disabled' ? ' · Desativado' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="portfolio-transfer-arrow" aria-hidden="true">→</div>

        <label>Quem recebe a carteira
          <select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            <option value="">Selecione o usuário</option>
            {activeTargets.filter((member) => member.user_id !== fromUserId).map((member) => (
              <option key={member.id} value={member.user_id}>
                {member.profile?.full_name || member.profile?.email || 'Usuário'} · {ROLE_LABELS[member.role] || member.role}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fromUserId && (
        <div className="portfolio-transfer-body">
          <div className="portfolio-transfer-headline">
            <strong>O que será transferido</strong>
            <div>
              <button type="button" className="text-button" onClick={() => toggleAll(true)}>Selecionar tudo</button>
              <button type="button" className="text-button" onClick={() => toggleAll(false)}>Limpar</button>
            </div>
          </div>

          {loadingSummary ? (
            <p>Consultando carteira...</p>
          ) : (
            <div className="portfolio-transfer-grid">
              {PORTFOLIO_TYPES.map((item) => (
                <label key={item.key} className={`portfolio-transfer-item ${resources[item.key] ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(resources[item.key])}
                    onChange={(e) => setResources((current) => ({ ...current, [item.key]: e.target.checked }))}
                  />
                  <span>{item.label}</span>
                  <strong>{Number(summary?.[item.key] || 0)}</strong>
                </label>
              ))}
            </div>
          )}

          <div className="portfolio-transfer-footer">
            <div>
              <span>{estimatedTotal} registro(s) selecionado(s)</span>
              <small>A transferência troca apenas o responsável. Clientes, imóveis e históricos continuam intactos.</small>
            </div>
            <button type="button" className="button" onClick={transfer} disabled={transferring || loadingSummary || !fromUserId || !toUserId || !selectedCount}>
              {transferring ? 'Transferindo...' : 'Transferir carteira'}
            </button>
          </div>
          {message && <div className="admin-message compact">{message}</div>}
        </div>
      )}
    </section>
  );
}

export default function AdminTeam() {
  const [access, setAccess] = useState(null);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'broker' });

  async function load() {
    setLoading(true);
    const [accessResult, membersResult, activityResult] = await Promise.all([
      getAccessContext(),
      getTeamMembers(),
      getRecentTeamActivity(60),
    ]);
    if (accessResult.data) setAccess(accessResult.data);
    if (!membersResult.error) setMembers(membersResult.data || []);
    if (!activityResult.error) setActivity(activityResult.data || []);

    const loadError = membersResult.error || activityResult.error || accessResult.error;
    if (loadError) {
      const text = String(loadError.message || '');
      setMessage(text.includes('502') || text.includes('Bad Gateway')
        ? 'O Supabase oscilou ao carregar a equipe. Atualize a página ou tente novamente em alguns segundos.'
        : `Não foi possível carregar toda a equipe: ${text || 'erro desconhecido'}`);
    } else {
      setMessage((current) => current.startsWith('O Supabase oscilou') || current.startsWith('Não foi possível carregar') ? '' : current);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function invite(event) {
    event.preventDefault();
    setMessage('');
    if (!form.fullName.trim() || !form.email.trim()) {
      setMessage('Informe nome e e-mail.');
      return;
    }
    setInviting(true);
    try {
      const result = await inviteTeamMember(form);
      setMessage(result.existing
        ? 'Usuário existente adicionado à equipe.'
        : 'Convite enviado por e-mail.');
      setForm({ fullName: '', email: '', role: 'broker' });
      await load();
    } catch (error) {
      setMessage(error.message || 'Não foi possível enviar o convite.');
    } finally {
      setInviting(false);
    }
  }

  if (loading) return <div className="admin-loading">Carregando equipe...</div>;

  return (
    <div className="admin-page team-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Versão 10.15 · Gestão da equipe</span>
          <h1>Equipe e permissões</h1>
          <p>Controle quem entra no CRM, o que cada pessoa pode acessar e quem fez cada alteração.</p>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <section className="team-summary-grid">
        <article className="admin-card"><span>Empresa</span><strong>{access?.organization_name || '—'}</strong></article>
        <article className="admin-card"><span>Plano interno</span><strong>{access?.plan_code || '—'}</strong></article>
        <article className="admin-card"><span>Usuários</span><strong>{members.length}</strong></article>
        <article className="admin-card"><span>Ativos</span><strong>{members.filter((m) => m.status === 'active').length}</strong></article>
      </section>

      <section className="admin-card team-invite-panel">
        <div>
          <span className="eyebrow">Novo acesso</span>
          <h2>Convidar usuário</h2>
          <p>A pessoa receberá um e-mail para criar a senha. Depois terá somente as áreas liberadas para a função escolhida.</p>
        </div>
        <form onSubmit={invite} className="team-invite-form">
          <label>Nome completo<input value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} /></label>
          <label>E-mail<input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></label>
          <label>Função
            <select value={form.role} onChange={(e) => setForm((c) => ({ ...c, role: e.target.value }))}>
              {access?.role === 'owner' && <option value="admin">Administrador</option>}
              <option value="broker">Corretor</option>
              <option value="assistant">Assistente</option>
            </select>
          </label>
          <button className="button" disabled={inviting}>{inviting ? 'Enviando...' : 'Enviar convite'}</button>
        </form>
      </section>

      <section className="team-members-section">
        <div className="panel-title-row">
          <div><span className="eyebrow">Acessos</span><h2>Usuários da empresa</h2></div>
        </div>
        <div className="team-member-list">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} currentAccess={access} onSaved={load} />
          ))}
        </div>
      </section>

      <TransferPortfolioPanel members={members} access={access} onTransferred={load} />

      <section className="admin-card team-role-help">
        <h2>Funções padrão</h2>
        <div className="team-role-grid">
          <div><strong>Proprietário</strong><span>Controle total, inclusive equipe e futura assinatura do sistema.</span></div>
          <div><strong>Administrador</strong><span>Opera todo o CRM e gerencia usuários, sem poder retirar o último proprietário.</span></div>
          <div><strong>Corretor</strong><span>Clientes, imóveis, captações, visitas, propostas, mensagens, documentos e relatórios.</span></div>
          <div><strong>Assistente</strong><span>Atendimento, agenda, captações e documentos, sem acesso financeiro ou configurações críticas.</span></div>
        </div>
      </section>

      <section className="admin-card team-activity-panel">
        <div className="panel-title-row"><div><span className="eyebrow">Auditoria</span><h2>Atividade recente</h2></div></div>
        <div className="team-activity-list">
          {activity.length === 0 && <p>Nenhuma alteração registrada ainda.</p>}
          {activity.map((item) => (
            <div key={item.id}>
              <span className="team-activity-dot" />
              <div>
                <strong>{item.actor?.full_name || item.actor?.email || 'Sistema'}</strong>
                <p>{ACTION_LABELS[item.action] || item.action.toLowerCase()} {TABLE_LABELS[item.table_name] || item.table_name}</p>
                <small>{formatDate(item.created_at)}{Array.isArray(item.changed_fields) && item.changed_fields.length ? ` · campos: ${item.changed_fields.join(', ')}` : ''}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card team-saas-note">
        <span className="eyebrow">Preparação para comercialização</span>
        <h2>Base multiempresa criada, migração completa fica para a fase SaaS</h2>
        <p>Esta versão já cria a entidade “empresa/organização”, usuários por empresa, funções, permissões e auditoria. Os registros atuais continuam no ambiente único da Matos. Antes de vender o CRM para outras imobiliárias, faremos a migração que adiciona o identificador da empresa em todos os dados e garante isolamento total entre clientes.</p>
      </section>
    </div>
  );
}
