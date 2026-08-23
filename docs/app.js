(() => {
  const publicSnapshot = {
    asOf: '示例快照',
    topics: [
      { name: '先进制造', status: '部分核验', description: '示例主题：先检查设备、零部件与客户认证，再判断政策能否传导到订单。', choke: '关键设备与零部件需要客户认证和交付证据', representatives: ['示例公司 A', '示例公司 B', '示例公司 C', '示例公司 D', '示例公司 E'] },
      { name: '电力基础设施', status: '仅观察', description: '示例主题：从电网投资、项目资金和执行主体，追踪设备交付与回款。', choke: '设备交付周期和项目回款需要进一步核验', representatives: ['示例公司 F', '示例公司 G', '示例公司 H', '示例公司 I', '示例公司 J'] },
      { name: '半导体设备', status: '仅观察', description: '示例主题：国产替代必须落到客户验证、采购、交付和收入。', choke: '国产替代不能只看产品发布，还要看客户验证和收入', representatives: ['示例公司 K', '示例公司 L', '示例公司 M', '示例公司 N', '示例公司 O'] }
    ]
  };

  const topicGrid = document.querySelector('#topic-grid');
  if (topicGrid) {
    topicGrid.innerHTML = publicSnapshot.topics.map((topic) => `
      <article class="topic-card">
        <div class="topic-top"><h3>${topic.name}</h3><span class="topic-status">${topic.status}</span></div>
        <p>${topic.description}</p>
        <div class="choke-line"><strong>卡脖子判断 · 示例</strong>${topic.choke}</div>
        <ul class="rep-list">${topic.representatives.map((name, index) => `<li><span>${String(index + 1).padStart(2, '0')} · ${name}</span><em>待核验</em></li>`).join('')}</ul>
      </article>
    `).join('');
  }

  const prompt = document.querySelector('#prompt-text')?.innerText || '';
  const copyButton = document.querySelector('#copy-prompt');
  const feedback = document.querySelector('#copy-feedback');
  copyButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      if (feedback) feedback.textContent = '已复制。把 [板块或产业链] 换成你的研究主题即可。';
    } catch (error) {
      if (feedback) feedback.textContent = '浏览器未授权自动复制，请手动选择上方提示词。';
    }
  });
})();
