import React, { useEffect, useState } from 'react';
import { getIntegrationEvents, getIntegrationMetrics } from '../../services/admin';
import { getCurrentSession } from '../../services/auth';
import { formatDateTime } from '../../services/crm';
import WhatsAppEmbeddedSignup from '../../components/WhatsAppEmbeddedSignup';

function Status({ ok, label }) {
  return (
    <div className={`integration-status ${ok ? 'ok' : 'pending'}`}>
      <span>{ok ? 'Ativo' : 'Pendente'}</span>
      <strong>{label}</strong>
    </div>
  );
}

function InstagramConnection() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('instagram');
    const detail = params.get('message');
    if (result === 'connected') setMessage('Instagram conectado e webhook inscrito.');
    if (result === 'error') setMessage(detail ? decodeURIComponent(detail) : 'Não foi possível conectar o Instagram.');
  }, []);

  async function connect() {
    setLoading(true);
    setMessage('');
    try {
      const session = await getCurrentSession();
      if (!session?.access_token) throw new Error('Sessão administrativa expirada.');
      const url = new URL('/api/instagram-connect', window.location.origin);
      if (username.trim()) url.searchParams.set('username', username.trim());
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || 'Não foi possível iniciar a conexão.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error.message || 'Não foi possível iniciar a conexão.');
      setLoading(false);
    }
  }

  return (
    <section className="admin-panel">
      <h2>Conectar Instagram da imobiliária</h2>
      <p>Informe o @ para conferência e autorize a conta profissional pelo Instagram. O token fica armazenado de forma segura por empresa.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 6, minWidth: 280 }}>
          <strong style={{ fontSize: 13 }}>Instagram @</strong>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@suaimobiliaria"
            disabled={loading}
          />
        </label>
        <button className="button" type="button" onClick={connect} disabled={loading}>
          {loading ? 'Abrindo Instagram...' : 'Conectar Instagram'}
        </button>
      </div>
      {message && <p className="integration-note" style={{ marginTop: 12 }}>{message}</p>}
    </section>
  );
}


export default function AdminIntegrations() {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const session = await getCurrentSession();
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
    const [statusResponse, metricsResult, eventsResult] = await Promise.all([
      fetch('/api/meta-status', { headers: authHeaders }).then((r) => r.json()).catch(() => null),
      getIntegrationMetrics(30),
      getIntegrationEvents(),
    ]);
    setStatus(statusResponse);
    setMetrics(metricsResult.data || null);
    setEvents(eventsResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Integrações</span>
          <h1>Instagram, WhatsApp e Meta</h1>
        </div>
        <button className="admin-link-button" type="button" onClick={load}>
          Verificar conexão
        </button>
      </div>

      {loading ? (
        <section className="admin-panel">Verificando...</section>
      ) : (
        <>
          <InstagramConnection />

          <section className="admin-panel">
            <h2>Status da conexão</h2>
            <div className="integration-status-grid">
              <Status ok={status?.supabase_service_role} label="Conexão segura com o CRM" />
              <Status ok={status?.webhook_verify_token} label="Verificação do webhook" />
              <Status ok={status?.meta_app_secret} label="Assinatura da Meta" />
              <Status ok={status?.instagram_access_token} label="Instagram Direct" />
              <Status
                ok={status?.instagram_connected}
                label={status?.instagram_username ? `Instagram @${status.instagram_username}` : 'Instagram conectado por imobiliária'}
              />
              <Status
                ok={status?.whatsapp_access_token}
                label="Token do WhatsApp Business"
              />
              <Status
                ok={status?.whatsapp_phone_number_id}
                label="Número do WhatsApp conectado"
              />
              <Status ok={status?.lead_ads_access_token} label="Formulários de anúncios" />
            </div>
          </section>

          <section className="admin-panel">
            <h2>Conexão do WhatsApp Business</h2>
            <WhatsAppEmbeddedSignup onConnected={load} />
          </section>

          <section className="admin-panel">
            <h2>Endereço do webhook</h2>
            <p>Instagram e WhatsApp usam o mesmo endereço no painel da Meta:</p>
            <code className="integration-code">
              {status?.webhook_url || `${window.location.origin}/api/meta-webhook`}
            </code>
            <p className="integration-note">
              Tokens e chaves ficam somente na Vercel e não são exibidos no CRM.
            </p>
          </section>

          <div className="admin-dashboard-grid">
            <section className="admin-panel">
              <h2>Instagram · últimos 30 dias</h2>
              <div className="metric-list">
                <div><span>Leads do Direct</span><strong>{metrics?.instagram_direct_leads || 0}</strong></div>
                <div><span>Mensagens recebidas</span><strong>{metrics?.instagram_messages || 0}</strong></div>
                <div><span>Mensagens enviadas</span><strong>{metrics?.instagram_sent_messages || 0}</strong></div>
                <div><span>Não lidas</span><strong>{metrics?.instagram_unread_messages || 0}</strong></div>
              </div>
              <a className="admin-link-button" href="/admin/mensagens">Abrir Instagram</a>
            </section>

            <section className="admin-panel">
              <h2>WhatsApp · últimos 30 dias</h2>
              <div className="metric-list">
                <div><span>Contatos com WhatsApp</span><strong>{metrics?.whatsapp_leads || 0}</strong></div>
                <div><span>Mensagens recebidas</span><strong>{metrics?.whatsapp_messages || 0}</strong></div>
                <div><span>Mensagens enviadas</span><strong>{metrics?.whatsapp_sent_messages || 0}</strong></div>
                <div><span>Não lidas</span><strong>{metrics?.whatsapp_unread_messages || 0}</strong></div>
              </div>
              <a className="admin-link-button" href="/admin/whatsapp">Abrir WhatsApp</a>
            </section>
          </div>

          <section className="admin-panel">
            <h2>Como os contatos entram</h2>
            <p><strong>Instagram:</strong> uma nova mensagem do Direct cria ou atualiza o contato e registra a origem Instagram.</p>
            <p><strong>WhatsApp:</strong> uma nova mensagem recebida associa o número ao lead existente quando houver correspondência ou cria um novo contato com origem WhatsApp.</p>
            <p><strong>Site:</strong> continua identificado separadamente como origem Site, mesmo quando o cliente depois conversa pelo WhatsApp.</p>
          </section>

          <section className="admin-panel">
            <h2>Últimos eventos da integração</h2>
            {events.length === 0 ? (
              <p>Nenhum evento recebido ainda.</p>
            ) : (
              <div className="integration-events">
                {events.map((event) => (
                  <article key={event.id}>
                    <div>
                      <strong>{event.event_type}</strong>
                      <span>{event.status}</span>
                    </div>
                    <small>{formatDateTime(event.created_at)}</small>
                    {event.error_message && <p>{event.error_message}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
