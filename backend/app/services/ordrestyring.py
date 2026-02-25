"""Ordrestyring.dk API v2 integration."""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.customer import Customer

logger = logging.getLogger(__name__)

BASE_URL = "https://v2.api.ordrestyring.dk"


def _auth() -> httpx.BasicAuth:
    return httpx.BasicAuth(settings.ordrestyring_api_key, "x")


async def push_customer(
    customer: Customer, description: str, db: AsyncSession
) -> dict:
    """Create debtor + case in Ordrestyring and update local customer."""
    customer_number = str(customer.id).replace("-", "")[:8]

    debtor_payload = {
        "customer_name": customer.name,
        "customer_address": customer.address_street or "Ikke angivet",
        "customer_postalcode": customer.address_zip or "0000",
        "customer_city": customer.address_city or "Ikke angivet",
        "invoice_name": customer.name,
        "invoice_address": customer.address_street or "Ikke angivet",
        "invoice_postalcode": customer.address_zip or "0000",
        "invoice_city": customer.address_city or "Ikke angivet",
        "customer_number": customer_number,
    }
    if customer.phone:
        debtor_payload["customer_telephone"] = customer.phone
    if customer.email:
        debtor_payload["customer_email"] = customer.email

    async with httpx.AsyncClient(timeout=15) as client:
        # Create debtor
        resp = await client.post(
            f"{BASE_URL}/debtors", json=debtor_payload, auth=_auth()
        )
        resp.raise_for_status()
        debtor_data = resp.json()
        final_customer_number = debtor_data.get("customer_number", customer_number)

        # Create case
        case_payload: dict = {
            "customer_number": final_customer_number,
            "case_number": f"AH-{customer_number}",
        }
        if description:
            case_payload["description"] = description
        if settings.ordrestyring_default_case_status:
            case_payload["case_status_id"] = settings.ordrestyring_default_case_status

        resp = await client.post(
            f"{BASE_URL}/cases", json=case_payload, auth=_auth()
        )
        resp.raise_for_status()
        case_data = resp.json()

    # Update local customer
    customer.external_id = final_customer_number
    customer.pushed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(customer)

    return {
        "customer_number": final_customer_number,
        "case_number": case_data.get("case_number", case_payload["case_number"]),
    }


async def check_connection() -> bool:
    """Validate API key by fetching one user."""
    if not settings.ordrestyring_api_key:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{BASE_URL}/users", params={"pagesize": 1}, auth=_auth()
            )
            return resp.status_code == 200
    except httpx.HTTPError:
        return False
