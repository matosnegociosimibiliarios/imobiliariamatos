export const LEAD_STATUSES = [
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contatado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'visit_scheduled', label: 'Visita' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'won', label: 'Fechado' },
  { value: 'lost', label: 'Perdido' },
];

export const STATUS_LABELS = Object.fromEntries(
  LEAD_STATUSES.map((item) => [item.value, item.label])
);

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

export function formatDateTime(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function toDateTimeLocal(value) {
  if (!value) return '';

  const date = new Date(value);

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

export function makeWhatsAppUrl(phone, name = '') {
  const digits = String(phone || '').replace(/\D/g, '');

  if (!digits) return null;

  const normalized =
    digits.length === 10 || digits.length === 11
      ? `55${digits}`
      : digits;

  const text = encodeURIComponent(
    name
      ? `Olá, ${name}. Aqui é da Matos Negócios Imobiliários.`
      : 'Olá. Aqui é da Matos Negócios Imobiliários.'
  );

  return `https://wa.me/${normalized}?text=${text}`;
}


export const ORIGIN_PLATFORM_LABELS = {
  site: 'Site',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  meta: 'Meta',
  manual: 'Manual',
};

export const ORIGIN_CHANNEL_LABELS = {
  form: 'Formulário',
  property_form: 'Formulário do imóvel',
  direct: 'Direct',
  lead_ads: 'Formulário de anúncio',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
  manual: 'Cadastro manual',
};

export function originLabel(platform, channel, detail = null) {
  const p = ORIGIN_PLATFORM_LABELS[platform] || platform || 'Não informada';
  const c = ORIGIN_CHANNEL_LABELS[channel] || channel || null;

  if (detail && detail !== c) return `${p} · ${c || detail}`;
  return c ? `${p} · ${c}` : p;
}
