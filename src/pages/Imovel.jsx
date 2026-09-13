import React from 'react';
import { Link, useParams } from 'react-router-dom';

function FotoModelo({ grande = false, texto = 'Foto do imóvel' }) {
  return (
    <div className={`property-photo-placeholder ${grande ? 'large' : ''}`}>
      <span>⌂</span>
      <small>{texto}</small>
    </div>
  );
}

export default function Imovel() {
  const { slug } = useParams();

  return (
    <main className="property-page">
      <section className="property-demo-alert">
        <strong>Página modelo</strong>
        <span>
          Esta tela serve apenas para você visualizar como será a página de cada imóvel.
          Ainda não representa um anúncio real.
        </span>
      </section>

      <section className="property-top">
        <div>
          <Link className="back-link" to="/comprar">← Voltar para imóveis</Link>
          <span className="eyebrow">Imóvel</span>
          <h1>Página individual do imóvel</h1>
          <p className="property-location">Localização pública aparecerá aqui</p>
        </div>

        <div className="property-code-box">
          <small>Código</small>
          <strong>MAT-XXXX</strong>
        </div>
      </section>

      <section className="property-gallery">
        <FotoModelo grande texto="Foto principal" />
        <div className="property-gallery-side">
          <FotoModelo texto="Foto 2" />
          <FotoModelo texto="Foto 3" />
          <FotoModelo texto="Foto 4" />
          <FotoModelo texto="Foto 5" />
        </div>
        <button className="gallery-button">Ver todas as fotos</button>
      </section>

      <section className="property-main-grid">
        <div className="property-content">
          <div className="property-price-block">
            <span className="eyebrow">Valor</span>
            <h2>Preço do imóvel</h2>
            <p>O valor real será carregado automaticamente do cadastro.</p>
          </div>

          <div className="property-facts">
            <div><strong>—</strong><span>Quartos</span></div>
            <div><strong>—</strong><span>Suítes</span></div>
            <div><strong>—</strong><span>Banheiros</span></div>
            <div><strong>—</strong><span>Vagas</span></div>
            <div><strong>—</strong><span>Área</span></div>
          </div>

          <section className="property-section">
            <h2>Sobre este imóvel</h2>
            <p>
              Aqui será exibida a descrição cadastrada para o imóvel, com informações
              relevantes para o comprador ou locatário.
            </p>
          </section>

          <section className="property-section">
            <h2>Características</h2>
            <div className="feature-list">
              <span>Características cadastradas</span>
              <span>Financiamento, quando aplicável</span>
              <span>Aceita troca, quando aplicável</span>
              <span>Outras informações públicas</span>
            </div>
          </section>

          <section className="property-section">
            <h2>Localização</h2>
            <div className="location-box">
              <strong>Bairro e cidade</strong>
              <p>
                O endereço exato não será exibido publicamente. Aqui aparecerá somente
                a localização autorizada para divulgação.
              </p>
            </div>
          </section>
        </div>

        <aside className="property-contact-card">
          <span className="eyebrow">Atendimento</span>
          <h2>Interessado neste imóvel?</h2>
          <p>
            Quando o site estiver conectado ao banco, os botões usarão os dados do imóvel
            e o WhatsApp da imobiliária.
          </p>

          <button className="button full-button" type="button">
            Falar pelo WhatsApp
          </button>

          <button className="button button-outline full-button" type="button">
            Agendar visita
          </button>

          <button className="share-button" type="button">
            Compartilhar imóvel
          </button>
        </aside>
      </section>

      <section className="section related-properties">
        <div className="section-heading">
          <span className="eyebrow">Outras oportunidades</span>
          <h2>Imóveis semelhantes</h2>
          <p>
            Depois da conexão com o banco, outros imóveis compatíveis aparecerão aqui.
          </p>
        </div>

        <div className="empty-state">
          <div className="empty-icon">⌂</div>
          <h3>Nenhum imóvel relacionado ainda</h3>
          <p>Esta área será preenchida automaticamente.</p>
        </div>
      </section>

      <div className="mobile-contact-bar">
        <button type="button">WhatsApp</button>
        <button type="button">Agendar visita</button>
      </div>
    </main>
  );
}
