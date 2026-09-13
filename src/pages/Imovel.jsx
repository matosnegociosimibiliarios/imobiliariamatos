import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getAgencySettings,
  getPropertyBySlug,
  propertyLocation,
  propertyPrice,
} from '../services/properties';

function Fact({ value, label }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function Imovel() {
  const { slug } = useParams();
  const [property, setProperty] = useState(null);
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const [propertyResult, agencyResult] = await Promise.all([
        getPropertyBySlug(slug),
        getAgencySettings(),
      ]);

      if (!active) return;

      setAgency(agencyResult.data || null);

      if (propertyResult.error || !propertyResult.data) {
        setNotFound(true);
      } else {
        setProperty(propertyResult.data);
      }

      setLoading(false);
    })();

    return () => { active = false; };
  }, [slug]);

  const features = useMemo(() => {
    return (property?.property_features || [])
      .map((item) => item.feature)
      .filter((feature) => feature?.active !== false);
  }, [property]);

  const whatsappLink = useMemo(() => {
    if (!property || !agency?.whatsapp) return null;

    const number = agency.whatsapp.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá! Tenho interesse no imóvel ${property.code} — ${property.title}. Gostaria de mais informações. ${window.location.href}`
    );

    return `https://wa.me/${number}?text=${message}`;
  }, [property, agency]);

  if (loading) {
    return <main className="section"><div className="loading-box">Carregando imóvel...</div></main>;
  }

  if (notFound) {
    return (
      <main className="section">
        <div className="empty-state">
          <h1>Este imóvel não está disponível.</h1>
          <p>Ele pode ter sido removido ou ainda não estar publicado.</p>
          <Link className="button" to="/comprar">Ver outros imóveis</Link>
        </div>
      </main>
    );
  }

  const pricePurpose =
    property.purpose === 'rent' ? 'rent' :
    property.purpose === 'sale' ? 'sale' : undefined;

  return (
    <main className="property-page">
      <section className="property-top">
        <div>
          <Link className="back-link" to="/comprar">← Voltar para imóveis</Link>
          <span className="eyebrow">{property.property_type}</span>
          <h1>{property.title}</h1>
          <p className="property-location">{propertyLocation(property)}</p>
        </div>

        <div className="property-code-box">
          <small>Código</small>
          <strong>{property.code}</strong>
        </div>
      </section>

      <section className="property-gallery">
        <div className="property-photo-placeholder large">
          <span>⌂</span>
          <small>Fotos serão conectadas na próxima etapa</small>
        </div>
      </section>

      <section className="property-main-grid">
        <div className="property-content">
          <div className="property-price-block">
            <span className="eyebrow">Valor</span>
            <h2>{propertyPrice(property, pricePurpose)}</h2>

            {property.condominium_fee != null && (
              <p>Condomínio: {property.condominium_fee}</p>
            )}
          </div>

          <div className="property-facts">
            <Fact value={property.bedrooms} label="Quartos" />
            <Fact value={property.suites} label="Suítes" />
            <Fact value={property.bathrooms} label="Banheiros" />
            <Fact value={property.parking_spaces} label="Vagas" />
            <Fact value={property.total_area ? `${property.total_area} m²` : null} label="Área total" />
          </div>

          {property.description && (
            <section className="property-section">
              <h2>Sobre este imóvel</h2>
              <p>{property.description}</p>
            </section>
          )}

          <section className="property-section">
            <h2>Características</h2>
            <div className="feature-list">
              {property.financing_allowed && <span>Aceita financiamento</span>}
              {property.exchange_allowed && <span>Aceita troca</span>}
              {property.furnished && <span>Mobiliado</span>}
              {features.map((feature) => (
                <span key={feature.id}>{feature.label}</span>
              ))}
              {!property.financing_allowed &&
               !property.exchange_allowed &&
               !property.furnished &&
               features.length === 0 && (
                 <span>Nenhuma característica adicional cadastrada.</span>
               )}
            </div>
          </section>

          <section className="property-section">
            <h2>Localização</h2>
            <div className="location-box">
              <strong>{propertyLocation(property)}</strong>
              <p>O endereço exato não é exibido publicamente.</p>
            </div>
          </section>
        </div>

        <aside className="property-contact-card">
          <span className="eyebrow">Atendimento</span>
          <h2>Interessado neste imóvel?</h2>
          <p>Entre em contato para tirar dúvidas ou solicitar uma visita.</p>

          {whatsappLink ? (
            <a className="button full-button" href={whatsappLink} target="_blank" rel="noreferrer">
              Falar pelo WhatsApp
            </a>
          ) : (
            <button className="button full-button" type="button" disabled>
              WhatsApp ainda não configurado
            </button>
          )}

          <button className="button button-outline full-button" type="button" disabled>
            Agendamento em breve
          </button>
        </aside>
      </section>
    </main>
  );
}
