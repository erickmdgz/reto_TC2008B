#!/usr/bin/env python
# Test del endpoint de API de competencia

import requests
import json

API_URL = "http://10.49.12.39:5000/api/"

print("Probando endpoints de competencia...")
print()

# Datos de prueba
data = {
    "year": 2025,
    "classroom": 301,
    "name": "Don July Seventy",
    "current_cars": 5,
    "total_arrived": 2
}

print("Datos a enviar:")
print(json.dumps(data, indent=2))
print()

# Verificar tipos
print("Tipos de datos:")
for key, value in data.items():
    print(f"  {key}: {type(value).__name__} = {value}")
print()

headers = {
    "Content-Type": "application/json"
}

# Probar ambos endpoints
for endpoint in ["validate_attempt", "attempt"]:
    print(f"=== Probando: {endpoint} ===")
    print(f"URL: {API_URL}{endpoint}")

    try:
        response = requests.post(
            API_URL + endpoint,
            json=data,
            headers=headers,
            timeout=5
        )

        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")

        if response.status_code == 200:
            print("Exito! El endpoint acepta los datos")
        else:
            print("Error: El endpoint rechaza los datos")

    except requests.exceptions.ConnectionError:
        print("Error: No se puede conectar al servidor")
        print(f"Verifica que el servidor esté corriendo en {API_URL}")
    except Exception as e:
        print(f"Error: {e}")

    print()
