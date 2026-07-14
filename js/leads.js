// ========== LEADS LOGIC & RENDERING MODULE ==========

function getVisibleLeads() {
  if (APP.currentRole === 'admin') return leads;
  if (APP.currentRole === 'tl') {
    const tl = getUser(APP.currentUserId);
    if (!tl) return [];
    return leads.filter(l => {
      const agent = getUser(l.assigned_agent_id);
      return agent && agent.team_id === tl.team_id;
    });
  }
  return leads.filter(l => l.assigned_agent_id === APP.currentUserId);
}

function getStatusBadgeClass(status) {
  return 'badge badge-' + status.replace('_', '-');
}

function getPriorityDot(priority) {
  return `<span class="priority-dot priority-${priority}" title="${priority}"></span>`;
}

function toggleLeadSelection(id, checked) {
  if (checked) {
    if (!selectedLeadIds.includes(id)) selectedLeadIds.push(id);
  } else {
    selectedLeadIds = selectedLeadIds.filter(lid => lid !== id);
  }
  renderPage();
}

function toggleAllLeads(checked) {
  const vl = getFilteredLeads();
  if (checked) {
    selectedLeadIds = vl.map(l => l.id || l._id);
  } else {
    selectedLeadIds = [];
  }
  renderPage();
}

async function bulkDeleteLeads() {
  if (selectedLeadIds.length === 0) return;
  showConfirmModal('Bulk Delete', `Are you sure you want to delete ${selectedLeadIds.length} leads?`, async () => {
    let successCount = 0;
    const total = selectedLeadIds.length;
    
    for (const id of selectedLeadIds) {
      try {
        await fetchAPI(`/leads/${id}`, { method: 'DELETE' });
        leads = leads.filter(l => l.id !== id && l._id !== id);
        callLogs = callLogs.filter(c => c.lead_id !== id);
        allocationHistory = allocationHistory.filter(al => al.lead_id !== id);
        successCount++;
      } catch (err) {
        console.error(`Failed to delete lead ${id}`, err);
      }
    }
    
    try {
      await fetchAPI('/settings/allocation_history', {
        method: 'POST',
        body: JSON.stringify({ value: allocationHistory })
      });
    } catch (saveErr) {
      console.error('Failed to save updated allocation history in bulk delete', saveErr);
    }
    
    toast(`Successfully deleted ${successCount} of ${total} leads`);
    selectedLeadIds = [];
    renderPage();
  });
}

function showBulkReassignModal() {
  if (selectedLeadIds.length === 0) return;
  const agents = getAssignableAgents();
  
  const html = `
    <div class="p-6 border-b border-surface-800 flex items-center justify-between">
      <h3 class="font-display font-bold text-lg text-white">Bulk Reassign Leads</h3>
      <button class="btn-ghost rounded-lg" onclick="closeModal('leadDetailModal')"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-6">
      <p class="text-white mb-4 font-medium">Reassigning ${selectedLeadIds.length} selected leads</p>
      
      <label class="block text-sm text-surface-400 mb-1.5">Assign to:</label>
      <select class="form-input mb-4" id="reassignSelect">
        <option value="">Unassigned</option>
        ${agents.map(a => `<option value="${a.id}">${a.name} (${getTeam(a.team_id)?.name})</option>`).join('')}
      </select>
      
      <div class="flex gap-3 mt-6">
        <button class="btn btn-primary flex-1" onclick="handleBulkReassign()">Apply Reassignment</button>
        <button class="btn btn-secondary flex-1" onclick="closeModal('leadDetailModal')">Cancel</button>
      </div>
    </div>
  `;
  
  const modal = document.getElementById('leadDetailModal');
  document.getElementById('leadDetailContent').innerHTML = html;
  modal.classList.add('show');
}

async function handleBulkReassign() {
  const agentId = document.getElementById('reassignSelect').value;
  let successCount = 0;
  const total = selectedLeadIds.length;
  
  for (const id of selectedLeadIds) {
    try {
      await fetchAPI(`/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          assigned_agent_id: agentId || null,
          assigned_at: agentId ? new Date().toISOString() : null
        })
      });
      
      const idx = leads.findIndex(l => l.id === id || l._id === id);
      if (idx !== -1) {
        leads[idx].assigned_agent_id = agentId || null;
        leads[idx].assigned_at = agentId ? new Date().toISOString() : null;
      }
      successCount++;
    } catch (err) {
      console.error(`Failed to reassign lead ${id}`, err);
    }
  }
  
  toast(`Successfully reassigned ${successCount} of ${total} leads`);
  closeModal('leadDetailModal');
  selectedLeadIds = [];
  renderPage();
}

function getFilteredLeads() {
  let vl = getVisibleLeads();

  // Global Search
  if (APP.searchQuery) {
    vl = vl.filter(l => l.name.toLowerCase().includes(APP.searchQuery) || l.phone.includes(APP.searchQuery) || l.city.toLowerCase().includes(APP.searchQuery) || l.email.toLowerCase().includes(APP.searchQuery));
  }

  // Local Search
  if (leadsFilter.search) {
    const q = leadsFilter.search.toLowerCase();
    vl = vl.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q));
  }

  // Filters
  if (leadsFilter.status.length > 0) vl = vl.filter(l => leadsFilter.status.includes(l.status));
  if (leadsFilter.loanType.length > 0) vl = vl.filter(l => leadsFilter.loanType.includes(l.loan_type));
  if (leadsFilter.source.length > 0) vl = vl.filter(l => leadsFilter.source.includes(l.source));
  if (leadsFilter.agent.length > 0 && (APP.currentRole === 'admin' || APP.currentRole === 'tl')) vl = vl.filter(l => leadsFilter.agent.includes(l.assigned_agent_id));
  
  if (leadsFilter.aging.length > 0) {
    const now = Date.now();
    vl = vl.filter(l => {
      if (!l.assigned_at) return false;
      const start = new Date(l.assigned_at).getTime();
      if (isNaN(start)) return false;
      const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      return leadsFilter.aging.includes(String(days));
    });
  }

  // Sort
  vl.sort((a, b) => {
    let va = a[leadsFilter.sort], vb = b[leadsFilter.sort];
    if (leadsFilter.sort === 'amount_requested') return leadsFilter.dir === 'asc' ? va - vb : vb - va;
    va = String(va); vb = String(vb);
    return leadsFilter.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  return vl;
}

function renderLeads() {
  const vl = getFilteredLeads();
  const allVisible = getVisibleLeads();
  const now = Date.now();
  const allSelected = vl.length > 0 && vl.every(l => selectedLeadIds.includes(l.id || l._id));
  
  const uniqueAgingDays = [...new Set(allVisible.map(l => {
    if (!l.assigned_at) return null;
    const start = new Date(l.assigned_at).getTime();
    if (isNaN(start)) return null;
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  }).filter(d => d !== null))].sort((a, b) => a - b);
  
  const canManage = APP.currentRole !== 'agent';
  const agents = APP.currentRole === 'admin' ? USERS.filter(u => u.role === 'agent' && u.active) : APP.currentRole === 'tl' ? USERS.filter(u => u.role === 'agent' && u.active && u.team_id === getUser(APP.currentUserId)?.team_id) : [];

  return `
    <div class="fade-in">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="font-display font-bold text-2xl text-white">Leads</h2>
          <p id="leadsCount" class="text-surface-400 text-sm mt-1">${vl.length} leads found ${selectedLeadIds.length > 0 ? `· <span class="text-brand-400 font-semibold">${selectedLeadIds.length} selected</span>` : ''}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${selectedLeadIds.length > 0 ? `
            <div class="flex flex-wrap items-center gap-2 bg-brand-900/20 border border-brand-800/30 p-1 rounded-lg px-2 mr-2">
              <span class="text-xs text-brand-300 font-medium mr-1">Bulk Actions:</span>
              <button class="btn btn-secondary btn-sm" onclick="exportLeadsCSV(true)"><i class="fas fa-download"></i> Export</button>
              ${canManage ? `
                <button class="btn btn-secondary btn-sm" onclick="showBulkReassignModal()"><i class="fas fa-exchange-alt"></i> Assign</button>
                <button class="btn btn-danger btn-sm" onclick="bulkDeleteLeads()"><i class="fas fa-trash"></i> Delete</button>
              ` : ''}
              <button class="btn-ghost btn-sm text-surface-400" onclick="selectedLeadIds=[];renderPage()">Cancel</button>
            </div>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="exportLeadsCSV()"><i class="fas fa-download"></i> Export CSV</button>
           <button class="btn btn-secondary btn-sm" onclick="downloadCSVTemplate()"><i class="fas fa-file-download"></i> Download Template</button>
           ${canManage ? `<button class="btn btn-secondary btn-sm" onclick="openModal('importModal')"><i class="fas fa-file-import"></i> Import CSV</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="showAddLeadModal()"><i class="fas fa-plus"></i> Add Lead</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-4">
        <div class="flex flex-wrap gap-3">
          <input type="text" class="form-input py-2 text-sm w-64" placeholder="Search name or phone..." value="${leadsFilter.search}" oninput="handleLeadsSearch(this.value)">
          
          ${renderMultiSelect('status', 'Status', [...new Set(leads.map(l => l.status || 'new'))].map(s => ({ value: s, label: STATUS_LABELS[s] || s })))}
          ${renderMultiSelect('loanType', 'Loan Type', [...new Set(leads.map(l => l.loan_type || 'personal'))].map(s => ({ value: s, label: LOAN_LABELS[s] || s })))}
          ${renderMultiSelect('source', 'Source', [...new Set(leads.map(l => l.source || 'website'))].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })))}
          
          ${canManage ? renderMultiSelect('agent', 'Agent', agents.map(a => ({ value: a.id, label: a.name }))) : ''}
          
          ${renderMultiSelect('aging', 'Aging', uniqueAgingDays.map(d => ({ value: String(d), label: `${d} Days` })))}

          <button class="btn btn-ghost btn-sm" onclick="leadsFilter={status:[],loanType:[],source:[],agent:[],aging:[],search:'',sort:'created_at',dir:'desc'};renderPage()"><i class="fas fa-times"></i> Clear</button>
        </div>
      </div>

      <!-- Table -->
      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead id="leadsTableHead">
              <tr>
                <th class="w-10">
                  <input type="checkbox" class="w-4 h-4 rounded border-surface-700 bg-surface-800 text-brand-500 focus:ring-brand-500/20" 
                    ${allSelected ? 'checked' : ''} onchange="toggleAllLeads(this.checked)">
                </th>
                <th class="cursor-pointer" onclick="toggleSort('name')">Name ${sortIcon('name')}</th>
                <th>Phone</th>
                <th>Email</th>
                <th class="cursor-pointer" onclick="toggleSort('loan_type')">Loan Type ${sortIcon('loan_type')}</th>
                <th class="cursor-pointer" onclick="toggleSort('amount_requested')">Amount ${sortIcon('amount_requested')}</th>
                <th class="cursor-pointer" onclick="toggleSort('status')">Status ${sortIcon('status')}</th>
                <th class="cursor-pointer" onclick="toggleSort('source')">Source ${sortIcon('source')}</th>
                ${canManage ? '<th>Agent</th>' : ''}
                <th>Aging</th>
                <th class="cursor-pointer" onclick="toggleSort('assigned_at')">Assigned Date ${sortIcon('assigned_at')}</th>
                <th class="cursor-pointer" onclick="toggleSort('created_at')">Created ${sortIcon('created_at')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="leadsTableBody">
              ${vl.length === 0 ? `<tr><td colspan="${canManage?13:12}" class="text-center py-12 text-surface-500">No leads found</td></tr>` :
              vl.map(l => renderLeadRow(l, canManage)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderLeadRow(l, canManage) {
  const isSelected = selectedLeadIds.includes(l.id || l._id);
  return `<tr class="${isSelected ? 'bg-brand-500/5' : ''}">
    <td>
      <input type="checkbox" class="w-4 h-4 rounded border-surface-700 bg-surface-800 text-brand-500 focus:ring-brand-500/20" 
        ${isSelected ? 'checked' : ''} onchange="toggleLeadSelection('${l.id || l._id}', this.checked)">
    </td>
    <td>
      <div class="flex items-center gap-2">
        ${getPriorityDot(l.priority)}
        <div>
          <p class="font-medium text-white">${l.name}</p>
          <p class="text-xs text-surface-500">${l.city}</p>
        </div>
      </div>
    </td>
    <td class="font-mono text-sm">${l.phone}</td>
    <td class="text-sm text-surface-400 max-w-[150px] truncate" title="${l.email || ''}">${l.email || '—'}</td>
    <td><span class="text-sm">${LOAN_LABELS[l.loan_type] || l.loan_type}</span></td>
    <td class="font-medium text-white">${formatCurrency(l.amount_requested)}</td>
    <td><span class="${getStatusBadgeClass(l.status || 'new')}">${STATUS_LABELS[l.status] || l.status || '—'}</span></td>
    <td class="text-sm text-surface-400">${l.source || '—'}</td>
    ${canManage ? `<td class="text-sm text-surface-400">${getUser(l.assigned_agent_id)?.name || 'Unassigned'}</td>` : ''}
    <td class="text-sm">
      <span class="text-surface-400">${getAging(l.assigned_at)}</span>
    </td>
    <td class="text-sm text-surface-400">${formatDate(l.assigned_at)}</td>
    <td class="text-sm text-surface-400">${formatDate(l.created_at)}</td>
    <td>
      <div class="flex gap-1">
        <button class="btn-ghost rounded text-xs text-blue-600" onclick="showLeadDetail('${l.id}')" title="View"><i class="fas fa-eye"></i></button>
        ${APP.currentRole !== 'agent' ? `<button class="btn-ghost rounded text-xs text-red-600" onclick="showEditLeadModal('${l.id}')" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
        <button class="btn-ghost rounded text-xs text-brand-400" onclick="showCallLogModal('${l.id}')" title="Log Call"><i class="fas fa-phone-alt"></i></button>
        ${canManage ? `<button class="btn-ghost rounded text-xs text-amber-400" onclick="showReassignModal('${l.id}')" title="Reassign"><i class="fas fa-exchange-alt"></i></button>` : ''}
      </div>
    </td>
  </tr>`;
}

function handleLeadsSearch(val) {
  leadsFilter.search = val;
  const vl = getFilteredLeads();
  const canManage = APP.currentRole !== 'agent';
  
  const countEl = document.getElementById('leadsCount');
  if (countEl) countEl.textContent = `${vl.length} leads found`;
  
  const tbody = document.getElementById('leadsTableBody');
  if (tbody) {
    tbody.innerHTML = vl.length === 0 ? `<tr><td colspan="${canManage?13:12}" class="text-center py-12 text-surface-500">No leads found</td></tr>` :
    vl.map(l => renderLeadRow(l, canManage)).join('');
  }
}

function renderMultiSelect(key, label, options) {
  const selected = leadsFilter[key];
  const labelText = selected.length === 0 ? `All ${label}s` : selected.length === 1 ? options.find(o => o.value === selected[0])?.label : `${selected.length} ${label}s`;
  
  return `
    <div class="relative group">
      <button class="form-input py-2 text-sm w-auto flex items-center justify-between gap-2 min-w-[140px] text-left">
        <span class="truncate">${labelText}</span>
        <i class="fas fa-chevron-down text-[10px] opacity-50"></i>
      </button>
      <div class="absolute left-0 top-full mt-1 w-56 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 hidden group-hover:block max-h-64 overflow-y-auto p-1">
        <div class="p-2 border-b border-surface-700 flex justify-between items-center">
          <span class="text-xs font-bold text-surface-500 uppercase tracking-wider">${label}</span>
          ${selected.length > 0 ? `<button class="text-[10px] text-brand-400 hover:underline" onclick="leadsFilter['${key}']=[];renderPage()">Clear</button>` : ''}
        </div>
        <div class="py-1">
          ${options.map(o => `
            <label class="flex items-center px-3 py-2 hover:bg-surface-700 rounded cursor-pointer transition-colors">
              <input type="checkbox" class="rounded border-surface-600 text-brand-600 focus:ring-brand-500/20 bg-surface-900" 
                ${selected.includes(o.value) ? 'checked' : ''} 
                onchange="toggleFilterValue('${key}', '${o.value}')">
              <span class="ml-2 text-sm text-surface-200">${o.label}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleFilterValue(key, value) {
  const idx = leadsFilter[key].indexOf(value);
  if (idx === -1) {
    leadsFilter[key].push(value);
  } else {
    leadsFilter[key].splice(idx, 1);
  }
  renderPage();
}

function sortIcon(field) {
  if (leadsFilter.sort !== field) return '<i class="fas fa-sort text-surface-600 ml-1 text-[10px]"></i>';
  return leadsFilter.dir === 'asc' ? '<i class="fas fa-sort-up text-brand-400 ml-1 text-[10px]"></i>' : '<i class="fas fa-sort-down text-brand-400 ml-1 text-[10px]"></i>';
}

function toggleSort(field) {
  if (leadsFilter.sort === field) leadsFilter.dir = leadsFilter.dir === 'asc' ? 'desc' : 'asc';
  else { leadsFilter.sort = field; leadsFilter.dir = 'asc'; }
  renderPage();
}

function downloadCSVTemplate() {
  const templateCSV = `Name,Phone,Email,City,Loan Type,Amount,Source,Status
Aarav Sharma,9876543210,aarav.sharma@email.com,Mumbai,Home Loan,5000000,Facebook,New
Priya Patel,9123456789,priya.patel@email.com,Delhi,Personal Loan,200000,Website,New
Rohan Gupta,9988776655,rohan.gupta@email.com,Bangalore,Car Loan,800000,Referral,New
Sneha Singh,9876501234,sneha.singh@email.com,Hyderabad,Business Loan,1500000,Website,New
Amit Verma,9112233445,amit.verma@email.com,Chennai,Home Loan,3000000,Google,New
Megha Reddy,9001122334,megha.reddy@email.com,Pune,Personal Loan,500000,Facebook,New
Vikram Iyer,9887766554,vikram.iyer@email.com,Kolkata,Education Loan,1000000,Website,New
Anjali Das,9776655443,anjali.das@email.com,Ahmedabad,Car Loan,700000,Google,New
Rahul Kumar,9665544332,rahul.kumar@email.com,Jaipur,Personal Loan,300000,Referral,New
Sonia Rao,9554433221,sonia.rao@email.com,Lucknow,Home Loan,4000000,Facebook,New`;

  const blob = new Blob([templateCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'leads_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function exportLeadsCSV(selectedOnly = false) {
  const vl = selectedOnly ? leads.filter(l => selectedLeadIds.includes(l.id || l._id)) : getFilteredLeads();
  let csv = 'Name,Phone,Email,City,Loan Type,Amount,Source,Status,Agent,Aging,Assigned At,Created At\n';
  vl.forEach(l => {
    const escapedName = (l.name || '').replace(/"/g, '""');
    const escapedPhone = (l.phone || '').replace(/"/g, '""');
    const escapedEmail = (l.email || '').replace(/"/g, '""');
    const escapedCity = (l.city || '').replace(/"/g, '""');
    const escapedLoanType = (LOAN_LABELS[l.loan_type] || l.loan_type || '').replace(/"/g, '""');
    const escapedAmount = l.amount_requested || 0;
    const escapedSource = (l.source || '').replace(/"/g, '""');
    const escapedStatus = (STATUS_LABELS[l.status] || l.status || '').replace(/"/g, '""');
    const escapedAgentName = (getUser(l.assigned_agent_id)?.name || '').replace(/"/g, '""');
    const aging = getAging(l.assigned_at);
    const assignedAt = formatDate(l.assigned_at);
    const createdAt = formatDate(l.created_at);
    
    csv += `"${escapedName}","${escapedPhone}","${escapedEmail}","${escapedCity}","${escapedLoanType}","${escapedAmount}","${escapedSource}","${escapedStatus}","${escapedAgentName}","${aging}","${assignedAt}","${createdAt}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'paisaneed_leads_export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('CSV exported successfully');
}
