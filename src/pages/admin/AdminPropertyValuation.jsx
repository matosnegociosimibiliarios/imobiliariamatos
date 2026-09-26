import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAdminProperty } from '../../services/admin';
import {
  addValuationAdjustment,
  addValuationComparable,
  createPropertyValuation,
  deleteValuationAdjustment,
  deleteValuationComparable,
  getPropertyValuationCandidates,
  getPropertyValuations,
  getAdvancedPropertyValuationAnalysis,
  getAdvancedPropertyValuationAnalysisV2,
  recalculatePropertyValuation,
  setPropertyValuationStatus,
  updatePropertyValuation,
} from '../../services/propertyValuation';
import { formatMoney } from '../../services/properties';

const TYPE_LABELS = {
  manual: 'Manual',
  market_comparison: 'Comparativo de mercado',
  income: 'Capitalização da renda',
  cost: 'Custo',
  hybrid: 'Híbrida',
};

const CONFIDENCE_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

function comparableValue(item) {
  return item.reference_value ?? item.closed_price ?? item.listed_price;
}

export default function AdminPropertyValuation() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [valuations, setValuations] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [advancedAnalysis, setAdvancedAnalysis] = useState(null);
  const [advancedAnalysisV2, setAdvancedAnalysisV2] = useState(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [expandedComparable, setExpandedComparable] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({ adjustment_type: 'Localização', percentage: '', justification: '' });
  const [manualForm, setManualForm] = useState({
    source_label: '',
    reference_date: new Date().toISOString().slice(0, 10),
    reference_value: '',
    area: '',
    built_area: '',
    bedrooms: '',
    bathrooms: '',
    parking_spaces: '',
    similarity_index: '70',
    distance_km: '',
    notes: '',
  });

  async function loadProperty() {
    const result = await getAdminProperty(id);
    if (result.error || !result.data) {
      setMessage('Não foi possível carregar o imóvel.');
      return;
    }
    setProperty(result.data);
  }

  async function loadValuations() {
    const result = await getPropertyValuations(id);
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível carregar as avaliações.');
      return;
    }
    setValuations(result.data || []);
    if (!selectedId && result.data?.length) setSelectedId(result.data[0].id);
  }

  async function loadCandidates() {
    const result = await getPropertyValuationCandidates(id, 30);
    if (!result.error) setCandidates(result.data || []);
  }

  async function loadAdvancedAnalysis(valuationId = selectedId) {
    if (!valuationId) { setAdvancedAnalysis(null); return; }
    const result = await getAdvancedPropertyValuationAnalysis(valuationId);
    const v2 = await getAdvancedPropertyValuationAnalysisV2(valuationId);
    setAdvancedAnalysis(result.error ? null : result.data);
    setAdvancedAnalysisV2(v2.error ? null : v2.data);
  }

  async function load() {
    setLoading(true);
    await Promise.all([loadProperty(), loadValuations(), loadCandidates()]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    let active = true;
    if (!selectedId) { setAdvancedAnalysis(null); return () => {}; }
    (async () => {
      const result = await getAdvancedPropertyValuationAnalysis(selectedId);
      const v2 = await getAdvancedPropertyValuationAnalysisV2(selectedId);
      if (active) {
        setAdvancedAnalysis(result.error ? null : result.data);
        setAdvancedAnalysisV2(v2.error ? null : v2.data);
      }
    })();
    return () => { active = false; };
  }, [selectedId]);

  const selected = useMemo(
    () => valuations.find((item) => item.id === selectedId) || null,
    [valuations, selectedId]
  );

  const marketSummary = useMemo(() => {
    const comparables = selected?.comparables || [];
    const closedSales = comparables.filter((item) => item.source_type === 'closed_sale');
    const activeListings = comparables.filter((item) => item.source_type === 'active_listing');
    const manualSources = comparables.filter((item) => item.source_type === 'manual');
    const pricePerM2 = comparables
      .map((item) => {
        const value = Number(comparableValue(item) || 0);
        const area = Number(item.area || item.built_area || 0);
        return value > 0 && area > 0 ? value / area : null;
      })
      .filter((value) => Number.isFinite(value) && value > 0);
    const sorted = [...pricePerM2].sort((a, b) => a - b);
    const medianPricePerM2 = sorted.length
      ? sorted.length % 2
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : null;
    const latestClosed = [...closedSales]
      .sort((a, b) => String(b.reference_date || '').localeCompare(String(a.reference_date || '')))[0] || null;

    return {
      total: comparables.length,
      closedSales: closedSales.length,
      activeListings: activeListings.length,
      manualSources: manualSources.length,
      medianPricePerM2,
      latestClosed,
    };
  }, [selected]);

  async function createEvaluation() {
    setSaving(true);
    const result = await createPropertyValuation(id, {
      valuation_type: 'market_comparison',
      purpose: property?.purpose === 'rent' ? 'rent' : 'sale',
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível iniciar a avaliação.');
    else {
      setSelectedId(result.data.id);
      await loadValuations();
      setMessage('Nova avaliação criada.');
    }
    setSaving(false);
  }

  async function saveHeader(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const result = await updatePropertyValuation(selected.id, {
      valuation_date: form.get('valuation_date'),
      valuation_type: form.get('valuation_type'),
      purpose: form.get('purpose') || null,
      methodology_notes: form.get('methodology_notes') || null,
      observations: form.get('observations') || null,
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível salvar a avaliação.');
    else {
      setMessage('Avaliação atualizada.');
      await loadValuations();
    }
    setSaving(false);
  }

  async function addCandidate(candidate) {
    if (!selected) return;
    setSaving(true);
    const referenceValue = Number(candidate.reference_value || candidate.sale_price || 0);
    const isClosedSale = candidate.source_type === 'closed_sale';
    const result = await addValuationComparable(selected.id, {
      comparable_property_id: candidate.property_id,
      transaction_id: candidate.transaction_id || null,
      source_type: candidate.source_type || 'active_listing',
      reference_date: candidate.reference_date || new Date().toISOString().slice(0, 10),
      listed_price: candidate.listed_price ?? (isClosedSale ? null : referenceValue),
      closed_price: candidate.closed_price ?? (isClosedSale ? referenceValue : null),
      proposal_price: candidate.proposal_price ?? null,
      reference_value: referenceValue,
      area: candidate.built_area || candidate.total_area,
      built_area: candidate.built_area,
      bedrooms: candidate.bedrooms,
      suites: candidate.suites,
      bathrooms: candidate.bathrooms,
      parking_spaces: candidate.parking_spaces,
      property_type: candidate.property_type,
      purpose: candidate.purpose,
      location_text: candidate.location_text,
      similarity_index: candidate.similarity_index,
      source_label: candidate.code + ' — ' + candidate.title,
      property_snapshot: candidate,
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível adicionar o comparável.');
    else {
      setMessage('Comparável adicionado.');
      await refreshSelected();
      await loadAdvancedAnalysis(selected.id);
    }
    setSaving(false);
  }

  async function addManualComparable(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    const result = await addValuationComparable(selected.id, {
      source_type: 'manual',
      source_label: manualForm.source_label || 'Comparável manual',
      reference_date: manualForm.reference_date,
      reference_value: numberOrNull(manualForm.reference_value),
      area: numberOrNull(manualForm.area),
      built_area: numberOrNull(manualForm.built_area),
      bedrooms: numberOrNull(manualForm.bedrooms),
      bathrooms: numberOrNull(manualForm.bathrooms),
      parking_spaces: numberOrNull(manualForm.parking_spaces),
      similarity_index: numberOrNull(manualForm.similarity_index),
      distance_km: numberOrNull(manualForm.distance_km),
      property_type: property?.property_type || null,
      purpose: property?.purpose || null,
      location_text: manualForm.source_label || null,
      notes: manualForm.notes || null,
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível adicionar o comparável.');
    else {
      setShowManual(false);
      setMessage('Comparável manual adicionado.');
      await refreshSelected();
      await loadAdvancedAnalysis(selected.id);
    }
    setSaving(false);
  }

  async function refreshSelected() {
    const result = await getPropertyValuations(id);
    if (!result.error) {
      setValuations(result.data || []);
      await loadAdvancedAnalysis(selectedId);
    }
  }

  async function removeComparable(comparable) {
    if (!window.confirm('Remover este comparável da avaliação?')) return;
    setSaving(true);
    const result = await deleteValuationComparable(comparable.id);
    if (result.error) setMessage(result.error.message || 'Não foi possível remover o comparável.');
    else {
      setMessage('Comparável removido.');
      await refreshSelected();
      await loadAdvancedAnalysis(selected.id);
    }
    setSaving(false);
  }

  async function addAdjustment(comparable) {
    const percentage = Number(adjustmentForm.percentage);
    if (!Number.isFinite(percentage)) {
      setMessage('Informe o percentual do ajuste.');
      return;
    }
    setSaving(true);
    const result = await addValuationAdjustment(comparable.id, adjustmentForm);
    if (result.error) setMessage(result.error.message || 'Não foi possível adicionar o ajuste.');
    else {
      setAdjustmentForm({ adjustment_type: 'Localização', percentage: '', justification: '' });
      setMessage('Ajuste adicionado.');
      await refreshSelected();
    }
    setSaving(false);
  }

  async function removeAdjustment(adjustment) {
    setSaving(true);
    const result = await deleteValuationAdjustment(adjustment.id);
    if (result.error) setMessage(result.error.message || 'Não foi possível remover o ajuste.');
    else {
      await refreshSelected();
      await loadAdvancedAnalysis(selected.id);
    }
    setSaving(false);
  }

  async function changeStatus(status) {
    if (!selected) return;
    const labels = { final: 'Finalizar avaliação', archived: 'Arquivar avaliação', draft: 'Reabrir como rascunho' };
    if (!window.confirm(labels[status] + '?')) return;
    setSaving(true);
    const result = await setPropertyValuationStatus(selected.id, status);
    if (result.error) setMessage(result.error.message || 'Não foi possível alterar o status da avaliação.');
    else {
      setMessage(status === 'final' ? 'Avaliação finalizada.' : status === 'archived' ? 'Avaliação arquivada.' : 'Avaliação reaberta como rascunho.');
      await refreshSelected();
      await loadAdvancedAnalysis(selected.id);
    }
    setSaving(false);
  }

  async function calculate() {
    if (!selected) return;
    setSaving(true);
    const result = await recalculatePropertyValuation(selected.id);
    if (result.error) setMessage(result.error.message || 'Não foi possível calcular a avaliação.');
    else {
      setMessage('Cálculo atualizado com base nos comparáveis aceitos.');
      await refreshSelected();
      await loadAdvancedAnalysis(selected.id);
    }
    setSaving(false);
  }

  if (loading) return <div className="admin-loading">Carregando avaliação...</div>;
  if (!property) return <div className="admin-page"><div className="admin-message">{message || 'Imóvel não encontrado.'}</div></div>;

  return (
    <div className="admin-page property-valuation-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Avaliação de imóveis</span>
          <h1>{property.code} — {property.title}</h1>
          <p>{property.public_location_text || 'Localização não informada'}</p>
        </div>
        <div className="admin-page-actions">
          <Link className="admin-link-button" to={'/admin/imoveis/' + id + '/editar'}>Cadastro</Link>
          <Link className="admin-link-button" to={'/admin/imoveis/' + id + '/gestao'}>Gestão</Link>
          <Link className="admin-link-button active" to={'/admin/imoveis/' + id + '/avaliacao'}>Avaliação</Link>
          <Link className="admin-link-button" to="/admin/imoveis">Voltar</Link>
        </div>
      </div>

      <div className="property-record-tabs">
        <Link to={'/admin/imoveis/' + id + '/editar'}>Cadastro</Link>
        <Link to={'/admin/imoveis/' + id + '/gestao'}>Gestão</Link>
        <Link className="active" to={'/admin/imoveis/' + id + '/avaliacao'}>Avaliação</Link>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <section className="admin-panel valuation-property-summary">
        <div>
          <span className="eyebrow">Imóvel avaliando</span>
          <h2>{property.code} — {property.title}</h2>
          <p>{property.public_location_text || 'Localização não informada'}</p>
        </div>
        <div className="valuation-property-facts">
          <span><b>Tipo</b>{property.property_type || '—'}</span>
          <span><b>Área</b>{formatNumber(property.built_area || property.total_area, 0)} m²</span>
          <span><b>Quartos</b>{property.bedrooms ?? '—'}</span>
          <span><b>Suítes</b>{property.suites ?? '—'}</span>
          <span><b>Banheiros</b>{property.bathrooms ?? '—'}</span>
          <span><b>Vagas</b>{property.parking_spaces ?? '—'}</span>
          <span><b>Preço atual</b>{formatMoney(property.sale_price) || '—'}</span>
        </div>
      </section>

      <section className="admin-panel">
        <div className="property-section-heading">
          <div><span className="eyebrow">Histórico</span><h2>Avaliações deste imóvel</h2></div>
          <button className="button" type="button" onClick={createEvaluation} disabled={saving}>+ Nova avaliação</button>
        </div>
        {valuations.length === 0 ? (
          <div className="admin-empty"><h2>Nenhuma avaliação criada</h2><p>Crie a primeira avaliação para registrar histórico, comparáveis e memória de cálculo.</p></div>
        ) : (
          <div className="valuation-history-list">
            {valuations.map((item) => (
              <button key={item.id} type="button" className={item.id === selectedId ? 'valuation-history-item active' : 'valuation-history-item'} onClick={() => setSelectedId(item.id)}>
                <span>{new Date(item.valuation_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                <strong>{TYPE_LABELS[item.valuation_type] || item.valuation_type}</strong>
                <b>{formatMoney(item.estimated_value) || 'Sem cálculo'}</b>
                <small>{item.comparables?.length || 0} comparável(is)</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <>
          <form className="admin-panel valuation-header-form" onSubmit={saveHeader}>
            <div className="property-section-heading">
              <div><span className="eyebrow">Configuração</span><h2>Dados da avaliação</h2></div>
              <div className="valuation-header-status">
                <span className="valuation-status">{selected.status === 'final' ? 'Finalizada' : selected.status === 'archived' ? 'Arquivada' : 'Rascunho'}</span>
                <div className="valuation-status-actions">
                  {selected.status === 'draft' && <button type="button" className="admin-link-button" onClick={() => changeStatus('final')} disabled={saving || !selected.comparables?.length || !selected.estimated_value}>Finalizar</button>}
                  {selected.status === 'final' && <button type="button" className="admin-link-button" onClick={() => changeStatus('archived')} disabled={saving}>Arquivar</button>}
                  {selected.status === 'archived' && <button type="button" className="admin-link-button" onClick={() => changeStatus('draft')} disabled={saving}>Reabrir</button>}
                </div>
              </div>
            </div>
            <div className="admin-form-grid three">
              <label>Data-base<input type="date" name="valuation_date" defaultValue={selected.valuation_date} /></label>
              <label>Método<select name="valuation_type" defaultValue={selected.valuation_type}>{Object.entries(TYPE_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label>Finalidade<select name="purpose" defaultValue={selected.purpose || 'sale'}><option value="sale">Venda</option><option value="rent">Locação</option><option value="internal">Análise interna</option></select></label>
              <label className="full">Metodologia / premissas<textarea rows="3" name="methodology_notes" defaultValue={selected.methodology_notes || ''} placeholder="Registre premissas, limitações e critérios usados na amostra." /></label>
              <label className="full">Observações<textarea rows="3" name="observations" defaultValue={selected.observations || ''} /></label>
            </div>
            <div className="admin-save-bar"><button className="button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar dados da avaliação'}</button></div>
          </form>

          <section className="admin-panel">
            <div className="property-section-heading">
              <div><span className="eyebrow">Amostra</span><h2>Comparáveis</h2><p className="valuation-help">Os dados do imóvel avaliando são preservados como fotografia da avaliação. Os comparáveis aceitos entram no cálculo.</p></div>
              <div className="admin-page-actions"><button className="admin-link-button" type="button" onClick={() => setShowCandidates((value) => !value)}>Sugerir comparáveis</button><button className="admin-link-button" type="button" onClick={() => setShowManual((value) => !value)}>+ Comparável manual</button></div>
            </div>

            {showCandidates && (
              <div className="valuation-candidate-box">
                <div className="valuation-candidate-heading"><strong>Sugestões encontradas no CRM</strong><button type="button" onClick={loadCandidates}>Atualizar</button></div>
                {candidates.length === 0 ? <p>Nenhum comparável elegível encontrado no cadastro atual.</p> : candidates.map((candidate) => (
                  <div className="valuation-candidate-row" key={candidate.transaction_id || candidate.property_id}>
                    <div>
                      <strong>{candidate.code} — {candidate.title}</strong>
                      <span>
                        {candidate.source_type === 'closed_sale' ? 'Negócio realizado' : 'Imóvel anunciado'}
                        {' · '}
                        {candidate.reference_date ? new Date(candidate.reference_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Data não informada'}
                        {' · '}
                        {candidate.location_text || candidate.neighborhood_name || candidate.city_name || 'Local não informado'}
                        {' · '}
                        {formatNumber(candidate.built_area || candidate.total_area)} m²
                        {' · '}
                        {formatMoney(candidate.reference_value || candidate.sale_price)}
                      </span>
                    </div>
                    <div>
                      <b>{formatNumber(candidate.similarity_index, 0)}%</b>
                      <button type="button" onClick={() => addCandidate(candidate)} disabled={saving}>Adicionar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showManual && (
              <form className="valuation-manual-form" onSubmit={addManualComparable}>
                <label>Fonte / identificação<input value={manualForm.source_label} onChange={(e) => setManualForm({...manualForm,source_label:e.target.value})} placeholder="Ex.: OLX, proprietário, corretor parceiro..." required /></label>
                <label>Data referência<input type="date" value={manualForm.reference_date} onChange={(e) => setManualForm({...manualForm,reference_date:e.target.value})} /></label>
                <label>Valor referência<input type="number" min="0" step="0.01" value={manualForm.reference_value} onChange={(e) => setManualForm({...manualForm,reference_value:e.target.value})} required /></label>
                <label>Área (m²)<input type="number" min="0" step="0.01" value={manualForm.area} onChange={(e) => setManualForm({...manualForm,area:e.target.value})} /></label>
                <label>Área construída<input type="number" min="0" step="0.01" value={manualForm.built_area} onChange={(e) => setManualForm({...manualForm,built_area:e.target.value})} /></label>
                <label>Quartos<input type="number" min="0" value={manualForm.bedrooms} onChange={(e) => setManualForm({...manualForm,bedrooms:e.target.value})} /></label>
                <label>Banheiros<input type="number" min="0" value={manualForm.bathrooms} onChange={(e) => setManualForm({...manualForm,bathrooms:e.target.value})} /></label>
                <label>Vagas<input type="number" min="0" value={manualForm.parking_spaces} onChange={(e) => setManualForm({...manualForm,parking_spaces:e.target.value})} /></label>
                <label>Similaridade (%)<input type="number" min="0" max="100" step="1" value={manualForm.similarity_index} onChange={(e) => setManualForm({...manualForm,similarity_index:e.target.value})} /></label>
                <label>Distância (km)<input type="number" min="0" step="0.1" value={manualForm.distance_km} onChange={(e) => setManualForm({...manualForm,distance_km:e.target.value})} /></label>
                <label className="full">Observações<input value={manualForm.notes} onChange={(e) => setManualForm({...manualForm,notes:e.target.value})} /></label>
                <div className="admin-save-bar"><button className="button" disabled={saving}>Adicionar comparável</button></div>
              </form>
            )}

            {selected.comparables?.length ? (
              <div className="valuation-market-summary">
                <article><span>Comparáveis</span><strong>{marketSummary.total}</strong><small>Amostra atual</small></article>
                <article><span>Negócios realizados</span><strong>{marketSummary.closedSales}</strong><small>Dados efetivamente fechados</small></article>
                <article><span>Anúncios ativos</span><strong>{marketSummary.activeListings}</strong><small>Oferta observada no CRM</small></article>
                <article><span>R$/m² mediano</span><strong>{marketSummary.medianPricePerM2 ? formatMoney(marketSummary.medianPricePerM2) : '—'}</strong><small>Entre os comparáveis com área e valor</small></article>
                <article><span>Último negócio</span><strong>{marketSummary.latestClosed?.closed_price ? formatMoney(marketSummary.latestClosed.closed_price) : '—'}</strong><small>{marketSummary.latestClosed?.reference_date ? new Date(marketSummary.latestClosed.reference_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Nenhum negócio fechado na amostra'}</small></article>
              </div>
            ) : null}

            <div className="valuation-comparables-table-wrap">
              {selected.comparables?.length ? (
                <table className="admin-table valuation-comparables-table">
                  <thead><tr><th>Comparável</th><th>Valor</th><th>Área</th><th>R$/m²</th><th>Similaridade</th><th>Ajustes</th><th></th></tr></thead>
                  <tbody>
                    {selected.comparables.map((item) => {
                      const base = comparableValue(item);
                      const adjustmentTotal = (item.adjustments || []).reduce((sum, adjustment) => sum + Number(adjustment.adjustment_value || 0), 0);
                      const finalValue = Number(base || 0) + adjustmentTotal;
                      const area = Number(item.area || item.built_area || 0);
                      return (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td>
                              <strong>{item.source_label || item.comparable_property?.code || 'Comparável'}</strong>
                              <small>
                                {item.source_type === 'closed_sale' ? 'Negócio realizado' : item.source_type === 'active_listing' ? 'Imóvel anunciado' : 'Fonte manual'}
                                {item.reference_date ? ' · ' + new Date(item.reference_date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                              </small>
                              <small>{item.location_text || item.comparable_property?.public_location_text || '—'}</small>
                            </td>
                            <td><strong>{formatMoney(finalValue)}</strong><small>base {formatMoney(base)}</small></td>
                            <td>{formatNumber(area)} m²</td>
                            <td>{area > 0 ? formatMoney(finalValue / area) : '—'}</td>
                            <td>{formatNumber(item.similarity_index, 0)}%</td>
                            <td><button className="admin-link-button" type="button" onClick={() => setExpandedComparable(expandedComparable === item.id ? null : item.id)}>{item.adjustments?.length || 0} ajuste(s)</button></td>
                            <td><button className="danger-text-button" type="button" onClick={() => removeComparable(item)}>Remover</button></td>
                          </tr>
                          {expandedComparable === item.id && (
                            <tr>
                              <td colSpan="7">
                                <div className="valuation-adjustment-panel">
                                  <div className="valuation-adjustment-list">
                                    {(item.adjustments || []).map((adjustment) => (
                                      <div key={adjustment.id}><span>{adjustment.adjustment_type}</span><b>{Number(adjustment.percentage) > 0 ? '+' : ''}{formatNumber(adjustment.percentage, 2)}%</b><small>{adjustment.justification || 'Sem justificativa'}</small><button type="button" onClick={() => removeAdjustment(adjustment)}>Excluir</button></div>
                                    ))}
                                  </div>
                                  <div className="valuation-adjustment-form">
                                    <label>Tipo<select value={adjustmentForm.adjustment_type} onChange={(e) => setAdjustmentForm({...adjustmentForm,adjustment_type:e.target.value})}><option>Localização</option><option>Área</option><option>Conservação</option><option>Padrão</option><option>Idade</option><option>Quartos</option><option>Vagas</option><option>Outros</option></select></label>
                                    <label>Ajuste (%)<input type="number" min="-100" max="100" step="0.01" value={adjustmentForm.percentage} onChange={(e) => setAdjustmentForm({...adjustmentForm,percentage:e.target.value})} placeholder="-5 ou 8" /></label>
                                    <label className="wide">Justificativa<input value={adjustmentForm.justification} onChange={(e) => setAdjustmentForm({...adjustmentForm,justification:e.target.value})} /></label>
                                    <button type="button" onClick={() => addAdjustment(item)} disabled={saving}>Adicionar ajuste</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="admin-empty"><h3>Amostra ainda vazia</h3><p>Adicione comparáveis sugeridos pelo CRM ou registre fontes manualmente.</p></div>
              )}
            </div>
          </section>

          <section className="admin-panel valuation-advanced-panel">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Análise avançada</span>
                <h2>Leitura técnica do mercado</h2>
                <p className="valuation-help">Indicadores calculados exclusivamente a partir da amostra aceita nesta avaliação.</p>
              </div>
            </div>
            {!advancedAnalysis ? (
              <div className="admin-empty"><p>Calcule a avaliação para atualizar a análise avançada.</p></div>
            ) : (
              <>
                <div className="valuation-advanced-grid">
                  <article><span>Mediana R$/m²</span><strong>{advancedAnalysis.price_per_m2?.median ? formatMoney(advancedAnalysis.price_per_m2.median) : '—'}</strong><small>Referência central da amostra</small></article>
                  <article><span>Média ponderada R$/m²</span><strong>{advancedAnalysis.price_per_m2?.weighted_mean ? formatMoney(advancedAnalysis.price_per_m2.weighted_mean) : '—'}</strong><small>Considera o peso dos comparáveis</small></article>
                  <article><span>Média R$/m²</span><strong>{advancedAnalysis.price_per_m2?.mean ? formatMoney(advancedAnalysis.price_per_m2.mean) : '—'}</strong><small>Valor médio observado</small></article>
                  <article><span>Variação da amostra</span><strong>{advancedAnalysis.price_per_m2?.coefficient_variation_pct != null ? formatNumber(advancedAnalysis.price_per_m2.coefficient_variation_pct, 1) + '%' : '—'}</strong><small>Coeficiente de variação</small></article>
                  <article><span>Desconto médio realizado</span><strong>{advancedAnalysis.liquidity?.avg_closed_discount_pct != null ? formatNumber(advancedAnalysis.liquidity.avg_closed_discount_pct, 1) + '%' : '—'}</strong><small>Preço fechado versus anunciado</small></article>
                  <article><span>Prazo mediano</span><strong>{advancedAnalysis.liquidity?.median_days_on_market != null ? formatNumber(advancedAnalysis.liquidity.median_days_on_market, 0) + ' dias' : '—'}</strong><small>Tempo de mercado dos fechamentos</small></article>
                  <article><span>Confiança da amostra</span><strong>{advancedAnalysis.quality?.confidence === 'high' ? 'Alta' : advancedAnalysis.quality?.confidence === 'medium' ? 'Média' : advancedAnalysis.quality?.confidence === 'low' ? 'Baixa' : '—'}</strong><small>{advancedAnalysis.quality?.score != null ? 'Índice interno: ' + formatNumber(advancedAnalysis.quality.score, 0) + '/100' : 'Qualidade da amostra'}</small></article>
                  <article><span>Posição estimada</span><strong>{advancedAnalysis.positioning?.estimated_vs_median_market_pct != null ? (advancedAnalysis.positioning.estimated_vs_median_market_pct > 0 ? '+' : '') + formatNumber(advancedAnalysis.positioning.estimated_vs_median_market_pct, 1) + '%' : '—'}</strong><small>Versus mediana de mercado por m²</small></article>
                </div>
                <div className="valuation-advanced-subgrid">
                  <div>
                    <strong>Amostra</strong>
                    <p>{advancedAnalysis.sample?.count || 0} comparáveis aceitos · {advancedAnalysis.sample?.closed_sales || 0} negócios realizados · {advancedAnalysis.sample?.active_listings || 0} anúncios ativos.</p>
                    <p>Similaridade média: {formatNumber(advancedAnalysis.sample?.avg_similarity, 1)}% · Distância média: {advancedAnalysis.sample?.avg_distance_km != null ? formatNumber(advancedAnalysis.sample.avg_distance_km, 1) + ' km' : '—'}.</p>
                    <p>R$/m² ponderado: {advancedAnalysis.price_per_m2?.weighted_mean != null ? formatMoney(advancedAnalysis.price_per_m2.weighted_mean) : '—'} · dispersão: {advancedAnalysis.price_per_m2?.coefficient_variation_pct != null ? formatNumber(advancedAnalysis.price_per_m2.coefficient_variation_pct, 1) + '%' : '—'}.</p>
                  </div>
                  <div>
                    <strong>Leitura para investimento</strong>
                    <p>{advancedAnalysis.investment?.gross_yield_pct != null ? 'Yield bruto indicativo: ' + formatNumber(advancedAnalysis.investment.gross_yield_pct, 2) + '% ao ano.' : 'Sem aluguel informado no snapshot para calcular yield bruto.'}</p>
                    <p>O yield é apenas uma métrica indicativa e não considera vacância, impostos, manutenção, condomínio ou outros custos.</p>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="admin-panel valuation-v2-panel">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Análise avançada V2</span>
                <h2>Robustez e cenários de mercado</h2>
                <p className="valuation-help">A análise usa apenas comparáveis aceitos e separa mediana, quartis e possíveis outliers da amostra.</p>
              </div>
            </div>
            {!advancedAnalysisV2 ? (
              <div className="admin-empty"><p>Adicione e aceite comparáveis para gerar a análise avançada.</p></div>
            ) : (
              <>
                <div className="valuation-advanced-grid">
                  <article><span>R$/m² P25</span><strong>{advancedAnalysisV2.price_per_m2?.p25 ? formatMoney(advancedAnalysisV2.price_per_m2.p25) : '—'}</strong><small>Faixa conservadora</small></article>
                  <article><span>R$/m² mediano</span><strong>{advancedAnalysisV2.price_per_m2?.median ? formatMoney(advancedAnalysisV2.price_per_m2.median) : '—'}</strong><small>Ponto central da amostra</small></article>
                  <article><span>R$/m² P75</span><strong>{advancedAnalysisV2.price_per_m2?.p75 ? formatMoney(advancedAnalysisV2.price_per_m2.p75) : '—'}</strong><small>Faixa superior observada</small></article>
                  <article><span>Outliers</span><strong>{advancedAnalysisV2.outliers?.count ?? 0}</strong><small>Fora do intervalo IQR</small></article>
                  <article><span>Amostra fechada</span><strong>{formatNumber(advancedAnalysisV2.sample?.closed_share_pct, 1)}%</strong><small>Participação de negócios realizados</small></article>
                  <article><span>Dispersão</span><strong>{advancedAnalysisV2.interpretation?.dispersion || '—'}</strong><small>Coeficiente de variação</small></article>
                </div>
                <div className="valuation-v2-scenarios">
                  <div><strong>Cenários por m²</strong><span>Conservador: {advancedAnalysisV2.scenarios?.conservative_value ? formatMoney(advancedAnalysisV2.scenarios.conservative_value) : '—'}</span><span>Central: {advancedAnalysisV2.scenarios?.central_value ? formatMoney(advancedAnalysisV2.scenarios.central_value) : '—'}</span><span>Superior: {advancedAnalysisV2.scenarios?.upper_market_value ? formatMoney(advancedAnalysisV2.scenarios.upper_market_value) : '—'}</span></div>
                  <div><strong>Leitura da amostra</strong><span>Força: {advancedAnalysisV2.interpretation?.sample_strength || '—'}</span><span>Sinal: {advancedAnalysisV2.interpretation?.market_signal === 'acima_da_mediana' ? 'Acima da mediana' : advancedAnalysisV2.interpretation?.market_signal === 'abaixo_da_mediana' ? 'Abaixo da mediana' : advancedAnalysisV2.interpretation?.market_signal === 'proximo_da_mediana' ? 'Próximo da mediana' : 'Insuficiente'}</span><span>Qualidade V2: {formatNumber(advancedAnalysisV2.quality?.score, 0)}/100</span></div>
                </div>
                {(advancedAnalysisV2.outliers?.count || 0) > 0 && (
                  <div className="valuation-v2-alert"><strong>Atenção à amostra:</strong> {advancedAnalysisV2.outliers.count} comparável(is) apresenta(m) R$/m² fora do intervalo estatístico entre {formatMoney(advancedAnalysisV2.outliers.lower_bound)} e {formatMoney(advancedAnalysisV2.outliers.upper_bound)}. Revise esses itens antes de finalizar a avaliação.</div>
                )}
              </>
            )}
          </section>

          <section className="admin-panel valuation-results-panel">
            <div className="property-section-heading">
              <div><span className="eyebrow">Resultado</span><h2>Faixa de valor</h2><p className="valuation-help">A qualidade da amostra é um indicador interno da consistência dos dados utilizados, não uma probabilidade de acerto do preço.</p></div>
              <button className="button" type="button" onClick={calculate} disabled={saving || !selected.comparables?.length}>{saving ? 'Calculando...' : 'Calcular avaliação'}</button>
            </div>
            <div className="valuation-result-grid">
              <article><span>Venda rápida</span><strong>{formatMoney(selected.quick_sale_value) || '—'}</strong><small>Referência comercial</small></article>
              <article><span>Valor mínimo</span><strong>{formatMoney(selected.minimum_value) || '—'}</strong><small>Faixa inferior calculada</small></article>
              <article className="featured"><span>Valor estimado</span><strong>{formatMoney(selected.estimated_value) || '—'}</strong><small>{selected.estimated_price_per_m2 ? formatMoney(selected.estimated_price_per_m2) + '/m²' : 'Sem R$/m²'}</small></article>
              <article><span>Valor máximo</span><strong>{formatMoney(selected.maximum_value) || '—'}</strong><small>Faixa superior calculada</small></article>
              <article><span>Anúncio sugerido</span><strong>{formatMoney(selected.suggested_asking_value) || '—'}</strong><small>Posicionamento comercial</small></article>
            </div>
            <div className="valuation-quality-bar">
              <div><span>Qualidade da amostra</span><strong>{formatNumber(selected.sample_quality, 0)}/100</strong></div>
              <div className="valuation-progress"><span style={{ width: Math.min(100, Number(selected.sample_quality || 0)) + '%' }} /></div>
              <b>Nível: {CONFIDENCE_LABELS[selected.confidence_level] || 'Baixa'}</b>
            </div>
          </section>
        </>
      )}

      <section className="admin-panel valuation-disclaimer">
        <strong>Nota técnica</strong>
        <p>Esta ferramenta organiza dados de mercado, comparáveis e memória de cálculo para apoio à decisão comercial. O resultado não substitui laudo técnico ou avaliação formal quando estes forem legalmente exigidos.</p>
      </section>
    </div>
  );
}
