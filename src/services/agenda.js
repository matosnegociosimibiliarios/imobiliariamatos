import { supabase } from '../lib/supabase';

export async function getAgendaData() {
  const [tasks, appointments] = await Promise.all([
    supabase.from('crm_tasks').select('*').order('due_at',{ascending:true}),
    supabase.from('appointments').select('*,lead:leads(id,name,whatsapp),property:properties(id,code,title)').not('status','in','("completed","cancelled","no_show")').order('scheduled_at',{ascending:true,nullsFirst:false}),
  ]);
  return { data:{tasks:tasks.data||[],appointments:appointments.data||[]}, error:tasks.error||appointments.error||null };
}
export async function createTask(payload) {
  return supabase.from('crm_tasks').insert(payload).select().single();
}
export async function updateTask(id,payload) {
  return supabase.from('crm_tasks').update(payload).eq('id',id).select().single();
}
export async function deleteTask(id) {
  return supabase.from('crm_tasks').delete().eq('id',id);
}
