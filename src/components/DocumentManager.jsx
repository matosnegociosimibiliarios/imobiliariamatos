import React, { useEffect, useMemo, useState } from 'react';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  createDocumentSignedUrl,
  deleteCrmDocument,
  documentExpiryState,
  getContextChecklist,
  getContextDocuments,
  updateCrmDocument,
  uploadCrmDocuments,
} from '../services/documents';
import { formatDateTime } from '../services/crm';

function checklistLabel(item) {
  if (item.party) {
    const party = item.party === 'buyer' ? 'Comprador' : item.party === 'seller' ? 'Vendedor' : 'Negócio';
    return `${party} — ${item.label}`;
  }
  return item.label;
}

export default function DocumentManager({ contextType, contextId, contextLabel }) {
  const [documents, setDocuments] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({
    title: '',
    category: contextType === 'property' ? 'property' : contextType === 'deal' ? 'contract' : 'other',
    checklistId: '',
    issuedAt: '',
    expiresAt: '',
    notes: '',
  });

  async function load() {
    if (!contextId) return;
    setLoading(true);
    const [docsResult, checklistResult] = await Promise.all([
      getContextDocuments(contextType, contextId),
      getContextChecklist(contextType, contextId),
    ]);
    if (docsResult.error || checklistResult.error) {
      setMessage('Não foi possível carregar os documentos desta ficha.');
    }
    setDocuments(docsResult.data || []);
    setChecklist(checklistResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [contextType, contextId]);

  const approvedCount = useMemo(
    () => documents.filter((item) => item.status === 'approved').length,
    [documents]
  );

  function field(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    if (files.length === 0) {
      setMessage('Selecione pelo menos um arquivo.');
      return;
    }

    setUploading(true);
    const result = await uploadCrmDocuments(files, {
      contextType,
      contextId,
      title: form.title,
      category: form.category,
      checklistId: form.checklistId || null,
      issuedAt: form.issuedAt || null,
      expiresAt: form.expiresAt || null,
      notes: form.notes,
    });

    if (result.error) {
      setMessage(result.error.message || 'Não foi possível enviar o arquivo.');
    } else {
      setMessage('Documento anexado com sucesso.');
      setFiles([]);
      setForm((current) => ({ ...current, title: '', checklistId: '', issuedAt: '', expiresAt: '', notes: '' }));
      const input = document.getElementById(`document-files-${contextType}-${contextId}`);
      if (input) input.value = '';
      await load();
    }
    setUploading(false);
  }

  async function changeStatus(document, status) {
    setBusyId(document.id);
    setMessage('');
    const result = await updateCrmDocument(document.id, { status });
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível atualizar o documento.');
    } else {
      setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, ...result.data } : item));
    }
    setBusyId('');
  }

  async function openFile(document) {
    setBusyId(document.id);
    setMessage('');
    const result = await createDocumentSignedUrl(document);
    if (result.error || !result.data?.signedUrl) {
      setMessage(result.error?.message || 'Não foi possível abrir o arquivo.');
    } else {
      window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
    }
    setBusyId('');
  }

  async function remove(document) {
    const ok = window.confirm(`Excluir o arquivo “${document.title}”?`);
    if (!ok) return;
    setBusyId(document.id);
    setMessage('');
    const result = await deleteCrmDocument(document);
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível excluir o arquivo.');
    } else {
      setMessage('Arquivo excluído.');
      await load();
    }
    setBusyId('');
  }

  return (
    <section className="admin-panel document-manager">
      <div className="document-manager-heading">
        <div>
          <span className="eyebrow">Arquivos</span>
          <h2>Documentos anexados</h2>
          <p>{contextLabel || 'Arquivos vinculados a esta ficha'}.</p>
        </div>
        <div className="document-mini-metrics">
          <span><strong>{documents.length}</strong> arquivo{documents.length === 1 ? '' : 's'}</span>
          <span><strong>{approvedCount}</strong> conferido{approvedCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      {message && <div className="admin-message compact-message">{message}</div>}

      <form className="document-upload-form" onSubmit={submit}>
        <div className="admin-form-grid three">
          <label>
            Título do documento
            <input name="title" value={form.title} onChange={field} placeholder="Ex.: Matrícula atualizada" />
          </label>
          <label>
            Categoria
            <select name="category" value={form.category} onChange={field}>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {checklist.length > 0 && (
            <label>
              Item do checklist
              <select name="checklistId" value={form.checklistId} onChange={field}>
                <option value="">Não vincular</option>
                {checklist.map((item) => <option key={item.id} value={item.id}>{checklistLabel(item)}</option>)}
              </select>
            </label>
          )}
          <label>
            Data do documento
            <input type="date" name="issuedAt" value={form.issuedAt} onChange={field} />
          </label>
          <label>
            Validade
            <input type="date" name="expiresAt" value={form.expiresAt} onChange={field} />
          </label>
          <label className="document-file-field">
            Arquivo
            <input
              id={`document-files-${contextType}-${contextId}`}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
            <small>Até 20 MB por arquivo.</small>
          </label>
        </div>
        <label>
          Observações
          <textarea rows="2" name="notes" value={form.notes} onChange={field} placeholder="Informação interna sobre este documento..." />
        </label>
        <button type="submit" className="button" disabled={uploading}>{uploading ? 'Enviando...' : 'Anexar documento'}</button>
      </form>

      <div className="document-list embedded">
        {loading ? (
          <p>Carregando documentos...</p>
        ) : documents.length === 0 ? (
          <div className="document-empty-state"><strong>Nenhum arquivo anexado.</strong><span>Use o formulário acima para guardar documentos desta ficha.</span></div>
        ) : documents.map((document) => {
          const expiry = documentExpiryState(document.expires_at);
          return (
            <article className="document-row" key={document.id}>
              <div className="document-icon">DOC</div>
              <div className="document-row-main">
                <div className="document-row-title">
                  <strong>{document.title}</strong>
                  <span className={`document-status ${document.status}`}>{DOCUMENT_STATUS_LABELS[document.status] || document.status}</span>
                  {expiry.state !== 'none' && <span className={`document-expiry ${expiry.state}`}>{expiry.label}</span>}
                </div>
                <p>{DOCUMENT_CATEGORY_LABELS[document.category] || document.category} · {document.original_name}</p>
                <small>Adicionado em {formatDateTime(document.created_at)}{document.notes ? ` · ${document.notes}` : ''}</small>
              </div>
              <div className="document-row-actions">
                <button type="button" className="secondary" onClick={() => openFile(document)} disabled={busyId === document.id}>Abrir</button>
                <select value={document.status} onChange={(event) => changeStatus(document, event.target.value)} disabled={busyId === document.id}>
                  {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button type="button" className="danger-link" onClick={() => remove(document)} disabled={busyId === document.id}>Excluir</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
