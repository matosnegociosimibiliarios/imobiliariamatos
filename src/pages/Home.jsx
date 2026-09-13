import React from 'react';
import { Link } from 'react-router-dom';

const propertyTypes = [
  ['Casa', 'Casas para morar, investir ou vender'],
  ['Apartamento', 'Opções práticas em diferentes regiões'],
  ['Terreno', 'Áreas para construir e investir'],
  ['Sítio', 'Imóveis rurais e de lazer'],
  ['Comercial', 'Pontos e espaços para negócios'],
];

export default function Home() {
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

          <div className="search-panel" aria-label="Busca de imóveis">
            <div className="search-tabs">
              <Link className="tab active" to="/comprar">Comprar</Link>
              <Link className="tab" to="/alugar">Alugar</Link>
            </div>

            <div className="search-grid">
              <label>
                Localização
                <input placeholder="Cidade ou bairro" />
              </label>

              <label>
                Tipo de imóvel
                <select defaultValue="">
                  <option value="" disabled>Todos os tipos</option>
                  <option>Casa</option>
                  <option>Apartamento</option>
                  <option>Terreno</option>
                  <option>Sítio</option>
                  <option>Comercial</option>
                </select>
              </label>

              <label>
                Faixa de preço
                <select defaultValue="">
                  <option value="" disabled>Qualquer valor</option>
                  <option>Até R$ 200 mil</option>
                  <option>R$ 200 mil a R$ 400 mil</option>
                  <option>R$ 400 mil a R$ 700 mil</option>
                  <option>Acima de R$ 700 mil</option>
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
          <p>Os imóveis reais serão mostrados aqui quando conectarmos o site ao banco.</p>
        </div>

        <div className="empty-state">
          <div className="empty-icon">⌂</div>
          <h3>Nenhum imóvel publicado ainda</h3>
          <p>As páginas e a navegação já estão funcionando.</p>
        </div>
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
          <p>
            Prepare seu imóvel para aparecer para compradores e locatários com uma apresentação profissional.
          </p>
        </div>
        <a className="button button-light" href="#contato">Quero anunciar meu imóvel</a>
      </section>

      <section className="section valuation" id="avaliar">
        <div>
          <span className="eyebrow">Avaliação</span>
          <h2>Quer saber quanto seu imóvel pode valer?</h2>
          <p>
            Solicite uma avaliação e tenha uma referência mais segura antes de vender ou alugar.
          </p>
        </div>
        <a className="button" href="#contato">Solicitar avaliação</a>
      </section>

      <section className="section section-soft" id="sobre">
        <div className="section-heading">
          <span className="eyebrow">Sobre</span>
          <h2>Matos Negócios Imobiliários</h2>
          <p>
            Esta área será usada para apresentar a empresa, região de atuação, CRECI e forma de trabalho.
          </p>
        </div>
      </section>
    </main>
  );
}
