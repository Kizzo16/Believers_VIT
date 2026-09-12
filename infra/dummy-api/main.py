import logging
import os
import sqlite3
from typing import Optional
from fastapi import FastAPI, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dummy-api")

app = FastAPI(title="Sentinel Demo Production API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active State & Config
INITIAL_DB_CONFIG = {
    "host": os.getenv("DB_HOST", "sentinel-db"),
    "port": os.getenv("DB_PORT", "5432"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
    "dbname": os.getenv("DB_NAME", "sentinel"),
}

current_db_config = dict(INITIAL_DB_CONFIG)
app_state = "NORMAL"  # NORMAL, DATABASE_FAILURE, API_FAILURE, CONFIGURATION_FAILURE

# Fallback SQLite DB in memory for local demo without external DB
local_sqlite_conn = sqlite3.connect(":memory:", check_same_thread=False)
local_sqlite_conn.row_factory = sqlite3.Row

class ItemCreate(BaseModel):
    name: str
    status: Optional[str] = "HEALTHY"


def get_db_connection():
    if app_state == "CONFIGURATION_FAILURE":
        raise Exception("Database connection error: Invalid database host 'invalid-db-host:9999'")

    if app_state == "DATABASE_FAILURE":
        raise Exception("Database connection error: Connection refused to sentinel-db:5432")

    if PSYCOPG2_AVAILABLE:
        try:
            return psycopg2.connect(
                host=current_db_config["host"],
                port=current_db_config["port"],
                user=current_db_config["user"],
                password=current_db_config["password"],
                dbname=current_db_config["dbname"],
                connect_timeout=2,
            )
        except Exception as e:
            logger.info(f"PostgreSQL connection unavailable ({e}), using local demo database storage.")

    return local_sqlite_conn



def query_db(query_str: str, params: tuple = (), fetch_one_row: bool = False, is_insert: bool = False):
    conn = get_db_connection()
    is_psycopg = PSYCOPG2_AVAILABLE and isinstance(conn, psycopg2.extensions.connection)

    if is_psycopg:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query_str, params)
        if is_insert:
            row = cursor.fetchone()
            conn.commit()
            cursor.close()
            conn.close()
            return dict(row) if row else {}
        elif fetch_one_row:
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            return dict(row) if row else None
        else:
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            return [dict(r) for r in rows]
    else:
        # SQLite compatibility adjustments
        sqlite_query = query_str.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
        sqlite_query = sqlite_query.replace("%s", "?")
        if "RETURNING" in sqlite_query:
            sqlite_query = sqlite_query.split("RETURNING")[0].strip()

        cursor = conn.cursor()
        cursor.execute(sqlite_query, params)
        if is_insert:
            last_id = cursor.lastrowid
            conn.commit()
            cursor.execute("SELECT id, name, status, created_at FROM demo_items WHERE id = ?;", (last_id,))
            row = cursor.fetchone()
            return dict(row) if row else {"id": last_id, "name": params[0] if params else "", "status": "HEALTHY"}
        elif fetch_one_row:
            row = cursor.fetchone()
            return dict(row) if row else None
        else:
            rows = cursor.fetchall()
            return [dict(r) for r in rows]


def init_db():
    try:
        query_db(
            """
            CREATE TABLE IF NOT EXISTS demo_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """
        )
        count_res = query_db("SELECT COUNT(*) as cnt FROM demo_items;", fetch_one_row=True)
        count = list(count_res.values())[0] if count_res else 0
        if count == 0:
            query_db("INSERT INTO demo_items (name, status) VALUES ('Order Service Node 1', 'HEALTHY');")
            query_db("INSERT INTO demo_items (name, status) VALUES ('Payment Gateway Connector', 'HEALTHY');")
            query_db("INSERT INTO demo_items (name, status) VALUES ('User Identity Vault', 'HEALTHY');")
        logger.info("Demo database initialized successfully.")
    except Exception as exc:
        logger.warning(f"Database initialization deferred/failed: {exc}")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {
        "service": "Sentinel Demo Production API",
        "state": app_state,
        "database_host": current_db_config["host"],
    }


@app.get("/api/state")
def get_state():
    return {
        "state": app_state,
        "db_config": {
            "host": current_db_config["host"],
            "port": current_db_config["port"],
            "dbname": current_db_config["dbname"],
        },
    }


@app.get("/health")
def health_check():
    if app_state == "API_FAILURE":
        logger.error("Health check failed due to active API_FAILURE state")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": "API Failure Mode Active", "state": app_state},
        )

    try:
        query_db("SELECT 1;", fetch_one_row=True)
        return {"status": "healthy", "state": app_state, "database": "connected"}
    except Exception as exc:
        logger.error(f"Health check database error: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": "Database connection failed",
                "detail": str(exc),
                "state": app_state,
            },
        )


@app.get("/api/items")
def list_items():
    if app_state == "API_FAILURE":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API Failure Mode Active: Internal server error simulated",
        )

    try:
        items = query_db("SELECT id, name, status, created_at FROM demo_items ORDER BY id DESC;")
        return {"items": items, "state": app_state}
    except Exception as exc:
        logger.error(f"Error fetching demo items: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failure: {str(exc)}",
        )


@app.post("/api/items")
def create_item(item: ItemCreate):
    if app_state == "API_FAILURE":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API Failure Mode Active: Internal server error simulated",
        )

    try:
        new_item = query_db(
            "INSERT INTO demo_items (name, status) VALUES (%s, %s) RETURNING id, name, status, created_at;",
            (item.name, item.status),
            is_insert=True,
        )
        return {"status": "created", "item": new_item}
    except Exception as exc:
        logger.error(f"Error creating item: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database insert failure: {str(exc)}",
        )



# Chaos Simulation Endpoints
@app.post("/chaos/db-failure")
def trigger_db_failure():
    global app_state
    app_state = "DATABASE_FAILURE"
    logger.info("Chaos simulation: DATABASE_FAILURE activated")
    return {"status": "DATABASE_FAILURE_ACTIVATED", "state": app_state}


@app.post("/chaos/api-failure")
def trigger_api_failure():
    global app_state
    app_state = "API_FAILURE"
    logger.info("Chaos simulation: API_FAILURE activated")
    return {"status": "API_FAILURE_ACTIVATED", "state": app_state}


@app.post("/chaos/config-failure")
def trigger_config_failure():
    global app_state, current_db_config
    app_state = "CONFIGURATION_FAILURE"
    current_db_config["host"] = "invalid-db-host"
    current_db_config["port"] = "9999"
    logger.info("Chaos simulation: CONFIGURATION_FAILURE activated")
    return {
        "status": "CONFIGURATION_FAILURE_ACTIVATED",
        "state": app_state,
        "corrupted_config": current_db_config,
    }


@app.post("/chaos/reset")
def reset_environment():
    global app_state, current_db_config
    current_db_config = dict(INITIAL_DB_CONFIG)
    app_state = "NORMAL"
    init_db()
    logger.info("Environment reset to NORMAL")
    return {"status": "RESET_SUCCESSFUL", "state": app_state}

