import React, { useEffect, useState } from 'react';
import { getAppointments, updateAppointment } from '../../services/admin';
import ResponsibleSelect from '../../components/ResponsibleSelect';
import { PROPERTY_FEEDBACK_OPTIONS } from '../../services/propertyIndicators';

const statuses = [
  ['requested', 'Solicitado'],
  ['confirmed', 'Confirmado'],
  ['completed', 'Realizado'],
  ['cancelled', 'Cancelado'],
  ['no_show', 'Não compareceu'],
];

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await getAppointments();
    setAppointments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateLocal(id, field, value) {
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  async function changeStatus(id, status) {
    updateLocal(id, 'status', status);
    await updateAppointment(id, { status });
    await load();
  }

  async function saveFeedback(item) {
    await updateAppointment(item.id, {
      feedback_code: item.feedback_code || null,
      feedback_notes: item.feedback_notes?.trim() || null,
    });
    await load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Atendimento</span>
          <h1>Agendamentos</h1>
        </div>
      </div>

      <section className="admin-panel">
        {loading ? (
          <p>Carregando...</p>
        ) : appointments.length === 0 ? (
          <div className="admin-empty">
            <h2>Nenhum agendamento solicitado</h2>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Imóvel</th>
                  <th>Data desejada</th>
                  <th>Horário</th>
                  <th>Corretor</th>
                  <th>Status</th>
                  <th>Parecer</th>
                  <th>Observação</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {appointments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.lead?.name || 'Lead'}</strong>
                      <small>{item.lead?.whatsapp || ''}</small>
                    </td>

                    <td>
                      {item.property ? (
                        <>
                          <strong>{item.property.code}</strong>
                          <small>{item.property.title}</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>{item.requested_date || 'A combinar'}</td>
                    <td>{item.requested_time || 'A combinar'}</td>

                    <td>
                      <ResponsibleSelect
                        table="appointments"
                        recordId={item.id}
                        value={item.assigned_to}
                        compact
                        onChange={(next) => updateLocal(item.id, 'assigned_to', next)}
                      />
                    </td>

                    <td>
                      <select
                        value={item.status}
                        onChange={(event) =>
                          changeStatus(item.id, event.target.value)
                        }
                      >
                        {statuses.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select value={item.feedback_code || ''} onChange={(event) => updateLocal(item.id, 'feedback_code', event.target.value)}>
                        <option value="">Sem parecer</option>
                        {PROPERTY_FEEDBACK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>

                    <td>
                      <input
                        value={item.feedback_notes || ''}
                        onChange={(event) => updateLocal(item.id, 'feedback_notes', event.target.value)}
                        placeholder="Observação do cliente"
                      />
                    </td>

                    <td>
                      <button type="button" className="admin-link-button" onClick={() => saveFeedback(item)}>Salvar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
