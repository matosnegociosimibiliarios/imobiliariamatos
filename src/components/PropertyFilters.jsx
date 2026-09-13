import React from 'react';

export default function PropertyFilters({ finalidade }) {
  return (
    <section className="filters-panel" aria-label={`Filtros de imóveis para ${finalidade}`}>
      <div className="filters-grid">
        <label>
          Cidade
          <input placeholder="Digite a cidade" />
        </label>

        <label>
          Bairro
          <input placeholder="Digite o bairro" />
        </label>

        <label>
          Tipo de imóvel
          <select defaultValue="">
            <option value="">Todos os tipos</option>
            <option>Casa</option>
            <option>Apartamento</option>
            <option>Terreno</option>
            <option>Sítio</option>
            <option>Comercial</option>
          </select>
        </label>

        <label>
          Preço mínimo
          <input inputMode="numeric" placeholder="R$ 0" />
        </label>

        <label>
          Preço máximo
          <input inputMode="numeric" placeholder="Sem limite" />
        </label>

        <label>
          Quartos
          <select defaultValue="">
            <option value="">Qualquer</option>
            <option>1+</option>
            <option>2+</option>
            <option>3+</option>
            <option>4+</option>
          </select>
        </label>

        <label>
          Vagas
          <select defaultValue="">
            <option value="">Qualquer</option>
            <option>1+</option>
            <option>2+</option>
            <option>3+</option>
          </select>
        </label>

        <button className="button filter-button">Buscar imóveis</button>
      </div>
    </section>
  );
}
