import React from 'react';
import { Link } from 'react-router-dom';
import {
  getCoverImage,
  propertyLocation,
  propertyPrice,
} from '../services/properties';

function Fact({ value, label }) {
  if (value === null || value === undefined) return null;
  return (
    <span className="property-card-fact">
      <strong>{value}</strong> {label}
    </span>
  );
}

export default function PropertyCard({ property, purpose }) {
  const cover = getCoverImage(property);

  return (
    <article className="property-card">
      <Link className="property-card-image" to={`/imovel/${property.slug}`}>
        {cover?.publicUrl ? (
          <img
            src={cover.publicUrl}
            alt={cover.alt_text || property.title}
            loading="lazy"
          />
        ) : (
          <span className="property-card-placeholder">⌂</span>
        )}

        {property.featured && (
          <span className="property-card-badge">Destaque</span>
        )}
      </Link>

      <div className="property-card-body">
        <div className="property-card-code">{property.code}</div>

        <h3>
          <Link to={`/imovel/${property.slug}`}>{property.title}</Link>
        </h3>

        <p className="property-card-location">
          {propertyLocation(property)}
        </p>

        <div className="property-card-price">
          {propertyPrice(property, purpose)}
        </div>

        <div className="property-card-facts">
          <Fact value={property.bedrooms} label="quartos" />
          <Fact value={property.bathrooms} label="banheiros" />
          <Fact value={property.parking_spaces} label="vagas" />
          <Fact
            value={property.total_area ? `${property.total_area} m²` : null}
            label=""
          />
        </div>

        <Link
          className="button full-button property-card-button"
          to={`/imovel/${property.slug}`}
        >
          Ver imóvel
        </Link>
      </div>
    </article>
  );
}
