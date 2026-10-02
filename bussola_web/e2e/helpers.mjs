import fs from 'node:fs';

const API = 'http://127.0.0.1:8000/api/v1';

// Token do usuário demo gravado pelo global-setup (cwd = bussola_web/).
export function authHeaders() {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/state.json', 'utf8'));
  const token = state.origins[0].localStorage.find((i) => i.name === '@Bussola:token').value;
  return { Authorization: `Bearer ${token}` };
}

// Chamada direta à API (setup/limpeza de dados de teste). Lança em status != 2xx.
export async function apiJson(request, method, path, data) {
  const res = await request.fetch(`${API}${path}`, { method, headers: authHeaders(), data });
  if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

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

// Controles interativos visíveis menores que 44×44 dentro de `rootSelector` (todas as ocorrências).
export async function smallTargets(page, rootSelector) {
  return page.evaluate((sel) => {
    const out = [];
    const alvo = 'button, a[href], select, [role="button"], [role="tab"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])';
    for (const root of document.querySelectorAll(sel)) {
      for (const el of root.querySelectorAll(alvo)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (r.width < 43.5 || r.height < 43.5) {
          const nome = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
          out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${nome}" ${Math.round(r.width)}×${Math.round(r.height)}`);
        }
      }
    }
    return out;
  }, rootSelector);
}
