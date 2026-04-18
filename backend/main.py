from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers import hcp_router, interaction_router, ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="HCPulse AI - HCP Module",
    description="AI-First CRM system for Healthcare Professional interactions",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hcp_router, prefix="/api")
app.include_router(interaction_router, prefix="/api")
app.include_router(ai_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "hcpulse-ai-backend"}


@app.get("/api/seed")
async def seed_data():
    """Seed realistic admin/rep data with HCPs, interactions, and activity logs."""
    from database import async_session
    from models.database_models import HCP, User, UserRole, Interaction, InteractionType, Sentiment, ActivityLog
    import uuid
    from datetime import date, datetime, timedelta

    async with async_session() as session:
        from sqlalchemy import select, func
        count = await session.execute(select(func.count()).select_from(HCP))
        if count.scalar() > 0:
            return {"message": "Data already seeded"}

        # ── Users ──
        admin = User(
            id=uuid.uuid4(), email="admin@hcpulse.ai", name="Uzair Ahmed",
            role=UserRole.ADMIN,
        )
        rep = User(
            id=uuid.uuid4(), email="rep@hcpulse.ai", name="John Smith",
            role=UserRole.REP,
        )
        manager = User(
            id=uuid.uuid4(), email="manager@hcpulse.ai", name="Lisa Park",
            role=UserRole.MANAGER,
        )
        session.add_all([admin, rep, manager])

        # ── HCPs (10 realistic healthcare professionals) ──
        hcps_data = [
            dict(first_name="Sarah", last_name="Johnson", specialty="Cardiology",
                 organization="Metro Heart Center", email="s.johnson@metroheart.com",
                 phone="(212) 555-0101", city="New York", state="NY", npi_number="1234567890"),
            dict(first_name="Michael", last_name="Chen", specialty="Oncology",
                 organization="Pacific Cancer Institute", email="m.chen@pacificcancer.org",
                 phone="(415) 555-0102", city="San Francisco", state="CA", npi_number="2345678901"),
            dict(first_name="Emily", last_name="Rodriguez", specialty="Neurology",
                 organization="Braincare Medical Group", email="e.rodriguez@braincare.com",
                 phone="(312) 555-0103", city="Chicago", state="IL", npi_number="3456789012"),
            dict(first_name="James", last_name="Williams", specialty="Endocrinology",
                 organization="Diabetes & Metabolic Care Center", email="j.williams@diabetescare.com",
                 phone="(713) 555-0104", city="Houston", state="TX", npi_number="4567890123"),
            dict(first_name="Priya", last_name="Patel", specialty="Rheumatology",
                 organization="Joint Health Clinic", email="p.patel@jointhealth.com",
                 phone="(617) 555-0105", city="Boston", state="MA", npi_number="5678901234"),
            dict(first_name="David", last_name="Kim", specialty="Pulmonology",
                 organization="Valley Lung & Sleep Center", email="d.kim@valleylung.com",
                 phone="(602) 555-0106", city="Phoenix", state="AZ", npi_number="6789012345"),
            dict(first_name="Rachel", last_name="Thompson", specialty="Dermatology",
                 organization="ClearSkin Dermatology Associates", email="r.thompson@clearskin.com",
                 phone="(305) 555-0107", city="Miami", state="FL", npi_number="7890123456"),
            dict(first_name="Ahmed", last_name="Hassan", specialty="Gastroenterology",
                 organization="Digestive Health Partners", email="a.hassan@digestivehealth.com",
                 phone="(214) 555-0108", city="Dallas", state="TX", npi_number="8901234567"),
            dict(first_name="Olivia", last_name="Martinez", specialty="Pediatrics",
                 organization="Children's Wellness Group", email="o.martinez@childrenswellness.com",
                 phone="(303) 555-0109", city="Denver", state="CO", npi_number="9012345678"),
            dict(first_name="Robert", last_name="Anderson", specialty="Orthopedics",
                 organization="SportsMed Orthopedic Institute", email="r.anderson@sportsmed.com",
                 phone="(206) 555-0110", city="Seattle", state="WA", npi_number="0123456789"),
        ]
        hcps = [HCP(**d) for d in hcps_data]
        session.add_all(hcps)
        await session.flush()  # populate HCP ids

        today = date.today()

        # ── Interactions (realistic pharma rep logs) ──
        interactions_data = [
            dict(user_id=rep.id, hcp_id=hcps[0].id, interaction_type=InteractionType.IN_PERSON,
                 date=today - timedelta(days=2),
                 notes="Met with Dr. Johnson at Metro Heart Center to present new clinical data on CardioMax. She was very interested in the Phase III trial results showing 23% reduction in adverse cardiac events. Discussed potential for her high-risk hypertension patients.",
                 summary="Presented CardioMax Phase III data; strong interest from Dr. Johnson for hypertension patients",
                 products_discussed=["CardioMax", "CardioMax XR"],
                 key_topics=["Phase III trial results", "Hypertension management", "Adverse cardiac events"],
                 sentiment=Sentiment.POSITIVE,
                 follow_up_actions=["Send Phase III full study PDF", "Schedule lunch-and-learn for cardiology team"],
                 follow_up_date=today + timedelta(days=5)),
            dict(user_id=rep.id, hcp_id=hcps[1].id, interaction_type=InteractionType.VIDEO,
                 date=today - timedelta(days=5),
                 notes="Virtual meeting with Dr. Chen about OncoShield immunotherapy updates. He raised concerns about the pricing model for community oncology practices. Discussed patient assistance programs and updated formulary positioning.",
                 summary="Discussed OncoShield pricing concerns; shared patient assistance program details",
                 products_discussed=["OncoShield", "OncoShield Plus"],
                 key_topics=["Immunotherapy", "Pricing model", "Patient assistance", "Formulary"],
                 sentiment=Sentiment.NEUTRAL,
                 follow_up_actions=["Email updated pricing tier sheet", "Connect with reimbursement specialist"],
                 follow_up_date=today + timedelta(days=3)),
            dict(user_id=rep.id, hcp_id=hcps[2].id, interaction_type=InteractionType.PHONE,
                 date=today - timedelta(days=8),
                 notes="Called Dr. Rodriguez regarding her experience prescribing NeuroCalm for migraine patients. She reported good outcomes in 7 out of 10 patients but noted two cases of mild drowsiness. Requested samples for additional patients.",
                 summary="Positive feedback on NeuroCalm; mild drowsiness in 2/10 patients; requested additional samples",
                 products_discussed=["NeuroCalm"],
                 key_topics=["Migraine treatment", "Side effects", "Patient outcomes", "Sample request"],
                 sentiment=Sentiment.POSITIVE,
                 follow_up_actions=["Ship NeuroCalm sample pack", "Report adverse event data to medical affairs"],
                 follow_up_date=today + timedelta(days=1)),
            dict(user_id=rep.id, hcp_id=hcps[3].id, interaction_type=InteractionType.IN_PERSON,
                 date=today - timedelta(days=12),
                 notes="Visited Dr. Williams at his diabetes clinic. Presented GlucoSteady for Type 2 diabetes management. He was skeptical about switching patients from their current regimen and wants to see head-to-head comparison data before considering it.",
                 summary="GlucoSteady presentation; Dr. Williams wants head-to-head comparison data before adoption",
                 products_discussed=["GlucoSteady"],
                 key_topics=["Type 2 diabetes", "Treatment switching", "Head-to-head data"],
                 sentiment=Sentiment.NEGATIVE,
                 follow_up_actions=["Obtain head-to-head comparison study", "Schedule follow-up in 2 weeks"],
                 follow_up_date=today + timedelta(days=14)),
            dict(user_id=rep.id, hcp_id=hcps[4].id, interaction_type=InteractionType.EMAIL,
                 date=today - timedelta(days=3),
                 notes="Emailed Dr. Patel the updated prescribing information for FlexiJoint along with the recent EULAR conference poster data. She responded positively and is considering it for her refractory RA patients who failed methotrexate.",
                 summary="Shared FlexiJoint EULAR data; considering for refractory RA patients",
                 products_discussed=["FlexiJoint"],
                 key_topics=["Rheumatoid arthritis", "EULAR conference", "Refractory patients", "Methotrexate failure"],
                 sentiment=Sentiment.POSITIVE,
                 follow_up_actions=["Schedule in-person visit", "Bring patient starter kits"],
                 follow_up_date=today + timedelta(days=7)),
            dict(user_id=rep.id, hcp_id=hcps[5].id, interaction_type=InteractionType.IN_PERSON,
                 date=today - timedelta(days=1),
                 notes="Lunch meeting with Dr. Kim to discuss BreatheEasy inhaler for severe asthma and COPD. He was impressed by the device design and ease of use. Plans to trial it with 5 COPD patients next month. Also briefly discussed AirClear nasal spray.",
                 summary="BreatheEasy inhaler demo; Dr. Kim will trial with 5 COPD patients; discussed AirClear",
                 products_discussed=["BreatheEasy", "AirClear"],
                 key_topics=["COPD", "Severe asthma", "Device design", "Patient trial"],
                 sentiment=Sentiment.POSITIVE,
                 follow_up_actions=["Send BreatheEasy starter kits (5)", "Follow up after patient trial"],
                 follow_up_date=today + timedelta(days=30)),
            dict(user_id=admin.id, hcp_id=hcps[6].id, interaction_type=InteractionType.VIDEO,
                 date=today - timedelta(days=4),
                 notes="Conducted a KOL advisory board with Dr. Thompson on DermaClear topical treatment for psoriasis. She provided valuable feedback on the formulation and suggested a pump dispenser for better patient compliance. Agreed to participate in our upcoming webinar.",
                 summary="KOL advisory board; formulation feedback; agreed to webinar participation",
                 products_discussed=["DermaClear"],
                 key_topics=["Psoriasis", "Formulation feedback", "Patient compliance", "KOL engagement"],
                 sentiment=Sentiment.POSITIVE,
                 follow_up_actions=["Send honorarium paperwork", "Confirm webinar date", "Share formulation feedback with R&D"],
                 follow_up_date=today + timedelta(days=10)),
            dict(user_id=rep.id, hcp_id=hcps[7].id, interaction_type=InteractionType.PHONE,
                 date=today - timedelta(days=6),
                 notes="Called Dr. Hassan to follow up on GutBalance probiotic prescription data. He mentioned a competitor product is offering better rebates. Needs competitive pricing to continue prescribing. Escalating to regional manager.",
                 summary="GutBalance facing competitive pricing pressure; needs rebate match to retain prescriber",
                 products_discussed=["GutBalance"],
                 key_topics=["Competitive pricing", "Rebates", "Prescriber retention"],
                 sentiment=Sentiment.NEGATIVE,
                 follow_up_actions=["Escalate pricing request to regional manager", "Prepare competitive analysis"],
                 follow_up_date=today + timedelta(days=2)),
        ]
        interactions = [Interaction(**d) for d in interactions_data]
        session.add_all(interactions)
        await session.flush()

        # ── Activity Logs ──
        for ix in interactions:
            session.add(ActivityLog(
                user_id=ix.user_id, action="created",
                entity_type="interaction", entity_id=ix.id,
                details={"summary": ix.summary},
            ))

        await session.commit()
        return {
            "message": "Realistic data seeded successfully",
            "users_created": 3,
            "hcps_created": len(hcps),
            "interactions_created": len(interactions),
            "admin_user_id": str(admin.id),
            "rep_user_id": str(rep.id),
        }
