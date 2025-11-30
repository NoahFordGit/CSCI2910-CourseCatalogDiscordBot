from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session 

from models import Degree, DegreeCourse, Course
from schemas import DegreeModel, DegreeCourseModel, CourseModel
from .database import get_db

router = APIRouter()

# Get all degrees
@router.get("/degrees/", response_model=list[DegreeModel])
def get_degrees(db: Session = Depends(get_db)):
    degrees = db.query(Degree).all()
    return degrees

# Can search through degrees to find the desired degree matching the search with either
# the type, title, department, level, concentration
@router.get("/degrees/search", response_model=list[DegreeModel])
def get_degrees_search(
    type: str | None = None,
    title: str | None = None,
    department: str | None = None,
    level: str | None = None,
    concentration: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Degree)

    if type:
        query = query.filter(Degree.type.ilike(f"%{type}%"))
    
    if title:
        query = query.filter(Degree.title.ilike(f"%{title}%"))

    if department:
        query = query.filter(Degree.department.ilike(f"%{department}%"))

    if level:
        query = query.filter(Degree.level.ilike(f"%{level}%"))

    if concentration:
        query = query.filter(Degree.concentration.ilike(f"%{concentration}%"))
        
    return query.all()

# gets degree by degree ID
@router.get("/degrees/{degreeId}", response_model=DegreeModel)
def get_degree(degreeId:int, db: Session = Depends(get_db)):
    degree = db.get(Degree, degreeId)

    if degree is None:
        raise HTTPException(status_code=404, detail="Degree not found")
    
    return degree

# Gets all courses in a degree by a degree ID
@router.get("/degrees/{degreeId}/courses", response_model=list[CourseModel])
def get_courses(degreeId: int, db: Session = Depends(get_db)):
    degree_courses = db.query(DegreeCourse).filter(DegreeCourse.degree_id == degreeId).all()
    course_ids = [c.course_id for c in degree_courses]

    courses = db.query(Course).filter(DegreeCourse.course_id.in_(course_ids)).all()
    return courses

# Gets all degrees that contain a course specified by course ID
@router.get("/courses/{courseId}/degrees", response_model=list[DegreeModel])
def get_course_degree(courseId: str, db: Session = Depends(get_db)):
    degree_courses = db.query(DegreeCourse).filter(DegreeCourse.course_id == courseId).all()
    degree_ids = [d.degree_id for d in degree_courses]

    degrees = db.query(Degree).filter(Degree.degree_id.in_(degree_ids)).all()
    return degrees
