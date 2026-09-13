import React, { useEffect, useState } from 'react';
import { getLeads, updateLeadStatus } from '../../services/admin';

const statuses = [
  ['new', 'Novo'],
  ['contacted', 'Contatado'],
  ['qualified', 'Qualificado'],
  ['visit_scheduled', 'Visita agendada'],
  ['proposal', 'Proposta'],
  ['won', 'Fechado'],
  ['lost', 'Perdido'],
];

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await getLeads();
    setLeads(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(id, status) {
    await updateLeadStatus(id, status);
    await load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">CRM</span>
          <h1>Leads</h1>
        </div>
      </div>

      <section className="admin-panel">
        {loading ? (
          <p>Carregando...</p>
        ) : leads.length === 0 ? (
          <div className="admin-empty">
            <h2>Nenhum lead recebido ainda</h2>
            <p>Quando um visitante enviar o formulário de interesse, ele aparecerá aqui.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Imóvel</th>
                  <th>Origem</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{new Date(lead.created_at).toLocaleString('pt-BR')}</td>

                    <td>
                      <strong>{lead.name}</strong>
                      <small>{lead.whatsapp}</small>
                      {lead.email && <small>{lead.email}</small>}
                    </td>

                    <td>
                      {lead.property ? (
                        <>
                          <strong>{lead.property.code}</strong>
                          <small>{lead.property.title}</small>
                        </>
                      ) : (
                        'Contato geral'
                      )}
                    </td>

                    <td>{lead.source_detail || lead.source}</td>

                    <td>
                      <select
                        value={lead.status}
                        onChange={(event) =>
                          changeStatus(lead.id, event.target.value)
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
