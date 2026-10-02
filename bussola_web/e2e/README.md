# E2E (Playwright)

Requer o venv do `bussola_api` (sobe a API com um banco demo descartável em `bussola_api/data/e2e_demo.db`, sem segredos reais).

    $env:BUSSOLA_PY = 'C:\...\bussola_api\venvbussola\Scripts\python.exe'   # se o venv não estiver em ../bussola_api/venvbussola
    npm run e2e                       # todos os projetos (desktop, mobile, tablet)
    npm run e2e -- --project=mobile   # só mobile
    npm run e2e:update -- --project=desktop   # regenerar a base visual (somente quando a mudança no desktop for intencional)

- `*.desktop.spec.mjs` = 1280×900 · `*.mobile.spec.mjs` = 390×844 (touch) · `*.tablet.spec.mjs` = 900×1200 (touch)
- Relógio fixo em 2026-10-02 12:00 (helpers.mjs) para as datas ficarem estáveis.
- Para recriar os dados demo: pare a API e apague `bussola_api/data/e2e_demo.db` (e regenere a base visual).
- `/__ui` é uma bancada DEV-only dos primitivos mobile (não vai para o build de produção).
