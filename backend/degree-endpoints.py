from fastapi import FastAPI, Depends, Query
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import Session 
from models import Base, Course, CourseRequisites, Degree, DegreeCourse
from schemas import CourseModel, CourseReqModel, DegreeModel, DegreeCourseModel

app = FastAPI()

engine = create_engine("sqlite:///./cbat_base.db")
Base.metadata.create_all(engine)

def get_db():
    db = Session(engine)
    try:
        yield db
    finally:
        db.close()


@app.get("/degrees/{degreeId}")
def get_degreeby_id(degreeId:int, db: Session = Depends(get_db)):
    degree = db.query(Degree).filter(Degree.degree_id.ilike(degreeId)).first()
    return degree

@app.get("/degrees/")
def get_degrees(department: str = None, level: str = None, type: str = None, db: Session = Depends(get_db)):
    # If 'name' was passed in, filter by it
    degrees = db.query(Degree).all()
    if department:
        degrees = db.query(Degree).filter(Degree.department.ilike(f"%{department}%")).all()
    if level:
        degrees = db.query(Degree).filter(Degree.level.ilike(f"%{level}%")).all()
    if type:
        degrees = db.query(Degree).filter(Degree.type.ilike(f"%{type}%")).all()
    return degrees