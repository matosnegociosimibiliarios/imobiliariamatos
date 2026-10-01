import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import { trackEvent } from '../services/tracking';
import PropertyGrid from '../components/PropertyGrid';
import { getHomeProperties, publicTenantPath } from '../services/properties';

export default function Home() {
  const navigate = useNavigate();
  const { agency } = useOutletContext();
  const agencyName = agency?.trade_name || agency?.agency_name || 'Imobiliária';
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

  function updateSearch(event) {
    const { name, value } = event.target;
    setSearch((current) => ({ ...current, [name]: value }));
  }

  function submitSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.location) params.set('local', search.location);
    if (search.propertyType) params.set('tipo', search.propertyType);
    trackEvent('search_click', { metadata: { source: 'home', ...search } });
    const route = search.purpose === 'rent' ? '/alugar' : '/comprar';
    navigate(publicTenantPath(`${route}${params.toString() ? `?${params.toString()}` : ''}`));
  }

  return (
    <main id="inicio">
      <SeoHead title={`${agencyName} | Imóveis em Ressaquinha e região`} description="Encontre imóveis para comprar, alugar, vender ou avaliar em Ressaquinha e região." canonicalPath="/" jsonLd={{ '@context':'https://schema.org', '@type':'RealEstateAgent', name:agencyName, url:window.location.origin }} />

      <section className="premium-hero">
        <div className="premium-hero-overlay" />
        <div className="premium-hero-content">
          <span className="eyebrow eyebrow-light">{agencyName}</span>
          <h1>Encontre o imóvel perfeito para a sua história com a {agencyName}.</h1>
          <p>Compra, venda e locação com atendimento próximo, informação clara e segurança em cada etapa.</p>

          <form className="search-panel premium-search" onSubmit={submitSearch}>
            <div className="search-tabs">
              <button className={`tab ${search.purpose === 'sale' ? 'active' : ''}`} type="button" onClick={() => setSearch((c) => ({ ...c, purpose:'sale' }))}>Comprar</button>
              <button className={`tab ${search.purpose === 'rent' ? 'active' : ''}`} type="button" onClick={() => setSearch((c) => ({ ...c, purpose:'rent' }))}>Alugar</button>
            </div>
            <div className="search-grid">
              <label>Localização<input name="location" value={search.location} onChange={updateSearch} placeholder="Cidade ou bairro" /></label>
              <label>Tipo de imóvel<select name="propertyType" value={search.propertyType} onChange={updateSearch}><option value="">Todos os tipos</option><option>Casa</option><option>Apartamento</option><option>Terreno</option><option>Sítio</option><option>Comercial</option></select></label>
              <button className="button search-button" type="submit">Buscar Imóveis</button>
            </div>
          </form>
        </div>
      </section>

      <section className="section premium-showcase">
        <div className="section-heading">
          <span className="eyebrow">Seleção {agencyName}</span>
          <h2>Imóveis em destaque</h2>
          <p>Oportunidades selecionadas para morar, investir ou começar uma nova fase.</p>
        </div>
        {loading && <div className="loading-box">Carregando imóveis...</div>}
        {!loading && loadError && <div className="empty-state"><h3>Não foi possível carregar os imóveis</h3><p>Tente novamente em alguns instantes.</p></div>}
        {!loading && !loadError && properties.length > 0 && <PropertyGrid properties={properties} />}
        {!loading && !loadError && properties.length === 0 && <div className="empty-state"><div className="empty-icon">⌂</div><h3>Novas oportunidades em breve</h3><p>Os imóveis publicados aparecerão automaticamente aqui.</p></div>}
        <div className="showcase-action"><Link className="button button-outline-premium" to={publicTenantPath('/comprar')}>Ver todos os imóveis</Link></div>
      </section>

      <section className="premium-conversion" id="avaliar">
        <div>
          <span className="eyebrow eyebrow-light">Venda e avaliação</span>
          <h2>Quer vender ou avaliar seu imóvel de forma rápida? Fale com nossos especialistas.</h2>
          <p>Conte com a {agencyName} para entender o mercado, organizar a apresentação do imóvel e conduzir o atendimento.</p>
        </div>
        <a className="button whatsapp-cta" href={agency?.whatsapp ? `https://wa.me/${String(agency.whatsapp).replace(/\\D/g,'')}?text=${encodeURIComponent('Olá, quero vender ou avaliar meu imóvel.')}` : '#contato'} target="_blank" rel="noreferrer" onClick={() => trackEvent('whatsapp_click', { metadata: { source:'home_cta' } })}>Falar no WhatsApp</a>
      </section>

      <section className="section premium-services" id="sobre">
        <div className="section-heading">
          <span className="eyebrow">{agencyName}</span>
          <h2>Seu imóvel tratado como uma decisão importante.</h2>
          <p>Atendimento para quem quer comprar, alugar, anunciar ou avaliar um imóvel em Ressaquinha e região.</p>
        </div>
        <div className="premium-service-grid">
          <Link to="/comprar"><strong>Comprar</strong><span>Encontre oportunidades para morar ou investir.</span></Link>
          <Link to={publicTenantPath('/alugar')}><strong>Alugar</strong><span>Veja imóveis disponíveis para locação.</span></Link>
          <Link to={publicTenantPath('/anuncie-seu-imovel')}><strong>Vender</strong><span>Cadastre seu imóvel para iniciar o atendimento.</span></Link>
          <Link to={publicTenantPath('/avaliacao-do-imovel')}><strong>Avaliar</strong><span>Solicite uma análise do seu imóvel.</span></Link>
        </div>
      </section>
    </main>
  );
}
