import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPropertyIndicatorsDataset,
  PROPERTY_FEEDBACK_LABELS,
  savePropertyOwnerReportSettings,
  sendPropertyOwnerReportNow,
} from '../../services/propertyIndicators';
import { formatMoney } from '../../services/properties';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export default function AdminPropertyIndicators() {
  const [properties, setProperties] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState({
    enabled: false,
    channel: 'email',
    frequency: 'monthly',
    next_send_at: '',
    recipient_email: '',
    recipient_whatsapp: '',
    whatsapp_template_name: '',
  });

  async function load() {
    setLoading(true);
    const result = await getPropertyIndicatorsDataset();
    if (result.error) {
      setMessage('Não foi possível carregar os indicadores.');
      setProperties([]);
    } else {
      const rows = result.data || [];
      setProperties(rows);
      setSelectedId((current) => current || rows[0]?.id || '');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const selected = useMemo(
    () => properties.find((property) => property.id === selectedId) || null,
    [properties, selectedId]
  );

  useEffect(() => {
    if (!selected) return;
    const current = selected.report_settings || {};
    setSettings({
      enabled: Boolean(current.enabled),
      channel: current.channel || 'email',
      frequency: current.frequency || 'monthly',
      next_send_at: toLocalInput(current.next_send_at),
      recipient_email: current.recipient_email || selected.management?.owner_email || '',
      recipient_whatsapp: current.recipient_whatsapp || selected.management?.owner_whatsapp || '',
      whatsapp_template_name: current.whatsapp_template_name || '',
    });
  }, [selectedId, selected]);

  async function saveSettings() {
    if (!selected) return;
    setMessage('');

    if (settings.enabled && !settings.next_send_at) {
      setMessage('Defina a data e hora do próximo envio.');
      return;
    }
    if (['email', 'both'].includes(settings.channel) && !settings.recipient_email.trim()) {
      setMessage('Informe o e-mail do proprietário para usar o envio por e-mail.');
      return;
    }
    if (['whatsapp', 'both'].includes(settings.channel) && !settings.recipient_whatsapp.trim()) {
      setMessage('Informe o WhatsApp do proprietário para usar esse canal.');
      return;
    }
    if (['whatsapp', 'both'].includes(settings.channel) && !settings.whatsapp_template_name.trim()) {
      setMessage('Informe o nome do modelo aprovado pela Meta para o relatório via WhatsApp.');
      return;
    }

    setSaving(true);

    const nextSendAt = settings.next_send_at
      ? new Date(settings.next_send_at).toISOString()
      : null;

    const result = await savePropertyOwnerReportSettings(selected.id, {
      enabled: settings.enabled,
      channel: settings.channel,
      frequency: settings.frequency,
      next_send_at: nextSendAt,
      recipient_email: settings.recipient_email.trim() || null,
      recipient_whatsapp: settings.recipient_whatsapp.trim() || null,
      whatsapp_template_name: settings.whatsapp_template_name.trim() || null,
      send_day: nextSendAt ? new Date(nextSendAt).getDate() : 1,
      send_hour: nextSendAt ? new Date(nextSendAt).getHours() : 9,
    });

    if (result.error) {
      setMessage('Não foi possível salvar a automação do relatório.');
    } else {
      setMessage('Automação do relatório salva.');
      await load();
    }
    setSaving(false);
  }

  async function sendNow() {
    if (!selected) return;
    setSaving(true);
    setMessage('');
    const result = await sendPropertyOwnerReportNow(selected.id);
    if (result.error) setMessage(result.error.message || 'Não foi possível enviar o relatório.');
    else {
      const first = result.data?.results?.[0];
      setMessage(first?.status === 'sent'
        ? 'Relatório enviado com sucesso.'
        : first?.status === 'partial'
          ? 'Relatório enviado parcialmente. Verifique o histórico.'
          : 'O envio não foi concluído. Verifique o histórico e a configuração dos canais.');
      await load();
    }
    setSaving(false);
  }

  if (loading) return <div className="admin-loading">Carregando indicadores...</div>;

  return (
    <div className="admin-page property-indicators-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Gestão da carteira</span>
          <h1>Indicadores de imóveis e clientes</h1>
          <p>Acompanhe interesse, visitas, propostas, corretores, pareceres e prestação de contas ao proprietário.</p>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <section className="admin-panel property-indicator-selector">
        <label>
          Imóvel
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {properties.map((property) => (
              <option value={property.id} key={property.id}>{property.code} — {property.title}</option>
            ))}
          </select>
        </label>
        {selected && <Link className="admin-link-button" to={`/admin/imoveis/${selected.id}/gestao`}>Abrir gestão do imóvel</Link>}
      </section>

      {!selected ? (
        <section className="admin-panel"><div className="admin-empty"><h2>Nenhum imóvel cadastrado</h2></div></section>
      ) : (
        <>
          <div className="property-indicator-cards">
            <article><span>Tempo anunciado</span><strong>{selected.days_announced} dias</strong></article>
            <article><span>Atendimentos</span><strong>{selected.leads_count}</strong></article>
            <article><span>Visitas</span><strong>{selected.completed_visits_count}</strong><small>{selected.visits_count} agendada(s)</small></article>
            <article><span>Propostas</span><strong>{selected.proposals_count}</strong></article>
            <article><span>Pareceres</span><strong>{selected.feedback.length}</strong></article>
            <article><span>Preço atual</span><strong>{formatMoney(selected.sale_price || selected.rent_price) || '—'}</strong></article>
          </div>

          <section className="admin-panel">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Leitura comercial</span>
                <h2>Pareceres dos clientes</h2>
              </div>
            </div>
            <div className="property-feedback-summary">
              {Object.entries(selected.feedback_counts || {}).length === 0 ? (
                <div className="admin-empty"><p>Ainda não há pareceres registrados para este imóvel.</p></div>
              ) : Object.entries(selected.feedback_counts).map(([code, count]) => (
                <article key={code}>
                  <span>{PROPERTY_FEEDBACK_LABELS[code] || 'Outro'}</span>
                  <strong>{count}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Quem atendeu</span>
                <h2>Clientes, corretores e etapas</h2>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Corretor</th>
                    <th>Etapa</th>
                    <th>Parecer</th>
                    <th>Observação</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.feedback.length > 0 ? selected.feedback.map((item) => (
                    <tr key={item.id}>
                      <td>{item.client}</td>
                      <td>{item.broker}</td>
                      <td>{item.stage}</td>
                      <td>{PROPERTY_FEEDBACK_LABELS[item.code] || 'Outro'}</td>
                      <td>{item.notes || '—'}</td>
                      <td>{formatDateTime(item.date)}</td>
                    </tr>
                  )) : selected.clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>{client.broker_name}</td>
                      <td>Atendimento</td>
                      <td>Sem parecer</td>
                      <td>—</td>
                      <td>{formatDate(client.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-panel owner-report-automation">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Prestação de contas</span>
                <h2>Relatório automático ao proprietário</h2>
                <p>O relatório reúne tempo anunciado, atendimentos, visitas, propostas e pareceres deste imóvel.</p>
              </div>
            </div>

            <div className="admin-form-grid three">
              <label className="property-report-toggle">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Envio automático ativo
              </label>

              <label>
                Canal
                <select value={settings.channel} onChange={(event) => setSettings((current) => ({ ...current, channel: event.target.value }))}>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">E-mail + WhatsApp</option>
                </select>
              </label>

              <label>
                Frequência
                <select value={settings.frequency} onChange={(event) => setSettings((current) => ({ ...current, frequency: event.target.value }))}>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </label>

              <label>
                Próximo envio
                <input type="datetime-local" value={settings.next_send_at} onChange={(event) => setSettings((current) => ({ ...current, next_send_at: event.target.value }))} />
              </label>

              <label>
                E-mail do proprietário
                <input type="email" value={settings.recipient_email} onChange={(event) => setSettings((current) => ({ ...current, recipient_email: event.target.value }))} />
              </label>

              <label>
                WhatsApp do proprietário
                <input value={settings.recipient_whatsapp} onChange={(event) => setSettings((current) => ({ ...current, recipient_whatsapp: event.target.value }))} placeholder="+55..." />
              </label>

              {(settings.channel === 'whatsapp' || settings.channel === 'both') && (
                <label className="full">
                  Modelo aprovado do WhatsApp
                  <input
                    value={settings.whatsapp_template_name}
                    onChange={(event) => setSettings((current) => ({ ...current, whatsapp_template_name: event.target.value }))}
                    placeholder="Ex.: relatorio_imovel"
                  />
                  <small>O modelo da Meta deve aceitar 6 campos: imóvel, período, atendimentos, visitas, propostas e resumo dos pareceres.</small>
                </label>
              )}
            </div>

            <div className="owner-report-actions">
              <button type="button" className="button" onClick={saveSettings} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar automação'}
              </button>
              <button type="button" className="admin-link-button" onClick={sendNow} disabled={saving}>
                Enviar relatório agora
              </button>
            </div>

            <div className="owner-report-history">
              <h3>Últimos envios</h3>
              {selected.report_history.length === 0 ? <p>Nenhum relatório enviado ainda.</p> : selected.report_history.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <div><strong>{item.channel}</strong><span>{item.status}</span></div>
                  <small>{formatDateTime(item.sent_at || item.created_at)}</small>
                  {item.error_message && <p>{item.error_message}</p>}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
