import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  getDashboardMetrics,
  getLeadSources,
  getLostReasons,
  getTopLeadProperties,
  getUpcomingActions,
  getAcquisitionMetrics,
  getChannelPerformance,
  getDailyRoutineData,
  getExecutiveDashboardMetrics,
} from '../../services/admin';
import {
  formatCurrency,
  formatDateTime,
  originLabel,
} from '../../services/crm';
import { buildRoutine } from '../../services/routine';

export default function AdminDashboard() {
  const { access } = useOutletContext();
  const [metrics, setMetrics] = useState(null);
  const [sources, setSources] = useState([]);
  const [lostReasons, setLostReasons] = useState([]);
  const [topProperties, setTopProperties] = useState([]);
  const [actions, setActions] = useState([]);
  const [acquisition, setAcquisition] = useState(null);
  const [channelPerformance, setChannelPerformance] = useState([]);
  const [routineSummary, setRoutineSummary] = useState(null);
  const [executive, setExecutive] = useState(null);
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
        routineResult,
        executiveResult,
      ] = await Promise.all([
        getDashboardMetrics(30),
        getLeadSources(30),
        getLostReasons(90),
        getTopLeadProperties(30),
        getUpcomingActions(),
        getAcquisitionMetrics(30),
        getChannelPerformance(30),
        getDailyRoutineData(),
        getExecutiveDashboardMetrics(30),
      ]);

      setMetrics(metricsResult.data || null);
      setSources(sourcesResult.data || []);
      setLostReasons(lostResult.data || []);
      setTopProperties(topResult.data || []);
      setActions((actionsResult.data || []).slice(0, 5));
      setAcquisition(acquisitionResult.data || null);
      setChannelPerformance(channelResult.data || []);
      setRoutineSummary(buildRoutine(routineResult.data || {}).counts);
      setExecutive(executiveResult.data || null);
      setLoading(false);
    })();
  }, []);

  const cards = metrics
    ? [
        ['Visitantes únicos', metrics.unique_visitors],
        ['Leads', metrics.leads],
        ['Agendamentos', metrics.appointments],
        ['Propostas em aberto', routineSummary?.proposals || 0],
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
          <span className="eyebrow">Seu dia no CRM</span>
          <h1>Início</h1>
          <p>Veja primeiro o que precisa da sua atenção e acesse as funções mais usadas.</p>
        </div>

        <div className="admin-actions home-quick-actions">
          <Link className="button home-primary-action" to="/admin/acoes">Rotina de hoje</Link>
          <Link to="/admin/agenda">Nova tarefa</Link>
          <Link to="/admin/imoveis/novo">Novo imóvel</Link>
          <Link to="/admin/captacoes">Nova captação</Link>
          <div className="home-user-chip"><strong>{access?.full_name || access?.email || 'Usuário'}</strong><small>{access?.role === 'owner' ? 'Proprietário' : access?.role === 'admin' ? 'Administrador' : access?.role === 'broker' ? 'Corretor' : 'Assistente'}</small></div>
          <a href="/" target="_blank" rel="noreferrer">Ver Site Público</a>
          <Link className="home-paid-version" to="/admin/plano">Planos e assinatura</Link>
        </div>
      </div>

      {loading ? (
        <div className="admin-panel">Carregando dados...</div>
      ) : (
        <>
          <section className="admin-panel routine-dashboard-panel">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Centro de comando</span>
            <h2>O que precisa de atenção hoje</h2>
          </div>
          <Link to="/admin/acoes">Abrir rotina</Link>
        </div>

        <div className="routine-dashboard-grid">
          <Link to="/admin/acoes#atrasadas"><span>Ações atrasadas</span><strong>{routineSummary?.overdue || 0}</strong></Link>
          <Link to="/admin/acoes#hoje"><span>Ações para hoje</span><strong>{routineSummary?.today || 0}</strong></Link>
          <Link to="/admin/acoes#visitas"><span>Visitas hoje</span><strong>{routineSummary?.visits || 0}</strong></Link>
          <Link to="/admin/acoes#sem-acao"><span>Sem próxima ação</span><strong>{routineSummary?.no_next_action || 0}</strong></Link>
          <Link to="/admin/acoes#propostas"><span>Propostas abertas</span><strong>{routineSummary?.proposals || 0}</strong></Link>
          <Link to="/admin/acoes#retornos-propostas"><span>Retornos de propostas</span><strong>{routineSummary?.proposal_followups || 0}</strong></Link>
          <Link to="/admin/acoes#propostas-vencendo"><span>Propostas vencendo</span><strong>{routineSummary?.proposal_expiring || 0}</strong></Link>
        </div>
      </section>
          <div className="admin-stats admin-stats-wide">
            {cards.slice(0, 8).map(([label, value]) => (
              <article className="admin-stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>
            ))}
          </div>

          <div className="admin-dashboard-grid">
            <section className="admin-panel">
              <div className="panel-title-row"><h2>Próximas ações</h2><Link to="/admin/acoes">Ver todas</Link></div>
              {actions.length === 0 ? <p>Nenhuma ação cadastrada.</p> : <div className="metric-list">{actions.map((item) => <Link className="dashboard-action-row" to={`/admin/leads/${item.id}`} key={item.id}><span><strong>{item.name}</strong><small>{item.next_action_text || 'Atender cliente'}</small></span><b>{formatDateTime(item.next_action_at)}</b></Link>)}</div>}
            </section>
            <section className="admin-panel">
              <div className="panel-title-row"><h2>Acessos rápidos</h2></div>
              <div className="home-shortcuts">
                <Link to="/admin/leads">Clientes e Leads</Link><Link to="/admin/funil">Funil Comercial</Link><Link to="/admin/mensagens">Instagram</Link><Link to="/admin/whatsapp">WhatsApp</Link><Link to="/admin/propostas">Propostas</Link>{access?.plan_code !== 'starter' && <Link to="/admin/locacoes">Locação</Link>}{access?.plan_code !== 'starter' && <Link to="/admin/financeiro">Financeiro</Link>}<Link to="/admin/gestao">Painel Gerencial</Link>
              </div>
            </section>
          </div>

          {executive && <section className="admin-panel"><div className="panel-title-row"><div><span className="eyebrow">Resumo executivo</span><h2>Situação do negócio</h2></div><Link to="/admin/gestao">Ver painel gerencial</Link></div><div className="management-metrics-grid"><div className="admin-card"><span>Valor vendido</span><strong>{formatCurrency(executive.commercial?.won_value || 0)}</strong></div><div className="admin-card"><span>Comissão a receber</span><strong>{formatCurrency(executive.commercial?.commission_receivable || 0)}</strong></div><div className="admin-card"><span>Resultado de caixa</span><strong>{formatCurrency(Number(executive.finance?.income_paid || 0)-Number(executive.finance?.expense_paid || 0))}</strong></div><div className="admin-card"><span>Propostas abertas</span><strong>{executive.commercial?.open_proposals || 0}</strong></div></div></section>}
        </>
      )}
    </div>
  );
}
