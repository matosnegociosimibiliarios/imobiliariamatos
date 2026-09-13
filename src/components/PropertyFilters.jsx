import React from 'react';

export default function PropertyFilters({ finalidade }) {
  return (
    <section className="filters-panel" aria-label={`Filtros de imóveis para ${finalidade}`}>
      <div className="filters-grid">
        <label>
          Cidade
          <input placeholder="Filtro será ativado na próxima etapa" disabled />
        </label>

        <label>
          Bairro
          <input placeholder="Filtro será ativado na próxima etapa" disabled />
        </label>

        <label>
          Tipo de imóvel
          <select disabled defaultValue="">
            <option value="">Todos os tipos</option>
          </select>
        </label>

        <button className="button filter-button" disabled>
          Filtros em preparação
        </button>
      </div>
    </section>
  );
}
