import React, { useState } from 'react';
import { submitAppointment, submitLead, trackEvent } from '../services/tracking';

export default function LeadForm({
  property = null,
  mode = 'contact',
}) {
  const [form, setForm] = useState({
    name: '',
    whatsapp: '',
    email: '',
    message: '',
    wantsAppointment: mode === 'appointment',
    requestedDate: '',
    requestedTime: '',
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

    setState({
      submitting: true,
      success: false,
      error: '',
    });

    const { data, error } = await submitLead({
      propertyId: property?.id || null,
      name: form.name,
      whatsapp: form.whatsapp,
      email: form.email,
      message: form.message,
      source: property ? 'imovel' : 'site',
      sourceDetail: property?.code || null,
      landingPath: window.location.pathname,
    });

    if (error || !data?.id) {
      setState({
        submitting: false,
        success: false,
        error: 'Não foi possível enviar seus dados. Tente novamente.',
      });
      return;
    }

    trackEvent('lead_submit', { propertyId: property?.id || null, metadata: { property_code: property?.code || null } });

    if (form.wantsAppointment) {
      const { error: appointmentError } = await submitAppointment({
        leadId: data.id,
        propertyId: property?.id || null,
        requestedDate: form.requestedDate,
        requestedTime: form.requestedTime,
      });

      if (appointmentError) {
        setState({
          submitting: false,
          success: false,
          error:
            'Seu contato foi enviado, mas o pedido de visita não pôde ser concluído.',
        });
        return;
      }

      trackEvent('appointment_submit', { propertyId: property?.id || null, metadata: { property_code: property?.code || null, requested_date: form.requestedDate, requested_time: form.requestedTime } });
    }

    setState({
      submitting: false,
      success: true,
      error: '',
    });

    setForm({
      name: '',
      whatsapp: '',
      email: '',
      message: '',
      wantsAppointment: mode === 'appointment',
      requestedDate: '',
      requestedTime: '',
    });
  }

  if (state.success) {
    return (
      <div className="lead-success">
        <strong>Contato recebido.</strong>
        <p>
          A Matos Negócios Imobiliários poderá entrar em contato pelos dados informados.
        </p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <label>
        Nome
        <input
          name="name"
          value={form.name}
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

      <label>
        E-mail
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={updateField}
          placeholder="Opcional"
        />
      </label>

      <label>
        Mensagem
        <textarea
          name="message"
          value={form.message}
          onChange={updateField}
          rows="3"
          placeholder={
            property
              ? `Tenho interesse no imóvel ${property.code}.`
              : 'Como podemos ajudar?'
          }
        />
      </label>

      <label className="lead-checkbox">
        <input
          type="checkbox"
          name="wantsAppointment"
          checked={form.wantsAppointment}
          onChange={updateField}
        />
        Quero solicitar uma visita
      </label>

      {form.wantsAppointment && (
        <div className="lead-appointment-grid">
          <label>
            Dia desejado
            <input
              type="date"
              name="requestedDate"
              value={form.requestedDate}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Horário desejado
            <input
              type="time"
              name="requestedTime"
              value={form.requestedTime}
              onChange={updateField}
              required
            />
          </label>
        </div>
      )}

      {state.error && (
        <div className="lead-error">{state.error}</div>
      )}

      <button className="button full-button" disabled={state.submitting}>
        {state.submitting
          ? 'Enviando...'
          : form.wantsAppointment
          ? 'Solicitar visita'
          : 'Tenho interesse'}
      </button>

      <small className="lead-privacy-note">
        Seus dados serão usados apenas para atendimento relacionado ao seu interesse imobiliário.
      </small>
    </form>
  );
}
