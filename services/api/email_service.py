import os

import resend
from dotenv import load_dotenv


load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")


def send_password_reset_email(to_email: str, reset_url: str):
    resend.api_key = RESEND_API_KEY

    return resend.Emails.send({
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": "Restablecé tu contraseña",
        "html": (
            "<p>Recibimos una solicitud para restablecer tu contraseña.</p>"
            f'<p><a href="{reset_url}">Hacé clic aquí para elegir una nueva contraseña</a></p>'
            "<p>Si vos no solicitaste esto, podés ignorar este email.</p>"
        ),
        "text": (
            "Recibimos una solicitud para restablecer tu contraseña.\n"
            f"Abrí este enlace para elegir una nueva contraseña: {reset_url}\n"
            "Si vos no solicitaste esto, podés ignorar este email."
        )
    })
