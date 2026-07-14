// ========== LEAD PIPELINE MODULE ==========

function renderPipeline() {
  const vl = getVisibleLeads();
  const pipelineStatuses = ['new','contacted','interested','documents_pending','login_done','disbursed'];
  const statusColors = { new: '#34d399', contacted: '#38bdf8', interested: '#c084fc', documents_pending: '#fbbf24', login_done: '#60a5fa', disbursed: '#6ee7b7' };

  return `
    <div class="fade-in">
      <div class="mb-6">
        <h2 class="font-display font-bold text-2xl text-white">Lead Pipeline</h2>
        <p class="text-surface-400 text-sm mt-1">Drag-free kanban view of your lead pipeline</p>
      </div>
      <div class="flex gap-4 overflow-x-auto pb-4">
        ${pipelineStatuses.map(s => {
          const sLeads = vl.filter(l => {
            const status = (l.status || 'new').toLowerCase().trim();
            return status === s;
          });
          return `
            <div class="kanban-col flex-shrink-0">
              <div class="flex items-center gap-2 mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full" style="background:${statusColors[s]}"></div>
                <span class="font-display font-semibold text-sm text-white">${STATUS_LABELS[s]}</span>
                <span class="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-full">${sLeads.length}</span>
              </div>
              <div class="space-y-3 min-h-[200px]">
                ${sLeads.map(l => `
                  <div class="kanban-card" onclick="showLeadDetail('${l.id}')">
                    <div class="flex items-center justify-between mb-2">
                      <p class="font-medium text-white text-sm">${l.name}</p>
                      ${l.priority === 'hot' ? '<span class="badge badge-hot text-[10px]">HOT</span>' : ''}
                    </div>
                    <p class="text-xs text-surface-500 mb-2">${LOAN_LABELS[l.loan_type] || l.loan_type} — ${formatCurrency(l.amount_requested)}</p>
                    <div class="flex items-center justify-between">
                      <p class="text-xs text-surface-400"><i class="fas fa-map-marker-alt mr-1"></i>${l.city}</p>
                      <p class="text-[11px] text-surface-500">${timeAgo(l.created_at)}</p>
                    </div>
                  </div>
                `).join('')}
                ${sLeads.length === 0 ? '<div class="border border-dashed border-surface-700 rounded-xl p-6 text-center text-surface-600 text-sm">No leads</div>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
