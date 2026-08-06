"""SQLite 数据库连接管理"""
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "fitness.db")

os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models.workout import WorkoutRecord  # noqa: F401
    from app.models.photo import DailyPhoto  # noqa: F401
    from app.models.analysis import PhotoAnalysis  # noqa: F401
    from app.models.metric import BodyMetric  # noqa: F401
    from app.models.goal import ImprovementGoal  # noqa: F401
    from app.models.note import Note  # noqa: F401
    Base.metadata.create_all(bind=engine)
