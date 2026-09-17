import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../services/crm';
import {
  FINANCE_DIRECTION_LABELS,
  FINANCE_STATUS_LABELS,
  createFinanceEntry,
  getFinanceAccounts,
  getFinanceCategories,
  getFinanceSummary,
  updateFinanceEntry,
} from '../../services/finance';

const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
const toInputDate = (date) => date.toISOString().slice(0, 10);

const EMPTY_FORM = {
  description: '',
  direction: 'income',
  amount: '',
  due_date: toInputDate(today),
  status: 'pending',
  account_id: '',
  category_id: '',
  notes: '',
};

export default function AdminFinance() {
  const [summary, setSummary] = useState({ incomePaid: 0, expensePaid: 0, incomePending: 0, expensePending: 0, balance: 0, entries: [], accounts: [] });
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const [summaryResult, categoriesResult] = await Promise.all([
      getFinanceSummary({ startDate: toInputDate(firstDay), endDate: toInputDate(today) }),
      getFinanceCategories(),
    ]);
    if (summaryResult.error || categoriesResult.error) {
      setMessage('Não foi possível carregar todos os dados financeiros.');
    }
    setSummary(summaryResult.data || { incomePaid: 0, expensePaid: 0, incomePending: 0, expensePending: 0, balance: 0, entries: [], accounts: [] });
    setCategories(categoriesResult.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return summary.entries;
    return summary.entries.filter((entry) => entry.direction === filter);
  }, [summary.entries, filter]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!form.description.trim() || Number(form.amount) <= 0 || !form.account_id || !form.category_id) {
      setMessage('Preencha descrição, valor, conta e categoria.');
      return;
    }
    setSaving(true);
    const result = await createFinanceEntry({
      description: form.description.trim(),
      direction: form.direction,
      amount: Number(form.amount),
      due_date: form.due_date,
      status: form.status,
      account_id: form.account_id,
      category_id: form.category_id,
      notes: form.notes.trim() || null,
      paid_at: form.status === 'paid' ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (result.error) {
      setMessage(result.error.message || 'Não foi possível salvar o lançamento.');
      return;
    }
    setForm(EMPTY_FORM);
    setMessage('Lançamento criado.');
    await load();
  }

  async function handleStatus(entry) {
    const nextStatus = entry.status === 'paid' ? 'pending' : 'paid';
    const result = await updateFinanceEntry(entry.id, {
      status: nextStatus,
      paid_at: nextStatus === 'paid' ? new Date().toISOString() : null,
    });
    if (result.error) setMessage(result.error.message || 'Não foi possível atualizar o lançamento.');
    else await load();
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">FINANCEIRO</span>
          <h1>Financeiro da empresa</h1>
          <p>Controle de receitas, despesas, contas e fluxo financeiro interno.</p>
        </div>
      </header>

      {message && <div className="admin-message">{message}</div>}

      <div className="management-metrics-grid">
        <article className="admin-card"><span>Receitas pagas no mês</span><strong>{formatCurrency(summary.incomePaid)}</strong></article>
        <article className="admin-card"><span>Despesas pagas no mês</span><strong>{formatCurrency(summary.expensePaid)}</strong></article>
        <article className="admin-card"><span>Saldo realizado</span><strong>{formatCurrency(summary.balance)}</strong></article>
        <article className="admin-card"><span>A receber</span><strong>{formatCurrency(summary.incomePending)}</strong></article>
        <article className="admin-card"><span>A pagar</span><strong>{formatCurrency(summary.expensePending)}</strong></article>
      </div>

      {summary.accounts.length === 0 ? (
        <section className="admin-card admin-placeholder-card">
          <h2>Cadastre uma conta financeira</h2>
          <p>O banco financeiro já está conectado ao CRM, mas ainda não existem contas ou categorias cadastradas para receber lançamentos.</p>
        </section>
      ) : (
        <section className="admin-panel">
          <div className="panel-title-row"><h2>Novo lançamento</h2></div>
          <form onSubmit={handleSubmit} className="admin-form-grid">
            <label>Descrição<input value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Ex.: comissão de venda" /></label>
            <label>Tipo<select value={form.direction} onChange={(e) => setField('direction', e.target.value)}><option value="income">Receita</option><option value="expense">Despesa</option></select></label>
            <label>Valor<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setField('amount', e.target.value)} /></label>
            <label>Vencimento<input type="date" value={form.due_date} onChange={(e) => setField('due_date', e.target.value)} /></label>
            <label>Conta<select value={form.account_id} onChange={(e) => setField('account_id', e.target.value)}><option value="">Selecione</option>{summary.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
            <label>Categoria<select value={form.category_id} onChange={(e) => setField('category_id', e.target.value)}><option value="">Selecione</option>{categories.filter((item) => item.direction === form.direction || item.direction === 'both').map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label>Status<select value={form.status} onChange={(e) => setField('status', e.target.value)}><option value="pending">Pendente</option><option value="paid">Pago</option></select></label>
            <label>Observações<input value={form.notes} onChange={(e) => setField('notes', e.target.value)} /></label>
            <div><button className="button" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Lançar no financeiro'}</button></div>
          </form>
        </section>
      )}

      <section className="admin-panel">
        <div className="panel-title-row">
          <h2>Lançamentos do mês</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select>
        </div>
        {loading ? <p>Carregando financeiro...</p> : filteredEntries.length === 0 ? <p>Nenhum lançamento no período.</p> : (
          <div className="rental-contract-list">
            {filteredEntries.map((entry) => (
              <article className="rental-contract-card" key={entry.id}>
                <div>
                  <div className="rental-contract-topline"><strong>{entry.description}</strong><span className={`rental-status ${entry.status}`}>{FINANCE_STATUS_LABELS[entry.status]}</span></div>
                  <p>{FINANCE_DIRECTION_LABELS[entry.direction]} · {entry.category?.name || 'Sem categoria'} · {entry.account?.name || 'Sem conta'}</p>
                  <small>{entry.due_date ? formatDate(entry.due_date) : 'Sem vencimento'}{entry.paid_at ? ` · Pago em ${formatDate(entry.paid_at)}` : ''}</small>
                </div>
                <div className="rental-contract-side">
                  <strong>{formatCurrency(entry.amount)}</strong>
                  <button type="button" className="button secondary" onClick={() => handleStatus(entry)}>{entry.status === 'paid' ? 'Marcar pendente' : 'Marcar como pago'}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
