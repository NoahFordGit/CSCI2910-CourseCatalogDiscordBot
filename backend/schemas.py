'Schemas for all database tables to convert them to Json'
from pydantic import BaseModel

'The model for a course'
class CourseModel(BaseModel):
    course_id:str
    prefix:str
    course:int
    credits:int
    title:str
    description:str
    prereq_notes:str
    coreq_notes:str
    prereq_id:str
    coreq_id:str
    degree_id:int

    class Config:
        orm_mode=True

'The model for a course requisite'
class CourseReqModel(BaseModel):
    course_id:str
    prereq_id:str
    coreq_id:str

    class Config:
        orm_mode=True

'The model for a degree'
class DegreeModel(BaseModel):
    degree_id:int
    title:str
    level:str
    type:str
    concentration:str
    department:str
    description:str
    course_id:str

    class Config:
        orm_mode=True

'The model for a degree course'
class DegreeCourseModel(BaseModel):
    degree_id:int
    course_id:str

    class Config:
        orm_mode=True
