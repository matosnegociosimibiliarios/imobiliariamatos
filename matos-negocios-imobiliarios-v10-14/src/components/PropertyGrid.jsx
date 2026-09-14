import React from 'react';
import PropertyCard from './PropertyCard';

export default function PropertyGrid({ properties, purpose }) {
  if (!properties?.length) return null;

  return (
    <div className="property-grid">
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          purpose={purpose}
        />
      ))}
    </div>
  );
}
