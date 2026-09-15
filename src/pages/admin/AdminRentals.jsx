import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../services/crm';
import {
  RENTAL_STATUS_LABELS,
  getRentalContracts,
  getRentalMetrics,
  refreshRentalPaymentStatuses,
} from '../../services/rentals';

const FILTERS = [
  ['all', 'Todos'],
  ['open', 'Em andamento'],
  ['analysis', 'Em análise'],
  ['documents', 'Documentação'],
  ['awaiting_signature', 'Aguardando assinatura'],
  ['active', 'Ativos'],
  ['ending', 'Próximos do fim'],
  ['ended', 'Encerrados'],
  ['cancelled', 'Cancelados'],
];

export default function AdminRentals() {
  const [contracts, setContracts] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    await refreshRentalPaymentStatuses().catch(() => null);
    const [contractsResult, metricsResult] = await Promise.all([
      getRentalContracts(),
      getRentalMetrics(),
    ]);
    if (contractsResult.error || metricsResult.error) {
      setMessage('Não foi possível carregar todos os dados da locação.');
    }
    setContracts(contractsResult.data || []);
    setMetrics(metricsResult.data || {});
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((item) => {
      const statusOk = status === 'all'
        || (status === 'open' && ['analysis','documents','awaiting_signature','active','ending'].includes(item.status))
        || item.status === status;
      if (!statusOk) return false;
      if (!term) return true;
      return [
        item.code,
        item.tenant_name,
        item.tenant_whatsapp,
        item.property?.code,
        item.property?.title,
        item.owner_name,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [contracts, status, search]);

  return (
    <div className="admin-page rentals-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Gestão de locações</span>
          <h1>Locações</h1>
          <p>Contratos, cobranças, vistorias, manutenção e documentos em uma única área.</p>
        </div>
        <Link className="button" to="/admin/locacoes/nova">Novo contrato</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="rental-metrics-grid">
        <article><span>Contratos ativos</span><strong>{metrics.active_contracts || 0}</strong></article>
        <article><span>Aluguel mensal</span><strong>{formatCurrency(metrics.monthly_rent || 0)}</strong></article>
        <article><span>Taxa de administração</span><strong>{formatCurrency(metrics.monthly_management_fee || 0)}</strong></article>
        <article><span>Recebido no mês</span><strong>{formatCurrency(metrics.received_this_month || 0)}</strong></article>
        <article className={(metrics.overdue_count || 0) > 0 ? 'attention' : ''}><span>Em atraso</span><strong>{metrics.overdue_count || 0}</strong><small>{formatCurrency(metrics.overdue_value || 0)}</small></article>
        <article><span>Vencem em 60 dias</span><strong>{metrics.expiring_60_days || 0}</strong></article>
        <article><span>Manutenções abertas</span><strong>{metrics.open_maintenance || 0}</strong></article>
      </div>

      <section className="admin-panel rental-filters">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contrato, locatário ou imóvel..." />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {FILTERS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </section>

      <section className="admin-panel">
        <div className="panel-title-row"><h2>Contratos</h2><span>{filtered.length}</span></div>
        {loading ? <p>Carregando locações...</p> : filtered.length === 0 ? <p>Nenhum contrato encontrado.</p> : (
          <div className="rental-contract-list">
            {filtered.map((item) => (
              <Link className="rental-contract-card" to={`/admin/locacoes/${item.id}`} key={item.id}>
                <div>
                  <div className="rental-contract-topline">
                    <strong>{item.code}</strong>
                    <span className={`rental-status ${item.status}`}>{RENTAL_STATUS_LABELS[item.status] || item.status}</span>
                  </div>
                  <h3>{item.tenant_name}</h3>
                  <p>{item.property ? `${item.property.code} — ${item.property.title}` : 'Imóvel não localizado'}</p>
                  <small>{item.property?.public_location_text || ''}</small>
                </div>
                <div className="rental-contract-side">
                  <strong>{formatCurrency(item.monthly_rent)}</strong>
                  <span>{item.start_date ? formatDate(item.start_date) : 'Sem início'} → {item.end_date ? formatDate(item.end_date) : 'Sem término'}</span>
                  <small>Vencimento: dia {item.due_day || 10}</small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
