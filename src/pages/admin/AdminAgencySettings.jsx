import React, { useEffect, useState } from 'react';
import { EMPTY_AGENCY_SETTINGS, getAgencySettings, updateAgencySettings } from '../../services/agencySettings';

const groups = [
  { title: 'Identidade', fields: [
    ['agency_name', 'Nome exibido', 'Nome que aparecerá no CRM e no site.'], ['legal_name', 'Razão social', 'Nome jurídico da empresa.'],
    ['trade_name', 'Nome fantasia', 'Nome comercial, se diferente do nome exibido.'], ['creci', 'CRECI', 'Registro profissional da imobiliária.'],
    ['cnpj', 'CNPJ', 'CNPJ da empresa.'], ['slogan', 'Slogan', 'Frase institucional usada na apresentação da marca.'],
  ]},
  { title: 'Contato e endereço', fields: [
    ['phone', 'Telefone', 'Telefone principal.'], ['whatsapp', 'WhatsApp', 'Número comercial do WhatsApp.'],
    ['public_email', 'E-mail público', 'E-mail mostrado aos visitantes.'], ['website_url', 'Site', 'Endereço do site público.'],
    ['public_address', 'Endereço', 'Endereço comercial mostrado no site.'],
  ]},
  { title: 'Redes sociais', fields: [
    ['instagram', 'Instagram', 'URL ou @ da conta profissional.'], ['facebook', 'Facebook', 'URL da página.'],
    ['tiktok', 'TikTok', 'URL da conta.'], ['youtube', 'YouTube', 'URL do canal.'],
  ]},
  { title: 'Marca visual', fields: [
    ['logo_url', 'Logo', 'URL da logo. O upload gerenciado entra na próxima camada de armazenamento.'],
    ['favicon_url', 'Favicon', 'URL do favicon.'], ['cover_image_url', 'Imagem de capa', 'URL da imagem institucional.'],
    ['primary_color', 'Cor principal', 'Hexadecimal, por exemplo #111827.'], ['secondary_color', 'Cor secundária', 'Hexadecimal, por exemplo #E5E7EB.'],
  ]},
];

export default function AdminAgencySettings() {
  const [settings, setSettings] = useState(EMPTY_AGENCY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const result = await getAgencySettings();
    if (result.error) setMessage(result.error.message || 'Não foi possível carregar os dados da imobiliária.');
    else if (result.data) setSettings((current) => ({ ...current, ...result.data }));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function setField(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function setColor(field, value) {
    const normalized = value.startsWith('#') ? value : `#${value}`;
    setField(field, normalized.toUpperCase());
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const result = await updateAgencySettings(settings);
    if (result.error) setMessage(result.error.message || 'Não foi possível salvar os dados.');
    else {
      setSettings((current) => ({ ...current, ...(result.data || {}) }));
      setMessage('Identidade da imobiliária atualizada.');
    }
    setSaving(false);
  }

  if (loading) return <div className="admin-loading">Carregando identidade da imobiliária...</div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Camada 2 · Identidade</span>
          <h1>Dados da imobiliária</h1>
          <p>Os dados pertencem à empresa ativa. Cada cliente terá sua própria identidade sem alterar o código do CRM.</p>
        </div>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <form onSubmit={save}>
        {groups.map((group) => (
          <section className="admin-panel" key={group.title} style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 18 }}><span className="eyebrow">{group.title}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {group.fields.map(([field, label, help]) => (
                <label key={field} style={{ display: 'grid', gap: 6 }}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <input value={settings[field] || ''} onChange={(event) => setField(field, event.target.value)} placeholder={label} style={{ width: '100%', boxSizing: 'border-box' }} />
                  <small style={{ opacity: .7 }}>{help}</small>
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="admin-panel" style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 18 }}>
            <span className="eyebrow">Cores do site</span>
            <h2 style={{ marginBottom: 6 }}>Paleta da imobiliária</h2>
            <p>Escolha visualmente ou informe o código hexadecimal da sua marca.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            {[['primary_color','Cor principal','#B4000C'],['secondary_color','Cor secundária','#1F2937']].map(([field,label,fallback]) => {
              const value = /^#[0-9A-Fa-f]{6}$/.test(settings[field] || '') ? settings[field] : fallback;
              return <div key={field} style={{ display:'grid', gap:8 }}>
                <strong style={{ fontSize:13 }}>{label}</strong>
                <div style={{ display:'grid', gridTemplateColumns:'64px 1fr', gap:10, alignItems:'center' }}>
                  <input aria-label={`Selecionar ${label.toLowerCase()}`} type="color" value={value} onChange={(e)=>setColor(field,e.target.value)} style={{ width:64, height:46, padding:3, cursor:'pointer' }} />
                  <input value={settings[field] || ''} onChange={(e)=>setColor(field,e.target.value)} placeholder={fallback} maxLength="7" pattern="^#[0-9A-Fa-f]{6}$" />
                </div>
                <small style={{ opacity:.7 }}>Use a paleta ou digite um código como {fallback}.</small>
              </div>;
            })}
          </div>
          <div style={{ marginTop:20, borderRadius:16, overflow:'hidden', border:'1px solid #ddd' }}>
            <div style={{ background: /^#[0-9A-Fa-f]{6}$/.test(settings.primary_color || '') ? settings.primary_color : '#B4000C', color:'#fff', padding:'18px 20px' }}>
              <strong>{settings.agency_name || 'Sua imobiliária'}</strong>
              <div style={{ fontSize:13, opacity:.9, marginTop:4 }}>{settings.slogan || 'Prévia da identidade do seu site'}</div>
            </div>
            <div style={{ background: /^#[0-9A-Fa-f]{6}$/.test(settings.secondary_color || '') ? settings.secondary_color : '#1F2937', color:'#fff', padding:'12px 20px', fontSize:13 }}>
              Cor secundária aplicada em elementos de apoio.
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="button" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar identidade'}</button>
        </div>
      </form>
    </div>
  );
}
