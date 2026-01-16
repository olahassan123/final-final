from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import pandas as pd
from fastapi import UploadFile, File, HTTPException
from io import BytesIO


from db import SessionLocal, engine, Base
from models import Treatment, FAQ

app = FastAPI(title="MeDay Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



Base.metadata.create_all(bind=engine)

def to_text(x):
    if x is None:
        return ""
    s = str(x).strip()
    return "" if s.lower() == "nan" else s

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/treatments")
def list_treatments():
    db: Session = SessionLocal()
    try:
        treatments = db.query(Treatment).all()
        out = []
        for t in treatments:
            out.append({
                "id": t.id,
                "name": t.name,
                "class_name": t.class_name,
                "category": t.category,
                "keywords": t.keywords,
                "suitable_for_all_skins": t.suitable_for_all_skins,
                "ages": t.ages,
                "results_timing": t.results_timing,
                "complementary_products": t.complementary_products,
                "aftercare": t.aftercare,
                "consultation_required": t.consultation_required,
                "recommended_frequency": t.recommended_frequency,
                "pregnancy_breastfeeding": t.pregnancy_breastfeeding,
                "medical_limitations": t.medical_limitations,
                "faq": {f.question: f.answer for f in t.faqs},
            })
        return out
    finally:
        db.close()

from fastapi import HTTPException

@app.get("/treatments/{treatment_id}")
def get_treatment(treatment_id: str):
    db: Session = SessionLocal()
    try:
        t = db.query(Treatment).filter(Treatment.id == treatment_id).first()
        if not t:
            raise HTTPException(status_code=404, detail="Treatment not found")

        return {
            "id": t.id,
            "name": t.name,
            "class_name": t.class_name,
            "category": t.category,
            "keywords": t.keywords,
            "suitable_for_all_skins": t.suitable_for_all_skins,
            "ages": t.ages,
            "results_timing": t.results_timing,
            "complementary_products": t.complementary_products,
            "aftercare": t.aftercare,
            "consultation_required": t.consultation_required,
            "recommended_frequency": t.recommended_frequency,
            "pregnancy_breastfeeding": t.pregnancy_breastfeeding,
            "medical_limitations": t.medical_limitations,
            "faq": {f.question: f.answer for f in t.faqs},
        }
    finally:
        db.close()


from pydantic import BaseModel
from typing import Optional, List, Dict

class ChatContext(BaseModel):
    goal: Optional[str] = None
    sensitive: Optional[bool] = None
    pregnant: Optional[bool] = None

class ChatRequest(BaseModel):
    message: str
    context: Optional[ChatContext] = None

class ChatResponse(BaseModel):
    reply: str
    follow_up: Optional[Dict] = None
    suggested_treatments: Optional[List[Dict]] = None

def _norm(s: str) -> str:
    return (s or "").strip().lower()

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    msg = _norm(req.message)
    ctx = req.context or ChatContext()

    db: Session = SessionLocal()
    try:
        treatments = db.query(Treatment).all()

        goal_keywords = {
            "hydration": ["hydration", "dry", "לחות", "יובש"],
            "glow": ["glow", "shine", "זוהר", "קורן"],
            "acne": ["acne", "pimple", "פצע", "אקנה"],
            "antiaging": ["anti", "aging", "wrinkle", "אנטי", "קמט", "מיצוק", "lifting"],
            "calm": ["calm", "sensitive", "red", "הרגעה", "רגיש", "אדמומיות"],
        }

        picked_goal = _norm(ctx.goal) if ctx.goal else ""
        if not picked_goal:
            for g, words in goal_keywords.items():
                if any(w.lower() in msg for w in words):
                    picked_goal = g
                    break

        def allowed(t: Treatment) -> bool:
            if ctx.pregnant:
                pb = _norm(t.pregnancy_breastfeeding or "")
                if "לא מומלץ" in pb:
                    return False
            return True

        scored = []
        for t in treatments:
            if not allowed(t):
                continue

            text = " ".join([
                t.name or "",
                t.category or "",
                t.keywords or "",
                t.results_timing or "",
                t.medical_limitations or "",
            ]).lower()

            score = 0
            if picked_goal:
                if any(w.lower() in text for w in goal_keywords.get(picked_goal, [])):
                    score += 4

            for token in msg.split():
                if token and token in text:
                    score += 1

            if score > 0:
                scored.append((score, t))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = [t for _, t in scored[:3]]

        if not top:
            return ChatResponse(
                reply="أهلاً! قوليلي شو هدفك؟ (لחות / זוהר / אקנה / anti-aging / تهدئة). وإذا بشرتك حساسة أو في حمل/رضاعة احكيلي كمان 🙂"
            )

        suggestions = [{"id": t.id, "name": t.name, "category": t.category} for t in top]

        follow = None
        if ctx.pregnant is None:
            follow = {"type": "yesno", "question": "هل في حمل/رضاعة؟ (Yes/No)"}
        elif ctx.sensitive is None:
            follow = {"type": "yesno", "question": "هل بشرتك حساسة؟ (Yes/No)"}

        return ChatResponse(
            reply="تمام! هاي علاجات قريبة للي طلبتي:\n- " + "\n- ".join([f"{t.name} ({t.category or '—'})" for t in top]),
            follow_up=follow,
            suggested_treatments=suggestions
        )
    finally:
        db.close()


@app.post("/admin/import-excel")
async def import_excel(file: UploadFile = File(...)):
    # 1) validate extension
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload an Excel file (.xlsx/.xls)")

    # 2) read bytes and load dataframe
    content = await file.read()
    try:
        df = pd.read_excel(BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel: {e}")

    db: Session = SessionLocal()
    try:
        db.query(FAQ).delete()
        db.query(Treatment).delete()
        db.commit()

        base_cols = [
            "סוג הטיפול",
            "מילות מפתח",
            "מתאים לכל סוגי העור?",
            "לאילו גילאים?",
            "מתי רואים תוצאות?",
            "מוצרים משלימים?",
            "הנחיות לאחר טיפול",
            "האם נדרש ייעוץ?",
            "תדירות מומלצת",
            "היריון/הנקה",
            "הגבלות רפואיות",
        ]

        CLASS_NAME = "טיפולי קוסמטיקה"

        for i in range(len(df)):
            name = to_text(df.loc[i, "סוג הטיפול"]) if "סוג הטיפול" in df.columns else ""
            if not name:
                continue

            t = Treatment(
                id=f"excel_{i}",
                name=name,
                class_name=CLASS_NAME,
                category="",
                keywords=to_text(df.loc[i, "מילות מפתח"]) if "מילות מפתח" in df.columns else "",
                suitable_for_all_skins=to_text(df.loc[i, "מתאים לכל סוגי העור?"]) if "מתאים לכל סוגי העור?" in df.columns else "",
                ages=to_text(df.loc[i, "לאילו גילאים?"]) if "לאילו גילאים?" in df.columns else "",
                results_timing=to_text(df.loc[i, "מתי רואים תוצאות?"]) if "מתי רואים תוצאות?" in df.columns else "",
                complementary_products=to_text(df.loc[i, "מוצרים משלימים?"]) if "מוצרים משלימים?" in df.columns else "",
                aftercare=to_text(df.loc[i, "הנחיות לאחר טיפול"]) if "הנחיות לאחר טיפול" in df.columns else "",
                consultation_required=to_text(df.loc[i, "האם נדרש ייעוץ?"]) if "האם נדרש ייעוץ?" in df.columns else "",
                recommended_frequency=to_text(df.loc[i, "תדירות מומלצת"]) if "תדירות מומלצת" in df.columns else "",
                pregnancy_breastfeeding=to_text(df.loc[i, "היריון/הנקה"]) if "היריון/הנקה" in df.columns else "",
                medical_limitations=to_text(df.loc[i, "הגבלות רפואיות"]) if "הגבלות רפואיות" in df.columns else "",
            )

            if "קטגוריה" in df.columns:
                t.category = to_text(df.loc[i, "קטגוריה"])
            elif "Category" in df.columns:
                t.category = to_text(df.loc[i, "Category"])

            db.add(t)
            db.flush()

            for c in df.columns:
                if c in base_cols or c in ["קטגוריה", "Category"]:
                    continue
                q = to_text(c)
                a = to_text(df.loc[i, c])
                if a:
                    db.add(FAQ(treatment_id=t.id, question=q, answer=a))

        db.commit()
        return {"rows_in_excel": len(df), "status": "imported"}
    finally:
        db.close()
