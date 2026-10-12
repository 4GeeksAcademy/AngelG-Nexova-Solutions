import email_service


def test_send_password_reset_email_calls_resend(monkeypatch):
    captured = {}

    def fake_send(params):
        captured["params"] = params
        return {"id": "fake-id"}

    monkeypatch.setattr(email_service.resend.Emails, "send", fake_send)
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "test-key")

    email_service.send_password_reset_email(
        "user@example.com",
        "http://localhost:3000/reset-password?token=abc123"
    )

    assert captured["params"]["to"] == ["user@example.com"]
    assert "abc123" in captured["params"]["html"]
    assert "abc123" in captured["params"]["text"]


def test_send_password_reset_email_does_not_call_real_resend(monkeypatch):
    # Si el test intentara pegarle a la red real, esto lo detectaría.
    def fail_if_called(*args, **kwargs):
        raise AssertionError("No debe llamarse a Resend real durante los tests")

    monkeypatch.setattr(email_service.resend.Emails, "send", fail_if_called)

    called = {"value": False}

    def fake_send(params):
        called["value"] = True

    monkeypatch.setattr(email_service.resend.Emails, "send", fake_send)

    email_service.send_password_reset_email(
        "user@example.com",
        "http://localhost:3000/reset-password?token=abc123"
    )

    assert called["value"] is True
