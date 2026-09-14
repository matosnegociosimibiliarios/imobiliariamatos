import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency, originLabel } from '../../services/crm';
import {
  getManagementChannels,
  getManagementMetrics,
  getManagementTrend,
  getMonthlyGoal,
  saveMonthlyGoal,
} from '../../services/management';

const EMPTY_GOAL = {
  leads_goal: 0,
  visits_goal: 0,
  captures_goal: 0,
  proposals_goal: 0,
  deals_goal: 0,
  sales_value_goal: 0,
  commission_goal: 0,
  notes: '',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthBounds(value) {
  const [year, month] = value.split('-').map(Number);
  const start = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { start, end, periodMonth: start, year, month, lastDay };
}

function monthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function trendMonthLabel(value) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function GoalCard({ label, actual, goal, currency = false, expectedProgress = 100 }) {
  const actualNumber = numberValue(actual);
  const goalNumber = numberValue(goal);
  const rawProgress = goalNumber > 0 ? (actualNumber / goalNumber) * 100 : 0;
  const progress = Math.max(0, Math.min(rawProgress, 100));
  const onPace = goalNumber > 0 && rawProgress + 2 >= expectedProgress;

  return (
    <article className="management-goal-card">
      <div className="management-goal-head">
        <span>{label}</span>
        {goalNumber > 0 ? (
          <small className={onPace ? 'goal-on-pace' : 'goal-behind'}>
            {rawProgress >= 100 ? 'Meta atingida' : onPace ? 'No ritmo' : 'Abaixo do ritmo'}
          </small>
        ) : (
          <small>Sem meta</small>
        )}
      </div>
      <strong>{currency ? formatCurrency(actualNumber) : actualNumber}</strong>
      <div className="management-goal-target">
        <span>Meta: {goalNumber > 0 ? (currency ? formatCurrency(goalNumber) : goalNumber) : 'não definida'}</span>
        {goalNumber > 0 && <b>{Math.round(rawProgress)}%</b>}
      </div>
      <div className="management-progress-track" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>
    </article>
  );
}

export default function AdminManagement() {
  const [period, setPeriod] = useState(monthValue());
  const [metrics, setMetrics] = useState(null);
  const [goal, setGoal] = useState(EMPTY_GOAL);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL);
  const [channels, setChannels] = useState([]);
  const [trend, setTrend] = useState([]);
  const [editingGoals, setEditingGoals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const bounds = useMemo(() => monthBounds(period), [period]);

  const expectedProgress = useMemo(() => {
    const now = new Date();
    const current = monthValue(now);
    if (period < current) return 100;
    if (period > current) return 0;
    return Math.min(100, (now.getDate() / bounds.lastDay) * 100);
  }, [period, bounds.lastDay]);

  async function loadData() {
    setLoading(true);
    setMessage('');

    const [metricResult, goalResult, channelResult, trendResult] = await Promise.all([
      getManagementMetrics(bounds.start, bounds.end),
      getMonthlyGoal(bounds.periodMonth),
      getManagementChannels(bounds.start, bounds.end),
      getManagementTrend(6),
    ]);

    if (metricResult.error || goalResult.error || channelResult.error || trendResult.error) {
      const error = metricResult.error || goalResult.error || channelResult.error || trendResult.error;
      setMessage(`Não foi possível carregar o painel: ${error.message}`);
    }

    const nextGoal = goalResult.data ? { ...EMPTY_GOAL, ...goalResult.data } : { ...EMPTY_GOAL };
    setMetrics(metricResult.data || null);
    setGoal(nextGoal);
    setGoalForm(nextGoal);
    setChannels(channelResult.data || []);
    setTrend(trendResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [period]);

  async function handleSaveGoals(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const payload = {
      leads_goal: numberValue(goalForm.leads_goal),
      visits_goal: numberValue(goalForm.visits_goal),
      captures_goal: numberValue(goalForm.captures_goal),
      proposals_goal: numberValue(goalForm.proposals_goal),
      deals_goal: numberValue(goalForm.deals_goal),
      sales_value_goal: numberValue(goalForm.sales_value_goal),
      commission_goal: numberValue(goalForm.commission_goal),
      notes: goalForm.notes?.trim() || null,
    };

    const result = await saveMonthlyGoal(bounds.periodMonth, payload);
    setSaving(false);

    if (result.error) {
      setMessage(`Não foi possível salvar as metas: ${result.error.message}`);
      return;
    }

    const nextGoal = { ...EMPTY_GOAL, ...result.data };
    setGoal(nextGoal);
    setGoalForm(nextGoal);
    setEditingGoals(false);
    setMessage('Metas salvas com sucesso.');
  }

  const goalCards = [
    ['Leads', metrics?.leads, goal.leads_goal, false],
    ['Visitas realizadas', metrics?.visits_completed, goal.visits_goal, false],
    ['Captações', metrics?.captures, goal.captures_goal, false],
    ['Propostas', metrics?.proposals, goal.proposals_goal, false],
    ['Negócios fechados', metrics?.deals, goal.deals_goal, false],
    ['Valor vendido', metrics?.sales_value, goal.sales_value_goal, true],
    ['Comissão gerada', metrics?.commission_generated, goal.commission_goal, true],
  ];

  return (
    <div className="admin-page management-page">
      <div className="admin-page-header management-header">
        <div>
          <span className="eyebrow">Gestão e metas</span>
          <h1>Painel gerencial</h1>
          <p>Acompanhe o funil, o resultado financeiro e o avanço das metas.</p>
        </div>

        <div className="management-period-controls">
          <label>
            Mês analisado
            <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </label>
          <button className="button" type="button" onClick={() => setEditingGoals((value) => !value)}>
            {editingGoals ? 'Fechar metas' : 'Definir metas'}
          </button>
        </div>
      </div>

      {message && <div className="admin-panel management-message">{message}</div>}

      {editingGoals && (
        <section className="admin-panel management-goal-editor">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">{monthLabel(period)}</span>
              <h2>Metas do mês</h2>
            </div>
          </div>

          <form onSubmit={handleSaveGoals}>
            <div className="management-goal-form-grid">
              <label>Leads<input type="number" min="0" value={goalForm.leads_goal} onChange={(e) => setGoalForm({ ...goalForm, leads_goal: e.target.value })} /></label>
              <label>Visitas realizadas<input type="number" min="0" value={goalForm.visits_goal} onChange={(e) => setGoalForm({ ...goalForm, visits_goal: e.target.value })} /></label>
              <label>Captações<input type="number" min="0" value={goalForm.captures_goal} onChange={(e) => setGoalForm({ ...goalForm, captures_goal: e.target.value })} /></label>
              <label>Propostas<input type="number" min="0" value={goalForm.proposals_goal} onChange={(e) => setGoalForm({ ...goalForm, proposals_goal: e.target.value })} /></label>
              <label>Negócios fechados<input type="number" min="0" value={goalForm.deals_goal} onChange={(e) => setGoalForm({ ...goalForm, deals_goal: e.target.value })} /></label>
              <label>Valor vendido (R$)<input type="number" min="0" step="0.01" value={goalForm.sales_value_goal} onChange={(e) => setGoalForm({ ...goalForm, sales_value_goal: e.target.value })} /></label>
              <label>Comissão gerada (R$)<input type="number" min="0" step="0.01" value={goalForm.commission_goal} onChange={(e) => setGoalForm({ ...goalForm, commission_goal: e.target.value })} /></label>
            </div>
            <label className="management-goal-notes">Observações<textarea rows="3" value={goalForm.notes || ''} onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })} placeholder="Ex.: foco em captação de casas em Ressaquinha." /></label>
            <div className="admin-actions">
              <button className="button" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar metas'}</button>
              <button type="button" onClick={() => { setGoalForm(goal); setEditingGoals(false); }}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="admin-panel">Carregando painel gerencial...</div>
      ) : (
        <>
          <section className="admin-panel">
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">{monthLabel(period)}</span>
                <h2>Metas x realizado</h2>
              </div>
              {period === monthValue() && <small>{Math.round(expectedProgress)}% do mês transcorrido</small>}
            </div>
            <div className="management-goals-grid">
              {goalCards.map(([label, actual, target, currency]) => (
                <GoalCard key={label} label={label} actual={actual || 0} goal={target || 0} currency={currency} expectedProgress={expectedProgress} />
              ))}
            </div>
          </section>

          <section className="management-summary-grid">
            <article className="admin-panel management-financial-card">
              <span>Valor vendido</span>
              <strong>{formatCurrency(metrics?.sales_value || 0)}</strong>
              <small>{metrics?.deals || 0} negócio(s) no período</small>
            </article>
            <article className="admin-panel management-financial-card">
              <span>Comissão gerada</span>
              <strong>{formatCurrency(metrics?.commission_generated || 0)}</strong>
              <small>Prevista nos negócios fechados</small>
            </article>
            <article className="admin-panel management-financial-card">
              <span>Comissão recebida</span>
              <strong>{formatCurrency(metrics?.commission_received || 0)}</strong>
              <small>Comissões integralmente recebidas no período</small>
            </article>
            <article className="admin-panel management-financial-card">
              <span>Carteira publicada</span>
              <strong>{metrics?.published_properties || 0}</strong>
              <small>{metrics?.active_portfolio || 0} imóvel(is) ativos/publicáveis</small>
            </article>
          </section>

          <section className="admin-panel">
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">Conversão comercial</span>
                <h2>Funil do período</h2>
              </div>
            </div>

            <div className="management-funnel">
              <div><span>Leads</span><strong>{metrics?.leads || 0}</strong><small>Entrada</small></div>
              <i>→</i>
              <div><span>Visitas realizadas</span><strong>{metrics?.visits_completed || 0}</strong><small>{metrics?.lead_to_visit_rate || 0}% dos leads</small></div>
              <i>→</i>
              <div><span>Propostas</span><strong>{metrics?.proposals || 0}</strong><small>{metrics?.visit_to_proposal_rate || 0}% após visita</small></div>
              <i>→</i>
              <div><span>Negócios</span><strong>{metrics?.deals || 0}</strong><small>{metrics?.proposal_to_deal_rate || 0}% das propostas</small></div>
            </div>
            <p className="management-funnel-total">Conversão geral lead → negócio: <strong>{metrics?.lead_to_deal_rate || 0}%</strong></p>
          </section>

          <section className="admin-panel">
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">Origem dos resultados</span>
                <h2>Desempenho por canal</h2>
              </div>
            </div>
            {channels.length === 0 ? (
              <p>Ainda não há dados no período selecionado.</p>
            ) : (
              <div className="channel-performance-table-wrap">
                <table className="channel-performance-table">
                  <thead><tr><th>Canal</th><th>Leads</th><th>Visitas</th><th>Propostas</th><th>Negócios</th><th>Valor vendido</th><th>Comissão</th></tr></thead>
                  <tbody>
                    {channels.map((item) => (
                      <tr key={`${item.platform}-${item.channel}`}>
                        <td>{originLabel(item.platform, item.channel)}</td>
                        <td>{item.leads}</td>
                        <td>{item.visits}</td>
                        <td>{item.proposals}</td>
                        <td>{item.deals}</td>
                        <td>{formatCurrency(item.sales_value)}</td>
                        <td>{formatCurrency(item.commission_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-panel">
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">Últimos 6 meses</span>
                <h2>Evolução do negócio</h2>
              </div>
            </div>
            <div className="management-trend-grid">
              {trend.map((item) => (
                <article key={item.month_start}>
                  <strong>{trendMonthLabel(item.month_start)}</strong>
                  <div><span>Leads</span><b>{item.leads}</b></div>
                  <div><span>Visitas</span><b>{item.visits}</b></div>
                  <div><span>Propostas</span><b>{item.proposals}</b></div>
                  <div><span>Negócios</span><b>{item.deals}</b></div>
                  <div><span>Vendido</span><b>{formatCurrency(item.sales_value)}</b></div>
                  <div><span>Comissão</span><b>{formatCurrency(item.commission_value)}</b></div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
