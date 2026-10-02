import fs from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
  const body = new URLSearchParams({ username: 'demo@bussola.dev', password: 'Demo12345!' });
  const res = await fetch('http://127.0.0.1:8000/api/v1/auth/access-token', { method: 'POST', body });
  if (!res.ok) throw new Error(`login demo falhou: ${res.status} ${await res.text()}`);
  const { access_token, refresh_token } = await res.json();
  const state = {
    cookies: [],
    origins: [{
      origin: 'http://127.0.0.1:5173',
      localStorage: [
        { name: '@Bussola:token', value: access_token },
        { name: '@Bussola:refresh_token', value: refresh_token },
      ],
    }],
  };
  const file = path.resolve('e2e/.auth/state.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
}
