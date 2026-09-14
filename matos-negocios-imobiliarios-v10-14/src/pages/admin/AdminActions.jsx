import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  completeCaptureNextAction,
  completeLeadNextAction,
  getDailyRoutineData,
  rescheduleCaptureNextAction,
  rescheduleLeadNextAction,
  updateAppointment,
  updateProposal,
} from '../../services/admin';
import {
  STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
  makeWhatsAppUrl,
  proposalValidityLabel,
} from '../../services/crm';
import { buildRoutine, nextBusinessMoment } from '../../services/routine';
import { getPropertyPortfolio } from '../../services/propertyManagement';
import { DOCUMENT_CATEGORY_LABELS, documentContext, getDocumentAlerts } from '../../services/documents';

const CAPTURE_STATUS_LABELS = {
  new: 'Novo contato',
  evaluation: 'Avaliação',
  documents: 'Documentação',
  authorized: 'Autorizado',
  published: 'Publicado',
  lost: 'Perdido',
};

const APPOINTMENT_STATUS_LABELS = {
  requested: 'Solicitado',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

export default function AdminActions() {
  const [rawData, setRawData] = useState({ leads: [], captures: [], appointments: [], proposals: [] });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [propertyAlerts, setPropertyAlerts] = useState([]);
  const [documentAlerts, setDocumentAlerts] = useState([]);

  async function load() {
    setLoading(true);
    const [routineResult, propertyResult, documentResult] = await Promise.all([
      getDailyRoutineData(),
      getPropertyPortfolio(),
      getDocumentAlerts(30),
    ]);
    if (routineResult.error || propertyResult.error || documentResult.error) {
      setMessage('Não foi possível carregar toda a rotina. Atualize a página e tente novamente.');
    }
    setRawData(routineResult.data || { leads: [], captures: [], appointments: [], proposals: [] });
    setPropertyAlerts(
      (propertyResult.data || [])
        .filter((item) => item.alert_count > 0 && ['draft', 'published', 'reserved'].includes(item.status))
        .sort((a, b) => (b.alert_count - a.alert_count) || ((b.metrics?.inactive_days || 0) - (a.metrics?.inactive_days || 0)))
    );
    setDocumentAlerts(documentResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const routine = useMemo(() => buildRoutine(rawData), [rawData]);

  function filterItems(items) {
    if (filter === 'all') return items;
    return items.filter((item) => item.kind === filter);
  }

  async function completeAction(item) {
    const key = `${item.kind}-${item.id}-complete`;
    setBusyKey(key);
    setMessage('');

    const result = item.kind === 'lead'
      ? await completeLeadNextAction(item)
      : await completeCaptureNextAction(item);

    if (result.error) {
      setMessage(result.error.message || 'Não foi possível concluir a ação.');
    } else {
      setMessage('Ação concluída e registrada no histórico.');
      await load();
    }

    setBusyKey('');
  }

  async function postpone(item, days) {
    const key = `${item.kind}-${item.id}-postpone-${days}`;
    setBusyKey(key);
    setMessage('');
    const nextAt = nextBusinessMoment(days);

    const result = item.kind === 'lead'
      ? await rescheduleLeadNextAction(item, nextAt)
      : await rescheduleCaptureNextAction(item, nextAt);

    if (result.error) {
      setMessage(result.error.message || 'Não foi possível reagendar a ação.');
    } else {
      setMessage(days === 1 ? 'Ação reagendada para amanhã às 9h.' : 'Ação reagendada para daqui a 7 dias às 9h.');
      await load();
    }

    setBusyKey('');
  }

  async function appointmentStatus(item, status) {
    const key = `appointment-${item.id}-${status}`;
    setBusyKey(key);
    setMessage('');
    const { error } = await updateAppointment(item.id, { status });
    if (error) {
      setMessage(error.message || 'Não foi possível atualizar a visita.');
    } else {
      setMessage(status === 'completed' ? 'Visita marcada como realizada.' : 'Visita confirmada.');
      await load();
    }
    setBusyKey('');
  }

  async function postponeProposal(item, days) {
    const key = `proposal-${item.id}-postpone-${days}`;
    setBusyKey(key);
    setMessage('');
    const { error } = await updateProposal(item.id, {
      next_follow_up_text: item.next_follow_up_text || 'Retornar sobre a proposta',
      next_follow_up_at: nextBusinessMoment(days),
    });
    if (error) {
      setMessage(error.message || 'Não foi possível reagendar o retorno da proposta.');
    } else {
      setMessage(days === 1 ? 'Retorno da proposta reagendado para amanhã às 9h.' : 'Retorno da proposta reagendado para daqui a 7 dias às 9h.');
      await load();
    }
    setBusyKey('');
  }

  function proposalCard(item, tone = '') {
    const lead = item.lead || {};
    const whatsappUrl = makeWhatsAppUrl(lead.whatsapp, lead.name);
    return (
      <article className={`routine-card proposal ${tone}`} key={`proposal-${item.id}`}>
        <div className="routine-card-main">
          <div className="routine-card-topline">
            <span className="routine-kind proposal">Proposta</span>
            <small>{PROPOSAL_STATUS_LABELS[item.status] || item.status}</small>
          </div>
          <h3>{lead.name || 'Cliente'}</h3>
          <p>{item.property ? `${item.property.code} — ${item.property.title}` : 'Imóvel não informado'}</p>
          <strong>{formatCurrency(item.proposal_value)}</strong>
          {item.next_follow_up_at && <span className="routine-property">Retorno: {formatDateTime(item.next_follow_up_at)}</span>}
          {item.valid_until && <span className="routine-property">Validade: {formatDate(item.valid_until)} · {proposalValidityLabel(item.valid_until)}</span>}
        </div>
        <div className="routine-card-actions">
          <Link to={`/admin/propostas/${item.id}`}>Abrir proposta</Link>
          {lead.id && <Link to={`/admin/leads/${lead.id}`}>Cliente</Link>}
          {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
          <button type="button" className="secondary" onClick={() => postponeProposal(item, 1)} disabled={busyKey.startsWith(`proposal-${item.id}`)}>Amanhã 9h</button>
          <button type="button" className="secondary" onClick={() => postponeProposal(item, 7)} disabled={busyKey.startsWith(`proposal-${item.id}`)}>+7 dias</button>
        </div>
      </article>
    );
  }

  function propertyAlertCard(item) {
    return (
      <article className="routine-card property-attention" key={`property-${item.id}`}>
        <div className="routine-card-main">
          <div className="routine-card-topline">
            <span className="routine-kind property">Imóvel</span>
            <small>{item.metrics?.days_in_portfolio || 0} dias em carteira</small>
          </div>
          <h3>{item.code} — {item.title}</h3>
          <p>{item.public_location_text || 'Localização não informada'}</p>
          <strong>{item.metrics?.inactive_days || 0} dias sem interação</strong>
          <div className="property-alert-chips compact">
            {item.alerts.slice(0, 3).map((alert) => <span key={alert}>{alert}</span>)}
          </div>
        </div>
        <div className="routine-card-actions">
          <Link to={`/admin/imoveis/${item.id}/gestao`}>Abrir gestão</Link>
          <Link to={`/admin/imoveis/${item.id}/editar`}>Editar anúncio</Link>
        </div>
      </article>
    );
  }

  function documentAlertCard(item) {
    const context = documentContext(item);
    return (
      <article className={`routine-card document-attention ${item.alert_type || ''}`} key={`document-${item.id}`}>
        <div className="routine-card-main">
          <div className="routine-card-topline">
            <span className="routine-kind document">Documento</span>
            <small>{item.alert_label}</small>
          </div>
          <h3>{item.title}</h3>
          <p>{DOCUMENT_CATEGORY_LABELS[item.category] || item.category} · {context.label}</p>
          {item.expires_at && <strong>Validade: {formatDate(item.expires_at)}</strong>}
        </div>
        <div className="routine-card-actions">
          <Link to={context.href}>Abrir ficha</Link>
          <Link to="/admin/documentos">Central de documentos</Link>
        </div>
      </article>
    );
  }

  function itemLink(item) {
    return item.kind === 'capture'
      ? `/admin/captacoes/${item.id}`
      : `/admin/leads/${item.id}`;
  }

  function itemStatus(item) {
    return item.kind === 'capture'
      ? CAPTURE_STATUS_LABELS[item.status] || item.status
      : STATUS_LABELS[item.status] || item.status;
  }

  function actionCard(item, tone = '') {
    const whatsappUrl = makeWhatsAppUrl(item.whatsapp, item.label);
    return (
      <article className={`routine-card ${tone}`} key={`${item.kind}-${item.id}`}>
        <div className="routine-card-main">
          <div className="routine-card-topline">
            <span className={`routine-kind ${item.kind}`}>
              {item.kind === 'capture' ? 'Captação' : 'Cliente'}
            </span>
            <small>{itemStatus(item)}</small>
          </div>
          <h3>{item.label}</h3>
          <p>{item.next_action_text || 'Fazer contato'}</p>
          <strong>{formatDateTime(item.next_action_at)}</strong>
          {item.property && (
            <span className="routine-property">{item.property.code} — {item.property.title}</span>
          )}
          {item.kind === 'capture' && (
            <span className="routine-property">
              {[item.property_type, item.neighborhood_name, item.city_name].filter(Boolean).join(' · ') || 'Imóvel em captação'}
            </span>
          )}
        </div>
        <div className="routine-card-actions">
          <Link to={itemLink(item)}>Abrir ficha</Link>
          {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
          <button
            type="button"
            onClick={() => completeAction(item)}
            disabled={busyKey.startsWith(`${item.kind}-${item.id}`)}
          >
            Concluir
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => postpone(item, 1)}
            disabled={busyKey.startsWith(`${item.kind}-${item.id}`)}
          >
            Amanhã 9h
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => postpone(item, 7)}
            disabled={busyKey.startsWith(`${item.kind}-${item.id}`)}
          >
            +7 dias
          </button>
        </div>
      </article>
    );
  }

  function noActionCard(item) {
    const whatsappUrl = makeWhatsAppUrl(item.whatsapp, item.label);
    return (
      <article className="routine-card attention" key={`${item.kind}-${item.id}-no-action`}>
        <div className="routine-card-main">
          <div className="routine-card-topline">
            <span className={`routine-kind ${item.kind}`}>
              {item.kind === 'capture' ? 'Captação' : 'Cliente'}
            </span>
            <small>{itemStatus(item)}</small>
          </div>
          <h3>{item.label}</h3>
          <p>Sem próxima ação cadastrada.</p>
          <strong>{item.idle_days === 0 ? 'Atividade recente' : `Sem atividade há ${item.idle_days} dia${item.idle_days === 1 ? '' : 's'}`}</strong>
          {item.property && <span className="routine-property">{item.property.code} — {item.property.title}</span>}
        </div>
        <div className="routine-card-actions">
          <Link to={itemLink(item)}>Definir próxima ação</Link>
          {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
        </div>
      </article>
    );
  }

  function visitCard(item) {
    const lead = item.lead || {};
    const whatsappUrl = makeWhatsAppUrl(lead.whatsapp, lead.name);
    return (
      <article className="routine-card visit" key={`visit-${item.id}`}>
        <div className="routine-card-main">
          <div className="routine-card-topline">
            <span className="routine-kind visit">Visita</span>
            <small>{APPOINTMENT_STATUS_LABELS[item.status] || item.status}</small>
          </div>
          <h3>{lead.name || 'Cliente'}</h3>
          <p>{item.property ? `${item.property.code} — ${item.property.title}` : 'Imóvel a definir'}</p>
          <strong>{item.routine_date ? formatDateTime(item.routine_date) : 'Horário a combinar'}</strong>
          {item.notes && <span className="routine-property">{item.notes}</span>}
        </div>
        <div className="routine-card-actions">
          {lead.id && <Link to={`/admin/leads/${lead.id}`}>Abrir cliente</Link>}
          {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
          {item.status === 'requested' && (
            <button type="button" onClick={() => appointmentStatus(item, 'confirmed')} disabled={busyKey.startsWith(`appointment-${item.id}`)}>
              Confirmar
            </button>
          )}
          <button type="button" className="secondary" onClick={() => appointmentStatus(item, 'completed')} disabled={busyKey.startsWith(`appointment-${item.id}`)}>
            Realizada
          </button>
        </div>
      </article>
    );
  }

  const overdue = filterItems(routine.overdue);
  const todayActions = filterItems(routine.todayActions);
  const nextSevenDays = filterItems(routine.nextSevenDays);
  const noNextAction = filterItems(routine.noNextAction);

  return (
    <div className="admin-page routine-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Centro de comando</span>
          <h1>Rotina de hoje</h1>
          <p>Veja o que precisa de atenção agora e não deixe nenhum negócio parado.</p>
        </div>
      </div>

      {message && <div className="routine-feedback">{message}</div>}

      {loading ? (
        <section className="admin-panel">Carregando sua rotina...</section>
      ) : (
        <>
          <div className="routine-summary-grid">
            <button type="button" onClick={() => document.getElementById('atrasadas')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Atrasadas</span><strong>{routine.counts.overdue}</strong>
            </button>
            <button type="button" onClick={() => document.getElementById('hoje')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Para hoje</span><strong>{routine.counts.today}</strong>
            </button>
            <button type="button" onClick={() => document.getElementById('visitas')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Visitas hoje</span><strong>{routine.counts.visits}</strong>
            </button>
            <button type="button" onClick={() => document.getElementById('sem-acao')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Sem próxima ação</span><strong>{routine.counts.no_next_action}</strong>
            </button>
            <button type="button" onClick={() => document.getElementById('propostas')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Propostas abertas</span><strong>{routine.counts.proposals}</strong>
            </button>
            <button type="button" onClick={() => document.getElementById('retornos-propostas')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Retornos de propostas</span><strong>{routine.counts.proposal_followups}</strong>
            </button>
            <button type="button" onClick={() => document.getElementById('propostas-vencendo')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Vencem em 3 dias</span><strong>{routine.counts.proposal_expiring}</strong>
            </button>
            <button type="button" onClick={() => document.getElementById('imoveis-atencao')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Imóveis com atenção</span><strong>{propertyAlerts.length}</strong>
            </button>
          </div>

          <div className="routine-filter-row">
            <span>Mostrar:</span>
            <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>Tudo</button>
            <button className={filter === 'lead' ? 'active' : ''} type="button" onClick={() => setFilter('lead')}>Clientes</button>
            <button className={filter === 'capture' ? 'active' : ''} type="button" onClick={() => setFilter('capture')}>Captações</button>
          </div>

          <section className="admin-panel routine-section" id="atrasadas">
            <div className="action-section-title"><div><span className="eyebrow">Prioridade máxima</span><h2>Ações atrasadas</h2></div><span>{overdue.length}</span></div>
            <div className="routine-list">
              {overdue.length === 0 ? <p>Nenhuma ação atrasada.</p> : overdue.map((item) => actionCard(item, 'overdue'))}
            </div>
          </section>

          <section className="admin-panel routine-section" id="hoje">
            <div className="action-section-title"><div><span className="eyebrow">Hoje</span><h2>O que precisa ser feito hoje</h2></div><span>{todayActions.length}</span></div>
            <div className="routine-list">
              {todayActions.length === 0 ? <p>Nenhuma ação programada para hoje.</p> : todayActions.map((item) => actionCard(item, 'today'))}
            </div>
          </section>

          <section className="admin-panel routine-section" id="visitas">
            <div className="action-section-title"><div><span className="eyebrow">Agenda</span><h2>Visitas de hoje</h2></div><span>{routine.visitsToday.length}</span></div>
            <div className="routine-list">
              {routine.visitsToday.length === 0 ? <p>Nenhuma visita marcada para hoje.</p> : routine.visitsToday.map(visitCard)}
            </div>
          </section>

          <section className="admin-panel routine-section" id="sem-acao">
            <div className="action-section-title"><div><span className="eyebrow">Não deixar esfriar</span><h2>Sem próxima ação</h2></div><span>{noNextAction.length}</span></div>
            <p className="routine-section-help">Clientes e captações em andamento que ainda não têm um próximo passo marcado.</p>
            <div className="routine-list">
              {noNextAction.length === 0 ? <p>Todos os atendimentos ativos têm próxima ação definida.</p> : noNextAction.slice(0, 30).map(noActionCard)}
            </div>
          </section>

          <section className="admin-panel routine-section" id="imoveis-atencao">
            <div className="action-section-title"><div><span className="eyebrow">Carteira</span><h2>Imóveis que precisam de atenção</h2></div><span>{propertyAlerts.length}</span></div>
            <p className="routine-section-help">Imóveis parados, com documentação, autorização, exclusividade ou revisão pendente.</p>
            <div className="routine-list">
              {propertyAlerts.length === 0 ? <p>Nenhum imóvel ativo precisa de atenção neste momento.</p> : propertyAlerts.slice(0, 20).map(propertyAlertCard)}
            </div>
          </section>

          <section className="admin-panel routine-section" id="documentos-atencao">
            <div className="action-section-title"><div><span className="eyebrow">Documentação</span><h2>Documentos que precisam de atenção</h2></div><span>{documentAlerts.length}</span></div>
            <p className="routine-section-help">Arquivos vencidos, perto do vencimento ou marcados com pendência.</p>
            <div className="routine-list">
              {documentAlerts.length === 0 ? <p>Nenhum documento com alerta nos próximos 30 dias.</p> : documentAlerts.slice(0, 20).map(documentAlertCard)}
            </div>
          </section>

          <section className="admin-panel routine-section" id="retornos-propostas">
            <div className="action-section-title"><div><span className="eyebrow">Acompanhamento</span><h2>Retornos de propostas</h2></div><span>{routine.proposalFollowUps.length}</span></div>
            <p className="routine-section-help">Propostas com retorno marcado para hoje ou já atrasado.</p>
            <div className="routine-list">
              {routine.proposalFollowUps.length === 0 ? <p>Nenhum retorno de proposta pendente para hoje.</p> : routine.proposalFollowUps.map((item) => proposalCard(item, 'today'))}
            </div>
          </section>

          <section className="admin-panel routine-section" id="propostas-vencendo">
            <div className="action-section-title"><div><span className="eyebrow">Prazo</span><h2>Propostas vencendo em até 3 dias</h2></div><span>{routine.proposalExpiring.length}</span></div>
            <div className="routine-list">
              {routine.proposalExpiring.length === 0 ? <p>Nenhuma proposta perto do vencimento.</p> : routine.proposalExpiring.map((item) => proposalCard(item, 'overdue'))}
            </div>
          </section>

          <section className="admin-panel routine-section" id="propostas">
            <div className="action-section-title"><div><span className="eyebrow">Negócios quentes</span><h2>Propostas em aberto</h2></div><span>{routine.proposals.length}</span></div>
            <div className="routine-list">
              {routine.proposals.length === 0 ? <p>Nenhuma proposta aberta no momento.</p> : routine.proposals.map((item) => proposalCard(item))}
            </div>
          </section>

          <section className="admin-panel routine-section">
            <div className="action-section-title"><div><span className="eyebrow">Próximos dias</span><h2>Próximos 7 dias</h2></div><span>{nextSevenDays.length + routine.upcomingVisits.length}</span></div>
            <div className="routine-list">
              {nextSevenDays.length === 0 && routine.upcomingVisits.length === 0 ? (
                <p>Nenhuma ação ou visita nos próximos 7 dias.</p>
              ) : (
                <>
                  {nextSevenDays.map((item) => actionCard(item))}
                  {routine.upcomingVisits.map(visitCard)}
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
