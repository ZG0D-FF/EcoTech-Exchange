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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
from database import get_db_connection

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
# In production, this would be an env variable in a Key Management Service (KMS)
ENCRYPTION_KEY = Fernet.generate_key()
fernet = Fernet(ENCRYPTION_KEY)

def encrypt_pii(data: str) -> str:
    return fernet.encrypt(data.encode()).decode()

def decrypt_pii(token: str) -> str:
    try:
        return fernet.decrypt(token.encode()).decode()
    except:
        return token

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

# --- PYDANTIC MODELS ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    region: str # Required for Sharding

class UserLogin(BaseModel):
    email: str
    password: str
    region: str # Required for Sharding

class GoogleToken(BaseModel):
    token: str

class EquipmentCreate(BaseModel):
    title: str
    description: str = ""
    category: str
    price: Optional[float] = None
    rental_price_per_day: Optional[float] = None
    is_for_sale: bool
    condition: str
    seller_id: str

# --- AUTH ENDPOINTS ---
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "279406375654-e0cegh0bmm9he2dcalovns8ulf44s1ns.apps.googleusercontent.com")

@app.post("/auth/google")
def google_auth(data: GoogleToken):
    try:
        idinfo = id_token.verify_oauth2_token(data.token, google_requests.Request(), CLIENT_ID)
        email = idinfo['email']
        name = idinfo.get('name', 'Google User')
        
        # 1. Blind Index Lookup
        blind_email = get_blind_index(email.lower().strip())
        
        # We default Google users to the North shard for this portfolio (or could ask them on first login)
        region = 'north'
        conn = get_db_connection(region)
        cursor = conn.cursor()
        
        user = cursor.execute("SELECT id FROM users WHERE email = ?", (blind_email,)).fetchone()
        
        if not user:
            # Create user if they don't exist
            new_id = ulid.new().str
            # Generate random password hash since they use SSO
            random_pw = hash_password(ulid.new().str)
            current_time = datetime.now(timezone.utc).isoformat()
            
            encrypted_name = encrypt_pii(name)
            encrypted_email = encrypt_pii(email.lower().strip())
            
            cursor.execute(
                "INSERT INTO users (id, name, email, encrypted_email, password_hash, region, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (new_id, encrypted_name, blind_email, encrypted_email, random_pw, region, current_time)
            )
            append_to_ledger(conn, new_id, "REGISTER_USER_GOOGLE_SSO", "/auth/google")
            user_id = new_id
        else:
            user_id = user['id']
            
        append_to_ledger(conn, user_id, "LOGIN_GOOGLE_SSO", "/auth/google")
        conn.close()
        
        # Issue our own JWT!
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
        payload = {"sub": user_id, "exp": expire, "region": region}
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        return {"access_token": token, "token_type": "bearer", "user_id": user_id, "shard_region": region}
    except ValueError as ve:
        raise HTTPException(status_code=401, detail=f"Invalid Google Token: {str(ve)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@app.post("/register")
def register_user(user: UserRegister, background_tasks: BackgroundTasks):
    conn = get_db_connection(user.region)
    cursor = conn.cursor()
    
    # 🛡️ Blinded Index for Email Lookups
    blind_email = get_blind_index(user.email.lower().strip())
    
    existing = cursor.execute("SELECT id FROM users WHERE email = ?", (blind_email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_id = ulid.new().str
    hashed_password = hash_password(user.password)
    current_time = datetime.now(timezone.utc).isoformat()
    
    # 🛡️ Cell-Level Encryption for PII
    encrypted_name = encrypt_pii(user.name)
    encrypted_email = encrypt_pii(user.email.lower().strip())
    
    cursor.execute(
        "INSERT INTO users (id, name, email, encrypted_email, password_hash, region, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (new_id, encrypted_name, blind_email, encrypted_email, hashed_password, user.region.lower(), current_time)
    )
    
    # 🔒 Cryptographic Ledger Append
    append_to_ledger(conn, new_id, "REGISTER_USER", "/register")
    conn.close()
    
    # ⚡ Dispatch Background Task
    background_tasks.add_task(send_registration_email_in_background, user.email)
    
    return {"message": "User registered successfully", "id": new_id, "shard": f"ecotech_{user.region.lower()}.db"}

@app.post("/login")
def login_user(user: UserLogin):
    conn = get_db_connection(user.region)
    cursor = conn.cursor()
    
    # 🛡️ Blinded Index Lookup
    blind_email = get_blind_index(user.email.lower().strip())
    
    db_user = cursor.execute("SELECT * FROM users WHERE email = ? AND is_deleted = FALSE", (blind_email,)).fetchone()
    
    if db_user:
        append_to_ledger(conn, db_user['id'], "LOGIN_USER", "/login")
        
    conn.close()
    
    if not db_user or not verify_password(user.password, db_user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials or region")
        
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode = {"sub": db_user['id'], "exp": expire, "region": db_user['region']}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return {"access_token": token, "token_type": "bearer", "user_id": db_user['id'], "shard_region": db_user['region']}

# --- EQUIPMENT & SYNC ENDPOINTS ---
@app.get("/")
def read_root():
    return {"message": "EcoTech Exchange API: SLIC FAST Architecture Active!"}

@app.get("/equipment")
async def get_all_equipment(x_region: str = Header(default="north")):
    """
    Uses an In-Memory Cache with Mutex Locking for Stampede Mitigation.
    """
    global cache_store
    current_time = time.time()
    
    # 1. Fast Cache Hit Validation
    if cache_store["equipment_data"] is not None and (current_time - cache_store["last_updated"]) < CACHE_TTL_SECONDS:
        print("[CACHE] HIT! Returning blazing fast data from memory.")
        return {"source": "cache", "version": cache_store["version"], "equipment": cache_store["equipment_data"]}
        
    print("[CACHE] MISS! Attempting to acquire Mutex Lock...")
    
    # 2. Phase 7: Cache Stampede Mitigation (Locking / Mutex)
    async with cache_lock:
        # Double-check locking (another request might have populated it while we waited)
        if cache_store["equipment_data"] is not None and (time.time() - cache_store["last_updated"]) < CACHE_TTL_SECONDS:
            print("[CACHE] STAMPEDE PREVENTED! Returning fresh data fetched by another request.")
            return {"source": "cache", "version": cache_store["version"], "equipment": cache_store["equipment_data"]}

        print("[DATABASE] Mutex Acquired. Querying the shard...")
        conn = get_db_connection(x_region)
        equipment = conn.execute("SELECT * FROM equipment WHERE is_deleted = FALSE").fetchall()
        conn.close()
        
        results = [dict(e) for e in equipment]
        
        # Store in Cache
        cache_store["equipment_data"] = results
        cache_store["last_updated"] = time.time()
        
        return {"source": "database", "version": cache_store["version"], "equipment": results}

@app.post("/equipment")
def create_equipment(item: EquipmentCreate, background_tasks: BackgroundTasks, x_region: str = Header(default="north"), user: dict = Depends(get_current_user)):
    
    # 🛡️ Authorization BOLA check (Broken Object Level Authorization)
    if item.seller_id != user['sub']:
        raise HTTPException(status_code=403, detail="BOLA Protection: You cannot create listings for other users.")
    conn = get_db_connection(x_region)
    cursor = conn.cursor()
    new_id = ulid.new().str
    current_time_iso = datetime.now(timezone.utc).isoformat()
    
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
    
    item = cursor.execute("SELECT seller_id FROM equipment WHERE id = ?", (item_id,)).fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")
        
    # 🛡️ Row-Level Security: Only the actual owner can delete this row
    if item['seller_id'] != user['sub']:
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
