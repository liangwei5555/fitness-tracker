"""仪表盘 API"""
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.workout import WorkoutRecord
from app.models.photo import DailyPhoto
from app.models.analysis import PhotoAnalysis
from app.models.goal import ImprovementGoal

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    """仪表盘摘要数据"""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    # 今日训练统计
    today_workouts = (
        db.query(WorkoutRecord)
        .filter(WorkoutRecord.date == today)
        .all()
    )
    today_total_sets = sum(w.sets for w in today_workouts)
    today_exercises = len(set(w.exercise_name for w in today_workouts))

    # 本周训练天数
    week_days = (
        db.query(func.count(func.distinct(WorkoutRecord.date)))
        .filter(WorkoutRecord.date >= week_start, WorkoutRecord.date <= today)
        .scalar()
    ) or 0

    # 本月训练组数
    month_sets = (
        db.query(func.sum(WorkoutRecord.sets))
        .filter(WorkoutRecord.date >= month_start, WorkoutRecord.date <= today)
        .scalar()
    ) or 0

    # 连续打卡天数
    streak = 0
    check_date = today
    while True:
        has_record = (
            db.query(WorkoutRecord)
            .filter(WorkoutRecord.date == check_date)
            .first()
        )
        if has_record:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # 最新体态评估
    latest_analysis = (
        db.query(PhotoAnalysis)
        .order_by(PhotoAnalysis.analyzed_at.desc())
        .first()
    )

    # 活跃目标数
    active_goals = (
        db.query(ImprovementGoal)
        .filter(ImprovementGoal.is_active == True)  # noqa: E712
        .count()
    )

    return {
        "today": {
            "sets": today_total_sets,
            "exercises": today_exercises,
            "records": len(today_workouts),
        },
        "week_days": week_days,
        "month_sets": month_sets,
        "streak": streak,
        "latest_analysis": latest_analysis,
        "active_goals": active_goals,
    }
