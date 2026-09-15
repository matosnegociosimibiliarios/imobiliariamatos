import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { changePropertyStatus, softDeleteProperty } from '../../services/admin';
import { formatMoney } from '../../services/properties';
import { getPropertyPortfolio, propertyPortfolioSummary } from '../../services/propertyManagement';

const statusLabels = {
  draft: 'Rascunho',
  published: 'Publicado',
  reserved: 'Reservado',
  sold: 'Vendido',
  rented: 'Alugado',
  inactive: 'Inativo',
};

function propertyValue(property) {
  if (property.sale_price != null) return formatMoney(property.sale_price);
  if (property.rent_price != null) return `${formatMoney(property.rent_price)}/mês`;
  return '—';
}

export default function AdminProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [attentionOnly, setAttentionOnly] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await getPropertyPortfolio();
    if (error) {
      setMessage('Não foi possível carregar a gestão dos imóveis.');
      setProperties([]);
    } else {
      setProperties(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => propertyPortfolioSummary(properties), [properties]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return properties.filter((property) => {
      const matchesTerm = !term || [
        property.code,
        property.title,
        property.public_location_text,
        property.management?.owner_name,
        property.management?.owner_whatsapp,
      ].filter(Boolean).join(' ').toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && ['draft', 'published', 'reserved'].includes(property.status))
        || property.status === statusFilter;

      const matchesAttention = !attentionOnly || property.alert_count > 0;
      return matchesTerm && matchesStatus && matchesAttention;
    });
  }, [properties, search, statusFilter, attentionOnly]);

  async function togglePublish(property) {
    const next = property.status === 'published' ? 'draft' : 'published';
    const { error } = await changePropertyStatus(property.id, next);
    if (error) {
      setMessage('Não foi possível alterar o status.');
      return;
    }
    await load();
  }

  async function remove(property) {
    const confirmed = window.confirm(`Tem certeza que deseja remover o imóvel ${property.code}?`);
    if (!confirmed) return;
    const { error } = await softDeleteProperty(property.id);
    if (error) {
      setMessage('Não foi possível remover o imóvel.');
      return;
    }
    await load();
  }

  return (
    <div className="admin-page property-portfolio-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Carteira de imóveis</span>
          <h1>Gestão dos imóveis</h1>
          <p>Proprietário, documentação, desempenho, prazo em carteira e alertas em um só lugar.</p>
        </div>
        <Link className="button" to="/admin/imoveis/novo">+ Novo Imóvel</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="property-portfolio-summary">
        <article><span>Total</span><strong>{summary.total}</strong></article>
        <article><span>Ativos</span><strong>{summary.active}</strong></article>
        <article><span>Publicados</span><strong>{summary.published}</strong></article>
        <article><span>Com atenção</span><strong>{summary.attention}</strong></article>
        <article><span>Parados +30 dias</span><strong>{summary.stale}</strong></article>
        <article><span>Média em carteira</span><strong>{summary.average_days} dias</strong></article>
      </div>

      <section className="admin-panel property-portfolio-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, imóvel, local ou proprietário" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="active">Ativos</option>
          <option value="all">Todos</option>
          <option value="published">Publicados</option>
          <option value="draft">Rascunhos</option>
          <option value="reserved">Reservados</option>
          <option value="sold">Vendidos</option>
          <option value="rented">Alugados</option>
          <option value="inactive">Inativos</option>
        </select>
        <label className="property-attention-toggle"><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} /> Somente com atenção</label>
      </section>

      <section className="admin-panel">
        {loading ? (
          <p>Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="admin-empty"><h2>Nenhum imóvel encontrado</h2><p>Ajuste os filtros ou cadastre um novo imóvel.</p></div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table property-management-table">
              <thead>
                <tr>
                  <th>Imóvel</th>
                  <th>Proprietário</th>
                  <th>Carteira</th>
                  <th>Desempenho</th>
                  <th>Status</th>
                  <th>Atenção</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((property) => (
                  <tr key={property.id}>
                    <td>
                      <strong>{property.code} — {property.title}</strong>
                      <small>{property.public_location_text || ''}</small>
                      <small>{propertyValue(property)}</small>
                    </td>
                    <td>
                      <strong>{property.management?.owner_name || 'Não informado'}</strong>
                      <small>{property.management?.owner_whatsapp || 'Sem WhatsApp'}</small>
                    </td>
                    <td>
                      <strong>{property.metrics?.days_in_portfolio || 0} dias</strong>
                      <small>{property.metrics?.inactive_days || 0} dias sem interação</small>
                    </td>
                    <td>
                      <div className="property-mini-metrics">
                        <span><b>{property.metrics?.leads_count || 0}</b> leads</span>
                        <span><b>{property.metrics?.visits_count || 0}</b> visitas</span>
                        <span><b>{property.metrics?.proposals_count || 0}</b> propostas</span>
                      </div>
                    </td>
                    <td><span className={`admin-status ${property.status}`}>{statusLabels[property.status] || property.status}</span></td>
                    <td>
                      {property.alert_count === 0 ? <span className="property-ok-label">Em dia</span> : (
                        <div className="property-alert-compact">
                          <strong>{property.alert_count} alerta{property.alert_count === 1 ? '' : 's'}</strong>
                          <small>{property.alerts[0]}</small>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link className="property-manage-link" to={`/admin/imoveis/${property.id}/gestao`}>Gestão</Link>
                        <Link to={`/admin/imoveis/${property.id}/editar`}>Editar</Link>
                        <button type="button" onClick={() => togglePublish(property)}>{property.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
                        <button type="button" className="danger" onClick={() => remove(property)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
