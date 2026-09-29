import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../services/crm';
import {
  FINANCE_DIRECTION_LABELS,
  FINANCE_STATUS_LABELS,
  createFinanceEntry,
  getFinanceAccounts,
  getFinanceCategories,
  getFinanceSummary,
  getFinanceOverview,
  getRecurringFinanceEntries,
  saveRecurringFinanceEntry,
  deleteRecurringFinanceEntry,
  generateDueRecurringFinanceEntries,
  createFinanceAccount,
  createFinanceCategory,
  updateFinanceEntry,
  deleteFinanceEntry,
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
  const [summary, setSummary] = useState({ incomePaid: 0, expensePaid: 0, incomePending: 0, expensePending: 0, balance: 0, managedIncome: 0, managedExpense: 0, entries: [], managedEntries: [], accounts: [] });
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState('all');
  const [startDate, setStartDate] = useState(toInputDate(firstDay));
  const [endDate, setEndDate] = useState(toInputDate(today));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [overview,setOverview]=useState({});
  const [recurring,setRecurring]=useState([]);

  async function load() {
    setLoading(true);
    const [summaryResult, categoriesResult, overviewResult, recurringResult] = await Promise.all([
      getFinanceSummary({ startDate, endDate }), getFinanceCategories(), getFinanceOverview(startDate,endDate), getRecurringFinanceEntries()
    ]);
    if (summaryResult.error || categoriesResult.error) {
      setMessage('Não foi possível carregar todos os dados financeiros.');
    }
    setSummary(summaryResult.data || { incomePaid: 0, expensePaid: 0, incomePending: 0, expensePending: 0, balance: 0, managedIncome: 0, managedExpense: 0, entries: [], managedEntries: [], accounts: [] });
    setCategories(categoriesResult.data || []); setOverview(overviewResult.data||{}); setRecurring(recurringResult.data||[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [startDate, endDate]);

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

  async function handleDelete(entry) {
    if (!window.confirm(`Excluir o lançamento "${entry.description}"?`)) return;
    const result = await deleteFinanceEntry(entry.id);
    if (result.error) setMessage(result.error.message || 'Não foi possível excluir o lançamento.');
    else await load();
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

  async function addAccount(){ const name=window.prompt('Nome da conta financeira:','Conta principal'); if(!name)return; const r=await createFinanceAccount(name,'bank',0); if(r.error)setMessage(r.error.message); else await load(); }
  async function addCategory(){ const name=window.prompt('Nome da categoria:'); if(!name)return; const direction=window.prompt('Tipo: income para receita ou expense para despesa:','expense'); if(!['income','expense'].includes(direction))return setMessage('Tipo de categoria inválido.'); const r=await createFinanceCategory(name,direction); if(r.error)setMessage(r.error.message); else await load(); }
  async function addRecurring(){ if(!summary.accounts.length)return setMessage('Cadastre uma conta primeiro.'); const description=window.prompt('Descrição da recorrência:'); if(!description)return; const amount=Number(String(window.prompt('Valor:','0')||'').replace(',','.')); if(!(amount>0))return; const direction=window.prompt('Tipo: income ou expense:','expense'); if(!['income','expense'].includes(direction))return; const category=categories.find(x=>x.direction===direction||x.direction==='both'); const next_due_date=window.prompt('Primeiro vencimento (AAAA-MM-DD):',toInputDate(today)); if(!next_due_date)return; const r=await saveRecurringFinanceEntry({description,direction,amount,account_id:summary.accounts[0].id,category_id:category?.id||null,frequency:'monthly',next_due_date,active:true}); if(r.error)setMessage(r.error.message); else await load(); }
  async function generateRecurring(){ const r=await generateDueRecurringFinanceEntries(endDate); if(r.error)setMessage(r.error.message); else{setMessage(`${r.data||0} lançamento(s) recorrente(s) gerado(s).`);await load();} }
  async function removeRecurring(id){ if(!window.confirm('Excluir esta recorrência?'))return; const r=await deleteRecurringFinanceEntry(id); if(r.error)setMessage(r.error.message); else await load(); }

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

      <section className="admin-panel">
        <div className="panel-title-row"><h2>Período</h2><div className="admin-form-grid two">
          <label>De<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label>Até<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        </div></div>
      </section>

      <div className="management-metrics-grid">
        <article className="admin-card"><span>Receitas pagas no período</span><strong>{formatCurrency(summary.incomePaid)}</strong></article>
        <article className="admin-card"><span>Despesas pagas no período</span><strong>{formatCurrency(summary.expensePaid)}</strong></article>
        <article className="admin-card"><span>Saldo realizado</span><strong>{formatCurrency(summary.balance)}</strong></article>
        <article className="admin-card"><span>A receber</span><strong>{formatCurrency(summary.incomePending)}</strong></article>
        <article className="admin-card"><span>A pagar</span><strong>{formatCurrency(summary.expensePending)}</strong></article>
        <article className="admin-card"><span>Recebimentos administrados</span><strong>{formatCurrency(summary.managedIncome)}</strong></article>
        <article className="admin-card"><span>Repasses administrados</span><strong>{formatCurrency(summary.managedExpense)}</strong></article><article className="admin-card"><span>Receitas vencidas</span><strong>{formatCurrency(overview.overdue_income||0)}</strong></article><article className="admin-card"><span>Despesas vencidas</span><strong>{formatCurrency(overview.overdue_expense||0)}</strong></article>
      </div>

      <section className="admin-panel"><div className="panel-title-row"><div><span className="eyebrow">Configuração</span><h2>Contas e categorias</h2></div><div className="admin-page-actions"><button type="button" className="button secondary" onClick={addAccount}>Nova conta</button><button type="button" className="button secondary" onClick={addCategory}>Nova categoria</button></div></div><p>{summary.accounts.length} conta(s) ativa(s) · {categories.length} categoria(s) ativa(s).</p></section>

      <section className="admin-panel"><div className="panel-title-row"><div><span className="eyebrow">Automação</span><h2>Receitas e despesas recorrentes</h2></div><div className="admin-page-actions"><button type="button" className="button secondary" onClick={addRecurring}>Nova recorrência</button><button type="button" className="button" onClick={generateRecurring}>Gerar vencimentos</button></div></div>{recurring.length===0?<p>Nenhuma recorrência cadastrada.</p>:<div className="rental-contract-list">{recurring.map(item=><article className="rental-contract-card" key={item.id}><div><strong>{item.description}</strong><p>{FINANCE_DIRECTION_LABELS[item.direction]} · {item.frequency==='monthly'?'Mensal':item.frequency}</p><small>Próximo: {formatDate(item.next_due_date)}</small></div><div className="rental-contract-side"><strong>{formatCurrency(item.amount)}</strong><button type="button" className="button secondary" onClick={()=>removeRecurring(item.id)}>Excluir</button></div></article>)}</div>}</section>

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
          <h2>Lançamentos do período</h2>
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
                  <button type="button" className="button secondary" onClick={() => handleDelete(entry)}>Excluir</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
