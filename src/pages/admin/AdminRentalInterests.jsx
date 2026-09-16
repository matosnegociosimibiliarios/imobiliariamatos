import React from "react";
import { Link } from "react-router-dom";

export default function AdminRentalInterests() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Gestão de locações</span>
          <h1>Interessados</h1>
          <p>Pessoas interessadas em alugar imóveis.</p>
        </div>

        <button className="button" type="button">
          + Novo interessado
        </button>
      </div>

      <section className="admin-panel">
        <div className="panel-title-row">
          <h2>Interessados em locação</h2>
          <span>0</span>
        </div>

        <input
          type="search"
          placeholder="Buscar por nome, CPF, telefone ou e-mail..."
        />

        <p style={{ marginTop: 24 }}>
          Nenhum interessado cadastrado ainda.
        </p>
      </section>

      <div style={{ marginTop: 20 }}>
        <Link className="admin-link-button" to="/admin">
          Voltar
        </Link>
      </div>
    </div>
  );
}
