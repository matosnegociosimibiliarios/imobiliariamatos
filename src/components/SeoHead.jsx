import React, { useEffect } from 'react';

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== null && value !== undefined) el.setAttribute(key, String(value));
  });
}

function upsertCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

function normalizeBaseUrl(value) {
  if (!value) return null;
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

function sharedTenantCanonical(path, organizationSlug) {
  const url = new URL(path || window.location.pathname, window.location.origin);
  if (organizationSlug) url.searchParams.set('imobiliaria', organizationSlug);
  return url.toString();
}

export default function SeoHead({
  title,
  description,
  canonicalPath,
  image = null,
  robots = 'index,follow',
  type = 'website',
  jsonLd = null,
  siteName = 'Imobiliária',
  organizationSlug = null,
  websiteUrl = null,
  faviconUrl = null,
}) {
  useEffect(() => {
    const cleanSiteName = siteName || 'Imobiliária';
    const finalTitle = title.includes(cleanSiteName) ? title : `${title} | ${cleanSiteName}`;
    const customBase = normalizeBaseUrl(websiteUrl);
    const path = canonicalPath || window.location.pathname;
    const canonical = customBase
      ? new URL(path, customBase).toString()
      : sharedTenantCanonical(path, organizationSlug);

    document.title = finalTitle;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: cleanSiteName });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: finalTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: finalTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });

    const previousOgImage = document.head.querySelector('meta[property="og:image"]');
    const previousTwitterImage = document.head.querySelector('meta[name="twitter:image"]');
    if (image) {
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    } else {
      previousOgImage?.remove();
      previousTwitterImage?.remove();
    }

    if (faviconUrl) {
      let favicon = document.head.querySelector('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = faviconUrl;
    }

    upsertCanonical(canonical);

    const id = 'agency-page-jsonld';
    let script = document.getElementById(id);
    if (jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }
  }, [title, description, canonicalPath, image, robots, type, jsonLd, siteName, organizationSlug, websiteUrl, faviconUrl]);

  return null;
}
