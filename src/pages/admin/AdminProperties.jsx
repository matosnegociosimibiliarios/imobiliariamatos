import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  changePropertyStatus,
  getAllAdminProperties,
  softDeleteProperty,
} from '../../services/admin';
import { formatMoney } from '../../services/properties';

const statusLabels = {
  draft: 'Rascunho',
  published: 'Publicado',
  reserved: 'Reservado',
  sold: 'Vendido',
  rented: 'Alugado',
  inactive: 'Inativo',
};

export default function AdminProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await getAllAdminProperties();

    if (error) {
      setMessage('Não foi possível carregar os imóveis.');
      setProperties([]);
    } else {
      setProperties(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(property) {
    const next = property.status === 'published' ? 'draft' : 'published';

    const { error } = await changePropertyStatus(property.id, next);

    if (error) {
      setMessage('Não foi possível alterar o status.');
      return;
    }

    await load();
  }

  async function remove(property) {
    const confirmed = window.confirm(
      `Tem certeza que deseja remover o imóvel ${property.code}?`
    );

    if (!confirmed) return;

    const { error } = await softDeleteProperty(property.id);

    if (error) {
      setMessage('Não foi possível remover o imóvel.');
      return;
    }

    await load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Imóveis</span>
          <h1>Gerenciar imóveis</h1>
        </div>

        <Link className="button" to="/admin/imoveis/novo">
          Novo imóvel
        </Link>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <section className="admin-panel">
        {loading ? (
          <p>Carregando...</p>
        ) : properties.length === 0 ? (
          <div className="admin-empty">
            <h2>Nenhum imóvel cadastrado</h2>
            <Link className="button" to="/admin/imoveis/novo">
              Cadastrar primeiro imóvel
            </Link>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Imóvel</th>
                  <th>Finalidade</th>
                  <th>Preço</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td>{property.code}</td>
                    <td>
                      <strong>{property.title}</strong>
                      <small>{property.public_location_text || ''}</small>
                    </td>
                    <td>
                      {property.purpose === 'sale'
                        ? 'Venda'
                        : property.purpose === 'rent'
                        ? 'Aluguel'
                        : 'Venda e aluguel'}
                    </td>
                    <td>
                      {property.sale_price != null
                        ? formatMoney(property.sale_price)
                        : property.rent_price != null
                        ? `${formatMoney(property.rent_price)}/mês`
                        : '—'}
                    </td>
                    <td>
                      <span className={`admin-status ${property.status}`}>
                        {statusLabels[property.status] || property.status}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link to={`/admin/imoveis/${property.id}/editar`}>
                          Editar
                        </Link>

                        <button
                          type="button"
                          onClick={() => togglePublish(property)}
                        >
                          {property.status === 'published'
                            ? 'Despublicar'
                            : 'Publicar'}
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() => remove(property)}
                        >
                          Excluir
                        </button>
                      </div>
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
