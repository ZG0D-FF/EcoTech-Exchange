from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
import ulid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

app = FastAPI(title="EcoTech Exchange API (Auth & PWA Sync Enabled)")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTH CONFIGURATION ---
SECRET_KEY = "super_secret_key_for_development_only"
ALGORITHM = "HS256"

# Helper functions for pure bcrypt (Bypassing passlib bugs)
def hash_password(password: str) -> str:
    # bcrypt requires bytes, so we encode the string to utf-8
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_bytes.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- PYDANTIC MODELS ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class EquipmentCreate(BaseModel):
    title: str
    description: str = ""
    category: str
    price: Optional[float] = None
    rental_price_per_day: Optional[float] = None
    is_for_sale: bool
    condition: str
    seller_id: str

def get_db_connection():
    conn = sqlite3.connect('ecotech.db')
    conn.row_factory = sqlite3.Row
    return conn

# --- AUTH ENDPOINTS ---
@app.post("/register")
def register_user(user: UserRegister):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    existing = cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_id = ulid.new().str
    hashed_password = hash_password(user.password)
    current_time = datetime.now(timezone.utc).isoformat()
    
    cursor.execute(
        "INSERT INTO users (id, name, email, password_hash, updated_at) VALUES (?, ?, ?, ?, ?)",
        (new_id, user.name, user.email, hashed_password, current_time)
    )
    conn.commit()
    conn.close()
    return {"message": "User registered successfully", "id": new_id}

@app.post("/login")
def login_user(user: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    db_user = cursor.execute("SELECT * FROM users WHERE email = ? AND is_deleted = 0", (user.email,)).fetchone()
    conn.close()
    
    if not db_user or not verify_password(user.password, db_user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # Generate JWT Token
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode = {"sub": db_user['id'], "exp": expire}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return {"access_token": token, "token_type": "bearer", "user_id": db_user['id']}

# --- EQUIPMENT & SYNC ENDPOINTS ---
@app.get("/")
def read_root():
    return {"message": "Welcome to EcoTech Exchange! Auth & Sync Architecture active."}

@app.get("/equipment")
def get_all_equipment(for_rent: Optional[bool] = None, for_sale: Optional[bool] = None):
    conn = get_db_connection()
    query = "SELECT * FROM equipment WHERE is_deleted = 0"
    if for_rent:
        query += " AND rental_price_per_day IS NOT NULL"
    if for_sale:
        query += " AND is_for_sale = 1"
    equipment = conn.execute(query).fetchall()
    conn.close()
    return {"equipment": [dict(e) for e in equipment]}

@app.post("/equipment")
def create_equipment(item: EquipmentCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    new_id = ulid.new().str
    current_time = datetime.now(timezone.utc).isoformat()
    
    cursor.execute(
        """
        INSERT INTO equipment 
        (id, title, description, category, price, rental_price_per_day, is_for_sale, condition, seller_id, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id, item.title, item.description, item.category, item.price, item.rental_price_per_day, item.is_for_sale, item.condition, item.seller_id, current_time)
    )
    conn.commit()
    conn.close()
    return {"message": "Equipment listed successfully!", "id": new_id, "updated_at": current_time}

@app.delete("/equipment/{equipment_id}")
def delete_equipment(equipment_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    current_time = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        "UPDATE equipment SET is_deleted = 1, updated_at = ? WHERE id = ?",
        (current_time, equipment_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Equipment soft deleted successfully.", "id": equipment_id}

@app.get("/sync/equipment")
def sync_equipment(last_synced_at: str):
    conn = get_db_connection()
    query = "SELECT * FROM equipment WHERE updated_at > ?"
    equipment = conn.execute(query, (last_synced_at,)).fetchall()
    conn.close()
    return {"mutations": [dict(e) for e in equipment]}
