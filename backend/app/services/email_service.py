"""Email-service via Resend — verificering, password reset, notifikationer."""

import logging
from app.config import settings

logger = logging.getLogger(__name__)


def _get_client():
    import resend
    resend.api_key = settings.resend_api_key
    return resend


def _base_template(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr>
          <td style="background:#122B4A;padding:32px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Nora</span>
            <span style="color:#0CA9BA;font-size:22px;font-weight:700;">.</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            {body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fb;padding:24px 40px;text-align:center;border-top:1px solid #e4e7ee;">
            <p style="margin:0;font-size:12px;color:#8896a4;">
              © 2025 Nora · AI-mailassistent · Al data behandles i EU
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _btn(url: str, label: str) -> str:
    return f"""<div style="text-align:center;margin:32px 0;">
      <a href="{url}" style="display:inline-block;background:#0CA9BA;color:#ffffff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">{label}</a>
    </div>
    <p style="text-align:center;font-size:12px;color:#8896a4;margin-top:8px;">
      Virker knappen ikke? Kopier denne URL: <a href="{url}" style="color:#0CA9BA;">{url}</a>
    </p>"""


async def send_verification_email(to: str, name: str, token: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY ikke sat — email-verificering er deaktiveret")
        return

    url = f"{settings.frontend_url}/verify-email?token={token}"
    body = f"""
    <h2 style="margin:0 0 8px;color:#0D1321;font-size:22px;">Bekræft din email</h2>
    <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hej {name},<br><br>
      Velkommen til Nora! Klik på knappen nedenfor for at bekræfte din emailadresse og aktivere din konto.
    </p>
    {_btn(url, 'Bekræft email')}
    <p style="color:#8896a4;font-size:13px;text-align:center;margin-top:16px;">Linket udløber om 24 timer.</p>
    """
    try:
        resend = _get_client()
        resend.Emails.send({
            "from": settings.resend_from_email,
            "to": [to],
            "subject": "Bekræft din Nora-konto",
            "html": _base_template("Bekræft din email", body),
        })
        logger.info("Verificerings-email sendt til %s", to)
    except Exception as e:
        logger.error("Kunne ikke sende verificerings-email: %s", e)


async def send_password_reset_email(to: str, name: str, token: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY ikke sat — password reset er deaktiveret")
        return

    url = f"{settings.frontend_url}/reset-password?token={token}"
    body = f"""
    <h2 style="margin:0 0 8px;color:#0D1321;font-size:22px;">Nulstil din adgangskode</h2>
    <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hej {name},<br><br>
      Vi modtog en anmodning om at nulstille adgangskoden på din Nora-konto.
      Klik på knappen nedenfor for at vælge en ny adgangskode.
    </p>
    {_btn(url, 'Nulstil adgangskode')}
    <p style="color:#8896a4;font-size:13px;text-align:center;margin-top:16px;">
      Linket udløber om 1 time.<br>
      Hvis du ikke anmodede om dette, kan du se bort fra denne email.
    </p>
    """
    try:
        resend = _get_client()
        resend.Emails.send({
            "from": settings.resend_from_email,
            "to": [to],
            "subject": "Nulstil din Nora-adgangskode",
            "html": _base_template("Nulstil adgangskode", body),
        })
        logger.info("Password-reset email sendt til %s", to)
    except Exception as e:
        logger.error("Kunne ikke sende password-reset email: %s", e)
