import React,{useEffect,useMemo,useState} from 'react';
import { Link } from 'react-router-dom';
import { createTask,deleteTask,getAgendaData,updateTask } from '../../services/agenda';
import { formatDateTime } from '../../services/crm';

function appointmentAt(item){ if(item.scheduled_at)return item.scheduled_at; if(item.requested_date)return `${item.requested_date}T${item.requested_time||'09:00'}`; return null; }
export default function AdminAgenda(){
 const [data,setData]=useState({tasks:[],appointments:[]}),[loading,setLoading]=useState(true),[filter,setFilter]=useState('open');
 async function load(){setLoading(true);const r=await getAgendaData();setData(r.data||{tasks:[],appointments:[]});setLoading(false);}
 useEffect(()=>{load();},[]);
 const items=useMemo(()=>[
  ...data.tasks.map(x=>({...x,kind:'task',at:x.due_at,label:x.title})),
  ...data.appointments.map(x=>({...x,kind:'appointment',at:appointmentAt(x),label:`Visita — ${x.lead?.name||'Cliente'}`}))
 ].filter(x=>x.at).sort((a,b)=>new Date(a.at)-new Date(b.at)),[data]);
 const now=new Date(),today=new Date(); today.setHours(0,0,0,0); const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);const week=new Date(today);week.setDate(week.getDate()+8);
 const visible=items.filter(x=>{if(filter==='all')return true;if(filter==='overdue')return new Date(x.at)<now && (x.kind!=='task'||x.status==='pending');if(filter==='today')return new Date(x.at)>=today&&new Date(x.at)<tomorrow;if(filter==='week')return new Date(x.at)>=tomorrow&&new Date(x.at)<week;if(filter==='done')return x.kind==='task'&&x.status==='completed';return x.kind!=='task'||x.status==='pending';});
 async function add(){const title=window.prompt('Qual é a tarefa?');if(!title?.trim())return;const due=window.prompt('Data e hora (ex.: 01/10/2026 14:30)');if(!due)return;const m=due.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);if(!m){window.alert('Use o formato DD/MM/AAAA HH:MM.');return;}const iso=new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`).toISOString();const r=await createTask({title:title.trim(),due_at:iso});if(r.error)window.alert(r.error.message||'Não foi possível criar.');else load();}
 async function done(item){await updateTask(item.id,{status:item.status==='completed'?'pending':'completed'});load();}
 async function remove(item){if(!window.confirm('Excluir esta tarefa?'))return;await deleteTask(item.id);load();}
 const counts={overdue:items.filter(x=>new Date(x.at)<now&&(x.kind!=='task'||x.status==='pending')).length,today:items.filter(x=>new Date(x.at)>=today&&new Date(x.at)<tomorrow).length,week:items.filter(x=>new Date(x.at)>=tomorrow&&new Date(x.at)<week).length};
 return <div className="admin-page"><div className="admin-page-header"><div><span className="eyebrow">Organização do trabalho</span><h1>Agenda e Tarefas</h1><p>Visitas, compromissos e tarefas em um único lugar.</p></div><button className="button" onClick={add}>Nova tarefa</button></div>
 <div className="admin-stats"><article className="admin-stat-card"><span>Atrasados</span><strong>{counts.overdue}</strong></article><article className="admin-stat-card"><span>Hoje</span><strong>{counts.today}</strong></article><article className="admin-stat-card"><span>Próximos 7 dias</span><strong>{counts.week}</strong></article></div>
 <section className="admin-panel"><div className="admin-actions"><button onClick={()=>setFilter('open')}>Em aberto</button><button onClick={()=>setFilter('today')}>Hoje</button><button onClick={()=>setFilter('overdue')}>Atrasados</button><button onClick={()=>setFilter('week')}>7 dias</button><button onClick={()=>setFilter('done')}>Concluídas</button><button onClick={()=>setFilter('all')}>Tudo</button></div>
 {loading?<p>Carregando...</p>:visible.length===0?<div className="admin-empty"><h2>Nada para mostrar</h2><p>Sua agenda está organizada neste período.</p></div>:<div className="metric-list">{visible.map(item=><div key={`${item.kind}-${item.id}`} style={{alignItems:'center',gap:12}}><span><strong>{item.label}</strong><small>{item.kind==='appointment'?(item.property?`${item.property.code} — ${item.property.title}`:'Visita'):(item.description||'Tarefa')}</small></span><b>{formatDateTime(item.at)}</b><span className="admin-actions">{item.kind==='task'?<><button onClick={()=>done(item)}>{item.status==='completed'?'Reabrir':'Concluir'}</button><button className="secondary" onClick={()=>remove(item)}>Excluir</button></>:item.lead?.id?<Link to={`/admin/leads/${item.lead.id}`}>Cliente</Link>:null}</span></div>)}</div>}
 </section></div>;
}