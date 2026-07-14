// ========== ALLOCATIONS MODULE ==========

function renderAllocations() {
  const recentAllocs = [...allocationHistory].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);

  // Unassigned leads (if any)
  const unassigned = leads.filter(l => !l.assigned_agent_id);

  return `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-display font-bold text-2xl text-white">Allocations</h2>
          <p class="text-surface-400 text-sm mt-1">Allocation history and lead distribution</p>
        </div>
        ${unassigned.length > 0 ? `<button class="btn btn-primary btn-sm" onclick="autoAllocateLeads()"><i class="fas fa-magic"></i> Auto-allocate ${unassigned.length} unassigned</button>` : ''}
      </div>

      ${unassigned.length > 0 ? `
        <div class="card mb-4 border-amber-600/30">
          <h3 class="font-display font-semibold text-amber-400 mb-3"><i class="fas fa-exclamation-triangle mr-2"></i>Unassigned Leads (${unassigned.length})</h3>
          <div class="space-y-2">
            ${unassigned.map(l => `
              <div class="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                <div>
                  <span class="text-white font-medium">${l.name}</span>
                  <span class="text-surface-500 text-sm ml-2">${l.phone} — ${LOAN_LABELS[l.loan_type] || l.loan_type}</span>
                </div>
                <select class="form-input py-1.5 text-sm w-auto" onchange="reassignLead('${l.id}', this.value)">
                  <option value="">Assign to...</option>
                  ${getAssignableAgents().map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Agent load balance -->
      <div class="card mb-4">
        <h3 class="font-display font-bold text-white mb-4">Agent Load Balance</h3>
        <div class="space-y-3">
          ${getAssignableAgents().map(a => {
            const count = leads.filter(l => {
              const assignedId = l.assigned_agent_id && typeof l.assigned_agent_id === 'object' ? (l.assigned_agent_id._id || l.assigned_agent_id.id) : l.assigned_agent_id;
              return assignedId === a.id && !['disbursed','rejected','dead','not_interested'].includes(l.status);
            }).length;
            const max = 15;
            const pct = Math.min(100, (count / max) * 100);
            return `
              <div class="flex items-center gap-4">
                <span class="text-sm text-white w-32 truncate">${a.name}</span>
                <div class="flex-1 h-3 bg-surface-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all ${pct > 80 ? 'bg-rose-500' : pct > 50 ? 'bg-amber-500' : 'bg-brand-500'}" style="width:${pct}%"></div>
                </div>
                <span class="text-sm text-surface-400 w-16 text-right">${count} leads</span>
              </div>
            `;
          }).join('')}
          ${getAssignableAgents().length === 0 ? `<div class="text-sm text-surface-500 text-center py-4">No assignable agents found</div>` : ''}
        </div>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Lead</th><th>From</th><th>To</th><th>Allocated By</th><th>Date</th></tr></thead>
            <tbody>
              ${recentAllocs.map(al => {
                const lead = leads.find(l => l.id === al.lead_id || l._id === al.lead_id);
                const to = getUser(al.to_user_id);
                const by = getUser(al.allocated_by);
                return `<tr>
                  <td class="text-white font-medium">${lead?.name || 'Unknown'}</td>
                  <td class="text-surface-400">${al.from_user_id ? getUser(al.from_user_id)?.name || 'Unknown' : '—'}</td>
                  <td class="text-white">${to?.name || 'Unknown'}</td>
                  <td class="text-surface-400">${by?.name || 'System'}</td>
                  <td class="text-surface-400 text-sm">${formatDateTime(al.created_at)}</td>
                </tr>`;
              }).join('')}
              ${recentAllocs.length === 0 ? `<tr><td colspan="5" class="text-center py-8 text-surface-500">No allocation history found</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function getAssignableAgents() {
  if (APP.currentRole === 'admin') return USERS.filter(u => u.role === 'agent' && u.active);
  const tl = getUser(APP.currentUserId);
  if (!tl) return [];
  const tlTeamId = tl.team_id && typeof tl.team_id === 'object' ? (tl.team_id._id || tl.team_id.id) : tl.team_id;
  return USERS.filter(u => {
    const uTeamId = u.team_id && typeof u.team_id === 'object' ? (u.team_id._id || u.team_id.id) : u.team_id;
    return u.role === 'agent' && u.active && uTeamId === tlTeamId;
  });
}

async function addAllocationEvent(leadId, fromUserId, toUserId) {
  const newEvent = {
    id: 'a' + Date.now() + Math.random().toString(36).substr(2, 4),
    lead_id: leadId,
    from_user_id: fromUserId || null,
    to_user_id: toUserId,
    allocated_by: APP.currentUserId || 'System',
    created_at: new Date().toISOString()
  };
  allocationHistory.push(newEvent);
  try {
    await fetchAPI('/settings/allocation_history', {
      method: 'POST',
      body: JSON.stringify({ value: allocationHistory })
    });
  } catch (err) {
    console.error('Failed to save allocation history', err);
  }
}

async function reassignLead(leadId, newAgentId) {
  if (!newAgentId) return;
  const lead = leads.find(l => l.id === leadId || l._id === leadId);
  if (!lead) return;

  const oldAgentId = lead.assigned_agent_id && typeof lead.assigned_agent_id === 'object' ? (lead.assigned_agent_id._id || lead.assigned_agent_id.id) : lead.assigned_agent_id;

  try {
    await fetchAPI(`/leads/${leadId || lead._id}`, {
      method: 'PUT',
      body: JSON.stringify({ assigned_agent_id: newAgentId })
    });
    
    // Refresh leads
    const leadsData = await fetchAPI('/leads');
    setLeads(leadsData);
    
    // Log allocation
    await addAllocationEvent(leadId || lead._id, oldAgentId, newAgentId);
    
    toast(`Lead reassigned to ${getUser(newAgentId).name}`);
    renderPage();
    updateUserUI();
  } catch (err) {
    // Error handled by fetchAPI
  }
}

async function autoAllocateLeads() {
  const unassigned = leads.filter(l => !l.assigned_agent_id);
  const agents = getAssignableAgents();
  if (agents.length === 0) { toast('No active agents available', 'error'); return; }
  let idx = 0;
  for (const l of unassigned) {
    const agent = agents[idx % agents.length];
    await reassignLead(l.id, agent.id);
    idx++;
  }
  toast(`${unassigned.length} leads auto-allocated (round-robin)`);
  renderPage();
}
