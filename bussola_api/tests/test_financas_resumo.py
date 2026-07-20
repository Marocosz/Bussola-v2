def test_dashboard_financas_inclui_resumo_patrimonio(client):
    r = client.get("/api/v1/financas/")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "resumo_patrimonio" in body
    assert {"disponivel", "guardado", "total"} <= body["resumo_patrimonio"].keys()
