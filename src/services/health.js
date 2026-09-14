import { supabase, supabaseConfigured } from '../lib/supabase';

const BACKUP_TABLES = [
  'profiles',
  'cities',
  'neighborhoods',
  'properties',
  'property_images',
  'property_management',
  'property_price_history',
  'property_status_history',
  'property_documents',
  'leads',
  'lead_notes',
  'lead_status_history',
  'lead_source_history',
  'lead_preferences',
  'lead_property_matches',
  'appointments',
  'owner_captures',
  'capture_notes',
  'capture_status_history',
  'capture_documents',
  'proposals',
  'proposal_status_history',
  'deals',
  'deal_status_history',
  'deal_documents',
  'crm_documents',
  'social_messages',
  'integration_events',
  'response_templates',
  'crm_monthly_goals',
];

export async function getAuthenticatedHealth() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado no navegador.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sessão administrativa não encontrada.');

  const response = await fetch('/api/system-health', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Falha no diagnóstico (${response.status}).`);
  return data;
}

async function fetchTable(table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function createOperationalBackup({ onProgress } = {}) {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase não configurado.');

  const backup = {
    product: 'Matos Negócios Imobiliários',
    type: 'backup-operacional-json',
    version: '10.13',
    generated_at: new Date().toISOString(),
    tables: {},
    errors: {},
  };

  for (let index = 0; index < BACKUP_TABLES.length; index += 1) {
    const table = BACKUP_TABLES[index];
    onProgress?.({ table, index: index + 1, total: BACKUP_TABLES.length });
    try {
      backup.tables[table] = await fetchTable(table);
    } catch (error) {
      backup.errors[table] = error?.message || String(error);
    }
  }

  return backup;
}

export function downloadBackupJson(backup) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `matos-crm-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getLastLocalAppError() {
  try {
    const value = localStorage.getItem('matos:last_app_error');
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
