import React, { useEffect, useRef, useState } from 'react';
import {
  getLeadSocialMessages,
  getResponseTemplates,
  markLeadSocialRead,
  markLeadSocialUnread,
  sendInstagramMessage,
} from '../services/admin';
import { formatDateTime } from '../services/crm';

function attachmentUrl(message) {
  const attachments = message?.metadata?.attachments;
  if (!Array.isArray(attachments)) return null;

  for (const item of attachments) {
    const url = item?.payload?.url || item?.url;
    if (url) return url;
  }

  return null;
}

export default function InstagramConversation({
  leadId,
  leadName = 'Contato do Instagram',
  compact = false,
  onActivity,
}) {
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  async function load({ markRead = true, quiet = false } = {}) {
    if (!leadId) return;
    if (!quiet) setLoading(true);

    const result = await getLeadSocialMessages(leadId);

    if (result.error) {
      setError('Não foi possível carregar a conversa.');
    } else {
      setMessages(result.data || []);
      setError('');

      if (markRead) {
        await markLeadSocialRead(leadId);
        onActivity?.();
      }
    }

    if (!quiet) setLoading(false);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const result = await getResponseTemplates('instagram');
      if (active && !result.error) setTemplates(result.data || []);
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => {
    setMessages([]);
    setText('');
    setError('');
    load();

    const interval = window.setInterval(() => {
      load({ markRead: true, quiet: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [leadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, leadId]);

  async function handleSend(event) {
    event.preventDefault();

    const clean = text.trim();
    if (!clean || sending) return;

    setSending(true);
    setError('');

    try {
      await sendInstagramMessage(leadId, clean);
      setText('');
      await load({ markRead: true, quiet: true });
      onActivity?.();
    } catch (sendError) {
      setError(sendError.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }

  async function markUnread() {
    const result = await markLeadSocialUnread(leadId);
    if (result.error) {
      setError('Não foi possível marcar como não lida.');
      return;
    }
    onActivity?.();
  }

  return (
    <div className={`ig-conversation ${compact ? 'compact' : ''}`}>
      <div className="ig-conversation-head">
        <div>
          <span className="ig-channel-label">Instagram Direct</span>
          <strong>{leadName}</strong>
        </div>

        <div className="ig-head-actions">
          <button type="button" onClick={markUnread}>
            Marcar como não lida
          </button>
          <a
            href="https://www.instagram.com/direct/inbox/"
            target="_blank"
            rel="noreferrer"
          >
            Abrir Instagram
          </a>
        </div>
      </div>

      <div className="ig-thread" aria-live="polite">
        {loading ? (
          <div className="ig-thread-empty">Carregando conversa...</div>
        ) : messages.length === 0 ? (
          <div className="ig-thread-empty">Nenhuma mensagem registrada.</div>
        ) : (
          messages.map((item) => {
            const mediaUrl = attachmentUrl(item);
            const outbound = item.direction === 'outbound';

            return (
              <article
                className={`ig-message ${outbound ? 'outbound' : 'inbound'}`}
                key={item.id}
              >
                <div className="ig-message-bubble">
                  <p>{item.message_text || 'Mensagem sem texto'}</p>

                  {mediaUrl && (
                    <a href={mediaUrl} target="_blank" rel="noreferrer">
                      Abrir mídia recebida
                    </a>
                  )}

                  <small>
                    {formatDateTime(item.sent_at || item.created_at)}
                    {outbound && item.delivery_status === 'sent'
                      ? ' · enviada'
                      : ''}
                  </small>
                </div>
              </article>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="ig-compose-error">{error}</div>}

      {templates.length > 0 && (
        <div className="ig-quick-replies">
          <span>Respostas rápidas</span>
          <div>
            {templates.map((template) => (
              <button
                type="button"
                key={template.id}
                onClick={() => setText(template.content)}
                title={template.content}
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="ig-compose" onSubmit={handleSend}>
        <textarea
          rows={compact ? 2 : 3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Digite sua resposta..."
          maxLength={1000}
        />

        <div className="ig-compose-footer">
          <small>
            A conversa precisa ter sido iniciada pelo cliente. A Meta pode limitar
            respostas fora da janela permitida.
          </small>

          <button className="button" disabled={sending || !text.trim()}>
            {sending ? 'Enviando...' : 'Enviar pelo Instagram'}
          </button>
        </div>
      </form>
    </div>
  );
}
