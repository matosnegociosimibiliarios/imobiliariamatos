import React, { useEffect, useState } from 'react';
import PropertyFilters from '../components/PropertyFilters';
import PropertyGrid from '../components/PropertyGrid';
import EmptyProperties from '../components/EmptyProperties';
import { getProperties } from '../services/properties';

export default function Comprar() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await getProperties({
        purpose: 'sale',
        limit: 48,
      });

      if (!active) return;
      setProperties(data || []);
      setLoadError(Boolean(error));
      setLoading(false);
    })();

    return () => { active = false; };
  }, []);

  return (
    <main className="listing-page">
      <section className="listing-hero">
        <span className="eyebrow">Comprar</span>
        <h1>Imóveis à venda</h1>
        <p>Encontre casas, apartamentos, terrenos, sítios e imóveis comerciais.</p>
      </section>

      <PropertyFilters finalidade="compra" />

      <section className="section listing-content">
        <div className="listing-toolbar">
          <div>
            <strong>{loading ? 'Carregando...' : `${properties.length} imóvel${properties.length === 1 ? '' : 'is'} encontrado${properties.length === 1 ? '' : 's'}`}</strong>
            <span>Somente imóveis publicados são exibidos.</span>
          </div>
        </div>

        {!loading && loadError && (
          <div className="empty-state">
            <h3>Não foi possível carregar os imóveis</h3>
            <p>Confira a conexão com o banco e tente novamente.</p>
          </div>
        )}

        {!loading && !loadError && properties.length > 0 && (
          <PropertyGrid properties={properties} purpose="sale" />
        )}

        {!loading && !loadError && properties.length === 0 && (
          <EmptyProperties tipo="à venda" />
        )}
      </section>
    </main>
  );
}
