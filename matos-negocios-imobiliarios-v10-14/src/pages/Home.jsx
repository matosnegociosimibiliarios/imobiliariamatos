import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import { trackEvent } from '../services/tracking';
import PropertyGrid from '../components/PropertyGrid';
import { getHomeProperties } from '../services/properties';

const propertyTypes = [
  ['Casa', 'Casas para morar, investir ou vender'],
  ['Apartamento', 'Opções práticas em diferentes regiões'],
  ['Terreno', 'Áreas para construir e investir'],
  ['Sítio', 'Imóveis rurais e de lazer'],
  ['Comercial', 'Pontos e espaços para negócios'],
];

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState({ purpose: 'sale', location: '', propertyType: '' });
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await getHomeProperties();

      if (!active) return;
      setProperties(data || []);
      setLoadError(Boolean(error));
      setLoading(false);
    })();

    return () => { active = false; };
  }, []);


  function updateSearch(event) { const { name, value } = event.target; setSearch((current) => ({ ...current, [name]: value })); }
  function submitSearch(event) { event.preventDefault(); const params = new URLSearchParams(); if (search.location) params.set('local', search.location); if (search.propertyType) params.set('tipo', search.propertyType); trackEvent('search_click', { metadata: { source:'home', ...search } }); const route = search.purpose === 'rent' ? '/alugar' : '/comprar'; navigate(`${route}${params.toString() ? `?${params.toString()}` : ''}`); }
  return (
    <main id="inicio">
      <SeoHead title="Imóveis em Ressaquinha e região" description="Imóveis para comprar, alugar, anunciar e avaliar em Ressaquinha e região." canonicalPath="/" jsonLd={{ '@context':'https://schema.org', '@type':'RealEstateAgent', name:'Matos Negócios Imobiliários', url:window.location.origin }} />
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Matos Negócios Imobiliários</span>
          <h1>Encontre o imóvel certo para você.</h1>
          <p>
            Casas, apartamentos, terrenos, sítios e imóveis comerciais para comprar,
            alugar ou investir.
          </p>

          <form className="search-panel" onSubmit={submitSearch}>
            <div className="search-tabs">
              <button className={`tab ${search.purpose === 'sale' ? 'active' : ''}`} type="button" onClick={() => setSearch((c) => ({ ...c, purpose:'sale' }))}>Comprar</button>
              <button className={`tab ${search.purpose === 'rent' ? 'active' : ''}`} type="button" onClick={() => setSearch((c) => ({ ...c, purpose:'rent' }))}>Alugar</button>
            </div>
            <div className="search-grid">
              <label>Localização<input name="location" value={search.location} onChange={updateSearch} placeholder="Cidade ou bairro" /></label>
              <label>Tipo de imóvel<select name="propertyType" value={search.propertyType} onChange={updateSearch}><option value="">Todos os tipos</option><option>Casa</option><option>Apartamento</option><option>Terreno</option><option>Sítio</option><option>Comercial</option></select></label>
              <button className="button search-button" type="submit">Buscar imóveis</button>
            </div>
          </form>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="building-card">
            <span>Seu próximo imóvel começa aqui.</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Oportunidades</span>
          <h2>Imóveis em destaque</h2>
          <p>Os imóveis publicados no banco aparecem automaticamente nesta área.</p>
        </div>

        {loading && <div className="loading-box">Carregando imóveis...</div>}

        {!loading && loadError && (
          <div className="empty-state">
            <h3>Não foi possível carregar os imóveis</h3>
            <p>Confira a conexão com o banco e tente novamente.</p>
          </div>
        )}

        {!loading && !loadError && properties.length > 0 && (
          <PropertyGrid properties={properties} />
        )}

        {!loading && !loadError && properties.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">⌂</div>
            <h3>Nenhum imóvel publicado ainda</h3>
            <p>Assim que você publicar o primeiro imóvel, ele aparecerá aqui automaticamente.</p>
          </div>
        )}
      </section>

      <section className="section section-soft">
        <div className="section-heading">
          <span className="eyebrow">Escolha o que procura</span>
          <h2>Encontre por tipo de imóvel</h2>
        </div>

        <div className="type-grid">
          {propertyTypes.map(([name, description]) => (
            <article className="type-card" key={name}>
              <div className="type-icon">⌂</div>
              <h3>{name}</h3>
              <p>{description}</p>
              <Link to="/comprar">Ver opções →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="owner-section" id="anunciar">
        <div>
          <span className="eyebrow eyebrow-light">Para proprietários</span>
          <h2>Quer vender ou alugar seu imóvel?</h2>
          <p>Envie os dados do imóvel. A solicitação entra diretamente no nosso processo de captação e acompanhamento.</p>
        </div>
        <Link className="button button-light" to="/anuncie-seu-imovel">Quero anunciar meu imóvel</Link>
      </section>

      <section className="section valuation" id="avaliar">
        <div>
          <span className="eyebrow">Avaliação</span>
          <h2>Quer saber quanto seu imóvel pode valer?</h2>
          <p>Solicite uma avaliação antes de vender ou alugar.</p>
        </div>
        <Link className="button" to="/avaliacao-do-imovel">Solicitar avaliação</Link>
      </section>

      <section className="section section-soft" id="sobre">
        <div className="section-heading">
          <span className="eyebrow">Sobre</span>
          <h2>Matos Negócios Imobiliários</h2>
          <p>Esta área será usada para apresentar a empresa, região de atuação, CRECI e forma de trabalho.</p>
        </div>
      </section>
    </main>
  );
}
