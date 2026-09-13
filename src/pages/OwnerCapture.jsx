import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitOwnerCapture } from '../services/captures';

const PROPERTY_TYPES = [
  'Casa',
  'Apartamento',
  'Terreno',
  'Sítio',
  'Comercial',
  'Outro',
];

export default function OwnerCapture({ requestType = 'listing' }) {
  const isValuation = requestType === 'valuation';

  const [form, setForm] = useState({
    owner_name: '',
    whatsapp: '',
    email: '',
    purpose: 'sale',
    property_type: 'Casa',
    city_name: '',
    state_code: 'MG',
    neighborhood_name: '',
    address_text: '',
    asking_value: '',
    description: '',
    consent: false,
  });

  const [state, setState] = useState({
    submitting: false,
    success: false,
    error: '',
  });

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.consent) {
      setState({
        submitting: false,
        success: false,
        error: 'É necessário autorizar o uso dos dados para atendimento.',
      });
      return;
    }

    setState({
      submitting: true,
      success: false,
      error: '',
    });

    const { error } = await submitOwnerCapture({
      ...form,
      request_type: requestType,
    });

    if (error) {
      setState({
        submitting: false,
        success: false,
        error: 'Não foi possível enviar. Confira os dados e tente novamente.',
      });
      return;
    }

    setState({
      submitting: false,
      success: true,
      error: '',
    });
  }

  if (state.success) {
    return (
      <main className="owner-capture-page">
        <section className="owner-capture-success">
          <span className="eyebrow">Dados recebidos</span>
          <h1>
            {isValuation
              ? 'Sua solicitação de avaliação foi enviada.'
              : 'Seu imóvel entrou no nosso processo de captação.'}
          </h1>
          <p>
            Vamos analisar as informações e entrar em contato pelo WhatsApp
            informado para dar continuidade.
          </p>

          <Link className="button" to="/">
            Voltar para o início
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="owner-capture-page">
      <section className="owner-capture-hero">
        <div>
          <span className="eyebrow eyebrow-light">
            {isValuation ? 'Avaliação de imóvel' : 'Para proprietários'}
          </span>

          <h1>
            {isValuation
              ? 'Quer saber quanto seu imóvel pode valer?'
              : 'Quer vender ou alugar seu imóvel?'}
          </h1>

          <p>
            {isValuation
              ? 'Envie as informações principais. A avaliação começa pelo entendimento do imóvel, localização e objetivo do proprietário.'
              : 'Cadastre as informações principais. Elas chegam diretamente ao nosso painel de captações para acompanhamento.'}
          </p>
        </div>
      </section>

      <section className="section owner-capture-content">
        <div className="owner-capture-benefits">
          <span className="eyebrow">Como funciona</span>
          <h2>
            {isValuation
              ? 'Primeiro entendemos o imóvel. Depois definimos o próximo passo.'
              : 'Do primeiro contato até a publicação.'}
          </h2>

          <div className="owner-process-list">
            <article>
              <strong>1</strong>
              <div>
                <h3>Recebemos os dados</h3>
                <p>Você informa o imóvel e a melhor forma de contato.</p>
              </div>
            </article>

            <article>
              <strong>2</strong>
              <div>
                <h3>Avaliamos a situação</h3>
                <p>Preço, localização, documentação e objetivo da negociação.</p>
              </div>
            </article>

            <article>
              <strong>3</strong>
              <div>
                <h3>Definimos a estratégia</h3>
                <p>
                  Se fizer sentido para ambas as partes, o imóvel segue para
                  autorização e divulgação.
                </p>
              </div>
            </article>
          </div>
        </div>

        <form className="owner-capture-form" onSubmit={handleSubmit}>
          <div className="owner-form-heading">
            <span className="eyebrow">
              {isValuation ? 'Solicitar avaliação' : 'Cadastrar imóvel'}
            </span>
            <h2>Dados do proprietário</h2>
          </div>

          <div className="admin-form-grid two">
            <label>
              Nome
              <input
                name="owner_name"
                value={form.owner_name}
                onChange={updateField}
                required
                minLength="2"
                placeholder="Seu nome"
              />
            </label>

            <label>
              WhatsApp
              <input
                name="whatsapp"
                value={form.whatsapp}
                onChange={updateField}
                required
                inputMode="tel"
                placeholder="(32) 99999-9999"
              />
            </label>

            <label className="full">
              E-mail
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                placeholder="Opcional"
              />
            </label>
          </div>

          <h3>Dados do imóvel</h3>

          <div className="admin-form-grid two">
            <label>
              O que deseja fazer?
              <select
                name="purpose"
                value={form.purpose}
                onChange={updateField}
              >
                <option value="sale">Vender</option>
                <option value="rent">Alugar</option>
                <option value="sale_and_rent">Vender ou alugar</option>
              </select>
            </label>

            <label>
              Tipo de imóvel
              <select
                name="property_type"
                value={form.property_type}
                onChange={updateField}
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Cidade
              <input
                name="city_name"
                value={form.city_name}
                onChange={updateField}
                required
                placeholder="Ex.: Ressaquinha"
              />
            </label>

            <label>
              Estado
              <input
                name="state_code"
                value={form.state_code}
                onChange={updateField}
                maxLength="2"
                required
                placeholder="MG"
              />
            </label>

            <label>
              Bairro
              <input
                name="neighborhood_name"
                value={form.neighborhood_name}
                onChange={updateField}
                placeholder="Ex.: Centro"
              />
            </label>

            <label>
              Valor pretendido
              <input
                type="number"
                min="0"
                step="0.01"
                name="asking_value"
                value={form.asking_value}
                onChange={updateField}
                placeholder="Opcional"
              />
            </label>

            <label className="full">
              Endereço ou referência
              <input
                name="address_text"
                value={form.address_text}
                onChange={updateField}
                placeholder="Opcional. Não será publicado automaticamente."
              />
            </label>

            <label className="full">
              Conte um pouco sobre o imóvel
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                rows="5"
                placeholder="Quartos, banheiros, garagem, área aproximada, estado de conservação e outras informações úteis."
              />
            </label>
          </div>

          <label className="owner-consent">
            <input
              type="checkbox"
              name="consent"
              checked={form.consent}
              onChange={updateField}
              required
            />
            <span>
              Autorizo o uso destes dados para contato e atendimento relacionado
              a este imóvel.
            </span>
          </label>

          {state.error && (
            <div className="lead-error">{state.error}</div>
          )}

          <button className="button full-button" disabled={state.submitting}>
            {state.submitting
              ? 'Enviando...'
              : isValuation
              ? 'Solicitar avaliação'
              : 'Enviar imóvel'}
          </button>
        </form>
      </section>
    </main>
  );
}
