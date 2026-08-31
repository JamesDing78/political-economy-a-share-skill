#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const projectId = process.env.FIREBASE_PROJECT_ID || 'research-stock-c8cd9';
let firestoreToken = process.env.FIRESTORE_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '';
const firestorePublicWrite = process.env.FIRESTORE_PUBLIC_WRITE === '1';
const firestoreApiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDAN1HLmcdUtoHYCDGioBsPJavcqs8SlAI';

const sourceRegistry = [
  { id: 'gov', name: '中国政府网', level: 'A', role: '国务院政策、国务院常务会议、政策解读', url: 'https://www.gov.cn/zhengce/index.htm' },
  { id: 'xinhua', name: '新华社', level: 'B', role: '权威时政新闻、国务院会议通稿、政策线索', url: 'https://www.news.cn/politics/' },
  { id: 'cctv', name: '央视网', level: 'B', role: '时政新闻、政策报道、视频和文字报道线索', url: 'https://news.cctv.com/china/' },
  { id: 'ndrc', name: '国家发展改革委', level: 'B', role: '宏观政策、产业规划、投资和价格政策', url: 'https://www.ndrc.gov.cn/xxgk/wap_index.html' },
  { id: 'miit', name: '工业和信息化部', level: 'B', role: '制造业、通信、工业互联网、产业政策', url: 'https://wap.miit.gov.cn/zwgk/index.html' },
  { id: 'mof', name: '财政部独立栏目', level: 'A', role: '财政政策、国债、专项资金、税费政策', url: 'https://www.mof.gov.cn/gkml/bulinggonggao/tongzhitonggao/index.htm' },
  { id: 'mof-policy', name: '财政部政策发布', level: 'A', role: '财政部各司局政策发布和资金安排', url: 'https://zhs.mof.gov.cn/zhengcefabu/' },
  { id: 'mof-bond', name: '财政部政府债券公告', level: 'A', role: '国债发行、续发行、财政融资安排', url: 'https://zwgls.mof.gov.cn/ywgg/' },
  { id: 'mofcom', name: '商务部', level: 'A', role: '商务政策、外贸、消费、服务贸易和外资政策', url: 'https://www.mofcom.gov.cn/zwgk/zcfb/' },
  { id: 'pbc', name: '中国人民银行', level: 'A', role: '货币政策、金融市场、流动性和信贷政策', url: 'https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html' },
  { id: 'stats', name: '国家统计局', level: 'A', role: '宏观数据、工业、消费、投资和价格数据', url: 'https://www.stats.gov.cn/szst/' },
  { id: 'csrc', name: '中国证监会', level: 'A', role: '资本市场制度、融资监管、上市公司监管', url: 'https://www.csrc.gov.cn/' },
  { id: 'exchange', name: '交易所公告和上市公司公告', level: 'C', role: '交易所公告、上市公司公告、规则、停复牌和监管问询', url: 'https://www.cninfo.com.cn/new/index' },
  { id: 'sse', name: '上海证券交易所', level: 'C', role: '交易所公告、规则、产品和停复牌信息', url: 'https://www.sse.com.cn/disclosure/announcement/general/' },
  { id: 'szse', name: '深圳证券交易所', level: 'C', role: '交易所公告、规则、产品和市场服务信息', url: 'https://www.szse.cn/disclosure/notice/general/index.html' }
];

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());

const sources = [
  { id: 'gov-list', grade: 'A', source: '中国政府网', sourceLevel: 'A', industry: '国务院政策、国务院常务会议、政策解读', url: 'https://www.gov.cn/zhengce/index.htm', listPage: true, fallbackTitle: '中国政府网政策栏目：当日国务院政策', read: '中国政府网是 A 级核心源；同一政策被媒体转载时，以政府网或部委原文为准。', counter: '反证：如果只是旧政策列表或解读页，不能当作当天新增政策。' },
  { id: 'xinhua-list', grade: 'B', source: '新华社', sourceLevel: 'B', industry: '时政要闻、国务院会议、宏观政策线索', url: 'https://www.news.cn/politics/', listPage: true, fallbackTitle: '新华社时政频道：当日权威政策线索', read: '新华社用于识别当天国务院会议、中央政策通稿和权威时政线索；若已有政府机关原文，展示优先级低于原文。', counter: '反证：新华社通稿可能是会议或政策解读，不等同于正式政策文件。' },
  { id: 'cctv-list', grade: 'B', source: '央视网', sourceLevel: 'B', industry: '时政新闻、政策报道、宏观政策线索', url: 'https://news.cctv.com/china/', listPage: true, fallbackTitle: '央视网新闻频道：当日政策报道线索', read: '央视网提供权威公开报道线索，可用于观察政策议题是否形成公开关注。', counter: '反证：媒体报道需要回溯政府文件、部委通知或统计数据。' },
  { id: 'mofcom-list', grade: 'A', source: '商务部', sourceLevel: 'A', industry: '商务政策、外贸、消费、服务贸易、外资', url: 'https://www.mofcom.gov.cn/zwgk/zcfb/', listPage: true, fallbackTitle: '商务部政策发布栏目：当日商务政策', read: '商务部公开信息可用于核验消费、外贸、服务贸易和外资政策是否出现新的执行线索。', counter: '反证：商务政策不等于上市公司订单，仍需行业数据和公司公告验证。' },
  { id: 'pbc-list', grade: 'A', source: '中国人民银行', sourceLevel: 'A', industry: '货币政策、金融市场、信贷、流动性', url: 'https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html', listPage: true, fallbackTitle: '中国人民银行公开沟通交流：当日金融政策', read: '央行公开信息用于观察货币、信贷、流动性和金融市场运行变化。', counter: '反证：货币政策线索只说明流动性和融资环境，不等同于行业景气或公司盈利。' },
  { id: 'csrc-list', grade: 'A', source: '中国证监会', sourceLevel: 'A', industry: '资本市场制度、上市公司监管、融资制度', url: 'https://www.csrc.gov.cn/', listPage: true, fallbackTitle: '中国证监会官网：当日资本市场政策', read: '证监会公开信息用于核验资本市场制度、上市公司监管和融资规则变化。', counter: '反证：监管制度变化不等于短期行情方向，需要结合规则文本、实施时间和市场反馈。' },
  { id: 'stats-list', grade: 'A', source: '国家统计局', sourceLevel: 'A', industry: '宏观数据、工业、消费、投资和价格数据', url: 'https://www.stats.gov.cn/szst/', listPage: true, fallbackTitle: '国家统计局最新发布：当日宏观数据', read: '统计局公开数据用于验证产业需求、生产、消费、投资和价格变化。', counter: '反证：宏观数据确认总量或结构变化，不等于上市公司订单或利润兑现。' },
  { id: 'mof-list', grade: 'A', source: '财政部独立栏目', sourceLevel: 'A', industry: '财政政策、国债、专项资金、税费政策', url: 'https://www.mof.gov.cn/gkml/bulinggonggao/tongzhitonggao/index.htm', listPage: true, fallbackTitle: '财政部独立栏目：当日财政公告', read: '财政部公开信息用于核验财政政策、通知公告、国债发行和资金安排。', counter: '反证：资金安排不等于企业收入确认，仍需项目和公告核验。' },
  { id: 'mof-bond-list', grade: 'A', source: '财政部政府债券公告', sourceLevel: 'A', industry: '国债发行、续发行、财政融资安排', url: 'https://zwgls.mof.gov.cn/ywgg/', listPage: true, fallbackTitle: '财政部政府债券公告：当日债券公告', read: '政府债券公告用于识别财政融资与资金供给节奏；应和专项债、超长期特别国债项目落地交叉核验。', counter: '反证：债券发行节奏不等于资金形成实物工作量。' },
  { id: 'people-high-quality-2026-08-25', grade: 'C', source: '人民日报 / 人民网', sourceLevel: 'B', industry: '宏观政策、财政政策、货币政策、资本市场、城市更新、风险化解', url: 'https://opinion.people.com.cn/n1/2026/0825/c461529-40785340.html', staticPublishedAt: '2026-08-25', staticDesc: '人民日报 2026年08月25日文章，围绕下半年经济工作、逆周期调节、财政支出和债券资金形成实物工作量、货币政策传导、资本市场改革与风险化解展开。', fallbackTitle: '推动高质量发展行稳致远', read: '这是一条当天权威媒体公开信息，不是部委原始公文。它适合进入每日摘要，用于识别当日政策叙事：逆周期调节、财政支出和债券资金加快形成实物工作量、畅通货币政策传导、资本市场改革和风险化解。', counter: '反证：人民日报评论不能替代国务院、部委或财政资金原文；对 A 股只能作为当日政策线索，必须继续回溯会议、公文、项目和公司公告。' },
  { id: 'sse-trading-2026-08-25', grade: 'C', displayToday: true, source: '上海证券交易所', sourceLevel: 'C', industry: '交易所公告、基金产品、市场运行', url: 'https://www.sse.com.cn/disclosure/announcement/general/', staticPublishedAt: '2026-08-25', staticDesc: '上交所一般公告栏目 2026-08-25 有临时停牌公告。该类信息属于交易所公开市场运行信息，适合提示市场事件，但通常不构成宏观政策主线。', fallbackTitle: '上交所一般公告：2026-08-25 临时停牌公告', read: '交易所公开信息用于观察市场运行事件；单项停复牌或产品公告只作为市场提示。', counter: '反证：单只基金临时停牌公告不代表产业政策，也不应推导到行业或个股机会。' },
  { id: 'gov-policy-latest-2026-08-20', coverageOnly: true, grade: 'A', source: '中国政府网', sourceLevel: 'A', industry: '国务院政策、政策背景', url: 'https://www.gov.cn/zhengce/index.htm', staticPublishedAt: '2026-08-20', staticDesc: '中国政府网政策栏目最新政策列表显示，8月中下旬有国务院政策和国务院常务会议解读等内容。当天没有 8月25日新发国务院政策时，只作为政策背景资料。', fallbackTitle: '中国政府网政策栏目：8月中下旬国务院政策背景', read: '中国政府网是 A 级核心源，用于确认国务院政策原文和权威政策解读；若当日无新发，只进入背景资料，不混入每日摘要。', counter: '反证：政策栏目最新不等于当天新发，必须看发布日期。' },
  { id: 'stats-latest-2026-08-21', coverageOnly: true, grade: 'A', source: '国家统计局', sourceLevel: 'A', industry: '宏观数据、农业、工业、消费、投资', url: 'https://www.stats.gov.cn/szst/', staticPublishedAt: '2026-08-21', staticDesc: '国家统计局最新发布栏目 2026-08-21 有早稻产量数据公告，8月17日发布工业、投资、消费、能源等月度数据。当天无新发统计数据时，作为宏观背景。', fallbackTitle: '国家统计局最新发布：早稻产量与月度宏观数据背景', read: '统计局是 A 级宏观数据源，适合验证产业和需求方向；非当日发布时应作为背景，不计入当日摘要。', counter: '反证：宏观数据确认总量或结构变化，不等于上市公司订单或利润兑现。' },
  { id: 'ndrc-two-new-2026', grade: 'A', source: '国家发展改革委 / 财政部', sourceLevel: 'A', industry: '设备更新、智能终端、工业设备、资源循环利用', url: 'https://www.ndrc.gov.cn/xxgk/zcfb/tz/202512/t20251230_1402851.html', fallbackTitle: '关于2026年实施大规模设备更新和消费品以旧换新政策的通知', read: '政策工具直接指向设备更新、消费品以旧换新和资源循环利用。研究上应继续核验资金下达、地方执行、招投标和上市公司订单，不把补贴方向直接等同于利润兑现。', counter: '反证：资金安排、地方配套、项目审核和企业垫资周期都可能影响实际传导速度。' },
  { id: 'ndrc-equipment-fund-2026', grade: 'B', source: '国家发展改革委', sourceLevel: 'A', industry: '工业、能源电力、电子信息、物流、医疗、节能降碳', url: 'https://www.ndrc.gov.cn/fggz/202604/t20260430_1405007_ext.html', fallbackTitle: '2026年第二批915亿元超长期特别国债支持设备更新资金已经下达', read: '资金进度比政策口号更接近执行层。公开研究应继续跟踪项目清单、设备采购、形成实物工作量和企业回款。', counter: '反证：资金下达不等于企业确认收入，项目建设和付款节奏仍需公告、招投标和财报交叉验证。' },
  { id: 'miit-industrial-internet-2026', grade: 'B', source: '工业和信息化部等八部门', sourceLevel: 'A', industry: '工业互联网、制造业数字化、平台、数据、安全', url: 'https://wap.miit.gov.cn/jgsj/xgj/wjfb/art/2026/art_616aad2c6b1547b7a01422b0a419070d.html', fallbackTitle: '关于推动工业互联网高质量发展的实施意见', read: '工业互联网政策强调网络、标识、平台、数据和安全体系。投资研究应先看工业场景落地、客户验证和平台收入质量。', counter: '反证：平台建设容易出现重复投入和低价竞争，缺少客户付费和毛利率改善时只能保持观察。' },
  { id: 'miit-ai-ict-2026', grade: 'B', source: '工业和信息化部', sourceLevel: 'A', industry: '人工智能、信息通信、算力网络、智能体', url: 'https://fjca.miit.gov.cn/xwdt/bsyw/art/2026/art_f325d5fe373141a28b31a6fa43377a5a.html', fallbackTitle: '“人工智能+信息通信”创新发展实施意见（2026—2028年）', read: '政策方向聚焦信息通信智能化升级和人工智能底座。研究上要从网络、算力、应用场景和治理能力四条线拆分验证。', counter: '反证：AI 主题热度高，但没有订单、部署场景和收入确认时不能提升公司研究等级。' }
];

function decodeBuffer(buffer, contentType = '') {
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  const candidates = charset ? [charset, 'utf-8', 'gb18030'] : ['utf-8', 'gb18030'];
  for (const encoding of candidates) {
    try { return new TextDecoder(encoding).decode(buffer); }
    catch {}
  }
  return Buffer.from(buffer).toString('utf8');
}

function absoluteUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).toString(); }
  catch { return baseUrl; }
}
function sameHost(url, baseUrl) {
  try {
    const itemHost = new URL(url).hostname.replace(/^www\./, '');
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
    return itemHost === baseHost || itemHost.endsWith(`.${baseHost}`);
  } catch { return false; }
}
const financeKeywords = ['财经', '经济', '金融', '财政', '货币', '信贷', '利率', '债券', '国债', '专项债', '融资', '资金', '税费', '资本市场', '证券', '股票', '上市公司', '交易所', '公告', '停牌', '复牌', '监管问询', '并购重组', 'IPO', '再融资', '工业', '制造业', '设备更新', '以旧换新', '人工智能', '工业互联网', '算力', '数据', '消费', '投资', '外贸', '服务贸易', '外资', '民营经济', '企业账款', '价格', '就业', '进出口', '房地产', '住房公积金', '统计数据', 'PMI', 'CPI', 'PPI', '社融', 'M2'];
const exclusionKeywords = ['生态环境损害责任追究', '党政领导干部', '责任追究办法', '功勋', '奖章', '荣誉称号', '英雄航天员', '地质灾害', '防汛', '台风', '暴雨', '考试', '成绩查询', '资格考试', '招聘', '任免', '摄影', '书画', '展览', '工资总额信息披露', '所监管企业', '文学人才', '残障文学', '课题研究征集', '预算评审中心', '课题研究', '征集公告'];
function isPolicyRelevant(value) {
  const text = String(value || '');
  if (!text || exclusionKeywords.some((keyword) => text.includes(keyword))) return false;
  return financeKeywords.some((keyword) => text.includes(keyword));
}

function normalizeDateToken(token) {
  const match = String(token || '').match(/(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function compactText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function pickTitle(html, fallback) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = h1 || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || fallback;
  return compactText(title).replace(/[-_].*$/, '').trim() || fallback;
}
function pickDate(text) {
  const match = text.match(/(?:发布时间|发布日期|成文日期)?[：:\s]*(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})/);
  return normalizeDateToken(match?.[0] || '');
}
function extractListItems(html, baseUrl) {
  const items = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html)) && items.length < 80) {
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1];
    const titleAttr = match[1].match(/title=["']([^"']+)["']/i)?.[1];
    const title = compactText(titleAttr || match[2]);
    if (!href || !title || title.length < 4 || href.startsWith('javascript:')) continue;
    const url = absoluteUrl(href, baseUrl);
    if (!sameHost(url, baseUrl)) continue;
    const context = compactText(html.slice(Math.max(0, match.index - 180), Math.min(html.length, anchorPattern.lastIndex + 180)));
    const publishedAt = pickDate(`${title} ${context}`);
    items.push({ title, url, publishedAt, relevant: isPolicyRelevant(title) });
  }
  return items;
}
function excerpt(text) { return text.slice(0, 180).replace(/\s+/g, ' '); }
async function enrichListItem(item, source) {
  try {
    const response = await fetch(item.url, { headers: { 'User-Agent': 'Research-Stock public policy collector', Accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) return item;
    const html = decodeBuffer(await response.arrayBuffer(), response.headers.get('content-type') || '');
    const text = compactText(html);
    const title = pickTitle(html, item.title || source.fallbackTitle);
    const publishedAt = item.publishedAt || pickDate(text);
    return { ...item, title, publishedAt, detailExcerpt: excerpt(text) };
  } catch {
    return item;
  }
}
function daysBetween(dateText, baseText) {
  if (!dateText) return null;
  const date = new Date(`${dateText}T00:00:00+08:00`);
  const base = new Date(`${baseText}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime()) || Number.isNaN(base.getTime())) return null;
  return Math.round((base - date) / 86400000);
}
function confidenceFor(publishedAt, grade) {
  const ageDays = daysBetween(publishedAt, today);
  if (ageDays === null) return { value: '待复核', note: '官方页面已抓取，但发布时间没有从页面中稳定解析出来。' };
  if (ageDays < 0) return { value: '待复核', note: '发布时间晚于采集日期，需要人工确认页面日期。' };
  if (ageDays === 0 && grade === 'A') return { value: '高', note: '当天发布的官方原始来源。' };
  if (ageDays === 0 && grade === 'B') return { value: '中', note: '当天发布的权威媒体/政策解读来源，适合进入每日摘要，但需回溯官方原文。' };
  if (ageDays <= 30 && grade === 'A') return { value: '中高', note: `官方原始来源，距采集日 ${ageDays} 天，适合做当期背景。` };
  if (ageDays <= 30 && grade === 'B') return { value: '中低', note: `权威媒体/政策解读来源，距采集日 ${ageDays} 天，只能作为背景线索。` };
  if (ageDays <= 90 && grade === 'A') return { value: '中', note: `官方原始来源，但距采集日 ${ageDays} 天，只能作为近期政策背景。` };
  if (ageDays <= 90 && grade === 'B') return { value: '低', note: `权威媒体/政策解读来源，距采集日 ${ageDays} 天，不应当作新政策。` };
  return { value: '低', note: `${grade === 'A' ? '官方原始来源' : '权威媒体/政策解读来源'}，但距采集日 ${ageDays} 天，不应放在每日事实里当作新信息。` };
}
function policyAdmissionLevel(event) {
  const text = `${event.title || ''} ${event.desc || ''} ${event.read || ''} ${event.industry || ''}`;
  if (event.grade === 'C') return null;
  if (/人民日报|人民网|央视网|新华社/.test(event.source || '') && !/国务院|部委|工信部|人民银行|证监会|财政部|发改委|交易所|公告|通知|细则|规划|方案|修订|办法/.test(text)) return null;
  const hasHardLanding = /(亿元|资金|国债|补贴|比例|时间表|申报|采购|下达|实施细则|条例|通知)/.test(text);
  if (/国务院|中国人民银行|财政部/.test(event.source || '') && hasHardLanding) return 'A';
  if (/工信部|工业和信息化部|国家发展改革委|发改委|交易所|证监会/.test(event.source || '') && /(指导意见|规划|方案|细则|规则|修订|监管|工业互联网|人工智能|设备更新)/.test(text)) return 'B';
  return event.grade === 'A' ? 'B' : event.grade;
}
function admitPolicies(events) {
  return events.map((event) => {
    const admitted = policyAdmissionLevel(event);
    return admitted ? { ...event, grade: admitted, admittedLevel: admitted } : null;
  }).filter(Boolean);
}
function dailySummaryFromEvents(events) {
  const todayEvents = events.filter((event) => event.publishedAt === today && event.fetchStatus !== 'error' && event.displayInDaily !== false);
  const recentEvents = events.filter((event) => event.fetchStatus !== 'error' && event.ageDays !== null && event.ageDays <= 90);
  const todayOriginal = todayEvents.filter((event) => event.grade === 'A').length;
  const todayBriefing = todayEvents.filter((event) => event.grade === 'B').length;
  const todayMarket = todayEvents.filter((event) => event.grade === 'C').length;
  if (todayEvents.length) {
    return {
      mode: 'today',
      title: `今日公开信息 ${todayEvents.length} 条：A级原文 ${todayOriginal} 条，B级线索 ${todayBriefing} 条，C级市场信息 ${todayMarket} 条`,
      text: todayOriginal ? '今日摘要包含当天发布的官方原始来源；B级和C级信息只作补充线索。' : '今日未采到当天 A 级部委原文，但已采到当天权威公开线索和市场运行信息；它们可以进入每日摘要，同时必须标注来源级别和回溯要求。'
    };
  }
  return {
    mode: 'background',
    title: '今日未采到当天新发官方政策',
    text: `本页改为展示最新可用官方背景资料：近 90 天 ${recentEvents.length} 条；早于 90 天或日期未解析的内容仅列为背景/待复核。`
  };
}

async function fetchSource(source) {
  if (source.staticPublishedAt) {
    const confidence = confidenceFor(source.staticPublishedAt, source.grade);
    const ageDays = daysBetween(source.staticPublishedAt, today);
    return {
      id: source.id,
      title: source.fallbackTitle,
      desc: source.staticDesc || source.read,
      grade: source.grade,
      source: source.source,
      date: source.staticPublishedAt.slice(5),
      publishedAt: source.staticPublishedAt,
      ageDays,
      isToday: source.staticPublishedAt === today,
      confidence: confidence.value,
      confidenceNote: source.metadataNote || confidence.note,
      valueScore: source.grade === 'A' ? 85 : source.grade === 'B' ? 68 : 38,
      displayInDaily: !source.coverageOnly && source.staticPublishedAt === today && (source.displayToday === true || source.grade !== 'C'), displayInWeekly: !source.coverageOnly && ageDays !== null && ageDays >= 0 && ageDays <= 6 && source.grade !== 'C',
      watch: true,
      kicker: `${source.grade}级 · ${source.source}`,
      meta: `发布：${source.staticPublishedAt} · 元数据来源`,
      fact: source.staticDesc || source.read,
      read: source.read,
      counter: source.counter,
      sourceUrl: source.url,
      sourceLevel: source.sourceLevel,
      industry: source.industry,
      fetchedAt: new Date().toISOString(),
      fetchStatus: 'metadata'
    };
  }
  const response = await fetch(source.url, { headers: { 'User-Agent': 'Research-Stock public policy collector', Accept: 'text/html,application/xhtml+xml' } });
  if (!response.ok) throw new Error(`${source.url} HTTP ${response.status}`);
  const html = decodeBuffer(await response.arrayBuffer(), response.headers.get('content-type') || '');
  if (source.listPage) {
    const items = extractListItems(html, source.url);
    const recentRelevant = items
      .filter((item) => item.publishedAt && item.relevant)
      .map((item) => ({ ...item, ageDays: daysBetween(item.publishedAt, today) }))
      .filter((item) => item.ageDays !== null && item.ageDays >= 0 && item.ageDays <= 6)
      .slice(0, 3);
    const fallbackPicked = items.find((item) => item.publishedAt === today && item.relevant) || items.find((item) => item.publishedAt && item.relevant) || items.find((item) => item.relevant) || items.find((item) => item.publishedAt) || items[0];
    const pickedItems = recentRelevant.length ? recentRelevant : (fallbackPicked ? [fallbackPicked] : []);
    if (!pickedItems.length) throw new Error('no_list_item_found');
    const enrichedItems = await Promise.all(pickedItems.map((item) => enrichListItem(item, source)));
    return enrichedItems.map((picked, index) => {
      const confidence = confidenceFor(picked.publishedAt || '', source.grade);
      const ageDays = picked.ageDays ?? daysBetween(picked.publishedAt, today);
      const relevant = picked.relevant === true;
      const confidenceNote = relevant ? confidence.note : `${confidence.note} 标题未命中政策/经济/市场关键词，仅保留为后台抓取背景。`;
      return { id: `${source.id}-${(picked.publishedAt || today).replace(/-/g, '')}-${index}`, title: picked.title || source.fallbackTitle, desc: source.read, grade: source.grade, source: source.source, date: picked.publishedAt ? picked.publishedAt.slice(5) : '待复核', publishedAt: picked.publishedAt || null, ageDays, isToday: picked.publishedAt === today, confidence: confidence.value, confidenceNote, valueScore: relevant ? (source.grade === 'A' ? 88 : source.grade === 'B' ? 66 : 35) : 20, displayInDaily: relevant && picked.publishedAt === today && source.grade !== 'C', displayInWeekly: relevant && ageDays !== null && ageDays >= 0 && ageDays <= 6 && source.grade !== 'C', watch: true, kicker: `${source.grade}级 · ${source.source}`, meta: `${picked.publishedAt ? `发布：${picked.publishedAt}` : '发布日期待复核'} · 官方栏目抓取`, fact: source.read, read: source.read, counter: source.counter, sourceUrl: picked.url, sourceLevel: source.sourceLevel, industry: source.industry, fetchedAt: new Date().toISOString(), fetchStatus: 'ok' };
    });
  }
  const text = compactText(html);
  const title = pickTitle(html, source.fallbackTitle);
  const publishedAt = pickDate(text);
  const confidence = confidenceFor(publishedAt, source.grade);
  const ageDays = daysBetween(publishedAt, today);
  return { id: source.id, title, desc: excerpt(text), grade: source.grade, source: source.source, date: publishedAt ? publishedAt.slice(5) : '待复核', publishedAt: publishedAt || null, ageDays, isToday: publishedAt === today, confidence: confidence.value, confidenceNote: confidence.note, valueScore: source.grade === 'A' ? 90 : source.grade === 'B' ? 70 : 45, displayInDaily: publishedAt === today && source.grade !== 'C', displayInWeekly: ageDays !== null && ageDays >= 0 && ageDays <= 6 && source.grade !== 'C', watch: true, kicker: `${source.grade}级 · ${source.source}`, meta: `${publishedAt ? `发布：${publishedAt}` : '发布日期待复核'} · 官方公开页面`, fact: excerpt(text), read: source.read, counter: source.counter, sourceUrl: source.url, sourceLevel: source.sourceLevel, industry: source.industry, fetchedAt: new Date().toISOString(), fetchStatus: 'ok' };
}
function priorityFor(event) {
  const gradeRank = event.grade === 'A' ? 0 : event.grade === 'B' ? 1 : 2;
  const sourceRank = ['中国政府网', '商务部', '中国人民银行', '中国证监会', '国家统计局', '财政部独立栏目', '财政部政府债券公告'].includes(event.source) ? 0 : event.grade === 'B' ? 1 : 2;
  return gradeRank * 10 + sourceRank;
}
function dedupeAndSort(events) {
  const sorted = [...events].sort((a, b) => {
    if ((a.isToday ? 1 : 0) !== (b.isToday ? 1 : 0)) return (b.isToday ? 1 : 0) - (a.isToday ? 1 : 0);
    return priorityFor(a) - priorityFor(b);
  });
  const seen = new Set();
  const result = [];
  for (const event of sorted) {
    const key = String(event.title || '').replace(/[\s，。、“”‘’《》：:：-]+/g, '').slice(0, 40);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(event);
  }
  return result;
}
function buildSnapshot(events) {
  const curatedEvents = dedupeAndSort(admitPolicies(events));
  const okEvents = curatedEvents.filter((event) => event.fetchStatus !== 'error');
  const todayEvents = okEvents.filter((event) => event.isToday && event.displayInDaily !== false);
  const summary = dailySummaryFromEvents(curatedEvents);
  return { generatedAt: new Date().toISOString(), asOf: today, sourceRegistry, status: todayEvents.length ? '今日公开信息已采集' : '今日无新增公开信息', headline: summary.title, brief: { judgement: summary.text, judgementDetail: '每日公开摘要必须区分 A 级原始政策、B 级权威线索和历史背景；重复消息按政府机关原文优先，媒体只作线索。', counter: '历史政策、待解析日期和资金下达信息只能作为背景；仍需项目清单、招投标、公司公告、财报和现金流交叉验证。', next: '优先核验近 30 天官方文件、项目/资金执行明细、上市公司订单公告和最新财务质量。' }, events: curatedEvents };
}
async function writeJsonFiles(snapshot) {
  const candidates = [
    path.join(root, 'data', 'daily-evidence.json'),
    path.join(root, 'docs', 'data', 'daily-evidence.json'),
    path.join(root, 'github-public-repo', 'docs', 'data', 'daily-evidence.json')
  ];
  const files = [];
  for (const file of candidates) {
    const parent = path.dirname(file);
    try {
      await fs.access(parent);
      files.push(file);
    } catch {
      if (file === candidates[0] || file === candidates[1]) files.push(file);
    }
  }
  await Promise.all(files.map(async (file) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8'); }));
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

async function accessTokenFromServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';
  if (!raw) return '';
  const account = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const crypto = await import('node:crypto');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || body.error || 'service_account_token_failed');
  return body.access_token;
}

async function putFirestoreDocument(docId, snapshot) {
  if (!firestoreToken && !firestorePublicWrite) return { skipped: true, reason: 'FIRESTORE_ACCESS_TOKEN not set' };
  const authQuery = firestoreToken ? '' : `?key=${encodeURIComponent(firestoreApiKey)}`;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/publicDailyEvidence/${docId}${authQuery}`;
  const fields = { asOf: { stringValue: snapshot.asOf }, generatedAt: { timestampValue: snapshot.generatedAt }, status: { stringValue: snapshot.status }, payload: { stringValue: JSON.stringify(snapshot) } };
  const response = await fetch(url, { method: 'PATCH', headers: { ...(firestoreToken ? { Authorization: `Bearer ${firestoreToken}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  const body = await response.text();
  if (!response.ok) throw new Error(`Firestore write ${docId} failed: ${response.status} ${body}`);
  return { skipped: false, docId };
}
async function main() {
  const events = [];
  for (const source of sources) {
    try { const result = await fetchSource(source);
      events.push(...(Array.isArray(result) ? result : [result])); }
    catch (error) {
      if (source.staticPublishedAt) {
        const confidence = confidenceFor(source.staticPublishedAt, source.grade);
        const ageDays = daysBetween(source.staticPublishedAt, today);
        events.push({ id: source.id, title: source.fallbackTitle, desc: source.staticDesc || '页面抓取失败，使用已核验的来源元数据作为当日线索。', grade: source.grade, source: source.source, date: source.staticPublishedAt.slice(5), publishedAt: source.staticPublishedAt, ageDays, isToday: source.staticPublishedAt === today, confidence: confidence.value, valueScore: source.grade === 'A' ? 85 : source.grade === 'B' ? 68 : 35, displayInDaily: !source.coverageOnly && source.staticPublishedAt === today && (source.displayToday === true || source.grade !== 'C'), displayInWeekly: !source.coverageOnly && ageDays !== null && ageDays >= 0 && ageDays <= 6 && source.grade !== 'C', confidenceNote: `${confidence.note} 页面正文抓取失败，已保留来源链接，需人工回溯原文。`, watch: true, kicker: `${source.grade}级 · ${source.source}`, meta: `发布：${source.staticPublishedAt} · 元数据回退`, fact: source.staticDesc || '页面正文抓取失败，使用已核验的来源元数据作为当日线索。', read: source.read, counter: source.counter, sourceUrl: source.url, sourceLevel: source.sourceLevel, industry: source.industry, fetchedAt: new Date().toISOString(), fetchStatus: 'metadata-fallback', error: error.message });
      } else {
        events.push({ id: source.id, title: source.fallbackTitle, desc: '官方页面抓取失败，保留来源链接等待复核。', grade: source.grade, source: source.source, date: '待复核', confidence: '待复核', valueScore: 0, displayInDaily: false, confidenceNote: '抓取失败，不能评为高可信。', watch: true, kicker: `${source.grade}级 · ${source.source}`, meta: `抓取失败：${error.message}`, fact: '未取得页面正文。', read: source.read, counter: source.counter, sourceUrl: source.url, sourceLevel: source.sourceLevel, industry: source.industry, fetchedAt: new Date().toISOString(), fetchStatus: 'error', error: error.message });
      }
    }
  }
  const snapshot = buildSnapshot(events);
  await writeJsonFiles(snapshot);
  if (!firestoreToken) firestoreToken = await accessTokenFromServiceAccount();
  const writes = [await putFirestoreDocument(snapshot.asOf, snapshot), await putFirestoreDocument('latest', snapshot)];
  console.log(JSON.stringify({ asOf: snapshot.asOf, events: events.length, ok: events.filter((event) => event.fetchStatus === 'ok').length, dailyShown: snapshot.events.filter((event) => event.isToday && event.displayInDaily !== false).length, sourcesConfigured: sourceRegistry.length, firestore: writes }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
