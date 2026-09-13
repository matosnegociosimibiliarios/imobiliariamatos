import React from 'react';
import PropertyFilters from '../components/PropertyFilters';
import EmptyProperties from '../components/EmptyProperties';

export default function Comprar() {
  return (
    <main className="listing-page">
      <section className="listing-hero">
        <span className="eyebrow">Comprar</span>
        <h1>Imóveis à venda</h1>
        <p>Encontre casas, apartamentos, terrenos, sítios e imóveis comerciais.</p>
      </section>

      <PropertyFilters finalidade="compra" />

      <section className="section listing-content">
        <div className="listing-toolbar">
          <div>
            <strong>0 imóveis encontrados</strong>
            <span>Os anúncios reais serão conectados depois.</span>
          </div>

          <label className="sort">
            Ordenar por
            <select defaultValue="recentes">
              <option value="recentes">Mais recentes</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
            </select>
          </label>
        </div>

        <EmptyProperties tipo="à venda" />
      </section>
    </main>
  );
}
