function escapeHtml(value='') {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

async function publicDb(path) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase público não configurado.');
  const response = await fetch(`${url.replace(/\/+$/,'')}/rest/v1/${path}`, {
    headers: { apikey:key, Authorization:`Bearer ${key}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function publicImage(storagePath) {
  if (!storagePath) return null;
  const url = process.env.VITE_SUPABASE_URL.replace(/\/+$/,'');
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${url}/storage/v1/object/public/property-images/${encoded}`;
}

function inject(html, { title, description, canonical, image, robots='index,follow' }) {
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, '');
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ];
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  return html.replace('</head>', `${tags.join('\n')}\n</head>`);
}

export default async function handler(req,res) {
  try {
    const slug=String(req.query.slug||'').trim();
    const host=req.headers['x-forwarded-host']||req.headers.host||'imobiliariamatos.vercel.app';
    const origin=`https://${host}`;
    const baseHtml=await fetch(`${origin}/index.html`).then(r=>r.text());
    const rows=await publicDb(`properties?select=id,title,slug,description,property_type,public_location_text&slug=eq.${encodeURIComponent(slug)}&status=eq.published&deleted_at=is.null&limit=1`);
    const property=rows?.[0];
    if(!property){
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.status(404).send(inject(baseHtml,{title:'Imóvel não disponível | Matos Negócios Imobiliários',description:'Este imóvel não está disponível no momento.',canonical:`${origin}/imovel/${encodeURIComponent(slug)}`,robots:'noindex,nofollow'}));
      return;
    }
    const images=await publicDb(`property_images?select=storage_path,is_cover,display_order&property_id=eq.${property.id}&order=display_order.asc`);
    const cover=images.find(i=>i.is_cover)||images[0];
    const image=cover?publicImage(cover.storage_path):null;
    const description=String(property.description||'').trim().slice(0,155)||`${property.property_type} em ${property.public_location_text||'Minas Gerais'}. Veja fotos e informações.`;
    const title=`${property.title} | Matos Negócios Imobiliários`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(inject(baseHtml,{title,description,canonical:`${origin}/imovel/${property.slug}`,image}));
  } catch(error) {
    console.error(error);
    res.status(500).send('Erro ao carregar página do imóvel.');
  }
}
