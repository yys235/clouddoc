from app.core.db import SessionLocal, init_db
from app.services.bootstrap_service import seed_demo_data


init_db()
db = SessionLocal()
try:
    seed_demo_data(db)
finally:
    db.close()
