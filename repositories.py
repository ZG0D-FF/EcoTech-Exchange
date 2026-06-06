from database import get_db_connection
from datetime import datetime, timezone
import logging

class EquipmentRepository:
    """
    Data Access Object (DAO) for the Equipment table.
    This safely abstracts regional database sharding away from the business logic.
    Works seamlessly on Local SQLite, Render Postgres, and Turso via get_db_connection.
    """
    
    @staticmethod
    def get(equipment_id: str, region: str):
        conn = get_db_connection(region)
        try:
            row = conn.execute("SELECT * FROM equipment WHERE id = ?", (equipment_id,)).fetchone()
            return dict(row) if row else None
        except Exception as e:
            logging.error(f"EquipmentRepository GET error: {e}")
            return None
        finally:
            if hasattr(conn, 'close'):
                conn.close()

    @staticmethod
    def update(equipment_id: str, column: str, value, region: str):
        conn = get_db_connection(region)
        try:
            # Zero-Trust Validation
            # Since this repo handles multi-cloud, we explicitly whitelist allowed columns
            # instead of relying on PRAGMA (which varies between SQLite and PostgreSQL)
            allowed_cols = ["price", "description", "condition", "is_for_sale", "title", "category"]
            if column not in allowed_cols:
                raise ValueError(f"Security Violation: Invalid equipment column '{column}'")
                
            updated_at = datetime.now(timezone.utc).isoformat()
            conn.execute(f"UPDATE equipment SET {column} = ?, updated_at = ? WHERE id = ?", (value, updated_at, equipment_id))
            conn.commit()
        except Exception as e:
            logging.error(f"EquipmentRepository UPDATE error: {e}")
            raise e
        finally:
            if hasattr(conn, 'close'):
                conn.close()
