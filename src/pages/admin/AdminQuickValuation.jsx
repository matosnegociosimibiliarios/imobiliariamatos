import React, { useMemo, useState } from 'react';
import { getQuickValuationComparables } from '../../services/quickValuation';

const PROPERTY_TYPES = ['Casa','Apartamento','Terreno','Sítio','Comercial'];

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
}
function decimal(value,digits=0) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
}
function quantile(values,q) {
  const sorted=values.filter((x)=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
  if(!sorted.length) return 0;
  const pos=(sorted.length-1)*q;
  const base=Math.floor(pos);
  const rest=pos-base;
  return sorted[base+1]!==undefined ? sorted[base]+rest*(sorted[base+1]-sorted[base]) : sorted[base];
}
function median(values){ return quantile(values,.5); }
function coefficientVariation(values){
  const list=values.filter((x)=>Number.isFinite(x)&&x>0);
  if(list.length<2) return 0;
  const mean=list.reduce((a,b)=>a+b,0)/list.length;
  const variance=list.reduce((sum,x)=>sum+Math.pow(x-mean,2),0)/(list.length-1);
  return mean ? Math.sqrt(variance)/mean*100 : 0;
}
function filterOutliers(items){
  if(items.length<4) return {items,outliers:[]};
  const vals=items.map((i)=>i.price_per_m2).filter(Boolean);
  const q1=quantile(vals,.25), q3=quantile(vals,.75), iqr=q3-q1;
  const low=q1-1.5*iqr, high=q3+1.5*iqr;
  const kept=items.filter((i)=>i.price_per_m2>=low&&i.price_per_m2<=high);
  return {items:kept.length>=3?kept:items,outliers:kept.length>=3?items.filter((i)=>!kept.includes(i)):[]};
}

export default function AdminQuickValuation(){
  const [mode,setMode]=useState('quick');
  const [form,setForm]=useState({
    city:'',neighborhood:'',property_type:'Casa',area:'',land_area:'',bedrooms:'',bathrooms:'',parking_spaces:'',
    finish:'medio',condition:'bom',
    technical_location:'0',technical_finish:'0',technical_condition:'0',technical_garage:'0',technical_age:'0',technical_other:'0',
    evaluator:'',purpose:'Venda',inspection_date:new Date().toISOString().slice(0,10),documents:'',market_notes:'',method_notes:''
  });
  const [comparables,setComparables]=useState([]);
  const [selectedIds,setSelectedIds]=useState([]);
  const [manuals,setManuals]=useState([]);
  const [manual,setManual]=useState({label:'',value:'',area:'',similarity:'70'});
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [searched,setSearched]=useState(false);

  function update(e){ const {name,value}=e.target; setForm((c)=>({...c,[name]:value})); }

  async function searchComparables(e){
    e?.preventDefault();
    if(!num(form.area)){ setMessage('Informe a área usada na avaliação.'); return; }
    setLoading(true); setMessage(''); setSearched(true);
    const result=await getQuickValuationComparables(form);
    setLoading(false);
    if(result.error){ setMessage(result.error.message||'Não foi possível buscar comparáveis.'); return; }
    const list=result.data||[];
    setComparables(list);
    setSelectedIds(list.slice(0,6).map((i)=>i.id));
    if(!list.length) setMessage('Nenhum comparável interno encontrado. Adicione referências externas para calcular.');
  }

  function addManual(e){
    e.preventDefault();
    const value=num(manual.value), area=num(manual.area);
    if(!value||!area){ setMessage('Informe valor e área do comparável externo.'); return; }
    setManuals((c)=>[...c,{
      id:'manual-'+Date.now(),source:'manual',source_label:'Comparável externo',title:manual.label||'Imóvel externo',
      value,area,price_per_m2:value/area,similarity:Math.max(30,Math.min(100,num(manual.similarity)||70)),
      reference_date:new Date().toISOString()
    }]);
    setManual({label:'',value:'',area:'',similarity:'70'});
  }

  const chosen=useMemo(()=>[
    ...comparables.filter((i)=>selectedIds.includes(i.id)),
    ...manuals
  ],[comparables,selectedIds,manuals]);

  const calculation=useMemo(()=>{
    const subjectArea=num(form.area);
    if(!subjectArea||!chosen.length) return null;

    const normalized=chosen.map((item)=>({
      ...item,
      price_per_m2:num(item.price_per_m2)||(num(item.value)/Math.max(1,num(item.area)))
    })).filter((i)=>i.price_per_m2>0);

    const filtered=filterOutliers(normalized);
    const sample=filtered.items;
    if(!sample.length) return null;

    let weightedSum=0, weightTotal=0, similaritySum=0, closedSales=0, sameNeighborhood=0;
    const ppms=[], discounts=[];
    sample.forEach((item)=>{
      const similarity=num(item.similarity)||70;
      const sourceFactor=item.source==='closed_sale'?1.35:item.source==='manual'?.9:.95;
      const weight=Math.max(.35,similarity/100)*sourceFactor;
      weightedSum+=item.price_per_m2*weight;
      weightTotal+=weight;
      ppms.push(item.price_per_m2);
      similaritySum+=similarity;
      if(item.source==='closed_sale') closedSales++;
      if(item.same_neighborhood) sameNeighborhood++;
      if(Number.isFinite(Number(item.discount_pct))) discounts.push(Number(item.discount_pct));
    });

    const weightedPpm=weightedSum/weightTotal;
    const medianPpm=median(ppms);
    const p25=quantile(ppms,.25), p75=quantile(ppms,.75);
    const referencePpm=weightedPpm*.6+medianPpm*.4;
    const baseValue=subjectArea*referencePpm;

    const quickAdjustment = mode==='quick'
      ? ({economico:-.03,medio:0,alto:.03,luxo:.06}[form.finish]||0)
        + ({precisa_reforma:-.06,regular:-.025,bom:0,novo:.025}[form.condition]||0)
      : 0;

    const technicalAdjustment = mode==='complete'
      ? ['technical_location','technical_finish','technical_condition','technical_garage','technical_age','technical_other']
          .reduce((sum,key)=>sum+num(form[key])/100,0)
      : 0;

    const adjustment=Math.max(-.25,Math.min(.25,quickAdjustment+technicalAdjustment));
    const marketValue=baseValue*(1+adjustment);
    const cv=coefficientVariation(ppms);

    const sampleRangePct = Math.max(.04,Math.min(.12,cv/100*.45 || .06));
    const minimumValue=marketValue*(1-sampleRangePct);
    const maximumValue=marketValue*(1+sampleRangePct);

    const avgDiscount=discounts.length?discounts.reduce((a,b)=>a+b,0)/discounts.length:null;
    const quickSaleFactor=Math.max(.86,Math.min(.95,p25&&referencePpm?p25/referencePpm:.92));
    const quickSaleValue=marketValue*quickSaleFactor;
    const askingFactor=avgDiscount!==null ? 1/Math.max(.82,1-avgDiscount/100) : 1.05;
    const suggestedAskingValue=marketValue*Math.max(1.02,Math.min(1.12,askingFactor));

    const avgSimilarity=similaritySum/sample.length;
    const closedShare=closedSales/sample.length;
    const neighborhoodShare=sameNeighborhood/sample.length;
    const dispersionPenalty=Math.min(25,cv*.7);
    let confidenceScore=Math.min(40,sample.length*7)+Math.min(22,avgSimilarity*.22)+Math.min(18,closedShare*18)+Math.min(12,neighborhoodShare*12)+8-dispersionPenalty;
    confidenceScore=Math.round(Math.max(15,Math.min(100,confidenceScore)));
    const confidence=confidenceScore>=75?'Alta':confidenceScore>=50?'Média':'Baixa';

    return {
      sample, outliers:filtered.outliers, referencePpm, medianPpm,p25,p75,cv,baseValue,adjustment,marketValue,minimumValue,maximumValue,
      quickSaleValue,suggestedAskingValue,confidenceScore,confidence,avgSimilarity,closedSales,avgDiscount,sampleRangePct
    };
  },[chosen,form,mode]);

  async function copyResult(){
    if(!calculation) return;
    const lines=[
      mode==='complete'?'Avaliação completa GOI — apoio técnico':'Avaliação rápida GOI',
      form.property_type+' — '+[form.neighborhood,form.city].filter(Boolean).join(', '),
      'Área considerada: '+decimal(num(form.area))+' m²',
      'Comparáveis utilizados: '+calculation.sample.length,
      'Valor de mercado: '+money(calculation.marketValue),
      'Faixa provável: '+money(calculation.minimumValue)+' a '+money(calculation.maximumValue),
      'Venda rápida: '+money(calculation.quickSaleValue),
      'Preço sugerido para anúncio: '+money(calculation.suggestedAskingValue),
      'Referência: '+money(calculation.referencePpm)+'/m²',
      'Confiança da amostra: '+calculation.confidence+' ('+calculation.confidenceScore+'/100)'
    ];
    if(mode==='complete'){
      lines.push('Mediana: '+money(calculation.medianPpm)+'/m²');
      lines.push('P25/P75: '+money(calculation.p25)+' / '+money(calculation.p75)+'/m²');
      lines.push('Dispersão (CV): '+decimal(calculation.cv,1)+'%');
      lines.push('Outliers identificados: '+calculation.outliers.length);
      lines.push('Ajuste técnico total: '+decimal(calculation.adjustment*100,1)+'%');
    }
    try{ await navigator.clipboard.writeText(lines.join('\n')); setMessage('Resumo copiado.'); }
    catch{ setMessage('Não foi possível copiar automaticamente.'); }
  }

  return <div className="admin-page quick-valuation-page">
    <div className="admin-page-header">
      <div>
        <span className="eyebrow">Avaliação de imóveis</span>
        <h1>Calculadora de valor</h1>
        <p>Use o modo rápido no atendimento ao proprietário ou o modo completo para uma análise técnica mais detalhada.</p>
      </div>
    </div>

    <div className="valuation-mode-switch">
      <button type="button" className={mode==='quick'?'active':''} onClick={()=>setMode('quick')}>
        <strong>Avaliação rápida</strong><small>Para uso comercial no dia a dia</small>
      </button>
      <button type="button" className={mode==='complete'?'active':''} onClick={()=>setMode('complete')}>
        <strong>Avaliação completa</strong><small>Mais dados, fatores e leitura técnica</small>
      </button>
    </div>

    {message&&<div className="admin-message">{message}</div>}

    <form className="admin-panel quick-valuation-form" onSubmit={searchComparables}>
      <div className="property-section-heading">
        <div><span className="eyebrow">1. Imóvel avaliando</span><h2>{mode==='quick'?'Dados essenciais':'Caracterização e finalidade'}</h2></div>
      </div>

      {mode==='complete'&&<div className="valuation-technical-meta admin-form-grid three">
        <label>Avaliador / responsável<input name="evaluator" value={form.evaluator} onChange={update} placeholder="Nome do profissional" /></label>
        <label>Finalidade<input name="purpose" value={form.purpose} onChange={update} placeholder="Ex.: venda, garantia, processo judicial" /></label>
        <label>Data da vistoria<input type="date" name="inspection_date" value={form.inspection_date} onChange={update} /></label>
      </div>}

      <div className="admin-form-grid three">
        <label>Tipo<select name="property_type" value={form.property_type} onChange={update}>{PROPERTY_TYPES.map((x)=><option key={x}>{x}</option>)}</select></label>
        <label>Cidade<input name="city" value={form.city} onChange={update} placeholder="Ex.: Ressaquinha" /></label>
        <label>Bairro<input name="neighborhood" value={form.neighborhood} onChange={update} placeholder="Ex.: Centro" /></label>
        <label>Área principal (m²)<input name="area" type="number" min="1" step=".01" value={form.area} onChange={update} required /></label>
        <label>Área do terreno (m²)<input name="land_area" type="number" min="0" step=".01" value={form.land_area} onChange={update} /></label>
        <label>Quartos<input name="bedrooms" type="number" min="0" value={form.bedrooms} onChange={update} /></label>
        <label>Banheiros<input name="bathrooms" type="number" min="0" value={form.bathrooms} onChange={update} /></label>
        <label>Vagas<input name="parking_spaces" type="number" min="0" value={form.parking_spaces} onChange={update} /></label>
        {mode==='quick'&&<>
          <label>Padrão<select name="finish" value={form.finish} onChange={update}><option value="economico">Econômico</option><option value="medio">Médio</option><option value="alto">Alto padrão</option><option value="luxo">Luxo</option></select></label>
          <label>Conservação<select name="condition" value={form.condition} onChange={update}><option value="precisa_reforma">Precisa de reforma</option><option value="regular">Regular</option><option value="bom">Bom</option><option value="novo">Novo / excelente</option></select></label>
        </>}
      </div>

      {mode==='complete'&&<>
        <div className="valuation-technical-factors">
          <div><span className="eyebrow">Fatores de homogeneização</span><h3>Ajustes técnicos (%)</h3><p>Informe apenas diferenças justificadas entre o imóvel avaliando e a amostra. Zero significa sem ajuste.</p></div>
          <div className="admin-form-grid three">
            <label>Localização<input type="number" step=".5" min="-20" max="20" name="technical_location" value={form.technical_location} onChange={update}/></label>
            <label>Padrão construtivo<input type="number" step=".5" min="-20" max="20" name="technical_finish" value={form.technical_finish} onChange={update}/></label>
            <label>Conservação<input type="number" step=".5" min="-20" max="20" name="technical_condition" value={form.technical_condition} onChange={update}/></label>
            <label>Garagem<input type="number" step=".5" min="-15" max="15" name="technical_garage" value={form.technical_garage} onChange={update}/></label>
            <label>Idade / depreciação<input type="number" step=".5" min="-20" max="20" name="technical_age" value={form.technical_age} onChange={update}/></label>
            <label>Outros<input type="number" step=".5" min="-20" max="20" name="technical_other" value={form.technical_other} onChange={update}/></label>
          </div>
        </div>
        <div className="admin-form-grid two valuation-technical-notes">
          <label>Documentação analisada<textarea name="documents" rows="3" value={form.documents} onChange={update} placeholder="Matrícula, IPTU, planta, contrato..." /></label>
          <label>Diagnóstico de mercado<textarea name="market_notes" rows="3" value={form.market_notes} onChange={update} placeholder="Liquidez, oferta, demanda, comportamento local..." /></label>
          <label className="full">Notas de metodologia<textarea name="method_notes" rows="3" value={form.method_notes} onChange={update} placeholder="Critérios de seleção, limitações, premissas..." /></label>
        </div>
      </>}

      <button className="button quick-valuation-search" disabled={loading}>{loading?'Buscando comparáveis...':'Buscar semelhantes e calcular'}</button>
    </form>

    {searched&&<section className="admin-panel">
      <div className="property-section-heading"><div><span className="eyebrow">2. Amostra</span><h2>Imóveis semelhantes</h2><p className="valuation-help">Vendas concluídas recebem maior peso. Itens muito fora do padrão são identificados estatisticamente.</p></div><strong>{selectedIds.length} selecionado(s)</strong></div>
      <div className="quick-comparable-list">
        {comparables.map((item)=><label className={"quick-comparable-card "+(selectedIds.includes(item.id)?'selected':'')} key={item.id}>
          <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={()=>setSelectedIds((c)=>c.includes(item.id)?c.filter((x)=>x!==item.id):[...c,item.id])}/>
          <div><strong>{item.code} — {item.title}</strong><span>{item.neighborhood||'Bairro não informado'} · {item.city||'Cidade não informada'}</span><small>{item.source==='closed_sale'?'VENDA CONCLUÍDA':'ANÚNCIO'} · Similaridade {decimal(item.similarity)}%</small></div>
          <div className="quick-comparable-values"><b>{money(item.value)}</b><span>{decimal(item.area)} m²</span><strong>{money(item.price_per_m2)}/m²</strong></div>
        </label>)}
        {!comparables.length&&<div className="admin-empty">Nenhum comparável interno encontrado.</div>}
      </div>
    </section>}

    <section className="admin-panel">
      <div className="property-section-heading"><div><span className="eyebrow">3. Comparáveis externos</span><h2>Adicionar referência manual</h2><p className="valuation-help">Opcional. Use portais, negócios locais, placas ou referências de outros profissionais.</p></div></div>
      <form onSubmit={addManual} className="quick-manual-form">
        <label>Identificação<input value={manual.label} onChange={(e)=>setManual({...manual,label:e.target.value})}/></label>
        <label>Valor<input type="number" min="1" value={manual.value} onChange={(e)=>setManual({...manual,value:e.target.value})}/></label>
        <label>Área (m²)<input type="number" min="1" value={manual.area} onChange={(e)=>setManual({...manual,area:e.target.value})}/></label>
        {mode==='complete'&&<label>Similaridade (%)<input type="number" min="30" max="100" value={manual.similarity} onChange={(e)=>setManual({...manual,similarity:e.target.value})}/></label>}
        <button className="admin-link-button">+ Adicionar</button>
      </form>
      {manuals.map((i)=><div className="quick-manual-list" key={i.id}><div><span><strong>{i.title}</strong><small>{money(i.value)} · {decimal(i.area)} m² · {money(i.price_per_m2)}/m²</small></span><button type="button" onClick={()=>setManuals((c)=>c.filter((x)=>x.id!==i.id))}>Remover</button></div></div>)}
    </section>

    {calculation&&<section className="admin-panel quick-valuation-result">
      <div className="property-section-heading"><div><span className="eyebrow">4. Resultado</span><h2>{mode==='quick'?'Estimativa comercial':'Análise técnica da amostra'}</h2></div><button type="button" className="admin-link-button" onClick={copyResult}>Copiar resumo</button></div>

      <div className="quick-valuation-main-result"><small>VALOR DE MERCADO ESTIMADO</small><strong>{money(calculation.marketValue)}</strong><span>{money(calculation.referencePpm)}/m² de referência</span></div>

      <div className="valuation-result-grid quick-valuation-values">
        <article><span>Venda rápida</span><strong>{money(calculation.quickSaleValue)}</strong><small>Faixa inferior observada na amostra</small></article>
        <article><span>Faixa mínima</span><strong>{money(calculation.minimumValue)}</strong><small>Margem calculada pela dispersão</small></article>
        <article className="featured"><span>Valor de mercado</span><strong>{money(calculation.marketValue)}</strong><small>Estimativa central</small></article>
        <article><span>Faixa máxima</span><strong>{money(calculation.maximumValue)}</strong><small>Margem calculada pela dispersão</small></article>
        <article><span>Preço de anúncio</span><strong>{money(calculation.suggestedAskingValue)}</strong><small>{calculation.avgDiscount!==null?'Considera desconto médio observado':'Margem comercial moderada'}</small></article>
      </div>

      {mode==='complete'&&<div className="valuation-complete-stats">
        <article><span>Mediana</span><strong>{money(calculation.medianPpm)}/m²</strong></article>
        <article><span>P25</span><strong>{money(calculation.p25)}/m²</strong></article>
        <article><span>P75</span><strong>{money(calculation.p75)}/m²</strong></article>
        <article><span>Dispersão</span><strong>{decimal(calculation.cv,1)}%</strong></article>
        <article><span>Outliers</span><strong>{calculation.outliers.length}</strong></article>
        <article><span>Ajuste técnico</span><strong>{calculation.adjustment>0?'+':''}{decimal(calculation.adjustment*100,1)}%</strong></article>
      </div>}

      <div className="quick-valuation-confidence"><div><span>Confiança da amostra</span><strong>{calculation.confidence}</strong><small>{calculation.confidenceScore}/100</small></div><div className="valuation-progress"><span style={{width:calculation.confidenceScore+'%'}}/></div><p>{calculation.sample.length} comparável(is) válidos · {calculation.closedSales} venda(s) concluída(s) · similaridade média {decimal(calculation.avgSimilarity)}%.</p></div>

      <details className="quick-valuation-method"><summary>Como o GOI chegou ao valor?</summary>
        <p>Seleciona comparáveis por tipo, localização, área e características.</p>
        <p>Dá maior peso a vendas concluídas e imóveis mais semelhantes.</p>
        <p>Combina média ponderada e mediana e identifica possíveis outliers pelo intervalo interquartil.</p>
        <p>A faixa mínima e máxima acompanha a dispersão real da amostra, em vez de usar uma margem fixa.</p>
        {mode==='complete'&&<p>Os fatores técnicos são informados pelo profissional e ficam limitados para evitar ajustes excessivos.</p>}
      </details>

      <div className="valuation-disclaimer">
        <strong>{mode==='complete'?'Apoio técnico — não é laudo automático':'Uso comercial'}</strong>
        <p>{mode==='complete'
          ? 'O modo completo organiza dados, amostra, fatores e estatísticas para auxiliar o profissional. Um laudo pericial ou avaliação formal exige vistoria, documentação, justificativa metodológica, responsabilidade técnica e enquadramento conforme a finalidade e as normas aplicáveis.'
          : 'Esta estimativa apoia precificação e captação e não substitui avaliação formal quando exigida.'}</p>
      </div>
    </section>}
  </div>;
}
