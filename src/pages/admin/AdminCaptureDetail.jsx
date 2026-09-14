import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addCaptureNote,
  createCityIfNeeded,
  createNeighborhoodIfNeeded,
  getCaptureDocuments,
  getCaptureNotes,
  getCaptureStatusHistory,
  getOwnerCaptureDetails,
  saveProperty,
  setCaptureDocumentStatus,
  updateOwnerCapture,
} from '../../services/admin';
import {
  CAPTURE_STATUSES,
  CAPTURE_STATUS_LABELS,
} from '../../services/captures';
import {
  formatCurrency,
  formatDateTime,
  makeWhatsAppUrl,
  toDateTimeLocal,
} from '../../services/crm';

const DOCUMENTS = [
  ['owner_id', 'Documento do proprietário'],
  ['registration', 'Matrícula do imóvel'],
  ['iptu', 'IPTU / cadastro municipal'],
  ['authorization', 'Autorização para intermediação'],
];

export default function AdminCaptureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [capture, setCapture] = useState(null);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    status: 'new',
    asking_value: '',
    evaluation_value: '',
    commission_percent: '',
    next_action_text: '',
    next_action_at: '',
    lost_reason: '',
  });

  async function load() {
    setLoading(true);

    const [captureResult, notesResult, documentsResult, historyResult] =
      await Promise.all([
        getOwnerCaptureDetails(id),
        getCaptureNotes(id),
        getCaptureDocuments(id),
        getCaptureStatusHistory(id),
      ]);

    if (captureResult.error || !captureResult.data) {
      setMessage('Captação não encontrada.');
      setLoading(false);
      return;
    }

    const data = captureResult.data;

    setCapture(data);
    setNotes(notesResult.data || []);
    setDocuments(documentsResult.data || []);
    setHistory(historyResult.data || []);

    setForm({
      status: data.status || 'new',
      asking_value: data.asking_value ?? '',
      evaluation_value: data.evaluation_value ?? '',
      commission_percent: data.commission_percent ?? '',
      next_action_text: data.next_action_text || '',
      next_action_at: toDateTimeLocal(data.next_action_at),
      lost_reason: data.lost_reason || '',
    });

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function numberOrNull(value) {
    return value === '' ? null : Number(value);
  }

  async function save() {
    setSaving(true);
    setMessage('');

    const { error } = await updateOwnerCapture(id, {
      status: form.status,
      asking_value: numberOrNull(form.asking_value),
      evaluation_value: numberOrNull(form.evaluation_value),
      commission_percent: numberOrNull(form.commission_percent),
      next_action_text:
        form.status === 'published' || form.status === 'lost'
          ? null
          : form.next_action_text.trim() || null,
      next_action_at:
        form.status === 'published' || form.status === 'lost'
          ? null
          : form.next_action_at
          ? new Date(form.next_action_at).toISOString()
          : null,
      lost_reason:
        form.status === 'lost'
          ? form.lost_reason.trim() || null
          : null,
    });

    if (error) {
      setMessage(`Não foi possível salvar: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage('Captação atualizada.');
    await load();
    setSaving(false);
  }

  async function addNote(event) {
    event.preventDefault();

    if (!noteText.trim()) return;

    const { error } = await addCaptureNote(id, noteText);

    if (error) {
      setMessage('Não foi possível salvar a anotação.');
      return;
    }

    setNoteText('');
    const result = await getCaptureNotes(id);
    setNotes(result.data || []);
  }

  function documentRecord(type) {
    return documents.find((item) => item.document_type === type);
  }

  async function changeDocument(type, label, status) {
    const { error } = await setCaptureDocumentStatus({
      captureId: id,
      documentType: type,
      label,
      status,
    });

    if (error) {
      setMessage('Não foi possível atualizar o documento.');
      return;
    }

    const result = await getCaptureDocuments(id);
    setDocuments(result.data || []);
  }

  async function convertToProperty() {
    if (!capture || capture.converted_property_id) return;

    const confirmed = window.confirm(
      'Criar um imóvel em rascunho com os dados desta captação?'
    );

    if (!confirmed) return;

    setConverting(true);
    setMessage('');

    try {
      const city = await createCityIfNeeded(
        capture.city_name,
        capture.state_code || 'MG'
      );

      const neighborhoodName =
        capture.neighborhood_name?.trim() || 'Centro';

      const neighborhood = await createNeighborhoodIfNeeded(
        city.id,
        neighborhoodName
      );

      const purposeText =
        capture.purpose === 'rent'
          ? 'para alugar'
          : capture.purpose === 'sale_and_rent'
          ? 'para venda ou aluguel'
          : 'à venda';

      const title = `${capture.property_type} ${purposeText} em ${neighborhood.name}, ${city.name}`;

      const price =
        capture.asking_value ?? capture.evaluation_value ?? null;

      const payload = {
        title,
        purpose: capture.purpose,
        property_type: capture.property_type,
        status: 'draft',
        description: capture.description || null,
        sale_price:
          capture.purpose === 'rent' ? null : price,
        rent_price:
          capture.purpose === 'sale' ? null : price,
        city_id: city.id,
        neighborhood_id: neighborhood.id,
        public_location_text: `${neighborhood.name} - ${city.name}/${city.state_code || capture.state_code || 'MG'}`,
        featured: false,
        published_at: null,
      };

      const { data: property, error: propertyError } =
        await saveProperty(payload);

      if (propertyError) throw propertyError;

      const { error: captureError } = await updateOwnerCapture(id, {
        converted_property_id: property.id,
        status: 'authorized',
      });

      if (captureError) throw captureError;

      navigate(`/admin/imoveis/${property.id}/editar`);
    } catch (error) {
      console.error(error);
      setMessage(
        error?.message
          ? `Não foi possível criar o imóvel: ${error.message}`
          : 'Não foi possível criar o imóvel.'
      );
      setConverting(false);
    }
  }

  const whatsappUrl = useMemo(
    () => makeWhatsAppUrl(capture?.whatsapp, capture?.owner_name),
    [capture]
  );

  if (loading) {
    return <div className="admin-loading">Carregando captação...</div>;
  }

  if (!capture) {
    return (
      <div className="admin-page">
        <div className="admin-message">
          {message || 'Captação não encontrada.'}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Ficha do proprietário</span>
          <h1>{capture.owner_name}</h1>
        </div>

        <Link className="admin-link-button" to="/admin/captacoes">
          Voltar às captações
        </Link>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="lead-detail-grid">
        <div>
          <section className="admin-panel">
            <div className="lead-profile-header">
              <div>
                <h2>Contato</h2>
                <p>{capture.whatsapp}</p>
                {capture.email && <p>{capture.email}</p>}
              </div>

              {whatsappUrl && (
                <a
                  className="button"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir WhatsApp
                </a>
              )}
            </div>

            <div className="lead-meta-grid">
              <div>
                <span>Solicitação</span>
                <strong>
                  {capture.request_type === 'valuation'
                    ? 'Avaliação'
                    : 'Anunciar imóvel'}
                </strong>
              </div>

              <div>
                <span>Etapa</span>
                <strong>
                  {CAPTURE_STATUS_LABELS[capture.status] || capture.status}
                </strong>
              </div>

              <div>
                <span>Recebido em</span>
                <strong>{formatDateTime(capture.created_at)}</strong>
              </div>
            </div>
          </section>

          <section className="admin-panel">
            <h2>Imóvel apresentado pelo proprietário</h2>

            <div className="capture-property-info">
              <div>
                <span>Tipo</span>
                <strong>{capture.property_type}</strong>
              </div>

              <div>
                <span>Objetivo</span>
                <strong>
                  {capture.purpose === 'sale'
                    ? 'Venda'
                    : capture.purpose === 'rent'
                    ? 'Aluguel'
                    : 'Venda ou aluguel'}
                </strong>
              </div>

              <div>
                <span>Local</span>
                <strong>
                  {capture.neighborhood_name
                    ? `${capture.neighborhood_name} - `
                    : ''}
                  {capture.city_name}/{capture.state_code}
                </strong>
              </div>

              <div>
                <span>Valor pretendido</span>
                <strong>{formatCurrency(capture.asking_value)}</strong>
              </div>
            </div>

            {capture.address_text && (
              <div className="lead-original-message">
                <strong>Endereço / referência</strong>
                <p>{capture.address_text}</p>
              </div>
            )}

            {capture.description && (
              <div className="lead-original-message">
                <strong>Informações enviadas</strong>
                <p>{capture.description}</p>
              </div>
            )}
          </section>

          <section className="admin-panel">
            <h2>Documentação</h2>

            <div className="capture-documents">
              {DOCUMENTS.map(([type, label]) => {
                const record = documentRecord(type);
                const value = record?.status || 'pending';

                return (
                  <article key={type}>
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {value === 'received'
                          ? 'Recebido'
                          : value === 'not_applicable'
                          ? 'Não se aplica'
                          : 'Pendente'}
                      </small>
                    </div>

                    <select
                      value={value}
                      onChange={(event) =>
                        changeDocument(type, label, event.target.value)
                      }
                    >
                      <option value="pending">Pendente</option>
                      <option value="received">Recebido</option>
                      <option value="not_applicable">Não se aplica</option>
                    </select>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-panel">
            <h2>Anotações da captação</h2>

            <form className="lead-note-form" onSubmit={addNote}>
              <textarea
                rows="4"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Ex.: Proprietário aceita negociar valor. Aguardando matrícula."
              />

              <button className="button">Adicionar anotação</button>
            </form>

            <div className="lead-notes-list">
              {notes.length === 0 ? (
                <p>Nenhuma anotação ainda.</p>
              ) : (
                notes.map((note) => (
                  <article key={note.id}>
                    <p>{note.note}</p>
                    <small>{formatDateTime(note.created_at)}</small>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-panel">
            <h2>Histórico da captação</h2>

            <div className="lead-history">
              {history.length === 0 ? (
                <p>Ainda não houve mudança de etapa.</p>
              ) : (
                history.map((item) => (
                  <article key={item.id}>
                    <span className="history-dot" />
                    <div>
                      <strong>
                        {CAPTURE_STATUS_LABELS[item.from_status] ||
                          item.from_status ||
                          'Entrada'}
                        {' → '}
                        {CAPTURE_STATUS_LABELS[item.to_status] ||
                          item.to_status}
                      </strong>
                      <small>{formatDateTime(item.created_at)}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside>
          <section className="admin-panel lead-crm-panel">
            <h2>Controle da captação</h2>

            <label>
              Etapa
              <select
                name="status"
                value={form.status}
                onChange={updateField}
              >
                {CAPTURE_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Valor pretendido
              <input
                type="number"
                min="0"
                step="0.01"
                name="asking_value"
                value={form.asking_value}
                onChange={updateField}
              />
            </label>

            <label>
              Valor da avaliação
              <input
                type="number"
                min="0"
                step="0.01"
                name="evaluation_value"
                value={form.evaluation_value}
                onChange={updateField}
              />
            </label>

            <label>
              Comissão combinada (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                name="commission_percent"
                value={form.commission_percent}
                onChange={updateField}
              />
            </label>

            <label>
              Próxima ação
              <input
                name="next_action_text"
                value={form.next_action_text}
                onChange={updateField}
                disabled={
                  form.status === 'published' || form.status === 'lost'
                }
                placeholder="Ex.: solicitar matrícula"
              />
            </label>

            <label>
              Quando fazer
              <input
                type="datetime-local"
                name="next_action_at"
                value={form.next_action_at}
                onChange={updateField}
                disabled={
                  form.status === 'published' || form.status === 'lost'
                }
              />
            </label>

            {form.status === 'lost' && (
              <label>
                Motivo da perda
                <select
                  name="lost_reason"
                  value={form.lost_reason}
                  onChange={updateField}
                >
                  <option value="">Selecione</option>
                  <option value="Preço pretendido fora do mercado">
                    Preço pretendido fora do mercado
                  </option>
                  <option value="Proprietário desistiu">
                    Proprietário desistiu
                  </option>
                  <option value="Documentação irregular">
                    Documentação irregular
                  </option>
                  <option value="Não aceitou condições de intermediação">
                    Não aceitou condições de intermediação
                  </option>
                  <option value="Imóvel já foi negociado">
                    Imóvel já foi negociado
                  </option>
                  <option value="Sem retorno do proprietário">
                    Sem retorno do proprietário
                  </option>
                  <option value="Outro">Outro</option>
                </select>
              </label>
            )}

            <button
              type="button"
              className="button full-button"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar captação'}
            </button>
          </section>

          <section className="admin-panel capture-convert-panel">
            <span className="eyebrow">Próximo passo</span>

            {capture.converted_property ? (
              <>
                <h2>Imóvel já criado</h2>
                <p>
                  {capture.converted_property.code} —{' '}
                  {capture.converted_property.title}
                </p>

                <Link
                  className="button full-button"
                  to={`/admin/imoveis/${capture.converted_property.id}/gestao`}
                >
                  Gestão do imóvel
                </Link>
              </>
            ) : (
              <>
                <h2>Transformar em imóvel</h2>
                <p>
                  Cria um imóvel em rascunho aproveitando tipo, finalidade,
                  cidade, bairro, descrição e valor desta captação.
                </p>

                <button
                  type="button"
                  className="button full-button"
                  onClick={convertToProperty}
                  disabled={converting}
                >
                  {converting
                    ? 'Criando imóvel...'
                    : 'Criar imóvel sem redigitar'}
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
