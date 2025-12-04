#!/usr/bin/env python
import requests
import json

API_URL = "http://10.49.12.39:5000/api/validate_attempt"

data = {
    "year": 2025,
    "classroom": 301,
    "name": "Don July Seventy",
    "current_cars": 5,
    "total_arrived": 2
}

print("Enviando request...")
print(f"Data: {json.dumps(data)}")

response = requests.post(
    API_URL,
    json=data,
    timeout=5
)

print(f"\nResponse status: {response.status_code}")
print(f"Response headers: {dict(response.headers)}")
print(f"Response body: {response.text}")

# Ver qué está recibiendo el servidor
print("\n--- Verificando request ---")
print(f"Content-Type enviado: application/json")
print(f"Body enviado: {json.dumps(data)}")
