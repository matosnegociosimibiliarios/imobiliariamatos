import React, { useEffect, useRef, useState } from 'react';
import {
  getLeadSocialMessages,
  getResponseTemplates,
  markLeadSocialRead,
  markLeadSocialUnread,
  sendWhatsAppMessage,
} from '../services/admin';
import { formatDateTime } from '../services/crm';

export default function WhatsAppConversation({
  leadId,
  leadName = 'Contato do WhatsApp',
  whatsapp = null,
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

    const result = await getLeadSocialMessages(leadId, 'whatsapp');

    if (result.error) {
      setError('Não foi possível carregar a conversa do WhatsApp.');
    } else {
      setMessages(result.data || []);
      setError('');

      if (markRead) {
        await markLeadSocialRead(leadId, 'whatsapp');
        onActivity?.();
      }
    }

    if (!quiet) setLoading(false);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const result = await getResponseTemplates('whatsapp');
      if (active && !result.error) setTemplates(result.data || []);
    })();

    return () => {
      active = false;
    };
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
      await sendWhatsAppMessage(leadId, clean);
      setText('');
      await load({ markRead: true, quiet: true });
      onActivity?.();
    } catch (sendError) {
      setError(sendError.message || 'Não foi possível enviar a mensagem pelo WhatsApp.');
    } finally {
      setSending(false);
    }
  }

  async function markUnread() {
    const result = await markLeadSocialUnread(leadId, 'whatsapp');
    if (result.error) {
      setError('Não foi possível marcar como não lida.');
      return;
    }
    onActivity?.();
  }

  const digits = String(whatsapp || '').replace(/\D/g, '');
  const whatsappUrl = digits ? `https://wa.me/${digits}` : 'https://web.whatsapp.com/';

  return (
    <div className={`ig-conversation ${compact ? 'compact' : ''}`}>
      <div className="ig-conversation-head">
        <div>
          <span className="ig-channel-label">WhatsApp Business</span>
          <strong>{leadName}</strong>
        </div>

        <div className="ig-head-actions">
          <button type="button" onClick={markUnread}>
            Marcar como não lida
          </button>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            Abrir WhatsApp
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
            const outbound = item.direction === 'outbound';
            const status = item.delivery_status;
            const statusLabel =
              status === 'read'
                ? 'lida'
                : status === 'delivered'
                  ? 'entregue'
                  : status === 'sent'
                    ? 'enviada'
                    : status === 'failed'
                      ? 'falhou'
                      : '';

            return (
              <article
                className={`ig-message ${outbound ? 'outbound' : 'inbound'}`}
                key={item.id}
              >
                <div className="ig-message-bubble">
                  <p>{item.message_text || 'Mensagem sem texto'}</p>
                  <small>
                    {formatDateTime(item.sent_at || item.created_at)}
                    {outbound && statusLabel ? ` · ${statusLabel}` : ''}
                  </small>
                  {item.error_message && (
                    <small className="ig-message-error">{item.error_message}</small>
                  )}
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
          maxLength={4096}
        />

        <div className="ig-compose-footer">
          <small>
            Respostas livres são permitidas dentro da janela de atendimento de 24 horas após a mensagem do cliente.
          </small>

          <button className="button" disabled={sending || !text.trim()}>
            {sending ? 'Enviando...' : 'Enviar pelo WhatsApp'}
          </button>
        </div>
      </form>
    </div>
  );
}
