import React from 'react';

export default function AdminRentals() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">LOCAÇÃO</span>
          <h1>Painel de locação</h1>
          <p>Área separada para a operação de aluguel. A estrutura funcional será criada na próxima etapa.</p>
        </div>
      </header>

      <section className="admin-card admin-placeholder-card">
        <span className="status-badge pending">Em preparação</span>
        <h2>Locação terá um fluxo próprio</h2>
        <p>
          Nesta área vamos concentrar imóveis para aluguel, interessados, propostas de locação,
          contratos, vistorias, vencimentos, repasses e acompanhamento do locatário sem misturar
          esses processos com a venda de imóveis.
        </p>
      </section>
    </div>
  );
}
