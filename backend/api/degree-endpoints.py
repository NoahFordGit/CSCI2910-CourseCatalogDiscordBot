import os
import sys
from fastapi import FastAPI, Depends, Query
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import Session 

# This is all to be able to import from files of a parent dir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
sys.path.append(PARENT_DIR)

from models import Base, Course, CourseRequisites, Degree, DegreeCourse
from schemas import CourseModel, CourseReqModel, DegreeModel, DegreeCourseModel


app = FastAPI()

# Done to access the database that is 2 parent dirs away
# Directory where *this file* lives
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Go 2 parent dirs up
PARENT2 = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
# Database file inside that directory
DB_PATH = os.path.join(PARENT2, "cbat_base.db")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
Base.metadata.create_all(engine)

def get_db():
    db = Session(engine)
    try:
        yield db
    finally:
        db.close()

# Get all degrees and any specified departments, levels, or types
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

# Can search through degreed to find the desired degree matching the search with either
# the type, title, department, or level
@app.get("/degrees/search")
def get_degrees(search: str, db: Session = Depends(get_db)):
    search_fields = [
        Degree.type,
        Degree.title,
        Degree.department,
        Degree.level,
    ]

    for field in search_fields:
        result = db.query(Degree).filter(field.ilike(f"%{search}%")).all()
        if result:
            return result
    return None

# gets degrees by thier IDs 
@app.get("/degrees/{degreeId}")
def get_degreeby_id(degreeId:int, db: Session = Depends(get_db)):
    degree = db.query(Degree).filter(Degree.degree_id.ilike(degreeId)).first()
    return degree

# Gets all courses in a degree by a degree ID
@app.get("/degrees/{degreeId}/courses")
def get_coursesby_degree(degreeId: int, db: Session = Depends(get_db)):
    courses = db.query(DegreeCourse).filter(DegreeCourse.degree_id == degreeId).all()
    return courses

# Gets all degrees that contain a course specified by course ID
@app.get("/courses/{courseId}/degrees")
def get_degreeby_courses(courseId: str, db: Session = Depends(get_db)):
    details = []
    degree_course = db.query(DegreeCourse).filter(DegreeCourse.course_id == courseId).all()
    for degree in degree_course:
        details.append(degree.degree_id)
    degrees = []
    for detail in details:
        degrees.append(db.query(Degree).filter(Degree.degree_id.ilike(detail)).first())
    return degrees

