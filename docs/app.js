(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyDAN1HLmcdUtoHYCDGioBsPJavcqs8SlAI',
    authDomain: 'research-stock-c8cd9.firebaseapp.com',
    projectId: 'research-stock-c8cd9',
    storageBucket: 'research-stock-c8cd9.firebasestorage.app',
    messagingSenderId: '381347087587',
    appId: '1:381347087587:web:33a3c71d1548206a3631d6'
  };

  let refreshTimer = null;
  let refreshRemaining = 0;
  let latestSnapshot = null;
  let latestOrigin = '每日同步';
  let selectedDate = '';
  let themeFilter = 'all';
  let statusFilter = 'all';
  let quickTagFilter = 'all';
  const historySnapshots = new Map();
  const checklistItems = ['政策原文级别（国务院 / 部委 / 地方）', '是否有明确资金或工具落地', '对应产业是否有订单或财报可验证点', '反证提醒（热度 vs 实际执行）'];
  const searchTargets = '#main, .site-footer';
  const evidenceTags = ['订单', '产能', '现金流', '估值'];
  const quickTags = { '设备更新': ['设备更新', '以旧换新', '超长期特别国债'], '半导体/算力': ['半导体', '算力', '人工智能', '信息通信', '通信网', '新一代通信', '工业互联网'], '财税改革': ['财政', '税', '国债', '专项债', '企业账款'], '降费出海': ['降费', '外贸', '出口', '商务部', '服务贸易', '外资'] };

  const stockMappings = [
    {
      id: 'treasury-bond',
      keywords: ['国债', '财政部', '债券', '资金'],
      title: '财政资金与利率债发行',
      angle: '今日若出现国债发行、财政融资或资金安排，优先核验金融机构资产配置、券商债券承销交易、以及财政资金形成实物工作量的速度。',
      stocks: [
        { code: '600030', name: '中信证券', market: '上交所公告检索', reason: '输入代码 600030，核验债券承销、固定收益交易、自营波动和资本市场活跃度。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '601398', name: '工商银行', market: '上交所公告检索', reason: '输入代码 601398，核验债券投资配置、净息差、信贷投放和资产质量。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '601318', name: '中国平安', market: '上交所公告检索', reason: '输入代码 601318，核验保险资金配置、投资收益率、权益和债券资产波动。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' }
      ],
      fail: '如果只是发行公告，缺少资金投向、承销变化、投资收益或订单兑现，不升级为公司结论。'
    },
    {
      id: 'quality-growth',
      keywords: ['高质量发展', '实物工作量', '财政支出', '城市更新', '消费', '投资'],
      title: '财政支出形成实物工作量',
      angle: '今日若出现逆周期调节、财政支出、债券资金加快形成实物工作量，应核验基建、城市更新和设备采购是否进入订单和回款。',
      stocks: [
        { code: '601668', name: '中国建筑', market: '上交所公告检索', reason: '输入代码 601668，核验新签合同、基建/房建结构、回款和经营现金流。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '601390', name: '中国中铁', market: '上交所公告检索', reason: '输入代码 601390，核验铁路、市政和城市更新订单，关注应收账款和现金流。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '000333', name: '美的集团', market: '深交所公告检索', reason: '输入代码 000333，核验补贴对出货、渠道库存和毛利率的影响。', url: 'https://www.szse.cn/disclosure/listed/notice/index.html' }
      ],
      fail: '如果政策叙事没有对应项目、订单、出货或现金流改善，只保留为宏观背景。'
    },
    {
      id: 'exchange-event',
      keywords: ['交易所', '停牌', '上交所', '上市公司公告', '监管'],
      title: '交易所公告与个券事件',
      angle: '交易所公告只作为市场运行提示；若没有具体上市公司公告、停复牌证券代码或监管问询，不进入重点股票研究。',
      stocks: [
        { code: '公告原文', name: '先查具体证券代码', market: '交易所公告', reason: '打开交易所公告，确认是否涉及上市公司、ETF、债券或其他产品。', url: 'https://www.sse.com.cn/disclosure/announcement/general/' },
        { code: '000001', name: '平安银行', market: '深交所公告检索', reason: '输入代码 000001，若公告涉及金融市场运行，再核验银行公告、财报和风险暴露。', url: 'https://www.szse.cn/disclosure/listed/notice/index.html' }
      ],
      fail: '如果只是单只基金或产品临时停牌，不能外推到行业或个股机会。'
    },
    {
      id: 'ai-infra',
      keywords: ['人工智能', '信息通信', '算力', '数据', '工业互联网', '智能化'],
      title: '人工智能与信息通信底座',
      angle: '近7日若出现 AI、算力、数据安全或信息通信政策，应核验需求是否从政策表述进入网络建设、服务器/光模块订单、工业软件部署和客户验收。',
      stocks: [
        { code: '601138', name: '工业富联', market: '上交所公告检索', reason: '输入代码 601138，核验 AI 服务器、云服务客户订单、毛利率和资本开支节奏。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '000938', name: '紫光股份', market: '深交所公告检索', reason: '输入代码 000938，核验 ICT 设备、网络产品收入、订单和应收账款变化。', url: 'https://www.szse.cn/disclosure/listed/notice/index.html' },
        { code: '300308', name: '中际旭创', market: '深交所公告检索', reason: '输入代码 300308，核验高速光模块订单、客户集中度、产能和现金流。', url: 'https://www.szse.cn/disclosure/listed/notice/index.html' }
      ],
      fail: '如果只有 AI 概念热度，缺少客户订单、收入确认、产能利用率或现金流证据，不升级为公司结论。'
    },
    {
      id: 'monetary-capital-market',
      keywords: ['人民银行', '货币', '信贷', '利率', '资本市场', '证监会', '金融'],
      title: '货币金融与资本市场政策',
      angle: '近7日若出现货币、信贷、资本市场或监管政策，应核验银行净息差、券商成交/投行业务、保险投资收益和风险资产质量。',
      stocks: [
        { code: '600036', name: '招商银行', market: '上交所公告检索', reason: '输入代码 600036，核验信贷投放、净息差、资产质量和手续费收入。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '600030', name: '中信证券', market: '上交所公告检索', reason: '输入代码 600030，核验成交活跃度、投行业务、资管和自营投资波动。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '601601', name: '中国太保', market: '上交所公告检索', reason: '输入代码 601601，核验权益/债券配置、投资收益率和负债端保费质量。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' }
      ],
      fail: '如果只是宏观流动性表述，缺少成交、承销、信贷、利差或投资收益兑现，不直接外推为个股机会。'
    },
    {
      id: 'trade-consumption',
      keywords: ['商务部', '外贸', '消费', '以旧换新', '出口', '进口', '服务贸易'],
      title: '外贸消费与流通链条',
      angle: '近7日若出现外贸、消费、以旧换新或流通政策，应核验订单、渠道库存、补贴核销、毛利率和汇率影响。',
      stocks: [
        { code: '600415', name: '小商品城', market: '上交所公告检索', reason: '输入代码 600415，核验外贸景气、市场成交、平台业务和现金流。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '000333', name: '美的集团', market: '深交所公告检索', reason: '输入代码 000333，核验家电更新补贴、出货、库存和毛利率。', url: 'https://www.szse.cn/disclosure/listed/notice/index.html' },
        { code: '601888', name: '中国中免', market: '上交所公告检索', reason: '输入代码 601888，核验消费复苏、客流、客单价和库存周转。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' }
      ],
      fail: '如果只是促消费口号，缺少补贴落地、订单出货、客流或利润率改善，不进入高优先级。'
    },
    {
      id: 'global-market',
      keywords: ['油价', '原油', '美股', '港股', 'A股', '板块', '大涨', '涨停', '黄金', '金价', '美元', '汇率', '通胀', '业绩', '净利', '毛利率', '农业', '农产品', '粮食', '猪肉', '芯片', '半导体', '行情'],
      title: '全球市场与热门题材',
      angle: '近7日若出现能源、有色、贵金属、农业、半导体或全球市场行情，应核验价格是否传导到上市公司营收、毛利、库存和订单，再决定是否进入题材研究。',
      stocks: [
        { code: '601857', name: '中国石油', match: ['油价', '原油', '能源'], market: '上交所公告检索', reason: '输入代码 601857，核验油价与油气量价、上游成本、天然气和炼化利润。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '600028', name: '中国石化', match: ['油价', '原油', '炼化'], market: '上交所公告检索', reason: '输入代码 600028，核验油价传导、炼化价差、成品油与化工毛利。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '600547', name: '山东黄金', match: ['黄金', '金价', '贵金属'], market: '上交所公告检索', reason: '输入代码 600547，核验金价、产量、克金成本和矿山现金流。', url: 'https://www.sse.com.cn/assortment/stock/list/info/announcement/' },
        { code: '000876', name: '新希望', match: ['猪肉', '生猪', '农业', '农产品', '粮食'], market: '深交所公告检索', reason: '输入代码 000876，核验生猪/饲料价格、成本、出栏量和现金流。', url: 'https://www.szse.cn/disclosure/listed/notice/index.html' },
        { code: '002371', name: '北方华创', match: ['芯片', '半导体'], market: '深交所公告检索', reason: '输入代码 002371，核验半导体设备订单、客户验收、毛利率和资本开支。', url: 'https://www.szse.cn/disclosure/listed/notice/index.html' }
      ],
      fail: '如果只是行情涨幅或题材热度，缺少价格/订单/毛利/现金流的公司公告验证，不升级为个股结论。'
    }
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }
  function setLoadingStatus(selector, text, state = 'ready') {
    const node = document.querySelector(selector);
    if (!node) return;
    node.textContent = text;
    node.dataset.state = state;
    node.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }
  function storageKey(scope, id, label) {
    return `research-stock:${scope}:${id}:${label}`;
  }
  function storedChecked(key) {
    try { return window.localStorage.getItem(key); }
    catch { return null; }
  }
  function isChecked(key, defaultValue = false) {
    const stored = storedChecked(key);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return defaultValue;
  }
  function saveChecked(key, checked) {
    try { window.localStorage.setItem(key, checked ? '1' : '0'); }
    catch {}
  }
  function checkboxMarkup(key, label, extra = '', defaultChecked = false) {
    return `<label class="check-pill ${extra}"><input type="checkbox" data-check-key="${escapeHtml(key)}" ${isChecked(key, defaultChecked) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  }
  function renderVerifyChecklist(event) {
    const id = event.sourceUrl || event.id || `${event.publishedAt || 'date'}-${event.title || 'event'}`;
    const items = checklistItems.map((item) => ({ item, key: storageKey('event', id, item) }));
    const checkedCount = items.filter(({ key }) => isChecked(key)).length;
    return `<details class="verify-list"><summary><span class="verify-title"><span>一键核验</span><span>清单</span></span><small class="verify-count">已检查 ${checkedCount}/${items.length}</small></summary><div class="verify-list-grid">${items.map(({ item, key }) => checkboxMarkup(key, item)).join('')}</div><div class="verify-actions"><button type="button" data-save-checklist>保存勾选</button><button type="button" data-reset-checklist>清空</button><span data-checklist-status>已保存：${checkedCount}/${items.length}</span></div></details>`;
  }
  function evidenceSupport(mapping, stock, tag) {
    const text = `${stock.reason} ${mapping.title}`;
    const rules = {
      '订单': ['订单', '合同', '承销', '成交', '出货', '客流', '采购', '新签合同', '平台业务'],
      '产能': ['产能', '设备', '服务器', '光模块', '网络产品', '算力', '资本开支', '渠道库存'],
      '现金流': ['现金流', '回款', '净息差', '投资收益', '保费', '手续费收入', '资产质量'],
      '估值': ['估值', 'PE', 'PB', '市场活跃度', '成交活跃度', '风险资产', '自营投资波动']
    };
    return (rules[tag] || []).some((keyword) => text.includes(keyword));
  }
  function renderEvidenceTags(mapping, stock) {
    return `<div class="evidence-tags">${evidenceTags.map((tag) => {
      const supported = evidenceSupport(mapping, stock, tag);
      const label = supported ? `${tag}：当前摘要已触发，需查公告验证` : `${tag}：当前摘要未直接支撑`;
      return checkboxMarkup(storageKey('stock', `${mapping.id}-${stock.code}`, tag), label, `evidence-tag ${supported ? 'is-supported' : 'is-muted'}`, supported);
    }).join('')}</div>`;
  }
  function verificationPrompt(event) {
    return [
      `摘要：${event.title || '标题待核验'}`,
      `来源：${event.source || '来源待核验'}`,
      `发布时间：${event.publishedAt || '时间待核验'}`,
      `原文链接：${event.sourceUrl || '链接待核验'}`,
      '',
      '核验清单：',
      '1. 政策原文级别（国务院 / 部委 / 地方）',
      '2. 是否有明确资金或工具落地',
      '3. 对应产业是否有订单或财报可验证点',
      '4. 反证提醒（热度 vs 实际执行）',
      '',
      '下一步：先查原文，再查对应公司公告、订单、现金流和估值。'
    ].join('\n');
  }
  function formatSyncTime(value) {
    if (!value) return '待同步';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16).replace('T', ' ');
    const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    const pick = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`;
  }
  function dateDaysAgo(baseText, days) {
    const base = baseText ? new Date(`${baseText}T00:00:00+08:00`) : new Date();
    base.setDate(base.getDate() - days);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(base);
  }
  function todayAbEvents(events) {
    const directToday = events.filter((event) => event.isToday && event.displayInDaily !== false && isDisplayablePolicy(event));
    if (directToday.length) return directToday;
    // 当天未抓到可确认的 A/B 原文时，回退到近7日滚动池里最新一条，避免“今日”误报为0；
    // 该条会标注为“近7日沿用”，不与真正当天原文混淆。
    const weekly = events.filter((event) => event.fetchStatus !== 'error' && ['A', 'B'].includes(event.grade) && event.displayInWeekly === true && isDisplayablePolicy(event));
    if (!weekly.length) return [];
    const latestDate = weekly.reduce((max, event) => {
      const date = String(event.publishedAt || '').slice(0, 10);
      return date > max ? date : max;
    }, '');
    return weekly.filter((event) => String(event.publishedAt || '').slice(0, 10) === latestDate).slice(0, 3);
  }
  function eventDateText(event, snapshot) {
    const value = event?.publishedAt || event?.date || snapshot?.asOf || selectedDate;
    const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : (snapshot?.asOf || selectedDate || '');
  }
  function daysBetween(baseText, dateText) {
    const base = new Date(`${baseText}T00:00:00+08:00`);
    const date = new Date(`${dateText}T00:00:00+08:00`);
    if (Number.isNaN(base.getTime()) || Number.isNaN(date.getTime())) return Infinity;
    return Math.round((base - date) / 86400000);
  }
  function weeklyAbEvents(snapshot) {
    const baseDate = snapshot?.asOf || selectedDate;
    const snapshots = snapshot?.status === '近7日筛选池派生摘要' ? new Map() : new Map(historySnapshots);
    if (snapshot?.asOf) snapshots.set(snapshot.asOf, snapshot);
    const byKey = new Map();
    snapshots.forEach((item) => {
      const events = Array.isArray(item?.events) ? item.events : [];
      events.forEach((event) => {
        if (!isDisplayablePolicy(event)) return;
        const dateText = eventDateText(event, item);
        const hasAge = event.ageDays !== null && event.ageDays !== undefined && event.ageDays !== '';
        const age = hasAge && Number.isFinite(Number(event.ageDays)) ? Number(event.ageDays) : daysBetween(baseDate, dateText);
        if (age < 0 || age > 6) return;
        if (event.displayInDaily === false && event.displayInWeekly !== true) return;
        const key = event.sourceUrl || `${event.title}-${event.source}-${dateText}`;
        const isCurrentDay = dateText === baseDate;
        const pooled = { ...event, poolDate: dateText, isCurrentDay, poolStatus: isCurrentDay ? 'today' : 'retained', poolTheme: themeForEvent(event), quickTag: quickTagForEvent(event) };
        if (!byKey.has(key)) byKey.set(key, pooled);
      });
    });
    return [...byKey.values()].sort((a, b) => Number(b.isCurrentDay) - Number(a.isCurrentDay) || String(a.grade || '').localeCompare(String(b.grade || '')) || String(b.poolDate || '').localeCompare(String(a.poolDate || ''))).slice(0, 20);
  }
  function sourceClass(event) {
    if (event?.grade === 'A') return 'level-a';
    if (event?.grade === 'B') return 'level-b';
    return 'level-other';
  }
  function credibilityLabel(event) {
    if (event?.grade === 'A') return 'A / 官方';
    if (event?.grade === 'B') return 'B / 权威媒体';
    return `${event?.grade || '其他'} / 其他`;
  }
  function policyLevelLabel(event) {
    if (event?.grade === 'A') return 'A级 · 国务院/央行/财政部等高权重原文';
    if (event?.grade === 'B') return 'B级 · 部委指引/交易所正式规则';
    return '其他 · 仅作背景';
  }
  function hasDirectCompanyEvidence(event) {
    const codes = Array.isArray(event?.stockCodes) ? event.stockCodes : [];
    const names = Array.isArray(event?.relatedStocks) ? event.relatedStocks : [];
    const rows = Array.isArray(event?.companyVerifications) ? event.companyVerifications : [];
    return rows.length > 0 || codes.some((code) => /^\d{6}$/.test(String(code))) || names.some((name) => String(name || '').trim().length >= 2);
  }
  function policySelectionGate(event) {
    const text = `${event?.title || ''} ${event?.industry || ''} ${event?.read || ''} ${event?.desc || ''}`;
    const hasCompany = hasDirectCompanyEvidence(event);
    const hasFunding = /(亿元|资金|国债|财政|补贴|专项债)/.test(text);
    const hasExecution = /(实施|申报|采购|下达|续发行|公告|通知|意见|数据|指数)/.test(text);
    if (hasCompany) {
      return {
        level: '可进入个股核验',
        status: '进入观察名单前置检查',
        action: '逐项查公告、主营占比、订单/收入、现金流和估值。',
        tone: 'action'
      };
    }
    if (hasFunding || hasExecution) {
      return {
        level: hasFunding ? '政策/资金线索' : '政策/数据线索',
        status: '生成候选，等待验证',
        action: '生成研究候选股并按公告、订单、招投标、财报、现金流逐项核验；不满足即剔除。',
        tone: 'watch'
      };
    }
    return {
      level: '背景信息',
      status: '不进入选股流程',
      action: '不再展开资金、周期、公司表格，避免把低信息密度内容堆到页面。',
      tone: 'muted'
    };
  }
  function renderSelectionGate(event) {
    const gate = policySelectionGate(event);
    return `<div class="selection-gate ${escapeHtml(gate.tone)}"><div><span>政策价值</span><strong>${escapeHtml(gate.level)}</strong></div><div><span>选股状态</span><strong>${escapeHtml(gate.status)}</strong></div><div><span>下一步</span><strong>${escapeHtml(gate.action)}</strong></div></div>`;
  }
  function companyRowsForEvent(event) {
    const rows = Array.isArray(event.companyVerifications) ? event.companyVerifications : [];
    if (rows.length) return rows;
    const codes = Array.isArray(event.stockCodes) ? event.stockCodes : [];
    const names = Array.isArray(event.relatedStocks) ? event.relatedStocks : [];
    return codes.map((code, index) => ({ code, name: names[index] || '待核验公司', match: '需按公告核实业务占比', evidence: '等待上市公司公告、互动易或财报证据', risk: '若无订单、收入或现金流证据，不纳入结论' }));
  }
  function renderCompanyVerifyBox(event) {
    const rows = companyRowsForEvent(event);
    if (!rows.length) return '';
    const body = rows.map((row) => `<tr><td><strong>${escapeHtml(row.code || '--')} ${escapeHtml(row.name || '')}</strong></td><td>${escapeHtml(row.match || '业务匹配度待核实')}</td><td>${escapeHtml(row.evidence || '等待公告/互动易或财报证据')}</td><td>${escapeHtml(row.risk || '缺少公司证据时排除')}</td></tr>`).join('');
    return `<div class="company-verify-box"><h4>上市公司核验证据链（只看公告与财报）</h4><table><thead><tr><th>代码/名称</th><th>业务匹配度</th><th>关键核验证据（公告/互动易）</th><th>风险排除项</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function researchCandidatesForEvent(event) {
    const mappings = mappingsFor([event]).slice(0, 2);
    return mappings.flatMap((mapping) => mapping.stocks.filter((stock) => /^\d{6}$/.test(String(stock.code || ''))).slice(0, 3).map((stock) => ({ mapping, stock }))).slice(0, 5);
  }
  function renderResearchCandidates(event) {
    const candidates = researchCandidatesForEvent(event);
    if (!candidates.length) {
      return `<div class="candidate-box muted"><h4>研究目标</h4><p>这条信息暂时只能作为宏观背景；没有足够产业关键词映射到候选股池，不生成股票研究目标。</p></div>`;
    }
    return `<div class="candidate-box"><h4>研究推荐目标（非买卖建议）</h4><p>当前政策信息没有直接公司公告证据，因此只生成“优先核验候选”，用于下一步筛选，不代表已确认受益。</p><div class="candidate-grid">${candidates.map(({ mapping, stock }, index) => `<article><span>${String(index + 1).padStart(2, '0')} · ${escapeHtml(mapping.title)}</span><strong>${escapeHtml(stock.code)} ${escapeHtml(stock.name)}</strong><small>${escapeHtml(stock.reason)}</small><em>筛选门槛：公告/互动易/财报中出现订单、收入、现金流、产能或估值验证；不满足则剔除。</em><a href="${escapeHtml(stock.url)}" target="_blank" rel="noreferrer">打开公告检索</a></article>`).join('')}</div></div>`;
  }
  function renderSummaryCards(todayEvents, snapshotDate = selectedDate, totalCount = todayEvents.length) {
    const flow = document.querySelector('#summary-card-flow');
    if (!flow) return;
    if (!todayEvents.length) {
      flow.innerHTML = '<article class="summary-empty-card"><strong>今日暂无达到 A/B 级公开信息门槛。</strong><small>历史摘要可查看近7日回顾，昨日摘要已存档。</small></article>';
      setLoadingStatus('#summary-loading-status', '摘要已加载：暂无达到 A/B 级门槛的信息', 'empty');
      applySearchHighlight();
      return;
    }
    setLoadingStatus('#summary-loading-status', `近7日筛选池已加载：${todayEvents.length}/${totalCount} 条 A/B 级信息`, 'ready');
    flow.innerHTML = todayEvents.map((event, index) => `
      <details class="summary-card policy-card" data-level="${escapeHtml(event.grade || '其他')}">
        <summary>
          <span class="summary-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="summary-copy">
            <a class="summary-title" href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">${escapeHtml(event.title)}</a>
            <span class="summary-read">${escapeHtml(event.read || event.desc || '等待摘要口径')}</span>
            <span class="pool-date ${event.poolStatus === 'today' ? 'today' : ''}">${event.poolStatus === 'today' ? '今日新增' : `近7日留存 · ${escapeHtml(event.poolDate || event.publishedAt || '日期待核验')}`} · ${escapeHtml(event.poolTheme || '其他')}</span>
            <button class="copy-verify" type="button" data-copy-prompt="${escapeHtml(verificationPrompt(event))}">复制核验提示</button>
            ${renderHistoryHint(event, snapshotDate)}
          </span>
          <span class="summary-meta">
            <span class="source-tag ${sourceClass(event)}">${escapeHtml(policyLevelLabel(event))}</span>
            <span>${escapeHtml(event.source || '来源待核验')}</span>
            <time>${escapeHtml(event.publishedAt || '时间待核验')}</time>
          </span>
        </summary>
        ${renderSelectionGate(event)}
        ${hasDirectCompanyEvidence(event) ? renderCompanyVerifyBox(event) : renderResearchCandidates(event)}
        <div class="summary-detail-table-wrap">
          <table class="summary-detail-table">
            <thead><tr><th>事实</th><th>摘要口径</th><th>来源</th><th>发布时间</th><th>可信度说明</th></tr></thead>
            <tbody><tr>
              <td data-label="事实"><a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.title)}</a></td>
              <td data-label="摘要口径"><p>${escapeHtml(event.read || event.desc || '等待摘要口径')}</p></td>
              <td data-label="来源"><span class="source-tag ${sourceClass(event)}">${escapeHtml(event.grade || '其他')} / ${escapeHtml(event.source || '来源待核验')}</span></td>
              <td data-label="发布时间"><time>${escapeHtml(event.publishedAt || '时间待核验')}</time></td>
              <td data-label="可信度说明"><p><strong>${escapeHtml(event.confidence || '待复核')}</strong>${escapeHtml(event.confidenceNote || '')}</p></td>
            </tr></tbody>
          </table>
        </div>
        <div class="summary-verify-panel">${renderVerifyChecklist(event)}</div>
      </details>`).join('');
    applySearchHighlight();
  }
  function setRefreshButton(active) {
    const button = document.querySelector('#refresh-data');
    if (!button) return;
    button.disabled = active;
    button.textContent = active ? `${refreshRemaining}秒后可再次刷新` : '手动刷新';
  }
  function startRefreshCooldown() {
    window.clearInterval(refreshTimer);
    refreshRemaining = 60;
    setRefreshButton(true);
    refreshTimer = window.setInterval(() => {
      refreshRemaining -= 1;
      if (refreshRemaining <= 0) {
        window.clearInterval(refreshTimer);
        refreshTimer = null;
        setRefreshButton(false);
        return;
      }
      setRefreshButton(true);
    }, 1000);
  }
  function tokensFor(value) {
    const text = String(value || '');
    const tokens = ['设备更新', '以旧换新', '国债', '财政', '资金', '金融', '货币', '信贷', '资本市场', '交易所', '上市公司', '工业互联网', '人工智能', '信息通信', '工业', '消费', '投资', '外贸', '统计'];
    return tokens.filter((token) => text.includes(token));
  }
  function themeForEvent(event) {
    const text = `${event.title} ${event.source} ${event.industry} ${event.read} ${event.desc}`;
    if (['国债', '财政', '资金', '人民银行', '货币', '信贷', '资本市场', '金融'].some((keyword) => text.includes(keyword))) return '财政金融';
    if (['人工智能', '信息通信', '算力', '数据', '工业互联网'].some((keyword) => text.includes(keyword))) return 'AI通信';
    if (['商务部', '消费', '外贸', '以旧换新', '出口', '进口'].some((keyword) => text.includes(keyword))) return '消费外贸';
    if (['交易所', '停牌', '上市公司公告', '监管', '证监会'].some((keyword) => text.includes(keyword))) return '交易所监管';
    return '其他';
  }
  function quickTagForEvent(event) {
    const text = `${event.title || ''} ${event.source || ''} ${event.industry || ''} ${event.read || ''} ${event.desc || ''}`;
    return Object.entries(quickTags).find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] || '其他';
  }
  function isDisplayablePolicy(event) {
    if (!event || event.fetchStatus === 'error') return false;
    if (!['A', 'B'].includes(event.grade)) return false;
    if (event.grade === 'B' && /人民日报|人民网|央视网|新华社/.test(event.source || '') && !/国务院|部委|工信部|人民银行|证监会|财政部|发改委|交易所|公告|通知|细则|规划|方案/.test(`${event.title || ''} ${event.desc || ''}`)) return false;
    return event.displayInDaily !== false || event.displayInWeekly === true || event.fetchStatus === 'fallback';
  }
  function applyPoolFilters(events) {
    return events.filter((event) => {
      if (themeFilter !== 'all' && event.poolTheme !== themeFilter) return false;
      if (statusFilter === 'today' && event.poolStatus !== 'today') return false;
      if (statusFilter === 'retained' && event.poolStatus !== 'retained') return false;
      if (quickTagFilter !== 'all' && quickTagForEvent(event) !== quickTagFilter) return false;
      return true;
    });
  }

  function dateOptions(baseDate) {
    return Array.from({ length: 7 }, (_, index) => dateDaysAgo(baseDate, index));
  }
  function poolEventsByDate(snapshot) {
    const map = new Map();
    const previousSelected = selectedDate;
    if (snapshot?.asOf) selectedDate = snapshot.asOf;
    weeklyAbEvents(snapshot).forEach((event) => {
      const dateText = event.poolDate || event.publishedAt || eventDateText(event, snapshot);
      if (!dateText) return;
      if (!map.has(dateText)) map.set(dateText, []);
      map.get(dateText).push(event);
    });
    selectedDate = previousSelected;
    return map;
  }
  function deriveSnapshotForDate(dateText, baseSnapshot = latestSnapshot) {
    if (!baseSnapshot || !dateText) return null;
    const events = (poolEventsByDate(baseSnapshot).get(dateText) || []).map((event) => ({ ...event, isToday: true }));
    return {
      ...baseSnapshot,
      asOf: dateText,
      status: events.length ? '近7日筛选池派生摘要' : '该日暂无可展示条目',
      headline: events.length ? `${dateText} 近7日池内可展示信息 ${events.length} 条` : `${dateText} 暂无财经相关 A/B 条目`,
      brief: { ...baseSnapshot.brief, judgement: events.length ? '该日期没有独立存档时，页面从当前近7日筛选池中提取同日条目。' : '该日期在当前近7日筛选池内没有达到 A/B 门槛的财经相关信息。' },
      events
    };
  }
  function eventsForSnapshot(snapshot) {
    return todayAbEvents(Array.isArray(snapshot?.events) ? snapshot.events : []);
  }
  function historyMatches(event, currentDate) {
    const eventTokens = tokensFor(`${event.title} ${event.industry} ${event.read} ${event.desc}`);
    if (!eventTokens.length) return [];
    return [...historySnapshots.values()]
      .filter((snapshot) => snapshot?.asOf && snapshot.asOf !== currentDate)
      .flatMap((snapshot) => eventsForSnapshot(snapshot).map((item) => ({ snapshot, item })))
      .filter(({ item }) => {
        const itemTokens = tokensFor(`${item.title} ${item.industry} ${item.read} ${item.desc}`);
        return eventTokens.some((token) => itemTokens.includes(token));
      })
      .slice(0, 8);
  }
  function renderHistoryHint(event, currentDate) {
    const matches = historyMatches(event, currentDate);
    if (!matches.length) return '';
    const timeline = matches.map(({ snapshot, item }) => `<button type="button" data-history-date="${escapeHtml(snapshot.asOf)}"><span>${escapeHtml(snapshot.asOf)}</span>${escapeHtml(item.source || '来源待核验')} · ${escapeHtml(item.title || '标题待核验')}</button>`).join('');
    return `<details class="history-hint"><summary>此前出现过 ${matches.length} 次 · 时间线</summary><div>${timeline}</div></details>`;
  }
  function renderDateSelector(baseDate, availableDates) {
    const select = document.querySelector('#summary-date-select');
    if (!select) return;
    const options = dateOptions(baseDate);
    const poolMap = poolEventsByDate(latestSnapshot);
    select.innerHTML = options.map((dateText) => {
      const source = availableDates.has(dateText) ? '存档' : (poolMap.has(dateText) ? '近7日池' : '无条目');
      const count = poolMap.get(dateText)?.length || 0;
      const label = source === '无条目' ? `${dateText}（无财经A/B条目）` : `${dateText}（${source}${count ? ` · ${count}条` : ''}）`;
      return `<option value="${escapeHtml(dateText)}" ${dateText === selectedDate ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }
  function dailyCountForDate(dateText, currentSnapshot = latestSnapshot) {
    const snapshot = historySnapshots.get(dateText);
    const archivedCount = snapshot ? eventsForSnapshot(snapshot).length : 0;
    if (archivedCount > 0) return { count: archivedCount, hasRecord: true };
    const poolEvents = poolEventsByDate(currentSnapshot).get(dateText) || [];
    const poolCount = poolEvents.filter((event) => event.fetchStatus !== 'error' && ['A', 'B'].includes(event.grade) && (event.displayInDaily !== false || event.displayInWeekly === true)).length;
    if (poolCount > 0) return { count: poolCount, hasRecord: true };
    return { count: 0, hasRecord: false };
  }
  function setDailyCompareText(text, tone = 'neutral') {
    document.querySelectorAll('#daily-compare, #sync-compare').forEach((node) => {
      node.textContent = text;
      node.className = node.id === 'sync-compare' ? `daily-compare sync-compare ${tone}` : `daily-compare ${tone}`;
    });
  }
  function renderDailyCompare(currentDate, state, currentSnapshot = latestSnapshot) {
    const todayLabel = currentDate === latestSnapshot?.asOf ? '今日' : currentDate;
    const previousLabel = currentDate === latestSnapshot?.asOf ? '昨日' : '前日';
    const current = state && state.asOf === currentDate ? { count: state.todayAbCount, hasRecord: state.todayAbCount > 0 } : dailyCountForDate(currentDate, currentSnapshot);
    const previous = dailyCountForDate(dateDaysAgo(currentDate, 1), currentSnapshot);
    if (!previous.hasRecord) {
      setDailyCompareText(`${todayLabel} ${current.count} 条（${previousLabel}无记录）`, 'neutral');
      return;
    }
    const diff = current.count - previous.count;
    const prefix = diff > 0 ? '+' : '';
    setDailyCompareText(`${todayLabel} ${current.count} 条（较${previousLabel} ${prefix}${diff}）`, diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral');
  }
  function relatedToToday(event, todayEvents) {
    if (!todayEvents.length) return false;
    const eventTokens = tokensFor(`${event.title} ${event.industry} ${event.read} ${event.desc}`);
    if (!eventTokens.length) return false;
    return todayEvents.some((todayEvent) => {
      if (todayEvent.source && event.source && todayEvent.source === event.source) return true;
      const todayTokens = tokensFor(`${todayEvent.title} ${todayEvent.industry} ${todayEvent.read} ${todayEvent.desc}`);
      return eventTokens.some((token) => todayTokens.includes(token));
    });
  }
  function mappingsFor(events) {
    const themeToMappingId = {
      'AI通信': 'ai-infra',
      '财政金融': 'monetary-capital-market',
      '消费外贸': 'trade-consumption',
      '交易所监管': 'exchange-event'
    };
    const text = events.map((event) => `${event.title} ${event.source} ${event.industry} ${event.read} ${event.desc}`).join(' ');
    const byTheme = stockMappings.filter((mapping) => events.some((event) => themeToMappingId[event.theme] === mapping.id));
    const marketTheme = stockMappings.filter((mapping) => {
      if (!events.some((event) => event.theme === '市场题材')) return false;
      if (['油价', '原油', '黄金', '金价', '贵金属', '猪肉', '生猪', '农产品', '粮食'].some((k) => text.includes(k))) return mapping.id === 'global-market';
      if (['业绩', '净利', '毛利率', '银行', '保险', '化债', '信贷', '金融', '利率'].some((k) => text.includes(k))) return mapping.id === 'monetary-capital-market';
      if (['芯片', '半导体', '科技', 'AI', '算力'].some((k) => text.includes(k))) return mapping.id === 'ai-infra';
      return false;
    });
    const marketFallback = events.some((event) => event.theme === '市场题材') ? stockMappings.filter((mapping) => mapping.id === 'global-market') : [];
    const byKeyword = stockMappings.filter((mapping) => mapping.keywords.some((keyword) => text.includes(keyword)));
    if (byTheme.length) return byTheme;
    if (marketTheme.length) return marketTheme;
    if (byKeyword.length) return byKeyword;
    return marketFallback;
  }
  function discoverySignalsForSnapshot(snapshot, poolEvents = []) {
    const directSignals = Array.isArray(snapshot?.discoverySignals) ? snapshot.discoverySignals : [];
    if (directSignals.length) return directSignals;
    return poolEvents.map((event, index) => ({
      id: `pool-signal-${event.id || index}`,
      title: event.title,
      desc: event.read || event.desc || '近7日官方摘要派生出的研究线索。',
      source: event.source,
      sourceUrl: event.sourceUrl,
      sourceLevel: event.sourceLevel || event.grade,
      publishedAt: event.publishedAt || event.poolDate || '',
      theme: event.poolTheme || themeForEvent(event),
      heat: event.poolStatus === 'today' ? 88 : 64,
      verifyAction: '先回溯官方原文，再查交易所公告、公司公告、订单、收入、现金流和估值。',
      counter: event.counter || '只有主题线索不能直接推导到上市公司，需要公告、财报和现金流验证。'
    })).slice(0, 8);
  }
  function signalCandidates(signal) {
    const text = `${signal.title || ''} ${signal.source || ''} ${signal.industry || ''} ${signal.desc || ''}`;
    // “其他”主题若只是榜单栏目名、纯热度话题或弱产业词，不给候选股，避免信息堆积
    if (signal.theme === '其他') {
      const weakOnly = ['数字货币', '金色财经', '智通财经', '第一财经', '财经', '股票', '证券', '今天', '为什么', '怎么', '如何', '什么'].some((k) => text.includes(k));
      const concrete = ['油价', '原油', '黄金', '猪肉', '农产品', '粮食', '芯片', '半导体', '银行', '保险', '地产', '房地产', '化债', '信贷', '净利', '毛利率', '涉房', 'A股', '港股', '美股'].some((k) => text.includes(k));
      if (weakOnly && !concrete) return [];
    }
    const matched = mappingsFor([signal]).flatMap((mapping) => mapping.stocks
      .filter((stock) => /^\d{6}$/.test(String(stock.code || '')))
      .filter((stock) => !stock.match || stock.match.some((keyword) => text.includes(keyword)))
      .map((stock) => ({ mapping, stock })));
    if (matched.length) return matched.slice(0, 3);
    return mappingsFor([signal]).flatMap((mapping) => mapping.stocks
      .filter((stock) => /^\d{6}$/.test(String(stock.code || '')))
      .slice(0, 2)
      .map((stock) => ({ mapping, stock }))).slice(0, 2);
  }
  function renderDiscoveryRadar(snapshot, poolEvents = []) {
    const grid = document.querySelector('#discovery-grid');
    if (!grid) return;
    const signals = discoverySignalsForSnapshot(snapshot, poolEvents)
      .filter((signal) => signal && signal.title && signalCandidates(signal).length > 0)
      .sort((a, b) => Number(b.heat || 0) - Number(a.heat || 0))
      .slice(0, 8);
    setLoadingStatus('#discovery-loading-status', signals.length ? `发现雷达已生成：${signals.length} 条可进入核验的研究线索` : '发现雷达已生成：暂无可映射到核验对象的线索', signals.length ? 'ready' : 'empty');
    grid.innerHTML = signals.length ? signals.map((signal, index) => {
      const candidates = signalCandidates(signal);
      return `<article class="discovery-card">
        <div class="discovery-top"><span>${String(index + 1).padStart(2, '0')} · ${escapeHtml(signal.theme || '其他')}</span><strong>${escapeHtml(signal.sourceLevel || '发现')}</strong></div>
        <h3><a href="${escapeHtml(signal.sourceUrl || '#')}" target="_blank" rel="noreferrer">${escapeHtml(signal.title)}</a></h3>
        <p>${escapeHtml(signal.desc || '热榜和检索结果只作为发现线索，不进入政策事实计数。')}</p>
        <div class="selection-note"><strong>回溯动作</strong><span>${escapeHtml(signal.verifyAction || '先查 A/B 级官网原文，再查公告、财报和现金流。')}</span></div>
        <div class="candidate-strip">${candidates.map(({ mapping, stock }) => `<a href="${escapeHtml(stock.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(mapping.title)}</span><strong>${escapeHtml(stock.code)} ${escapeHtml(stock.name)}</strong><small>${escapeHtml(stock.reason)}</small></a>`).join('')}</div>
        <div class="fail-line"><strong>不通过条件</strong>${escapeHtml(signal.counter || '只有热度、主题或行业方向时，不形成个股结论。')}</div>
      </article>`;
    }).join('') : '<article class="discovery-card discovery-empty"><div class="discovery-top"><span>发现雷达</span><strong>不强行展示</strong></div><h3>暂无可进入核验的热议题</h3><p>未抓到可映射到公告、财报或公司核验路径的热榜/检索线索，页面不会为了数量堆积信息。</p></article>';
    applySearchHighlight();
  }
  function eventTitleFor(mapping, events) {
    const event = events.find((item) => mapping.keywords.some((keyword) => `${item.title} ${item.source} ${item.industry} ${item.read} ${item.desc}`.includes(keyword)));
    return event ? event.title : '等待当日摘要匹配';
  }
  function stockEvidenceEvents(mapping, stock, events) {
    const code = String(stock.code || '').trim();
    const name = String(stock.name || '').trim();
    const hasConcreteCode = /^\d{6}$/.test(code);
    if (!hasConcreteCode || !name || name.includes('先查')) return [];
    return events.filter((event) => {
      if (event.fetchStatus === 'error' || !['A', 'B'].includes(event.grade) || !event.sourceUrl) return false;
      const text = `${event.title || ''} ${event.source || ''} ${event.industry || ''} ${event.read || ''} ${event.desc || ''}`;
      const stockCodes = Array.isArray(event.stockCodes) ? event.stockCodes.map(String) : [];
      const relatedStocks = Array.isArray(event.relatedStocks) ? event.relatedStocks.map(String) : [];
      const directHit = text.includes(code) || text.includes(name) || stockCodes.includes(code) || relatedStocks.some((item) => item.includes(code) || item.includes(name));
      if (!directHit) return false;
      return mapping.keywords.some((keyword) => text.includes(keyword));
    });
  }
  function qualifyingTopicObjects(poolEvents) {
    return mappingsFor(poolEvents).flatMap((mapping) => mapping.stocks.map((stock) => {
      const hasConcreteCode = /^\d{6}$/.test(String(stock.code || '')) && stock.name && !stock.name.includes('先查');
      if (!hasConcreteCode) return null;
      const evidenceEvents = stockEvidenceEvents(mapping, stock, poolEvents);
      const supportedTags = evidenceTags.filter((tag) => evidenceSupport(mapping, stock, tag));
      return { mapping, stock, evidenceEvents, supportedTags, verified: evidenceEvents.length > 0 };
    })).filter(Boolean).slice(0, 12);
  }
  function renderAnalysis(poolEvents) {
    const grid = document.querySelector('#analysis-grid');
    if (!grid) return;
    const mappings = mappingsFor(poolEvents);
    const todayItems = poolEvents.filter((event) => event.poolStatus === 'today').slice(0, 5);
    const themeCounts = poolEvents.reduce((acc, event) => {
      const theme = event.poolTheme || '其他';
      acc.set(theme, (acc.get(theme) || 0) + 1);
      return acc;
    }, new Map());
    const themes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const objectCount = qualifyingTopicObjects(poolEvents).length;
    setLoadingStatus('#analysis-loading-status', poolEvents.length ? `拆解已生成：${objectCount} 个可选股对象，${mappings.length} 条主题背景路径` : '拆解已生成：暂无可拆解对象', poolEvents.length ? 'ready' : 'empty');
    grid.innerHTML = `
      <article class="analysis-card analysis-wide">
        <span>01 · 今日新增/更新</span>
        <h3>${todayItems.length ? '当天真正变化先看这里' : '今日新增较少'}</h3>
        ${todayItems.length ? `<ul class="analysis-list">${todayItems.map((event) => `<li><a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.title)}</a><small>${escapeHtml(event.source || '来源待核验')} · ${escapeHtml(event.publishedAt || event.poolDate || '时间待核验')}</small></li>`).join('')}</ul>` : '<p>今天没有更多达到 A/B 级门槛的新发信息，筛选池继续保留近7日高价值线索。</p>'}
      </article>
      <article class="analysis-card analysis-wide">
        <span>02 · 近7日重点变化</span>
        <h3>${themes.length ? '按主题聚合，减少重复阅读' : '暂无主题聚合'}</h3>
        ${themes.length ? `<div class="theme-digest">${themes.map(([theme, count]) => {
          const items = poolEvents.filter((event) => event.poolTheme === theme).slice(0, 3);
          return `<section><header><b>${escapeHtml(theme)}</b><small>${count} 条</small></header><ul>${items.map((event) => `<li><a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.title)}</a><small>${escapeHtml(event.source || '来源待核验')} · ${escapeHtml(event.poolDate || event.publishedAt || '时间待核验')}</small></li>`).join('')}</ul></section>`;
        }).join('')}</div>` : '<p>没有足够 A/B 级信息形成主题聚合。</p>'}
      </article>
      <article class="analysis-card analysis-wide">
        <span>03 · A 股核验路径</span>
        <h3>${mappings.length ? '从政策事实走到公告和财务' : '暂无可执行路径'}</h3>
        ${mappings.length ? mappings.slice(0, 6).map((mapping) => `<div class="path-block"><strong>${escapeHtml(mapping.title)}</strong><p>${escapeHtml(mapping.angle)}</p><small>选股门槛：必须出现具体上市公司公告、订单、招投标、财报或可核验代码；否则只作为主题背景。</small><small>不通过条件：${escapeHtml(mapping.fail)}</small></div>`).join('') : '<p>没有足够政策主题、行业或交易所信息时，公开页不强行给出股票方向。</p>'}
      </article>`;
    applySearchHighlight();
  }
  function renderTopics(poolEvents = []) {
    const topicGrid = document.querySelector('#topic-grid');
    if (!topicGrid) return;
    const objects = qualifyingTopicObjects(poolEvents);
    setLoadingStatus('#topics-loading-status', objects.length ? `研究对象已匹配：${objects.length} 个符合条件对象` : '研究对象匹配完成：暂无符合条件对象', objects.length ? 'ready' : 'empty');
    topicGrid.innerHTML = objects.length ? objects.map(({ mapping, stock, evidenceEvents, supportedTags, verified }, index) => {
      const primaryEvidence = evidenceEvents[0];
      const statusLabel = verified ? '已有摘要证据' : '可核验候选';
      const evidenceText = verified ? `近7日摘要中直接出现 ${escapeHtml(stock.code)} / ${escapeHtml(stock.name)}，且命中证据：${escapeHtml(supportedTags.join('、')) || '待补'}。` : `由政策主题映射出的可核验候选股 ${escapeHtml(stock.code)} ${escapeHtml(stock.name)}；点击打开公告检索，按订单、收入、现金流、估值逐项验证，未达标即剔除。`;
      const directLine = verified && primaryEvidence ? `<div class="choke-line"><strong>直接证据</strong><a href="${escapeHtml(primaryEvidence.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(primaryEvidence.title)}</a></div>` : `<div class="choke-line"><strong>直接证据</strong><span>待回溯公告核验：打开 ${escapeHtml(stock.market || '公告检索')} 检索 ${escapeHtml(stock.code)} 的最新公告、订单、财报、现金流和风险提示。</span></div>`;
      return `
      <article class="topic-card">
        <div class="topic-top"><h3>${String(index + 1).padStart(2, '0')} · ${escapeHtml(stock.name)}</h3><span class="topic-status">${escapeHtml(statusLabel)} · ${escapeHtml(mapping.title)}</span></div>
        <p>${escapeHtml(stock.reason)}</p>
        <div class="selection-note"><strong>入选条件</strong><span>${evidenceText}</span></div>
        ${directLine}
        <div class="stock-row compact"><div class="stock-item"><a href="${escapeHtml(stock.url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(stock.code)}</strong><small>${escapeHtml(stock.market || '公告检索')} · 打开后按代码检索公告、订单、财务和风险提示。</small></a>${renderEvidenceTags(mapping, stock)}</div></div>
        <div class="fail-line"><strong>不通过条件</strong>${escapeHtml(mapping.fail)}</div>
      </article>`;
    }).join('') : `
      <article class="topic-card topic-empty"><div class="topic-top"><h3>暂无符合条件的研究对象</h3><span class="topic-status">不强行展示</span></div><p>当前近7日摘要没有直接出现可核验的 A 股代码、公司名或上市公司公告证据。只有政策主题、行业方向或宏观数据时，本区域不再展示代表股票。</p></article>`;
    applySearchHighlight();
  }
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function clearHighlights() {
    document.querySelectorAll('mark.search-highlight').forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent || '')));
  }
  function applySearchHighlight() {
    const input = document.querySelector('#page-search');
    const keyword = input?.value?.trim();
    clearHighlights();
    if (!keyword) return;
    const pattern = new RegExp(escapeRegExp(keyword), 'gi');
    document.querySelectorAll(searchTargets).forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || ['SCRIPT', 'STYLE', 'MARK', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
          pattern.lastIndex = 0;
          return pattern.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        String(node.nodeValue || '').replace(pattern, (match, offset) => {
          frag.append(document.createTextNode(node.nodeValue.slice(lastIndex, offset)));
          const mark = document.createElement('mark');
          mark.className = 'search-highlight';
          mark.textContent = match;
          frag.append(mark);
          lastIndex = offset + match.length;
        });
        frag.append(document.createTextNode(node.nodeValue.slice(lastIndex)));
        node.replaceWith(frag);
      });
    });
  }
  function snapshotSummaryText(snapshot) {
    const events = weeklyAbEvents(snapshot);
    if (!events.length) return `${snapshot?.asOf || '今日'} 近7日暂无达到 A/B 级公开信息门槛。`;
    return [`${snapshot?.asOf || '今日'} 近7日公开摘要筛选池（${events.length} 条）`, '']
      .concat(events.map((event, index) => [
        `${index + 1}. ${event.title || '标题待核验'}`,
        `来源：${event.source || '来源待核验'} / ${credibilityLabel(event)}`,
        `发布时间：${event.publishedAt || '时间待核验'}`,
        `摘要口径：${event.read || event.desc || '等待摘要口径'}`,
        `原文链接：${event.sourceUrl || '链接待核验'}`
      ].join('\n'))).join('\n\n');
  }
  async function copyText(text, button, successText = '已复制') {
    const originalText = button.textContent;
    try {
      await navigator.clipboard.writeText(text || '');
      button.textContent = successText;
    } catch {
      button.textContent = '复制失败';
    }
    window.setTimeout(() => { button.textContent = originalText; }, 1600);
  }
  function applyThemeMode(mode) {
    const selected = mode === 'dark' ? 'dark' : 'light';
    saveChecked('research-stock:theme:manual', selected === 'dark');
    try { window.localStorage.setItem('research-stock:theme:mode', selected); } catch {}
    document.documentElement.dataset.theme = selected;
    const select = document.querySelector('#theme-mode');
    if (select) select.value = selected;
  }
  function initThemeMode() {
    let saved = 'light';
    try { saved = window.localStorage.getItem('research-stock:theme:mode') || 'light'; } catch {}
    applyThemeMode(saved);
    document.querySelector('#theme-mode')?.addEventListener('change', (event) => applyThemeMode(event.target.value));
  }
  function buildDataState(snapshot, poolEvents = [], filteredPoolEvents = poolEvents) {
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const todayAb = todayAbEvents(events);
    const todayAbCount = todayAb.length;
    const directTodayCount = events.filter((event) => event.isToday && event.displayInDaily !== false && isDisplayablePolicy(event)).length;
    const todayIsFallback = directTodayCount === 0 && todayAbCount > 0;
    const todayACount = todayAb.filter((event) => event.grade === 'A').length;
    const todayBCount = todayAb.filter((event) => event.grade === 'B').length;
    const todayCount = events.filter((event) => event.isToday && event.fetchStatus !== 'error' && event.displayInDaily !== false).length;
    const okCount = events.filter((event) => event.fetchStatus !== 'error').length;
    return {
      asOf: snapshot?.asOf || selectedDate || '待同步',
      generatedAt: snapshot?.generatedAt || '',
      status: snapshot?.status || '未知',
      okCount,
      totalCount: events.length,
      todayCount,
      todayAbCount,
      directTodayCount,
      todayIsFallback,
      todayACount,
      todayBCount,
      poolCount: poolEvents.length,
      filteredCount: filteredPoolEvents.length,
      hasTodayAb: todayAbCount > 0,
      hasPool: poolEvents.length > 0,
      hasFilteredPool: filteredPoolEvents.length > 0
    };
  }
  function renderSyncStatus(snapshot, state) {
    const current = state || buildDataState(snapshot);
    const time = formatSyncTime(snapshot?.generatedAt);
    const monthDay = current.asOf && /^\d{4}-\d{2}-\d{2}/.test(current.asOf) ? current.asOf.slice(5) : current.asOf;
    const text = current.todayIsFallback
      ? `今日未确认到当天新发 A/B 级原文，已沿用近 7 日最新一条 A/B 级线索（${current.todayACount} 条 A / ${current.todayBCount} 条 B），近 7 日持续跟踪 ${current.poolCount} 条 · ${time}`
      : (current.hasTodayAb
        ? `已同步今日（${monthDay}）A 级政策 ${current.todayACount} 条，B 级政策 ${current.todayBCount} 条 · ${time}`
        : (current.hasPool
          ? `今日暂无高权重（A/B级）部委级文件，当前展示近 7 日仍处执行期的核心政策主线 · ${time}`
          : `今日暂无高权重（A/B级）部委级文件，当前展示常驻静态重点主线池 · ${time}`));
    setText('#sync-status-text', text);
  }
  function clearLoadedWaitingText(state) {
    if (!state) return;
    const replacements = new Map([
      ['摘要加载中', state.hasFilteredPool ? `近7日筛选池已加载：${state.filteredCount}/${state.poolCount} 条 A/B 级信息` : '摘要已加载：今日暂无达到 A/B 级公开信息门槛'],
      ['拆解生成中', state.hasFilteredPool ? '拆解已生成' : '拆解已生成：暂无可拆解对象'],
      ['研究对象匹配中', state.hasFilteredPool ? '研究对象匹配完成' : '研究对象匹配完成：暂无关联对象'],
      ['正在读取近7日', state.hasPool ? '近7日池已加载' : '无财经A/B条目'],
      ['等待同步', state.hasPool ? state.status : '今日暂无达到 A/B 级公开信息门槛'],
      ['等待背景资料同步。', '暂无与当前摘要直接相关的背景资料。']
    ]);
    document.querySelectorAll('#main, .site-footer').forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const text = node.nodeValue || '';
        replacements.forEach((replacement, needle) => {
          if (text.includes(needle)) node.nodeValue = text.replaceAll(needle, replacement);
        });
      });
    });
  }
  async function loadSnapshotByDate(dateText) {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/publicDailyEvidence/${dateText}?key=${firebaseConfig.apiKey}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const doc = await response.json();
    const payload = doc?.fields?.payload?.stringValue;
    return payload ? JSON.parse(payload) : null;
  }
  async function loadRecentSnapshots(baseDate) {
    const candidates = Array.from({ length: 7 }, (_, index) => dateDaysAgo(baseDate, index + 1));
    const results = await Promise.all(candidates.map((dateText) => loadSnapshotByDate(dateText).catch(() => null)));
    return results.filter(Boolean).slice(0, 3);
  }
  function updateHeroCounters(state, poolEvents, topicObjects, discoverySignals = []) {
    setText('#counter-today', `${state.todayAbCount}`);
    setText('#counter-themes', `${new Set([...poolEvents.map((event) => event.quickTag || event.poolTheme), ...discoverySignals.map((signal) => signal.theme)].filter(Boolean)).size}`);
    setText('#counter-stocks', `${topicObjects.length}`);
  }
  function updatePosterHead(snapshot, state, poolEvents) {
    const node = document.querySelector('#brief-poster-head span');
    if (!node) return;
    node.textContent = `${snapshot?.asOf || '今日'} · 今日入库 ${state.todayAbCount} 条，近 7 日持续跟踪 ${poolEvents.length} 条`;
  }
  async function loadFallbackSnapshot() {
    const response = await fetch('data/fallback.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`静态主线池 ${response.status}`);
    return response.json();
  }
  function exportBriefImage(button) {
    const briefElement = document.querySelector('#daily-brief-container');
    if (!briefElement || typeof window.html2canvas !== 'function') {
      if (button) button.textContent = '导出不可用';
      return;
    }
    const watermark = document.createElement('div');
    watermark.className = 'poster-watermark';
    watermark.innerHTML = '政策雷达 · 仅供客观事实与公告核验 · 不作买卖建议';
    briefElement.appendChild(watermark);
    const originalText = button?.textContent || '';
    if (button) button.textContent = '生成中...';
    window.html2canvas(briefElement, { scale: 2, useCORS: true, backgroundColor: '#f6f8f6' }).then((canvas) => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `政策雷达-晨报-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      if (button) button.textContent = '已生成';
    }).catch(() => {
      if (button) button.textContent = '生成失败';
    }).finally(() => {
      watermark.remove();
      window.setTimeout(() => { if (button) button.textContent = originalText; }, 1600);
    });
  }
  async function renderRecentReview(snapshot, shouldShow) {
    const wrap = document.querySelector('#recent-review');
    const grid = document.querySelector('#recent-review-grid');
    if (!wrap || !grid) return;
    if (!shouldShow) {
      wrap.hidden = true;
      grid.innerHTML = '';
      return;
    }
    const snapshots = await loadRecentSnapshots(snapshot?.asOf);
    snapshots.forEach((item) => { if (item?.asOf) historySnapshots.set(item.asOf, item); });
    wrap.hidden = false;
    grid.innerHTML = snapshots.length ? snapshots.map((item) => {
      const events = Array.isArray(item.events) ? item.events : [];
      const count = todayAbEvents(events).length;
      const sourceCount = new Set(events.filter((event) => event.fetchStatus !== 'error').map((event) => event.source).filter(Boolean)).size;
      return `<article class="review-card"><span>${escapeHtml(item.asOf || '日期待核验')}</span><strong>${escapeHtml(item.headline || `已同步 ${count} 条 A/B 级信息`)}</strong><small>来源数量：${sourceCount}</small></article>`;
    }).join('') : '<article class="review-card"><span>近7日回顾</span><strong>暂无可展示存档</strong><small>昨日摘要已存档后会显示在这里。</small></article>';
  }
  function renderSnapshot(snapshot, origin) {
    if (snapshot?.asOf) {
      historySnapshots.set(snapshot.asOf, snapshot);
      selectedDate = snapshot.asOf;
    }
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const displayOrigin = origin === 'cloud' ? '每日同步' : origin;
    const poolEvents = weeklyAbEvents(snapshot);
    const filteredPoolEvents = applyPoolFilters(poolEvents);
    const discoverySignals = discoverySignalsForSnapshot(snapshot, poolEvents);
    const state = buildDataState(snapshot, poolEvents, filteredPoolEvents);
    setText('#brief-date', `${snapshot?.asOf || '待同步'} · ${displayOrigin}`);
    renderSyncStatus(snapshot, state);
    setText('#brief-headline', snapshot?.headline || '今日暂无达到 A/B 级公开信息门槛。');
    setText('#political-judgement', snapshot?.brief?.judgement || '先看资源配置，再看产业兑现。');
    setText('#choke-judgement', snapshot?.brief?.judgementDetail || '供应链瓶颈必须由多类证据共同支持。');
    setText('#counter-evidence', snapshot?.brief?.counter || '政策方向不能替代订单、财报和现金流。');
    const signal = document.querySelector('.signal-foot');
    if (signal) signal.textContent = `最后更新时间：${snapshot?.generatedAt || '待同步'} · ${snapshot?.status || '未知'} · 今日A/B ${state.todayAbCount} · 近7日池 ${state.poolCount} · 官方来源读到 ${state.okCount}/${state.totalCount}`;
    const trust = document.querySelector('.mini-card strong');
    if (trust) trust.textContent = `${state.hasTodayAb ? '今日新增' : '今日无新增'} / ${displayOrigin}`;
    renderDiscoveryRadar(snapshot, poolEvents);
    renderAnalysis(filteredPoolEvents);
    const topicObjects = qualifyingTopicObjects(filteredPoolEvents);
    updateHeroCounters(state, poolEvents, topicObjects, discoverySignals);
    updatePosterHead(snapshot, state, poolEvents);
    renderTopics(filteredPoolEvents);
    renderSummaryCards(filteredPoolEvents, snapshot?.asOf || selectedDate, poolEvents.length);
    renderDailyCompare(snapshot?.asOf || selectedDate, state, snapshot);
    renderRecentReview(snapshot, poolEvents.length === 0);
    clearLoadedWaitingText(state);
    const backgroundBody = document.querySelector('#background-table tbody');
    if (backgroundBody) {
      const backgroundEvents = events.filter((event) => (!event.isToday || event.fetchStatus === 'error' || event.displayInDaily === false) && relatedToToday(event, filteredPoolEvents)).slice(0, 6);
      backgroundBody.innerHTML = backgroundEvents.length ? backgroundEvents.map((event, index) => `
        <tr>
          <td>${String(index + 1).padStart(2, '0')}</td>
          <td><a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.title)}</a></td>
          <td>${escapeHtml(event.read || event.desc)}</td>
          <td><span class="source-tag ${sourceClass(event)}">${escapeHtml(event.grade || 'A')} / ${escapeHtml(event.source)}</span></td>
          <td>${escapeHtml(event.publishedAt || event.date || '待复核')}</td>
          <td><strong>${escapeHtml(event.fetchStatus === 'error' ? '待复核' : event.confidence || '待复核')}</strong><small>${escapeHtml(event.confidenceNote || '')}</small></td>
        </tr>`).join('') : `
        <tr class="empty-row">
          <td>--</td>
          <td colspan="5"><strong>暂无与今日摘要直接相关的背景资料。</strong><small>背景资料必须能和当天摘要共享政策主题、来源或产业关键词，避免随意拼凑。</small></td>
        </tr>`;
    }
  }
  async function prepareHistory(snapshot) {
    if (!snapshot?.asOf) return;
    selectedDate = selectedDate || snapshot.asOf;
    historySnapshots.set(snapshot.asOf, snapshot);
    const dates = dateOptions(snapshot.asOf).slice(1);
    const results = await Promise.all(dates.map((dateText) => loadSnapshotByDate(dateText).catch(() => null)));
    results.forEach((item) => { if (item?.asOf) historySnapshots.set(item.asOf, item); });
    renderDateSelector(snapshot.asOf, new Set(historySnapshots.keys()));
  }
  async function loadFromDailySync() {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/publicDailyEvidence/latest?key=${firebaseConfig.apiKey}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`每日同步 ${response.status}`);
    const doc = await response.json();
    const payload = doc?.fields?.payload?.stringValue;
    if (!payload) throw new Error('每日同步内容缺失');
    return JSON.parse(payload);
  }
  async function loadFromStaticSync() {
    const response = await fetch('data/daily-evidence.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`静态同步 ${response.status}`);
    return response.json();
  }
  function weeklyCandidateCount(snapshot) {
    const baseDate = snapshot?.asOf || selectedDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    return events.filter((event) => {
      if (!isDisplayablePolicy(event)) return false;
      const dateText = eventDateText(event, { asOf: baseDate });
      const hasAge = event.ageDays !== null && event.ageDays !== undefined && event.ageDays !== '';
        const age = hasAge && Number.isFinite(Number(event.ageDays)) ? Number(event.ageDays) : daysBetween(baseDate, dateText);
      if (age < 0 || age > 6) return false;
      return event.displayInDaily !== false || event.displayInWeekly === true;
    }).length;
  }
  function snapshotDateRank(snapshot) {
    const value = String(snapshot?.asOf || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '0000-00-00';
  }
  function chooseBestSnapshot(results) {
    const valid = results.filter((item) => item.snapshot);
    if (!valid.length) throw new Error(results.map((item) => item.error?.message).filter(Boolean).join('；') || '无可用摘要');
    return valid.sort((a, b) => {
      const dateDiff = snapshotDateRank(b.snapshot).localeCompare(snapshotDateRank(a.snapshot));
      if (dateDiff) return dateDiff;
      const timeDiff = String(b.snapshot.generatedAt || '').localeCompare(String(a.snapshot.generatedAt || ''));
      if (timeDiff) return timeDiff;
      return weeklyCandidateCount(b.snapshot) - weeklyCandidateCount(a.snapshot);
    })[0];
  }
  async function loadSnapshot(manual = false) {
    setLoadingStatus('#summary-loading-status', '摘要加载中', 'loading');
    setLoadingStatus('#discovery-loading-status', '发现雷达生成中', 'loading');
    setLoadingStatus('#analysis-loading-status', '拆解生成中', 'loading');
    setLoadingStatus('#topics-loading-status', '研究对象匹配中', 'loading');
    if (manual) {
      setText('#sync-status-text', '正在刷新每日摘要...');
    }
    const [cloud, staticSync, fallbackSync] = await Promise.allSettled([loadFromDailySync(), loadFromStaticSync(), loadFallbackSnapshot()]);
    try {
      const picked = chooseBestSnapshot([
        { origin: '每日同步', snapshot: cloud.status === 'fulfilled' ? cloud.value : null, error: cloud.reason },
        { origin: '静态同步', snapshot: staticSync.status === 'fulfilled' ? staticSync.value : null, error: staticSync.reason },
        { origin: '静态主线池', snapshot: fallbackSync.status === 'fulfilled' ? fallbackSync.value : null, error: fallbackSync.reason }
      ]);
      latestSnapshot = picked.snapshot;
      latestOrigin = picked.origin;
      selectedDate = latestSnapshot?.asOf || selectedDate;
      await prepareHistory(latestSnapshot);
      renderSnapshot(latestSnapshot, picked.origin);
    }
    catch (error) {
      setText('#brief-date', '等待同步');
      setText('#counter-evidence', `数据暂不可用：${error.message}`);
      setDailyCompareText('今日 vs 昨日：等待历史数据', 'neutral');
      setLoadingStatus('#summary-loading-status', '摘要加载失败', 'empty');
      setLoadingStatus('#discovery-loading-status', '发现雷达暂停：等待摘要', 'empty');
      setLoadingStatus('#analysis-loading-status', '拆解生成暂停：等待摘要', 'empty');
      setLoadingStatus('#topics-loading-status', '研究对象匹配暂停：等待摘要', 'empty');
    }
  }


  document.addEventListener('change', async (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.checkKey) {
      const verifyList = input.closest('.verify-list');
      if (verifyList) {
        const total = verifyList.querySelectorAll('[data-check-key]').length;
        const checked = verifyList.querySelectorAll('[data-check-key]:checked').length;
        const status = verifyList.querySelector('[data-checklist-status]');
        const count = verifyList.querySelector('summary small');
        if (count) count.textContent = `已检查 ${checked}/${total}`;
        if (status) status.textContent = `未保存：${checked}/${total}，请点击保存勾选`;
        return;
      }
      saveChecked(input.dataset.checkKey, input.checked);
      return;
    }
    if (input instanceof HTMLSelectElement && (input.id === 'theme-filter' || input.id === 'status-filter')) {
      themeFilter = document.querySelector('#theme-filter')?.value || 'all';
      statusFilter = document.querySelector('#status-filter')?.value || 'all';
      const snapshot = historySnapshots.get(selectedDate) || latestSnapshot;
      if (snapshot) renderSnapshot(snapshot, selectedDate === latestSnapshot?.asOf ? latestOrigin : '历史回顾');
      return;
    }
    if (input instanceof HTMLSelectElement && input.id === 'summary-date-select') {
      selectedDate = input.value;
      let snapshot = historySnapshots.get(selectedDate);
      if (!snapshot && poolEventsByDate(latestSnapshot).has(selectedDate)) {
        snapshot = deriveSnapshotForDate(selectedDate, latestSnapshot);
        if (snapshot?.asOf) historySnapshots.set(snapshot.asOf, snapshot);
      }
      if (!snapshot) {
        snapshot = await loadSnapshotByDate(selectedDate);
        if (snapshot?.asOf) historySnapshots.set(snapshot.asOf, snapshot);
      }
      if (!snapshot) {
        snapshot = deriveSnapshotForDate(selectedDate, latestSnapshot) || { asOf: selectedDate, generatedAt: latestSnapshot?.generatedAt, status: '该日暂无可展示条目', headline: `${selectedDate} 暂无财经相关 A/B 条目`, events: [] };
        historySnapshots.set(selectedDate, snapshot);
      }
      renderSnapshot(snapshot, selectedDate === latestSnapshot?.asOf ? latestOrigin : (snapshot.status === '近7日筛选池派生摘要' ? '近7日池' : '历史回顾'));
    }
  });

  document.addEventListener('click', async (event) => {
    const copyButton = event.target.closest?.('[data-copy-prompt]');
    if (copyButton) {
      await copyText(copyButton.dataset.copyPrompt || '', copyButton);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const saveChecklistButton = event.target.closest?.('[data-save-checklist]');
    if (saveChecklistButton) {
      const wrap = saveChecklistButton.closest('.verify-list');
      const boxes = [...(wrap?.querySelectorAll('[data-check-key]') || [])];
      boxes.forEach((input) => saveChecked(input.dataset.checkKey, input.checked));
      const checked = boxes.filter((input) => input.checked).length;
      const status = wrap?.querySelector('[data-checklist-status]');
      const count = wrap?.querySelector('summary small');
      if (count) count.textContent = `已检查 ${checked}/${boxes.length}`;
      if (status) status.textContent = `已保存到本机浏览器：${checked}/${boxes.length}`;
      saveChecklistButton.textContent = '已保存';
      window.setTimeout(() => { saveChecklistButton.textContent = '保存勾选'; }, 1600);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const resetChecklistButton = event.target.closest?.('[data-reset-checklist]');
    if (resetChecklistButton) {
      const wrap = resetChecklistButton.closest('.verify-list');
      const boxes = [...(wrap?.querySelectorAll('[data-check-key]') || [])];
      boxes.forEach((input) => { input.checked = false; saveChecked(input.dataset.checkKey, false); });
      const status = wrap?.querySelector('[data-checklist-status]');
      const count = wrap?.querySelector('summary small');
      if (count) count.textContent = `已检查 0/${boxes.length}`;
      if (status) status.textContent = `已清空并保存：0/${boxes.length}`;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const exportButton = event.target.closest?.('#export-summary-btn');
    if (exportButton) {
      exportBriefImage(exportButton);
      return;
    }
    const quickTagButton = event.target.closest?.('[data-quick-tag]');
    if (quickTagButton) {
      quickTagFilter = quickTagButton.dataset.quickTag || 'all';
      document.querySelectorAll('[data-quick-tag]').forEach((button) => button.classList.toggle('active', button === quickTagButton));
      const snapshot = historySnapshots.get(selectedDate) || latestSnapshot;
      if (snapshot) renderSnapshot(snapshot, selectedDate === latestSnapshot?.asOf ? latestOrigin : '历史回顾');
      return;
    }
    const todayCopyButton = event.target.closest?.('#copy-today-summary');
    if (todayCopyButton) {
      await copyText(snapshotSummaryText(latestSnapshot || historySnapshots.get(selectedDate)), todayCopyButton, '今日摘要已复制');
      return;
    }
    const button = event.target.closest?.('[data-history-date]');
    if (!button) return;
    const select = document.querySelector('#summary-date-select');
    if (select) {
      select.value = button.dataset.historyDate;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  function initUsageGuide() {
    const guide = document.querySelector('#usage-guide');
    const close = document.querySelector('#close-guide');
    if (!guide || !close) return;
    if (!isChecked('research-stock:guide:closed')) guide.hidden = false;
    close.addEventListener('click', () => {
      saveChecked('research-stock:guide:closed', true);
      guide.hidden = true;
    });
  }

  document.querySelector('#refresh-data')?.addEventListener('click', () => {
    if (refreshTimer) return;
    startRefreshCooldown();
    loadSnapshot(true);
  });
  document.querySelector('#page-search')?.addEventListener('input', applySearchHighlight);
  initThemeMode();
  initUsageGuide();
  renderTopics([]);
  loadSnapshot();
})();
