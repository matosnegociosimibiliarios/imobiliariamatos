import React from "react";
import { useSearchParams } from "react-router-dom";

const TABS = [
  {
    key: "visao-geral",
    label: "Visão Geral",
    description: "Resumo da gestão de locações.",
  },
  {
    key: "interessados",
    label: "Interessados",
    description: "Contatos interessados em imóveis para locação.",
  },
  {
    key: "processos",
    label: "Processos",
    description: "Processos de locação em andamento.",
  },
  {
    key: "contratos",
    label: "Contratos",
    description: "Contratos de locação.",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description: "Recebimentos, taxas e repasses das locações.",
  },
  {
    key: "vistorias-manutencao",
    label: "Vistorias e Manutenção",
    description: "Vistorias e ocorrências dos imóveis locados.",
  },
  {
    key: "historico",
    label: "Histórico",
    description: "Histórico das locações encerradas.",
  },
];

export default function AdminRentalHub() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeKey = searchParams.get("aba") || "visao-geral";

  const activeTab =
    TABS.find((tab) => tab.key === activeKey) || TABS[0];

  function openTab(key) {
    if (key === "visao-geral") {
      setSearchParams({});
    } else {
      setSearchParams({ aba: key });
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">Gestão imobiliária</span>

          <h1>Locações</h1>

          <p>
            Gestão dos imóveis administrados para locação.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 24,
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab.key === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => openTab(tab.key)}
              style={{
                border: active
                  ? "1px solid #111"
                  : "1px solid #d9d9d9",
                background: active ? "#111" : "#fff",
                color: active ? "#fff" : "#222",
                borderRadius: 8,
                padding: "10px 16px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontWeight: 600,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section className="admin-panel">
        <div className="panel-title-row">
          <h2>{activeTab.label}</h2>
        </div>

        <p>{activeTab.description}</p>

        <div
          style={{
            marginTop: 24,
            padding: 24,
            border: "1px dashed #ccc",
            borderRadius: 12,
          }}
        >
          Esta área será configurada na próxima etapa.
        </div>
      </section>
    </div>
  );
}
