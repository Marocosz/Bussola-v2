// Utilidades das specs de Login/Registro/Auth.
export const DESLOGADO = { cookies: [], origins: [] };

// O script do Google (GSI) vem da rede. Nos testes ele fica bloqueado: sem dependência externa
// e sem o initTokenClient (que, sem client id, derruba o Login).
export async function semGoogle(page) {
  await page.route(/^https:\/\/accounts\.google\.com\//, (r) => r.abort());
}

// O backend E2E sobe com cadastro fechado; para ver /register a config é interceptada.
export async function cadastroAberto(page) {
  await page.route(/\/api\/v1\/system\/config$/, (r) => r.fulfill({
    json: { deployment_mode: 'SELF_HOSTED', public_registration: true, google_login_enabled: false, stripe_enabled: false },
  }));
}
