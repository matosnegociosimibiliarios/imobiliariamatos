import { supabase } from '../lib/supabase';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function withSupabaseRetry(operation, attempts = 3) {
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await operation();
    const status = Number(lastResult?.status || 0);
    const retryable = Boolean(lastResult?.error) && [429, 502, 503, 504].includes(status);
    if (!retryable || attempt === attempts) return lastResult;
    await wait(250 * attempt);
  }
  return lastResult;
}

export const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Administrador',
  broker: 'Corretor',
  assistant: 'Assistente',
};

export const MEMBER_STATUS_LABELS = {
  invited: 'Convidado',
  active: 'Ativo',
  disabled: 'Desativado',
};

export const PERMISSION_CATALOG = [
  { key: 'dashboard.view', label: 'Ver visão geral', group: 'Geral' },
  { key: 'management.view', label: 'Ver painel gerencial', group: 'Geral' },
  { key: 'reports.view', label: 'Ver relatórios', group: 'Geral' },
  { key: 'properties.view', label: 'Ver imóveis', group: 'Imóveis' },
  { key: 'properties.manage', label: 'Cadastrar e editar imóveis', group: 'Imóveis' },
  { key: 'leads.view', label: 'Ver clientes', group: 'Clientes' },
  { key: 'leads.manage', label: 'Editar clientes e funil', group: 'Clientes' },
  { key: 'appointments.view', label: 'Ver agendamentos', group: 'Atendimento' },
  { key: 'appointments.manage', label: 'Editar agendamentos', group: 'Atendimento' },
  { key: 'captures.view', label: 'Ver captações', group: 'Imóveis' },
  { key: 'captures.manage', label: 'Editar captações', group: 'Imóveis' },
  { key: 'proposals.view', label: 'Ver propostas', group: 'Comercial' },
  { key: 'proposals.manage', label: 'Criar e editar propostas', group: 'Comercial' },
  { key: 'deals.view', label: 'Ver negócios fechados', group: 'Comercial' },
  { key: 'deals.manage', label: 'Editar negócios fechados', group: 'Comercial' },
  { key: 'financial.view', label: 'Ver comissões e valores financeiros', group: 'Financeiro' },
  { key: 'rentals.view', label: 'Ver locações', group: 'Locação' },
  { key: 'rentals.manage', label: 'Criar e editar locações', group: 'Locação' },
  { key: 'documents.view', label: 'Ver documentos', group: 'Documentos' },
  { key: 'documents.manage', label: 'Enviar e editar documentos', group: 'Documentos' },
  { key: 'messages.view', label: 'Ver mensagens', group: 'Atendimento' },
  { key: 'messages.respond', label: 'Responder mensagens', group: 'Atendimento' },
  { key: 'integrations.manage', label: 'Gerenciar integrações', group: 'Sistema' },
  { key: 'health.view', label: 'Ver saúde do sistema', group: 'Sistema' },
  { key: 'team.view', label: 'Ver equipe', group: 'Equipe' },
  { key: 'team.manage', label: 'Convidar e gerenciar usuários', group: 'Equipe' },
];

export async function getAccessContext() {
  const result = await withSupabaseRetry(() => supabase.rpc('current_access_context'));
  return { data: result?.data || null, error: result?.error || null, status: result?.status };
}

export function can(access, permission) {
  if (access?.role === 'owner') return true;
  return Boolean(access?.permissions?.[permission]);
}

export async function getTeamMembers() {
  const result = await withSupabaseRetry(() => supabase.rpc('organization_team_members'));
  return {
    data: Array.isArray(result?.data) ? result.data : [],
    error: result?.error || null,
    status: result?.status,
  };
}

export async function getAssignableMembers() {
  const { data, error } = await getTeamMembers();
  if (error) return { data: [], error };
  return {
    data: (data || []).filter((member) => member.status === 'active'),
    error: null,
  };
}

export async function inviteTeamMember({ fullName, email, role }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente no painel.');

  const response = await fetch('/api/team-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ full_name: fullName, email, role }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Não foi possível convidar o usuário.');
  }
  return payload;
}

export async function updateTeamMember(memberId, payload) {
  return supabase
    .from('organization_members')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .select(`
      id,organization_id,user_id,role,status,permissions,updated_at,
      profile:profiles(id,full_name,email,last_seen_at)
    `)
    .single();
}

export async function getRecentTeamActivity(limit = 80) {
  return withSupabaseRetry(() => supabase
    .from('team_activity_log')
    .select(`
      id,table_name,record_id,action,changed_fields,created_at,actor_user_id,
      actor:profiles!team_activity_log_actor_user_id_fkey(id,full_name,email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit));
}

export async function assignRecord(table, id, userId) {
  const allowed = new Set(['leads', 'properties', 'appointments', 'owner_captures', 'proposals', 'deals']);
  if (!allowed.has(table)) throw new Error('Tipo de registro inválido.');

  return supabase
    .from(table)
    .update({ assigned_to: userId || null })
    .eq('id', id)
    .select('id,assigned_to,assigned_by,assigned_at')
    .single();
}
