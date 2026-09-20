import { getCurrentSession } from './auth';

export async function getWhatsAppMetaConfig() {
  const response = await fetch('/api/meta-whatsapp-config');
  if (!response.ok) throw new Error('Não foi possível carregar a configuração do WhatsApp.');
  return response.json();
}

export async function completeWhatsAppEmbeddedSignup({ code, wabaId, phoneNumberId, displayPhoneNumber, sessionEvent }) {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Sessão administrativa expirada.');

  const response = await fetch('/api/whatsapp-onboarding', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      waba_id: wabaId || null,
      phone_number_id: phoneNumberId || null,
      display_phone_number: displayPhoneNumber || null,
      session_event: sessionEvent || null,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a conexão do WhatsApp.');
  return data;
}
