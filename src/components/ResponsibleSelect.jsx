import React, { useEffect, useState } from 'react';
import { assignRecord, getAssignableMembers } from '../services/team';

export default function ResponsibleSelect({ table, recordId, value, onChange, disabled = false, compact = false }) {
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getAssignableMembers();
      if (active && !result.error) setMembers(result.data || []);
    })();
    return () => { active = false; };
  }, []);

  async function change(event) {
    const next = event.target.value || null;
    setSaving(true);
    setMessage('');
    const result = await assignRecord(table, recordId, next);
    if (result.error) {
      setMessage('Não foi possível alterar o responsável.');
    } else {
      onChange?.(next, result.data);
      setMessage('Responsável atualizado.');
    }
    setSaving(false);
  }

  return (
    <div className={`responsible-select ${compact ? 'compact' : ''}`}>
      {!compact && <span>Responsável</span>}
      <select value={value || ''} onChange={change} disabled={disabled || saving} aria-label="Responsável">
        <option value="">Sem responsável</option>
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.profile?.full_name || member.profile?.email || 'Usuário'}
          </option>
        ))}
      </select>
      {message && !compact && <small>{message}</small>}
    </div>
  );
}
