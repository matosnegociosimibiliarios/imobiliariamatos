import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDealMetrics, getDeals } from '../../services/admin';
import {
  COMMISSION_STATUS_LABELS,
  DEAL_STATUS_LABELS,
  commissionReceivable,
  formatCurrency,
  formatDate,
} from '../../services/crm';

const STATUS_FILTERS = [
  ['active', 'Em andamento'],
  ['all', 'Todos'],
  ['documents', 'Documentação'],
  ['contract', 'Contrato'],
  ['financing', 'Financiamento'],
  ['deed_registry', 'Escritura / registro'],
  ['completed', 'Concluídos'],
  ['cancelled', 'Cancelados'],
];

export default function AdminDeals() {
  const [deals, setDeals] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('active');
  const [commission, setCommission] = useState('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const [dealsResult, metricsResult] = await Promise.all([
      getDeals(),
      getDealMetrics(365),
    ]);
    setDeals(dealsResult.data || []);
    setMetrics(metricsResult.data || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter((item) => {
      const statusOk = status === 'all'
        || (status === 'active' && !['completed', 'cancelled'].includes(item.status))
        || item.status === status;
      const commissionOk = commission === 'all' || item.commission_status === commission;
      if (!statusOk || !commissionOk) return false;
      if (!term) return true;

      return [
        item.code,
        item.lead?.name,
        item.lead?.whatsapp,
        item.proposal?.code,
        item.property?.code,
        item.property?.title,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [deals, status, commission, search]);

  function documentProgress(item) {
    const documents = item.documents || [];
    if (!documents.length) return 'Checklist ainda não criado';
    const done = documents.filter((doc) => ['validated', 'not_applicable'].includes(doc.status)).length;
    return `${done}/${documents.length} documentos concluídos`;
  }

  return (
    <div className="admin-page deals-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Pós-venda</span>
          <h1>Negócios fechados</h1>
          <p>Acompanhe documentação, contrato, registro e o recebimento da comissão até o fim.</p>
        </div>
      </div>

      {loading ? (
        <section className="admin-panel">Carregando negócios...</section>
      ) : (
        <>
          <div className="deal-metrics-grid">
            <article><span>Negócios</span><strong>{metrics?.total || 0}</strong></article>
            <article><span>Em andamento</span><strong>{metrics?.in_progress || 0}</strong></article>
            <article><span>Valor vendido</span><strong>{formatCurrency(metrics?.sold_value || 0)}</strong></article>
            <article><span>Comissão total</span><strong>{formatCurrency(metrics?.commission_total || 0)}</strong></article>
            <article><span>Comissão recebida</span><strong>{formatCurrency(metrics?.commission_received || 0)}</strong></article>
            <article><span>A receber</span><strong>{formatCurrency(metrics?.commission_receivable || 0)}</strong></article>
            <article><span>Comissões vencidas</span><strong>{metrics?.overdue_commissions || 0}</strong></article>
          </div>

          <section className="admin-panel deal-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, imóvel, proposta ou código..."
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_FILTERS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={commission} onChange={(event) => setCommission(event.target.value)}>
              <option value="all">Todas as comissões</option>
              <option value="pending">Comissão pendente</option>
              <option value="partial">Comissão parcial</option>
              <option value="received">Comissão recebida</option>
            </select>
          </section>

          <section className="admin-panel">
            <div className="panel-title-row">
              <h2>Fechamentos encontrados</h2>
              <span>{filtered.length}</span>
            </div>

            {filtered.length === 0 ? (
              <p>Nenhum negócio encontrado com esses filtros.</p>
            ) : (
              <div className="deal-list">
                {filtered.map((item) => (
                  <Link className="deal-list-card" to={`/admin/negocios/${item.id}`} key={item.id}>
                    <div className="deal-list-main">
                      <div className="deal-list-topline">
                        <strong>{item.code}</strong>
                        <span className={`deal-status ${item.status}`}>{DEAL_STATUS_LABELS[item.status] || item.status}</span>
                      </div>
                      <h3>{item.lead?.name || 'Cliente'}</h3>
                      <p>{item.property ? `${item.property.code} — ${item.property.title}` : 'Imóvel não informado'}</p>
                      <small>{documentProgress(item)}</small>
                    </div>
                    <div className="deal-list-side">
                      <strong>{formatCurrency(item.sale_value)}</strong>
                      <span>Comissão: {formatCurrency(item.commission_value)}</span>
                      <b className={`commission-status ${item.commission_status}`}>
                        {COMMISSION_STATUS_LABELS[item.commission_status] || item.commission_status}
                      </b>
                      {commissionReceivable(item) > 0 && <small>A receber: {formatCurrency(commissionReceivable(item))}</small>}
                      {item.commission_due_date && <small>Previsão: {formatDate(item.commission_due_date)}</small>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
