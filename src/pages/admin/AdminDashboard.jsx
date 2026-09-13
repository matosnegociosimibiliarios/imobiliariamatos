import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminStats } from '../../services/admin';

const labels = {
  published: 'Publicados',
  draft: 'Rascunhos',
  sold: 'Vendidos',
  rented: 'Alugados',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await getAdminStats();
      setStats(result);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Painel administrativo</span>
          <h1>Visão geral</h1>
        </div>

        <Link className="button" to="/admin/imoveis/novo">
          Novo imóvel
        </Link>
      </div>

      {loading ? (
        <div className="admin-panel">Carregando dados...</div>
      ) : (
        <div className="admin-stats">
          {stats.map((item) => (
            <article className="admin-stat-card" key={item.status}>
              <span>{labels[item.status]}</span>
              <strong>{item.count}</strong>
            </article>
          ))}
        </div>
      )}

      <section className="admin-panel">
        <h2>Ações rápidas</h2>

        <div className="admin-actions">
          <Link to="/admin/imoveis">Gerenciar imóveis</Link>
          <Link to="/admin/imoveis/novo">Cadastrar novo imóvel</Link>
          <a href="/" target="_blank" rel="noreferrer">Abrir site público</a>
        </div>
      </section>
    </div>
  );
}
