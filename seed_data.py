import urllib.request
import urllib.error
import json
import random

BASE_URL = "http://127.0.0.1:8000"

users = [
    {"name": "Alice Engineer", "email": "alice@test.com", "password": "password123", "region": "North"},
    {"name": "Bob Maker", "email": "bob@test.com", "password": "password123", "region": "South"},
    {"name": "Charlie Hacker", "email": "charlie@test.com", "password": "password123", "region": "North"}
]

equipment_templates = [
    {"title": "Tektronix Oscilloscope", "description": "100MHz 2-Channel. Barely used.", "category": "Test Equipment", "price": 250.00, "rental_price_per_day": 15.00, "is_for_sale": True, "condition": "Like New"},
    {"title": "Prusa i3 MK3S+ 3D Printer", "description": "Fully assembled, prints perfectly. Comes with 2 spools of PLA.", "category": "3D Printing", "price": 600.00, "rental_price_per_day": 30.00, "is_for_sale": True, "condition": "Good"},
    {"title": "Raspberry Pi 4 (8GB)", "description": "Comes with case and power supply.", "category": "Microcontrollers", "price": 85.00, "rental_price_per_day": 5.00, "is_for_sale": True, "condition": "Used"},
    {"title": "Fluke 87V Multimeter", "description": "Industry standard true-RMS multimeter.", "category": "Test Equipment", "price": 350.00, "rental_price_per_day": 20.00, "is_for_sale": False, "condition": "Excellent"},
    {"title": "Arduino Uno R3 (Bulk of 10)", "description": "Perfect for a classroom or lab.", "category": "Microcontrollers", "price": 100.00, "rental_price_per_day": 0.00, "is_for_sale": True, "condition": "New"}
]

def make_request(endpoint, method="POST", data=None, headers=None):
    url = f"{BASE_URL}{endpoint}"
    if headers is None:
        headers = {}
    headers['Content-Type'] = 'application/json'
    
    req_data = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode()}")
        return None

print("Seeding Database...")

for user in users:
    print(f"Creating user: {user['name']}...")
    res = make_request("/register", data=user)
    
    if res and "id" in res:
        # Log them in to get the JWT token
        login_data = {"email": user["email"], "password": user["password"], "region": user["region"]}
        login_res = make_request("/login", data=login_data)
        
        if login_res and "access_token" in login_res:
            token = login_res["access_token"]
            
            # Create 1 or 2 random pieces of equipment for this user
            num_items = random.randint(1, 2)
            for _ in range(num_items):
                item = random.choice(equipment_templates).copy()
                item["seller_id"] = login_res["user_id"]
                
                print(f"  -> Adding equipment: {item['title']}")
                make_request("/equipment", data=item, headers={"Authorization": f"Bearer {token}", "x-region": user["region"]})

print("Seeding Complete! Go check your React Dashboard!")
