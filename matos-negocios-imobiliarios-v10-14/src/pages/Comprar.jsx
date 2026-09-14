import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PropertyFilters from '../components/PropertyFilters';
import PropertyGrid from '../components/PropertyGrid';
import EmptyProperties from '../components/EmptyProperties';
import SeoHead from '../components/SeoHead';
import { getProperties } from '../services/properties';
import { trackEvent } from '../services/tracking';

export default function Comprar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState({ location: searchParams.get('local') || '', propertyType: searchParams.get('tipo') || '', bedrooms: searchParams.get('quartos') || '' });

  useEffect(() => { let active = true; (async () => { const { data, error } = await getProperties({ purpose: 'sale', limit: 100 }); if (!active) return; setProperties(data || []); setLoadError(Boolean(error)); setLoading(false); })(); return () => { active = false; }; }, []);
  useEffect(() => setFilters({ location: searchParams.get('local') || '', propertyType: searchParams.get('tipo') || '', bedrooms: searchParams.get('quartos') || '' }), [searchParams]);

  const filtered = useMemo(() => properties.filter((p) => { const term = filters.location.trim().toLowerCase(); const where = [p.public_location_text, p.city?.name, p.neighborhood?.name].filter(Boolean).join(' ').toLowerCase(); return (!term || where.includes(term)) && (!filters.propertyType || p.property_type === filters.propertyType) && (!filters.bedrooms || Number(p.bedrooms || 0) >= Number(filters.bedrooms)); }), [properties, filters]);

  function change(e) { const { name, value } = e.target; setFilters((c) => ({ ...c, [name]: value })); }
  function apply(e) { e.preventDefault(); const q = new URLSearchParams(); if (filters.location) q.set('local', filters.location); if (filters.propertyType) q.set('tipo', filters.propertyType); if (filters.bedrooms) q.set('quartos', filters.bedrooms); setSearchParams(q); trackEvent('search_click', { metadata: { purpose: 'sale', ...filters } }); }
  function clear() { setFilters({ location:'', propertyType:'', bedrooms:'' }); setSearchParams({}); }

  return <main className="listing-page"><SeoHead title="Imóveis à venda" description="Casas, apartamentos, terrenos, sítios e imóveis comerciais à venda." canonicalPath="/comprar" />
    <section className="listing-hero"><span className="eyebrow">Comprar</span><h1>Imóveis à venda</h1><p>Encontre imóveis para morar ou investir.</p></section>
    <PropertyFilters finalidade="compra" values={filters} onChange={change} onSubmit={apply} onClear={clear} />
    <section className="section listing-content"><div className="listing-toolbar"><div><strong>{loading ? 'Carregando...' : `${filtered.length} imóvel${filtered.length === 1 ? '' : 'is'} encontrado${filtered.length === 1 ? '' : 's'}`}</strong><span>Somente imóveis publicados.</span></div></div>
      {!loading && loadError && <div className="empty-state"><h3>Não foi possível carregar os imóveis</h3></div>}
      {!loading && !loadError && filtered.length > 0 && <PropertyGrid properties={filtered} purpose="sale" />}
      {!loading && !loadError && filtered.length === 0 && <EmptyProperties tipo="à venda" />}
    </section>
  </main>;
}
