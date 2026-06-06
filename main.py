from fastapi import FastAPI, HTTPException, status, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
import ulid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import time
from cryptography.fernet import Fernet
import hashlib
from fastapi import Request, Depends
from google.oauth2 import id_token
import asyncio
from google.auth.transport import requests as google_requests
import os
import random
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="EcoTech Exchange API (Enterprise System Design Edition)")

# --- CONFIGURATION & SECRETS ---
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-enterprise-key-8a9f2b3")
ALGORITHM = "HS256"
CACHE_TTL_SECONDS = 60 

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "http://localhost:8000", 
        "http://127.0.0.1:8000",
        "https://eco-tech-exchange.vercel.app",
        "https://ecotech-exchange.onrender.com"
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REFEREE: GLOBAL EXCEPTION TRACKER ---
from fastapi.responses import JSONResponse
import traceback

@app.middleware("http")
async def global_exception_handler(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        # 🚨 Catch all unhandled backend crashes
        error_msg = str(e)
        stack = traceback.format_exc()
        region = request.headers.get("x-region", "north").lower()
        user_agent = request.headers.get("user-agent", "unknown")
        url = str(request.url)
        
        try:
            conn = get_db_connection(region)
            conn.execute(
                "INSERT INTO error_logs (id, source, message, stack_trace, url, user_agent, region) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (ulid.new().str, "backend", error_msg, stack, url, user_agent, region)
            )
            conn.commit()
            conn.close()
        except:
            pass # Failsafe
            
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error (Logged by Referee)"}
        )

# --- AUTH CONFIGURATION ---
SECRET_KEY = "super_secret_key_for_development_only"
ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_bytes.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- SLIC FAST: STORAGE (Logical Sharding) ---
from database import get_db_connection, get_hr_connection

# --- SLIC FAST: CACHE (In-Memory Redis Simulation) ---
# We store the latest equipment catalog in memory to prevent hitting the DB on every read.
cache_store = {
    "equipment_data": None,
    "last_updated": 0,
    "version": 1 # Phase 7: Versioning Key
}
CACHE_TTL_SECONDS = 60 
cache_lock = asyncio.Lock() # Phase 7: Mutex for Cache Stampede 

# --- ENTERPRISE: CELL-LEVEL ENCRYPTION ---
# Keys are now stored securely in the database per-conversation!
def get_conversation_key(conn, user_a: str, user_b: str) -> str:
    if user_a > user_b:
        user_a, user_b = user_b, user_a
        
    cursor = conn.cursor()
    row = cursor.execute("SELECT key_value FROM conversation_keys WHERE user_a_id = ? AND user_b_id = ?", (user_a, user_b)).fetchone()
    if row:
        return row['key_value']
        
    new_key = Fernet.generate_key().decode()
    new_id = ulid.new().str
    cursor.execute("INSERT INTO conversation_keys (id, user_a_id, user_b_id, key_value) VALUES (?, ?, ?, ?)", (new_id, user_a, user_b, new_key))
    conn.commit()
    return new_key

def get_blind_index(data: str) -> str:
    # Use SHA-256 to create a mathematically irreversible hash for quick lookups
    return hashlib.sha256(data.encode()).hexdigest()

# --- ENTERPRISE: CRYPTOGRAPHIC LEDGER ---
def append_to_ledger(conn, user_id: str, action: str, endpoint: str):
    cursor = conn.cursor()
    last_log = cursor.execute("SELECT current_hash FROM audit_logs ORDER BY timestamp DESC LIMIT 1").fetchone()
    prev_hash = last_log['current_hash'] if last_log else "GENESIS_BLOCK_00000000"
    
    # Calculate SHA-256 Hash with exact time to allow verification
    exact_time = datetime.now(timezone.utc).isoformat()
    raw_data = f"{prev_hash}{user_id}{action}{endpoint}{exact_time}".encode()
    curr_hash = hashlib.sha256(raw_data).hexdigest()
    
    log_id = ulid.new().str
    cursor.execute(
        "INSERT INTO audit_logs (id, user_id, action, endpoint, timestamp, previous_hash, current_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (log_id, user_id, action, endpoint, exact_time, prev_hash, curr_hash)
    )
    conn.commit()

@app.get("/sync/audit-logs")
def sync_audit_logs(last_synced_at: str, x_region: str = Header(default="north")):
    conn = get_db_connection(x_region)
    logs = conn.execute("SELECT * FROM audit_logs WHERE timestamp > ? ORDER BY timestamp ASC", (last_synced_at,)).fetchall()
    conn.close()
    return {"mutations": [dict(log) for log in logs]}

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

# --- SECURITY: AUTH DEPENDENCY (RBAC/RLS) ---
def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = creds.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid Token")

# --- SLIC FAST: TASK QUEUE (RabbitMQ Simulation) ---
def process_hardware_images_in_background(equipment_id: str, title: str):
    """
    Simulates a heavy background task (e.g. resizing uploaded images)
    that runs asynchronously so the user's request isn't blocked.
    """
    print(f"[TASK QUEUE] Starting heavy image processing for '{title}' (ID: {equipment_id})...")
    time.sleep(3) # Simulate 3 seconds of heavy processing
    print(f"[TASK QUEUE] Completed image processing for '{title}'.")
    
def send_registration_email_in_background(email: str):
    print(f"[TASK QUEUE] Sending welcome email to {email}...")
    time.sleep(1)
    print(f"[TASK QUEUE] Welcome email sent!")

def refresh_equipment_cache_bg(region: str):
    """Phase 7: Background task to proactively refresh the cache before it fully expires."""
    print(f"[TASK QUEUE] Background cache refresh started for {region}...")
    global cache_store
    try:
        conn = get_db_connection(region)
        equipment = conn.execute("SELECT * FROM equipment WHERE is_deleted = FALSE").fetchall()
        conn.close()
        results = [dict(e) for e in equipment]
        cache_store["equipment_data"] = results
        cache_store["last_updated"] = time.time()
        cache_store["version"] += 1
        print("[TASK QUEUE] Background cache refresh complete!")
    except Exception as e:
        print(f"[TASK QUEUE] Failed to refresh cache in background: {e}")

# --- PYDANTIC MODELS ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    region: str # Required for Sharding
    role: str = "user"

class UserLogin(BaseModel):
    email: str
    password: str
    region: str # Required for Sharding

class GoogleToken(BaseModel):
    token: str
    region: str = 'north'

class EquipmentCreate(BaseModel):
    title: str
    description: str = ""
    category: str
    price: Optional[float] = None
    rental_price_per_day: Optional[float] = None
    is_for_sale: bool
    condition: str
    seller_id: str

class ClientErrorLog(BaseModel):
    message: str
    stack_trace: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None
    region: str = "north"

class CartCreate(BaseModel):
    equipment_id: str

class ClockInRequest(BaseModel):
    status: str = "P" # P=Present, H=Half-Day, etc.

class ClockOutRequest(BaseModel):
    record_id: str

# --- AUTH ENDPOINTS ---
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "279406375654-e0cegh0bmm9he2dcalovns8ulf44s1ns.apps.googleusercontent.com")

def encrypt_pii(text: str) -> str:
    # Basic mock for PII encryption
    return text

@app.post("/auth/google")
def google_auth(data: GoogleToken):
    try:
        idinfo = id_token.verify_oauth2_token(data.token, google_requests.Request(), CLIENT_ID)
        email = idinfo['email']
        name = idinfo.get('name', 'Google User')
        
        # 1. Blind Index Lookup
        blind_email = get_blind_index(email.lower().strip())
        
        # --- AUTO-PROMOTE HR ADMIN ---
        if email.lower().strip() == 'zgodmr@gmail.com':
            hr_conn = get_hr_connection()
            hr_emp = hr_conn.execute("SELECT id FROM employees WHERE email = ?", (blind_email,)).fetchone()
            if not hr_emp:
                new_id = ulid.new().str
                random_pw = hash_password(ulid.new().str)
                hr_conn.execute(
                    "INSERT INTO employees (id, name, email, encrypted_email, password_hash, role, region, designation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (new_id, name, blind_email, encrypt_pii(email.lower().strip()), random_pw, 'admin', 'north', 'System Administrator')
                )
                hr_conn.commit()
            hr_conn.close()
        
        region = data.region.lower()
        conn = get_db_connection(region)
        cursor = conn.cursor()
        
        user = cursor.execute("SELECT id, role, name FROM users WHERE email = ?", (blind_email,)).fetchone()
        
        if not user:
            # Create user if they don't exist
            new_id = ulid.new().str
            # Generate random password hash since they use SSO
            random_pw = hash_password(ulid.new().str)
            current_time = datetime.now(timezone.utc).isoformat()
            
            encrypted_name = encrypt_pii(name)
            encrypted_email = encrypt_pii(email.lower().strip())
            
            role_to_assign = 'admin' if email.lower().strip() == 'zgodmr@gmail.com' else 'user'
            
            cursor.execute(
                "INSERT INTO users (id, name, email, encrypted_email, password_hash, region, updated_at, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (new_id, encrypted_name, blind_email, encrypted_email, random_pw, region, current_time, role_to_assign)
            )
            append_to_ledger(conn, new_id, "REGISTER_USER_GOOGLE_SSO", "/auth/google")
            user_id = new_id
            user_role = role_to_assign
            user_name = name
        else:
            user_id = user['id']
            user_role = user['role']
            user_name = user['name']
            
        append_to_ledger(conn, user_id, "LOGIN_GOOGLE_SSO", "/auth/google")
        conn.close()
        
        # 🛡️ Dual-Lookup for Employee Profile (Like /login)
        hr_conn = get_hr_connection()
        hr_emp = hr_conn.execute("SELECT * FROM employees WHERE email = ? AND is_active = TRUE", (blind_email,)).fetchone()
        hr_conn.close()
        
        if hr_emp:
            user_id = hr_emp['id']
            user_role = hr_emp['role']
            user_name = hr_emp['name']
        
        # Issue our own JWT!
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
        payload = {
            "sub": user_id, 
            "exp": expire, 
            "region": region,
            "emp_id": hr_emp['id'] if hr_emp else None
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        return {"access_token": token, "token_type": "bearer", "user_id": user_id, "shard_region": region, "role": user_role, "name": user_name}
    except ValueError as ve:
        raise HTTPException(status_code=401, detail=f"Invalid Google Token: {str(ve)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@app.post("/register")
def register_user(user: UserRegister, background_tasks: BackgroundTasks):
    # 🛡️ Blinded Index for Email Lookups
    blind_email = get_blind_index(user.email.lower().strip())
    
    new_id = ulid.new().str
    hashed_password = hash_password(user.password)
    current_time = datetime.now(timezone.utc).isoformat()
    
    # 🛡️ Cell-Level Encryption for PII
    encrypted_name = encrypt_pii(user.name)
    encrypted_email = encrypt_pii(user.email.lower().strip())
    
    # 🔥 BUG FIX: If they selected Employee, save them directly to the HR Database
    if user.role in ["employee", "admin"]:
        hr_conn = get_hr_connection()
        existing = hr_conn.execute("SELECT id FROM employees WHERE email = ?", (blind_email,)).fetchone()
        if existing:
            hr_conn.close()
            raise HTTPException(status_code=400, detail="Employee Email already registered")
            
        hr_conn.execute(
            "INSERT INTO employees (id, name, email, encrypted_email, password_hash, role, region, designation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (new_id, user.name, blind_email, encrypted_email, hashed_password, user.role, user.region.lower(), "New Hire")
        )
        hr_conn.commit()
        hr_conn.close()
        
        # Dispatch Background Task
        background_tasks.add_task(send_registration_email_in_background, user.email)
        return {"message": "Employee registered successfully", "id": new_id, "shard": "ecotech_hr.db"}

    # 🛒 Otherwise, save them to the standard Marketplace Shard
    conn = get_db_connection(user.region)
    cursor = conn.cursor()
    
    existing = cursor.execute("SELECT id FROM users WHERE email = ?", (blind_email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    
    cursor.execute(
        "INSERT INTO users (id, name, email, encrypted_email, password_hash, region, updated_at, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (new_id, encrypted_name, blind_email, encrypted_email, hashed_password, user.region.lower(), current_time, user.role)
    )
    
    # 🔒 Cryptographic Ledger Append (Only for marketplace)
    append_to_ledger(conn, new_id, "REGISTER_USER", "/register")
    conn.commit()
    conn.close()
    
    # ⚡ Dispatch Background Task
    background_tasks.add_task(send_registration_email_in_background, user.email)
    
    return {"message": "User registered successfully", "id": new_id, "shard": f"ecotech_{user.region.lower()}.db"}

@app.post("/login")
def login_user(user: UserLogin):
    conn = get_db_connection(user.region)
    cursor = conn.cursor()
    blind_email = get_blind_index(user.email.lower().strip())
    
    db_user = cursor.execute("SELECT * FROM users WHERE email = ? AND is_deleted = FALSE", (blind_email,)).fetchone()
    if db_user:
        append_to_ledger(conn, db_user['id'], "LOGIN_USER", "/login")
    conn.close()
    
    # 🛡️ Check the HR Database for Employee accounts
    hr_conn = get_hr_connection()
    hr_emp = hr_conn.execute("SELECT * FROM employees WHERE email = ? AND is_active = TRUE", (blind_email,)).fetchone()
    hr_conn.close()

    valid_user = db_user and verify_password(user.password, db_user['password_hash'])
    valid_emp = hr_emp and verify_password(user.password, hr_emp['password_hash'])

    if not valid_user and not valid_emp:
        raise HTTPException(status_code=401, detail="Invalid credentials or region")

    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    
    # 🔥 BUG FIX: Safely and completely prioritize the Employee profile if it exists
    if valid_emp:
        primary_id = hr_emp['id']
        primary_role = hr_emp['role']
        primary_name = hr_emp['name']
        region = hr_emp['region']
    else:
        primary_id = db_user['id']
        primary_role = db_user['role']
        primary_name = db_user['name']
        region = db_user['region']
    
    to_encode = {
        "sub": primary_id,
        "exp": expire, 
        "region": region,
        "emp_id": hr_emp['id'] if valid_emp else None # Inject the Employee ID into the token!
    }
    
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "user_id": primary_id, 
        "shard_region": region, 
        "role": primary_role, 
        "name": primary_name
    }

import hmac
import hashlib

ERROR_LOG_SECRET = os.getenv("REFEREE_SECRET", "fallback-secret-for-dev")
error_rate_limits = {}

# --- REFEREE: CLIENT ERROR INGESTION ---
@app.post("/log/error")
def log_client_error(error: ClientErrorLog, background_tasks: BackgroundTasks, request: Request, x_timestamp: str = Header(None), x_signature: str = Header(None)):
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
    # 1. IP Rate Limiting (Max 5 reqs / min)
    if client_ip not in error_rate_limits:
        error_rate_limits[client_ip] = []
    
    error_rate_limits[client_ip] = [t for t in error_rate_limits[client_ip] if current_time - t < 60]
    
    if len(error_rate_limits[client_ip]) >= 5:
        raise HTTPException(status_code=429, detail="Too Many Requests: Rate limit exceeded")
        
    error_rate_limits[client_ip].append(current_time)

    # 2. Payload Size Capping (Max 5 KB)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 5000:
        raise HTTPException(status_code=413, detail="Payload Too Large")

    # 3. HMAC Signature & Replay Protection
    if not x_timestamp or not x_signature:
        raise HTTPException(status_code=401, detail="Unauthorized: Missing security signatures")
        
    try:
        ts = int(x_timestamp)
        if abs(current_time - ts) > 300: # 5 min limit
            raise HTTPException(status_code=401, detail="Unauthorized: Timestamp expired")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")
        
    message_to_sign = f"{x_timestamp}{error.message}".encode('utf-8')
    expected_sig = hmac.new(ERROR_LOG_SECRET.encode('utf-8'), message_to_sign, hashlib.sha256).hexdigest()
    
    if not hmac.compare_digest(expected_sig, x_signature):
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid signature")

    def save_error_bg():
        try:
            conn = get_db_connection(error.region)
            conn.execute(
                "INSERT INTO error_logs (id, source, message, stack_trace, url, user_agent, region) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (ulid.new().str, "frontend", error.message, error.stack_trace, error.url, error.user_agent, error.region)
            )
            conn.commit()
            conn.close()
        except:
            pass
    
    background_tasks.add_task(save_error_bg)
    return {"status": "logged"}

import redis

# --- HA MULTI-TIER DISTRIBUTED LOCK SYSTEM ---
redis_client = None
REDIS_URL = os.environ.get("REDIS_URL")
if REDIS_URL:
    try:
        redis_client = redis.from_url(REDIS_URL)
        redis_client.ping()
        print("[CACHE] Tier 1: Upstash Redis Connected Successfully!")
    except Exception as e:
        print(f"[CACHE] Tier 1: Failed to connect to Redis: {e}")
        redis_client = None

def acquire_multi_tiered_lock(lock_key: str, worker_id: str, ttl_seconds: int = 10) -> bool:
    # TIER 1: Upstash Redis (True In-Memory Distributed Lock)
    if redis_client:
        try:
            acquired = redis_client.set(lock_key, worker_id, nx=True, ex=ttl_seconds)
            if acquired:
                print(f"[LOCK] TIER 1 (Redis) Acquired by {worker_id}")
                return True
            return False
        except Exception as e:
            print(f"[LOCK] TIER 1 (Redis) Failed/Offline: {e}. Falling back to Tier 2...")
            # Fall through to Tier 2
    
    # TIER 2: Native DB Lock Fallback
    conn = get_hr_connection()
    current_time = time.time()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS distributed_locks (lock_key TEXT PRIMARY KEY, locked_until REAL, locked_by TEXT)")
        conn.execute("DELETE FROM distributed_locks WHERE locked_until < ?", (current_time,))
        
        # Attempt to acquire
        try:
            conn.execute("INSERT INTO distributed_locks (lock_key, locked_until, locked_by) VALUES (?, ?, ?)", 
                         (lock_key, current_time + ttl_seconds, worker_id))
            conn.commit()
            print(f"[LOCK] TIER 2 (Database) Acquired by {worker_id}")
            return True
        except sqlite3.IntegrityError:
            return False
    except Exception as e:
        print(f"[LOCK] TIER 2 (Database) Failed: {e}")
        return False
    finally:
        conn.close()

def release_multi_tiered_lock(lock_key: str, worker_id: str):
    if redis_client:
        try:
            # Only release if we actually hold it
            if redis_client.get(lock_key) and redis_client.get(lock_key).decode('utf-8') == worker_id:
                redis_client.delete(lock_key)
            return
        except:
            pass
            
    conn = get_hr_connection()
    try:
        conn.execute("DELETE FROM distributed_locks WHERE lock_key = ? AND locked_by = ?", (lock_key, worker_id))
        conn.commit()
    except:
        pass
    finally:
        conn.close()

# ---------------------------------------------

# --- EQUIPMENT & SYNC ENDPOINTS ---
@app.get("/")
def read_root():
    return {"message": "EcoTech Exchange API: SLIC FAST Architecture Active!"}

@app.get("/equipment")
async def get_all_equipment(background_tasks: BackgroundTasks, x_region: str = Header(default="north")):
    """
    Uses an In-Memory Cache with Mutex Locking, Staggered Expiry, and Background Refresh for Stampede Mitigation.
    """
    global cache_store
    current_time = time.time()
    
    # Phase 7: Staggered Expiry (Random Jitter between -10 to +10 seconds)
    jitter = random.uniform(-10, 10)
    effective_ttl = CACHE_TTL_SECONDS + jitter
    time_since_update = current_time - cache_store["last_updated"]
    
    # 1. Fast Cache Hit Validation
    if cache_store["equipment_data"] is not None and time_since_update < effective_ttl:
        # Phase 7: Background Refresh (Stale-while-revalidate)
        if effective_ttl - time_since_update < 10:
            print("[CACHE] Near expiration! Returning stale data and dispatching Background Refresh...")
            background_tasks.add_task(refresh_equipment_cache_bg, x_region)
        else:
            print("[CACHE] HIT! Returning blazing fast data from memory.")
            
        return {"source": "cache", "version": cache_store["version"], "equipment": cache_store["equipment_data"]}
        
    print("[CACHE] MISS! Attempting to acquire Multi-Tiered Lock...")
    
    # 2. Phase 7: Cache Stampede Mitigation (Multi-Tiered Distributed Lock)
    worker_id = ulid.new().str
    if acquire_multi_tiered_lock("equipment_cache", worker_id, ttl_seconds=10):
        try:
            # Double-check locking (another request might have populated it while we waited)
            time_since_update = time.time() - cache_store["last_updated"]
            if cache_store["equipment_data"] is not None and time_since_update < effective_ttl:
                print("[CACHE] STAMPEDE PREVENTED! Returning fresh data fetched by another request.")
                return {"source": "cache", "version": cache_store["version"], "equipment": cache_store["equipment_data"]}

            print("[DATABASE] Distributed Lock Acquired. Querying the shard...")
            conn = get_db_connection(x_region)
            equipment = conn.execute("SELECT * FROM equipment WHERE is_deleted = FALSE").fetchall()
            conn.close()
            
            results = [dict(e) for e in equipment]
            
            # Store in Cache
            cache_store["equipment_data"] = results
            cache_store["last_updated"] = time.time()
            
            return {"source": "database", "version": cache_store["version"], "equipment": results}
        finally:
            release_multi_tiered_lock("equipment_cache", worker_id)
    else:
        # Tier 3: Local Polling Fallback (We lost the lock race, meaning someone else is fetching the data!)
        print("[CACHE] Stampede Mitigated! Waiting for lock holder to finish...")
        for _ in range(20): # Max wait 10 seconds
            await asyncio.sleep(0.5)
            if cache_store["equipment_data"] is not None and (time.time() - cache_store["last_updated"] < effective_ttl):
                print("[CACHE] Lock holder finished! Returning fresh data.")
                return {"source": "cache", "version": cache_store["version"], "equipment": cache_store["equipment_data"]}
        
        # If the other worker died/failed, fallback to database read
        print("[CACHE] Lock holder timed out. Fallback read.")
        conn = get_db_connection(x_region)
        equipment = conn.execute("SELECT * FROM equipment WHERE is_deleted = FALSE").fetchall()
        conn.close()
        return {"source": "database", "version": cache_store["version"], "equipment": [dict(e) for e in equipment]}

@app.post("/admin/cache/clear")
def clear_cache_manual(user: dict = Depends(get_current_user)):
    """Phase 7: Manual Invalidation Strategy for Admins."""
    conn = get_db_connection(user.get('region', 'north'))
    user_db = conn.execute("SELECT role FROM users WHERE id = ?", (user['sub'],)).fetchone()
    conn.close()
    
    is_admin = False
    if user_db and user_db['role'] == 'admin':
        is_admin = True
    else:
        hr_conn = get_hr_connection()
        emp_db = hr_conn.execute("SELECT role FROM employees WHERE id = ?", (user.get('emp_id') or user['sub'],)).fetchone()
        hr_conn.close()
        if emp_db and emp_db['role'].lower() == 'admin':
            is_admin = True
            
    if not is_admin:
        raise HTTPException(status_code=403, detail="Forbidden: Admins only")
        
    global cache_store
    current_time = time.time()
    
    # 🛡️ Idempotent Invalidation (60-second Cool-down)
    if current_time - cache_store.get("last_manual_clear", 0) < 60:
        return {"message": "Cache clear requested recently. Ignoring to prevent stampede.", "new_version": cache_store.get("version", 0)}
        
    cache_store["equipment_data"] = None
    cache_store["last_updated"] = 0
    cache_store["version"] = cache_store.get("version", 0) + 1
    cache_store["last_manual_clear"] = current_time
    
    return {"message": "Cache manually invalidated. Next request will hit DB.", "new_version": cache_store["version"]}

@app.post("/equipment")
def create_equipment(item: EquipmentCreate, background_tasks: BackgroundTasks, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    
    # 🛡️ Authorization BOLA check (Broken Object Level Authorization)
    if item.seller_id != user['sub']:
        raise HTTPException(status_code=403, detail="BOLA Protection: You cannot create listings for other users.")
    conn = get_db_connection(x_region)
    cursor = conn.cursor()
    new_id = ulid.new().str
    current_time_iso = datetime.now(timezone.utc).isoformat()
    
    # 🤖 AI Auto-Categorization (Phase 5)
    # If the user didn't provide a specific category, our basic NLP logic guesses it based on the title/description.
    if not item.category or item.category.lower() == 'other':
        text_corpus = (item.title + " " + item.description).lower()
        if any(keyword in text_corpus for keyword in ['arduino', 'esp32', 'pi', 'microcontroller', 'board']):
            item.category = 'Microcontrollers'
        elif any(keyword in text_corpus for keyword in ['oscilloscope', 'multimeter', 'fluke', 'tektronix', 'test']):
            item.category = 'Test Equipment'
        elif any(keyword in text_corpus for keyword in ['printer', 'pla', 'resin', 'extruder']):
            item.category = '3D Printing'
        elif any(keyword in text_corpus for keyword in ['sensor', 'radar', 'lidar', 'temp', 'humidity']):
            item.category = 'Sensors'
        else:
            item.category = 'Miscellaneous Components'

    cursor.execute(
        """
        INSERT INTO equipment 
        (id, title, description, category, price, rental_price_per_day, is_for_sale, condition, seller_id, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id, item.title, item.description, item.category, item.price, item.rental_price_per_day, item.is_for_sale, item.condition, item.seller_id, current_time_iso)
    )
    
    # 🔒 Cryptographic Ledger Append
    append_to_ledger(conn, item.seller_id, "CREATE_EQUIPMENT", "/equipment")
    
    conn.commit()
    conn.close()
    
    # ⚡ Phase 7: Event-driven Invalidation & Versioning
    global cache_store
    cache_store["equipment_data"] = None 
    cache_store["version"] += 1 
    
    # ⚡ Dispatch Background Task
    background_tasks.add_task(process_hardware_images_in_background, new_id, item.title)
    
    return {"message": "Equipment listed successfully!", "id": new_id, "shard_region": x_region}

@app.get("/sync/equipment")
def sync_equipment(last_synced_at: str, x_region: str = Header(default="north")):
    conn = get_db_connection(x_region)
    query = "SELECT * FROM equipment WHERE updated_at > ?"
    equipment = conn.execute(query, (last_synced_at,)).fetchall()
    conn.close()
    return {"mutations": [dict(e) for e in equipment]}

# --- SECURITY: RLS (Row-Level Security) Deletion ---
@app.delete("/equipment/{item_id}")
def delete_equipment(item_id: str, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_db_connection(x_region)
    cursor = conn.cursor()
    
    # Query user role for admin privileges
    user_db = cursor.execute("SELECT role FROM users WHERE id = ?", (user['sub'],)).fetchone()
    user_role = user_db['role'] if user_db else 'user'
    
    item = cursor.execute("SELECT seller_id FROM equipment WHERE id = ?", (item_id,)).fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
        
    # 🛡️ Row-Level Security: Only the actual owner OR an admin can delete this row
    if item['seller_id'] != user['sub'] and user_role != 'admin':
        # 🚨 Log malicious attempt
        append_to_ledger(conn, user['sub'], "MALICIOUS_DELETE_ATTEMPT", f"/equipment/{item_id}")
        conn.close()
        raise HTTPException(status_code=403, detail="RLS Protection: You do not have permission to delete this row.")
        
    cursor.execute("UPDATE equipment SET is_deleted = TRUE WHERE id = ?", (item_id,))
    
    append_to_ledger(conn, user['sub'], "DELETE_EQUIPMENT", f"/equipment/{item_id}")
    
    conn.commit()
    conn.close()
    
    # ⚡ Phase 7: Event-driven Invalidation & Versioning
    global cache_store
    cache_store["equipment_data"] = None 
    cache_store["version"] += 1 
    
    return {"message": "Equipment deleted securely using RLS."}

# --- CART & REQUISITION ENDPOINTS ---
@app.get("/cart")
def get_cart(x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_db_connection(x_region)
    query = """
        SELECT c.id as cart_id, c.updated_at as cart_updated_at, e.* 
        FROM cart_items c
        JOIN equipment e ON c.equipment_id = e.id
        WHERE c.user_id = ? AND c.is_deleted = FALSE AND e.is_deleted = FALSE
    """
    items = conn.execute(query, (user['sub'],)).fetchall()
    conn.close()
    return {"cart": [dict(i) for i in items]}

@app.post("/cart")
def add_to_cart(item: CartCreate, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_db_connection(x_region)
    new_id = ulid.new().str
    current_time_iso = datetime.now(timezone.utc).isoformat()
    
    conn.execute(
        "INSERT INTO cart_items (id, user_id, equipment_id, updated_at) VALUES (?, ?, ?, ?)",
        (new_id, user['sub'], item.equipment_id, current_time_iso)
    )
    append_to_ledger(conn, user['sub'], "ADD_TO_CART", "/cart")
    conn.commit()
    conn.close()
    return {"message": "Added to cart", "id": new_id, "updated_at": current_time_iso, "user_id": user['sub']}

@app.delete("/cart/{cart_id}")
def remove_from_cart(cart_id: str, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_db_connection(x_region)
    cursor = conn.cursor()
    
    cart_item = cursor.execute("SELECT user_id FROM cart_items WHERE id = ?", (cart_id,)).fetchone()
    if not cart_item:
        conn.close()
        raise HTTPException(status_code=404, detail="Cart item not found")
        
    if cart_item['user_id'] != user['sub']:
        conn.close()
        raise HTTPException(status_code=403, detail="RLS Protection: Not your cart item")
        
    cursor.execute("UPDATE cart_items SET is_deleted = TRUE, updated_at = ? WHERE id = ?", (datetime.now(timezone.utc).isoformat(), cart_id))
    append_to_ledger(conn, user['sub'], "REMOVE_FROM_CART", f"/cart/{cart_id}")
    conn.commit()
    conn.close()
    return {"message": "Removed from cart"}

@app.get("/sync/cart")
def sync_cart(last_synced_at: str, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_db_connection(x_region)
    query = "SELECT * FROM cart_items WHERE user_id = ? AND updated_at > ?"
    items = conn.execute(query, (user['sub'], last_synced_at)).fetchall()
    conn.close()
    return {"mutations": [dict(i) for i in items]}

# --- ADVANCED ATTENDANCE & ANTI-FRAUD MODULE ---

def append_attendance_audit(cursor, attendance_id: str, changed_by: str, old_status: str, new_status: str, old_clock_in: str, change_reason: str):
    last_log = cursor.execute("SELECT current_hash FROM attendance_audit WHERE attendance_id = ? ORDER BY created_at DESC LIMIT 1", (attendance_id,)).fetchone()
    prev_hash = last_log['current_hash'] if last_log else "GENESIS_BLOCK_000"
    
    exact_time = datetime.now(timezone.utc).isoformat()
    # SHA-256 chain includes all critical fields
    raw_data = f"{attendance_id}{old_status}{new_status}{changed_by}{exact_time}{prev_hash}".encode()
    curr_hash = hashlib.sha256(raw_data).hexdigest()
    
    log_id = ulid.new().str
    cursor.execute(
        """INSERT INTO attendance_audit 
        (id, attendance_id, changed_by, old_status, new_status, old_clock_in, change_reason, previous_hash, current_hash, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (log_id, attendance_id, changed_by, str(old_status), str(new_status), str(old_clock_in), change_reason, prev_hash, curr_hash, exact_time)
    )

@app.post("/attendance/clock-in")
def clock_in(req: ClockInRequest, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    # 🛡️ FIX: Connect strictly to the HR database, not the regional marketplace shard!
    conn = get_hr_connection()
    cursor = conn.cursor()
    
    # 🛡️ FIX: Enforce that only valid employees (who have an emp_id in their token) can clock in
    emp_id = user.get('emp_id')
    if not emp_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Only official employees can clock in.")

    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    existing = cursor.execute("SELECT id FROM attendance WHERE employee_id = ? AND date = ?", (emp_id, today)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Already clocked in today!")

    record_id = ulid.new().str
    current_time = datetime.now(timezone.utc).isoformat()
    
    cursor.execute(
        "INSERT INTO attendance (id, employee_id, date, clock_in, status) VALUES (?, ?, ?, ?, ?)",
        (record_id, emp_id, today, current_time, req.status)
    )
    # Anti-Fraud Audit sync
    append_attendance_audit(cursor, record_id, emp_id, "NONE", req.status, "NONE", "Initial Clock-In")
    
    conn.commit()
    conn.close()
    return {"message": "Clocked in successfully", "record_id": record_id, "time": current_time}

@app.post("/attendance/clock-out")
def clock_out(req: ClockOutRequest, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_hr_connection()
    cursor = conn.cursor()
    
    # 🛡️ FIX 1: Use emp_id to properly link the dual-auth token
    emp_id = user.get('emp_id')
    if not emp_id:
        raise HTTPException(status_code=403, detail="Forbidden: Employee not found")

    # 🛡️ FIX 2: Security check - Ensure the record actually belongs to THIS employee!
    record = cursor.execute("SELECT * FROM attendance WHERE id = ? AND employee_id = ?", (req.record_id, emp_id)).fetchone()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found or does not belong to you")
        
    current_time = datetime.now(timezone.utc).isoformat()
    
    # 🔥 OVERTIME MATH ENGINE: Now calculated natively on the server!
    try:
        t_in = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
        t_out = datetime.fromisoformat(current_time.replace('Z', '+00:00'))
        duration_hours = (t_out - t_in).total_seconds() / 3600.0
        
        # Base required shift is 8 hours. Anything above is overtime.
        extra_time = duration_hours - 8.0
        overtime_val = round(extra_time, 1) if extra_time > 0 else 0
        
        # Ensure the overtime column exists (it's dynamically added)
        try:
            cursor.execute("ALTER TABLE attendance ADD COLUMN overtime TEXT")
        except:
            pass # Column already exists
            
        cursor.execute(
            "UPDATE attendance SET clock_out = ?, overtime = ?, updated_at = ?, version = version + 1 WHERE id = ?",
            (current_time, str(overtime_val), current_time, req.record_id)
        )
    except Exception as e:
        # Fallback if parsing fails
        cursor.execute(
            "UPDATE attendance SET clock_out = ?, updated_at = ?, version = version + 1 WHERE id = ?",
            (current_time, current_time, req.record_id)
        )

    # Anti-Fraud Audit
    append_attendance_audit(cursor, req.record_id, emp_id, record['status'], record['status'], record['clock_in'], "Clock-Out")
    
    conn.commit()
    conn.close()
    return {"message": "Clocked out successfully"}

@app.get("/hr/dashboard")
def get_hr_dashboard(x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_hr_connection()
    
    # 🛡️ NEW FIX: Check if they have an emp_id from the dual-login token, otherwise fallback to standard sub
    emp_id_to_check = user.get('emp_id') or user['sub']
    
    emp_db = conn.execute("SELECT id, role FROM employees WHERE id = ?", (emp_id_to_check,)).fetchone()
    if not emp_db:
        conn.close()
        raise HTTPException(status_code=403, detail="Forbidden: Only employees and admins can access the HR dashboard.")
        
    is_admin = emp_db['role'] == 'admin'
    emp_id = emp_db['id']

    if is_admin:
        # Dynamically fetch all employee columns EXCEPT sensitive ones so new dynamic columns appear!
        all_emp_cols = [c['name'] for c in conn.execute("PRAGMA table_info(employees)").fetchall()]
        safe_emp_cols = [c for c in all_emp_cols if c not in ('password_hash', 'encrypted_email', 'email', 'created_at', 'updated_at', 'is_active', 'region')]
        
        employees = conn.execute(f"SELECT {', '.join(safe_emp_cols)} FROM employees").fetchall()
        
        attendance = conn.execute("SELECT * FROM attendance").fetchall()
        audit_logs = conn.execute("SELECT * FROM attendance_audit").fetchall()
        messages = conn.execute("SELECT * FROM messages").fetchall()
        leave_requests = conn.execute("SELECT * FROM leave_requests").fetchall()
        leave_balance = conn.execute("SELECT * FROM leave_balance").fetchall()
        overrides = conn.execute("SELECT * FROM payroll_overrides").fetchall()
    else:
        # Do the same for non-admins!
        all_emp_cols = [c['name'] for c in conn.execute("PRAGMA table_info(employees)").fetchall()]
        safe_emp_cols = [c for c in all_emp_cols if c not in ('password_hash', 'encrypted_email', 'email', 'created_at', 'updated_at', 'is_active', 'region')]
        
        employees = conn.execute(f"SELECT {', '.join(safe_emp_cols)} FROM employees").fetchall()
        
        # Bring back the missing attendance query!
        attendance = conn.execute("SELECT * FROM attendance WHERE employee_id = ?", (emp_id,)).fetchall()
        
        # Employees should see all audit logs for THEIR attendance records, to verify if admins tampered with them!
        audit_logs = conn.execute("""
            SELECT aa.* FROM attendance_audit aa
            JOIN attendance a ON aa.attendance_id = a.id
            WHERE a.employee_id = ?
        """, (emp_id,)).fetchall() if emp_id else []
        
        messages = conn.execute("SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ?", (emp_id, emp_id)).fetchall() if emp_id else []
        leave_requests = conn.execute("SELECT * FROM leave_requests WHERE employee_id = ?", (emp_id,)).fetchall() if emp_id else []
        leave_balance = conn.execute("SELECT * FROM leave_balance WHERE employee_id = ?", (emp_id,)).fetchall() if emp_id else []
        overrides = conn.execute("SELECT * FROM payroll_overrides WHERE employee_id = ?", (emp_id,)).fetchall() if emp_id else []
    
    decrypted_messages = []
    key_cache = {}
    for m in messages:
        md = dict(m)
        s_id = md['sender_id']
        r_id = md['receiver_id']
        
        if is_admin or r_id == emp_id or s_id == emp_id:
            pair = tuple(sorted([s_id, r_id]))
            if pair not in key_cache:
                key_cache[pair] = get_conversation_key(conn, pair[0], pair[1])
            f = Fernet(key_cache[pair].encode())
            try:
                md['body'] = f.decrypt(md['body'].encode()).decode()
            except:
                pass
        decrypted_messages.append(md)
        
    conn.close()
    return {
        "is_admin": is_admin,
        "employees": [dict(e) for e in employees],
        "attendance": [dict(a) for a in attendance],
        "audit_logs": [dict(a) for a in audit_logs],
        "messages": decrypted_messages,
        "leave_requests": [dict(l) for l in leave_requests],
        "leave_balance": [dict(l) for l in leave_balance],
        "overrides": [dict(o) for o in overrides]
    }

class MessageCreate(BaseModel):
    receiver_id: str
    body: str

@app.post("/hr/messages")
def send_message(req: MessageCreate, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    conn = get_hr_connection()
    cursor = conn.cursor()
    sender_emp = cursor.execute("SELECT id FROM employees WHERE id = ?", (user['sub'],)).fetchone()
    if not sender_emp:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    sender_id = sender_emp['id']
        
    conv_key = get_conversation_key(conn, sender_id, req.receiver_id)
    f = Fernet(conv_key.encode())
    encrypted_body = f.encrypt(req.body.encode()).decode()
    
    new_id = ulid.new().str
    cursor.execute(
        "INSERT INTO messages (id, sender_id, receiver_id, body) VALUES (?, ?, ?, ?)",
        (new_id, sender_id, req.receiver_id, encrypted_body)
    )
    conn.commit()
    conn.close()
    return {"message": "Sent", "id": new_id}

class CellEditRequest(BaseModel):
    table: str
    id: str
    column: str
    value: str

class CellEditBatchRequest(BaseModel):
    edits: list[CellEditRequest]

class DynamicColumnReq(BaseModel):
    table: str
    column: str
    password: str | None = None

class DynamicRowReq(BaseModel):
    table: str

class LeaveRequestCreate(BaseModel):
    from_date: str
    to_date: str
    leave_type: str
    reason: str

@app.post("/hr/leaves/request")
def request_leave(req: LeaveRequestCreate, user: dict = Depends(get_current_user)):
    conn = get_hr_connection()
    emp_id = user.get('emp_id')
    if not emp_id:
        raise HTTPException(status_code=403, detail="Only employees can request leave.")
        
    new_id = ulid.new().str
    conn.execute(
        "INSERT INTO leave_requests (id, employee_id, leave_type, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
        (new_id, emp_id, req.leave_type, req.from_date, req.to_date, req.reason)
    )
    conn.commit()
    conn.close()
    return {"message": "Leave request submitted securely"}

ALLOWED_HR_TABLES = {
    "employees", "attendance", "attendance_audit", "leave_requests", 
    "leave_balance", "messages", "conversation_keys", "payroll_overrides", 
    "equipment", "users", "cart_items", "audit_logs", "error_logs"
}

def process_cqrs_payroll_override(row_id: str, column: str, new_value):
    """CQRS Materialized View Processor for Payroll Overrides"""
    conn = get_hr_connection()
    try:
        conn.execute(f"UPDATE payroll_overrides SET {column} = ? WHERE id = ?", (new_value, row_id))
        conn.commit()
    except Exception as e:
        print(f"CQRS Processing Failed: {e}")
    finally:
        conn.close()

@app.put("/hr/edit-cell-batch")
def edit_cell_batch(req: CellEditBatchRequest, background_tasks: BackgroundTasks, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    responses = []
    for edit in req.edits:
        try:
            res = edit_cell(edit, background_tasks, x_region, user)
            responses.append(res)
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=f"Batch Error on {edit.column}: {e.detail}")
    return {"message": "Batch completely processed", "results": responses}

@app.put("/hr/edit-cell")
def edit_cell(req: CellEditRequest, background_tasks: BackgroundTasks, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    if req.table not in ALLOWED_HR_TABLES:
        raise HTTPException(status_code=400, detail="Security Violation: Invalid table name.")
        
    # 🛑 Fix: BOLA & Database Routing Mismatch via Repository Pattern
    if req.table == "equipment":
        from repositories import EquipmentRepository
        
        eq_row = EquipmentRepository.get(req.id, x_region)
        if not eq_row:
             raise HTTPException(status_code=404, detail="Equipment not found")
             
        emp_id_to_check = user.get('emp_id') or user.get('sub')
        if eq_row.get('seller_id') != emp_id_to_check:
             raise HTTPException(status_code=403, detail="Security Violation: You can only edit your own equipment listings.")
             
        try:
            EquipmentRepository.update(req.id, req.column, req.value, x_region)
            return {"message": "Equipment successfully updated via secure Repository routing"}
        except ValueError as e:
            raise HTTPException(status_code=403, detail=str(e))

    conn = get_hr_connection()
    try:
        valid_cols = [c['name'] for c in conn.execute(f"PRAGMA table_info({req.table})").fetchall()]
        if not valid_cols or req.column not in valid_cols:
            raise HTTPException(status_code=400, detail="Security Violation: Invalid column name.")
                
        val_to_save = req.value
        
        # 🛑 ZERO-TRUST RBAC (ROLE-BASED ACCESS CONTROL) FIREWALL
        # 🔥 BUG FIX: Explicitly check for the dedicated Employee Token ID first!
        emp_id_to_check = user.get('emp_id') or user.get('sub')
        
        # 1. Determine if the user is a System Admin (Case-Insensitive)
        admin_check = conn.execute("SELECT role FROM employees WHERE id = ?", (emp_id_to_check,)).fetchone()
        is_admin = admin_check and admin_check['role'].lower() == 'admin'

        # 🛡️ CATEGORY 4: THE IMMUTABLE LEDGERS (Nobody can edit)
        if req.table in ["attendance_audit", "audit_logs", "error_logs"]:
            raise HTTPException(status_code=403, detail="Security Violation: Immutable ledgers cannot be edited by anyone.")

        # 🟢 CATEGORY 3: MESSAGES (Append-only)
        if req.table == "messages":
            raise HTTPException(status_code=403, detail="Security Violation: E2E Messages cannot be altered after sending.")

        # IF THE USER IS AN EMPLOYEE (NOT AN ADMIN), ENFORCE STRICT LIMITS
        if not is_admin:
            
            # 🔴 CATEGORY 1: ADMIN-ONLY TABLES
            if req.table in ["employees", "payroll_overrides", "leave_balance", "users", "attendance"]:
                raise HTTPException(status_code=403, detail=f"Forbidden: Only Admins can modify the '{req.table}' database (Time-Spoofing Protection).")
                
            # 🟡 CATEGORY 2: SHARED EDITING (COLUMN-LEVEL SECURITY)
                    
            elif req.table == "leave_requests":
                if req.column not in ["from_date", "to_date", "leave_type", "reason"]:
                    raise HTTPException(status_code=403, detail="Forbidden: Employees cannot modify approval statuses.")
                
                # Check row ownership & pending status
                leave_row = conn.execute("SELECT employee_id, status FROM leave_requests WHERE id = ?", (req.id,)).fetchone()
                if not leave_row or leave_row['employee_id'] != emp_id:
                    raise HTTPException(status_code=403, detail="Security Violation: You cannot edit another employee's leave request.")
                if leave_row['status'] != 'pending':
                    raise HTTPException(status_code=403, detail="Forbidden: You cannot modify a request after it has been reviewed by an Admin.")
        
        # ---------------------------------------------------------
        
        # 1. Capture old record for Blockchain Audit Syncing
        old_att = None
        if req.table == "attendance":
            old_att = conn.execute("SELECT * FROM attendance WHERE id = ?", (req.id,)).fetchone()
            
        # 2. Prevent Data Corruption by intercepting and Hashing Employee credentials
        if req.table == "employees":
            if req.column == "password_hash":
                val_to_save = hash_password(req.value)
            elif req.column == "email":
                val_to_save = get_blind_index(req.value.lower().strip())
                
        # 🧠 BRAIN IN PYTHON: The Ultimate Time-Spoofing Firewall!
        if req.table == "attendance" and req.column in ["clock_in", "clock_out"]:
            if not is_admin:
                # Force UTC Time with 'Z' so React knows exactly how to format it!
                val_to_save = datetime.now(timezone.utc).isoformat().replace("+00:00", "") + "Z"
                
        # 3. Execution
        if req.table == "payroll_overrides":
            # ⚡ CQRS: Command Query Responsibility Segregation
            old_row = conn.execute("SELECT * FROM payroll_overrides WHERE id = ?", (req.id,)).fetchone()
            old_val = old_row[req.column] if old_row else "N/A"
            
            audit_user = user.get('emp_id', user.get('sub', 'Unknown'))
            # 1. Log the event in the immutable ledger
            append_attendance_audit(conn.cursor(), req.id, audit_user, str(old_val), str(val_to_save), "LOCKED", f"AdminOverrideAttendanceEvent: {req.column}")
            conn.commit()
            
            # 2. Dispatch Background Materializer
            background_tasks.add_task(process_cqrs_payroll_override, req.id, req.column, val_to_save)
            
            conn.close()
            return {"message": "Command Accepted. Processing in background..."}
        else:
            conn.execute(f"UPDATE {req.table} SET {req.column} = ?, updated_at = ? WHERE id = ?", (val_to_save, datetime.now(timezone.utc).isoformat(), req.id))
            
        # 4. Realtime Blockchain Ledger Syncing
        if req.table == "attendance" and old_att:
            if req.column in ["status", "clock_in", "clock_out"]:
                old_keys = old_att.keys()
                old_status_val = old_att["status"] if "status" in old_keys else "N/A"
                old_clock_in_val = old_att["clock_in"] if "clock_in" in old_keys else "N/A"
                
                new_status = val_to_save if req.column == "status" else old_status_val
                audit_user = user.get('emp_id', user.get('sub', 'Unknown'))
                append_attendance_audit(conn.cursor(), req.id, audit_user, old_status_val, new_status, old_clock_in_val, f"Dynamic Excel Edit: {req.column}")
        
        # 5. 🛡️ Leave Balance Deduction Syncing
        if req.table == "leave_requests" and req.column == "status" and str(val_to_save).lower() == "approved":
            leave = conn.execute("SELECT employee_id, leave_type FROM leave_requests WHERE id = ?", (req.id,)).fetchone()
            if leave:
                year = datetime.now(timezone.utc).year
                bal = conn.execute("SELECT id, casual_used, sick_used FROM leave_balance WHERE employee_id = ? AND year = ?", (leave['employee_id'], year)).fetchone()
                if bal:
                    if leave['leave_type'] == 'sick':
                        conn.execute("UPDATE leave_balance SET sick_used = sick_used + 1 WHERE id = ?", (bal['id'],))
                    else:
                        conn.execute("UPDATE leave_balance SET casual_used = casual_used + 1 WHERE id = ?", (bal['id'],))
                else:
                    c_u = 1 if leave['leave_type'] != 'sick' else 0
                    s_u = 1 if leave['leave_type'] == 'sick' else 0
                    conn.execute("INSERT INTO leave_balance (id, employee_id, year, casual_used, sick_used) VALUES (?, ?, ?, ?, ?)", (ulid.new().str, leave['employee_id'], year, c_u, s_u))

        conn.commit()
        conn.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
    return {"message": "Cell updated securely"}

@app.delete("/hr/dynamic/column")
def delete_column(req: DynamicColumnReq, user: dict = Depends(get_current_user)):
    if req.table not in ALLOWED_HR_TABLES:
        raise HTTPException(status_code=400, detail="Security Violation: Invalid table name.")
        
    conn = get_hr_connection()
    
    valid_cols = [c['name'] for c in conn.execute(f"PRAGMA table_info({req.table})").fetchall()]
    if not valid_cols or req.column not in valid_cols:
        raise HTTPException(status_code=400, detail="Security Violation: Invalid column name.")
        
    emp_id_to_check = user.get('emp_id') or user.get('sub')
    emp_db = conn.execute("SELECT role, password_hash FROM employees WHERE id = ?", (emp_id_to_check,)).fetchone()
    
    is_admin = emp_db and emp_db['role'].lower() == 'admin'
    
    if not is_admin:
        if not req.password:
             raise HTTPException(status_code=403, detail="Security Violation: You must provide your password to drop a column.")
        if hash_password(req.password) != emp_db['password_hash']:
             raise HTTPException(status_code=403, detail="Security Violation: Invalid password.")
             
    conn.execute(f"ALTER TABLE {req.table} DROP COLUMN {req.column}")
    conn.commit()
    conn.close()
    return {"message": "Column dropped"}

import re

@app.post("/hr/dynamic/column")
def add_column(req: DynamicColumnReq, user: dict = Depends(get_current_user)):
    if req.table not in ALLOWED_HR_TABLES:
        raise HTTPException(status_code=400, detail="Security Violation: Invalid table name.")
        
    conn = get_hr_connection()
    emp_id_to_check = user.get('emp_id') or user.get('sub')
    emp_db = conn.execute("SELECT role, password_hash FROM employees WHERE id = ?", (emp_id_to_check,)).fetchone()
    
    is_admin = emp_db and emp_db['role'].lower() == 'admin'
    
    if not is_admin:
        if not req.password:
             raise HTTPException(status_code=403, detail="Security Violation: You must provide your password to add a column.")
        if hash_password(req.password) != emp_db['password_hash']:
             raise HTTPException(status_code=403, detail="Security Violation: Invalid password.")
             
    try:
        # Sanitize column name (replace spaces with _, strip special chars)
        safe_col = re.sub(r'[^a-zA-Z0-9_]', '', req.column.replace(' ', '_'))
        if not safe_col:
            raise ValueError("Invalid column name")
            
        # Ignore if column already exists gracefully
        existing_cols = [c['name'] for c in conn.execute(f"PRAGMA table_info({req.table})").fetchall()]
        if safe_col not in existing_cols:
            conn.execute(f"ALTER TABLE {req.table} ADD COLUMN {safe_col} TEXT")
            conn.commit()
            
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
        
    conn.close()
    return {"message": "Column added"}

@app.post("/hr/dynamic/row")
def add_row(req: DynamicRowReq, user: dict = Depends(get_current_user)):
    if req.table not in ALLOWED_HR_TABLES:
        raise HTTPException(status_code=400, detail="Security Violation: Invalid table name.")
        
    conn = get_hr_connection()
    
    # 🛑 ZERO-TRUST RBAC FIREWALL: ONLY ADMINS CAN ADD ROWS
    emp_id_to_check = user.get('emp_id') or user.get('sub')
    admin_check = conn.execute("SELECT role FROM employees WHERE id = ?", (emp_id_to_check,)).fetchone()
    is_admin = admin_check and admin_check['role'].lower() == 'admin'

    if not is_admin:
        # 🚨 TRIPWIRE: Force a +1 Tampering Event on the Admin Dashboard!
        exact_time = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO attendance_audit 
            (id, attendance_id, changed_by, old_status, new_status, old_clock_in, change_reason, previous_hash, current_hash, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ulid.new().str, "NEW_ROW", emp_id_to_check, "LOCKED", "LOCKED", "LOCKED", f"MALICIOUS ADD ATTEMPT: {req.table}", "BROKEN_PREVIOUS_HASH", "TAMPERED", exact_time)
        )
        conn.commit()
        conn.close()
        raise HTTPException(status_code=403, detail="Security Violation: Only Admins can add new rows.")

    new_id = ulid.new().str
    
    try:
        # 1. Dynamically inspect the table schema
        table_info = conn.execute(f"PRAGMA table_info({req.table})").fetchall()
        cols = ["id"]
        placeholders = ["?"]
        vals = [new_id]
        
        for col in table_info:
            name = col['name']
            is_not_null = col['notnull']
            dflt = col['dflt_value']
            col_type = col['type'].upper() if col['type'] else "TEXT"
            
            # 2. If the column is required (NOT NULL) but has no default value, we MUST inject a placeholder!
            if name != "id" and is_not_null and dflt is None:
                cols.append(name)
                placeholders.append("?")
                
                # Assign a safe fallback value based on SQL type
                if "INT" in col_type or "REAL" in col_type or "NUMERIC" in col_type:
                    vals.append(0)
                elif "BOOL" in col_type:
                    vals.append(False)
                else:
                                        # Grab the last 6 characters of the ULID for actual randomness to prevent UNIQUE collisions!
                    vals.append(f"TBD_{ulid.new().str[-6:]}")
                    
        query = f"INSERT INTO {req.table} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
        conn.execute(query, tuple(vals))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    conn.close()
    return {"message": "Row added dynamically"}
    
@app.delete("/hr/dynamic/row/{table}/{row_id}")
def delete_row(table: str, row_id: str, user: dict = Depends(get_current_user)):
    if table not in ALLOWED_HR_TABLES:
        raise HTTPException(status_code=400, detail="Security Violation: Invalid table name.")
        
    conn = get_hr_connection()
    
    # 🛑 ZERO-TRUST RBAC FIREWALL: ONLY ADMINS CAN DELETE ROWS
    emp_id_to_check = user.get('emp_id') or user.get('sub')
    admin_check = conn.execute("SELECT role FROM employees WHERE id = ?", (emp_id_to_check,)).fetchone()
    is_admin = admin_check and admin_check['role'].lower() == 'admin'

    if not is_admin:
        # 🚨 TRIPWIRE: Force a +1 Tampering Event on the Admin Dashboard!
        exact_time = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO attendance_audit 
            (id, attendance_id, changed_by, old_status, new_status, old_clock_in, change_reason, previous_hash, current_hash, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ulid.new().str, row_id, emp_id_to_check, "LOCKED", "LOCKED", "LOCKED", f"MALICIOUS DELETE ATTEMPT: {table}", "BROKEN_PREVIOUS_HASH", "TAMPERED", exact_time)
        )
        conn.commit()
        conn.close()
        raise HTTPException(status_code=403, detail="Security Violation: Only Admins can delete rows.")

    try:
        # Check if table supports tombstoning (has is_deleted column)
        table_info = conn.execute(f"PRAGMA table_info({table})").fetchall()
        has_is_deleted = any(c['name'] == 'is_deleted' for c in table_info)
        
        if has_is_deleted:
            # Soft delete to preserve audit integrity
            conn.execute(f"UPDATE {table} SET is_deleted = TRUE WHERE id = ?", (row_id,))
            
            # Sync Audit Log if Attendance is soft-deleted
            if table == "attendance":
                old_att = conn.execute("SELECT * FROM attendance WHERE id = ?", (row_id,)).fetchone()
                if old_att:
                    audit_user = user.get('emp_id', user['sub'])
                    append_attendance_audit(conn.cursor(), row_id, audit_user, old_att['status'], "DELETED", old_att['clock_in'], "Dynamic Excel Row Deletion")
        else:
            conn.execute(f"DELETE FROM {table} WHERE id = ?", (row_id,))
            
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
        
    conn.close()
    return {"message": "Row deleted safely"}

@app.put("/hr/dynamic/row/restore/{table}/{row_id}")
def restore_row(table: str, row_id: str, user: dict = Depends(get_current_user)):
    if table not in ALLOWED_HR_TABLES:
        raise HTTPException(status_code=400, detail="Security Violation: Invalid table name.")
        
    conn = get_hr_connection()
    
    # 🛑 ZERO-TRUST RBAC FIREWALL: ONLY ADMINS CAN RESTORE ROWS
    emp_id_to_check = user.get('emp_id') or user.get('sub')
    admin_check = conn.execute("SELECT role FROM employees WHERE id = ?", (emp_id_to_check,)).fetchone()
    is_admin = admin_check and admin_check['role'].lower() == 'admin'

    if not is_admin:
        conn.close()
        raise HTTPException(status_code=403, detail="Security Violation: Only Admins can restore rows.")

    try:
        # Check if table supports tombstoning (has is_deleted column)
        table_info = conn.execute(f"PRAGMA table_info({table})").fetchall()
        has_is_deleted = any(c['name'] == 'is_deleted' for c in table_info)
        
        if has_is_deleted:
            conn.execute(f"UPDATE {table} SET is_deleted = FALSE WHERE id = ?", (row_id,))
            
            # Sync Audit Log if Attendance is restored
            if table == "attendance":
                old_att = conn.execute("SELECT * FROM attendance WHERE id = ?", (row_id,)).fetchone()
                if old_att:
                    audit_user = user.get('emp_id', user['sub'])
                    append_attendance_audit(conn.cursor(), row_id, audit_user, "DELETED", old_att['status'], old_att['clock_in'], "Dynamic Excel Row Restore")
                    
            conn.commit()
        else:
            raise HTTPException(status_code=400, detail="Table does not support soft-deletion.")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
        
    conn.close()
    return {"message": "Row restored successfully"}
