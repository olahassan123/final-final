from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from db import Base

class Treatment(Base):
    __tablename__ = "treatments"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    class_name = Column(String, nullable=True)     # e.g. "טיפולי קוסמטיקה"
    category = Column(String, nullable=True)       # e.g. "טיפולי פנים קלאסיים"
    keywords = Column(Text, nullable=True)

    suitable_for_all_skins = Column(Text, nullable=True)
    ages = Column(Text, nullable=True)
    results_timing = Column(Text, nullable=True)
    complementary_products = Column(Text, nullable=True)
    aftercare = Column(Text, nullable=True)
    consultation_required = Column(Text, nullable=True)
    recommended_frequency = Column(Text, nullable=True)
    pregnancy_breastfeeding = Column(Text, nullable=True)
    medical_limitations = Column(Text, nullable=True)

    faqs = relationship("FAQ", back_populates="treatment", cascade="all, delete-orphan")

class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    treatment_id = Column(String, ForeignKey("treatments.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)

    treatment = relationship("Treatment", back_populates="faqs")
