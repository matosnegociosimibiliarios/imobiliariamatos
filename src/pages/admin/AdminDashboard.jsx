import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDashboardMetrics,
  getLeadSources,
  getLostReasons,
  getTopLeadProperties,
  getUpcomingActions,
  getAcquisitionMetrics,
  getChannelPerformance,
} from '../../services/admin';
import {
  formatCurrency,
  formatDateTime,
  originLabel,
} from '../../services/crm';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [sources, setSources] = useState([]);
  const [lostReasons, setLostReasons] = useState([]);
  const [topProperties, setTopProperties] = useState([]);
  const [actions, setActions] = useState([]);
  const [acquisition, setAcquisition] = useState(null);
  const [channelPerformance, setChannelPerformance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        metricsResult,
        sourcesResult,
        lostResult,
        topResult,
        actionsResult,
        acquisitionResult,
        channelResult,
      ] = await Promise.all([
        getDashboardMetrics(30),
        getLeadSources(30),
        getLostReasons(90),
        getTopLeadProperties(30),
        getUpcomingActions(),
        getAcquisitionMetrics(30),
        getChannelPerformance(30),
      ]);

      setMetrics(metricsResult.data || null);
      setSources(sourcesResult.data || []);
      setLostReasons(lostResult.data || []);
      setTopProperties(topResult.data || []);
      setActions((actionsResult.data || []).slice(0, 5));
      setAcquisition(acquisitionResult.data || null);
      setChannelPerformance(channelResult.data || []);
      setLoading(false);
    })();
  }, []);

  const cards = metrics
    ? [
        ['Visitantes únicos', metrics.unique_visitors],
        ['Leads', metrics.leads],
        ['Agendamentos', metrics.appointments],
        ['Propostas', metrics.proposals],
        ['Fechados', metrics.won],
        ['Lead → venda', `${metrics.lead_to_won_rate}%`],
        ['Valor fechado', formatCurrency(metrics.won_value)],
        ['Comissão', formatCurrency(metrics.commission_value)],
        ['Captações', metrics.captures],
        ['Captações novas', metrics.capture_new],
        ['Autorizados', metrics.capture_authorized],
        ['Imóveis publicados', metrics.capture_published],
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
              <div className="panel-title-row">
                <h2>Próximas ações</h2>
                <Link to="/admin/acoes">Ver todas</Link>
              </div>

              {actions.length === 0 ? (
                <p>Nenhuma ação cadastrada.</p>
              ) : (
                <div className="metric-list">
                  {actions.map((item) => (
                    <Link
                      className="dashboard-action-row"
                      to={`/admin/leads/${item.id}`}
                      key={item.id}
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.next_action_text || 'Atender cliente'}
                        </small>
                      </span>

                      <b>{formatDateTime(item.next_action_at)}</b>
                    </Link>
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
              <h2>Por que perdemos clientes?</h2>

              {lostReasons.length === 0 ? (
                <p>Ainda não há negócios marcados como perdidos.</p>
              ) : (
                <div className="metric-list">
                  {lostReasons.map((item) => (
                    <div key={item.reason}>
                      <span>{item.reason}</span>
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
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Origem dos resultados</span>
            <h2>Desempenho por canal nos últimos 30 dias</h2>
          </div>
        </div>

        {channelPerformance.length === 0 ? (
          <p>Ainda não há dados suficientes.</p>
        ) : (
          <div className="channel-performance-table-wrap">
            <table className="channel-performance-table">
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Leads</th>
                  <th>Visitas</th>
                  <th>Fechados</th>
                  <th>Valor fechado</th>
                  <th>Comissão</th>
                </tr>
              </thead>
              <tbody>
                {channelPerformance.map((item) => (
                  <tr key={`${item.platform}-${item.channel}`}>
                    <td>{originLabel(item.platform, item.channel)}</td>
                    <td>{item.leads}</td>
                    <td>{item.appointments}</td>
                    <td>{item.won}</td>
                    <td>{formatCurrency(item.deal_value)}</td>
                    <td>{formatCurrency(item.commission_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="panel-title-row"><div><span className="eyebrow">Aquisição</span><h2>Interações nos últimos 30 dias</h2></div><Link to="/admin/integracoes">Instagram / Meta</Link></div>
        <div className="acquisition-grid">
          <div><span>Buscas no site</span><strong>{acquisition?.search_clicks || 0}</strong></div>
          <div><span>Cliques no WhatsApp</span><strong>{acquisition?.whatsapp_clicks || 0}</strong></div>
          <div><span>Leads do site</span><strong>{acquisition?.lead_submits || 0}</strong></div>
          <div><span>Pedidos de visita</span><strong>{acquisition?.appointment_submits || 0}</strong></div>
          <div><span>Instagram Direct</span><strong>{acquisition?.instagram_direct_leads || 0}</strong></div>
          <div><span>Meta Lead Ads</span><strong>{acquisition?.meta_lead_ads || 0}</strong></div>
        </div>
      </section>
      <section className="admin-panel">
        <h2>Ações rápidas</h2>

        <div className="admin-actions">
          <Link to="/admin/mensagens">Mensagens Instagram</Link>
          <Link to="/admin/leads">Abrir funil</Link>
          <Link to="/admin/acoes">Próximas ações</Link>
          <Link to="/admin/agendamentos">Agendamentos</Link>
          <Link to="/admin/captacoes">Captações</Link>
          <Link to="/admin/imoveis">Imóveis</Link>
        </div>
      </section>
    </div>
  );
}
