import React from "react";

export default function AdminRentalInterests() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Gestão de locações</span>
          <h1>Interessados</h1>
          <p>
            Contatos recebidos pelo site interessados em imóveis para locação.
          </p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="panel-title-row">
          <h2>Interessados em locação</h2>
        </div>

        <p>
          Os interessados enviados pelo site aparecerão aqui.
        </p>
      </section>
    </div>
  );
}
