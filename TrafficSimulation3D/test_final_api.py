#!/usr/bin/env python
# Test final del API con attempt_number

import requests
import json

API_URL = "http://10.49.12.39:5000/api/attempt"

data = {
    "year": 2025,
    "classroom": 301,
    "name": "Don July Seventy",
    "current_cars": 5,
    "total_arrived": 2,
    "attempt_number": 10
}

print("Test final - Endpoint: attempt")
print(f"URL: {API_URL}")
print()

print("Datos a enviar:")
print(json.dumps(data, indent=2))
print()

print("Tipos de datos:")
for key, value in data.items():
    print(f"  {key}: {type(value).__name__} = {value}")
print()

headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(
        API_URL,
        json=data,
        headers=headers,
        timeout=5
    )

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    if response.status_code == 200:
        print("\nExito! Los datos se enviaron correctamente")
    else:
        print("\nError: El endpoint rechaza los datos")

except requests.exceptions.ConnectionError:
    print("Error: No se puede conectar al servidor")
    print(f"Verifica que el servidor este corriendo en http://10.49.12.39:5000")
except Exception as e:
    print(f"Error: {e}")
