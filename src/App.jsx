import React from 'react';

const propertyTypes = [
  ['Casa', 'Casas para morar, investir ou vender'],
  ['Apartamento', 'Opções práticas em diferentes regiões'],
  ['Terreno', 'Áreas para construir e investir'],
  ['Sítio', 'Imóveis rurais e de lazer'],
  ['Comercial', 'Pontos e espaços para negócios'],
];

export default function App() {
  return (
    <div className="site-shell">
      <header className="header">
        <a className="brand" href="#inicio">
          <span className="brand-mark">M</span>
          <span>
            <strong>Matos</strong>
            <small>Negócios Imobiliários</small>
          </span>
        </a>

        <nav className="nav" aria-label="Navegação principal">
          <a href="#comprar">Comprar</a>
          <a href="#alugar">Alugar</a>
          <a href="#anunciar">Anuncie seu imóvel</a>
          <a href="#avaliar">Avalie seu imóvel</a>
          <a href="#sobre">Sobre</a>
        </nav>

        <a className="button button-small" href="#contato">Contato</a>
      </header>

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
                <button className="active">Comprar</button>
                <button>Alugar</button>
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

                <button className="button search-button">Buscar imóveis</button>
              </div>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="building-card">
              <span>Seu próximo imóvel começa aqui.</span>
            </div>
          </div>
        </section>

        <section className="section" id="comprar">
          <div className="section-heading">
            <span className="eyebrow">Oportunidades</span>
            <h2>Imóveis em destaque</h2>
            <p>Quando conectarmos o Supabase, os imóveis publicados aparecerão automaticamente aqui.</p>
          </div>

          <div className="empty-state">
            <div className="empty-icon">⌂</div>
            <h3>Nenhum imóvel publicado ainda</h3>
            <p>A estrutura da vitrine já está pronta. Os imóveis reais entrarão na próxima etapa.</p>
          </div>
        </section>

        <section className="section section-soft" id="alugar">
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
                <a href="#contato">Ver opções →</a>
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
              Esta área será usada para apresentar a empresa, região de atuação, CRECI e a forma de trabalho.
              Não incluímos números ou informações comerciais ainda para evitar dados fictícios.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer" id="contato">
        <div>
          <strong>Matos Negócios Imobiliários</strong>
          <p>Comprar, alugar, anunciar e avaliar imóveis.</p>
        </div>
        <div className="footer-links">
          <a href="#inicio">Início</a>
          <a href="#comprar">Comprar</a>
          <a href="#alugar">Alugar</a>
          <a href="#anunciar">Anunciar</a>
          <a href="#avaliar">Avaliação</a>
        </div>
        <p className="footer-note">© 2026 Matos Negócios Imobiliários.</p>
      </footer>
    </div>
  );
}
