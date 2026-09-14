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
  city_name: '',
  neighborhood_name: '',
  public_location_text: '',
  total_area: '',
  built_area: '',
  bedrooms: '',
  suites: '',
  bathrooms: '',
  parking_spaces: '',
  furnished: false,
  financing_allowed: false,
  exchange_allowed: false,
  featured: false,
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
        city_name: data.public_location_text?.split(' - ')[1]?.split('/')[0] || '',
        neighborhood_name: data.public_location_text?.split(' - ')[0] || '',
        public_location_text: data.public_location_text || '',
        total_area: data.total_area ?? '',
        built_area: data.built_area ?? '',
        bedrooms: data.bedrooms ?? '',
        suites: data.suites ?? '',
        bathrooms: data.bathrooms ?? '',
        parking_spaces: data.parking_spaces ?? '',
        furnished: Boolean(data.furnished),
        financing_allowed: Boolean(data.financing_allowed),
        exchange_allowed: Boolean(data.exchange_allowed),
        featured: Boolean(data.featured),
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
        city_id: city.id,
        neighborhood_id: neighborhood.id,
        public_location_text: locationText,
        total_area: numberOrNull(form.total_area),
        built_area: numberOrNull(form.built_area),
        bedrooms: numberOrNull(form.bedrooms),
        suites: numberOrNull(form.suites),
        bathrooms: numberOrNull(form.bathrooms),
        parking_spaces: numberOrNull(form.parking_spaces),
        furnished: form.furnished,
        financing_allowed: form.financing_allowed,
        exchange_allowed: form.exchange_allowed,
        featured: form.featured,
        published_at:
          form.status === 'published'
            ? new Date().toISOString()
            : null,
      };

      const { data, error } = await saveProperty(payload, editing ? id : null);

      if (error) throw error;

      let savedProperty = data;

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
            <Link className="admin-link-button" to={`/admin/imoveis/${property.id}/gestao`}>
              Gestão do imóvel
            </Link>
          )}
          <Link className="admin-link-button" to="/admin/imoveis">
            Voltar
          </Link>
        </div>
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
          </div>
        </section>

        <section className="admin-panel">
          <h2>Localização</h2>

          <div className="admin-form-grid two">
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
          </div>
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
