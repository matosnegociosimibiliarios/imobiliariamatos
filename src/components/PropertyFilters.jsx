import React from 'react';
export default function PropertyFilters({ finalidade, values, onChange, onSubmit, onClear }) {
  return <section className="filters-panel" aria-label={`Filtros de imóveis para ${finalidade}`}><form className="filters-grid" onSubmit={onSubmit}>
    <label>Cidade ou bairro<input name="location" value={values.location} onChange={onChange} placeholder="Ex.: Ressaquinha ou Centro" /></label>
    <label>Tipo de imóvel<select name="propertyType" value={values.propertyType} onChange={onChange}><option value="">Todos os tipos</option><option>Casa</option><option>Apartamento</option><option>Terreno</option><option>Sítio</option><option>Comercial</option></select></label>
    <label>Quartos mínimos<select name="bedrooms" value={values.bedrooms} onChange={onChange}><option value="">Qualquer</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></label>
    <div className="filter-actions"><button className="button filter-button" type="submit">Aplicar filtros</button><button className="filter-clear" type="button" onClick={onClear}>Limpar</button></div>
  </form></section>;
}
