import React, { useEffect, useState } from 'react';
import { getIntegrationEvents, getIntegrationMetrics } from '../../services/admin';
import { formatDateTime } from '../../services/crm';

function Status({ ok, label }) {
  return <div className={`integration-status ${ok ? 'ok' : 'pending'}`}><span>{ok ? 'Ativo' : 'Pendente'}</span><strong>{label}</strong></div>;
}

export default function AdminIntegrations() {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [statusResponse, metricsResult, eventsResult] = await Promise.all([
      fetch('/api/meta-status').then((r) => r.json()).catch(() => null),
      getIntegrationMetrics(30),
      getIntegrationEvents(),
    ]);
    setStatus(statusResponse);
    setMetrics(metricsResult.data || null);
    setEvents(eventsResult.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return <div className="admin-page">
    <div className="admin-page-header"><div><span className="eyebrow">Integrações</span><h1>Instagram e Meta</h1></div><button className="admin-link-button" type="button" onClick={load}>Verificar conexão</button></div>
    {loading ? <section className="admin-panel">Verificando...</section> : <>
      <section className="admin-panel"><h2>Status da conexão</h2><div className="integration-status-grid">
        <Status ok={status?.supabase_service_role} label="Conexão segura com o CRM" />
        <Status ok={status?.webhook_verify_token} label="Verificação do webhook" />
        <Status ok={status?.meta_app_secret} label="Assinatura da Meta" />
        <Status ok={status?.instagram_access_token} label="Instagram Direct" />
        <Status ok={status?.lead_ads_access_token} label="Formulários de anúncios" />
      </div></section>

      <section className="admin-panel"><h2>Endereço do webhook</h2><p>Este é o endereço que será cadastrado no painel da Meta:</p><code className="integration-code">{status?.webhook_url || `${window.location.origin}/api/meta-webhook`}</code><p className="integration-note">O token de verificação é configurado somente na Vercel e no painel da Meta. Ele não aparece aqui.</p></section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel"><h2>Últimos 30 dias</h2><div className="metric-list"><div><span>Leads do Direct</span><strong>{metrics?.instagram_direct_leads || 0}</strong></div><div><span>Leads de formulários Meta</span><strong>{metrics?.lead_ads_leads || 0}</strong></div><div><span>Mensagens recebidas</span><strong>{metrics?.instagram_messages || 0}</strong></div><div><span>Mensagens enviadas</span><strong>{metrics?.instagram_sent_messages || 0}</strong></div><div><span>Não lidas</span><strong>{metrics?.instagram_unread_messages || 0}</strong></div></div><a className="admin-link-button" href="/admin/mensagens">Abrir caixa de mensagens</a></section>
        <section className="admin-panel"><h2>Como os contatos entram</h2><p><strong>Direct:</strong> uma nova mensagem recebida cria ou atualiza o contato no funil como origem Instagram.</p><p><strong>Anúncios:</strong> um formulário de lead da Meta cria um contato com nome, telefone/e-mail e dados da campanha disponíveis.</p></section>
      </div>

      <section className="admin-panel"><h2>Últimos eventos da integração</h2>{events.length === 0 ? <p>Nenhum evento recebido ainda.</p> : <div className="integration-events">{events.map((event) => <article key={event.id}><div><strong>{event.event_type}</strong><span>{event.status}</span></div><small>{formatDateTime(event.created_at)}</small>{event.error_message && <p>{event.error_message}</p>}</article>)}</div>}</section>
    </>}
  </div>;
}
