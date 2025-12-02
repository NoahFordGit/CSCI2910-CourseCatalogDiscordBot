from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# TABLE NAMES AND CLASS NAMES WILL LIKELY NEED TO CHANGED
# THESE ARE FROM BEFORE THE DATABASE IS FINISHED

class Course(Base):
    __tablename__ = "course"
    course_id = Column(String(50), primary_key=True, nullable=False, unique=True)
    prefix = Column(String(50), nullable=False)
    course = Column(Integer, nullable=True)
    credits = Column(Integer, nullable=True)
    title = Column(String(250), nullable=True)
    description = Column(String(2000), nullable=True)
    prereq_notes = Column(String(2000), nullable=True)
    coreq_notes = Column(String(2000), nullable=True)
    prereq_id = Column(String(50), ForeignKey("course.course_id"), nullable=True)
    coreq_id = Column(String(50), ForeignKey("course.course_id"), nullable=True)
    degree_id = Column(Integer, ForeignKey("degree.degree_id"), nullable=True)

    # Self-referential relationships (single-FK style)
    prereq = relationship("Course", remote_side=[course_id], foreign_keys=[prereq_id], backref="prerequisite_for")
    coreq = relationship("Course", remote_side=[course_id], foreign_keys=[coreq_id], backref="corequisite_for")

    def __repr__(self):
        return f"<Course(course_id={self.course_id!r}, prefix={self.prefix!r}, course={self.course!r})>"


class CourseRequisites(Base):
    __tablename__ = "course_requisites"

    course_id = Column(String(50), ForeignKey("course.course_id"), primary_key=True)
    prereq_id = Column(String(50), ForeignKey("course.course_id"), primary_key=True, nullable=True)
    coreq_id = Column(String(50), ForeignKey("course.course_id"), primary_key=True, nullable=True)

    # relationships to Course for convenience
    course = relationship("Course", foreign_keys=[course_id], backref="requisites")
    prereq = relationship("Course", foreign_keys=[prereq_id], backref="is_prerequisite_for")
    coreq = relationship("Course", foreign_keys=[coreq_id], backref="is_corequisite_for")

    def __repr__(self):
        return f"<CourseRequisites(course_id={self.course_id!r}, prereq_id={self.prereq_id!r}, coreq_id={self.coreq_id!r})>"


class Degree(Base):
    __tablename__ = "degree"
    degree_id = Column(Integer, primary_key=True, nullable=False, unique=True)
    title = Column(String(200), nullable=False)
    level = Column(String(50), nullable=False)
    type = Column(String(50), nullable=False)
    concentration = Column(String(250), nullable=True)
    department = Column(String(100), nullable=False)
    description = Column(String(2000), nullable=False)

    # optional representative course for the degree (nullable)
    course_id = Column(String(50), ForeignKey("course.course_id"), nullable=True)

    # relationship to DegreeCourse association objects
    degree_courses = relationship("DegreeCourse", back_populates="degree", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Degree(degree_id={self.degree_id!r}, title={self.title!r})>"


class DegreeCourse(Base):
    __tablename__ = "degree_course"
    degree_id = Column(Integer, ForeignKey("degree.degree_id"), primary_key=True, nullable=False)
    course_id = Column(String(50), ForeignKey("course.course_id"), primary_key=True, nullable=False)

    # relationships to Degree and Course for ORM convenience
    degree = relationship("Degree", foreign_keys=[degree_id], back_populates="degree_courses")
    course = relationship("Course", foreign_keys=[course_id], backref="degree_links")

    def __repr__(self):
        return f"<DegreeCourse(degree_id={self.degree_id!r}, course_id={self.course_id!r})>"