"""
Seed script — opretter demodata til Coas 2.0 (mail + kalender).
Kør med: docker compose exec backend python seed.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session, engine, Base
from app.models.user import User
from app.models.mail_account import MailAccount
from app.models.email_message import EmailMessage
from app.models.ai_suggestion import AiSuggestion
from app.models.template import Template
from app.models.knowledge_base import KnowledgeBase
from app.models.calendar_event import CalendarEvent
from app.models.calendar_account import CalendarAccount
from app.utils.auth import hash_password


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        now = datetime.now(timezone.utc)

        # ─────────────────────────────────────────────
        # RYD EKSISTERENDE DATA
        # ─────────────────────────────────────────────
        from sqlalchemy import text
        await db.execute(text("""
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
                END LOOP;
            END $$;
        """))
        await db.commit()
        print("Eksisterende data slettet.")

        # ─────────────────────────────────────────────
        # BRUGER
        # ─────────────────────────────────────────────
        user = User(
            id=uuid.uuid4(),
            email="test@mailbot.dk",
            password_hash=hash_password("test1234"),
            name="Martin Jensen",
            company_name="Jensens VVS ApS",
        )
        db.add(user)
        await db.flush()
        print(f"Bruger: {user.email}")

        # ─────────────────────────────────────────────
        # MAILKONTO
        # ─────────────────────────────────────────────
        account = MailAccount(
            id=uuid.uuid4(),
            user_id=user.id,
            email_address="test@mailbot.dk",
            provider="gmail",
            is_active=True,
        )
        db.add(account)
        await db.flush()
        print(f"Mailkonto: {account.email_address}")

        # ─────────────────────────────────────────────
        # EMAILS (14 stk)
        # ─────────────────────────────────────────────
        emails_data = [
            ("henrik@soerensenbyg.dk", "Henrik Sørensen", "Tilbud på badeværelsesrenovering", "Vi ønsker at renovere to badeværelser. Kan I give et tilbud? Vi er fleksible ift. tidspunkt.", "tilbud", "high"),
            ("mette@privat.dk", "Mette Andersen", "Vandhane drypper", "Min vandhane i køkkenet drypper konstant. Hvornår kan I komme ud og kigge på det?", "booking", "medium"),
            ("lars@nielsen-vvs.dk", "Lars Nielsen VVS", "Samarbejde om større projekt", "Vi er i gang med et større boligprojekt på 24 enheder og søger en underleverandør til VVS.", "tilbud", "high"),
            ("tina@gmail.com", "Tina Christensen", "Klage: Varmtvandsbeholder virker ikke", "Den varmtvandsbeholder I installerede for 2 uger siden virker slet ikke. Jeg er meget utilfreds.", "reklamation", "high"),
            ("bjorn@pedersen.dk", "Bjørn Pedersen", "Pris på fjernvarmetilslutning", "Hvad koster det at tilslutte vores ejendom til fjernvarmenettet?", "tilbud", "medium"),
            ("sofia@sofia-design.dk", "Sofia Mahmoud", "Rørskade i kælder", "Vi har opdaget en rørskade i vores kælder. Der er allerede vand på gulvet. Haster!", "booking", "high"),
            ("poul@rasmussen-toem.dk", "Poul Rasmussen", "Faktura #2024-0892", "Vedhæftet faktura for arbejdet udført i november. Betalingsfrist 30 dage.", "faktura", "low"),
            ("info@boligstyring.dk", "Boligstyring ApS", "Årskontrakt — vedligeholdelse", "Vi administrerer 180 lejligheder og søger en fast VVS-partner til service og akutopkald.", "tilbud", "high"),
            ("anne@koch.dk", "Anne-Marie Koch", "Aflysning af tid", "Jeg er desværre nødt til at aflyse den aftalte tid på torsdag. Kan vi rykke til næste uge?", "booking", "low"),
            ("jacob@thorsen-el.dk", "Jacob Thorsen El", "Fælles tilbud — kombiprojekt", "Jeg har en kunde der ønsker nyt badeværelse. Lad os give et samlet tilbud — el + VVS.", "tilbud", "medium"),
            ("camilla@brun.dk", "Camilla Brun", "Tak for god service!", "Vil bare sige tak for det hurtige og professionelle arbejde. Vi er meget tilfredse.", "andet", "low"),
            ("spam@reklame.com", "Tilbud til dig!", "Vind en iPhone 15 — klik nu!", "Du er udvalgt til at vinde en iPhone. Klik her inden for 24 timer!!!", "spam", "low"),
            ("leverandor@broen.dk", "Broen VVS Engros", "Prisliste 2026 + nye produkter", "Vedhæftet vores opdaterede prisliste for 2026. Kontakt os for mængderabat.", "leverandor", "low"),
            ("intern@jensens-vvs.dk", "Kontor", "Ny ferieplan Q2 2026", "Hermed ferieplan for Q2. Husk at registrere ønsker inden 1. marts.", "intern", "low"),
        ]

        email_objs = []
        for i, (from_addr, from_name, subject, body, category, urgency) in enumerate(emails_data):
            email = EmailMessage(
                id=uuid.uuid4(),
                account_id=account.id,
                provider_id=f"msg_{i+1:04d}",
                from_address=from_addr,
                from_name=from_name,
                to_address="test@mailbot.dk",
                subject=subject,
                body_text=body,
                received_at=now - timedelta(hours=i * 4 + 1),
                category=category,
                urgency=urgency,
                processed=True,
                is_read=i > 6,
            )
            db.add(email)
            email_objs.append(email)
        await db.flush()
        print(f"Emails: {len(email_objs)} stk")

        # ─────────────────────────────────────────────
        # AI-FORSLAG (6 stk)
        # ─────────────────────────────────────────────
        suggestions_data = [
            (0, "Kære Henrik,\n\nTak for din henvendelse. Vi ser frem til at renovere jeres badeværelser.\n\nVi foreslår et besøg til syn og opmåling, hvorefter vi sender et detaljeret tilbud inden for 3 hverdage.\n\nPasser tirsdag den 4. marts kl. 10:00?\n\nMed venlig hilsen\nMartin Jensen\nJensens VVS ApS · 44 55 66 77"),
            (1, "Kære Mette,\n\nTak for din henvendelse. En dryppende vandhane er irriterende — vi fikser det hurtigt.\n\nVi har en ledig tid allerede i morgen, onsdag, kl. 13:00-15:00. Passer det?\n\nMed venlig hilsen\nMartin Jensen\nJensens VVS ApS"),
            (3, "Kære Tina,\n\nVi beklager dybt, at din nye varmtvandsbeholder ikke fungerer korrekt.\n\nVi sender en tekniker ud i dag inden kl. 17:00 for at undersøge og udbedre fejlen — uden beregning.\n\nMed venlig hilsen\nMartin Jensen\nJensens VVS ApS"),
            (5, "Kære Sofia,\n\nVi forstår at det haster med rørskaden. Vi sender en nødteknikker inden for 2 timer.\n\nRing venligst på 44 55 66 77 for direkte koordinering.\n\nMed venlig hilsen\nMartin Jensen\nJensens VVS ApS"),
            (7, "Kære Boligstyring ApS,\n\nTak for jeres henvendelse. Et samarbejde om 180 lejligheder lyder meget interessant.\n\nJeg foreslår et møde, hvor vi kan gennemgå jeres behov. Hvornår passer det jer?\n\nMed venlig hilsen\nMartin Jensen\nJensens VVS ApS"),
            (9, "Kære Jacob,\n\nEt kombineret tilbud på el og VVS er en god løsning for kunden.\n\nJeg er ledig torsdag eller fredag denne uge. Hvad passer dig?\n\nMed venlig hilsen\nMartin Jensen\nJensens VVS ApS"),
        ]
        for email_idx, text in suggestions_data:
            db.add(AiSuggestion(
                id=uuid.uuid4(),
                email_id=email_objs[email_idx].id,
                suggested_text=text,
                status="pending",
            ))
        print(f"AI-forslag: {len(suggestions_data)} stk")

        # ─────────────────────────────────────────────
        # SKABELONER (5 stk)
        # ─────────────────────────────────────────────
        templates = [
            Template(id=uuid.uuid4(), user_id=user.id, name="Tilbudsbekræftelse", body="Kære {{navn}},\n\nTak for din forespørgsel. Vi sender et detaljeret tilbud inden for 2 hverdage.\n\nMed venlig hilsen\nJensens VVS ApS\nTlf. 44 55 66 77", category="tilbud"),
            Template(id=uuid.uuid4(), user_id=user.id, name="Tidsbestilling", body="Kære {{navn}},\n\nVi bekræfter din tid {{dato}} kl. {{tidspunkt}}.\n\nVores teknikere ringer 30 min. i forvejen.\n\nMed venlig hilsen\nJensens VVS ApS", category="booking"),
            Template(id=uuid.uuid4(), user_id=user.id, name="Reklamationssvar", body="Kære {{navn}},\n\nVi beklager de problemer du oplever og tager det meget alvorligt.\n\nVi sender en tekniker ud {{dato}} — arbejdet sker uden beregning under garantien.\n\nMed venlig hilsen\nJensens VVS ApS", category="reklamation"),
            Template(id=uuid.uuid4(), user_id=user.id, name="Fakturaopfølgning", body="Kære {{navn}},\n\nVenlig påmindelse om faktura #{{fakturanr}} på kr. {{beløb}} med forfaldsdato {{dato}}.\n\nBetaling via MobilePay 12345 eller bankoverførsel.\n\nMed venlig hilsen\nJensens VVS ApS", category="faktura"),
            Template(id=uuid.uuid4(), user_id=user.id, name="Aflysningsbekræftelse", body="Kære {{navn}},\n\nVi bekræfter aflysning af din tid {{dato}}. Vi håber at høre fra dig snart.\n\nMed venlig hilsen\nJensens VVS ApS", category="booking"),
        ]
        for t in templates:
            db.add(t)
        print(f"Skabeloner: {len(templates)} stk")

        # ─────────────────────────────────────────────
        # VIDENBASE (6 poster)
        # ─────────────────────────────────────────────
        kb_entries = [
            KnowledgeBase(id=uuid.uuid4(), user_id=user.id, title="Leveringstider", content="Akutopkald: inden for 2 timer. Standardopgave: 1-3 hverdage. Større renoveringer: aftales individuelt.", entry_type="faq"),
            KnowledgeBase(id=uuid.uuid4(), user_id=user.id, title="Priser", content="Timepris hverdage: 695 kr. ex. moms. Tillæg weekend/aften: 50%. Akut tillæg: 100%. Opstartsgebyr: 395 kr.", entry_type="faq"),
            KnowledgeBase(id=uuid.uuid4(), user_id=user.id, title="Garantivilkår", content="Garanti på udført arbejde: 5 år. Garanti på nye installationer: 2 år. Reklamationer behandles inden for 24 timer.", entry_type="faq"),
            KnowledgeBase(id=uuid.uuid4(), user_id=user.id, title="Åbningstider", content="Mandag-fredag: 07:00-16:00. Vagttelefon (akut): Alle dage 06:00-22:00.", entry_type="hours"),
            KnowledgeBase(id=uuid.uuid4(), user_id=user.id, title="Tone of voice", content="Brug altid en professionel og imødekommende tone. Start med 'Kære [fornavn]'. Slut med 'Med venlig hilsen\nMartin Jensen\nJensens VVS ApS'.", entry_type="tone"),
            KnowledgeBase(id=uuid.uuid4(), user_id=user.id, title="Serviceområde", content="Aarhus og omegn inden for 40 km: Randers, Silkeborg, Skanderborg, Horsens, Odder, Ebeltoft.", entry_type="faq"),
        ]
        for kb in kb_entries:
            db.add(kb)
        print(f"Videnbase: {len(kb_entries)} poster")

        # ─────────────────────────────────────────────
        # KALENDERBEGIVENHEDER (6 stk)
        # ─────────────────────────────────────────────
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        cal_events = [
            CalendarEvent(id=uuid.uuid4(), user_id=user.id, account_id=account.id,
                title="☕ Morgenmøde — ugeplan",
                description="Intern gennemgang af ugens opgaver og ressourcer",
                start_time=today + timedelta(hours=8),
                end_time=today + timedelta(hours=9),
                event_type="manual"),
            CalendarEvent(id=uuid.uuid4(), user_id=user.id, account_id=account.id,
                title="🔧 Besøg: Henrik Sørensen — opmåling",
                description="Opmåling til badeværelsesrenovering × 2. Sørensensgade 12.",
                start_time=today + timedelta(days=1, hours=10),
                end_time=today + timedelta(days=1, hours=11),
                event_type="manual"),
            CalendarEvent(id=uuid.uuid4(), user_id=user.id, account_id=account.id,
                title="📋 Tilbud: Lars Nielsen VVS",
                description="Send tilbud på 24-boliger-projekt — VVS underleverandør",
                start_time=today + timedelta(days=2, hours=9),
                end_time=today + timedelta(days=2, hours=10),
                event_type="manual"),
            CalendarEvent(id=uuid.uuid4(), user_id=user.id, account_id=account.id,
                title="🤝 Møde: Jacob Thorsen El",
                description="Kombiprojekt — fælles tilbud på badeværelse (el + VVS)",
                start_time=today + timedelta(days=3, hours=10),
                end_time=today + timedelta(days=3, hours=11),
                event_type="manual"),
            CalendarEvent(id=uuid.uuid4(), user_id=user.id, account_id=account.id,
                title="📦 Materialelevering — lager",
                description="Modtag bestilte kobberfittings og varmtvandsbeholdere",
                start_time=today + timedelta(days=4, hours=7),
                end_time=today + timedelta(days=4, hours=8),
                event_type="manual"),
            CalendarEvent(id=uuid.uuid4(), user_id=user.id, account_id=account.id,
                title="🔧 Service: Boligstyring ApS",
                description="Kvartervis service på 12 lejligheder — Vesterbrogade",
                start_time=today + timedelta(days=7, hours=8),
                end_time=today + timedelta(days=7, hours=16),
                event_type="manual"),
        ]
        for ev in cal_events:
            db.add(ev)
        print(f"Kalender: {len(cal_events)} events")

        # ─────────────────────────────────────────────
        # GEM ALT
        # ─────────────────────────────────────────────
        await db.commit()
        print("\n✅ Seed færdig!")
        print(f"   Login: test@mailbot.dk / test1234")
        print(f"   URL:   http://localhost")


if __name__ == "__main__":
    asyncio.run(seed())
