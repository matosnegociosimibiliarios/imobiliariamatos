import { supabase } from '../lib/supabase';
import { getSessionId } from './tracking';

export const CAPTURE_STATUSES = [
  { value: 'new', label: 'Novo contato' },
  { value: 'evaluation', label: 'Avaliação' },
  { value: 'documents', label: 'Documentação' },
  { value: 'authorized', label: 'Autorizado' },
  { value: 'published', label: 'Publicado' },
  { value: 'lost', label: 'Perdido' },
];

export const CAPTURE_STATUS_LABELS = Object.fromEntries(
  CAPTURE_STATUSES.map((item) => [item.value, item.label])
);

export async function submitOwnerCapture(payload) {
  return supabase
    .from('owner_captures')
    .insert({
      owner_name: payload.owner_name.trim(),
      whatsapp: payload.whatsapp.trim(),
      email: payload.email?.trim() || null,
      request_type: payload.request_type,
      purpose: payload.purpose,
      property_type: payload.property_type,
      city_name: payload.city_name.trim(),
      state_code: (payload.state_code || 'MG').trim().toUpperCase(),
      neighborhood_name: payload.neighborhood_name?.trim() || null,
      address_text: payload.address_text?.trim() || null,
      asking_value:
        payload.asking_value === '' || payload.asking_value == null
          ? null
          : Number(payload.asking_value),
      description: payload.description?.trim() || null,
      source: 'site',
      session_id: getSessionId(),
      consent_at: new Date().toISOString(),
    });
}
