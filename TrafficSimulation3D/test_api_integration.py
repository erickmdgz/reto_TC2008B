#!/usr/bin/env python
# Script de prueba para verificar la integración con el API

import requests
import json
import time

# Configuración
API_TRAFFIC_URL = "http://localhost:8585"
API_COMPETITION_URL = "http://10.49.12.39:5000/api/"

print("=" * 60)
print("Script de Prueba - Integración API")
print("=" * 60)

# Paso 1: Inicializar el modelo con API habilitado
print("\n1. Inicializando modelo con API habilitado...")
init_data = {
    "spawn_interval": 3,
    "enable_api": True,
    "api_url": API_COMPETITION_URL,
    "team_year": 2024,
    "team_classroom": 301,
    "team_name": "Equipo Test"
}

try:
    response = requests.post(f"{API_TRAFFIC_URL}/init", json=init_data)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"   Error: {e}")
    print("\n⚠️  Asegúrate de que el servidor Flask esté corriendo en el puerto 8585")
    print("   Ejecuta: python server.py")
    exit(1)

# Paso 2: Ejecutar varios steps
print("\n2. Ejecutando 15 steps de la simulación...")
print("   (Debería enviar datos al API en los steps 5, 10 y 15)")
for i in range(15):
    try:
        response = requests.get(f"{API_TRAFFIC_URL}/update")
        data = response.json()
        print(f"   Step {i+1}: {data['message']}")
        time.sleep(0.3)
    except Exception as e:
        print(f"   Error en step {i+1}: {e}")

# Paso 3: Obtener estado actual
print("\n3. Obteniendo estado actual de los coches...")
try:
    response = requests.get(f"{API_TRAFFIC_URL}/getCars")
    data = response.json()
    print(f"   Coches activos: {len(data['positions'])}")
    if len(data['positions']) > 0:
        print(f"   Ejemplo - Primer coche: {data['positions'][0]}")
except Exception as e:
    print(f"   Error: {e}")

print("\n" + "=" * 60)
print("Prueba completada!")
print("=" * 60)
print("\n📝 Notas:")
print("   - Verifica la consola del servidor Flask para ver los mensajes del API")
print("   - Los datos se envían cada 5 steps (steps 5, 10, 15, etc.)")
print("   - Para probar con el API de competencia real, asegúrate de que")
print("     el servidor Node.js esté corriendo en el puerto 5000")
