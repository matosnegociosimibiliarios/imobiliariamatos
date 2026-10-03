import React, { useMemo, useState } from 'react';
import { getQuickValuationComparables } from '../../services/quickValuation';

const PROPERTY_TYPES = ['Casa','Apartamento','Terreno','Sítio','Comercial'];

const FINISH_ADJUSTMENT = {
  economico: -0.06,
  medio: 0,
  alto: 0.07,
  luxo: 0.14,
};

const CONDITION_ADJUSTMENT = {
  precisa_reforma: -0.10,
  regular: -0.04,
  bom: 0,
  novo: 0.05,
};

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function decimal(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function median(values) {
  const sorted = values.filter((x) => Number.isFinite(x) && x > 0).sort((a,b) => a-b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function AdminQuickValuation() {
  const [form, setForm] = useState({
    city: '',
    neighborhood: '',
    property_type: 'Casa',
    area: '',
    land_area: '',
    bedrooms: '',
    bathrooms: '',
    parking_spaces: '',
    finish: 'medio',
    condition: 'bom',
    extra_adjustment: '0',
  });
  const [comparables, setComparables] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [manuals, setManuals] = useState([]);
  const [manual, setManual] = useState({ label:'', value:'', area:'' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function searchComparables(event) {
    event?.preventDefault();
    if (!num(form.area)) {
      setMessage('Informe a área usada na avaliação.');
      return;
    }
    setLoading(true);
    setMessage('');
    setSearched(true);
    const result = await getQuickValuationComparables(form);
    setLoading(false);
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível buscar comparáveis.');
      return;
    }
    const list = result.data || [];
    setComparables(list);
    setSelectedIds(list.slice(0, 6).map((item) => item.id));
    if (!list.length) setMessage('Nenhum comparável semelhante foi encontrado na base do GOI. Você ainda pode avaliar usando comparáveis externos.');
  }

  function toggleComparable(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function addManual(event) {
    event.preventDefault();
    const value = num(manual.value);
    const area = num(manual.area);
    if (!value || !area) {
      setMessage('No comparável externo, informe valor e área.');
      return;
    }
    setManuals((current) => [...current, {
      id: 'manual-' + Date.now(),
      source: 'manual',
      source_label: 'Comparável externo',
      title: manual.label || 'Imóvel externo',
      value,
      area,
      price_per_m2: value / area,
      similarity: 70,
    }]);
    setManual({ label:'', value:'', area:'' });
    setMessage('');
  }

  const chosen = useMemo(() => {
    const auto = comparables.filter((item) => selectedIds.includes(item.id));
    return [...auto, ...manuals];
  }, [comparables, selectedIds, manuals]);

  const calculation = useMemo(() => {
    const subjectArea = num(form.area);
    if (!subjectArea || !chosen.length) return null;

    let weightedSum = 0;
    let weightTotal = 0;
    const ppms = [];
    let closedSales = 0;
    let similaritySum = 0;

    chosen.forEach((item) => {
      const ppm = num(item.price_per_m2) || (num(item.value) / num(item.area));
      if (!ppm || !Number.isFinite(ppm)) return;
      const similarity = num(item.similarity) || 70;
      const sourceFactor = item.source === 'closed_sale' ? 1.25 : item.source === 'manual' ? 0.9 : 1;
      const weight = Math.max(0.35, similarity / 100) * sourceFactor;
      weightedSum += ppm * weight;
      weightTotal += weight;
      ppms.push(ppm);
      similaritySum += similarity;
      if (item.source === 'closed_sale') closedSales += 1;
    });

    if (!weightTotal) return null;

    const weightedPpm = weightedSum / weightTotal;
    const medianPpm = median(ppms);
    const referencePpm = weightedPpm * 0.65 + medianPpm * 0.35;
    const baseValue = subjectArea * referencePpm;

    const adjustment =
      (FINISH_ADJUSTMENT[form.finish] || 0) +
      (CONDITION_ADJUSTMENT[form.condition] || 0) +
      (num(form.extra_adjustment) / 100);

    const marketValue = baseValue * (1 + adjustment);
    const minimumValue = marketValue * 0.95;
    const maximumValue = marketValue * 1.05;
    const quickSaleValue = marketValue * 0.90;
    const suggestedAskingValue = marketValue * 1.06;

    const avgSimilarity = similaritySum / chosen.length;
    const closedShare = chosen.length ? closedSales / chosen.length : 0;
    let confidenceScore = Math.min(55, chosen.length * 8) + Math.min(25, avgSimilarity * 0.25) + Math.min(20, closedShare * 20);
    confidenceScore = Math.round(Math.min(100, confidenceScore));
    const confidence = confidenceScore >= 75 ? 'Alta' : confidenceScore >= 50 ? 'Média' : 'Baixa';

    return {
      referencePpm,
      baseValue,
      adjustment,
      marketValue,
      minimumValue,
      maximumValue,
      quickSaleValue,
      suggestedAskingValue,
      confidenceScore,
      confidence,
      avgSimilarity,
      closedSales,
    };
  }, [chosen, form]);

  async function copyResult() {
    if (!calculation) return;
    const text = [
      'Avaliação rápida GOI',
      form.property_type + ' — ' + [form.neighborhood, form.city].filter(Boolean).join(', '),
      'Área considerada: ' + decimal(num(form.area)) + ' m²',
      'Comparáveis utilizados: ' + chosen.length,
      'Valor de mercado: ' + money(calculation.marketValue),
      'Faixa provável: ' + money(calculation.minimumValue) + ' a ' + money(calculation.maximumValue),
      'Venda rápida: ' + money(calculation.quickSaleValue),
      'Preço sugerido para anúncio: ' + money(calculation.suggestedAskingValue),
      'Confiança da amostra: ' + calculation.confidence + ' (' + calculation.confidenceScore + '/100)',
      'Referência: ' + money(calculation.referencePpm) + '/m²',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Resumo da avaliação copiado.');
    } catch {
      setMessage('Não foi possível copiar automaticamente.');
    }
  }

  return (
    <div className="admin-page quick-valuation-page">
      <div className="admin-page-header quick-valuation-header">
        <div>
          <span className="eyebrow">Ferramenta rápida</span>
          <h1>Avaliar imóvel</h1>
          <p>Faça uma estimativa de mercado em poucos minutos usando dados da própria imobiliária e comparáveis externos.</p>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <form className="admin-panel quick-valuation-form" onSubmit={searchComparables}>
        <div className="property-section-heading">
          <div><span className="eyebrow">1. Dados do imóvel</span><h2>O que você está avaliando?</h2></div>
        </div>

        <div className="admin-form-grid three">
          <label>Tipo de imóvel
            <select name="property_type" value={form.property_type} onChange={update}>
              {PROPERTY_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Cidade
            <input name="city" value={form.city} onChange={update} placeholder="Ex.: Ressaquinha" />
          </label>
          <label>Bairro
            <input name="neighborhood" value={form.neighborhood} onChange={update} placeholder="Ex.: Centro" />
          </label>
          <label>Área principal (m²)
            <input name="area" type="number" min="1" step="0.01" value={form.area} onChange={update} required placeholder="Área construída ou útil" />
          </label>
          <label>Área do terreno (m²)
            <input name="land_area" type="number" min="0" step="0.01" value={form.land_area} onChange={update} />
          </label>
          <label>Quartos
            <input name="bedrooms" type="number" min="0" value={form.bedrooms} onChange={update} />
          </label>
          <label>Banheiros
            <input name="bathrooms" type="number" min="0" value={form.bathrooms} onChange={update} />
          </label>
          <label>Vagas
            <input name="parking_spaces" type="number" min="0" value={form.parking_spaces} onChange={update} />
          </label>
          <label>Padrão de acabamento
            <select name="finish" value={form.finish} onChange={update}>
              <option value="economico">Econômico</option>
              <option value="medio">Médio</option>
              <option value="alto">Alto padrão</option>
              <option value="luxo">Luxo</option>
            </select>
          </label>
          <label>Estado de conservação
            <select name="condition" value={form.condition} onChange={update}>
              <option value="precisa_reforma">Precisa de reforma</option>
              <option value="regular">Regular</option>
              <option value="bom">Bom</option>
              <option value="novo">Novo / excelente</option>
            </select>
          </label>
          <label>Ajuste adicional (%)
            <input name="extra_adjustment" type="number" step="0.5" min="-30" max="30" value={form.extra_adjustment} onChange={update} />
            <small>Use somente para característica relevante não contemplada acima.</small>
          </label>
        </div>

        <button className="button quick-valuation-search" disabled={loading}>
          {loading ? 'Buscando imóveis semelhantes...' : 'Buscar semelhantes e calcular'}
        </button>
      </form>

      {searched && (
        <section className="admin-panel quick-valuation-comparables">
          <div className="property-section-heading">
            <div>
              <span className="eyebrow">2. Comparáveis do GOI</span>
              <h2>Imóveis semelhantes encontrados</h2>
              <p className="valuation-help">Vendas concluídas recebem mais peso que anúncios. Desmarque qualquer imóvel que não seja realmente comparável.</p>
            </div>
            <strong>{selectedIds.length} selecionado(s)</strong>
          </div>

          {comparables.length === 0 ? (
            <div className="admin-empty"><p>Nenhum comparável interno encontrado.</p></div>
          ) : (
            <div className="quick-comparable-list">
              {comparables.map((item) => (
                <label className={"quick-comparable-card " + (selectedIds.includes(item.id) ? 'selected' : '')} key={item.id}>
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleComparable(item.id)} />
                  <div>
                    <strong>{item.code} — {item.title}</strong>
                    <span>{item.neighborhood || 'Bairro não informado'} · {item.city || 'Cidade não informada'}</span>
                    <small>{item.source === 'closed_sale' ? 'VENDA CONCLUÍDA' : 'ANÚNCIO'} · Similaridade {decimal(item.similarity)}%</small>
                  </div>
                  <div className="quick-comparable-values">
                    <b>{money(item.value)}</b>
                    <span>{decimal(item.area)} m²</span>
                    <strong>{money(item.price_per_m2)}/m²</strong>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="admin-panel quick-valuation-external">
        <div className="property-section-heading">
          <div>
            <span className="eyebrow">3. Comparáveis externos — opcional</span>
            <h2>Adicione anúncios ou negócios que você encontrou fora do GOI</h2>
            <p className="valuation-help">A calculadora funciona sem esta etapa. Use quando tiver referências de portais, placas, outros corretores ou negócios locais.</p>
          </div>
        </div>

        <form onSubmit={addManual} className="quick-manual-form">
          <label>Identificação
            <input value={manual.label} onChange={(e) => setManual({...manual,label:e.target.value})} placeholder="Ex.: Casa na Rua A" />
          </label>
          <label>Valor
            <input type="number" min="1" step="0.01" value={manual.value} onChange={(e) => setManual({...manual,value:e.target.value})} placeholder="350000" />
          </label>
          <label>Área (m²)
            <input type="number" min="1" step="0.01" value={manual.area} onChange={(e) => setManual({...manual,area:e.target.value})} placeholder="140" />
          </label>
          <button className="admin-link-button" type="submit">+ Adicionar</button>
        </form>

        {manuals.length > 0 && (
          <div className="quick-manual-list">
            {manuals.map((item) => (
              <div key={item.id}>
                <span><strong>{item.title}</strong><small>{money(item.value)} · {decimal(item.area)} m² · {money(item.price_per_m2)}/m²</small></span>
                <button type="button" onClick={() => setManuals((current) => current.filter((x) => x.id !== item.id))}>Remover</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {calculation && (
        <section className="admin-panel quick-valuation-result">
          <div className="property-section-heading">
            <div>
              <span className="eyebrow">4. Resultado</span>
              <h2>Estimativa de valor para venda</h2>
              <p className="valuation-help">Resultado baseado em {chosen.length} comparável(is), ponderados por similaridade e qualidade da fonte.</p>
            </div>
            <button type="button" className="admin-link-button" onClick={copyResult}>Copiar resumo</button>
          </div>

          <div className="quick-valuation-main-result">
            <small>VALOR DE MERCADO ESTIMADO</small>
            <strong>{money(calculation.marketValue)}</strong>
            <span>{money(calculation.referencePpm)}/m² de referência</span>
          </div>

          <div className="valuation-result-grid quick-valuation-values">
            <article><span>Venda rápida</span><strong>{money(calculation.quickSaleValue)}</strong><small>Aprox. 10% abaixo do valor central</small></article>
            <article><span>Faixa mínima</span><strong>{money(calculation.minimumValue)}</strong><small>Margem inferior da estimativa</small></article>
            <article className="featured"><span>Valor de mercado</span><strong>{money(calculation.marketValue)}</strong><small>Estimativa central</small></article>
            <article><span>Faixa máxima</span><strong>{money(calculation.maximumValue)}</strong><small>Margem superior da estimativa</small></article>
            <article><span>Preço de anúncio</span><strong>{money(calculation.suggestedAskingValue)}</strong><small>Margem para negociação</small></article>
          </div>

          <div className="quick-valuation-confidence">
            <div>
              <span>Confiança da avaliação</span>
              <strong>{calculation.confidence}</strong>
              <small>{calculation.confidenceScore}/100</small>
            </div>
            <div className="valuation-progress"><span style={{ width: calculation.confidenceScore + '%' }} /></div>
            <p>{calculation.closedSales} venda(s) concluída(s) na amostra · similaridade média {decimal(calculation.avgSimilarity)}%.</p>
          </div>

          <details className="quick-valuation-method">
            <summary>Como o GOI chegou a esse valor?</summary>
            <p>1. Calcula o valor por m² de cada comparável selecionado.</p>
            <p>2. Dá mais peso aos imóveis mais semelhantes e às vendas efetivamente concluídas.</p>
            <p>3. Combina média ponderada e mediana para reduzir a influência de valores fora do padrão.</p>
            <p>4. Multiplica o valor de referência por m² pela área informada.</p>
            <p>5. Aplica ajustes de acabamento, conservação e o ajuste adicional informado pelo corretor.</p>
          </details>

          <div className="valuation-disclaimer">
            <strong>Uso comercial</strong>
            <p>Esta é uma estimativa para apoio à precificação e captação. Não substitui laudo técnico ou avaliação formal quando exigidos.</p>
          </div>
        </section>
      )}
    </div>
  );
}
