def test_criar_e_listar_via_api(client):
    r = client.post("/api/v1/financas/metas", json={"nome": "Carro", "valor_alvo": 50000})
    assert r.status_code == 200, r.text
    assert r.json()["nome"] == "Carro"

    r2 = client.get("/api/v1/financas/metas")
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["metas"]) == 1
    assert "resumo" in body and {"disponivel", "guardado", "total"} <= body["resumo"].keys()


def test_aporte_via_api_atualiza_progresso(client):
    meta_id = client.post("/api/v1/financas/metas", json={"nome": "V", "valor_alvo": 200}).json()["id"]
    r = client.post(
        f"/api/v1/financas/metas/{meta_id}/movimentacoes",
        json={"tipo": "aporte", "valor": 50},
    )
    assert r.status_code == 200, r.text
    metas = client.get("/api/v1/financas/metas").json()["metas"]
    alvo = next(m for m in metas if m["id"] == meta_id)
    assert alvo["saldo_atual"] == 50.0
    assert alvo["progresso_pct"] == 25.0


def test_retirada_bloqueada_retorna_400(client):
    meta_id = client.post(
        "/api/v1/financas/metas", json={"nome": "V", "valor_alvo": 1000, "trancada": True}
    ).json()["id"]
    client.post(f"/api/v1/financas/metas/{meta_id}/movimentacoes", json={"tipo": "aporte", "valor": 100})
    r = client.post(
        f"/api/v1/financas/metas/{meta_id}/movimentacoes", json={"tipo": "retirada", "valor": 50}
    )
    assert r.status_code == 400
