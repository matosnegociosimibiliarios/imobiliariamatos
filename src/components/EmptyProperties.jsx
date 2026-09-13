import React from 'react';

export default function EmptyProperties({ tipo }) {
  return (
    <div className="empty-state property-empty">
      <div className="empty-icon">⌂</div>
      <h3>Nenhum imóvel {tipo} publicado ainda</h3>
      <p>
        A página já está pronta. Quando conectarmos o banco de imóveis, os anúncios reais
        aparecerão automaticamente aqui.
      </p>
    </div>
  );
}
