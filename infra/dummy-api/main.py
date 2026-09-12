import logging
import os
import psycopg2
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dummy-api")

app = FastAPI(title="Sentinel Dummy Production API")

DB_HOST = os.getenv("DB_HOST", "sentinel-db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "sentinel")


@app.get("/")
def root():
    return {"message": "Sentinel Dummy Production API"}


@app.get("/health")
def health_check():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME,
            connect_timeout=2,
        )
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()
        conn.close()
        return {"status": "healthy"}
    except Exception as exc:
        logger.error(f"Health check database connection error: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": "Database connection failed"},
        )
