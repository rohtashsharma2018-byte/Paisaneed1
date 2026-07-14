// ========== TEAM MANAGEMENT MODULE ==========

function renderTeam() {
  let usersToShow;
  if (APP.currentRole === 'admin') usersToShow = USERS.filter(u => u.id !== APP.currentUserId);
  else {
    const tl = getUser(APP.currentUserId);
    if (!tl) usersToShow = [];
    else usersToShow = USERS.filter(u => u.team_id === tl.team_id);
  }

  const filterRole = APP.teamRoleFilter || 'all';
  if (filterRole === 'tl') {
    usersToShow = usersToShow.filter(u => u.role === 'tl');
  } else if (filterRole === 'agent') {
    usersToShow = usersToShow.filter(u => u.role === 'agent');
  }

  const isListMode = APP.teamViewMode === 'list';

  const viewContent = isListMode ? `
    <div class="card p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Team</th>
              <th>Email</th>
              <th>Leads Assigned</th>
              <th>Calls Logged</th>
              <th>Won Leads</th>
              <th>Status</th>
              ${APP.currentRole === 'admin' ? '<th class="text-right">Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${usersToShow.map(u => {
              const uLeads = leads.filter(l => l.assigned_agent_id === u.id);
              const uConverted = uLeads.filter(l => l.status === 'disbursed').length;
              const uCalls = new Set(callLogs.filter(c => c.agent_id === u.id).map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;
              const team = getTeam(u.team_id);
              return `
                <tr>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-full ${u.active ? 'bg-brand-600/20 text-brand-400' : 'bg-surface-800 text-surface-500'} flex items-center justify-center text-xs font-bold">
                        ${u.name.charAt(0)}
                      </div>
                      <span class="font-medium text-white">${u.name}</span>
                    </div>
                  </td>
                  <td class="capitalize text-sm">
                    ${u.role === 'tl' ? '<span class="badge badge-interested">Team Leader</span>' : '<span class="badge badge-documents-pending">Agent</span>'}
                  </td>
                  <td class="text-surface-400 text-sm">${team ? team.name : '—'}</td>
                  <td class="text-surface-400 text-sm">${u.email}</td>
                  <td class="text-white text-sm font-semibold">${uLeads.length}</td>
                  <td class="text-white text-sm font-semibold">${uCalls}</td>
                  <td class="text-white text-sm font-semibold">${uConverted}</td>
                  <td>
                    <span class="badge ${u.active ? 'badge-new' : 'badge-dead'}">${u.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  ${APP.currentRole === 'admin' ? `
                  <td class="text-right">
                    <div class="flex gap-1 justify-end">
                      <button class="btn btn-ghost btn-sm text-xs" onclick="showEditMemberModal('${u.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-ghost btn-sm text-xs ${u.active ? 'text-amber-400' : 'text-brand-400'}" onclick="toggleUserActive('${u.id}')" title="${u.active ? 'Deactivate' : 'Activate'}">${u.active ? '<i class="fas fa-ban"></i>' : '<i class="fas fa-check"></i>'}</button>
                      <button class="btn btn-ghost btn-sm text-xs text-rose-400" onclick="deleteMember('${u.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                  </td>` : ''}
                </tr>
              `;
            }).join('')}
            ${usersToShow.length === 0 ? `<tr><td colspan="${APP.currentRole === 'admin' ? 9 : 8}" class="text-center py-12 text-surface-500">No members found</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  ` : `
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${usersToShow.map(u => {
        const uLeads = leads.filter(l => l.assigned_agent_id === u.id);
        const uConverted = uLeads.filter(l => l.status === 'disbursed').length;
        const uCalls = new Set(callLogs.filter(c => c.agent_id === u.id).map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;
        const team = getTeam(u.team_id);
        return `
          <div class="card">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-full ${u.active ? 'bg-brand-600/20' : 'bg-surface-800'} flex items-center justify-center flex-shrink-0">
                <span class="text-lg font-bold ${u.active ? 'text-brand-400' : 'text-surface-500'}">${u.name.charAt(0)}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-semibold text-white">${u.name}</p>
                  ${!u.active ? '<span class="badge badge-dead">Inactive</span>' : ''}
                </div>
                <p class="text-xs text-surface-500 capitalize">${u.role === 'tl' ? 'Team Leader' : 'Agent'} ${team ? '— ' + team.name : ''}</p>
                <p class="text-xs text-surface-500 mt-0.5">${u.email}</p>
                <div class="grid grid-cols-3 gap-2 mt-3">
                  <div class="bg-surface-800/50 rounded-lg p-2 text-center">
                    <p class="text-lg font-bold text-white">${uLeads.length}</p>
                    <p class="text-[10px] text-surface-500">Leads</p>
                  </div>
                  <div class="bg-surface-800/50 rounded-lg p-2 text-center">
                    <p class="text-lg font-bold text-white">${uCalls}</p>
                    <p class="text-[10px] text-surface-500">Calls</p>
                  </div>
                  <div class="bg-surface-800/50 rounded-lg p-2 text-center">
                    <p class="text-lg font-bold text-white">${uConverted}</p>
                    <p class="text-[10px] text-white uppercase tracking-wider">Won</p>
                  </div>
                </div>
              </div>
            </div>
            ${APP.currentRole === 'admin' ? `<div class="mt-3 pt-3 border-t border-surface-800 flex gap-2">
              <button class="btn btn-ghost btn-sm text-xs" onclick="showEditMemberModal('${u.id}')"><i class="fas fa-edit"></i> Edit</button>
              <button class="btn btn-ghost btn-sm text-xs ${u.active ? 'text-amber-400' : 'text-brand-400'}" onclick="toggleUserActive('${u.id}')">${u.active ? '<i class="fas fa-ban"></i> Deactivate' : '<i class="fas fa-check"></i> Activate'}</button>
              <button class="btn btn-ghost btn-sm text-xs text-rose-400 ml-auto" onclick="deleteMember('${u.id}')"><i class="fas fa-trash"></i></button>
            </div>` : ''}
          </div>
        `;
      }).join('')}
      ${usersToShow.length === 0 ? '<div class="col-span-full card text-center py-16 text-surface-500"><i class="fas fa-users-slash text-4xl mb-3 text-brand-400"></i><p>No members found in this category.</p></div>' : ''}
    </div>
  `;

  const teamsToAggregate = APP.currentRole === 'admin' 
    ? TEAMS 
    : TEAMS.filter(t => {
        const tl = getUser(APP.currentUserId);
        const tId = t.id;
        const tlTid = tl && tl.team_id && typeof tl.team_id === 'object' ? (tl.team_id._id || tl.team_id.id) : (tl ? tl.team_id : null);
        return tId === tlTid;
      });

  return `
    <div class="fade-in">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="font-display font-bold text-2xl text-white">Team Management</h2>
          <p class="text-surface-400 text-sm mt-1">${usersToShow.length} members</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="hidden sm:flex bg-surface-900 border border-surface-800 rounded-lg p-1 text-xs gap-1">
            <button onclick="filterTeamRole('all', event)" class="px-2.5 py-1 rounded transition-colors ${filterRole === 'all' ? 'bg-brand-600/20 text-brand-400 font-semibold' : 'text-surface-400 hover:text-white'}">All</button>
            <button onclick="filterTeamRole('tl', event)" class="px-2.5 py-1 rounded transition-colors ${filterRole === 'tl' ? 'bg-brand-600/20 text-brand-400 font-semibold' : 'text-surface-400 hover:text-white'}">Leaders</button>
            <button onclick="filterTeamRole('agent', event)" class="px-2.5 py-1 rounded transition-colors ${filterRole === 'agent' ? 'bg-brand-600/20 text-brand-400 font-semibold' : 'text-surface-400 hover:text-white'}">Agents</button>
          </div>
          <div class="hidden sm:flex bg-surface-900 border border-surface-800 rounded-lg p-1 text-xs gap-1">
            <button onclick="setTeamView('gallery', event)" class="p-1 px-2 rounded transition-colors ${!isListMode ? 'bg-surface-800 text-brand-400' : 'text-surface-500 hover:text-white'}" title="Gallery View"><i class="fas fa-th-large"></i></button>
            <button onclick="setTeamView('list', event)" class="p-1 px-2 rounded transition-colors ${isListMode ? 'bg-surface-800 text-brand-400' : 'text-surface-500 hover:text-white'}" title="List View"><i class="fas fa-list"></i></button>
          </div>
          ${APP.currentRole === 'admin' ? '<button class="btn btn-primary btn-sm" onclick="showAddMemberModal()"><i class="fas fa-plus"></i> Add Member</button>' : ''}
        </div>
      </div>
      ${viewContent}
    </div>
  `;
}

function filterTeamRole(role, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  APP.teamRoleFilter = role;
  
  // Update styling of submenu items
  ['all', 'tl', 'agent'].forEach(r => {
    const btn = document.getElementById(`sub_${r}`);
    if (btn) {
      if (r === role) {
        btn.className = "flex items-center gap-2 py-1.5 px-3 rounded-md transition-all text-left font-medium text-brand-400 bg-brand-500/10";
      } else {
        btn.className = "flex items-center gap-2 py-1.5 px-3 rounded-md transition-all text-left font-medium text-surface-400 hover:text-white";
      }
    }
  });

  renderPage();
}

function setTeamView(view, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  APP.teamViewMode = view;

  // Update styling of view buttons
  const btnGallery = document.getElementById('sub_view_gallery');
  const btnList = document.getElementById('sub_view_list');
  if (btnGallery && btnList) {
    if (view === 'gallery') {
      btnGallery.className = "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md transition-all font-medium text-brand-400 bg-brand-500/10 text-[11px]";
      btnList.className = "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md transition-all font-medium text-surface-400 hover:text-white bg-surface-800/40 hover:bg-surface-800/70 text-[11px]";
    } else {
      btnGallery.className = "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md transition-all font-medium text-surface-400 hover:text-white bg-surface-800/40 hover:bg-surface-800/70 text-[11px]";
      btnList.className = "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md transition-all font-medium text-brand-400 bg-brand-500/10 text-[11px]";
    }
  }

  renderPage();
}

async function toggleUserActive(userId) {
  const user = getUser(userId);
  if (!user) return;
  
  try {
    const newStatus = !user.active;
    await fetchAPI(`/users/${userId}`, { method: 'PUT', body: JSON.stringify({ active: newStatus }) });
    user.active = newStatus;
    toast(`${user.name} ${user.active ? 'activated' : 'deactivated'}`);
    renderPage();
  } catch (err) {
    // Error handled by fetchAPI
  }
}

async function deleteMember(userId) {
  if (userId === APP.currentUserId) {
    toast('Cannot delete yourself', 'error');
    return;
  }

  showConfirmModal('Delete Member', 'Are you sure you want to delete this member? This action cannot be undone.', async () => {
    try {
      await fetchAPI(`/users/${userId}`, { method: 'DELETE' });
      toast('Member deleted successfully');
      
      // Refresh users
      const usersData = await fetchAPI('/users');
      USERS = (usersData || []).map(u => ({ ...u, id: u._id }));
      
      renderPage();
    } catch (err) {
      // Error handled by fetchAPI
    }
  });
}
