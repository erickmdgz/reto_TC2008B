#!/usr/bin/env python
# Script simple de prueba del modelo sin servidor

import sys
sys.path.insert(0, '.')

from traffic_simulation.model import CityModel

print("=" * 60)
print("Prueba Simple del Modelo")
print("=" * 60)

# Crear modelo con API deshabilitado
print("\n1. Creando modelo con API deshabilitado...")
model = CityModel(
    spawn_interval=3,
    enable_api=False  # API deshabilitado por defecto
)
print(f"   ✓ Modelo creado - Spawn interval: {model.spawn_interval}")

# Ejecutar algunos steps
print("\n2. Ejecutando 10 steps de la simulación...")
for i in range(10):
    model.step()
    print(f"   Step {model.steps_count}: Cars={len(model.cars)}, Arrived={model.cars_reached_destination}")

print("\n3. Creando modelo con API habilitado (simulación)...")
model2 = CityModel(
    spawn_interval=3,
    enable_api=True,  # Habilitado pero fallará si no hay servidor
    api_url="http://10.49.12.39:5000/api/",
    team_year=2024,
    team_classroom=301,
    team_name="Equipo Test"
)
print(f"   ✓ Modelo creado con API configurado")
print(f"   - URL: {model2.api_url}")
print(f"   - Team: {model2.team_name} ({model2.team_year}/{model2.team_classroom})")

print("\n4. Ejecutando 5 steps (debería intentar enviar en step 5)...")
print("   (Nota: Fallará la conexión si el servidor no está corriendo)")
for i in range(5):
    model2.step()
    print(f"   Step {model2.steps_count}: Cars={len(model2.cars)}, Arrived={model2.cars_reached_destination}")

print("\n" + "=" * 60)
print("✅ Prueba completada!")
print("=" * 60)
print("\n📝 La implementación está lista. Los datos incluyen:")
print("   - year: Año del equipo")
print("   - classroom: Salón del equipo")
print("   - name: Nombre del equipo")
print("   - current_cars: Cantidad de coches actuales en la simulación")
print("   - total_arrived: Total de coches que llegaron a destino")
print("\n📍 Nota sobre attempt_number:")
print("   Según tus instrucciones, attempt_number debe ser la frecuencia")
print("   con la que aparecen coches (spawn_interval).")
print("   Actualmente esto es el valor de spawn_interval del modelo.")
