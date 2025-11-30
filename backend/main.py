from fastapi import FastAPI
from api.course_endpoints import router as course_router
from api.degree_endpoints import router as degree_router

app = FastAPI()

app.include_router(course_router)
app.include_router(degree_router)