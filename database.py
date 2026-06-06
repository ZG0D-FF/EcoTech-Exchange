import sqlite3
import os

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    pass

class PostgresCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor
        
    def execute(self, query, params=()):
        # Magic string translation for PostgreSQL!
        # Automatically converts SQLite '?' syntax into PostgreSQL '%s' syntax.
        pg_query = query.replace('?', '%s')
        self.cursor.execute(pg_query, params)
        return self

    def fetchone(self):
        res = self.cursor.fetchone()
        return dict(res) if res else None

    def fetchall(self):
        res = self.cursor.fetchall()
        return [dict(r) for r in res]

class PostgresConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn
        self.row_factory = None
        
    def cursor(self):
        cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        return PostgresCursorWrapper(cursor)
        
    def execute(self, query, params=()):
        cursor = self.cursor()
        cursor.execute(query, params)
        return cursor
        
    def commit(self):
        self.conn.commit()
        
    def close(self):
        self.conn.close()

def get_db_connection(region: str):
    """
    Multi-Cloud Database Router: Dynamically routes connections to Local SQLite, Turso, or Supabase.
    """
    region = region.lower()
    app_env = os.getenv("APP_ENV", "development")
    
    # 1. Prevent Localhost from crashing Production: Read the environment variable securely
    if app_env == "production":
        db_url = os.getenv(f"{region.upper()}_DB_URL", "")
    else:
        # In development, use DEV_ URLs or fallback to local SQLite automatically!
        db_url = os.getenv(f"DEV_{region.upper()}_DB_URL", "")
    
    # 2. SUPABASE (PostgreSQL) ROUTER
    if db_url.startswith("postgres"):
        conn = psycopg2.connect(db_url)
        return PostgresConnectionWrapper(conn)
        
    # 3. TURSO (Cloud Edge SQLite) ROUTER
    if db_url.startswith("libsql"):
        try:
            import libsql_experimental as libsql
            auth_token = os.getenv("TURSO_AUTH_TOKEN", "")
            conn = libsql.connect(db_url, auth_token=auth_token)
            conn.row_factory = sqlite3.Row
            return conn
        except ImportError:
            print("WARNING: Turso SDK not installed. Falling back to local DB.")
            
    # 4. LOCAL SQLITE FALLBACK
    db_name = f'ecotech_{region}.db'
    conn = sqlite3.connect(db_name)
    conn.row_factory = sqlite3.Row
    
    # Auto-migrate missing tables for local dev
    try:
        conn.execute('''
        CREATE TABLE IF NOT EXISTS cart_items (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            equipment_id TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_deleted BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (equipment_id) REFERENCES equipment (id)
        )
        ''')
        conn.execute('''
        CREATE TABLE IF NOT EXISTS payroll_overrides (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            month TEXT NOT NULL,
            present_override INTEGER,
            absent_override INTEGER,
            rate_override REAL,
            deduction_override REAL,
            UNIQUE(employee_id, month)
        )
        ''')
        conn.commit()
    except:
        pass
        
    return conn

def get_hr_connection():
    """Returns a direct connection to the centralized HR database, supporting local SQLite and Turso."""
    app_env = os.getenv("APP_ENV", "development")
    
    if app_env == "production":
        db_url = os.getenv("HR_DB_URL", "")
    else:
        db_url = os.getenv("DEV_HR_DB_URL", "")
        
    # TURSO (Cloud Edge SQLite) ROUTER
    if db_url.startswith("libsql"):
        try:
            import libsql_experimental as libsql
            auth_token = os.getenv("TURSO_AUTH_TOKEN", "")
            conn = libsql.connect(db_url, auth_token=auth_token)
            conn.row_factory = sqlite3.Row
            return conn
        except ImportError:
            print("WARNING: Turso SDK not installed. Falling back to local DB.")
            
    # LOCAL SQLITE FALLBACK
    conn = sqlite3.connect('ecotech_hr.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_shard(region: str):
    conn = get_db_connection(region)
    cursor = conn.cursor()

    # Users Table (Using TEXT for ULIDs)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        encrypted_email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        region TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
    )
    ''')

    # Audit Logs (Cryptographic Ledger Simulation)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        previous_hash TEXT,
        current_hash TEXT NOT NULL
    )
    ''')

    # Equipment Table (Using TEXT for ULIDs)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS equipment (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        price REAL,
        rental_price_per_day REAL,
        is_for_sale BOOLEAN NOT NULL,
        condition TEXT,
        seller_id TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (seller_id) REFERENCES users (id)
    )
    ''')

    # Cart Table (Requisition Queue)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS cart_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        equipment_id TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (equipment_id) REFERENCES equipment (id)
    )
    ''')

    # Global Error Logs (Referee Worker)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS error_logs (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        stack_trace TEXT,
        url TEXT,
        user_agent TEXT,
        region TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()
    conn.close()
    print(f"[{region.upper()}] Shard initialized successfully!")

def init_hr_db():
    conn = sqlite3.connect('ecotech_hr.db')
    cursor = conn.cursor()

    # Employees Table (Independent Identity)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        encrypted_email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        region TEXT NOT NULL,
        department TEXT,
        designation TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Attendance (Event Sourced Base)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        date TEXT NOT NULL,
        clock_in TIMESTAMP,
        clock_out TIMESTAMP,
        status TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (employee_id) REFERENCES employees (id)
    )
    ''')

    # Attendance Audit (Immutable Blockchain)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS attendance_audit (
        id TEXT PRIMARY KEY,
        attendance_id TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        old_clock_in TIMESTAMP,
        change_reason TEXT NOT NULL,
        previous_hash TEXT,
        current_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attendance_id) REFERENCES attendance (id),
        FOREIGN KEY (changed_by) REFERENCES employees (id)
    )
    ''')

    # Leave Requests
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        leave_type TEXT NOT NULL,
        from_date TEXT NOT NULL,
        to_date TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        FOREIGN KEY (reviewed_by) REFERENCES employees (id)
    )
    ''')

    # Leave Balance
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS leave_balance (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        casual_total INTEGER DEFAULT 12,
        casual_used INTEGER DEFAULT 0,
        sick_total INTEGER DEFAULT 10,
        sick_used INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        UNIQUE(employee_id, year)
    )
    ''')

    # Messages (1-to-1 Encrypted)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES employees (id),
        FOREIGN KEY (receiver_id) REFERENCES employees (id)
    )
    ''')

    # Conversation Keys (For DB-Backed E2EE Persistence)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS conversation_keys (
        id TEXT PRIMARY KEY,
        user_a_id TEXT NOT NULL,
        user_b_id TEXT NOT NULL,
        key_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_a_id) REFERENCES employees (id),
        FOREIGN KEY (user_b_id) REFERENCES employees (id),
        UNIQUE(user_a_id, user_b_id)
    )
    ''')

    # Payroll Overrides
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS payroll_overrides (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        month TEXT NOT NULL,
        present_override INTEGER,
        absent_override INTEGER,
        rate_override REAL,
        deduction_override REAL,
        UNIQUE(employee_id, month)
    )
    ''')

    conn.commit()
    conn.close()
    print("HR Database initialized successfully!")

if __name__ == "__main__":
    print("Initializing Logical Sharding Architecture...")
    from dotenv import load_dotenv
    load_dotenv()
    
    init_hr_db()
    init_shard('north')
    init_shard('south')
    init_shard('east')
    init_shard('west')
    print("All shards are ready.")
