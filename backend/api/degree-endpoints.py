from fastapi import FastAPI, Depends, Query
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import Session 
from models import Base, Course, CourseRequisites, Degree, DegreeCourse
from schemas import Course, CourseReq, Degree, DegreeCourse

app = FastAPI()

engine = create_engine("sqlite:///./cbat_base.db")
Base.metadata.create_all(engine)

def get_db():
    db = Session(engine)
    try:
        yield db
    finally:
        db.close()


@app.get("/degrees/")
def get_degrees(department: str = None, level: str = None, type: str = None, db: Session = Depends(get_db)):
    # If 'name' was passed in, filter by it
    if department:
        users = db.query(Degree).filter(Degree.department.ilike(f"%{department}%")).all()
    elif level:
        users = db.query(Degree).filter(Degree.level.ilike(f"%{level}%")).all()
    elif level:
        users = db.query(Degree).filter(Degree.type.ilike(f"%{type}%")).all()
    else:
        users = db.query(Degree).all()
    return users