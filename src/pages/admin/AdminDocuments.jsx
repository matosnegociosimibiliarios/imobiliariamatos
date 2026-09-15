import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CONTEXT_LABELS,
  DOCUMENT_STATUS_LABELS,
  createDocumentSignedUrl,
  deleteCrmDocument,
  documentContext,
  documentExpiryState,
  getChecklistPendencies,
  getDocumentTargets,
  getDocuments,
  updateCrmDocument,
  uploadCrmDocuments,
} from '../../services/documents';
import { formatDateTime } from '../../services/crm';

const EMPTY_FORM = {
  contextType: 'general',
  contextId: '',
  title: '',
  category: 'other',
  issuedAt: '',
  expiresAt: '',
  notes: '',
};

export default function AdminDocuments() {
  const [documents, setDocuments] = useState([]);
  const [targets, setTargets] = useState({ property: [], lead: [], capture: [], proposal: [], deal: [] });
  const [pendencies, setPendencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filters, setFilters] = useState({ search: '', status: '', category: '', context: '' });

  async function load() {
    setLoading(true);
    const [docsResult, targetsResult, pendenciesResult] = await Promise.all([
      getDocuments(),
      getDocumentTargets(),
      getChecklistPendencies(),
    ]);

    if (docsResult.error || targetsResult.error || pendenciesResult.error) {
      setMessage('Não foi possível carregar toda a central de documentos.');
    }

    setDocuments(docsResult.data || []);
    setTargets(targetsResult.data || { property: [], lead: [], capture: [], proposal: [], deal: [] });
    setPendencies(pendenciesResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    let pending = 0;
    let expiring = 0;
    let expired = 0;
    for (const document of documents) {
      if (document.status === 'pending_review' || document.status === 'rejected') pending += 1;
      const expiry = documentExpiryState(document.expires_at);
      if (expiry.state === 'expiring') expiring += 1;
      if (expiry.state === 'expired') expired += 1;
    }
    return { total: documents.length, pending, expiring, expired, missing: pendencies.length };
  }, [documents, pendencies]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return documents.filter((document) => {
      const context = documentContext(document);
      if (filters.status && document.status !== filters.status) return false;
      if (filters.category && document.category !== filters.category) return false;
      if (filters.context && context.type !== filters.context) return false;
      if (!search) return true;
      return [
        document.title,
        document.original_name,
        document.notes,
        context.label,
        DOCUMENT_CATEGORY_LABELS[document.category],
      ].filter(Boolean).join(' ').toLowerCase().includes(search);
    });
  }, [documents, filters]);

  function formField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'contextType' ? { contextId: '' } : {}),
    }));
  }

  function filterField(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    if (form.contextType !== 'general' && !form.contextId) {
      setMessage('Selecione a ficha que receberá o documento.');
      return;
    }
    if (files.length === 0) {
      setMessage('Selecione pelo menos um arquivo.');
      return;
    }

    setUploading(true);
    const result = await uploadCrmDocuments(files, {
      contextType: form.contextType,
      contextId: form.contextId || null,
      title: form.title,
      category: form.category,
      issuedAt: form.issuedAt || null,
      expiresAt: form.expiresAt || null,
      notes: form.notes,
    });

    if (result.error) {
      setMessage(result.error.message || 'Não foi possível enviar o documento.');
    } else {
      setMessage('Documento anexado e guardado na central.');
      setFiles([]);
      setForm(EMPTY_FORM);
      const input = document.getElementById('central-document-files');
      if (input) input.value = '';
      await load();
    }
    setUploading(false);
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

  async function changeStatus(document, status) {
    setBusyId(document.id);
    const result = await updateCrmDocument(document.id, { status });
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível atualizar o documento.');
    } else {
      setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, ...result.data } : item));
    }
    setBusyId('');
  }

  async function remove(document) {
    if (!window.confirm(`Excluir o arquivo “${document.title}”?`)) return;
    setBusyId(document.id);
    const result = await deleteCrmDocument(document);
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível excluir o documento.');
    } else {
      setMessage('Documento excluído.');
      await load();
    }
    setBusyId('');
  }

  const currentTargets = form.contextType === 'general' ? [] : (targets[form.contextType] || []);

  return (
    <div className="admin-page documents-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Arquivo digital</span>
          <h1>Central de documentos</h1>
          <p>Guarde documentos do imóvel, clientes, proprietários, propostas e negócios em um único lugar.</p>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="document-metrics">
        <article><span>Arquivos</span><strong>{metrics.total}</strong></article>
        <article><span>Para conferir</span><strong>{metrics.pending}</strong></article>
        <article><span>Vencem em 30 dias</span><strong>{metrics.expiring}</strong></article>
        <article><span>Vencidos</span><strong>{metrics.expired}</strong></article>
        <article><span>Itens faltando</span><strong>{metrics.missing}</strong></article>
      </div>

      <section className="admin-panel document-central-upload">
        <span className="eyebrow">Novo arquivo</span>
        <h2>Anexar documento</h2>
        <form onSubmit={submit}>
          <div className="admin-form-grid three">
            <label>
              Vincular a
              <select name="contextType" value={form.contextType} onChange={formField}>
                {Object.entries(DOCUMENT_CONTEXT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {form.contextType !== 'general' && (
              <label>
                Selecione a ficha
                <select name="contextId" value={form.contextId} onChange={formField} required>
                  <option value="">Selecione</option>
                  {currentTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
                </select>
              </label>
            )}
            <label>
              Título
              <input name="title" value={form.title} onChange={formField} placeholder="Ex.: Contrato assinado" />
            </label>
            <label>
              Categoria
              <select name="category" value={form.category} onChange={formField}>
                {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Data do documento<input type="date" name="issuedAt" value={form.issuedAt} onChange={formField} /></label>
            <label>Validade<input type="date" name="expiresAt" value={form.expiresAt} onChange={formField} /></label>
            <label className="document-file-field">
              Arquivo
              <input
                id="central-document-files"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <small>Até 20 MB por arquivo.</small>
            </label>
          </div>
          <label>Observações<textarea rows="2" name="notes" value={form.notes} onChange={formField} placeholder="Observação interna..." /></label>
          <button className="button" disabled={uploading}>{uploading ? 'Enviando...' : 'Guardar documento'}</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="document-section-heading">
          <div><span className="eyebrow">Pendências</span><h2>Documentos ainda faltando</h2></div>
          <span className="document-count-pill">{pendencies.length}</span>
        </div>
        <p className="routine-section-help">Itens dos checklists de captação, imóvel e fechamento que ainda estão marcados como pendentes.</p>
        <div className="document-missing-grid">
          {pendencies.length === 0 ? <p>Nenhum item de checklist está pendente.</p> : pendencies.slice(0, 24).map((item) => (
            <Link to={item.href} key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.context_label}</span>
            </Link>
          ))}
        </div>
        {pendencies.length > 24 && <small>Exibindo 24 de {pendencies.length} pendências.</small>}
      </section>

      <section className="admin-panel">
        <div className="document-section-heading">
          <div><span className="eyebrow">Arquivo</span><h2>Todos os documentos</h2></div>
          <span className="document-count-pill">{filtered.length}</span>
        </div>

        <div className="document-filters">
          <label>Buscar<input name="search" value={filters.search} onChange={filterField} placeholder="Nome, cliente, imóvel..." /></label>
          <label>Situação<select name="status" value={filters.status} onChange={filterField}><option value="">Todas</option>{Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Categoria<select name="category" value={filters.category} onChange={filterField}><option value="">Todas</option>{Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Vínculo<select name="context" value={filters.context} onChange={filterField}><option value="">Todos</option>{Object.entries(DOCUMENT_CONTEXT_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>

        <div className="document-list">
          {loading ? <p>Carregando documentos...</p> : filtered.length === 0 ? <p>Nenhum documento encontrado com esses filtros.</p> : filtered.map((document) => {
            const context = documentContext(document);
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
                  <small><Link to={context.href}>{DOCUMENT_CONTEXT_LABELS[context.type] || context.type}: {context.label}</Link> · {formatDateTime(document.created_at)}</small>
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
    </div>
  );
}
