import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { changePropertyStatus, softDeleteProperty } from '../../services/admin';
import { formatMoney, getPublicImageUrl } from '../../services/properties';
import { getPropertyPortfolio, propertyPortfolioSummary } from '../../services/propertyManagement';

const statusLabels = {
  draft: 'Rascunho',
  published: 'Publicado',
  reserved: 'Reservado',
  sold: 'Vendido',
  rented: 'Alugado',
  inactive: 'Inativo',
};

const liquidityLabels = {
  high: 'Alta liquidez',
  medium: 'Média liquidez',
  low: 'Baixa liquidez',
};

function propertyValue(property) {
  if (property.sale_price != null) return formatMoney(property.sale_price);
  if (property.rent_price != null) return `${formatMoney(property.rent_price)}/mês`;
  return '—';
}

function coverImage(property) {
  const images = [...(property.property_images || [])].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return Number(a.display_order || 0) - Number(b.display_order || 0);
  });
  return images[0]?.storage_path ? getPublicImageUrl(images[0].storage_path) : null;
}

function pct(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(digits).replace('.', ',')}%`;
}

function mapQuery(property) {
  const lat = Number(property.latitude);
  const lng = Number(property.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat},${lng}`;

  const address = [
    property.street_name,
    property.address_number,
    property.neighborhood?.name,
    property.city?.name,
    property.city?.state_code,
    property.postal_code,
  ].filter(Boolean).join(', ');

  return address || property.public_location_text || '';
}

function preciseAddress(property) {
  return [
    property.street_name,
    property.address_number,
    property.address_complement,
    property.neighborhood?.name,
    property.city?.name,
    property.city?.state_code,
    property.postal_code,
  ].filter(Boolean).join(', ');
}

function visitSummary(property) {
  const slots = Array.isArray(property.visit_schedule) ? property.visit_schedule : [];
  if (!slots.length) return 'Sem horário informado';
  return slots.slice(0, 2).map((slot) => {
    const time = slot.start && slot.end ? ` ${slot.start}–${slot.end}` : '';
    return `${slot.day || ''}${time}`.trim();
  }).join(' • ');
}

export default function AdminProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [mapPropertyId, setMapPropertyId] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [typeFilter, setTypeFilter] = useState('all');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [subregionFilter, setSubregionFilter] = useState('all');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('all');
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [financingFilter, setFinancingFilter] = useState('all');
  const [liquidityFilter, setLiquidityFilter] = useState('all');
  const [yieldFilter, setYieldFilter] = useState('all');
  const [minSalePrice, setMinSalePrice] = useState('');
  const [maxSalePrice, setMaxSalePrice] = useState('');
  const [maxRentPrice, setMaxRentPrice] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [minParking, setMinParking] = useState('');
  const [visitOnly, setVisitOnly] = useState(false);
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

  const filterOptions = useMemo(() => {
    const byRegion = regionFilter === 'all'
      ? properties
      : properties.filter((property) => property.region_name === regionFilter);

    const bySubregion = subregionFilter === 'all'
      ? byRegion
      : byRegion.filter((property) => property.subregion_name === subregionFilter);

    return {
      types: [...new Set(properties.map((property) => property.property_type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      regions: [...new Set(properties.map((property) => property.region_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      subregions: [...new Set(byRegion.map((property) => property.subregion_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      neighborhoods: [...new Set(bySubregion.map((property) => property.neighborhood?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  }, [properties, regionFilter, subregionFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const minSale = Number(minSalePrice || 0);
    const maxSale = Number(maxSalePrice || 0);
    const maxRent = Number(maxRentPrice || 0);
    const minBeds = Number(minBedrooms || 0);
    const minPark = Number(minParking || 0);
    const minYield = yieldFilter === 'all' ? 0 : Number(yieldFilter);

    return properties.filter((property) => {
      const matchesTerm = !term || [
        property.code,
        property.title,
        property.public_location_text,
        property.region_name,
        property.subregion_name,
        property.neighborhood?.name,
        property.management?.owner_name,
        property.management?.owner_whatsapp,
      ].filter(Boolean).join(' ').toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && ['draft', 'published', 'reserved'].includes(property.status))
        || property.status === statusFilter;

      const matchesType = typeFilter === 'all' || property.property_type === typeFilter;
      const matchesPurpose = purposeFilter === 'all'
        || property.purpose === purposeFilter
        || (purposeFilter === 'sale' && property.purpose === 'sale_and_rent')
        || (purposeFilter === 'rent' && property.purpose === 'sale_and_rent');
      const matchesRegion = regionFilter === 'all' || property.region_name === regionFilter;
      const matchesSubregion = subregionFilter === 'all' || property.subregion_name === subregionFilter;
      const matchesNeighborhood = neighborhoodFilter === 'all' || property.neighborhood?.name === neighborhoodFilter;
      const matchesExchange = exchangeFilter === 'all' || String(Boolean(property.exchange_allowed)) === exchangeFilter;
      const matchesFinancing = financingFilter === 'all' || String(Boolean(property.financing_allowed)) === financingFilter;
      const matchesLiquidity = liquidityFilter === 'all' || property.liquidity === liquidityFilter;
      const matchesYield = yieldFilter === 'all' || Number(property.annual_gross_yield || 0) >= minYield;
      const matchesMinSale = !minSale || Number(property.sale_price || 0) >= minSale;
      const matchesMaxSale = !maxSale || (property.sale_price != null && Number(property.sale_price) <= maxSale);
      const matchesMaxRent = !maxRent || (property.rent_price != null && Number(property.rent_price) <= maxRent);
      const matchesBedrooms = !minBeds || Number(property.bedrooms || 0) >= minBeds;
      const matchesParking = !minPark || Number(property.parking_spaces || 0) >= minPark;
      const matchesVisit = !visitOnly || (Array.isArray(property.visit_schedule) && property.visit_schedule.length > 0);
      const matchesAttention = !attentionOnly || property.alert_count > 0;

      return matchesTerm
        && matchesStatus
        && matchesType
        && matchesPurpose
        && matchesRegion
        && matchesSubregion
        && matchesNeighborhood
        && matchesExchange
        && matchesFinancing
        && matchesLiquidity
        && matchesYield
        && matchesMinSale
        && matchesMaxSale
        && matchesMaxRent
        && matchesBedrooms
        && matchesParking
        && matchesVisit
        && matchesAttention;
    });
  }, [
    properties, search, statusFilter, typeFilter, purposeFilter, regionFilter, subregionFilter,
    neighborhoodFilter, exchangeFilter, financingFilter, liquidityFilter, yieldFilter,
    minSalePrice, maxSalePrice, maxRentPrice, minBedrooms, minParking, visitOnly, attentionOnly,
  ]);

  const mapProperty = useMemo(() => {
    const selected = filtered.find((property) => property.id === mapPropertyId);
    return selected || filtered[0] || null;
  }, [filtered, mapPropertyId]);

  function clearFilters() {
    setSearch('');
    setStatusFilter('active');
    setTypeFilter('all');
    setPurposeFilter('all');
    setRegionFilter('all');
    setSubregionFilter('all');
    setNeighborhoodFilter('all');
    setExchangeFilter('all');
    setFinancingFilter('all');
    setLiquidityFilter('all');
    setYieldFilter('all');
    setMinSalePrice('');
    setMaxSalePrice('');
    setMaxRentPrice('');
    setMinBedrooms('');
    setMinParking('');
    setVisitOnly(false);
    setAttentionOnly(false);
  }

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

  function liquidityBadge(property) {
    if (!property.liquidity) return <span className="property-liquidity unavailable">Sem avaliação</span>;
    return (
      <span className={`property-liquidity ${property.liquidity}`}>
        {liquidityLabels[property.liquidity]} · {pct(Math.max(0, Number(property.market_gap_percent || 0)))}
      </span>
    );
  }

  return (
    <div className="admin-page property-portfolio-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Carteira de imóveis</span>
          <h1>Gestão dos imóveis</h1>
          <p>Pesquisa avançada, rentabilidade, liquidez, visitas e gestão comercial em um só lugar.</p>
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

      <section className="admin-panel property-search-panel">
        <div className="property-primary-filters">
          <input
            className="property-filter-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por código, imóvel, local ou proprietário"
          />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Todos os tipos</option>
            {filterOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value)}>
            <option value="all">Todas as finalidades</option>
            <option value="sale">Venda</option>
            <option value="rent">Aluguel</option>
            <option value="sale_and_rent">Venda e aluguel</option>
          </select>
          <select value={regionFilter} onChange={(event) => { setRegionFilter(event.target.value); setSubregionFilter('all'); setNeighborhoodFilter('all'); }}>
            <option value="all">Todas as regiões</option>
            {filterOptions.regions.map((region) => <option key={region}>{region}</option>)}
          </select>
          <select value={subregionFilter} onChange={(event) => { setSubregionFilter(event.target.value); setNeighborhoodFilter('all'); }}>
            <option value="all">Todas as sub-regiões</option>
            {filterOptions.subregions.map((subregion) => <option key={subregion}>{subregion}</option>)}
          </select>
          <select value={neighborhoodFilter} onChange={(event) => setNeighborhoodFilter(event.target.value)}>
            <option value="all">Todos os bairros</option>
            {filterOptions.neighborhoods.map((neighborhood) => <option key={neighborhood}>{neighborhood}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="active">Ativos</option>
            <option value="all">Todos os status</option>
            <option value="published">Publicados</option>
            <option value="draft">Rascunhos</option>
            <option value="reserved">Reservados</option>
            <option value="sold">Vendidos</option>
            <option value="rented">Alugados</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        <details className="property-more-filters">
          <summary>Mais filtros comerciais</summary>
          <div className="property-advanced-filters">
            <select value={exchangeFilter} onChange={(event) => setExchangeFilter(event.target.value)}>
              <option value="all">Permuta: todos</option>
              <option value="true">Aceita permuta</option>
              <option value="false">Não aceita permuta</option>
            </select>
            <select value={financingFilter} onChange={(event) => setFinancingFilter(event.target.value)}>
              <option value="all">Financiamento: todos</option>
              <option value="true">Aceita financiamento</option>
              <option value="false">Não aceita financiamento</option>
            </select>
            <select value={yieldFilter} onChange={(event) => setYieldFilter(event.target.value)}>
              <option value="all">Rentabilidade: qualquer</option>
              <option value="3">Rentabilidade ≥ 3% a.a.</option>
              <option value="5">Rentabilidade ≥ 5% a.a.</option>
              <option value="7">Rentabilidade ≥ 7% a.a.</option>
              <option value="10">Rentabilidade ≥ 10% a.a.</option>
            </select>
            <select value={liquidityFilter} onChange={(event) => setLiquidityFilter(event.target.value)}>
              <option value="all">Liquidez: todas</option>
              <option value="high">Alta — até 10% acima do mercado</option>
              <option value="medium">Média — de 10% a 20%</option>
              <option value="low">Baixa — acima de 20%</option>
            </select>
            <input type="number" min="0" value={minSalePrice} onChange={(event) => setMinSalePrice(event.target.value)} placeholder="Venda mínima" />
            <input type="number" min="0" value={maxSalePrice} onChange={(event) => setMaxSalePrice(event.target.value)} placeholder="Venda máxima" />
            <input type="number" min="0" value={maxRentPrice} onChange={(event) => setMaxRentPrice(event.target.value)} placeholder="Aluguel máximo" />
            <input type="number" min="0" value={minBedrooms} onChange={(event) => setMinBedrooms(event.target.value)} placeholder="Mín. quartos" />
            <input type="number" min="0" value={minParking} onChange={(event) => setMinParking(event.target.value)} placeholder="Mín. vagas" />
            <label className="property-attention-toggle"><input type="checkbox" checked={visitOnly} onChange={(event) => setVisitOnly(event.target.checked)} /> Com horário de visita</label>
            <label className="property-attention-toggle"><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} /> Somente com atenção</label>
          </div>
        </details>

        <div className="property-filter-footer">
          <span><strong>{filtered.length}</strong> imóvel(is) encontrado(s)</span>
          <button type="button" className="admin-link-button" onClick={clearFilters}>Limpar filtros</button>
        </div>
      </section>

      <div className="property-view-switch" role="group" aria-label="Visualização dos imóveis">
        <button type="button" className={viewMode === 'details' ? 'active' : ''} onClick={() => setViewMode('details')}>Detalhada com fotos</button>
        <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>Tabela</button>
        <button type="button" className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>Mapa</button>
      </div>

      {loading ? (
        <section className="admin-panel"><p>Carregando...</p></section>
      ) : filtered.length === 0 ? (
        <section className="admin-panel"><div className="admin-empty"><h2>Nenhum imóvel encontrado</h2><p>Ajuste os filtros ou cadastre um novo imóvel.</p></div></section>
      ) : viewMode === 'details' ? (
        <section className="property-detail-grid">
          {filtered.map((property) => {
            const image = coverImage(property);
            return (
              <article className="property-detail-card" key={property.id}>
                <div className="property-detail-photo">
                  {image ? <img src={image} alt={property.title} /> : <div className="property-photo-placeholder">Sem foto</div>}
                  <span className={`admin-status ${property.status}`}>{statusLabels[property.status] || property.status}</span>
                </div>
                <div className="property-detail-body">
                  <div>
                    <small>{property.code}</small>
                    <h2>{property.title}</h2>
                    <p>{property.public_location_text || 'Localização não informada'}</p>
                  </div>
                  <div className="property-detail-values">
                    <span><b>Venda</b>{formatMoney(property.sale_price) || '—'}</span>
                    <span><b>Aluguel</b>{property.rent_price != null ? `${formatMoney(property.rent_price)}/mês` : '—'}</span>
                    <span><b>Condomínio</b>{formatMoney(property.condominium_fee) || '—'}</span>
                    <span><b>IPTU</b>{formatMoney(property.iptu_value) || '—'}</span>
                    <span><b>Desconto</b>{property.discount_percent != null ? pct(property.discount_percent) : '—'}</span>
                    <span><b>Rentabilidade</b>{property.annual_gross_yield != null ? `${pct(property.annual_gross_yield)} a.a.` : '—'}</span>
                  </div>
                  <div className="property-commercial-flags">
                    {liquidityBadge(property)}
                    <span>{property.exchange_allowed ? 'Aceita permuta' : 'Sem permuta'}</span>
                    <span>{property.financing_allowed ? 'Aceita financiamento' : 'Sem financiamento'}</span>
                  </div>
                  <p className="property-visit-summary"><b>Visitas:</b> {visitSummary(property)}</p>
                  <div className="admin-row-actions">
                    <Link className="property-manage-link" to={`/admin/imoveis/${property.id}/gestao`}>Gestão</Link>
                    <Link to={`/admin/imoveis/${property.id}/editar`}>Editar</Link>
                    <Link to={`/admin/imoveis/${property.id}/avaliacao`}>Avaliação</Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : viewMode === 'map' ? (
        <section className="admin-panel property-map-layout">
          <div className="property-map-list">
            {filtered.map((property) => (
              <button
                type="button"
                key={property.id}
                className={mapProperty?.id === property.id ? 'active' : ''}
                onClick={() => setMapPropertyId(property.id)}
              >
                <strong>{property.code} — {property.title}</strong>
                <span>{property.public_location_text || 'Localização não informada'}</span>
                <small>{propertyValue(property)}</small>
              </button>
            ))}
          </div>
          <div className="property-map-frame">
            {mapQuery(mapProperty) ? (
              <>
                <iframe
                  title={`Mapa de ${mapProperty.title}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery(mapProperty))}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="property-map-caption">
                  <strong>{mapProperty.code} — {mapProperty.title}</strong>
                  <span>{preciseAddress(mapProperty) || mapProperty.public_location_text}</span>
                  <small>{Number.isFinite(Number(mapProperty.latitude)) && Number.isFinite(Number(mapProperty.longitude)) ? 'Localização por coordenadas' : 'Localização por endereço'}</small>
                  {liquidityBadge(mapProperty)}
                </div>
              </>
            ) : (
              <div className="admin-empty"><h2>Localização não informada</h2><p>Edite o imóvel e informe endereço ou latitude/longitude para visualizá-lo no mapa.</p></div>
            )}
          </div>
        </section>
      ) : (
        <section className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table property-management-table property-excel-table">
              <thead>
                <tr>
                  <th>Imóvel</th>
                  <th>Local</th>
                  <th>Venda</th>
                  <th>Aluguel</th>
                  <th>Condomínio</th>
                  <th>IPTU</th>
                  <th>Desconto</th>
                  <th>Rentabilidade</th>
                  <th>Liquidez</th>
                  <th>Permuta</th>
                  <th>Visitas</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((property) => (
                  <tr key={property.id}>
                    <td><strong>{property.code}</strong><small>{property.title}</small></td>
                    <td><span>{property.public_location_text || '—'}</span><small>{[property.region_name, property.subregion_name].filter(Boolean).join(' • ')}</small></td>
                    <td>{formatMoney(property.sale_price) || '—'}</td>
                    <td>{property.rent_price != null ? `${formatMoney(property.rent_price)}/mês` : '—'}</td>
                    <td>{formatMoney(property.condominium_fee) || '—'}</td>
                    <td>{formatMoney(property.iptu_value) || '—'}</td>
                    <td>{property.discount_percent != null ? pct(property.discount_percent) : '—'}</td>
                    <td>{property.annual_gross_yield != null ? `${pct(property.annual_gross_yield)} a.a.` : '—'}</td>
                    <td>{liquidityBadge(property)}</td>
                    <td>{property.exchange_allowed ? 'Sim' : 'Não'}</td>
                    <td><small>{visitSummary(property)}</small></td>
                    <td><span className={`admin-status ${property.status}`}>{statusLabels[property.status] || property.status}</span></td>
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
        </section>
      )}
    </div>
  );
}
