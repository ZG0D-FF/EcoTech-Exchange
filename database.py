import sqlite3

def init_db():
    conn = sqlite3.connect('ecotech.db')
    cursor = conn.cursor()
    
    # Create a Users table with ULID, Sync metadata, and password_hash
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_deleted BOOLEAN DEFAULT 0
        )
    ''')
    
    # Create an Equipment table with ULID and Sync metadata
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipment (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL, 
            price REAL, 
            rental_price_per_day REAL,
            is_for_sale BOOLEAN NOT NULL,
            condition TEXT NOT NULL, 
            seller_id TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY(seller_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("Database initialized successfully! ecotech.db file created with distributed sync and Auth architecture.")

if __name__ == "__main__":
    init_db()
