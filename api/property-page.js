function escapeHtml(value='') {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase público não configurado.');
  return { url:url.replace(/\/+$/,''), key };
}

async function publicDb(path) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey:key, Authorization:`Bearer ${key}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function publicRpc(name, body={}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method:'POST',
    headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function publicImage(storagePath) {
  if (!storagePath) return null;
  const { url } = supabaseConfig();
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${url}/storage/v1/object/public/property-images/${encoded}`;
}

function inject(html, { title, description, canonical, image, robots='index,follow', siteName='Imobiliária' }) {
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, '');
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ];
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  return html.replace('</head>', `${tags.join('\n')}\n</head>`);
}

function xmlEscape(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function validUrl(value){
  try { return new URL(value.startsWith('http') ? value : `https://${value}`); } catch { return null; }
}
function sharedTenantUrl(origin,path,slug){
  const url=new URL(path,origin);
  if(slug) url.searchParams.set('imobiliaria',slug);
  return url.toString();
}

async function serveSitemap(req,res){
  const host=req.headers['x-forwarded-host']||req.headers.host;
  const origin=`https://${host}`;
  const rows=await publicRpc('get_public_seo_sitemap_rows');
  const typeMap={Casa:'casas',Apartamento:'apartamentos',Terreno:'terrenos','Sítio':'sitios',Comercial:'imoveis-comerciais'};
  const entries=new Map();
  entries.set(`${origin}/goi`,'2026-10-03');

  function add(slug,website,path,lastmod){
    const configured=website ? validUrl(website) : null;
    const base=configured && configured.host===host ? configured.origin : origin;
    const loc=base===origin ? sharedTenantUrl(origin,path,slug) : new URL(path,base).toString();
    const previous=entries.get(loc);
    if(!previous || (lastmod && lastmod>previous)) entries.set(loc,lastmod||'');
  }

  for(const row of rows||[]){
    const slug=row.organization_slug;
    if(!slug) continue;
    const website=row.website_url;
    add(slug,website,'/',row.updated_at);
    add(slug,website,'/comprar',row.updated_at);
    add(slug,website,'/alugar',row.updated_at);
    add(slug,website,'/anuncie-seu-imovel',row.updated_at);
    add(slug,website,'/avaliacao-do-imovel',row.updated_at);

    if(!row.property_slug) continue;
    add(slug,website,`/imovel/${row.property_slug}`,row.updated_at);
    if(row.city_slug){
      const purposes=row.purpose==='sale_and_rent'?['sale','rent']:[row.purpose];
      for(const purpose of purposes){
        const prefix=purpose==='rent'?'imoveis-para-alugar':'imoveis-a-venda';
        add(slug,website,`/${prefix}/${row.city_slug}`,row.updated_at);
        const ts=typeMap[row.property_type];
        if(ts) add(slug,website,`/${prefix}/${row.city_slug}/${ts}`,row.updated_at);
      }
    }
  }

  const body=[...entries.entries()].map(([loc,lastmod])=>`<url><loc>${xmlEscape(loc)}</loc>${lastmod?`<lastmod>${xmlEscape(String(lastmod).slice(0,10))}</lastmod>`:''}</url>`).join('\n');
  res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=900, stale-while-revalidate=3600');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}


async function serveGoiPage(req,res){
  const host=req.headers['x-forwarded-host']||req.headers.host||'imobiliariamatos.vercel.app';
  const origin=`https://${host}`;
  const baseHtml=await fetch(`${origin}/index.html`).then(r=>r.text());
  const canonical=`${origin}/goi`;
  const title='GOI | CRM e Sistema de Gestão para Imobiliárias';
  const description='Sistema de gestão para imobiliárias com CRM imobiliário, funil comercial, imóveis, captações, propostas, locação, financeiro, equipe e site integrado. Teste o GOI grátis por 14 dias.';
  const image=`${origin}/goi-logo.svg`;
  const html=inject(baseHtml,{title,description,canonical,image,siteName:'GOI'})
    .replace('</head>', `<script type="application/ld+json">${JSON.stringify({
      '@context':'https://schema.org',
      '@graph':[
        {
          '@type':'SoftwareApplication',
          name:'GOI — Gerenciador de Operações Imobiliárias',
          applicationCategory:'BusinessApplication',
          operatingSystem:'Web',
          description,
          url:canonical,
          image,
          offers:[
            {'@type':'Offer',name:'Plano Essencial',priceCurrency:'BRL',price:'49.90',url:`${origin}/cadastro`},
            {'@type':'Offer',name:'Plano Profissional',priceCurrency:'BRL',price:'99.90',url:`${origin}/cadastro`},
            {'@type':'Offer',name:'Plano Empresarial',priceCurrency:'BRL',price:'199.90',url:`${origin}/cadastro`}
          ]
        },
        {
          '@type':'FAQPage',
          mainEntity:[
            ['Preciso instalar alguma coisa?','Não. O GOI funciona pela internet e pode ser acessado pelo navegador no computador ou celular.'],
            ['O teste realmente é gratuito?','Sim. A imobiliária pode testar o sistema por 14 dias antes de contratar um plano.'],
            ['Posso cadastrar minha equipe?','Sim. A quantidade de usuários depende do plano contratado e os acessos podem ser organizados por função e permissão.'],
            ['O site mostra a marca do GOI?','Não como marca principal. O site público utiliza a identidade da própria imobiliária.'],
            ['Meus dados ficam misturados com os de outras imobiliárias?','Não. Cada imobiliária possui sua própria organização e o sistema aplica isolamento de dados por organização.']
          ].map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))
        }
      ]
    })}</script></head>`);
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=900, stale-while-revalidate=3600');
  res.status(200).send(html);
}

export default async function handler(req,res) {
  if (req.query.mode === 'sitemap') return serveSitemap(req,res);
  if (req.query.mode === 'goi') return serveGoiPage(req,res);
  try {
    const slug=String(req.query.slug||'').trim();
    const organizationSlug=String(req.query.imobiliaria||process.env.VITE_PUBLIC_ORGANIZATION_SLUG||'matos-negocios-imobiliarios').trim().toLowerCase();
    const host=req.headers['x-forwarded-host']||req.headers.host||'imobiliariamatos.vercel.app';
    const origin=`https://${host}`;
    const baseHtml=await fetch(`${origin}/index.html`).then(r=>r.text());

    const [propertyRows,agencyRows]=await Promise.all([
      publicRpc('get_public_property_by_slug',{p_organization_slug:organizationSlug,p_property_slug:slug}),
      publicRpc('get_public_agency_settings',{p_organization_slug:organizationSlug}),
    ]);

    const property=Array.isArray(propertyRows)?propertyRows[0]:propertyRows;
    const agency=Array.isArray(agencyRows)?agencyRows[0]:agencyRows;
    const agencyName=agency?.trade_name||agency?.agency_name||'Imobiliária';

    if(!property){
      const canonical=sharedTenantUrl(origin,`/imovel/${encodeURIComponent(slug)}`,organizationSlug);
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.status(404).send(inject(baseHtml,{title:`Imóvel não disponível | ${agencyName}`,description:'Este imóvel não está disponível no momento.',canonical,robots:'noindex,nofollow',siteName:agencyName}));
      return;
    }

    const images=property.property_images||[];
    const cover=images.find(i=>i.is_cover)||images[0];
    const image=cover?publicImage(cover.storage_path):agency?.logo_url||null;
    const description=String(property.description||'').trim().slice(0,155)||`${property.property_type} em ${property.public_location_text||agency?.service_area||'sua região'}. Veja fotos e informações.`;
    const title=`${property.title} | ${agencyName}`;
    const configured=agency?.website_url ? validUrl(agency.website_url) : null;
    const canonical=configured && configured.host===host
      ? new URL(`/imovel/${property.slug}`,configured.origin).toString()
      : sharedTenantUrl(origin,`/imovel/${property.slug}`,organizationSlug);

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(inject(baseHtml,{title,description,canonical,image,siteName:agencyName}));
  } catch(error) {
    console.error(error);
    res.status(500).send('Erro ao carregar página do imóvel.');
  }
}
