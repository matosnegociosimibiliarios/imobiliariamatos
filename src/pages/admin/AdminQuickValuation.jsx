import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getQuickValuationComparables } from '../../services/quickValuation';

const PROPERTY_TYPES = ['Casa','Apartamento','Terreno','Sítio','Comercial'];

const TECHNICAL_FACTORS = [
  {
    key: 'technical_location',
    label: 'Localização',
    min: -20,
    max: 20,
    justifications: [
      'Sem diferença relevante',
      'Avaliando em localização superior à amostra',
      'Avaliando em localização inferior à amostra',
      'Melhor acesso / mobilidade / infraestrutura',
      'Pior acesso / mobilidade / infraestrutura',
      'Maior valorização ou procura no entorno',
      'Menor valorização ou procura no entorno',
      'Outro motivo de localização',
    ],
  },
  {
    key: 'technical_finish',
    label: 'Padrão construtivo',
    min: -20,
    max: 20,
    justifications: [
      'Sem diferença relevante',
      'Avaliando com padrão construtivo superior',
      'Avaliando com padrão construtivo inferior',
      'Acabamentos e materiais superiores',
      'Acabamentos e materiais inferiores',
      'Projeto / arquitetura com maior padrão',
      'Projeto / arquitetura com menor padrão',
      'Outro motivo de padrão construtivo',
    ],
  },
  {
    key: 'technical_condition',
    label: 'Conservação',
    min: -20,
    max: 20,
    justifications: [
      'Sem diferença relevante',
      'Avaliando em melhor estado de conservação',
      'Avaliando em pior estado de conservação',
      'Reforma recente / manutenção superior',
      'Necessidade de reforma / manutenção',
      'Instalações e acabamentos mais conservados',
      'Instalações e acabamentos mais desgastados',
      'Outro motivo de conservação',
    ],
  },
  {
    key: 'technical_garage',
    label: 'Garagem',
    min: -15,
    max: 15,
    justifications: [
      'Sem diferença relevante',
      'Avaliando possui mais vagas',
      'Avaliando possui menos vagas',
      'Vagas cobertas / livres / de melhor acesso',
      'Vagas descobertas / presas / de pior acesso',
      'Garagem tem alta relevância neste mercado',
      'Outro motivo relacionado à garagem',
    ],
  },
  {
    key: 'technical_age',
    label: 'Idade / depreciação',
    min: -20,
    max: 20,
    justifications: [
      'Sem diferença relevante',
      'Avaliando é mais novo que a amostra',
      'Avaliando é mais antigo que a amostra',
      'Menor depreciação aparente',
      'Maior depreciação aparente',
      'Vida útil remanescente superior',
      'Vida útil remanescente inferior',
      'Outro motivo de idade / depreciação',
    ],
  },
  {
    key: 'technical_other',
    label: 'Outros',
    min: -20,
    max: 20,
    justifications: [
      'Sem diferença relevante',
      'Vista / posição / insolação superior',
      'Vista / posição / insolação inferior',
      'Topografia / testada / formato superior',
      'Topografia / testada / formato inferior',
      'Elevador / lazer / infraestrutura superior',
      'Elevador / lazer / infraestrutura inferior',
      'Outro fator específico do mercado',
    ],
  },
];

const FACTOR_SOURCES = [
  'Pesquisa de mercado local / amostra comparável',
  'Negócios efetivamente realizados no CRM',
  'Anúncios ativos em portais imobiliários',
  'Vistoria presencial do imóvel',
  'Documentação técnica / cadastral',
  'Referência de corretor ou avaliador local',
  'Estudo / publicação técnica aplicável',
  'Critério técnico do avaliador',
];

const DEFAULT_FACTOR_META = Object.fromEntries(
  TECHNICAL_FACTORS.map((factor) => [
    factor.key,
    {
      justification: 'Sem diferença relevante',
      source: 'Pesquisa de mercado local / amostra comparável',
      note: '',
    },
  ])
);

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

const STANDARD_SCORE={economico:1,medio:2,alto:3,luxo:4};
const CONDITION_SCORE={precisa_reforma:1,regular:2,bom:3,novo:4};

function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
function roundHalf(value){ return Math.round(value*2)/2; }
function mean(values){
  const list=values.filter((value)=>Number.isFinite(Number(value))).map(Number);
  return list.length?list.reduce((sum,value)=>sum+value,0)/list.length:0;
}
function regressionSlope(items,xGetter,yGetter){
  const pairs=items.map((item)=>[Number(xGetter(item)),Number(yGetter(item))]).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&y>0);
  if(pairs.length<4) return null;
  const xs=pairs.map(([x])=>x);
  if(new Set(xs).size<2) return null;
  const mx=mean(xs), my=mean(pairs.map(([,y])=>y));
  const denominator=pairs.reduce((sum,[x])=>sum+Math.pow(x-mx,2),0);
  if(!denominator) return null;
  return pairs.reduce((sum,[x,y])=>sum+(x-mx)*(y-my),0)/denominator;
}
function technicalSuggestion(sample,form){
  const base=median(sample.map((item)=>num(item.price_per_m2)).filter(Boolean));
  const unavailable=(reason)=>({available:false,value:0,reason,confidence:'Baixa'});
  if(!base) return {
    technical_location:unavailable('Amostra sem valor por m² suficiente.'),
    technical_finish:unavailable('Amostra sem valor por m² suficiente.'),
    technical_condition:unavailable('Amostra sem valor por m² suficiente.'),
    technical_garage:unavailable('Amostra sem valor por m² suficiente.'),
    technical_age:unavailable('Amostra sem valor por m² suficiente.'),
    technical_other:unavailable('Depende de característica específica informada pelo avaliador.'),
  };

  const sameNeighborhood=sample.filter((item)=>item.same_neighborhood&&num(item.price_per_m2)>0);
  const otherCity=sample.filter((item)=>item.same_city&&!item.same_neighborhood&&num(item.price_per_m2)>0);
  let location=unavailable('Para estimar localização automaticamente, use ao menos 2 comparáveis no mesmo bairro e 2 em outros bairros da mesma cidade.');
  if(sameNeighborhood.length>=2&&otherCity.length>=2){
    const same=median(sameNeighborhood.map((item)=>num(item.price_per_m2)));
    const other=median(otherCity.map((item)=>num(item.price_per_m2)));
    const value=roundHalf(clamp(((same-other)/other)*100,-15,15));
    location={
      available:true,value,
      reason:`Mediana do bairro: ${money(same)}/m² versus ${money(other)}/m² em outros bairros comparáveis.`,
      confidence:(sameNeighborhood.length+otherCity.length)>=8?'Alta':'Média'
    };
  }

  const garageItems=sample.filter((item)=>Number.isFinite(Number(item.parking_spaces))&&num(item.price_per_m2)>0);
  let garage=unavailable('São necessários ao menos 4 comparáveis com quantidade de vagas variada.');
  const garageSlope=regressionSlope(garageItems,(item)=>num(item.parking_spaces),(item)=>num(item.price_per_m2));
  if(garageSlope!==null&&garageItems.length>=4){
    const avgSpaces=mean(garageItems.map((item)=>num(item.parking_spaces)));
    const difference=num(form.parking_spaces)-avgSpaces;
    const value=roundHalf(clamp((difference*garageSlope/base)*100,-10,10));
    garage={
      available:true,value,
      reason:`A amostra tem média de ${decimal(avgSpaces,1)} vaga(s); o avaliando informou ${decimal(num(form.parking_spaces),0)}. Efeito estimado a partir da relação entre vagas e R$/m² da amostra.`,
      confidence:garageItems.length>=8?'Alta':'Média'
    };
  }

  const finishItems=sample.filter((item)=>STANDARD_SCORE[item.construction_standard]&&num(item.price_per_m2)>0);
  let finish=unavailable('Cadastre padrão construtivo em pelo menos 4 comparáveis para obter sugestão automática.');
  const finishSlope=regressionSlope(finishItems,(item)=>STANDARD_SCORE[item.construction_standard],(item)=>num(item.price_per_m2));
  if(finishSlope!==null&&STANDARD_SCORE[form.finish]){
    const avgScore=mean(finishItems.map((item)=>STANDARD_SCORE[item.construction_standard]));
    const value=roundHalf(clamp(((STANDARD_SCORE[form.finish]-avgScore)*finishSlope/base)*100,-15,15));
    finish={
      available:true,value,
      reason:`Padrão do avaliando: ${form.finish}. A sugestão compara esse nível com o padrão médio dos ${finishItems.length} comparáveis cadastrados.`,
      confidence:finishItems.length>=8?'Alta':'Média'
    };
  }

  const conditionItems=sample.filter((item)=>CONDITION_SCORE[item.conservation_status]&&num(item.price_per_m2)>0);
  let condition=unavailable('Cadastre conservação em pelo menos 4 comparáveis para obter sugestão automática.');
  const conditionSlope=regressionSlope(conditionItems,(item)=>CONDITION_SCORE[item.conservation_status],(item)=>num(item.price_per_m2));
  if(conditionSlope!==null&&CONDITION_SCORE[form.condition]){
    const avgScore=mean(conditionItems.map((item)=>CONDITION_SCORE[item.conservation_status]));
    const value=roundHalf(clamp(((CONDITION_SCORE[form.condition]-avgScore)*conditionSlope/base)*100,-15,15));
    condition={
      available:true,value,
      reason:`Conservação do avaliando: ${form.condition}. A sugestão compara esse estado com a conservação média dos ${conditionItems.length} comparáveis.`,
      confidence:conditionItems.length>=8?'Alta':'Média'
    };
  }

  const currentYear=new Date().getFullYear();
  const ageItems=sample.filter((item)=>num(item.construction_year)>=1800&&num(item.construction_year)<=currentYear&&num(item.price_per_m2)>0);
  let age=unavailable('Informe o ano de construção do avaliando e de pelo menos 4 comparáveis.');
  const ageSlope=regressionSlope(ageItems,(item)=>currentYear-num(item.construction_year),(item)=>num(item.price_per_m2));
  if(ageSlope!==null&&num(form.construction_year)>=1800&&num(form.construction_year)<=currentYear){
    const avgAge=mean(ageItems.map((item)=>currentYear-num(item.construction_year)));
    const targetAge=currentYear-num(form.construction_year);
    const value=roundHalf(clamp(((targetAge-avgAge)*ageSlope/base)*100,-15,15));
    age={
      available:true,value,
      reason:`Idade aproximada do avaliando: ${targetAge} ano(s); média da amostra: ${decimal(avgAge,1)} ano(s).`,
      confidence:ageItems.length>=8?'Alta':'Média'
    };
  }

  return {
    technical_location:location,
    technical_finish:finish,
    technical_condition:condition,
    technical_garage:garage,
    technical_age:age,
    technical_other:unavailable('Fatores específicos como vista, topografia, elevador ou lazer continuam dependentes de análise profissional.'),
  };
}

export default function AdminQuickValuation(){
  const { access } = useOutletContext();
  const completeAllowed = access?.plan_code === 'business' || access?.plan_code === 'internal';
  const [mode,setMode]=useState('quick');
  const [form,setForm]=useState({
    city:'',neighborhood:'',property_type:'Casa',area:'',land_area:'',bedrooms:'',bathrooms:'',parking_spaces:'',
    finish:'medio',condition:'bom',
    technical_location:'0',technical_finish:'0',technical_condition:'0',technical_garage:'0',technical_age:'0',technical_other:'0',
    construction_year:'',evaluator:'',purpose:'Venda',inspection_date:new Date().toISOString().slice(0,10),documents:'',market_notes:'',method_notes:''
  });
  const [factorMeta,setFactorMeta]=useState(DEFAULT_FACTOR_META);
  const [comparables,setComparables]=useState([]);
  const [selectedIds,setSelectedIds]=useState([]);
  const [manuals,setManuals]=useState([]);
  const [manual,setManual]=useState({label:'',value:'',area:'',similarity:'70'});
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [searched,setSearched]=useState(false);

  function update(e){ const {name,value}=e.target; setForm((c)=>({...c,[name]:value})); }

  function updateFactorMeta(key, field, value){
    setFactorMeta((current)=>({
      ...current,
      [key]: {
        ...current[key],
        [field]: value,
      },
    }));
  }

  function updateTechnicalFactor(event){
    const { name, value } = event.target;
    setForm((current)=>({...current,[name]:value}));
    if(num(value)===0){
      updateFactorMeta(name,'justification','Sem diferença relevante');
    } else if(factorMeta[name]?.justification==='Sem diferença relevante'){
      updateFactorMeta(name,'justification','');
    }
  }

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

  const factorSuggestions=useMemo(()=>technicalSuggestion(chosen,form),[chosen,form]);

  function suggestionJustification(key,value){
    if(key==='technical_location') return value>0?'Avaliando em localização superior à amostra':value<0?'Avaliando em localização inferior à amostra':'Sem diferença relevante';
    if(key==='technical_finish') return value>0?'Avaliando com padrão construtivo superior':value<0?'Avaliando com padrão construtivo inferior':'Sem diferença relevante';
    if(key==='technical_condition') return value>0?'Avaliando em melhor estado de conservação':value<0?'Avaliando em pior estado de conservação':'Sem diferença relevante';
    if(key==='technical_garage') return value>0?'Avaliando possui mais vagas':value<0?'Avaliando possui menos vagas':'Sem diferença relevante';
    if(key==='technical_age') return value>0?'Avaliando é mais novo que a amostra':value<0?'Avaliando é mais antigo que a amostra':'Sem diferença relevante';
    return 'Sem diferença relevante';
  }

  function applyFactorSuggestions(){
    const updates={};
    const nextMeta={...factorMeta};
    TECHNICAL_FACTORS.forEach((factor)=>{
      const suggestion=factorSuggestions[factor.key];
      if(!suggestion?.available) return;
      updates[factor.key]=String(suggestion.value);
      nextMeta[factor.key]={
        ...nextMeta[factor.key],
        justification:suggestionJustification(factor.key,suggestion.value),
        source:'Pesquisa de mercado local / amostra comparável',
        note:'Sugestão GOI: '+suggestion.reason,
      };
    });
    setForm((current)=>({...current,...updates}));
    setFactorMeta(nextMeta);
    setMessage(Object.keys(updates).length?'Sugestões da amostra aplicadas. Revise antes de concluir a avaliação.':'A amostra ainda não possui dados suficientes para sugerir os fatores automaticamente.');
  }

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

    const technicalAdjustmentRaw = mode==='complete'
      ? ['technical_location','technical_finish','technical_condition','technical_garage','technical_age','technical_other']
          .reduce((sum,key)=>sum+num(form[key])/100,0)
      : 0;

    const adjustment=Math.max(-.25,Math.min(.25,quickAdjustment+technicalAdjustmentRaw));
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
      sample, outliers:filtered.outliers, referencePpm, medianPpm,p25,p75,cv,baseValue,adjustment,technicalAdjustmentRaw,marketValue,minimumValue,maximumValue,
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
      lines.push('Ajuste técnico informado: '+decimal(calculation.technicalAdjustmentRaw*100,1)+'%');
      lines.push('Ajuste técnico aplicado pelo GOI: '+decimal(calculation.adjustment*100,1)+'%');
      lines.push('Fatores de homogeneização:');
      TECHNICAL_FACTORS.forEach((factor)=>{
        const value=num(form[factor.key]);
        const meta=factorMeta[factor.key]||{};
        lines.push(
          '- '+factor.label+': '+(value>0?'+':'')+decimal(value,1)+'% | '+
          (meta.justification||'Sem justificativa')+' | Fonte/critério: '+
          (meta.source||'Não informado')+
          (meta.note?' | Observação: '+meta.note:'')
        );
      });
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
      {completeAllowed ? (
        <button type="button" className={mode==='complete'?'active':''} onClick={()=>setMode('complete')}>
          <strong>Avaliação completa</strong><small>Mais dados, fatores e leitura técnica</small>
        </button>
      ) : (
        <button type="button" className="locked" disabled title="Disponível no plano Empresarial">
          <strong>Avaliação completa</strong><small>Disponível no plano Empresarial</small>
        </button>
      )}
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
        {mode==='complete'&&<>
          <label>Padrão construtivo<select name="finish" value={form.finish} onChange={update}><option value="economico">Econômico</option><option value="medio">Médio</option><option value="alto">Alto padrão</option><option value="luxo">Luxo</option></select></label>
          <label>Conservação<select name="condition" value={form.condition} onChange={update}><option value="precisa_reforma">Precisa de reforma</option><option value="regular">Regular</option><option value="bom">Bom</option><option value="novo">Novo / excelente</option></select></label>
          <label>Ano da construção<input name="construction_year" type="number" min="1800" max="2200" value={form.construction_year} onChange={update} placeholder="Ex.: 2018" /></label>
        </>}
        {mode==='quick'&&<>
          <label>Padrão<select name="finish" value={form.finish} onChange={update}><option value="economico">Econômico</option><option value="medio">Médio</option><option value="alto">Alto padrão</option><option value="luxo">Luxo</option></select></label>
          <label>Conservação<select name="condition" value={form.condition} onChange={update}><option value="precisa_reforma">Precisa de reforma</option><option value="regular">Regular</option><option value="bom">Bom</option><option value="novo">Novo / excelente</option></select></label>
        </>}
      </div>

      {mode==='complete'&&<>
        <div className="valuation-technical-factors">
          <div className="valuation-factor-heading">
            <div>
              <span className="eyebrow">Fatores de homogeneização</span>
              <h3>Ajustes técnicos (%)</h3>
              <p>Registre somente diferenças relevantes entre o imóvel avaliando e a amostra. Valor positivo eleva a referência do avaliando; valor negativo reduz. Zero significa sem diferença relevante.</p>
            </div>
            <div className="valuation-factor-rule">
              <strong>Registro técnico</strong>
              <span>Percentual + justificativa + fonte/critério.</span>
              <small>Os modelos abaixo agilizam o preenchimento, mas o profissional deve confirmar se representam a realidade da amostra e do mercado local.</small>
            </div>
          </div>

          <div className="valuation-factor-auto">
            <div>
              <strong>Sugestão automática pela amostra</strong>
              <span>O GOI compara os dados disponíveis dos imóveis selecionados e propõe percentuais quando há evidência suficiente.</span>
            </div>
            <button type="button" className="admin-link-button" onClick={applyFactorSuggestions} disabled={!chosen.length}>Aplicar sugestões</button>
          </div>

          <div className="valuation-factor-list">
            {TECHNICAL_FACTORS.map((factor)=>{
              const meta=factorMeta[factor.key]||{};
              const value=num(form[factor.key]);
              const suggestion=factorSuggestions[factor.key];
              return <article className="valuation-factor-card" key={factor.key}>
                <div className="valuation-factor-card-top">
                  <label>
                    <strong>{factor.label}</strong>
                    <span>Ajuste (%)</span>
                    <input
                      type="number"
                      step=".5"
                      min={factor.min}
                      max={factor.max}
                      name={factor.key}
                      value={form[factor.key]}
                      onChange={updateTechnicalFactor}
                    />
                  </label>
                  <div className={value===0?'valuation-factor-status neutral':value>0?'valuation-factor-status positive':'valuation-factor-status negative'}>
                    {value===0?'Sem ajuste':value>0?'+'+decimal(value,1)+'%':decimal(value,1)+'%'}
                  </div>
                </div>

                <div className={suggestion?.available?'valuation-factor-suggestion available':'valuation-factor-suggestion'}>
                  <div>
                    <strong>{suggestion?.available?'Sugestão GOI: '+(suggestion.value>0?'+':'')+decimal(suggestion.value,1)+'%':'Sem sugestão automática'}</strong>
                    <span>{suggestion?.reason}</span>
                  </div>
                  {suggestion?.available&&<small>Confiança: {suggestion.confidence}</small>}
                </div>

                <div className="valuation-factor-fields">
                  <label>
                    Justificativa
                    <select
                      value={meta.justification||''}
                      onChange={(event)=>updateFactorMeta(factor.key,'justification',event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {factor.justifications.map((item)=><option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>

                  <label>
                    Fonte / critério
                    <select
                      value={meta.source||''}
                      onChange={(event)=>updateFactorMeta(factor.key,'source',event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {FACTOR_SOURCES.map((item)=><option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>

                  <label className="full">
                    Observação complementar
                    <input
                      value={meta.note||''}
                      onChange={(event)=>updateFactorMeta(factor.key,'note',event.target.value)}
                      placeholder="Opcional. Ex.: rua mais comercial, acabamento superior, reforma recente..."
                    />
                  </label>
                </div>
              </article>;
            })}
          </div>

          <div className="valuation-factor-total">
            <div>
              <span>Ajuste técnico informado</span>
              <strong>{TECHNICAL_FACTORS.reduce((sum,factor)=>sum+num(form[factor.key]),0)>0?'+':''}{decimal(TECHNICAL_FACTORS.reduce((sum,factor)=>sum+num(form[factor.key]),0),1)}%</strong>
            </div>
            <p>O GOI limita o ajuste agregado aplicado ao cálculo a ±25% como controle operacional interno. Isso não substitui a justificativa técnica nem define, por si só, enquadramento normativo.</p>
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
        <article><span>Ajuste informado</span><strong>{calculation.technicalAdjustmentRaw>0?'+':''}{decimal(calculation.technicalAdjustmentRaw*100,1)}%</strong></article>
        <article><span>Ajuste aplicado</span><strong>{calculation.adjustment>0?'+':''}{decimal(calculation.adjustment*100,1)}%</strong></article>
      </div>}

      <div className="quick-valuation-confidence"><div><span>Confiança da amostra</span><strong>{calculation.confidence}</strong><small>{calculation.confidenceScore}/100</small></div><div className="valuation-progress"><span style={{width:calculation.confidenceScore+'%'}}/></div><p>{calculation.sample.length} comparável(is) válidos · {calculation.closedSales} venda(s) concluída(s) · similaridade média {decimal(calculation.avgSimilarity)}%.</p></div>

      <details className="quick-valuation-method"><summary>Como o GOI chegou ao valor?</summary>
        <p>Seleciona comparáveis por tipo, localização, área e características.</p>
        <p>Dá maior peso a vendas concluídas e imóveis mais semelhantes.</p>
        <p>Combina média ponderada e mediana e identifica possíveis outliers pelo intervalo interquartil.</p>
        <p>A faixa mínima e máxima acompanha a dispersão real da amostra, em vez de usar uma margem fixa.</p>
        {mode==='complete'&&<>
          <p>Os fatores técnicos são informados pelo profissional, com justificativa e fonte/critério registradas para cada ajuste.</p>
          <p>Os presets são atalhos de preenchimento e não substituem pesquisa de mercado, vistoria, evidência documental ou fundamentação técnica quando exigidas.</p>
        </>}
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
