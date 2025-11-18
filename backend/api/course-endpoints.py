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

# get all courses, optionally by department (prefix), degree_id, or credit hours
@app.get("/courses/")
def get_courses(prefix: str = None, degree_id: int = None, credits: int = None, db: Session = Depends(get_db)):
    courses = db.query(Course).all()
    if prefix:
        courses = db.query(Course).filter(Course.prefix.ilike(f"%{prefix}%")).all()
    if degree_id:
        courses = db.query(Course).filter(Course.degree_id.ilike(f"%{degree_id}%")).all()
    if credits:
        courses = db.query(Course).filter(Course.credits.ilike(f"%{credits}%")).all()
    return courses

# get specific course
@app.get("/courses/{course_id}")
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.course_id.ilike(f"%{course_id}%")).first()
    return course

# get course-id's prereqs and coreqs ids
@app.get("/courses/{course_id}/requisites")
def get_requisites(course_id: int, db: Session = Depends(get_db)):
    requisites = db.query(CourseRequisites.course_id.ilike(f"%{course_id}%")).all()
    return requisites

# get prereq courses for course_id
@app.get("/courses/{course_id}/prerequisites")
def get_prerequisites(course_id: int, db: Session = Depends(get_db)):
    prereqs = db.query(Course).filter(Course.course_id.ilike(f"%{course_id}%")).first()
    return prereqs.prereq_id

# get coreq courses for course_id
@app.get("/courses/{course_id}/corequisites")
def get_coreqs(course_id: int, db: Session = Depends(get_db)):
    coreqs = db.query(Course).filter(Course.course_id.ilike(f"%{course_id}%")).first()
    return coreqs.coreq_id

#

