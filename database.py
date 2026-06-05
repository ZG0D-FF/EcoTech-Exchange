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
    
    # 1. Read the environment variable for the requested region
    db_url = os.getenv(f"{region.upper()}_DB_URL", "")
    
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

    conn.commit()
    conn.close()
    print(f"[{region.upper()}] Shard initialized successfully!")

if __name__ == "__main__":
    print("Initializing Logical Sharding Architecture...")
    from dotenv import load_dotenv
    load_dotenv()
    
    init_shard('north')
    init_shard('south')
    print("All shards are ready.")
