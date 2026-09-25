import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCommercialFunnelMetrics } from '../../services/admin';
import { formatCurrency } from '../../services/crm';

const STAGE_COLORS = { new: 'new', contacted: 'contacted', qualified: 'qualified', visit_scheduled: 'visit', proposal: 'proposal', won: 'won', lost: 'lost' };
const SOURCE_LABELS = { site: 'Site', instagram: 'Instagram', whatsapp: 'WhatsApp', facebook: 'Facebook', meta: 'Meta', manual: 'Manual' };

export default function AdminCommercialFunnel() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');
    const result = await getCommercialFunnelMetrics(period);
    if (result.error) {
      setMessage('Não foi possível carregar o funil comercial.');
      setData(null);
    } else setData(result.data || null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [period]);

  const stages = data?.stages || [];
  const summary = data?.summary || {};
  const maxStage = useMemo(
    () => Math.max(...stages.filter((stage) => stage.value !== 'lost').map((stage) => Number(stage.count || 0)), 1),
    [stages]
  );

  const attention = [
    { label: 'Ações vencidas', value: summary.overdue_actions || 0, to: '/admin/acoes', tone: 'danger' },
    { label: 'Leads parados há 7+ dias', value: summary.stale_leads || 0, to: '/admin/leads', tone: 'warning' },
    { label: 'Visitas nos próximos 7 dias', value: summary.upcoming_appointments || 0, to: '/admin/agendamentos', tone: 'info' },
  ];

  return (
    <div className="admin-page commercial-funnel-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Comando comercial</span>
          <h1>Funil Comercial</h1>
          <p>Visão única do fluxo de leads, visitas, propostas e fechamentos.</p>
        </div>
        <div className="commercial-funnel-actions">
          <select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
          </select>
          <Link className="button" to="/admin/leads">Abrir leads</Link>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      {loading ? <section className="admin-panel">Carregando funil comercial...</section> : (
        <>
          <section className="commercial-funnel-summary">
            <article><span>Leads no período</span><strong>{summary.leads || 0}</strong></article>
            <article><span>Leads ativos</span><strong>{summary.active || 0}</strong></article>
            <article><span>Fechados no período</span><strong>{summary.won || 0}</strong></article>
            <article><span>Perdidos no período</span><strong>{summary.lost || 0}</strong></article>
            {summary.proposals_access && <article><span>Propostas abertas</span><strong>{summary.open_proposals || 0}</strong></article>}
            {summary.deals_access && <article><span>Valor vendido</span><strong>{formatCurrency(summary.won_value || 0)}</strong></article>}
          </section>

          <section className="admin-panel">
            <div className="panel-title-row">
              <div><span className="eyebrow">Distribuição atual</span><h2>Pipeline de clientes</h2></div>
              <span>{summary.active || 0} ativos</span>
            </div>

            <div className="commercial-funnel-board">
              {stages.filter((stage) => stage.value !== 'lost').map((stage) => (
                <Link key={stage.value} to={'/admin/leads?status=' + stage.value} className={'commercial-funnel-stage ' + (STAGE_COLORS[stage.value] || '')}>
                  <div className="commercial-funnel-stage-top"><strong>{stage.label}</strong><b>{stage.count}</b></div>
                  <div className="commercial-funnel-bar"><span style={{ width: (stage.count ? Math.max((Number(stage.count || 0) / maxStage) * 100, 8) : 0) + '%' }} /></div>
                  <div className="commercial-funnel-stage-meta"><span>{stage.stale || 0} parados</span><span>{stage.overdue_actions || 0} ações vencidas</span></div>
                </Link>
              ))}
            </div>

            {(() => {
              const lost = stages.find((stage) => stage.value === 'lost');
              return lost ? (
                <div className="commercial-funnel-lost">
                  <span>Perdidos no pipeline</span><strong>{lost.count}</strong><Link to="/admin/leads">Ver motivos e recuperar oportunidades</Link>
                </div>
              ) : null;
            })()}
          </section>

          <div className="commercial-funnel-grid">
            <section className="admin-panel">
              <div className="panel-title-row"><div><span className="eyebrow">Atenção imediata</span><h2>Gargalos operacionais</h2></div></div>
              <div className="commercial-attention-list">
                {attention.map((item) => <Link key={item.label} to={item.to} className={'commercial-attention-item ' + item.tone}><span>{item.label}</span><strong>{item.value}</strong></Link>)}
              </div>
            </section>

            <section className="admin-panel">
              <div className="panel-title-row"><div><span className="eyebrow">Aquisição</span><h2>Origem dos leads</h2></div><span>{period} dias</span></div>
              <div className="commercial-source-list">
                {(data?.sources || []).slice(0, 6).map((item) => <div key={item.source}><span>{SOURCE_LABELS[item.source] || item.source}</span><strong>{item.count}</strong></div>)}
                {!data?.sources?.length && <p>Nenhum lead no período.</p>}
              </div>
            </section>
          </div>

          <section className="commercial-funnel-links">
            <Link to="/admin/acoes">Rotina de Hoje <span>Priorize as próximas ações</span></Link>
            <Link to="/admin/propostas">Propostas <span>Negociação e retornos</span></Link>
            <Link to="/admin/negocios">Negócios <span>Pós-venda e comissão</span></Link>
            <Link to="/admin/agendamentos">Agendamentos <span>Visitas e atendimento</span></Link>
          </section>
        </>
      )}
    </div>
  );
}
