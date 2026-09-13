import React from 'react';
import { Link } from 'react-router-dom';
import PropertyFilters from '../components/PropertyFilters';
import EmptyProperties from '../components/EmptyProperties';

export default function Alugar() {
  return (
    <main className="listing-page">
      <section className="listing-hero">
        <span className="eyebrow">Alugar</span>
        <h1>Imóveis para alugar</h1>
        <p>Pesquise opções de locação de forma simples e organizada.</p>
      </section>

      <PropertyFilters finalidade="aluguel" />

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

        <EmptyProperties tipo="para alugar" />
        <div className="model-preview">
          <span>Quer visualizar como ficará um anúncio?</span>
          <Link className="button" to="/imovel/modelo">Ver página modelo do imóvel</Link>
        </div>
      </section>
    </main>
  );
}
