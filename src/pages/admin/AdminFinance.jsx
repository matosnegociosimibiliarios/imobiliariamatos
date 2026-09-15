import React from 'react';

export default function AdminFinance() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">FINANCEIRO</span>
          <h1>Financeiro da empresa</h1>
          <p>Área reservada para o controle financeiro interno da imobiliária.</p>
        </div>
      </header>

      <section className="admin-card admin-placeholder-card">
        <span className="status-badge pending">Estrutura criada</span>
        <h2>O financeiro será desenvolvido separadamente</h2>
        <p>
          Futuramente esta área poderá reunir receitas, despesas, contas a pagar e receber,
          fluxo de caixa, comissões, custos da operação e indicadores financeiros da empresa.
          Nenhum lançamento financeiro é criado nesta versão.
        </p>
      </section>
    </div>
  );
}
