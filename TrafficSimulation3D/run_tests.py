#!/usr/bin/env python3
"""
Script de testing automatizado para simulacion de trafico.
Ejecuta todas las combinaciones de parametros y exporta resultados a CSV.

Uso: python run_tests.py
"""

import os
import sys
from itertools import product
from traffic_simulation.model import CityModel

# Configuracion
MAX_STEPS = 4000
TARGET_EFFICIENCY = 0.85  # 85% de coches lleguen a destino
OUTPUT_DIR = "test_results"
SEED = 42

# Valores de parametros
SPAWN_INTERVALS = [1, 3, 5, 7]
PROB_VALUES = [0, 0.35, 0.7]  # bajo, medio, alto


def run_scenario(name, params, max_steps=MAX_STEPS, target_efficiency=TARGET_EFFICIENCY):
    """
    Ejecuta un escenario con los parametros dados.
    Termina cuando:
    - Se alcanzan max_steps (4000)
    - El 85% de los coches spawneados llegaron a destino
    - El modelo deja de correr
    Retorna el DataFrame con las metricas recolectadas.
    """
    print(f"  Ejecutando: {name}...", end=" ", flush=True)

    model = CityModel(seed=SEED, **params)

    for step in range(max_steps):
        if not model.running:
            break
        model.step()

        # Verificar si alcanzamos el 85% de eficiencia
        if model.cars_spawned > 0:
            current_efficiency = model.cars_reached_destination / model.cars_spawned
            if current_efficiency >= target_efficiency:
                break

    df = model.datacollector.get_model_vars_dataframe()

    # Agregar columnas con los parametros
    for key, value in params.items():
        df[key] = value

    # Agregar metricas adicionales
    final_step = len(df)
    final_spawned = df["Cars Spawned"].iloc[-1] if len(df) > 0 else 0
    final_arrived = df["Cars at Destination"].iloc[-1] if len(df) > 0 else 0

    throughput = final_arrived / final_step if final_step > 0 else 0
    efficiency = final_arrived / final_spawned if final_spawned > 0 else 0

    df["throughput"] = throughput
    df["efficiency"] = efficiency

    pct = efficiency * 100
    print(f"OK ({final_step} steps, {final_arrived}/{final_spawned} arrived, {pct:.1f}%)")

    return df


def generate_scenarios():
    """
    Genera todos los escenarios segun las familias definidas.
    Retorna un diccionario: {familia: {nombre_escenario: params}}
    """
    all_scenarios = {}

    # Familia A: Solo Coches Normales (baseline)
    # normal_spawn_ratio = 1.0, normal_crash_prob = 0
    all_scenarios["A"] = {}
    for spawn in SPAWN_INTERVALS:
        name = f"A_spawn{spawn}"
        all_scenarios["A"][name] = {
            "spawn_interval": spawn,
            "normal_spawn_ratio": 1.0,
            "normal_crash_prob": 0,
            "drunk_crash_prob": 0,
            "drunk_ignore_light_prob": 0,
            "drunk_forget_route_prob": 0,
            "drunk_zigzag_intensity": 0
        }

    # Familia B: Normales con Crash
    # normal_spawn_ratio = 1.0, normal_crash_prob = {0.35, 0.7}
    all_scenarios["B"] = {}
    for spawn in SPAWN_INTERVALS:
        for crash in [0.35, 0.7]:
            name = f"B_spawn{spawn}_crash{crash}"
            all_scenarios["B"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 1.0,
                "normal_crash_prob": crash,
                "drunk_crash_prob": 0,
                "drunk_ignore_light_prob": 0,
                "drunk_forget_route_prob": 0,
                "drunk_zigzag_intensity": 0
            }

    # Familia C: Pocos Drunk sin Comportamiento Erratico
    # normal_spawn_ratio = 0.75 (25% drunk), todo en 0
    all_scenarios["C"] = {}
    for spawn in SPAWN_INTERVALS:
        name = f"C_spawn{spawn}"
        all_scenarios["C"][name] = {
            "spawn_interval": spawn,
            "normal_spawn_ratio": 0.75,
            "normal_crash_prob": 0,
            "drunk_crash_prob": 0,
            "drunk_ignore_light_prob": 0,
            "drunk_forget_route_prob": 0,
            "drunk_zigzag_intensity": 0
        }

    # Familia D: Pocos Drunk con Crash
    # normal_spawn_ratio = 0.75, drunk_crash_prob = {0.35, 0.7}
    all_scenarios["D"] = {}
    for spawn in SPAWN_INTERVALS:
        for crash in [0.35, 0.7]:
            name = f"D_spawn{spawn}_drunkCrash{crash}"
            all_scenarios["D"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.75,
                "normal_crash_prob": 0,
                "drunk_crash_prob": crash,
                "drunk_ignore_light_prob": 0,
                "drunk_forget_route_prob": 0,
                "drunk_zigzag_intensity": 0
            }

    # Familia E: Pocos Drunk Ignorando Luces
    # normal_spawn_ratio = 0.75, drunk_ignore_light_prob = {0.35, 0.7}
    all_scenarios["E"] = {}
    for spawn in SPAWN_INTERVALS:
        for ignore in [0.35, 0.7]:
            name = f"E_spawn{spawn}_ignoreLights{ignore}"
            all_scenarios["E"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.75,
                "normal_crash_prob": 0,
                "drunk_crash_prob": 0,
                "drunk_ignore_light_prob": ignore,
                "drunk_forget_route_prob": 0,
                "drunk_zigzag_intensity": 0
            }

    # Familia F: Pocos Drunk con Forget Route
    # normal_spawn_ratio = 0.75, drunk_forget_route_prob = {0.35, 0.7}
    all_scenarios["F"] = {}
    for spawn in SPAWN_INTERVALS:
        for forget in [0.35, 0.7]:
            name = f"F_spawn{spawn}_forgetRoute{forget}"
            all_scenarios["F"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.75,
                "normal_crash_prob": 0,
                "drunk_crash_prob": 0,
                "drunk_ignore_light_prob": 0,
                "drunk_forget_route_prob": forget,
                "drunk_zigzag_intensity": 0
            }

    # Familia G: Pocos Drunk con Zigzag
    # normal_spawn_ratio = 0.75, drunk_zigzag_intensity = {0.35, 0.7}
    all_scenarios["G"] = {}
    for spawn in SPAWN_INTERVALS:
        for zigzag in [0.35, 0.7]:
            name = f"G_spawn{spawn}_zigzag{zigzag}"
            all_scenarios["G"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.75,
                "normal_crash_prob": 0,
                "drunk_crash_prob": 0,
                "drunk_ignore_light_prob": 0,
                "drunk_forget_route_prob": 0,
                "drunk_zigzag_intensity": zigzag
            }

    # Familia H: Muchos Drunk - Crash
    # normal_spawn_ratio = 0.5 (50% drunk), drunk_crash_prob = {0, 0.35, 0.7}
    all_scenarios["H"] = {}
    for spawn in SPAWN_INTERVALS:
        for crash in PROB_VALUES:
            name = f"H_spawn{spawn}_drunkCrash{crash}"
            all_scenarios["H"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.5,
                "normal_crash_prob": 0,
                "drunk_crash_prob": crash,
                "drunk_ignore_light_prob": 0,
                "drunk_forget_route_prob": 0,
                "drunk_zigzag_intensity": 0
            }

    # Familia I: Muchos Drunk - Ignore Lights
    # normal_spawn_ratio = 0.5, drunk_ignore_light_prob = {0, 0.35, 0.7}
    all_scenarios["I"] = {}
    for spawn in SPAWN_INTERVALS:
        for ignore in PROB_VALUES:
            name = f"I_spawn{spawn}_ignoreLights{ignore}"
            all_scenarios["I"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.5,
                "normal_crash_prob": 0,
                "drunk_crash_prob": 0,
                "drunk_ignore_light_prob": ignore,
                "drunk_forget_route_prob": 0,
                "drunk_zigzag_intensity": 0
            }

    # Familia J: Muchos Drunk - Forget Route
    # normal_spawn_ratio = 0.5, drunk_forget_route_prob = {0, 0.35, 0.7}
    all_scenarios["J"] = {}
    for spawn in SPAWN_INTERVALS:
        for forget in PROB_VALUES:
            name = f"J_spawn{spawn}_forgetRoute{forget}"
            all_scenarios["J"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.5,
                "normal_crash_prob": 0,
                "drunk_crash_prob": 0,
                "drunk_ignore_light_prob": 0,
                "drunk_forget_route_prob": forget,
                "drunk_zigzag_intensity": 0
            }

    # Familia K: Muchos Drunk - Zigzag
    # normal_spawn_ratio = 0.5, drunk_zigzag_intensity = {0, 0.35, 0.7}
    all_scenarios["K"] = {}
    for spawn in SPAWN_INTERVALS:
        for zigzag in PROB_VALUES:
            name = f"K_spawn{spawn}_zigzag{zigzag}"
            all_scenarios["K"][name] = {
                "spawn_interval": spawn,
                "normal_spawn_ratio": 0.5,
                "normal_crash_prob": 0,
                "drunk_crash_prob": 0,
                "drunk_ignore_light_prob": 0,
                "drunk_forget_route_prob": 0,
                "drunk_zigzag_intensity": zigzag
            }

    # Familia L: Combinacion Normal + Drunk Crash
    # normal_spawn_ratio = 0.75, normal_crash_prob = {0.35, 0.7}, drunk_crash_prob = {0.35, 0.7}
    all_scenarios["L"] = {}
    for spawn in SPAWN_INTERVALS:
        for normal_crash in [0.35, 0.7]:
            for drunk_crash in [0.35, 0.7]:
                name = f"L_spawn{spawn}_normalCrash{normal_crash}_drunkCrash{drunk_crash}"
                all_scenarios["L"][name] = {
                    "spawn_interval": spawn,
                    "normal_spawn_ratio": 0.75,
                    "normal_crash_prob": normal_crash,
                    "drunk_crash_prob": drunk_crash,
                    "drunk_ignore_light_prob": 0,
                    "drunk_forget_route_prob": 0,
                    "drunk_zigzag_intensity": 0
                }

    # Familia M: Combinacion Completa (peor caso)
    # Todos los parametros en 0.35
    all_scenarios["M"] = {}
    for spawn in SPAWN_INTERVALS:
        name = f"M_spawn{spawn}_worstCase"
        all_scenarios["M"][name] = {
            "spawn_interval": spawn,
            "normal_spawn_ratio": 0.5,
            "normal_crash_prob": 0.35,
            "drunk_crash_prob": 0.35,
            "drunk_ignore_light_prob": 0.35,
            "drunk_forget_route_prob": 0.35,
            "drunk_zigzag_intensity": 0.35
        }

    return all_scenarios


def main():
    """Funcion principal que ejecuta todos los escenarios."""
    print("=" * 60)
    print("SCRIPT DE TESTING AUTOMATIZADO - SIMULACION DE TRAFICO")
    print("=" * 60)
    print()

    # Generar escenarios
    all_scenarios = generate_scenarios()

    # Contar total
    total = sum(len(scenarios) for scenarios in all_scenarios.values())
    print(f"Total de escenarios a ejecutar: {total}")
    print(f"Max steps por escenario: {MAX_STEPS}")
    print(f"Target eficiencia: {TARGET_EFFICIENCY * 100:.0f}%")
    print(f"Directorio de salida: {OUTPUT_DIR}/")
    print()

    # Crear directorio principal
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Ejecutar cada familia
    completed = 0
    for family, scenarios in sorted(all_scenarios.items()):
        print(f"\n--- Familia {family} ({len(scenarios)} escenarios) ---")

        # Crear subdirectorio para la familia
        family_dir = os.path.join(OUTPUT_DIR, f"family_{family}")
        os.makedirs(family_dir, exist_ok=True)

        for scenario_name, params in scenarios.items():
            try:
                df = run_scenario(scenario_name, params)

                # Guardar CSV
                csv_path = os.path.join(family_dir, f"{scenario_name}.csv")
                df.to_csv(csv_path, index_label="step")

                completed += 1

            except Exception as e:
                print(f"  ERROR en {scenario_name}: {e}")

    print()
    print("=" * 60)
    print(f"COMPLETADO: {completed}/{total} escenarios")
    print(f"Resultados en: {OUTPUT_DIR}/")
    print("=" * 60)


if __name__ == "__main__":
    main()
