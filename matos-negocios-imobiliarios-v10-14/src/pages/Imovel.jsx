import React, { useEffect, useMemo, useState } from 'react';
import LeadForm from '../components/LeadForm';
import SeoHead from '../components/SeoHead';
import { trackEvent, trackPageView } from '../services/tracking';
import { Link, useParams } from 'react-router-dom';
import {
  getAgencySettings,
  getPropertyBySlug,
  getPropertyImages,
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
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

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

        trackPageView({
          path: window.location.pathname,
          pageType: 'property_detail',
          propertyId: propertyResult.data.id,
        });
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const images = useMemo(
    () => getPropertyImages(property),
    [property]
  );

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
    return (
      <main className="section">
        <div className="loading-box">Carregando imóvel...</div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="section">
        <div className="empty-state">
          <h1>Este imóvel não está disponível.</h1>
          <p>Ele pode ter sido removido ou ainda não estar publicado.</p>
          <Link className="button" to="/comprar">
            Ver outros imóveis
          </Link>
        </div>
      </main>
    );
  }

  const pricePurpose =
    property.purpose === 'rent'
      ? 'rent'
      : property.purpose === 'sale'
      ? 'sale'
      : undefined;

  const mainImage = images[0];
  const secondaryImages = images.slice(1, 5);

  function openGallery(index = 0) {
    setActivePhoto(index);
    setGalleryOpen(true);
  }

  function previousPhoto() {
    setActivePhoto((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  }

  function nextPhoto() {
    setActivePhoto((current) =>
      current === images.length - 1 ? 0 : current + 1
    );
  }


  async function shareProperty() {
    const url = window.location.href;
    const text = `${property.title} - ${propertyLocation(property)}`;
    trackEvent('share_click', { propertyId: property.id, metadata: { property_code: property.code } });
    if (navigator.share) {
      try { await navigator.share({ title: property.title, text, url }); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer');
  }

  const seoDescription = property.description?.slice(0, 155) || `${property.property_type} em ${propertyLocation(property)}. Veja preço, fotos e características.`;
  const propertyJsonLd = {
    '@context':'https://schema.org',
    '@type': property.property_type === 'Apartamento' ? 'Apartment' : property.property_type === 'Casa' ? 'House' : 'Place',
    name: property.title,
    description: seoDescription,
    url: window.location.href.split('?')[0],
    image: images.map((image) => image.publicUrl),
  };

  return (
    <main className="property-page">
      <SeoHead title={property.title} description={seoDescription} canonicalPath={`/imovel/${property.slug}`} image={mainImage?.publicUrl || null} type="article" jsonLd={propertyJsonLd} />
      <section className="property-top">
        <div>
          <Link className="back-link" to="/comprar">
            ← Voltar para imóveis
          </Link>

          <span className="eyebrow">{property.property_type}</span>

          <h1>{property.title}</h1>

          <p className="property-location">
            {propertyLocation(property)}
          </p>
        </div>

        <div className="property-top-actions"><button className="admin-link-button property-share-button" type="button" onClick={shareProperty}>Compartilhar</button><div className="property-code-box"><small>Código</small><strong>{property.code}</strong></div></div>
      </section>

      <section className="property-gallery">
        {mainImage ? (
          <button
            className="property-gallery-main"
            type="button"
            onClick={() => openGallery(0)}
          >
            <img
              src={mainImage.publicUrl}
              alt={mainImage.alt_text || property.title}
            />
          </button>
        ) : (
          <div className="property-photo-placeholder large">
            <span>⌂</span>
            <small>Nenhuma foto cadastrada</small>
          </div>
        )}

        {secondaryImages.length > 0 && (
          <div className="property-gallery-side">
            {secondaryImages.map((image, index) => (
              <button
                key={image.id}
                className="property-gallery-thumb"
                type="button"
                onClick={() => openGallery(index + 1)}
              >
                <img
                  src={image.publicUrl}
                  alt={image.alt_text || property.title}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {images.length > 1 && (
          <button
            className="gallery-button"
            type="button"
            onClick={() => openGallery(0)}
          >
            Ver todas as fotos ({images.length})
          </button>
        )}
      </section>

      <section className="property-main-grid">
        <div className="property-content">
          <div className="property-price-block">
            <span className="eyebrow">Valor</span>

            <h2>{propertyPrice(property, pricePurpose)}</h2>
          </div>

          <div className="property-facts">
            <Fact value={property.bedrooms} label="Quartos" />
            <Fact value={property.suites} label="Suítes" />
            <Fact value={property.bathrooms} label="Banheiros" />
            <Fact value={property.parking_spaces} label="Vagas" />

            <Fact
              value={
                property.total_area
                  ? `${property.total_area} m²`
                  : null
              }
              label="Área total"
            />
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
              {property.financing_allowed && (
                <span>Aceita financiamento</span>
              )}

              {property.exchange_allowed && (
                <span>Aceita troca</span>
              )}

              {property.furnished && <span>Mobiliado</span>}

              {features.map((feature) => (
                <span key={feature.id}>{feature.label}</span>
              ))}
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

          <p>
            Deixe seus dados para receber atendimento ou solicitar uma visita.
          </p>

          <LeadForm property={property} />

          {whatsappLink && (
            <a
              className="share-button"
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent('whatsapp_click', { propertyId: property.id, metadata: { property_code: property.code, source: 'property_page' } })}
            >
              Prefiro falar direto pelo WhatsApp
            </a>
          )}
        </aside>
      </section>

      {galleryOpen && images.length > 0 && (
        <div
          className="gallery-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Galeria de fotos do imóvel"
        >
          <button
            className="gallery-close"
            type="button"
            onClick={() => setGalleryOpen(false)}
            aria-label="Fechar galeria"
          >
            ×
          </button>

          <button
            className="gallery-nav gallery-prev"
            type="button"
            onClick={previousPhoto}
            aria-label="Foto anterior"
          >
            ‹
          </button>

          <img
            className="gallery-modal-image"
            src={images[activePhoto].publicUrl}
            alt={images[activePhoto].alt_text || property.title}
          />

          <button
            className="gallery-nav gallery-next"
            type="button"
            onClick={nextPhoto}
            aria-label="Próxima foto"
          >
            ›
          </button>

          <div className="gallery-counter">
            {activePhoto + 1} / {images.length}
          </div>
        </div>
      )}
    </main>
  );
}
