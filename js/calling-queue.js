// ========== CALLING QUEUE MODULE ==========

function renderCallingQueue() {
  const vl = getVisibleLeads().filter(l => !['disbursed','rejected','dead','not_interested'].includes(l.status));
  // Sort: follow-ups today first, then hot, then new, then others
  vl.sort((a, b) => {
    const aFollowup = getLeadCalls(a.id).some(c => c.follow_up_at && new Date(c.follow_up_at).toDateString() === new Date().toDateString());
    const bFollowup = getLeadCalls(b.id).some(c => c.follow_up_at && new Date(c.follow_up_at).toDateString() === new Date().toDateString());
    if (aFollowup && !bFollowup) return -1;
    if (!aFollowup && bFollowup) return 1;
    const pOrder = { hot: 0, warm: 1, cold: 2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    const sOrder = { new: 0, contacted: 1, interested: 2, documents_pending: 3, login_done: 4 };
    return (sOrder[a.status] || 5) - (sOrder[b.status] || 5);
  });

  return `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-display font-bold text-2xl text-white">Calling Queue</h2>
          <p class="text-surface-400 text-sm mt-1">${vl.length} leads to call — prioritized by follow-ups and priority</p>
        </div>
      </div>
      <div class="space-y-3">
        ${vl.map((l, i) => {
          const lastCall = getLeadCalls(l.id)[0];
          const hasFollowupToday = lastCall?.follow_up_at && new Date(lastCall.follow_up_at).toDateString() === new Date().toDateString();
          return `
            <div class="card flex flex-col sm:flex-row items-start sm:items-center gap-4 ${hasFollowupToday ? 'glow-emerald border-amber-600/30' : ''}">
              <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="w-10 h-10 rounded-full ${l.priority === 'hot' ? 'bg-rose-600/20' : l.priority === 'warm' ? 'bg-amber-600/20' : 'bg-surface-800'} flex items-center justify-center flex-shrink-0">
                  <span class="text-sm font-bold ${l.priority === 'hot' ? 'text-rose-400' : l.priority === 'warm' ? 'text-amber-400' : 'text-surface-400'}">${i + 1}</span>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-semibold text-white">${l.name}</p>
                    ${l.priority === 'hot' ? '<span class="badge badge-hot">HOT</span>' : ''}
                    ${hasFollowupToday ? '<span class="badge badge-documents-pending">Follow-up Due</span>' : ''}
                  </div>
                  <p class="text-sm text-surface-400 mt-0.5">${l.phone}${l.email ? ` — ${l.email}` : ''} — ${l.city}</p>
                  <p class="text-xs text-surface-500 mt-0.5">${LOAN_LABELS[l.loan_type] || l.loan_type} — ${formatCurrency(l.amount_requested)} — ${lastCall ? 'Last call: ' + timeAgo(lastCall.created_at) : 'No calls yet'}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="${getStatusBadgeClass(l.status)}">${STATUS_LABELS[l.status]}</span>
                <button class="btn btn-primary btn-sm" onclick="showCallLogModal('${l.id}')"><i class="fas fa-phone-alt"></i> Call</button>
                <button class="btn btn-ghost btn-sm" onclick="showLeadDetail('${l.id}')"><i class="fas fa-eye"></i></button>
              </div>
            </div>
          `;
        }).join('')}
        ${vl.length === 0 ? '<div class="card text-center py-16 text-surface-500"><i class="fas fa-check-circle text-4xl mb-3 text-brand-400"></i><p>All caught up! No leads to call.</p></div>' : ''}
      </div>
    </div>
  `;
}
