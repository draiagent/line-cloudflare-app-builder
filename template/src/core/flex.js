// 長輩友善 Flex 卡片：一個大圖示＋短標題＋一句話＋最多兩個大按鈕。

export const COLORS = {
  red: { bg: '#D7263D', fg: '#FFFFFF' },
  yellow: { bg: '#FFC61A', fg: '#3D2B00' }, // 黃底一律深色字
  green: { bg: '#138A3E', fg: '#FFFFFF' },
  blue: { bg: '#1565C0', fg: '#FFFFFF' },
};

export const countChars = (s = '') => [...s].length;

// 檢查字數；回傳問題清單（空陣列＝通過）
export function checkLimits(screen, limits) {
  const issues = [];
  if (countChars(screen.title) > limits.title) issues.push(`主標超過 ${limits.title} 字：${screen.title}`);
  const parts = [screen.title, screen.text || ''];
  if (limits.countButtons) parts.push(...(screen.buttons || []).map((b) => b.label));
  const total = parts.reduce((n, s) => n + countChars(s), 0);
  if (total > limits.total) issues.push(`整則 ${total} 字，超過 ${limits.total} 字：${screen.title}`);
  if ((screen.buttons || []).length > 2) issues.push(`按鈕超過兩個：${screen.title}`);
  return issues;
}

// screen = { color, icon, title, text, buttons: [{ label, data, color }] }；按鈕顏色同樣依紅黃綠藍規則；iconBase = 圖示的 HTTPS 網址前綴
export function card(screen, iconBase) {
  const c = COLORS[screen.color];
  if (!c) throw new Error(`未知的顏色：${screen.color}`);
  const contents = [
    { type: 'image', url: `${iconBase}/${screen.icon}`, size: 'full', aspectRatio: '1:1', aspectMode: 'fit' },
    { type: 'text', text: screen.title, size: '4xl', weight: 'bold', color: c.fg, align: 'center', wrap: true },
  ];
  if (screen.text) contents.push({ type: 'text', text: screen.text, size: 'xxl', color: c.fg, align: 'center', wrap: true });
  for (const b of screen.buttons || []) {
    const bc = COLORS[b.color];
    if (!bc) throw new Error(`未知的按鈕顏色：${b.color}`);
    contents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: bc.bg,
      borderColor: bc.fg, // 黃按鈕放在黃底上時靠深色外框辨識
      borderWidth: 'bold',
      cornerRadius: '16px',
      paddingAll: '20px',
      margin: 'lg',
      action: { type: 'postback', label: b.label, data: b.data, displayText: b.label },
      contents: [{ type: 'text', text: b.label, size: '3xl', weight: 'bold', color: bc.fg, align: 'center' }],
    });
  }
  return {
    type: 'flex',
    altText: [screen.title, screen.text].filter(Boolean).join(' '),
    contents: {
      type: 'bubble',
      size: 'giga',
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '24px', backgroundColor: c.bg, contents },
    },
  };
}
