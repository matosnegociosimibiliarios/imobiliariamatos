import React, { useEffect, useMemo, useState } from "react";
import {
  createRentalTenant,
  getRentalTenants,
  updateRentalTenant,
} from "../../services/rentals";

const emptyForm = {
  full_name: "",
  cpf: "",
  phone: "",
  email: "",
  profession: "",
  monthly_income: "",
  notes: "",
};

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function AdminRentalInterests() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function loadInterests() {
    setLoading(true);

    const { data, error } = await getRentalTenants();

    if (error) {
      console.error(error);
      setItems([]);
      setMessage("Não foi possível carregar os interessados.");
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadInterests();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return items;

    return items.filter((item) =>
      [
        item.full_name,
        item.cpf,
        item.phone,
        item.email,
        item.profession,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term)
        )
    );
  }, [items, search]);

  function change(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function newInterest() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");

    setTimeout(() => {
      document
        .getElementById("novo-interessado")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  function editInterest(item) {
    setEditingId(item.id);

    setForm({
      full_name: item.full_name || "",
      cpf: item.cpf || "",
      phone: item.phone || "",
      email: item.email || "",
      profession: item.profession || "",
      monthly_income: item.monthly_income || "",
      notes: item.notes || "",
    });

    setTimeout(() => {
      document
        .getElementById("novo-interessado")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.full_name.trim()) {
      setMessage("Informe o nome do interessado.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      cpf: form.cpf.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      profession: form.profession.trim(),
      notes: form.notes.trim(),
      monthly_income:
        form.monthly_income === ""
          ? null
          : Number(form.monthly_income),
    };

    const result = editingId
      ? await updateRentalTenant(editingId, payload)
      : await createRentalTenant(payload);

    if (result.error) {
      console.error(result.error);
      setMessage("Não foi possível salvar o interessado.");
      setSaving(false);
      return;
    }

    setEditingId(null);
    setForm(emptyForm);
    setMessage("Interessado salvo com sucesso.");

    await loadInterests();

    setSaving(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">
            Gestão de locações
          </span>

          <h1>Interessados</h1>

          <p>
            Pessoas interessadas em alugar imóveis.
          </p>
        </div>

        <button
          className="button"
          type="button"
          onClick={newInterest}
        >
          + Novo interessado
        </button>
      </div>

      <section className="admin-panel">
        <div className="panel-title-row">
          <h2>Interessados em locação</h2>
          <span>{filtered.length}</span>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Buscar por nome, CPF, telefone ou e-mail..."
          style={{
            width: "100%",
            maxWidth: 520,
            marginBottom: 24,
          }}
        />

        {loading ? (
          <p>Carregando interessados...</p>
        ) : filtered.length === 0 ? (
          <p>Nenhum interessado encontrado.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {filtered.map((item) => (
              <article
                key={item.id}
                style={{
                  border: "1px solid #dfe5df",
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: 18,
                    }}
                  >
                    {item.full_name}
                  </strong>

                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    {item.phone && (
                      <div>
                        WhatsApp: {item.phone}
                      </div>
                    )}

                    {item.cpf && (
                      <div>CPF: {item.cpf}</div>
                    )}

                    {item.email && (
                      <div>
                        E-mail: {item.email}
                      </div>
                    )}

                    {item.profession && (
                      <div>
                        Profissão: {item.profession}
                      </div>
                    )}

                    {item.monthly_income !== null && (
                      <div>
                        Renda:{" "}
                        {formatCurrency(
                          item.monthly_income
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="admin-link-button"
                  onClick={() =>
                    editInterest(item)
                  }
                >
                  Editar
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        id="novo-interessado"
        className="admin-panel"
        style={{
          marginTop: 20,
        }}
      >
        <div className="panel-title-row">
          <h2>
            {editingId
              ? "Editar interessado"
              : "Novo interessado"}
          </h2>
        </div>

        {message && (
          <p
            style={{
              marginBottom: 20,
            }}
          >
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <label>
              Nome completo *
              <input
                required
                value={form.full_name}
                onChange={(event) =>
                  change(
                    "full_name",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              CPF
              <input
                value={form.cpf}
                onChange={(event) =>
                  change(
                    "cpf",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              WhatsApp
              <input
                value={form.phone}
                onChange={(event) =>
                  change(
                    "phone",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              E-mail
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  change(
                    "email",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Profissão
              <input
                value={form.profession}
                onChange={(event) =>
                  change(
                    "profession",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Renda mensal
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_income}
                onChange={(event) =>
                  change(
                    "monthly_income",
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <label
            style={{
              display: "block",
              marginTop: 16,
            }}
          >
            Observações

            <textarea
              rows="4"
              value={form.notes}
              onChange={(event) =>
                change(
                  "notes",
                  event.target.value
                )
              }
              style={{
                width: "100%",
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 20,
              flexWrap: "wrap",
            }}
          >
            <button
              className="button"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Salvando..."
                : editingId
                ? "Salvar alterações"
                : "Salvar interessado"}
            </button>

            {editingId && (
              <button
                className="admin-link-button"
                type="button"
                onClick={cancelEdit}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
