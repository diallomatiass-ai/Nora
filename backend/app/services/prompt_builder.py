"""Prompt construction for email classification and reply generation."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.email_message import EmailMessage
    from app.models.template import Template
    from app.models.user import User


def build_classification_prompt(email_subject: str, email_body: str) -> str:
    """Build a prompt that asks the LLM to classify an incoming email.

    The LLM should return a JSON object with:
      - category: inquiry | complaint | order | support | spam | other
      - urgency: high | medium | low
      - topic: short description (max 10 words)
      - confidence: float between 0 and 1

    Args:
        email_subject: The email subject line.
        email_body: The plain-text email body.

    Returns:
        A fully-formed classification prompt string.
    """
    return f"""You are an email classification assistant. Analyze the following email and return a JSON object with exactly these four fields:

- "category": one of "inquiry", "complaint", "order", "support", "spam", "other"
- "urgency": one of "high", "medium", "low"
- "topic": a short description of the email topic (max 10 words)
- "confidence": a float between 0.0 and 1.0 indicating your confidence

Return ONLY valid JSON. No explanations, no markdown formatting, no code fences.

Email subject: {email_subject}

Email body:
{email_body}

JSON response:"""


async def build_reply_prompt(
    email: EmailMessage,
    user: User,
    knowledge_context: list[dict],
    similar_replies: list[dict],
    templates: list[Template],
    style_samples: list[dict] | None = None,
) -> str:
    """Build a prompt for generating a reply to the given email.

    Incorporates RAG context from the knowledge base, previously approved
    replies, and user-defined templates.

    Args:
        email: The incoming EmailMessage to reply to.
        user: The User who owns the mailbox.
        knowledge_context: Relevant knowledge base entries from ChromaDB.
        similar_replies: Previously approved similar replies from ChromaDB.
        templates: Matching Template objects from the database.

    Returns:
        A fully-formed reply generation prompt string.
    """
    # --- Company info ---
    company_section = ""
    if user.company_name:
        company_section = f"\nCompany: {user.company_name}"

    # --- Knowledge base context ---
    knowledge_section = ""
    if knowledge_context:
        entries = []
        for entry in knowledge_context:
            meta = entry.get("metadata", {})
            title = meta.get("title", "")
            doc = entry.get("document", "")
            entries.append(f"- {title}: {doc}" if title else f"- {doc}")
        knowledge_section = (
            "\n\n## Relevant knowledge base entries\n" + "\n".join(entries)
        )

    # --- Similar previously approved replies ---
    replies_section = ""
    if similar_replies:
        items = []
        for reply in similar_replies:
            doc = reply.get("document", "")
            items.append(f"- {doc}")
        replies_section = (
            "\n\n## Previously approved similar replies (use as style/content reference)\n"
            + "\n".join(items)
        )

    # --- Templates ---
    templates_section = ""
    if templates:
        items = []
        for tmpl in templates:
            items.append(f"- Template '{tmpl.name}' (category: {tmpl.category}):\n  {tmpl.body}")
        templates_section = (
            "\n\n## Available reply templates\n" + "\n".join(items)
        )

    # --- Skrivestils-eksempler (fra godkendte svar) ---
    style_examples_section = ""
    if style_samples:
        items = [f"- {s.get('document', '')}" for s in style_samples if s.get("document")]
        if items:
            style_examples_section = (
                "\n\n## Brugerens skrivestil (nylige godkendte svar — efterlign denne stil)\n"
                + "\n".join(items)
            )

    # --- Style analysis from approved replies ---
    style_section = ""
    if similar_replies or style_samples:
        style_section = """
## Writing style
- IMPORTANT: Match the tone, vocabulary, and sentence structure from the style examples and previously approved replies.
- If approved replies are formal, be formal. If casual, be casual.
- Mimic greeting style, sign-off style, and level of detail from the examples.
- Prioritize consistency with the user's established communication patterns."""

    return f"""You are a professional email reply assistant. Write a reply to the email below.

## Instructions
- Reply in Danish.
- Maximum 150 words.
- Use the provided context (knowledge base, previous replies, templates) to craft an accurate and helpful response.
- Do NOT include a subject line. Write only the reply body.
- Sign off with the sender's name: {user.name}
{style_section}

## Sender information
Name: {user.name}{company_section}

## Original email
From: {email.from_name or email.from_address} <{email.from_address}>
Subject: {email.subject or '(no subject)'}
Category: {email.category or 'unknown'}
Urgency: {email.urgency or 'unknown'}

Body:
{email.body_text or '(empty)'}
{knowledge_section}{replies_section}{templates_section}{style_examples_section}

## Reply:"""
