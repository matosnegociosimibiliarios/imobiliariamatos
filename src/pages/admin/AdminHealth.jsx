import React, { useEffect, useMemo, useState } from 'react';
import {
  createOperationalBackup,
  downloadBackupJson,
  getAuthenticatedHealth,
  getLastLocalAppError,
} from '../../services/health';

function StatusBadge({ status }) {
  const label = status === 'ok' ? 'Funcionando' : status === 'pending' ? 'Pendente' : 'Atenção';
  return <span className={`health-badge ${status}`}>{label}</span>;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

export default function AdminHealth() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupProgress, setBackupProgress] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const localError = useMemo(() => getLastLocalAppError(), []);

  async function runHealth() {
    setLoading(true);
    setError('');
    try {
      const data = await getAuthenticatedHealth();
      setHealth(data);
    } catch (err) {
      setError(err?.message || 'Não foi possível executar o diagnóstico.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { runHealth(); }, []);

  async function handleBackup() {
    if (!window.confirm('Gerar uma cópia de segurança operacional dos dados do CRM agora?')) return;
    setBackupRunning(true);
    setBackupMessage('');
    setBackupProgress('Preparando...');
    try {
      const backup = await createOperationalBackup({
        onProgress: ({ table, index, total }) => setBackupProgress(`${index}/${total} — ${table}`),
      });
      downloadBackupJson(backup);
      const failed = Object.keys(backup.errors || {}).length;
      setBackupMessage(failed
        ? `Backup baixado com ${failed} tabela(s) que não puderam ser lidas. Consulte o arquivo para detalhes.`
        : 'Backup operacional baixado com sucesso.');
    } catch (err) {
      setBackupMessage(`Falha ao gerar backup: ${err?.message || err}`);
    } finally {
      setBackupRunning(false);
      setBackupProgress('');
    }
  }

  const checks = health?.checks || [];
  const okCount = checks.filter((item) => item.status === 'ok').length;
  const pendingCount = checks.filter((item) => item.status === 'pending').length;
  const errorCount = checks.filter((item) => item.status === 'error').length;

  return (
    <div className="admin-page health-page">
      <div className="admin-page-header health-header">
        <div>
          <span className="eyebrow">Versão 10.13</span>
          <h1>Saúde do sistema</h1>
          <p>Diagnóstico rápido das partes críticas do CRM e cópia de segurança operacional.</p>
        </div>
        <button type="button" className="button" onClick={runHealth} disabled={loading}>
          {loading ? 'Verificando...' : 'Verificar novamente'}
        </button>
      </div>

      {error && <div className="admin-alert error">{error}</div>}

      <section className="health-summary-grid">
        <article className="admin-card health-summary-card">
          <span>Funcionando</span><strong>{okCount}</strong>
        </article>
        <article className="admin-card health-summary-card">
          <span>Pendentes</span><strong>{pendingCount}</strong>
        </article>
        <article className="admin-card health-summary-card">
          <span>Com atenção</span><strong>{errorCount}</strong>
        </article>
        <article className="admin-card health-summary-card">
          <span>Última verificação</span><strong className="health-date">{formatDate(health?.checked_at)}</strong>
        </article>
      </section>

      <section className="admin-card health-panel">
        <div className="health-panel-title">
          <div><h2>Diagnóstico</h2><p>As verificações não mostram senhas, tokens ou chaves.</p></div>
        </div>
        <div className="health-check-list">
          {loading && !checks.length && <p>Executando diagnóstico...</p>}
          {checks.map((item) => (
            <article className="health-check" key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.detail || 'Sem detalhes.'}</p>
                {Number.isFinite(item.latency_ms) && <small>Resposta: {item.latency_ms} ms</small>}
              </div>
              <StatusBadge status={item.status} />
            </article>
          ))}
        </div>
      </section>

      <section className="health-two-columns">
        <article className="admin-card health-panel">
          <h2>Cópia de segurança operacional</h2>
          <p>Baixa um arquivo JSON com os principais dados do CRM. Ele não contém senhas, tokens nem os arquivos físicos enviados ao Storage.</p>
          <div className="health-backup-actions">
            <button type="button" className="button" onClick={handleBackup} disabled={backupRunning}>
              {backupRunning ? 'Gerando backup...' : 'Baixar backup dos dados'}
            </button>
            {backupProgress && <small>{backupProgress}</small>}
            {backupMessage && <p className="health-message">{backupMessage}</p>}
          </div>
        </article>

        <article className="admin-card health-panel">
          <h2>Integrações</h2>
          <p><strong>Último evento:</strong> {health?.last_integration_event
            ? `${health.last_integration_event.platform} · ${health.last_integration_event.event_type} · ${health.last_integration_event.status}`
            : 'Nenhum evento recente encontrado.'}</p>
          <p><strong>Quando:</strong> {formatDate(health?.last_integration_event?.created_at)}</p>
          {health?.last_integration_event?.error_message && (
            <p className="health-error-text">{health.last_integration_event.error_message}</p>
          )}
        </article>
      </section>

      {localError && (
        <section className="admin-card health-panel">
          <h2>Último erro capturado no navegador</h2>
          <p><strong>Quando:</strong> {formatDate(localError.at)}</p>
          <p><strong>Página:</strong> {localError.path || '—'}</p>
          <code className="health-local-error">{localError.message || 'Erro não identificado.'}</code>
        </section>
      )}

      <section className="admin-card health-panel health-guidance">
        <h2>O que esta versão protege</h2>
        <div className="health-guidance-grid">
          <div><strong>Falhas de tela</strong><span>Um erro inesperado mostra uma tela segura de recuperação em vez de deixar o painel em branco.</span></div>
          <div><strong>Segredos</strong><span>O diagnóstico usa autenticação administrativa e nunca devolve valores de tokens ou chaves.</span></div>
          <div><strong>Backup manual</strong><span>Você pode manter cópias periódicas dos dados operacionais fora do sistema.</span></div>
          <div><strong>Integrações</strong><span>Instagram, webhook, Supabase e futura ativação do WhatsApp ficam visíveis em um único lugar.</span></div>
        </div>
      </section>
    </div>
  );
}
