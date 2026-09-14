import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../services/crm';
import {
  MATCH_PROPERTY_TYPES,
  MATCH_PURPOSES,
  MATCH_STATUS_LABELS,
  MATCH_URGENCIES,
  getLeadPreferences,
  getLeadPropertyMatches,
  saveLeadMatchStatus,
  saveLeadPreferences,
} from '../services/matching';

const emptyForm = {
  purpose: 'sale',
  min_price: '',
  max_price: '',
  property_types: [],
  preferred_cities: '',
  preferred_neighborhoods: '',
  min_bedrooms: '',
  min_bathrooms: '',
  min_parking_spaces: '',
  min_total_area: '',
  min_built_area: '',
  financing_needed: false,
  urgency: 'research',
  must_haves: '',
  notes: '',
};

function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function textToList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export default function LeadPropertyMatch({ lead }) {
  const [form, setForm] = useState(emptyForm);
  const [preferences, setPreferences] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');

    const result = await getLeadPreferences(lead.id);
    if (result.error) {
      setMessage(`Não foi possível carregar o perfil: ${result.error.message}`);
      setLoading(false);
      return;
    }

    if (!result.data) {
      setPreferences(null);
      setForm(emptyForm);
      setMatches([]);
      setLoading(false);
      return;
    }

    const p = result.data;
    setPreferences(p);
    setForm({
      purpose: p.purpose || 'sale',
      min_price: p.min_price ?? '',
      max_price: p.max_price ?? '',
      property_types: p.property_types || [],
      preferred_cities: listToText(p.preferred_cities),
      preferred_neighborhoods: listToText(p.preferred_neighborhoods),
      min_bedrooms: p.min_bedrooms ?? '',
      min_bathrooms: p.min_bathrooms ?? '',
      min_parking_spaces: p.min_parking_spaces ?? '',
      min_total_area: p.min_total_area ?? '',
      min_built_area: p.min_built_area ?? '',
      financing_needed: Boolean(p.financing_needed),
      urgency: p.urgency || 'research',
      must_haves: p.must_haves || '',
      notes: p.notes || '',
    });

    const matchesResult = await getLeadPropertyMatches(lead.id, p);
    setMatches(matchesResult.data || []);
    if (matchesResult.error) setMessage(`Não foi possível calcular os imóveis: ${matchesResult.error.message}`);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [lead.id]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function toggleType(type) {
    setForm((current) => ({
      ...current,
      property_types: current.property_types.includes(type)
        ? current.property_types.filter((item) => item !== type)
        : [...current.property_types, type],
    }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const payload = {
      purpose: form.purpose,
      min_price: optionalNumber(form.min_price),
      max_price: optionalNumber(form.max_price),
      property_types: form.property_types,
      preferred_cities: textToList(form.preferred_cities),
      preferred_neighborhoods: textToList(form.preferred_neighborhoods),
      min_bedrooms: optionalNumber(form.min_bedrooms),
      min_bathrooms: optionalNumber(form.min_bathrooms),
      min_parking_spaces: optionalNumber(form.min_parking_spaces),
      min_total_area: optionalNumber(form.min_total_area),
      min_built_area: optionalNumber(form.min_built_area),
      financing_needed: Boolean(form.financing_needed),
      urgency: form.urgency,
      must_haves: form.must_haves.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = await saveLeadPreferences(lead.id, payload);
    if (result.error) {
      setMessage(`Não foi possível salvar: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setPreferences(result.data);
    const matchesResult = await getLeadPropertyMatches(lead.id, result.data);
    setMatches(matchesResult.data || []);
    setMessage('Perfil salvo e imóveis recalculados.');
    setSaving(false);
  }

  async function setMatchStatus(match, status) {
    const result = await saveLeadMatchStatus(lead.id, match.property.id, status, match.score);
    if (result.error) {
      setMessage(`Não foi possível atualizar o imóvel: ${result.error.message}`);
      return;
    }

    setMatches((current) => current.map((item) => (
      item.property.id === match.property.id ? { ...item, savedStatus: status } : item
    )));
  }

  const activeMatches = useMemo(
    () => matches.filter((item) => item.savedStatus !== 'discarded'),
    [matches]
  );

  const shortlist = activeMatches.slice(0, 3);

  function shortlistText() {
    if (!shortlist.length) return '';
    const intro = `Olá, ${lead.name}. Separei alguns imóveis que combinam com o que você procura:`;
    const items = shortlist.map((item, index) => {
      const url = `${window.location.origin}/imovel/${item.property.slug}`;
      const price = item.price ? formatCurrency(item.price) : 'Consulte o valor';
      return `${index + 1}. ${item.property.title} — ${price}\n${url}`;
    });
    return `${intro}\n\n${items.join('\n\n')}\n\nSe quiser, me diga qual chamou mais sua atenção.`;
  }

  async function copyShortlist() {
    const text = shortlistText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setMessage('Seleção copiada.');
  }

  function openWhatsApp() {
    const phone = normalizePhone(lead.whatsapp);
    const text = shortlistText();
    if (!phone || !text) return;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  if (loading) return <section className="admin-panel"><p>Carregando perfil de interesse...</p></section>;

  return (
    <section className="admin-panel lead-match-panel">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Match de imóveis</span>
          <h2>O que este cliente procura</h2>
          <p>Salve os critérios uma vez e o CRM compara automaticamente com a carteira publicada.</p>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <form onSubmit={save} className="match-preferences-form">
        <div className="match-form-grid">
          <label>
            Objetivo
            <select name="purpose" value={form.purpose} onChange={updateField}>
              {MATCH_PURPOSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label>
            Prazo para decidir
            <select name="urgency" value={form.urgency} onChange={updateField}>
              {MATCH_URGENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label>
            Orçamento mínimo
            <input type="number" min="0" step="1000" name="min_price" value={form.min_price} onChange={updateField} placeholder="Ex.: 180000" />
          </label>

          <label>
            Orçamento máximo
            <input type="number" min="0" step="1000" name="max_price" value={form.max_price} onChange={updateField} placeholder="Ex.: 300000" />
          </label>

          <label>
            Cidades preferidas
            <input name="preferred_cities" value={form.preferred_cities} onChange={updateField} placeholder="Ex.: Ressaquinha, Barbacena" />
          </label>

          <label>
            Bairros preferidos
            <input name="preferred_neighborhoods" value={form.preferred_neighborhoods} onChange={updateField} placeholder="Separe por vírgulas" />
          </label>

          <label>
            Mínimo de quartos
            <input type="number" min="0" name="min_bedrooms" value={form.min_bedrooms} onChange={updateField} />
          </label>

          <label>
            Mínimo de banheiros
            <input type="number" min="0" name="min_bathrooms" value={form.min_bathrooms} onChange={updateField} />
          </label>

          <label>
            Mínimo de vagas
            <input type="number" min="0" name="min_parking_spaces" value={form.min_parking_spaces} onChange={updateField} />
          </label>

          <label>
            Área total mínima (m²)
            <input type="number" min="0" step="0.01" name="min_total_area" value={form.min_total_area} onChange={updateField} />
          </label>

          <label>
            Área construída mínima (m²)
            <input type="number" min="0" step="0.01" name="min_built_area" value={form.min_built_area} onChange={updateField} />
          </label>

          <label className="match-checkbox-line">
            <input type="checkbox" name="financing_needed" checked={form.financing_needed} onChange={updateField} />
            Pretende financiar
          </label>
        </div>

        <div className="match-type-block">
          <strong>Tipos de imóvel</strong>
          <div className="match-type-options">
            {MATCH_PROPERTY_TYPES.map((type) => (
              <label key={type} className={form.property_types.includes(type) ? 'selected' : ''}>
                <input
                  type="checkbox"
                  checked={form.property_types.includes(type)}
                  onChange={() => toggleType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <label>
          O que é indispensável
          <textarea name="must_haves" rows="3" value={form.must_haves} onChange={updateField} placeholder="Ex.: quintal, rua plana, perto do centro, cozinha grande..." />
        </label>

        <label>
          Observações do perfil
          <textarea name="notes" rows="3" value={form.notes} onChange={updateField} placeholder="Informações importantes para a busca." />
        </label>

        <button className="button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar perfil e calcular imóveis'}</button>
      </form>

      {preferences && (
        <div className="match-results-block">
          <div className="panel-title-row">
            <div>
              <h3>Imóveis compatíveis</h3>
              <p>{activeMatches.length} opção(ões) ativa(s), ordenadas pela compatibilidade com o perfil.</p>
            </div>
            {shortlist.length > 0 && (
              <div className="match-share-actions">
                <button type="button" className="admin-link-button" onClick={copyShortlist}>Copiar 3 melhores</button>
                {lead.whatsapp && <button type="button" className="button" onClick={openWhatsApp}>Enviar pelo WhatsApp</button>}
              </div>
            )}
          </div>

          {matches.length === 0 ? (
            <div className="admin-empty-state"><p>Nenhum imóvel publicado combina com esse objetivo neste momento.</p></div>
          ) : (
            <div className="property-match-list">
              {matches.slice(0, 12).map((match) => (
                <article key={match.property.id} className={`property-match-card ${match.savedStatus === 'discarded' ? 'is-discarded' : ''}`}>
                  <div className="property-match-score">
                    <strong>{match.score}%</strong>
                    <span>compatível</span>
                  </div>

                  <div className="property-match-main">
                    <div className="property-match-heading">
                      <div>
                        <small>{match.property.code} · {match.property.property_type}</small>
                        <h4>{match.property.title}</h4>
                        <p>{match.property.public_location_text}</p>
                      </div>
                      <strong>{match.price ? formatCurrency(match.price) : 'Consulte o valor'}</strong>
                    </div>

                    <div className="property-match-reasons">
                      {match.reasons.map((reason) => <span key={reason}>{reason}</span>)}
                    </div>

                    <div className="property-match-footer">
                      <div className="property-match-status">
                        <span>Situação:</span>
                        <strong>{MATCH_STATUS_LABELS[match.savedStatus] || match.savedStatus}</strong>
                      </div>
                      <div className="property-match-actions">
                        <a className="admin-link-button" href={`/imovel/${match.property.slug}`} target="_blank" rel="noreferrer">Ver imóvel</a>
                        <button type="button" className="admin-link-button" onClick={() => setMatchStatus(match, 'interested')}>Interessou</button>
                        <button type="button" className="admin-link-button" onClick={() => setMatchStatus(match, 'visit')}>Visita</button>
                        <button type="button" className="admin-link-button danger-link" onClick={() => setMatchStatus(match, 'discarded')}>Descartar</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
