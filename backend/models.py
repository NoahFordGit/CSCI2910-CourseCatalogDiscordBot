from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# TABLE NAMES AND CLASS NAMES WILL LIKELY NEED TO CHANGED
# THESE ARE FROM BEFORE THE DATABASE IS FINISHED

class Course(Base):
    __tablename__ = "COURSE"
    id = Column(String(10), primary_key=True, nullable=False, unique=True)
    prefix = Column(String(4), nullable=False)
    course = Column(Integer, nullable=False)
    credits = Column(Integer, nullable=False)
    title = Column(String(250), nullable=False)
    description = Column(String(2000), nullable=False)
    prereq_notes = Column(String(2000), nullable=True)
    coreq_notes = Column(String(2000), nullable=True)
    prereq_id = Column(String(10), ForeignKey("COURSE.id"), nullable=True)
    coreq_id = Column(String(10), ForeignKey("COURSE.id"), nullable=True)

    prereq = relationship("CourseTable", remote_side=[id], foreign_keys=[prereq_id], backref="prerequisite_for")
    coreq = relationship("CourseTable", remote_side=[id], foreign_keys=[coreq_id], backref="corequisite_for")

    def __repr__(self):
        return f"<CourseTable(id={self.id!r}, prefix={self.prefix!r}, course={self.course!r})>"


class CoursePrerequisite(Base):
    __tablename__ = "COURSE_PREREQUISITES"
    course_pk = Column(String(10), ForeignKey("COURSE.id"), primary_key=True, nullable=False)
    prereq_id = Column(String(10), ForeignKey("COURSE.id"), primary_key=True, nullable=False)

    # relationships to CourseTable for convenience when working with the ORM
    course = relationship("CourseTable", foreign_keys=[course_pk], backref="prerequisite_links")
    prereq = relationship("CourseTable", foreign_keys=[prereq_id], backref="is_prerequisite_for_links")

    def __repr__(self):
        return f"<CoursePrerequisite(course_pk={self.course_pk!r}, prereq_id={self.prereq_id!r})>"


class Degree(Base):
    __tablename__ = "DEGREE"
    degree_id = Column(Integer, primary_key=True, nullable=False, unique=True)
    title = Column(String(200), nullable=False)
    level = Column(String(50), nullable=True)
    type = Column(String(50), nullable=True)
    concentration = Column(String(250), nullable=True)
    department = Column(String(100), nullable=False)
    description = Column(String(2000), nullable=False)
    # optional representative course for the degree (nullable)
    course_id = Column(String(10), ForeignKey("COURSE.id"), nullable=True)

    # relationship to DegreeCourse association objects
    degree_courses = relationship("DegreeCourse", back_populates="degree", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Degree(degree_id={self.degree_id!r}, title={self.title!r})>"


class DegreeCourse(Base):
    __tablename__ = "DEGREE_COURSE"
    degree_id = Column(Integer, ForeignKey("DEGREE.degree_id"), primary_key=True, nullable=False)
    course_id = Column(String(10), ForeignKey("COURSE.id"), primary_key=True, nullable=False)

    # relationships to Degree and Course for ORM convenience
    degree = relationship("Degree", foreign_keys=[degree_id], back_populates="degree_courses")
    course = relationship("Course", foreign_keys=[course_id], backref="degree_links")

    def __repr__(self):
        return f"<DegreeCourse(degree_id={self.degree_id!r}, course_id={self.course_id!r})>"