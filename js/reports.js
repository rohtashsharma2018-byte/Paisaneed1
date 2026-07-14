// ========== REPORTS MODULE ==========

function setReportsDateRange(val) { REPORTS_FILTER.dateRange = val; renderPage(); }
function setReportsTeam(val) { REPORTS_FILTER.teamId = val; renderPage(); }
function setReportsAgent(val) { REPORTS_FILTER.agentId = val; renderPage(); }
function clearReportsFilter() {
  REPORTS_FILTER = { dateRange: 'all_time', teamId: 'all', agentId: 'all', startDate: '', endDate: '' };
  renderPage();
}

function renderReports() {
  const isManager = APP.currentRole === 'admin' || APP.currentRole === 'tl';
  
  // Date filtering
  const now = new Date();
  let startDate = new Date(0); // all_time
  let endDate = new Date();
  
  if (REPORTS_FILTER.dateRange === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (REPORTS_FILTER.dateRange === 'this_week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startDate = new Date(now.setDate(diff));
    startDate.setHours(0,0,0,0);
  } else if (REPORTS_FILTER.dateRange === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (REPORTS_FILTER.dateRange === 'custom') {
    if (REPORTS_FILTER.startDate) startDate = new Date(REPORTS_FILTER.startDate);
    if (REPORTS_FILTER.endDate) {
      endDate = new Date(REPORTS_FILTER.endDate);
      endDate.setHours(23,59,59,999);
    }
  }

  // Team & Agent Filtering
  let agentIds = [];
  if (APP.currentRole === 'agent') {
    agentIds = [APP.currentUserId];
  } else {
    let availableAgents = USERS.filter(u => u.role === 'agent' && u.active);
    if (APP.currentRole === 'tl') {
      const myTeam = getUser(APP.currentUserId)?.team_id;
      const teamId = typeof myTeam === 'object' ? (myTeam._id || myTeam.id) : myTeam;
      availableAgents = availableAgents.filter(u => {
        const uTeam = typeof u.team_id === 'object' ? (u.team_id._id || u.team_id.id) : u.team_id;
        return uTeam === teamId;
      });
    }
    if (REPORTS_FILTER.teamId !== 'all') {
      availableAgents = availableAgents.filter(u => {
        const uTeam = typeof u.team_id === 'object' ? (u.team_id._id || u.team_id.id) : u.team_id;
        return uTeam === REPORTS_FILTER.teamId;
      });
    }
    if (REPORTS_FILTER.agentId !== 'all') {
      availableAgents = availableAgents.filter(u => u.id === REPORTS_FILTER.agentId);
    }
    agentIds = availableAgents.map(u => u.id);
  }

  // Filter Leads
  let filteredLeads = leads.filter(l => agentIds.includes(l.assigned_agent_id));
  filteredLeads = filteredLeads.filter(l => {
    const d = new Date(l.created_at);
    return d >= startDate && d <= endDate;
  });

  // Filter CallLogs
  let filteredCallLogs = callLogs.filter(c => agentIds.includes(c.agent_id));
  filteredCallLogs = filteredCallLogs.filter(c => {
    const d = new Date(c.created_at);
    return d >= startDate && d <= endDate;
  });

  // KPIs
  const totalLeads = filteredLeads.length;
  const disbursedLeads = filteredLeads.filter(l => l.status === 'disbursed');
  const disbursedCount = disbursedLeads.length;
  const totalLoanAmount = disbursedLeads.reduce((sum, l) => sum + (Number(l.amount_requested) || 0), 0);
  const conversionRate = totalLeads > 0 ? ((disbursedCount / totalLeads) * 100).toFixed(1) : 0;
  
  // Total calls made (unique leads per day per agent calculation)
  const totalCallsMade = new Set(filteredCallLogs.map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;

  let totalTargetAmt = 0;
  if (APP.currentRole === 'agent') {
    totalTargetAmt = TARGETS.agents[APP.currentUserId] || 0;
  } else if (REPORTS_FILTER.agentId !== 'all') {
    totalTargetAmt = TARGETS.agents[REPORTS_FILTER.agentId] || 0;
  } else if (REPORTS_FILTER.teamId !== 'all') {
    totalTargetAmt = TARGETS.teams[REPORTS_FILTER.teamId] || 0;
  } else if (APP.currentRole === 'tl') {
    const myTeam = getUser(APP.currentUserId)?.team_id;
    const teamId = typeof myTeam === 'object' ? (myTeam._id || myTeam.id) : myTeam;
    totalTargetAmt = TARGETS.teams[teamId] || 0;
  } else {
    totalTargetAmt = Object.values(TARGETS.teams || {}).reduce((sum, v) => sum + (Number(v)||0), 0);
  }
  const totalTargetPct = totalTargetAmt > 0 ? ((totalLoanAmount / totalTargetAmt) * 100).toFixed(1) : 0;


  // Render Filters UI options
  const teams = TEAMS;
  let availableAgents = USERS.filter(u => u.role === 'agent' && u.active);
  if (APP.currentRole === 'tl') {
    const myTeam = getUser(APP.currentUserId)?.team_id;
    const teamId = typeof myTeam === 'object' ? (myTeam._id || myTeam.id) : myTeam;
    availableAgents = availableAgents.filter(u => {
      const uTeam = typeof u.team_id === 'object' ? (u.team_id._id || u.team_id.id) : u.team_id;
      return uTeam === teamId;
    });
  }
  if (REPORTS_FILTER.teamId !== 'all') {
    availableAgents = availableAgents.filter(u => {
      const uTeam = typeof u.team_id === 'object' ? (u.team_id._id || u.team_id.id) : u.team_id;
      return uTeam === REPORTS_FILTER.teamId;
    });
  }

  return `
    <div class="fade-in">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="font-display font-bold text-2xl text-white">Reports</h2>
          <p class="text-surface-400 text-sm mt-1">Key performance indicators and analytics</p>
        </div>
      </div>

      <div class="card mb-6">
        <div class="flex flex-wrap gap-3">
          <select class="form-input py-2 text-sm w-48 rounded-full" onchange="setReportsDateRange(this.value)">
            <option value="all_time" ${REPORTS_FILTER.dateRange === 'all_time' ? 'selected' : ''}>All Time</option>
            <option value="today" ${REPORTS_FILTER.dateRange === 'today' ? 'selected' : ''}>Today</option>
            <option value="this_week" ${REPORTS_FILTER.dateRange === 'this_week' ? 'selected' : ''}>This Week</option>
            <option value="this_month" ${REPORTS_FILTER.dateRange === 'this_month' ? 'selected' : ''}>This Month</option>
            <option value="custom" ${REPORTS_FILTER.dateRange === 'custom' ? 'selected' : ''}>Custom Range</option>
          </select>

          ${REPORTS_FILTER.dateRange === 'custom' ? `
            <div class="flex items-center gap-2">
              <input type="date" class="form-input py-2 text-sm w-auto rounded-full" value="${REPORTS_FILTER.startDate || ''}" onchange="REPORTS_FILTER.startDate=this.value; renderPage()">
              <span class="text-surface-500">to</span>
              <input type="date" class="form-input py-2 text-sm w-auto rounded-full" value="${REPORTS_FILTER.endDate || ''}" onchange="REPORTS_FILTER.endDate=this.value; renderPage()">
            </div>
          ` : ''}

          ${APP.currentRole === 'admin' ? `
            <select class="form-input py-2 text-sm w-48 rounded-full" onchange="REPORTS_FILTER.agentId='all'; setReportsTeam(this.value);">
              <option value="all">All Teams</option>
              ${teams.map(t => `<option value="${t.id}" ${REPORTS_FILTER.teamId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
            </select>
          ` : ''}

          ${isManager ? `
            <select class="form-input py-2 text-sm w-48 rounded-full" onchange="setReportsAgent(this.value)">
              <option value="all">All Agents</option>
              ${availableAgents.map(a => `<option value="${a.id}" ${REPORTS_FILTER.agentId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>
          ` : ''}
          <button class="btn btn-ghost text-sm text-surface-400 hover:text-white transition-colors" onclick="clearReportsFilter()">
            <i class="fas fa-times"></i> Clear Filter
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <div class="card !p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-surface-400 mb-1">Total Leads</p>
            <h3 class="text-2xl font-display font-bold text-white">${totalLeads}</h3>
          </div>
          <div class="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-lg">
            <i class="fas fa-users"></i>
          </div>
        </div>
        <div class="card !p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-surface-400 mb-1">Calls Made</p>
            <h3 class="text-2xl font-display font-bold text-sky-400">${totalCallsMade}</h3>
          </div>
          <div class="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 text-lg">
            <i class="fas fa-phone-alt"></i>
          </div>
        </div>
        <div class="card !p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-surface-400 mb-1">Disbursed Leads</p>
            <h3 class="text-2xl font-display font-bold text-emerald-400">${disbursedCount}</h3>
          </div>
          <div class="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">
            <i class="fas fa-check-circle"></i>
          </div>
        </div>
        <div class="card !p-4 flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-surface-400 mb-1">Disbursed Amt</p>
            <div class="flex items-end gap-2 flex-wrap">
              <h3 class="text-xl font-display font-bold text-amber-400 truncate" title="₹${formatCurrency(totalLoanAmount)}">₹${formatCurrency(totalLoanAmount)}</h3>
              ${totalTargetAmt > 0 ? `<span class="text-xs ${totalTargetPct >= 100 ? 'text-emerald-400' : 'text-surface-500'} mb-1">/ ₹${formatCurrency(totalTargetAmt)} (${totalTargetPct}%)</span>` : ''}
            </div>
          </div>
          <div class="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-lg shrink-0 ml-2">
            <i class="fas fa-rupee-sign"></i>
          </div>
        </div>
        <div class="card !p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-surface-400 mb-1">Conversion</p>
            <h3 class="text-2xl font-display font-bold text-rose-400">${conversionRate}%</h3>
          </div>
          <div class="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 text-lg shrink-0">
            <i class="fas fa-chart-pie"></i>
          </div>
        </div>
      </div>

      ${isManager ? `
      <div class="card mt-2">
      ${APP.currentRole === 'admin' ? `
      <div class="card mt-2 mb-6">
        <h3 class="text-lg font-bold text-white mb-4">Teams Comparison</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-surface-700">
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Team Name</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Number of Agents</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Leads Assigned</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Calls Made</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Disbursed Leads</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Disbursed Amount</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Target</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Achieved %</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const teamStats = teams.map(team => {
                  const teamAgents = USERS.filter(u => u.role === 'agent' && u.active && (u.team_id === team.id || (typeof u.team_id === 'object' && (u.team_id._id || u.team_id.id) === team.id))).map(u => u.id);
                  let aLeads = leads.filter(l => teamAgents.includes(l.assigned_agent_id));
                  aLeads = aLeads.filter(l => {
                    const d = new Date(l.created_at);
                    return d >= startDate && d <= endDate;
                  });
                  let aCallLogs = callLogs.filter(c => teamAgents.includes(c.agent_id));
                  aCallLogs = aCallLogs.filter(c => {
                    const d = new Date(c.created_at);
                    return d >= startDate && d <= endDate;
                  });
                  const aDisbursed = aLeads.filter(l => l.status === 'disbursed');
                  const aDisbursedAmount = aDisbursed.reduce((sum, l) => sum + (Number(l.amount_requested) || 0), 0);
                  const aTotalCalls = new Set(aCallLogs.map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;
                  const aConversion = aLeads.length > 0 ? ((aDisbursed.length / aLeads.length) * 100).toFixed(1) : 0;
                  const targetAmt = TARGETS.teams[team.id] || 0;
                  const targetPct = targetAmt > 0 ? ((aDisbursedAmount / targetAmt) * 100).toFixed(1) : 0;
                  return { name: team.name, agentsCount: teamAgents.length, leads: aLeads.length, calls: aTotalCalls, disbursed: aDisbursed.length, amount: aDisbursedAmount, target: targetAmt, targetPct: targetPct, conversion: aConversion };
                });
                teamStats.sort((a, b) => b.amount - a.amount || b.conversion - a.conversion);
                if (teamStats.length === 0) return '<tr><td colspan="9" class="py-8 text-center text-surface-500">No data available</td></tr>';
                return teamStats.map(m => `
                  <tr class="border-b border-surface-800/50 hover:bg-surface-800/20 transition-colors">
                    <td class="py-3 px-4 text-white font-medium">${m.name}</td>
                    <td class="py-3 px-4 text-surface-300">${m.agentsCount}</td>
                    <td class="py-3 px-4 text-surface-300">${m.leads}</td>
                    <td class="py-3 px-4 text-surface-300">${m.calls}</td>
                    <td class="py-3 px-4 text-emerald-400 font-medium">${m.disbursed}</td>
                    <td class="py-3 px-4 text-amber-400 font-medium">₹${formatCurrency(m.amount)}</td>
                    <td class="py-3 px-4 text-surface-400 font-medium">${m.target > 0 ? '₹' + formatCurrency(m.target) : '-'}</td>
                    <td class="py-3 px-4 ${m.targetPct >= 100 ? 'text-emerald-400' : 'text-rose-400'}">${m.target > 0 ? m.targetPct + '%' : '-'}</td>
                    <td class="py-3 px-4 text-sky-400">${m.conversion}%</td>
                  </tr>
                `).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

        <h3 class="text-lg font-bold text-white mb-4">Team Member Comparison</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-surface-700">
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Agent Name</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Team Name</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Leads Assigned</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Calls Made</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Disbursed Leads</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Disbursed Amount</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Target</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Achieved %</th>
                <th class="py-3 px-4 font-semibold text-surface-400 text-sm">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const memberStats = availableAgents.map(agent => {
                  let aLeads = leads.filter(l => l.assigned_agent_id === agent.id);
                  aLeads = aLeads.filter(l => {
                    const d = new Date(l.created_at);
                    return d >= startDate && d <= endDate;
                  });
                  let aCallLogs = callLogs.filter(c => c.agent_id === agent.id);
                  aCallLogs = aCallLogs.filter(c => {
                    const d = new Date(c.created_at);
                    return d >= startDate && d <= endDate;
                  });
                  const aDisbursed = aLeads.filter(l => l.status === 'disbursed');
                  const aDisbursedAmount = aDisbursed.reduce((sum, l) => sum + (Number(l.amount_requested) || 0), 0);
                  const aTotalCalls = new Set(aCallLogs.map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;
                  const aConversion = aLeads.length > 0 ? ((aDisbursed.length / aLeads.length) * 100).toFixed(1) : 0;
                  const targetAmt = TARGETS.agents[agent.id] || 0;
                  const targetPct = targetAmt > 0 ? ((aDisbursedAmount / targetAmt) * 100).toFixed(1) : 0;
                  const teamObj = getTeam(agent.team_id);
                  const teamName = teamObj ? teamObj.name : 'No Team';
                  return { name: agent.name, teamName: teamName, leads: aLeads.length, calls: aTotalCalls, disbursed: aDisbursed.length, amount: aDisbursedAmount, target: targetAmt, targetPct: targetPct, conversion: aConversion };
                });
                memberStats.sort((a, b) => b.amount - a.amount || b.conversion - a.conversion);
                if (memberStats.length === 0) return '<tr><td colspan="9" class="py-8 text-center text-surface-500">No data available</td></tr>';
                return memberStats.map(m => `
                  <tr class="border-b border-surface-800/50 hover:bg-surface-800/20 transition-colors">
                    <td class="py-3 px-4 text-white font-medium">${m.name}</td>
                    <td class="py-3 px-4 text-surface-300">${m.teamName}</td>
                    <td class="py-3 px-4 text-surface-300">${m.leads}</td>
                    <td class="py-3 px-4 text-surface-300">${m.calls}</td>
                    <td class="py-3 px-4 text-emerald-400 font-medium">${m.disbursed}</td>
                    <td class="py-3 px-4 text-amber-400 font-medium">₹${formatCurrency(m.amount)}</td>
                    <td class="py-3 px-4 text-surface-400 font-medium">${m.target > 0 ? '₹' + formatCurrency(m.target) : '-'}</td>
                    <td class="py-3 px-4 ${m.targetPct >= 100 ? 'text-emerald-400' : 'text-rose-400'}">${m.target > 0 ? m.targetPct + '%' : '-'}</td>
                    <td class="py-3 px-4 text-rose-400">${m.conversion}%</td>
                  </tr>
                `).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function initReportsChart() {}
