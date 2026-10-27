(() => {
  const $ = (s, p = document) => p.querySelector(s);
  const main = $('#admin-main');
  const toasts = $('#toasts');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (t) => (t ? String(t).slice(0, 19).replace('T', ' ') : '—');
  const toast = (msg, ok = true) => {
    const el = document.createElement('div');
    el.className = `p-3 rounded-xl border text-xs shadow-lg pointer-events-auto transition ${ok ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/90 border-rose-500/40 text-rose-200'}`;
    el.textContent = msg;
    toasts.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
  };
  const api = async (p, opts = {}) => {
    const r = await fetch('/api/admin' + p, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) { const err = new Error(d.error || `HTTP ${r.status}`); err.status = r.status; throw err; }
    return d;
  };

  const planName = { free: '免费版', standard: '标准版', enterprise: '机构版' };
  const orderStatus = { pending: '待付款', paid: '已支付', cancelled: '已取消' };
  const leadStatus = ['pending', 'contacting', 'processing', 'completed', 'closed'];
  const leadLabel = { pending: '待联系', contacting: '沟通中', processing: '服务中', completed: '已完成', closed: '已关闭' };

  const views = {
    async overview() {
      const d = (await api('/overview')).data;
      const card = (k, v, cls = 'text-white') => `<div class="stat"><div class="stat-label">${k}</div><div class="stat-value ${cls}">${v}</div></div>`;
      main.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${card('注册用户', d.users)}
        ${card('24 小时新增', d.usersToday, 'text-cyan-300')}
        ${card('付费用户', d.paidUsers, 'text-emerald-300')}
        ${card('待处理订单', d.pendingOrders, d.pendingOrders ? 'text-amber-300' : 'text-white')}
        ${card('待联系线索', d.newLeads, d.newLeads ? 'text-rose-300' : 'text-white')}
        ${card('7 天体检/诊断', d.audits7d)}
        ${card('托管站点', d.sites)}
        ${card('7 天舆情任务', d.riskRuns7d)}
        ${card('待审草稿 (Inbox)', d.pendingDrafts || 0, d.pendingDrafts ? 'text-amber-300' : 'text-slate-400')}
        ${card('已上线草稿', d.publishedDrafts || 0, 'text-emerald-300')}
        ${card('红V矩阵账号', d.redvAccounts || 0, 'text-indigo-300')}
        ${card('红V发布任务', d.redvTasks || 0, 'text-cyan-300')}
      </div>`;
    },
    async inbox(filter = 'all') {
      const res = await api(`/inbox${filter !== 'all' ? `?status=${filter}` : ''}`);
      const rows = res.data;
      const statusPill = {
        pending: '<span class="pill-warn">待人工审核</span>',
        approved: '<span class="pill-info">已批准 (待同步)</span>',
        published: '<span class="pill-ok">已上线生产</span>',
        rejected: '<span class="pill-muted">已驳回</span>'
      };

      main.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-lg font-bold text-white flex items-center gap-2">📥 GEO 智能体审核箱 <span class="text-xs font-normal text-slate-400">(Human-in-the-Loop)</span></h2>
            <p class="text-xs text-slate-400 mt-1">智能体搜集各大模型差距起草的对攻文章与反向事实。<b>每份草稿必须人节点头后，才会自动同步至主站并触发 IndexNow 索引</b>。</p>
          </div>
          <div class="flex items-center gap-2">
            <button data-act="open-gen-modal" class="btn-primary px-3 py-1.5 text-xs font-bold">+ 召唤智能体起草 (New Draft)</button>
          </div>
        </div>

        <div class="flex gap-2 mb-4 border-b border-slate-800 pb-3 text-xs">
          <button data-act="filter-inbox" data-f="all" class="chip ${filter === 'all' ? 'chip-on' : ''}">全部 (${rows.length})</button>
          <button data-act="filter-inbox" data-f="pending" class="chip ${filter === 'pending' ? 'chip-on' : ''}">待审核</button>
          <button data-act="filter-inbox" data-f="published" class="chip ${filter === 'published' ? 'chip-on' : ''}">已上线</button>
          <button data-act="filter-inbox" data-f="rejected" class="chip ${filter === 'rejected' ? 'chip-on' : ''}">已驳回</button>
        </div>

        <div class="space-y-4">
          ${rows.map(r => `
            <div class="card p-5 border border-slate-800 hover:border-slate-700 transition" data-id="${r.id}">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                  ${statusPill[r.status] || r.status}
                  <span class="text-xs font-mono text-cyan-400">/${esc(r.slug)}</span>
                  <span class="text-[11px] text-slate-500">· 预计 ${r.read_mins || 8} 分钟</span>
                </div>
                <div class="text-[11px] text-slate-500">创建时间: ${fmt(r.created_at)}</div>
              </div>

              <div class="py-3">
                <h3 class="text-base font-bold text-white mb-1">${esc(r.title)}</h3>
                <div class="text-xs text-slate-400 mb-2">
                  🎯 目标检索词: <span class="text-cyan-300 font-medium">"${esc(r.target_query)}"</span>
                  · 目标模型: <span class="text-white">${esc(r.target_engine)}</span>
                  ${r.competitor ? `· 对标竞品: <span class="text-amber-300">${esc(r.competitor)}</span>` : ''}
                </div>
                <div class="text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 text-slate-300 mb-2 leading-relaxed">
                  <span class="text-amber-400 font-bold">💡 差距与起草依据:</span> ${esc(r.gap_reason)}
                </div>
                <p class="text-xs text-slate-400 line-clamp-2">${esc(r.excerpt)}</p>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <div class="flex items-center gap-2">
                  <button data-act="view-draft" data-id="${r.id}" class="btn-secondary px-3 py-1 text-xs">🔍 查看 / 微调正文</button>
                  <button data-act="copy-markdown" data-id="${r.id}" class="btn-ghost px-2.5 py-1 text-xs text-slate-400">📋 复制 Markdown</button>
                </div>
                <div class="flex items-center gap-2">
                  ${r.status === 'pending' ? `
                    <button data-act="approve-draft" data-id="${r.id}" class="btn-emerald px-3.5 py-1 text-xs font-bold shadow-md shadow-emerald-950">🚀 批准并一键发布上线</button>
                    <button data-act="reject-draft" data-id="${r.id}" class="btn-ghost px-2.5 py-1 text-xs text-rose-400">❌ 驳回</button>
                  ` : ''}
                  ${r.status === 'approved' ? `<span class="text-xs text-cyan-300 font-medium">⏳ 宿主程序同步中...</span>` : ''}
                  ${r.status === 'published' ? `
                    <a href="${esc(r.published_url || `https://dailytoolbox.org/blog/${r.slug}`)}" target="_blank" class="btn-ghost px-3 py-1 text-xs text-cyan-300 flex items-center gap-1 font-medium">
                      🔗 查看线上生产页面 ↗
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>
          `).join('') || '<div class="card text-center py-12 text-slate-500">审核箱暂无草稿，可点击右上角「召唤智能体起草」开始生成</div>'}
        </div>

        <!-- 召唤智能体模态框 -->
        <div id="gen-modal" class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 hidden">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 class="text-sm font-bold text-white flex items-center gap-2">🤖 触发 GEO 智能体撰写新草稿</h3>
              <button data-act="close-gen-modal" class="text-slate-400 hover:text-white">&times;</button>
            </div>
            <div class="space-y-3 text-xs">
              <div>
                <label class="block text-slate-400 mb-1">文章核心主题 (Topic)</label>
                <input id="gen-topic" class="input w-full" placeholder="例如: HMAC-SHA256 签名与 Webhook 校验实操指南">
              </div>
              <div>
                <label class="block text-slate-400 mb-1">目标搜索意图词 (Target Query)</label>
                <input id="gen-query" class="input w-full" placeholder="例如: 如何验证 Webhook 签名 HMAC SHA256">
              </div>
              <div>
                <label class="block text-slate-400 mb-1">AI 推荐的竞品 (可选)</label>
                <input id="gen-comp" class="input w-full" placeholder="例如: CyberChef / DevToys">
              </div>
              <div>
                <label class="block text-slate-400 mb-1">承接流量的工具链接 (CTA Tool URL)</label>
                <input id="gen-tool" class="input w-full" value="https://dailytoolbox.org/tools/hmac-generator">
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button data-act="close-gen-modal" class="btn-ghost px-3 py-1.5 text-xs">取消</button>
              <button data-act="submit-gen" id="btn-submit-gen" class="btn-primary px-4 py-1.5 text-xs font-bold">🚀 智能体开始起草</button>
            </div>
          </div>
        </div>

        <!-- 查看/编辑草稿模态框 -->
        <div id="draft-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 hidden">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 class="text-sm font-bold text-white flex items-center gap-2" id="draft-modal-title">草稿详情与微调</h3>
              <button data-act="close-draft-modal" class="text-slate-400 hover:text-white text-base">&times;</button>
            </div>
            <div class="p-6 space-y-4 overflow-y-auto text-xs flex-1" id="draft-modal-body">
              <!-- 动态注入 -->
            </div>
            <div class="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/50">
              <div id="draft-modal-status" class="text-xs"></div>
              <div class="flex items-center gap-2">
                <button data-act="close-draft-modal" class="btn-ghost px-3 py-1.5 text-xs">关闭</button>
                <button data-act="save-draft-changes" id="btn-save-draft" class="btn-secondary px-3 py-1.5 text-xs">保存修改</button>
                <button data-act="approve-from-modal" id="btn-approve-modal" class="btn-emerald px-4 py-1.5 text-xs font-bold">🚀 确认无误，批准上线</button>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    async orders() {
      const rows = (await api('/orders')).data;
      main.innerHTML = `<div class="card overflow-x-auto"><table class="w-full text-xs"><thead class="text-slate-400"><tr><th class="text-left py-2">订单号</th><th class="text-left">用户</th><th>套餐</th><th>金额</th><th>状态</th><th>创建</th><th>到期</th><th></th></tr></thead><tbody>
        ${rows.map((o) => `<tr class="border-t border-slate-800"><td class="py-2 font-mono">${esc(o.order_no)}</td><td>${esc(o.username)}<div class="text-slate-500">${esc(o.email || '')}</div></td><td class="text-center">${esc(planName[o.plan_type] || o.plan_type)} · ${o.period === 'yearly' ? '年' : '月'}</td><td class="text-center font-mono">¥${o.amount}</td><td class="text-center">${orderStatus[o.status] || esc(o.status)}</td><td class="text-center text-slate-400">${fmt(o.created_at)}</td><td class="text-center text-slate-400">${fmt(o.expires_at)}</td>
          <td class="text-right whitespace-nowrap">${o.status === 'pending' ? `<button data-act="paid" data-id="${o.id}" class="btn-emerald px-2.5 py-1 text-[11px]">确认收款并开通</button> <button data-act="cancel" data-id="${o.id}" class="btn-ghost px-2.5 py-1 text-[11px]">取消</button>` : esc(o.admin_note || '')}</td></tr>`).join('') || '<tr><td colspan="8" class="py-6 text-center text-slate-500">暂无订单</td></tr>'}</tbody></table></div>`;
    },
    async users(q = '') {
      const rows = (await api('/users' + (q ? `?q=${encodeURIComponent(q)}` : ''))).data;
      main.innerHTML = `<form id="user-search" class="flex gap-2 mb-4"><input name="q" value="${esc(q)}" class="input max-w-xs" placeholder="用户名或邮箱"><button class="btn-secondary px-4 text-sm">搜索</button></form>
        <div class="card overflow-x-auto"><table class="w-full text-xs"><thead class="text-slate-400"><tr><th class="text-left py-2">ID</th><th class="text-left">用户</th><th>套餐</th><th>到期</th><th>日额度</th><th>使用次数</th><th>注册</th><th>最近登录</th><th></th></tr></thead><tbody>
        ${rows.map((u) => `<tr class="border-t border-slate-800 ${u.disabled ? 'opacity-50' : ''}" data-uid="${u.id}"><td class="py-2 font-mono">${u.id}</td><td>${esc(u.username)} ${u.role === 'admin' ? '<span class="pill-warn !text-[10px]">管理员</span>' : ''}<div class="text-slate-500">${esc(u.email || '')}</div></td>
          <td class="text-center"><select data-field="plan" class="select-sm">${Object.keys(planName).map((p) => `<option value="${p}" ${u.plan === p ? 'selected' : ''}>${planName[p]}</option>`).join('')}</select></td>
          <td class="text-center"><input data-field="planExpiresAt" type="date" class="select-sm" value="${u.plan_expires_at ? esc(u.plan_expires_at.slice(0, 10)) : ''}"></td>
          <td class="text-center"><input data-field="quotaDaily" type="number" min="0" class="select-sm w-20" value="${u.quota_daily}"></td>
          <td class="text-center font-mono">${u.scans}</td><td class="text-center text-slate-400">${fmt(u.created_at)}</td><td class="text-center text-slate-400">${fmt(u.last_login_at)}</td>
          <td class="text-right whitespace-nowrap"><button data-act="save-user" class="btn-secondary px-2.5 py-1 text-[11px]">保存</button> <button data-act="toggle-user" data-disabled="${u.disabled ? 0 : 1}" class="btn-ghost px-2.5 py-1 text-[11px]">${u.disabled ? '启用' : '停用'}</button></td></tr>`).join('')}</tbody></table></div>`;
    },
    async leads() {
      const rows = (await api('/leads')).data;
      main.innerHTML = `<div class="space-y-3">${rows.map((l) => `<div class="card !p-4 space-y-2" data-lid="${l.id}">
        <div class="flex flex-wrap items-center justify-between gap-2"><div class="text-sm font-bold">#${l.id} ${esc(l.subject_name)} <span class="text-xs font-normal text-slate-400">${esc(l.client_name)} · ${esc(l.contact_info)}</span></div>
          <div class="flex items-center gap-2"><select data-field="status" class="select-sm">${leadStatus.map((s) => `<option value="${s}" ${l.status === s ? 'selected' : ''}>${leadLabel[s]}</option>`).join('')}</select><span class="text-[11px] text-slate-500">${fmt(l.created_at)}</span></div></div>
        <div class="text-sm text-slate-300 whitespace-pre-wrap">${esc(l.negative_issue)}</div>${l.domain ? `<div class="text-xs text-slate-500">${esc(l.domain)}</div>` : ''}
        <div class="flex gap-2"><input data-field="notes" class="input text-xs" placeholder="跟进备注" value="${esc(l.admin_notes || '')}"><button data-act="save-lead" class="btn-secondary px-3 text-xs whitespace-nowrap">保存</button></div></div>`).join('') || '<div class="card text-center text-slate-500">暂无线索</div>'}</div>`;
    },
    async redv() {
      const rows = (await api('/redv')).data;
      main.innerHTML = `<div class="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div>
          <h2 class="text-sm font-bold text-white">主流媒体红V矩阵账号（60+ 账号联动）</h2>
          <p class="text-xs text-slate-400 mt-0.5">全平台权威红V账号管理，支持前台内容行动卡关联与发布效果验证跟踪</p>
        </div>
        <button data-act="add-redv" class="btn-emerald px-3 py-1.5 text-xs">+ 添加红V账号</button>
      </div>
      <div id="redv-modal" class="hidden mb-4 p-4 card bg-slate-900 border border-slate-700 space-y-3">
        <h3 class="text-xs font-bold text-cyan-300">录入新红V账号</h3>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <input id="new-redv-platform" class="input" placeholder="平台 (如 douyin/weibo/wechat_channels)">
          <input id="new-redv-name" class="input" placeholder="账号名称 (如 主流媒体官方账号)">
          <input id="new-redv-field" class="input" placeholder="领域 (如 综合新闻/文旅生活)">
          <input id="new-redv-followers" class="input" placeholder="粉丝量级 (如 320万)">
          <input id="new-redv-notes" class="input sm:col-span-3" placeholder="备注说明 (如 主流媒体官方主账号)">
          <button data-act="submit-redv" class="btn-primary py-1.5 text-xs">保存录入</button>
        </div>
      </div>
      <div class="card overflow-x-auto"><table class="w-full text-xs"><thead class="text-slate-400"><tr>
        <th class="text-left py-2">ID</th><th class="text-left">平台</th><th class="text-left">账号名称</th><th>领域</th><th>粉丝量级</th><th>备注</th><th>状态</th><th></th>
      </tr></thead><tbody>
        ${rows.map(r => `<tr class="border-t border-slate-800" data-rid="${r.id}">
          <td class="py-2 font-mono">${r.id}</td>
          <td><span class="pill-info">${esc(r.platform)}</span></td>
          <td class="font-bold text-white">${esc(r.account_name)}</td>
          <td class="text-center">${esc(r.domain_field)}</td>
          <td class="text-center font-mono text-cyan-300">${esc(r.followers || '—')}</td>
          <td class="text-slate-400 max-w-xs truncate" title="${esc(r.notes || '')}">${esc(r.notes || '')}</td>
          <td class="text-center">${r.is_active ? '<span class="pill-ok">启用</span>' : '<span class="pill-muted">停用</span>'}</td>
          <td class="text-right whitespace-nowrap">
            <button data-act="toggle-redv" data-id="${r.id}" data-active="${r.is_active ? 0 : 1}" class="btn-ghost px-2 py-1 text-[11px]">${r.is_active ? '停用' : '启用'}</button>
            <button data-act="del-redv" data-id="${r.id}" class="btn-ghost text-rose-400 px-2 py-1 text-[11px]">删除</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="8" class="py-6 text-center text-slate-500">暂无红V账号</td></tr>'}
      </tbody></table></div>`;
    },
  };

  async function show(tab) {
    document.querySelectorAll('#admin-nav [data-tab]').forEach((b) => b.classList.toggle('chip-on', b.dataset.tab === tab));
    main.innerHTML = '<div class="skeleton h-40"></div>';
    try { await views[tab](); } catch (e) {
      if (e.status === 401 || e.status === 403) main.innerHTML = `<div class="card text-center py-10"><p class="text-slate-300">${esc(e.message)}</p><a href="/" class="btn-primary inline-flex mt-4 px-5 py-2 text-sm">返回首页登录管理员账号</a></div>`;
      else main.innerHTML = `<div class="card text-rose-300">${esc(e.message)}</div>`;
    }
  }

  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('#admin-nav [data-tab]');
    if (nav) { location.hash = nav.dataset.tab; return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    try {
      if (b.dataset.act === 'paid') { if (!confirm('确认已收到款项并开通该订单？')) return; await api(`/orders/${b.dataset.id}/mark-paid`, { method: 'POST', body: {} }); toast('已开通'); show('orders'); }
      if (b.dataset.act === 'cancel') { await api(`/orders/${b.dataset.id}/cancel`, { method: 'POST', body: {} }); toast('已取消'); show('orders'); }
      if (b.dataset.act === 'save-user' || b.dataset.act === 'toggle-user') {
        const tr = b.closest('tr'); const body = {};
        if (b.dataset.act === 'toggle-user') body.disabled = b.dataset.disabled === '1';
        else { tr.querySelectorAll('[data-field]').forEach((i) => { body[i.dataset.field] = i.value; }); if (body.planExpiresAt) body.planExpiresAt += ' 23:59:59'; }
        await api(`/users/${tr.dataset.uid}`, { method: 'PATCH', body }); toast('已保存'); show('users');
      }
      if (b.dataset.act === 'save-lead') {
        const c = b.closest('[data-lid]');
        await api(`/leads/${c.dataset.lid}`, { method: 'PATCH', body: { status: c.querySelector('[data-field=status]').value, notes: c.querySelector('[data-field=notes]').value } }); toast('已保存');
      }
      if (b.dataset.act === 'add-redv') {
        const modal = $('#redv-modal');
        if (modal) modal.classList.toggle('hidden');
      }
      if (b.dataset.act === 'submit-redv') {
        const platform = $('#new-redv-platform').value.trim();
        const accountName = $('#new-redv-name').value.trim();
        const domainField = $('#new-redv-field').value.trim();
        const followers = $('#new-redv-followers').value.trim();
        const notes = $('#new-redv-notes').value.trim();
        if (!platform || !accountName) return toast('请填写平台和账号名', false);
        await api('/redv', { method: 'POST', body: { platform, accountName, domainField, followers, notes } });
        toast('红V账号添加成功');
        show('redv');
      }
      if (b.dataset.act === 'toggle-redv') {
        await api(`/redv/${b.dataset.id}`, { method: 'PATCH', body: { isActive: b.dataset.active === '1' } });
        toast('状态已更新');
        show('redv');
      }
      if (b.dataset.act === 'del-redv') {
        if (!confirm('确认删除该红V账号？')) return;
        await api(`/redv/${b.dataset.id}`, { method: 'DELETE' });
        toast('已删除');
        show('redv');
      }

      // —— GEO Approval Inbox Actions ——
      if (b.dataset.act === 'filter-inbox') {
        await views.inbox(b.dataset.f);
      }
      if (b.dataset.act === 'open-gen-modal') {
        const m = $('#gen-modal');
        if (m) m.classList.remove('hidden');
      }
      if (b.dataset.act === 'close-gen-modal') {
        const m = $('#gen-modal');
        if (m) m.classList.add('hidden');
      }
      if (b.dataset.act === 'submit-gen') {
        const topic = $('#gen-topic').value.trim();
        const targetQuery = $('#gen-query').value.trim();
        const competitor = $('#gen-comp').value.trim();
        const targetToolUrl = $('#gen-tool').value.trim();
        if (!topic || !targetQuery) return toast('请填写文章主题和目标检索词', false);

        const btn = $('#btn-submit-gen');
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ 智能体深度撰写中 (约30~60秒)...';

        try {
          await api('/inbox/generate', { method: 'POST', body: { topic, targetQuery, competitor, targetToolUrl } });
          toast('草稿生成成功，已流转至人工审核箱！');
          $('#gen-modal').classList.add('hidden');
          show('inbox');
        } finally {
          btn.disabled = false;
          btn.textContent = oldText;
        }
      }
      if (b.dataset.act === 'view-draft') {
        const d = (await api(`/inbox/${b.dataset.id}`)).data;
        const modal = $('#draft-modal');
        modal.dataset.currentId = d.id;
        $('#draft-modal-title').textContent = `草稿详情 · #${d.id} ${d.title}`;
        $('#draft-modal-status').innerHTML = `状态: <span class="font-bold text-white">${d.status}</span> · 目标: <span class="text-cyan-300 font-mono">${esc(d.target_query)}</span>`;
        
        const approveBtn = $('#btn-approve-modal');
        if (approveBtn) approveBtn.style.display = d.status === 'pending' ? 'inline-flex' : 'none';

        $('#draft-modal-body').innerHTML = `
          <div class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">文章标题 (Title)</label>
                <input id="edit-draft-title" class="input w-full" value="${esc(d.title)}">
              </div>
              <div>
                <label class="block text-slate-400 mb-1">URL Slug</label>
                <input id="edit-draft-slug" class="input w-full font-mono text-cyan-300" value="${esc(d.slug)}">
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">分类</label>
                <input id="edit-draft-cat" class="input w-full" value="${esc(d.category)}">
              </div>
              <div>
                <label class="block text-slate-400 mb-1">CTA 落地工具链接</label>
                <input id="edit-draft-cta-url" class="input w-full" value="${esc(d.cta_url || '')}">
              </div>
              <div>
                <label class="block text-slate-400 mb-1">CTA 按钮文字</label>
                <input id="edit-draft-cta-text" class="input w-full" value="${esc(d.cta_text || '')}">
              </div>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">摘要 (Excerpt)</label>
              <textarea id="edit-draft-excerpt" class="input w-full h-16">${esc(d.excerpt)}</textarea>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-slate-400">Markdown 正文 (Body - 包含工程原理/算法/避坑/FAQ)</label>
                <span class="text-[11px] text-slate-500">字数: ${d.body?.length || 0} 字符</span>
              </div>
              <textarea id="edit-draft-body" class="input w-full font-mono text-[11px] leading-relaxed h-80">${esc(d.body)}</textarea>
            </div>

            ${d.faq_schema ? `
              <div>
                <label class="block text-slate-400 mb-1">Schema.org FAQPage (JSON-LD 结构化标记)</label>
                <pre class="bg-black/50 p-2.5 rounded border border-slate-800 text-[10px] text-emerald-400 font-mono overflow-x-auto">${esc(d.faq_schema)}</pre>
              </div>
            ` : ''}

            ${d.llms_snippet ? `
              <div>
                <label class="block text-slate-400 mb-1">llms.txt 知识胶囊片段</label>
                <pre class="bg-black/50 p-2.5 rounded border border-slate-800 text-[10px] text-cyan-300 font-mono overflow-x-auto">${esc(d.llms_snippet)}</pre>
              </div>
            ` : ''}
          </div>
        `;
        modal.classList.remove('hidden');
      }
      if (b.dataset.act === 'close-draft-modal') {
        const m = $('#draft-modal');
        if (m) m.classList.add('hidden');
      }
      if (b.dataset.act === 'save-draft-changes') {
        const modal = $('#draft-modal');
        const id = modal.dataset.currentId;
        const body = {
          title: $('#edit-draft-title').value.trim(),
          slug: $('#edit-draft-slug').value.trim(),
          category: $('#edit-draft-cat').value.trim(),
          excerpt: $('#edit-draft-excerpt').value.trim(),
          body: $('#edit-draft-body').value,
          ctaUrl: $('#edit-draft-cta-url').value.trim(),
          ctaText: $('#edit-draft-cta-text').value.trim(),
        };
        await api(`/inbox/${id}`, { method: 'PATCH', body });
        toast('草稿微调已保存');
        show('inbox');
      }
      if (b.dataset.act === 'approve-from-modal') {
        const modal = $('#draft-modal');
        const id = modal.dataset.currentId;
        if (!confirm('确认批准并一键发布该草稿？')) return;
        await api(`/inbox/${id}/approve`, { method: 'POST' });
        toast('已批准！草稿已进入发布队列');
        modal.classList.add('hidden');
        show('inbox');
      }
      if (b.dataset.act === 'approve-draft') {
        if (!confirm('确认批准并一键发布上线该草稿？')) return;
        await api(`/inbox/${b.dataset.id}/approve`, { method: 'POST' });
        toast('已批准！草稿已进入发布队列');
        show('inbox');
      }
      if (b.dataset.act === 'reject-draft') {
        if (!confirm('确认驳回并归档该草稿？')) return;
        await api(`/inbox/${b.dataset.id}/reject`, { method: 'POST' });
        toast('已驳回并归档');
        show('inbox');
      }
      if (b.dataset.act === 'copy-markdown') {
        const d = (await api(`/inbox/${b.dataset.id}`)).data;
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(d.body);
          toast('Markdown 正文已复制到剪贴板！');
        } else {
          toast('请手动在查看中复制', false);
        }
      }
    } catch (err) { toast(err.message, false); }
  });
  document.addEventListener('submit', (e) => { if (e.target.id === 'user-search') { e.preventDefault(); views.users(e.target.q.value.trim()).catch((err) => toast(err.message, false)); } });
  window.addEventListener('hashchange', () => show(location.hash.slice(1) || 'overview'));
  show(location.hash.slice(1) || 'overview');
})();
