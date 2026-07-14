// ========== DASHBOARD RENDER & CHARTS ==========

function renderDashboard() {
  const vl = getVisibleLeads();
  const totalLeads = vl.length;
  const contacted = vl.filter(l => ['contacted','interested','documents_pending','login_done','disbursed'].includes(l.status)).length;
  const converted = vl.filter(l => l.status === 'disbursed').length;
  const convRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : 0;
  const todayFollowups = vl.filter(l => {
    const calls = getLeadCalls(l.id);
    return calls.some(c => c.follow_up_at && new Date(c.follow_up_at).toDateString() === new Date().toDateString());
  }).length;
  const totalAmount = vl.reduce((s, l) => s + l.amount_requested, 0);
  const hotLeads = vl.filter(l => l.priority === 'hot' && !['disbursed','rejected','dead','not_interested'].includes(l.status)).length;

  // Agent leaderboard (for admin/tl)
  let leaderboardHTML = '';
  if (APP.currentRole !== 'agent') {
    const agents = APP.currentRole === 'admin' ? USERS.filter(u => u.role === 'agent' && u.active) : USERS.filter(u => u.role === 'agent' && u.active && u.team_id === getUser(APP.currentUserId)?.team_id);
    const agentStats = agents.map(a => {
      const aLeads = leads.filter(l => l.assigned_agent_id === a.id);
      const aConverted = aLeads.filter(l => l.status === 'disbursed').length;
      const aCalls = new Set(callLogs.filter(c => c.agent_id === a.id).map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;
      const aFollowups = aLeads.filter(l => { const calls = getLeadCalls(l.id); return calls.some(c => c.follow_up_at && new Date(c.follow_up_at).toDateString() === new Date().toDateString()); }).length;
      return { ...a, total: aLeads.length, converted: aConverted, calls: aCalls, followups: aFollowups };
    }).sort((a, b) => b.converted - a.converted);

    leaderboardHTML = `
      <div class="card fade-in hidden">
        <h3 class="font-display font-bold text-white mb-4">Agent Leaderboard</h3>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Agent</th><th>Team</th><th>Leads</th><th>Calls</th><th class="text-white">Converted</th><th>Follow-ups Today</th></tr></thead>
            <tbody>
              ${agentStats.map(a => `<tr>
                <td><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-400">${a.name.charAt(0)}</div><span class="font-medium text-white">${a.name}</span></div></td>
                <td class="text-surface-400">${getTeam(a.team_id)?.name || '—'}</td>
                <td>${a.total}</td>
                <td>${a.calls}</td>
                <td><span class="text-white font-semibold">${a.converted}</span></td>
                <td>${a.followups > 0 ? `<span class="badge badge-documents-pending">${a.followups}</span>` : '0'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // Team leaderboard
    const teamStats = TEAMS.map(t => {
      const teamAgents = USERS.filter(u => u.team_id === t.id && u.active);
      const teamLeads = leads.filter(l => teamAgents.some(a => a.id === l.assigned_agent_id));
      const teamConverted = teamLeads.filter(l => l.status === 'disbursed').length;
      const teamCalls = new Set(callLogs.filter(c => teamAgents.some(a => a.id === c.agent_id)).map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;
      return { ...t, agentCount: teamAgents.length, total: teamLeads.length, converted: teamConverted, calls: teamCalls };
    }).sort((a, b) => b.converted - a.converted);

    leaderboardHTML += `
      <div class="card fade-in mt-6 hidden">
        <h3 class="font-display font-bold text-white mb-4">Team Leaderboard</h3>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Team</th><th>Agents</th><th>Leads</th><th>Calls</th><th class="text-white">Converted</th></tr></thead>
            <tbody>
              ${teamStats.map(t => `<tr>
                <td><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-sky-600/20 flex items-center justify-center text-xs font-bold text-sky-400">${t.name.charAt(0)}</div><span class="font-medium text-white">${t.name}</span></div></td>
                <td class="text-surface-400">${t.agentCount}</td>
                <td>${t.total}</td>
                <td>${t.calls}</td>
                <td><span class="text-white font-semibold">${t.converted}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // Agent personal stats
  let personalHTML = '';
  if (APP.currentRole === 'agent') {
    const myCallsCount = new Set(callLogs.filter(c => c.agent_id === APP.currentUserId).map(c => `${c.lead_id}_${new Date(c.created_at).toDateString()}`)).size;
    const myConverted = vl.filter(l => l.status === 'disbursed').length;
    const myInterested = vl.filter(l => l.status === 'interested').length;
    const myDocs = vl.filter(l => l.status === 'documents_pending').length;
    personalHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 fade-in">
        <div class="card text-center"><p class="text-3xl font-display font-bold text-white">${myCallsCount}</p><p class="text-sm text-surface-400 mt-1">Total Calls</p></div>
        <div class="card text-center"><p class="text-3xl font-display font-bold text-brand-400">${myInterested}</p><p class="text-sm text-surface-400 mt-1">Interested</p></div>
        <div class="card text-center"><p class="text-3xl font-display font-bold text-amber-400">${myDocs}</p><p class="text-sm text-surface-400 mt-1">Docs Pending</p></div>
        <div class="card text-center"><p class="text-3xl font-display font-bold text-white">${myConverted}</p><p class="text-sm text-surface-400 mt-1">Disbursed</p></div>
      </div>`;
  }

  // Recent activity
  const recentCalls = [...callLogs].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
  const activityHTML = recentCalls.map(c => {
    const lead = leads.find(l => l.id === c.lead_id);
    const agent = getUser(c.agent_id);
    if (!lead || !agent) return '';
    return `<div class="flex items-start gap-3 py-3 border-b border-surface-800 last:border-0">
      <div class="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <i class="fas fa-phone-alt text-xs text-surface-400"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-white truncate"><span class="font-medium">${agent.name}</span> called <span class="font-medium">${lead.name}</span></p>
        <p class="text-xs text-surface-500 mt-0.5">${c.outcome} — ${timeAgo(c.created_at)}</p>
      </div>
    </div>`;
  }).join('');

  // Follow-ups today
  const followupLeads = vl.filter(l => {
    const calls = getLeadCalls(l.id);
    return calls.some(c => c.follow_up_at && new Date(c.follow_up_at).toDateString() === new Date().toDateString());
  }).slice(0, 5);
  const followupHTML = followupLeads.map(l => `
    <div class="flex items-center gap-3 py-3 border-b border-surface-800 last:border-0 cursor-pointer hover:bg-surface-800/50 -mx-2 px-2 rounded" onclick="showLeadDetail('${l.id}')">
      <div class="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center flex-shrink-0"><i class="fas fa-clock text-xs text-amber-400"></i></div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-white font-medium truncate">${l.name}</p>
        <p class="text-xs text-surface-500">${LOAN_LABELS[l.loan_type] || l.loan_type} — Aging: ${getAging(l.assigned_at)}</p>
      </div>
      <span class="${getStatusBadgeClass(l.status)}">${STATUS_LABELS[l.status]}</span>
    </div>
  `).join('') || '<p class="text-surface-500 text-sm py-4 text-center">No follow-ups today</p>';

  // Hot leads
  const hotLeadsList = vl.filter(l => l.priority === 'hot' && !['disbursed','rejected','dead','not_interested'].includes(l.status)).slice(0, 5);
  const hotHTML = hotLeadsList.map(l => `
    <div class="flex items-center gap-3 py-3 border-b border-surface-800 last:border-0 cursor-pointer hover:bg-surface-800/50 -mx-2 px-2 rounded" onclick="showLeadDetail('${l.id}')">
      <div class="w-8 h-8 rounded-full bg-rose-600/20 flex items-center justify-center flex-shrink-0"><i class="fas fa-fire text-xs text-rose-400"></i></div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-white font-medium truncate">${l.name}</p>
        <p class="text-xs text-surface-500">${LOAN_LABELS[l.loan_type] || l.loan_type} — Aging: ${getAging(l.assigned_at)}</p>
      </div>
      <span class="badge badge-hot">HOT</span>
    </div>
  `).join('') || '<p class="text-surface-500 text-sm py-4 text-center">No hot leads</p>';

  return `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-display font-bold text-2xl text-white">Dashboard</h2>
          <p class="text-surface-400 text-sm mt-1">${APP.currentRole === 'admin' ? 'Company-wide overview' : APP.currentRole === 'tl' ? getTeam(getUser(APP.currentUserId)?.team_id)?.name + ' team overview' : 'Your performance at a glance'}</p>
        </div>
        ${APP.currentRole === 'admin' ? '<button class="btn btn-secondary btn-sm" onclick="openModal(\'importModal\')"><i class="fas fa-file-import"></i> Bulk Import</button>' : ''}
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="card stat-card emerald">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-brand-600/15 flex items-center justify-center"><i class="fas fa-users text-brand-400"></i></div>
            <span class="text-sm text-surface-400">Total Leads</span>
          </div>
          <p class="text-3xl font-display font-bold text-white">${totalLeads}</p>
          <p class="text-xs text-surface-500 mt-1">${formatCurrency(totalAmount)} total pipeline</p>
        </div>
        <div class="card stat-card sky">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-sky-600/15 flex items-center justify-center"><i class="fas fa-phone-alt text-sky-400"></i></div>
            <span class="text-sm text-surface-400">Contacted</span>
          </div>
          <p class="text-3xl font-display font-bold text-white">${contacted}</p>
          <p class="text-xs text-surface-500 mt-1">${totalLeads > 0 ? ((contacted/totalLeads)*100).toFixed(0) : 0}% contact rate</p>
        </div>
        <div class="card stat-card amber">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-amber-600/15 flex items-center justify-center"><i class="fas fa-fire text-amber-400"></i></div>
            <span class="text-sm text-surface-400">Hot Leads</span>
          </div>
          <p class="text-3xl font-display font-bold text-white">${hotLeads}</p>
          <p class="text-xs text-surface-500 mt-1">High-intent prospects</p>
        </div>
        <div class="card stat-card rose">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-rose-600/15 flex items-center justify-center"><i class="fas fa-trophy text-rose-400"></i></div>
            <span class="text-sm text-surface-400">Converted</span>
          </div>
          <p class="text-3xl font-display font-bold text-white">${converted}</p>
          <p class="text-xs text-surface-500 mt-1">${convRate}% conversion rate</p>
        </div>
      </div>

      ${personalHTML}

      <!-- Charts row -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="card fade-in">
          <h3 class="font-display font-bold text-white mb-4">Lead Funnel</h3>
          <div style="height:280px"><canvas id="funnelChart"></canvas></div>
        </div>
        <div class="card fade-in">
          <h3 class="font-display font-bold text-white mb-4">Loan Types</h3>
          <div style="height:280px"><canvas id="loanTypeChart"></canvas></div>
        </div>
        <div class="card fade-in">
          <h3 class="font-display font-bold text-white mb-4">Source Funnel</h3>
          <div style="height:280px"><canvas id="sourceFunnelChart"></canvas></div>
        </div>
        <div class="card fade-in">
          <h3 class="font-display font-bold text-white mb-4">${APP.currentRole === 'admin' ? 'Team Comparison' : APP.currentRole === 'tl' ? 'Agent Performance' : 'Lead Sources'}</h3>
          <div style="height:280px"><canvas id="secondaryChart"></canvas></div>
        </div>
      </div>

      <!-- Bottom row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div class="card fade-in">
          <h3 class="font-display font-bold text-white mb-3">Follow-ups Today <span class="text-brand-400 text-sm font-normal">(${todayFollowups})</span></h3>
          ${followupHTML}
        </div>
        <div class="card fade-in">
          <h3 class="font-display font-bold text-white mb-3">Hot Leads <span class="text-rose-400 text-sm font-normal">(${hotLeads})</span></h3>
          ${hotHTML}
        </div>
        <div class="card fade-in">
          <h3 class="font-display font-bold text-white mb-3">Recent Activity</h3>
          ${activityHTML}
        </div>
      </div>

      ${leaderboardHTML}
    </div>
  `;
}

function initDashboardCharts() {
  const vl = getVisibleLeads();
  const theme = getChartTheme();
  // Funnel chart
  const funnelData = STATUSES.map(s => {
    const targetStatus = s.toString().toLowerCase().trim();
    return vl.filter(l => (l.status || 'new').toString().toLowerCase().trim() === targetStatus).length;
  });
  const funnelLabels = STATUSES.map(s => STATUS_LABELS[s] || (s.charAt(0).toUpperCase() + s.slice(1)));
  const funnelColors = ['#34d399','#38bdf8','#c084fc','#fbbf24','#60a5fa','#6ee7b7','#fb7185','#f43f5e','#a855f7'];

  const ctx1 = document.getElementById('funnelChart');
  if (ctx1) {
    if (APP.charts.funnel) APP.charts.funnel.destroy();
    APP.charts.funnel = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: funnelLabels,
        datasets: [{ data: funnelData, backgroundColor: funnelColors, borderRadius: 6, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: theme.gridColor }, ticks: { color: theme.tickColor } },
          y: { grid: { display: false }, ticks: { color: theme.labelColor, font: { size: 12 } } }
        }
      }
    });
  }

  // Secondary chart
  const ctx2 = document.getElementById('secondaryChart');
  if (ctx2) {
    if (APP.charts.secondary) APP.charts.secondary.destroy();
    if (APP.currentRole === 'admin') {
      // Team comparison
      const teamData = TEAMS.map(t => {
        const tLeads = leads.filter(l => {
          const agent = getUser(l.assigned_agent_id);
          return agent && agent.team_id === t.id;
        });
        return { name: t.name, total: tLeads.length, converted: tLeads.filter(l => l.status === 'disbursed').length };
      });
      APP.charts.secondary = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: teamData.map(t => t.name),
          datasets: [
            { label: 'Total Leads', data: teamData.map(t => t.total), backgroundColor: theme.gridColor, borderRadius: 6, borderSkipped: false },
            { label: 'Converted', data: teamData.map(t => t.converted), backgroundColor: '#10b981', borderRadius: 6, borderSkipped: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: theme.tickColor, font: { size: 12 } } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: theme.tickColor } },
            y: { grid: { color: theme.gridColor }, ticks: { color: theme.tickColor } }
          }
        }
      });
    } else if (APP.currentRole === 'tl') {
      // Agent performance for TL's team
      const myTeamId = getUser(APP.currentUserId)?.team_id;
      const myAgents = USERS.filter(u => u.role === 'agent' && u.team_id === myTeamId);
      const agentPerfData = myAgents.map(a => {
        const aLeads = leads.filter(l => l.assigned_agent_id === a.id);
        const aWon = aLeads.filter(l => l.status === 'disbursed').length;
        return { name: a.name, won: aWon };
      }).sort((a,b) => b.won - a.won);

      APP.charts.secondary = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: agentPerfData.map(a => a.name),
          datasets: [
            { label: 'Won Leads', data: agentPerfData.map(a => a.won), backgroundColor: '#8b5cf6', borderRadius: 6, borderSkipped: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: theme.tickColor } },
            y: { grid: { color: theme.gridColor }, ticks: { color: theme.tickColor } }
          }
        }
      });
    } else {
      // Source distribution
      const sourceData = SOURCES.map(s => vl.filter(l => l.source === s).length);
      const sourceColors = ['#10b981','#f59e0b','#0ea5e9','#8b5cf6','#f43f5e','#78716c'];
      APP.charts.secondary = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: SOURCES.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
          datasets: [{ data: sourceData, backgroundColor: sourceColors, borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: { legend: { position: 'right', labels: { color: theme.tickColor, font: { size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } } }
        }
      });
    }
  }

  // Loan Type Chart
  const ctx3 = document.getElementById('loanTypeChart');
  if (ctx3) {
    if (APP.charts.loanType) APP.charts.loanType.destroy();
    const typeCounts = {};
    vl.forEach(l => {
      const t = l.loan_type || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const activeLoanTypes = Object.keys(typeCounts);
    const loanTypeData = activeLoanTypes.map(lt => typeCounts[lt]);
    const ltColors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899', '#6366f1', '#14b8a6', '#22d3ee', '#c084fc', '#fb7185'];
    
    // If there is no data, add a dummy entry so chart shows something empty
    if (loanTypeData.length === 0 || loanTypeData.reduce((a,b)=>a+b,0) === 0) {
      activeLoanTypes.push('No Data');
      loanTypeData.push(1);
      ltColors.unshift('#334155');
    }

    APP.charts.loanType = new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: activeLoanTypes.map(lt => lt === 'No Data' ? 'No Data' : (LOAN_LABELS[lt] || lt)),
        datasets: [{ data: loanTypeData, backgroundColor: ltColors.slice(0, activeLoanTypes.length), borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { 
          legend: { 
            position: 'right', 
            labels: { color: theme.tickColor, font: { size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } 
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if(context.label === 'No Data') return ' 0';
                return ' ' + context.formattedValue;
              }
            }
          }
        }
      }
    });
  }

  // Source Funnel Chart
  const ctx4 = document.getElementById('sourceFunnelChart');
  if (ctx4) {
    if (APP.charts.sourceFunnel) APP.charts.sourceFunnel.destroy();
    
    const sourceCounts = SOURCES.map(s => {
      const targetSource = s.toString().toLowerCase().trim();
      return {
        source: s,
        label: s.charAt(0).toUpperCase() + s.slice(1),
        count: vl.filter(l => (l.source || '').toString().toLowerCase().trim() === targetSource).length
      };
    }).sort((a, b) => b.count - a.count);

    const sourceLabels = sourceCounts.map(item => item.label);
    const sourceData = sourceCounts.map(item => item.count);
    const sourceFunnelColors = ['#0ea5e9', '#38bdf8', '#06b6d4', '#22d3ee', '#14b8a6', '#2d3748', '#475569', '#64748b'];

    APP.charts.sourceFunnel = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: sourceLabels,
        datasets: [{ data: sourceData, backgroundColor: sourceFunnelColors.slice(0, sourceLabels.length), borderRadius: 6, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: theme.gridColor }, ticks: { color: theme.tickColor } },
          y: { grid: { display: false }, ticks: { color: theme.labelColor, font: { size: 12 } } }
        }
      }
    });
  }
}

function destroyCharts() {
  if (APP.charts.funnel) { APP.charts.funnel.destroy(); APP.charts.funnel = null; }
  if (APP.charts.secondary) { APP.charts.secondary.destroy(); APP.charts.secondary = null; }
  if (APP.charts.loanType) { APP.charts.loanType.destroy(); APP.charts.loanType = null; }
  if (APP.charts.sourceFunnel) { APP.charts.sourceFunnel.destroy(); APP.charts.sourceFunnel = null; }
  if (APP.charts.reports) { APP.charts.reports.destroy(); APP.charts.reports = null; }
}
