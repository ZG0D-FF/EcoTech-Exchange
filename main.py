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

app = FastAPI(title="EcoTech Exchange API (Enterprise System Design Edition)")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
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
def get_db_connection(region: str):
    """
    Sharding Router: Connects to the appropriate database shard based on the user's region.
    """
    region = region.lower()
    if region == "north":
        conn = sqlite3.connect('ecotech_north.db')
    elif region == "south":
        conn = sqlite3.connect('ecotech_south.db')
    else:
        raise HTTPException(status_code=400, detail="Invalid region. Must be 'North' or 'South'")
    
    conn.row_factory = sqlite3.Row
    return conn

# --- SLIC FAST: CACHE (In-Memory Redis Simulation) ---
# We store the latest equipment catalog in memory to prevent hitting the DB on every read.
cache_store = {
    "equipment_data": None,
    "last_updated": 0
}
CACHE_TTL_SECONDS = 60 

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
@app.post("/register")
def register_user(user: UserRegister, background_tasks: BackgroundTasks):
    conn = get_db_connection(user.region)
    cursor = conn.cursor()
    
    existing = cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_id = ulid.new().str
    hashed_password = hash_password(user.password)
    current_time = datetime.now(timezone.utc).isoformat()
    
    cursor.execute(
        "INSERT INTO users (id, name, email, password_hash, region, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (new_id, user.name, user.email, hashed_password, user.region.lower(), current_time)
    )
    conn.commit()
    conn.close()
    
    # ⚡ Dispatch Background Task
    background_tasks.add_task(send_registration_email_in_background, user.email)
    
    return {"message": "User registered successfully", "id": new_id, "shard": f"ecotech_{user.region.lower()}.db"}

@app.post("/login")
def login_user(user: UserLogin):
    conn = get_db_connection(user.region)
    cursor = conn.cursor()
    db_user = cursor.execute("SELECT * FROM users WHERE email = ? AND is_deleted = 0", (user.email,)).fetchone()
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
def get_all_equipment(x_region: str = Header(default="north")):
    """
    Uses an In-Memory Cache. If cache is less than 60s old, return cache.
    Otherwise, query the database shard.
    """
    global cache_store
    current_time = time.time()
    
    # Cache Hit Validation
    if cache_store["equipment_data"] and (current_time - cache_store["last_updated"]) < CACHE_TTL_SECONDS:
        print("[CACHE] HIT! Returning blazing fast data from memory.")
        return {"source": "cache", "equipment": cache_store["equipment_data"]}
        
    print("[CACHE] MISS! Querying the database shard...")
    
    conn = get_db_connection(x_region)
    equipment = conn.execute("SELECT * FROM equipment WHERE is_deleted = 0").fetchall()
    conn.close()
    
    results = [dict(e) for e in equipment]
    
    # Store in Cache
    cache_store["equipment_data"] = results
    cache_store["last_updated"] = current_time
    
    return {"source": "database", "equipment": results}

@app.post("/equipment")
def create_equipment(item: EquipmentCreate, background_tasks: BackgroundTasks, x_region: str = Header(default="north")):
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
    conn.commit()
    conn.close()
    
    # ⚡ Invalidate the cache because new data was added!
    global cache_store
    cache_store["equipment_data"] = None 
    
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
