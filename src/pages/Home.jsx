import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

  return (
    <main id="inicio">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Matos Negócios Imobiliários</span>
          <h1>Encontre o imóvel certo para você.</h1>
          <p>
            Casas, apartamentos, terrenos, sítios e imóveis comerciais para comprar,
            alugar ou investir.
          </p>

          <div className="search-panel">
            <div className="search-tabs">
              <Link className="tab active" to="/comprar">Comprar</Link>
              <Link className="tab" to="/alugar">Alugar</Link>
            </div>

            <div className="search-grid">
              <label>
                Localização
                <input placeholder="Cidade ou bairro" disabled title="Filtro será conectado na próxima etapa" />
              </label>

              <label>
                Tipo de imóvel
                <select defaultValue="" disabled>
                  <option value="">Todos os tipos</option>
                </select>
              </label>

              <label>
                Faixa de preço
                <select defaultValue="" disabled>
                  <option value="">Qualquer valor</option>
                </select>
              </label>

              <Link className="button search-button" to="/comprar">Buscar imóveis</Link>
            </div>
          </div>
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
          <p>Em breve esta área receberá o formulário de captação de proprietários.</p>
        </div>
        <a className="button button-light" href="#contato">Quero anunciar meu imóvel</a>
      </section>

      <section className="section valuation" id="avaliar">
        <div>
          <span className="eyebrow">Avaliação</span>
          <h2>Quer saber quanto seu imóvel pode valer?</h2>
          <p>Solicite uma avaliação antes de vender ou alugar.</p>
        </div>
        <a className="button" href="#contato">Solicitar avaliação</a>
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
