import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createCityIfNeeded,
  createNeighborhoodIfNeeded,
  deletePropertyImage,
  getAdminProperty,
  saveProperty,
  setCoverImage,
  uploadPropertyImages,
  uploadPropertyVideo,
} from '../../services/admin';
import { getPublicImageUrl } from '../../services/properties';

const initialForm = {
  title: '',
  purpose: 'sale',
  property_type: 'Casa',
  status: 'draft',
  description: '',
  sale_price: '',
  rent_price: '',
  condominium_fee: '',
  iptu_value: '',
  discount_percent: '',
  visit_schedule: [],
  city_name: '',
  region_name: '',
  subregion_name: '',
  neighborhood_name: '',
  public_location_text: '',
  street_name: '',
  address_number: '',
  address_complement: '',
  postal_code: '',
  latitude: '',
  longitude: '',
  total_area: '',
  built_area: '',
  bedrooms: '',
  suites: '',
  bathrooms: '',
  parking_spaces: '',
  construction_standard: 'medio',
  conservation_status: 'bom',
  construction_year: '',
  furnished: false,
  financing_allowed: false,
  exchange_allowed: false,
  featured: false,
  tag: '',
  video_url: '',
};

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  return Number(value);
}

export default function AdminPropertyForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [property, setProperty] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [newVideo, setNewVideo] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!editing) return;

    (async () => {
      const { data, error } = await getAdminProperty(id);

      if (error || !data) {
        setMessage('Não foi possível carregar o imóvel.');
        setLoading(false);
        return;
      }

      setProperty(data);
      setExistingImages(data.property_images || []);

      setForm({
        title: data.title || '',
        purpose: data.purpose || 'sale',
        property_type: data.property_type || 'Casa',
        status: data.status || 'draft',
        description: data.description || '',
        sale_price: data.sale_price ?? '',
        rent_price: data.rent_price ?? '',
        condominium_fee: data.condominium_fee ?? '',
        iptu_value: data.iptu_value ?? '',
        discount_percent: data.discount_percent ?? '',
        visit_schedule: Array.isArray(data.visit_schedule) ? data.visit_schedule : [],
        city_name: data.public_location_text?.split(' - ')[1]?.split('/')[0] || '',
        region_name: data.region_name || '',
        subregion_name: data.subregion_name || '',
        neighborhood_name: data.public_location_text?.split(' - ')[0] || '',
        public_location_text: data.public_location_text || '',
        street_name: data.street_name || '',
        address_number: data.address_number || '',
        address_complement: data.address_complement || '',
        postal_code: data.postal_code || '',
        latitude: data.latitude ?? '',
        longitude: data.longitude ?? '',
        total_area: data.total_area ?? '',
        built_area: data.built_area ?? '',
        bedrooms: data.bedrooms ?? '',
        suites: data.suites ?? '',
        bathrooms: data.bathrooms ?? '',
        parking_spaces: data.parking_spaces ?? '',
        construction_standard: data.construction_standard || 'medio',
        conservation_status: data.conservation_status || 'bom',
        construction_year: data.construction_year ?? '',
        furnished: Boolean(data.furnished),
        financing_allowed: Boolean(data.financing_allowed),
        exchange_allowed: Boolean(data.exchange_allowed),
        featured: Boolean(data.featured),
        tag: data.tag || '',
        video_url: data.video_url || '',
      });

      setLoading(false);
    })();
  }, [editing, id]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function addVisitSlot() {
    setForm((current) => ({
      ...current,
      visit_schedule: [...(current.visit_schedule || []), { day: 'Segunda', start: '09:00', end: '12:00' }],
    }));
  }

  function updateVisitSlot(index, field, value) {
    setForm((current) => ({
      ...current,
      visit_schedule: (current.visit_schedule || []).map((slot, slotIndex) => (
        slotIndex === index ? { ...slot, [field]: value } : slot
      )),
    }));
  }

  function removeVisitSlot(index) {
    setForm((current) => ({
      ...current,
      visit_schedule: (current.visit_schedule || []).filter((_, slotIndex) => slotIndex !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const city = await createCityIfNeeded(form.city_name || 'Ressaquinha', 'MG');
      const neighborhood = await createNeighborhoodIfNeeded(
        city.id,
        form.neighborhood_name || 'Centro'
      );

      const locationText =
        form.public_location_text.trim() ||
        `${neighborhood.name} - ${city.name}/${city.state_code || 'MG'}`;

      let videoUrl = form.video_url.trim() || null;
      const payload = {
        title: form.title.trim(),
        purpose: form.purpose,
        property_type: form.property_type,
        status: form.status,
        description: form.description.trim() || null,
        sale_price:
          form.purpose === 'rent'
            ? null
            : numberOrNull(form.sale_price),
        rent_price:
          form.purpose === 'sale'
            ? null
            : numberOrNull(form.rent_price),
        condominium_fee: numberOrNull(form.condominium_fee),
        iptu_value: numberOrNull(form.iptu_value),
        discount_percent: numberOrNull(form.discount_percent),
        visit_schedule: (form.visit_schedule || []).filter((slot) => slot.day && slot.start && slot.end),
        city_id: city.id,
        neighborhood_id: neighborhood.id,
        region_name: form.region_name.trim() || null,
        subregion_name: form.subregion_name.trim() || null,
        public_location_text: locationText,
        street_name: form.street_name.trim() || null,
        address_number: form.address_number.trim() || null,
        address_complement: form.address_complement.trim() || null,
        postal_code: form.postal_code.trim() || null,
        latitude: numberOrNull(form.latitude),
        longitude: numberOrNull(form.longitude),
        total_area: numberOrNull(form.total_area),
        built_area: numberOrNull(form.built_area),
        bedrooms: numberOrNull(form.bedrooms),
        suites: numberOrNull(form.suites),
        bathrooms: numberOrNull(form.bathrooms),
        parking_spaces: numberOrNull(form.parking_spaces),
        construction_standard: form.construction_standard || null,
        conservation_status: form.conservation_status || null,
        construction_year: numberOrNull(form.construction_year),
        furnished: form.furnished,
        financing_allowed: form.financing_allowed,
        exchange_allowed: form.exchange_allowed,
        featured: form.featured,
        tag: form.tag || null,
        video_url: videoUrl,
        published_at:
          form.status === 'published'
            ? new Date().toISOString()
            : null,
      };

      const { data, error } = await saveProperty(payload, editing ? id : null);

      if (error) throw error;

      let savedProperty = data;

      if (newVideo) {
        videoUrl = await uploadPropertyVideo(savedProperty, newVideo);
        const videoResult = await saveProperty({ video_url: videoUrl }, savedProperty.id);
        if (videoResult.error) throw videoResult.error;
        savedProperty = videoResult.data;
      }

      if (newFiles.length > 0) {
        await uploadPropertyImages(savedProperty, newFiles);
      }

      navigate(`/admin/imoveis/${savedProperty.id}/editar`, {
        replace: true,
      });
    } catch (error) {
      console.error(error);
      setMessage(
        error?.message
          ? `Erro: ${error.message}`
          : 'Não foi possível salvar o imóvel.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function makeCover(image) {
    if (!property) return;

    await setCoverImage(property.id, image.id);

    setExistingImages((current) =>
      current.map((item) => ({
        ...item,
        is_cover: item.id === image.id,
      }))
    );
  }

  async function removeImage(image) {
    const confirmed = window.confirm('Excluir esta foto?');
    if (!confirmed) return;

    await deletePropertyImage(image);

    setExistingImages((current) =>
      current.filter((item) => item.id !== image.id)
    );
  }

  if (loading) {
    return <div className="admin-loading">Carregando imóvel...</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">
            {editing ? 'Editar imóvel' : 'Novo imóvel'}
          </span>
          <h1>
            {editing && property
              ? `${property.code} — ${property.title}`
              : 'Cadastrar imóvel'}
          </h1>
        </div>

        <div className="admin-page-actions">
          {editing && property && (
            <>
              <Link className="admin-link-button" to={`/admin/imoveis/${property.id}/gestao`}>Gestão</Link>
              <Link className="admin-link-button" to={`/admin/imoveis/${property.id}/avaliacao`}>Avaliação</Link>
            </>
          )}
          <Link className="admin-link-button" to="/admin/imoveis">Voltar</Link>
        </div>
        {editing && property && (
          <div className="property-record-tabs">
            <Link className="active" to={`/admin/imoveis/${property.id}/editar`}>Cadastro</Link>
            <Link to={`/admin/imoveis/${property.id}/gestao`}>Gestão</Link>
            <Link to={`/admin/imoveis/${property.id}/avaliacao`}>Avaliação</Link>
          </div>
        )}
      </div>

      {message && <div className="admin-message">{message}</div>}

      <form className="admin-property-form" onSubmit={handleSubmit}>
        <section className="admin-panel">
          <h2>Informações principais</h2>

          <div className="admin-form-grid two">
            <label className="full">
              Título do anúncio
              <input
                name="title"
                value={form.title}
                onChange={updateField}
                required
              />
            </label>

            <label>
              Finalidade
              <select
                name="purpose"
                value={form.purpose}
                onChange={updateField}
              >
                <option value="sale">Venda</option>
                <option value="rent">Aluguel</option>
                <option value="sale_and_rent">Venda e aluguel</option>
              </select>
            </label>

            <label>
              Tipo de imóvel
              <select
                name="property_type"
                value={form.property_type}
                onChange={updateField}
              >
                <option>Casa</option>
                <option>Apartamento</option>
                <option>Terreno</option>
                <option>Sítio</option>
                <option>Comercial</option>
              </select>
            </label>

            <label>
              Status
              <select
                name="status"
                value={form.status}
                onChange={updateField}
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="reserved">Reservado</option>
                <option value="sold">Vendido</option>
                <option value="rented">Alugado</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>

            <label>
              Valor de venda
              <input
                type="number"
                min="0"
                step="0.01"
                name="sale_price"
                value={form.sale_price}
                onChange={updateField}
                disabled={form.purpose === 'rent'}
              />
            </label>

            <label>
              Valor do aluguel
              <input
                type="number"
                min="0"
                step="0.01"
                name="rent_price"
                value={form.rent_price}
                onChange={updateField}
                disabled={form.purpose === 'sale'}
              />
            </label>

            <label>
              Condomínio
              <input type="number" min="0" step="0.01" name="condominium_fee" value={form.condominium_fee} onChange={updateField} />
            </label>

            <label>
              IPTU
              <input type="number" min="0" step="0.01" name="iptu_value" value={form.iptu_value} onChange={updateField} />
            </label>

            <label>
              Desconto máximo (%)
              <input type="number" min="0" max="100" step="0.1" name="discount_percent" value={form.discount_percent} onChange={updateField} />
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Localização</h2>

          <div className="admin-form-grid two">
            <label>
              Região
              <input
                name="region_name"
                value={form.region_name}
                onChange={updateField}
                placeholder="Ex.: Campo das Vertentes"
              />
            </label>

            <label>
              Sub-região
              <input
                name="subregion_name"
                value={form.subregion_name}
                onChange={updateField}
                placeholder="Ex.: Barbacena e entorno"
              />
            </label>

            <label>
              Cidade
              <input
                name="city_name"
                value={form.city_name}
                onChange={updateField}
                placeholder="Ex.: Ressaquinha"
                required
              />
            </label>

            <label>
              Bairro
              <input
                name="neighborhood_name"
                value={form.neighborhood_name}
                onChange={updateField}
                placeholder="Ex.: Volta Grande"
                required
              />
            </label>

            <label className="full">
              Localização pública
              <input
                name="public_location_text"
                value={form.public_location_text}
                onChange={updateField}
                placeholder="Ex.: Volta Grande - Ressaquinha/MG"
              />
            </label>
          </div>

          <div className="property-precise-location">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Uso interno / mapa</span>
                <h3>Localização precisa</h3>
                <p className="admin-help-text">Esses dados são usados para posicionar o imóvel no mapa do CRM. Não alteram automaticamente a localização pública do anúncio.</p>
              </div>
            </div>

            <div className="admin-form-grid three">
              <label className="full">
                Rua / logradouro
                <input
                  name="street_name"
                  value={form.street_name}
                  onChange={updateField}
                  placeholder="Ex.: Rua José Bonifácio"
                />
              </label>

              <label>
                Número
                <input
                  name="address_number"
                  value={form.address_number}
                  onChange={updateField}
                  placeholder="Ex.: 125"
                />
              </label>

              <label>
                Complemento
                <input
                  name="address_complement"
                  value={form.address_complement}
                  onChange={updateField}
                  placeholder="Ex.: Apto 202"
                />
              </label>

              <label>
                CEP
                <input
                  name="postal_code"
                  value={form.postal_code}
                  onChange={updateField}
                  placeholder="Ex.: 36200-000"
                />
              </label>

              <label>
                Latitude
                <input
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  name="latitude"
                  value={form.latitude}
                  onChange={updateField}
                  placeholder="-21.225000"
                />
              </label>

              <label>
                Longitude
                <input
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  name="longitude"
                  value={form.longitude}
                  onChange={updateField}
                  placeholder="-43.770000"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Características</h2>

          <div className="admin-form-grid four">
            <label>
              Área total (m²)
              <input
                type="number"
                min="0"
                name="total_area"
                value={form.total_area}
                onChange={updateField}
              />
            </label>

            <label>
              Área construída (m²)
              <input
                type="number"
                min="0"
                name="built_area"
                value={form.built_area}
                onChange={updateField}
              />
            </label>

            <label>
              Quartos
              <input
                type="number"
                min="0"
                name="bedrooms"
                value={form.bedrooms}
                onChange={updateField}
              />
            </label>

            <label>
              Suítes
              <input
                type="number"
                min="0"
                name="suites"
                value={form.suites}
                onChange={updateField}
              />
            </label>

            <label>
              Banheiros
              <input
                type="number"
                min="0"
                name="bathrooms"
                value={form.bathrooms}
                onChange={updateField}
              />
            </label>

            <label>
              Vagas
              <input
                type="number"
                min="0"
                name="parking_spaces"
                value={form.parking_spaces}
                onChange={updateField}
              />
            </label>

            <label>
              Padrão construtivo
              <select name="construction_standard" value={form.construction_standard} onChange={updateField}>
                <option value="economico">Econômico</option>
                <option value="medio">Médio</option>
                <option value="alto">Alto padrão</option>
                <option value="luxo">Luxo</option>
              </select>
            </label>

            <label>
              Conservação
              <select name="conservation_status" value={form.conservation_status} onChange={updateField}>
                <option value="precisa_reforma">Precisa de reforma</option>
                <option value="regular">Regular</option>
                <option value="bom">Bom</option>
                <option value="novo">Novo / excelente</option>
              </select>
            </label>

            <label>
              Ano da construção
              <input
                type="number"
                min="1800"
                max="2200"
                name="construction_year"
                value={form.construction_year}
                onChange={updateField}
                placeholder="Ex.: 2018"
              />
            </label>
          </div>

          <div className="admin-checkboxes">
            <label>
              <input
                type="checkbox"
                name="furnished"
                checked={form.furnished}
                onChange={updateField}
              />
              Mobiliado
            </label>

            <label>
              <input
                type="checkbox"
                name="financing_allowed"
                checked={form.financing_allowed}
                onChange={updateField}
              />
              Aceita financiamento
            </label>

            <label>
              <input
                type="checkbox"
                name="exchange_allowed"
                checked={form.exchange_allowed}
                onChange={updateField}
              />
              Aceita troca
            </label>

            <label>
              <input
                type="checkbox"
                name="featured"
                checked={form.featured}
                onChange={updateField}
              />
              Imóvel em destaque
            </label>

            <label className="property-tag-field">
              Etiqueta pública
              <select name="tag" value={form.tag} onChange={updateField}>
                <option value="">Sem etiqueta</option>
                <option value="Lançamento">Lançamento</option>
                <option value="Exclusivo">Exclusivo</option>
                <option value="Pronto para Morar">Pronto para Morar</option>
              </select>
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <div className="property-section-heading">
            <div>
              <h2>Horários para visita</h2>
              <p className="admin-help-text">Cadastre os dias e horários em que o imóvel pode receber visitas.</p>
            </div>
            <button type="button" className="admin-link-button" onClick={addVisitSlot}>+ Adicionar horário</button>
          </div>

          {(form.visit_schedule || []).length === 0 ? (
            <div className="admin-empty"><p>Nenhum horário de visita cadastrado.</p></div>
          ) : (
            <div className="property-visit-slots">
              {(form.visit_schedule || []).map((slot, index) => (
                <div className="property-visit-slot" key={`${slot.day}-${index}`}>
                  <label>
                    Dia
                    <select value={slot.day || ''} onChange={(event) => updateVisitSlot(index, 'day', event.target.value)}>
                      <option>Segunda</option>
                      <option>Terça</option>
                      <option>Quarta</option>
                      <option>Quinta</option>
                      <option>Sexta</option>
                      <option>Sábado</option>
                      <option>Domingo</option>
                    </select>
                  </label>
                  <label>
                    Início
                    <input type="time" value={slot.start || ''} onChange={(event) => updateVisitSlot(index, 'start', event.target.value)} />
                  </label>
                  <label>
                    Fim
                    <input type="time" value={slot.end || ''} onChange={(event) => updateVisitSlot(index, 'end', event.target.value)} />
                  </label>
                  <button type="button" className="danger" onClick={() => removeVisitSlot(index)}>Remover</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel">
          <h2>Descrição</h2>

          <label>
            Descrição do imóvel
            <textarea
              name="description"
              rows="7"
              value={form.description}
              onChange={updateField}
            />
          </label>
        </section>

        <section className="admin-panel">
          <h2>Vídeo do imóvel</h2>
          <label>
            Link do vídeo
            <input
              type="url"
              name="video_url"
              value={form.video_url}
              onChange={updateField}
              placeholder="Cole aqui o link do YouTube, Vimeo ou vídeo publicado"
            />
          </label>
          <p className="admin-help-text">O vídeo será exibido na página pública do imóvel.</p>
          <label className="admin-upload">
            Ou enviar vídeo do computador/celular
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              onChange={(event) => setNewVideo(event.target.files?.[0] || null)}
            />
          </label>
          {newVideo && <p>Vídeo selecionado: {newVideo.name} (máximo 100 MB).</p>}
        </section>

        <section className="admin-panel">
          <h2>Fotos</h2>

          {existingImages.length > 0 && (
            <div className="admin-image-grid">
              {existingImages.map((image) => (
                <article className="admin-image-card" key={image.id}>
                  <img
                    src={getPublicImageUrl(image.storage_path)}
                    alt={image.alt_text || 'Foto do imóvel'}
                  />

                  <div>
                    {image.is_cover && (
                      <strong className="cover-label">Capa</strong>
                    )}

                    <button
                      type="button"
                      onClick={() => makeCover(image)}
                    >
                      Definir como capa
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={() => removeImage(image)}
                    >
                      Excluir foto
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <label className="admin-upload">
            Adicionar fotos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setNewFiles(Array.from(event.target.files || []))
              }
            />
          </label>

          {newFiles.length > 0 && (
            <p>{newFiles.length} foto(s) selecionada(s).</p>
          )}
        </section>

        <div className="admin-save-bar">
          <button className="button" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar imóvel'}
          </button>
        </div>
      </form>
    </div>
  );
}
