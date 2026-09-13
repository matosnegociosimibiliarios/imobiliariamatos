import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDashboardMetrics,
  getLeadSources,
  getTopLeadProperties,
} from '../../services/admin';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [sources, setSources] = useState([]);
  const [topProperties, setTopProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [metricsResult, sourcesResult, topResult] = await Promise.all([
        getDashboardMetrics(30),
        getLeadSources(30),
        getTopLeadProperties(30),
      ]);

      setMetrics(metricsResult.data || null);
      setSources(sourcesResult.data || []);
      setTopProperties(topResult.data || []);
      setLoading(false);
    })();
  }, []);

  const cards = metrics
    ? [
        ['Visitantes únicos', metrics.unique_visitors],
        ['Visualizações', metrics.visits],
        ['Leads', metrics.leads],
        ['Agendamentos', metrics.appointments],
        ['Fechados', metrics.won],
        ['Visitante → lead', `${metrics.visitor_to_lead_rate}%`],
        ['Lead → visita', `${metrics.lead_to_appointment_rate}%`],
      ]
    : [];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Últimos 30 dias</span>
          <h1>Visão geral</h1>
        </div>

        <Link className="button" to="/admin/imoveis/novo">
          Novo imóvel
        </Link>
      </div>

      {loading ? (
        <div className="admin-panel">Carregando dados...</div>
      ) : (
        <>
          <div className="admin-stats admin-stats-wide">
            {cards.map(([label, value]) => (
              <article className="admin-stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <div className="admin-dashboard-grid">
            <section className="admin-panel">
              <h2>Origem dos leads</h2>

              {sources.length === 0 ? (
                <p>Ainda não há leads.</p>
              ) : (
                <div className="metric-list">
                  {sources.map((item) => (
                    <div key={item.source}>
                      <span>{item.source}</span>
                      <strong>{item.total}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-panel">
              <h2>Imóveis que mais geram leads</h2>

              {topProperties.length === 0 ? (
                <p>Ainda não há dados suficientes.</p>
              ) : (
                <div className="metric-list">
                  {topProperties.map((item) => (
                    <div key={item.property_id}>
                      <span>{item.code} — {item.title}</span>
                      <strong>{item.total}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      <section className="admin-panel">
        <h2>Ações rápidas</h2>

        <div className="admin-actions">
          <Link to="/admin/leads">Ver leads</Link>
          <Link to="/admin/agendamentos">Ver agendamentos</Link>
          <Link to="/admin/imoveis">Gerenciar imóveis</Link>
          <Link to="/admin/imoveis/novo">Cadastrar imóvel</Link>
        </div>
      </section>
    </div>
  );
}
