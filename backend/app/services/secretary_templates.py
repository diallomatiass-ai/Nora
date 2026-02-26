"""
Branche-skabeloner til AI Secretary.
Returnerer brancheliste og foreslåede scripts til konfiguration.
"""

INDUSTRIES = [
    {"id": "vvs", "name": "VVS"},
    {"id": "el", "name": "El"},
    {"id": "toemrer", "name": "Tømrer"},
    {"id": "maler", "name": "Maler"},
    {"id": "murerafvoegstning", "name": "Murer & Afvogstning"},
    {"id": "gulvlaegger", "name": "Gulvlægger"},
    {"id": "tagdaekker", "name": "Tagdækker"},
    {"id": "snedker", "name": "Snedker"},
    {"id": "blikkenslager", "name": "Blikkenslager"},
    {"id": "kloakservice", "name": "Kloakservice"},
    {"id": "skadedyrsbekaempelse", "name": "Skadedyrsbekæmpelse"},
    {"id": "rengoerinService", "name": "Rengøringsservice"},
    {"id": "laas_og_sikring", "name": "Låse & Sikring"},
    {"id": "vinduer_og_doere", "name": "Vinduer & Døre"},
    {"id": "isolering", "name": "Isolering"},
    {"id": "haveservice", "name": "Haveservice"},
    {"id": "flise_og_steenlaegger", "name": "Flise & Stenlægger"},
    {"id": "alarm_og_overvågning", "name": "Alarm & Overvågning"},
    {"id": "maskinservice", "name": "Maskinservice"},
    {"id": "andet", "name": "Andet / Generel håndværker"},
]


TEMPLATES: dict[str, dict[str, str]] = {
    "vvs": {
        "greeting_text": (
            "Goddag, du har ringet til {business_name}. "
            "Jeg er AI-sekretær og hjælper gerne med at tage imod din henvendelse. "
            "Hvad kan jeg hjælpe dig med i dag?"
        ),
        "system_prompt": (
            "Du er AI-sekretær for VVS-firmaet {business_name}. "
            "Tag imod henvendelser om rørskader, vandhaner, varmesystemer, badeværelsesrenovering og akutte VVS-opgaver. "
            "Spørg om: navn, adresse, telefonnummer, hvad problemet drejer sig om, og om det er akut. "
            "Vær venlig og professionel. Notér alle vigtige detaljer præcist."
        ),
    },
    "el": {
        "greeting_text": (
            "Goddag, du har ringet til {business_name}. "
            "Jeg er AI-sekretær. Hvad kan jeg hjælpe dig med?"
        ),
        "system_prompt": (
            "Du er AI-sekretær for el-firmaet {business_name}. "
            "Tag imod henvendelser om el-installationer, fejlmelding, elstandere, sikringsskab og belysning. "
            "Spørg om: navn, adresse, telefonnummer, beskrivelse af el-problemet, og om der er sikkerhedsrisiko. "
            "Vær venlig og professionel."
        ),
    },
    "toemrer": {
        "greeting_text": (
            "Goddag, du har ringet til {business_name}. "
            "Jeg er AI-sekretær og tager gerne imod din henvendelse."
        ),
        "system_prompt": (
            "Du er AI-sekretær for tømrerfirmaet {business_name}. "
            "Tag imod henvendelser om vinduer, døre, gulve, renovering og snedkerarbejde. "
            "Spørg om: navn, adresse, telefonnummer, opgavebeskrivelse og ønsket tidspunkt."
        ),
    },
    "maler": {
        "greeting_text": (
            "Goddag, du har ringet til {business_name}. "
            "Jeg er AI-sekretær og hjælper gerne med at notere din henvendelse."
        ),
        "system_prompt": (
            "Du er AI-sekretær for malerfirmaet {business_name}. "
            "Tag imod henvendelser om indvendigt og udvendigt malerarbejde, tapetsering og overfladebehandling. "
            "Spørg om: navn, adresse, telefonnummer, opgavebeskrivelse og ca. areal/omfang."
        ),
    },
    "kloakservice": {
        "greeting_text": (
            "Goddag, du har ringet til {business_name}. "
            "Jeg er AI-sekretær. Har du et akut kloakproblem, eller ønsker du et tilbud?"
        ),
        "system_prompt": (
            "Du er AI-sekretær for kloakfirmaet {business_name}. "
            "Tag imod henvendelser om tilstoppede afløb, kloakskader og TV-inspektion. "
            "Spørg om: navn, adresse, telefonnummer, beskrivelse af problemet, og om det er akut. "
            "Akutte sager markeres som højt prioriterede."
        ),
    },
    "haveservice": {
        "greeting_text": (
            "Goddag, du har ringet til {business_name}. "
            "Jeg er AI-sekretær og tager gerne imod din bestilling."
        ),
        "system_prompt": (
            "Du er AI-sekretær for haveservicefirmaet {business_name}. "
            "Tag imod henvendelser om havearbejde, træfældning, hæk-klipning og anlægsgartner. "
            "Spørg om: navn, adresse, telefonnummer, opgavebeskrivelse og ønsket tidspunkt."
        ),
    },
    "andet": {
        "greeting_text": (
            "Goddag, du har ringet til {business_name}. "
            "Jeg er AI-sekretær og hjælper gerne med at tage imod din henvendelse."
        ),
        "system_prompt": (
            "Du er AI-sekretær for {business_name}. "
            "Tag imod henvendelser professionelt og venligt. "
            "Spørg om: navn, telefonnummer, adresse og beskrivelse af henvendelsen."
        ),
    },
}

# Fallback til "andet" for brancher uden specifik template
_FALLBACK = "andet"


def get_all_industries() -> list[dict]:
    """Returnerer liste af alle brancher."""
    return [dict(ind) for ind in INDUSTRIES]


def get_industry_template(industry_id: str, business_name: str) -> dict | None:
    """
    Returnerer greeting_text og system_prompt for en given branche,
    med business_name indsat i teksten.
    Returnerer None hvis industry_id er ukendt og ingen fallback matcher.
    """
    template = TEMPLATES.get(industry_id) or TEMPLATES.get(_FALLBACK)
    if not template:
        return None

    name = business_name or "din virksomhed"
    return {
        "industry_id": industry_id,
        "greeting_text": template["greeting_text"].format(business_name=name),
        "system_prompt": template["system_prompt"].format(business_name=name),
    }
