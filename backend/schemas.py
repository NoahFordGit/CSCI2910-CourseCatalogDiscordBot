from pydantic import BaseModel
from typing import Optional

class CourseModel(BaseModel):
    course_id:str
    prefix:str
    course:int
    credits:int
    title:str
    description: Optional[str] = None
    prereq_notes: Optional[str] = None
    coreq_notes: Optional[str] = None
    prereq_id: Optional[str] = None
    coreq_id: Optional[str] = None
    degree_id: Optional[int] = None

    class Config:
        from_attributes = True

class CourseReqModel(BaseModel):
    course_id:str
    prereq_id:Optional[str]
    coreq_id:Optional[str]

    class Config:
        from_attributes = True

class DegreeModel(BaseModel):
    degree_id:int
    title:str
    level:str
    type:str
    concentration:Optional[str]
    department:str
    description:Optional[str]
    course_id:Optional[str]

    class Config:
        from_attributes = True

class DegreeCourseModel(BaseModel):
    degree_id:int
    course_id:str

    class Config:
        from_attributes = True
