import sqlite3

def init_shard(db_name: str):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Users Table (Using TEXT for ULIDs)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        region TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT 0
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
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (seller_id) REFERENCES users (id)
    )
    ''')

    conn.commit()
    conn.close()
    print(f"[{db_name}] Shard initialized successfully!")

if __name__ == "__main__":
    print("Initializing Logical Sharding Architecture...")
    init_shard('ecotech_north.db')
    init_shard('ecotech_south.db')
    print("All shards are ready.")
