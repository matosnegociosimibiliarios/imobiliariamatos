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
