import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PropertyGrid from '../components/PropertyGrid';
import SeoHead from '../components/SeoHead';
import { getCityBySlug, getProperties, SLUG_PROPERTY_TYPES } from '../services/properties';

export default function LocalProperties({ purpose }) {
  const { citySlug, typeSlug } = useParams();
  const [city, setCity] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const propertyType = useMemo(() => typeSlug ? SLUG_PROPERTY_TYPES[typeSlug] : null, [typeSlug]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (typeSlug && !propertyType) {
        setNotFound(true); setLoading(false); return;
      }
      const cityResult = await getCityBySlug(citySlug);
      if (!active) return;
      if (cityResult.error || !cityResult.data) {
        setNotFound(true); setLoading(false); return;
      }
      setCity(cityResult.data);
      const result = await getProperties({ purpose, cityId: cityResult.data.id, propertyType, limit: 100 });
      if (!active) return;
      setProperties(result.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [citySlug, typeSlug, propertyType, purpose]);

  if (loading) return <main className="section"><div className="loading-box">Carregando imóveis...</div></main>;

  if (notFound || !city) {
    return <main className="section"><SeoHead title="Página não encontrada" description="Página não encontrada." canonicalPath={window.location.pathname} robots="noindex,nofollow" /><div className="empty-state"><h1>Localização não encontrada.</h1><Link className="button" to={purpose === 'rent' ? '/alugar' : '/comprar'}>Ver imóveis</Link></div></main>;
  }

  const sale = purpose === 'sale';
  const action = sale ? 'à venda' : 'para alugar';
  const typeText = propertyType ? `${propertyType}s` : 'Imóveis';
  const title = `${typeText} ${action} em ${city.name} - ${city.state_code}`;
  const description = `${typeText} ${action} em ${city.name}, ${city.state_code}. Consulte fotos, preços e características com a Matos Negócios Imobiliários.`;
  const path = `/${sale ? 'imoveis-a-venda' : 'imoveis-para-alugar'}/${city.slug}${typeSlug ? `/${typeSlug}` : ''}`;

  return (
    <main className="listing-page">
      <SeoHead title={title} description={description} canonicalPath={path} jsonLd={{ '@context':'https://schema.org', '@type':'CollectionPage', name:title, description }} />
      <section className="listing-hero"><span className="eyebrow">{sale ? 'Comprar' : 'Alugar'} em {city.name}</span><h1>{title}</h1><p>Imóveis publicados em {city.name}{propertyType ? ` na categoria ${propertyType}` : ''}.</p></section>
      <section className="section listing-content">
        <div className="seo-breadcrumbs"><Link to="/">Início</Link><span>›</span><Link to={sale ? '/comprar' : '/alugar'}>{sale ? 'Comprar' : 'Alugar'}</Link><span>›</span><strong>{city.name}</strong></div>
        <div className="listing-toolbar"><div><strong>{properties.length} imóvel{properties.length === 1 ? '' : 'is'} encontrado{properties.length === 1 ? '' : 's'}</strong><span>Somente imóveis publicados.</span></div></div>
        {properties.length ? <PropertyGrid properties={properties} purpose={purpose} /> : <div className="empty-state"><h2>Nenhum imóvel nesta busca.</h2><Link className="button" to={sale ? '/comprar' : '/alugar'}>Ver todos</Link></div>}
      </section>
    </main>
  );
}
