from database import get_db_connection
import sqlite3
import hashlib
import sys

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    RESET = '\033[0m'
    CYAN = '\033[96m'
    YELLOW = '\033[93m'

def verify_ledger(region: str):
    print(f"\n{Colors.CYAN}=========================================={Colors.RESET}")
    print(f"{Colors.CYAN} INITIATING SECURITY AUDIT: {region.upper()} SHARD{Colors.RESET}")
    print(f"{Colors.CYAN}=========================================={Colors.RESET}")
    
    conn = get_db_connection(region)
    cursor = conn.cursor()
    
    logs = cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp ASC").fetchall()
    
    if not logs:
        print(f"{Colors.YELLOW}No audit logs found in this shard.{Colors.RESET}")
        return
        
    expected_previous = "GENESIS_BLOCK_00000000"
    compromised = False
    
    for row in logs:
        # Check Chain Integrity
        if row['previous_hash'] != expected_previous:
            print(f"\n{Colors.RED} CRITICAL ALERT: CHAIN BROKEN AT LOG ID {row['id']}! {Colors.RESET}")
            print(f"Expected Previous Hash: {expected_previous[:15]}...")
            print(f"Actual Previous Hash:   {row['previous_hash'][:15]}...")
            compromised = True
            
        # Check Row Integrity (Hash the exact values)
        raw_data = f"{row['previous_hash']}{row['user_id']}{row['action']}{row['endpoint']}{row['timestamp']}".encode()
        calculated_hash = hashlib.sha256(raw_data).hexdigest()
        
        if calculated_hash != row['current_hash']:
            print(f"\n{Colors.RED} CRITICAL ALERT: DATA TAMPERING DETECTED AT LOG ID {row['id']}! {Colors.RESET}")
            print(f"Action: {row['action']} by User {row['user_id'][:8]}...")
            print(f"Calculated Hash: {calculated_hash[:20]}...")
            print(f"Database Hash:   {row['current_hash'][:20]}...")
            compromised = True
            
        if not compromised:
            print(f"{Colors.GREEN}[VALID]{Colors.RESET} Block Verified | Action: {row['action']} | Hash: {row['current_hash'][:15]}...")
        else:
            print(f"{Colors.RED}[INVALID]{Colors.RESET} Block Tainted  | Action: {row['action']} | Hash: {row['current_hash'][:15]}...")
        
        expected_previous = row['current_hash']
        
    conn.close()
    
    if not compromised:
        print(f"\n{Colors.GREEN} SYSTEM AUDIT PASSED: {region.upper()} SHARD IS 100% SECURE AND IMMUTABLE.{Colors.RESET}")
    else:
        print(f"\n{Colors.RED} SYSTEM AUDIT FAILED: {region.upper()} SHARD HAS BEEN COMPROMISED!{Colors.RESET}")

if __name__ == "__main__":
    verify_ledger("north")
    verify_ledger("south")
