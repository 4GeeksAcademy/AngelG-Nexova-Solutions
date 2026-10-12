def test_api_smoke(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"message": "API funcionando"}