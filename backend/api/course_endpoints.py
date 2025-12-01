from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session 

from models import Course, CourseRequisites
from schemas import CourseModel, CourseReqModel
from .database import get_db

router = APIRouter()

# get all courses
@router.get("/courses/", response_model=list[CourseModel])
def get_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).all()
    return courses

# Can search through courses to find the desired course matching the search with either
# the title, prefix, credits, or degree_id
@router.get("/courses/search", response_model=list[CourseModel])
def get_courses_search(
    id: str | None = None,
    title: str | None = None,
    prefix: str | None = None,
    credits: int | None = None,
    degree_id: int | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Course)

    if id:
        query = query.filter(Course.course_id.ilike(f"%{id}%"))

    if title:
        query = query.filter(Course.title.ilike(f"%{title}%"))
    
    if prefix:
        query = query.filter(Course.prefix.ilike(f"%{prefix}%"))

    if credits is not None:
        query = query.filter(Course.credits == credits)

    if degree_id is not None:
        query = query.filter(Course.degree_id == degree_id)

    return query.all()

# get specific course by course_id
@router.get("/courses/{course_id}", response_model=CourseModel)
def get_course(course_id: str, db: Session = Depends(get_db)):
    course = db.get(Course, course_id)

    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return course

# get course-id's prereqs and coreqs ids
@router.get("/courses/{course_id}/requisites", response_model=list[CourseReqModel])
def get_requisites(course_id: str, db: Session = Depends(get_db)):
    requisites = (
    db.query(CourseRequisites)
      .filter(CourseRequisites.course_id == course_id)
      .all()
    )
    return requisites

# get prereq courses for course_id
@router.get("/courses/{course_id}/prerequisites", response_model=list[str])
def get_prerequisites(course_id: str, db: Session = Depends(get_db)):
    reqs = (
        db.query(CourseRequisites)
        .filter(CourseRequisites.course_id == course_id)
        .all()
    )

    # filter for only not None prereqs
    prereqs = [r.prereq_id for r in reqs if r.prereq_id is not None]

    return prereqs

# get coreq courses for course_id
@router.get("/courses/{course_id}/corequisites", response_model=list[str])
def get_coreqs(course_id: str, db: Session = Depends(get_db)):
    reqs = (
        db.query(CourseRequisites)
        .filter(CourseRequisites.course_id == course_id)
        .all()
    )

    # filter for only not None prereqs
    coreqs = [r.coreq_id for r in reqs if r.coreq_id is not None]

    return coreqs
