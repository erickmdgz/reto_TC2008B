#!/usr/bin/env python3
"""
Visualización 2D de la simulación de tráfico con Mesa SolaraViz.
Ejecutar: solara run app.py
"""

from mesa.visualization import (
    SolaraViz,
    make_space_component,
    make_plot_component,
)
from mesa.visualization.components import AgentPortrayalStyle
from traffic_simulation.model import CityModel
from traffic_simulation.agent import (
    Car,
    Road,
    Obstacle,
    Destination,
    Traffic_Light,
    Accident,
    Orientation,
)

# Colores por tipo de agente
COLORS = {
    "road": "#CCCCCC",
    "obstacle": "#444444",
    "destination": "#22AA22",
    "traffic_light_red": "#FF3333",
    "traffic_light_green": "#33FF33",
    "car": "#3366CC",
    "car_waiting": "#CC6633",
    "car_circular": "#9933CC",
    "accident": "#FF6600",
}


def agent_portrayal(agent):
    """Define la apariencia visual de cada agente."""
    if agent is None:
        return None

    # ---------- CAR ----------
    if isinstance(agent, Car):
        # Marker según orientación (flechas direccionales)
        markers = {
            Orientation.UP: "^",
            Orientation.RIGHT: ">",
            Orientation.DOWN: "v",
            Orientation.LEFT: "<",
        }

        # Color según modo
        from traffic_simulation.agent import CarMode
        if agent.mode == CarMode.WAITING:
            color = COLORS["car_waiting"]
        elif agent.mode == CarMode.CIRCULAR:
            color = COLORS["car_circular"]
        else:
            color = COLORS["car"]

        return AgentPortrayalStyle(
            color=color,
            marker=markers.get(agent.orientation, "o"),
            size=60,
            zorder=4,
        )

    # ---------- ROAD ----------
    elif isinstance(agent, Road):
        # Roads pequeños para no cubrir coches
        return AgentPortrayalStyle(
            color="#DDDDDD",
            marker=".",
            size=5,
            zorder=0,
        )

    # ---------- OBSTACLE ----------
    elif isinstance(agent, Obstacle):
        return AgentPortrayalStyle(
            color=COLORS["obstacle"],
            marker="s",
            size=200,
            zorder=2,
        )

    # ---------- DESTINATION ----------
    elif isinstance(agent, Destination):
        return AgentPortrayalStyle(
            color=COLORS["destination"],
            marker="*",
            size=150,
            zorder=2,
        )

    # ---------- TRAFFIC LIGHT ----------
    elif isinstance(agent, Traffic_Light):
        color = COLORS["traffic_light_green"] if agent.state else COLORS["traffic_light_red"]
        return AgentPortrayalStyle(
            color=color,
            marker="s",
            size=100,
            zorder=3,
        )

    # ---------- ACCIDENT ----------
    elif isinstance(agent, Accident):
        return AgentPortrayalStyle(
            color=COLORS["accident"],
            marker="X",
            size=80,
            zorder=5,
        )

    return None


def post_process_space(ax):
    """Personaliza el gráfico de espacio."""
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_title("Traffic Simulation - A* Navigation")


def post_process_plot(ax):
    """Personaliza las gráficas."""
    ax.legend(loc="upper left")
    ax.set_xlabel("Steps")
    ax.set_ylabel("Count")


# Crear componentes de visualización
space_component = make_space_component(
    agent_portrayal,
    draw_grid=False,
    post_process=post_process_space,
)

plot_component = make_plot_component(
    {"Cars": "#3366CC", "Cars at Destination": "#22AA22"},
    post_process=post_process_plot,
)

# Parámetros del modelo
model_params = {
    "seed": {
        "type": "InputText",
        "value": 42,
        "label": "Random Seed",
    },
}

# Crear modelo y página de visualización
model = CityModel()

page = SolaraViz(
    model,
    components=[space_component, plot_component],
    model_params=model_params,
    name="Traffic Simulation",
)
