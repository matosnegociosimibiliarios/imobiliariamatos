import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getProposalMetrics,
  getProposals,
} from '../../services/admin';
import {
  PROPOSAL_STATUS_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
  proposalValidityLabel,
} from '../../services/crm';

const STATUS_FILTERS = [
  ['all', 'Todas'],
  ['open', 'Em aberto'],
  ['draft', 'Rascunho'],
  ['sent', 'Enviada'],
  ['negotiation', 'Em negociação'],
  ['accepted', 'Aceita'],
  ['rejected', 'Recusada'],
  ['expired', 'Expirada'],
];

export default function AdminProposals() {
  const [proposals, setProposals] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const [proposalsResult, metricsResult] = await Promise.all([
      getProposals(),
      getProposalMetrics(90),
    ]);
    setProposals(proposalsResult.data || []);
    setMetrics(metricsResult.data || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return proposals.filter((item) => {
      const statusOk = status === 'all'
        || (status === 'open' && ['draft', 'sent', 'negotiation'].includes(item.status))
        || item.status === status;

      if (!statusOk) return false;
      if (!term) return true;

      return [
        item.code,
        item.lead?.name,
        item.lead?.whatsapp,
        item.property?.code,
        item.property?.title,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [proposals, status, search]);

  return (
    <div className="admin-page proposals-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Acompanhamento comercial</span>
          <h1>Propostas</h1>
          <p>Controle valores, validade, retornos e resultado de cada negociação.</p>
        </div>
        <Link className="button" to="/admin/propostas/nova">Nova proposta</Link>
      </div>

      {loading ? (
        <section className="admin-panel">Carregando propostas...</section>
      ) : (
        <>
          <div className="proposal-metrics-grid">
            <article><span>Em aberto</span><strong>{metrics?.open || 0}</strong></article>
            <article><span>Em negociação</span><strong>{metrics?.negotiation || 0}</strong></article>
            <article><span>Aceitas</span><strong>{metrics?.accepted || 0}</strong></article>
            <article><span>Taxa de aceite</span><strong>{metrics?.acceptance_rate || 0}%</strong></article>
            <article><span>Valor em aberto</span><strong>{formatCurrency(metrics?.open_value || 0)}</strong></article>
            <article><span>Viraram venda</span><strong>{metrics?.proposal_to_sale_rate || 0}%</strong></article>
          </div>

          <section className="admin-panel proposal-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, imóvel ou código da proposta..."
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_FILTERS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </section>

          <section className="admin-panel">
            <div className="panel-title-row">
              <h2>Propostas encontradas</h2>
              <span>{filtered.length}</span>
            </div>

            {filtered.length === 0 ? (
              <p>Nenhuma proposta encontrada com esses filtros.</p>
            ) : (
              <div className="proposal-list">
                {filtered.map((item) => (
                  <Link className="proposal-list-card" to={`/admin/propostas/${item.id}`} key={item.id}>
                    <div className="proposal-list-main">
                      <div className="proposal-list-topline">
                        <strong>{item.code}</strong>
                        <span className={`proposal-status ${item.status}`}>
                          {PROPOSAL_STATUS_LABELS[item.status] || item.status}
                        </span>
                      </div>
                      <h3>{item.lead?.name || 'Cliente'}</h3>
                      <p>{item.property ? `${item.property.code} — ${item.property.title}` : 'Imóvel não informado'}</p>
                      <small>Atualizada em {formatDateTime(item.updated_at)}</small>
                    </div>
                    <div className="proposal-list-side">
                      <strong>{formatCurrency(item.proposal_value)}</strong>
                      <span>Validade: {formatDate(item.valid_until)}</span>
                      <small>{proposalValidityLabel(item.valid_until)}</small>
                      {item.next_follow_up_at && <b>Retorno: {formatDateTime(item.next_follow_up_at)}</b>}
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
