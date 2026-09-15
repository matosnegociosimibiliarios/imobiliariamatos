import { supabase } from '../lib/supabase';

export const DOCUMENT_BUCKET = 'crm-documents';

export const DOCUMENT_STATUS_LABELS = {
  pending_review: 'Pendente de conferência',
  approved: 'Conferido',
  rejected: 'Com pendência',
};

export const DOCUMENT_CATEGORY_LABELS = {
  property: 'Imóvel',
  owner: 'Proprietário',
  buyer: 'Comprador',
  seller: 'Vendedor',
  proposal: 'Proposta',
  authorization: 'Autorização',
  contract: 'Contrato',
  deed_registry: 'Escritura / registro',
  finance: 'Financeiro',
  personal: 'Documento pessoal',
  proof: 'Comprovante',
  other: 'Outro',
};

export const DOCUMENT_CONTEXT_LABELS = {
  general: 'Geral',
  property: 'Imóvel',
  lead: 'Cliente',
  capture: 'Captação',
  proposal: 'Proposta',
  deal: 'Negócio fechado',
};

const CONTEXT_COLUMN = {
  property: 'property_id',
  lead: 'lead_id',
  capture: 'capture_id',
  proposal: 'proposal_id',
  deal: 'deal_id',
};

const CHECKLIST_COLUMN = {
  property: 'property_document_id',
  capture: 'capture_document_id',
  deal: 'deal_document_id',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv',
]);

function safeFilename(name = 'arquivo') {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'arquivo';
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function validateDocumentFile(file) {
  if (!file) return 'Selecione um arquivo.';
  if (file.size > MAX_FILE_SIZE) return 'O arquivo ultrapassa o limite de 20 MB.';
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return 'Formato não permitido. Use PDF, imagem, Word, Excel, TXT ou CSV.';
  }
  return '';
}

function contextPayload(contextType, contextId) {
  const payload = {
    property_id: null,
    lead_id: null,
    capture_id: null,
    proposal_id: null,
    deal_id: null,
  };

  const column = CONTEXT_COLUMN[contextType];
  if (column && contextId) payload[column] = contextId;
  return payload;
}

function checklistPayload(contextType, checklistId) {
  const payload = {
    property_document_id: null,
    capture_document_id: null,
    deal_document_id: null,
  };

  const column = CHECKLIST_COLUMN[contextType];
  if (column && checklistId) payload[column] = checklistId;
  return payload;
}

export async function uploadCrmDocuments(files, metadata = {}) {
  const fileList = Array.from(files || []);
  if (fileList.length === 0) return { data: [], error: new Error('Selecione pelo menos um arquivo.') };

  for (const file of fileList) {
    const validationError = validateDocumentFile(file);
    if (validationError) return { data: [], error: new Error(`${file.name}: ${validationError}`) };
  }

  const uploaded = [];
  const baseContext = metadata.contextType && metadata.contextType !== 'general'
    ? metadata.contextType
    : 'geral';
  const contextId = metadata.contextId || 'sem-vinculo';

  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index];
    const storagePath = `${baseContext}/${contextId}/${Date.now()}-${randomId()}-${safeFilename(file.name)}`;

    const { error: storageError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (storageError) return { data: uploaded, error: storageError };

    const baseTitle = metadata.title?.trim() || file.name;
    const title = fileList.length > 1 ? `${baseTitle} (${index + 1})` : baseTitle;

    const payload = {
      title,
      category: metadata.category || 'other',
      status: metadata.status || 'pending_review',
      notes: metadata.notes?.trim() || null,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      issued_at: metadata.issuedAt || null,
      expires_at: metadata.expiresAt || null,
      ...contextPayload(metadata.contextType, metadata.contextId),
      ...checklistPayload(metadata.contextType, metadata.checklistId),
    };

    const { data, error } = await supabase
      .from('crm_documents')
      .insert(payload)
      .select()
      .single();

    if (error) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      return { data: uploaded, error };
    }

    uploaded.push(data);
  }

  return { data: uploaded, error: null };
}

export async function getDocuments(options = {}) {
  let query = supabase
    .from('crm_documents')
    .select(`
      *,
      property:properties(id,code,title,slug),
      lead:leads(id,name,whatsapp,email),
      capture:owner_captures(id,owner_name,whatsapp,city_name,property_type),
      proposal:proposals(id,code,status,lead_id,property_id),
      deal:deals(id,code,status,lead_id,property_id)
    `)
    .order('created_at', { ascending: false });

  if (options.contextType && options.contextType !== 'general') {
    const column = CONTEXT_COLUMN[options.contextType];
    if (column && options.contextId) query = query.eq(column, options.contextId);
  }

  if (options.status) query = query.eq('status', options.status);
  if (options.category) query = query.eq('category', options.category);

  return query;
}

export async function getContextDocuments(contextType, contextId) {
  return getDocuments({ contextType, contextId });
}

export async function updateCrmDocument(documentId, payload) {
  return supabase
    .from('crm_documents')
    .update(payload)
    .eq('id', documentId)
    .select()
    .single();
}

export async function deleteCrmDocument(document) {
  if (!document?.id) return { error: new Error('Documento inválido.') };

  if (document.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .remove([document.storage_path]);
    if (storageError) return { error: storageError };
  }

  return supabase.from('crm_documents').delete().eq('id', document.id);
}

export async function createDocumentSignedUrl(document, expiresIn = 600) {
  if (!document?.storage_path) return { data: null, error: new Error('Arquivo não encontrado.') };
  return supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, expiresIn);
}

export async function downloadCrmDocument(document) {
  if (!document?.storage_path) return { data: null, error: new Error('Arquivo não encontrado.') };
  return supabase.storage.from(DOCUMENT_BUCKET).download(document.storage_path);
}

export async function getDocumentTargets() {
  const [properties, leads, captures, proposals, deals] = await Promise.all([
    supabase.from('properties').select('id,code,title').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('leads').select('id,name,whatsapp,email').order('created_at', { ascending: false }).limit(500),
    supabase.from('owner_captures').select('id,owner_name,city_name,property_type').order('created_at', { ascending: false }).limit(500),
    supabase.from('proposals').select('id,code,status,lead:leads(name),property:properties(code,title)').order('created_at', { ascending: false }).limit(500),
    supabase.from('deals').select('id,code,status,lead:leads(name),property:properties(code,title)').order('created_at', { ascending: false }).limit(500),
  ]);

  const error = properties.error || leads.error || captures.error || proposals.error || deals.error;
  if (error) return { data: null, error };

  return {
    data: {
      property: (properties.data || []).map((item) => ({ id: item.id, label: `${item.code} — ${item.title}` })),
      lead: (leads.data || []).map((item) => ({ id: item.id, label: item.name || item.whatsapp || item.email || 'Cliente' })),
      capture: (captures.data || []).map((item) => ({
        id: item.id,
        label: `${item.owner_name || 'Proprietário'} — ${[item.property_type, item.city_name].filter(Boolean).join(' · ') || 'Captação'}`,
      })),
      proposal: (proposals.data || []).map((item) => ({
        id: item.id,
        label: `${item.code} — ${item.lead?.name || 'Cliente'}${item.property ? ` — ${item.property.code}` : ''}`,
      })),
      deal: (deals.data || []).map((item) => ({
        id: item.id,
        label: `${item.code} — ${item.lead?.name || 'Cliente'}${item.property ? ` — ${item.property.code}` : ''}`,
      })),
    },
    error: null,
  };
}

export async function getContextChecklist(contextType, contextId) {
  if (!contextId) return { data: [], error: null };

  if (contextType === 'property') {
    return supabase
      .from('property_documents')
      .select('id,label,status,doc_key,display_order')
      .eq('property_id', contextId)
      .order('display_order');
  }

  if (contextType === 'capture') {
    return supabase
      .from('capture_documents')
      .select('id,label,status,document_type')
      .eq('capture_id', contextId)
      .order('label');
  }

  if (contextType === 'deal') {
    return supabase
      .from('deal_documents')
      .select('id,label,status,party,doc_key,display_order')
      .eq('deal_id', contextId)
      .order('party')
      .order('display_order');
  }

  return { data: [], error: null };
}

export async function getChecklistPendencies() {
  const [properties, captures, deals] = await Promise.all([
    supabase
      .from('property_documents')
      .select('id,label,status,property_id,property:properties(id,code,title)')
      .eq('status', 'pending')
      .limit(300),
    supabase
      .from('capture_documents')
      .select('id,label,status,capture_id,capture:owner_captures(id,owner_name,city_name,property_type)')
      .eq('status', 'pending')
      .limit(300),
    supabase
      .from('deal_documents')
      .select('id,label,status,party,deal_id,deal:deals(id,code,lead:leads(name),property:properties(code,title))')
      .eq('status', 'pending')
      .limit(300),
  ]);

  const error = properties.error || captures.error || deals.error;
  if (error) return { data: [], error };

  const data = [
    ...(properties.data || []).map((item) => ({
      id: `property-${item.id}`,
      kind: 'property',
      context_id: item.property_id,
      label: item.label,
      context_label: item.property ? `${item.property.code} — ${item.property.title}` : 'Imóvel',
      href: `/admin/imoveis/${item.property_id}/gestao`,
    })),
    ...(captures.data || []).map((item) => ({
      id: `capture-${item.id}`,
      kind: 'capture',
      context_id: item.capture_id,
      label: item.label,
      context_label: item.capture?.owner_name || 'Captação',
      href: `/admin/captacoes/${item.capture_id}`,
    })),
    ...(deals.data || []).map((item) => ({
      id: `deal-${item.id}`,
      kind: 'deal',
      context_id: item.deal_id,
      label: item.label,
      context_label: item.deal ? `${item.deal.code} — ${item.deal.lead?.name || 'Cliente'}` : 'Negócio',
      href: `/admin/negocios/${item.deal_id}`,
    })),
  ];

  return { data, error: null };
}

export async function getDocumentAlerts(daysAhead = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = new Date(today);
  future.setDate(future.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('crm_documents')
    .select(`
      *,
      property:properties(id,code,title),
      lead:leads(id,name),
      capture:owner_captures(id,owner_name),
      proposal:proposals(id,code),
      deal:deals(id,code)
    `)
    .or(`expires_at.lte.${future.toISOString().slice(0, 10)},status.eq.rejected`)
    .order('expires_at', { ascending: true, nullsFirst: false });

  if (error) return { data: [], error };

  const alerts = (data || []).map((item) => {
    const expiry = item.expires_at ? new Date(`${item.expires_at}T23:59:59`) : null;
    let alert_type = 'rejected';
    let alert_label = 'Documento com pendência';
    if (expiry) {
      if (expiry < today) {
        alert_type = 'expired';
        alert_label = 'Documento vencido';
      } else if (expiry <= future) {
        alert_type = 'expiring';
        const days = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / 86400000));
        alert_label = `Vence em ${days} dia${days === 1 ? '' : 's'}`;
      }
    }
    if (item.status === 'rejected' && alert_type !== 'expired') {
      alert_type = 'rejected';
      alert_label = 'Documento com pendência';
    }
    return { ...item, alert_type, alert_label };
  });

  return { data: alerts, error: null };
}

export function documentContext(document) {
  if (document.property_id) {
    return {
      type: 'property',
      label: document.property ? `${document.property.code} — ${document.property.title}` : 'Imóvel',
      href: `/admin/imoveis/${document.property_id}/gestao`,
    };
  }
  if (document.lead_id) {
    return { type: 'lead', label: document.lead?.name || 'Cliente', href: `/admin/leads/${document.lead_id}` };
  }
  if (document.capture_id) {
    return { type: 'capture', label: document.capture?.owner_name || 'Captação', href: `/admin/captacoes/${document.capture_id}` };
  }
  if (document.proposal_id) {
    return { type: 'proposal', label: document.proposal?.code || 'Proposta', href: `/admin/propostas/${document.proposal_id}` };
  }
  if (document.deal_id) {
    return { type: 'deal', label: document.deal?.code || 'Negócio fechado', href: `/admin/negocios/${document.deal_id}` };
  }
  return { type: 'general', label: 'Arquivo geral', href: '/admin/documentos' };
}

export function documentExpiryState(expiresAt) {
  if (!expiresAt) return { state: 'none', label: 'Sem validade' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiresAt}T23:59:59`);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { state: 'expired', label: `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}` };
  if (days === 0) return { state: 'expiring', label: 'Vence hoje' };
  if (days <= 30) return { state: 'expiring', label: `Vence em ${days} dia${days === 1 ? '' : 's'}` };
  return { state: 'ok', label: `Válido até ${new Date(`${expiresAt}T12:00:00`).toLocaleDateString('pt-BR')}` };
}
