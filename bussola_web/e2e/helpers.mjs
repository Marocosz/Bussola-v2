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

// A API da agenda usa o relógio real do servidor (is_today do calendário e Pendente→Perdido),
// mas o navegador roda com FIXED_NOW. Reescreve a resposta do GET /agenda/ para o relógio fixo.
// Chamar ANTES de gotoApp. Só mexe em GET; o resto segue para a API.
const HOJE_FIXO = '2026-10-02';
const AGORA_FIXO = '2026-10-02T12:00:00'; // data_hora da API é hora local, sem fuso
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export async function congelarAgenda(page) {
  await page.route(/\/api\/v1\/agenda\/?(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const r = await route.fetch();
    const json = await r.json();

    // Data de cada célula: o divisor traz mês/ano; padding antes do dia 1 é do mês anterior, depois é do seguinte.
    let ano = null;
    let mes = null; // 0-11
    let viuMes = false;
    const pad = (n) => String(n).padStart(2, '0');
    for (const d of json.calendar_days || []) {
      if (d.type === 'month_divider') { ano = d.year; mes = MESES_PT.indexOf(d.month_name); viuMes = false; continue; }
      if (d.type !== 'day' || ano === null) continue;
      let y = ano;
      let m = mes;
      if (d.is_padding) m += viuMes ? 1 : -1; else viuMes = true;
      if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
      // Como o backend: qualquer célula com a data de hoje, inclusive padding.
      d.is_today = `${y}-${pad(m + 1)}-${pad(Number(d.day_number))}` === HOJE_FIXO;
    }

    for (const lista of Object.values(json.compromissos_por_mes || {})) {
      for (const c of lista) {
        if (c.status === 'Pendente' || c.status === 'Perdido') {
          c.status = String(c.data_hora) < AGORA_FIXO ? 'Perdido' : 'Pendente';
        }
      }
    }
    await route.fulfill({ response: r, json });
  });
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
        // campos só para validação nativa (aria-hidden, invisíveis, pointer-events: none) não são alvos de toque
        if (el.getAttribute('aria-hidden') === 'true' && cs.pointerEvents === 'none') continue;
        if (r.width < 43.5 || r.height < 43.5) {
          const nome = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
          out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${nome}" ${Math.round(r.width)}×${Math.round(r.height)}`);
        }
      }
    }
    return out;
  }, rootSelector);
}

// Espera as animações em curso (abertura de modal/sheet) terminarem antes de medir ou capturar.
export const animacoesAcabaram = (page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))));

// X (px) onde o texto digitado de um input começa (borda + padding esquerdo).
export const textoX = (loc) => loc.evaluate((e) => {
  const s = getComputedStyle(e);
  return e.getBoundingClientRect().left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
});
