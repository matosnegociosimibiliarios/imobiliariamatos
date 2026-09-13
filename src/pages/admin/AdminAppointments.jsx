import React, { useEffect, useState } from 'react';
import { getAppointments, updateAppointment } from '../../services/admin';

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

  async function changeStatus(id, status) {
    await updateAppointment(id, { status });
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
                  <th>Status</th>
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
