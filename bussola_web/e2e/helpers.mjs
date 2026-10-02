// Relógio fixo: datas exibidas estáveis entre execuções (os dados demo ficam no banco).
export const FIXED_NOW = new Date('2026-10-02T12:00:00-03:00');

export async function gotoApp(page, path) {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// Elementos visíveis que ultrapassam a largura da viewport (só o mais externo de cada ramo).
export async function overflowOffenders(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out = [];
    const isOut = (r) => r.right > vw + 1 || r.left < -1;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !isOut(r)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[data-offscreen-ok]')) continue;
      const p = el.parentElement;
      if (p && isOut(p.getBoundingClientRect())) continue;
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    return out;
  });
}
