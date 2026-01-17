from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# נתיב לקובץ ה-SQLite שלך
DATABASE_URL = "sqlite:///./meday.db"

# יצירת ה-Engine - check_same_thread נחוץ ב-SQLite כדי לאפשר עבודה עם FastAPI
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# יצירת מחלקה לייצור Sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# מחלקת הבסיס למודלים
Base = declarative_base()

# פונקציית Dependency עבור ה-FastAPI
# היא דואגת לפתוח חיבור ולסגור אותו בסיום הפעולה
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()