from mesa import Model
from mesa.datacollection import DataCollector
from mesa.discrete_space import OrthogonalMooreGrid
from .agent import Car, Traffic_Light, Destination, Obstacle, Road
import json

class CityModel(Model):
    """
    Creates a model based on a city map with automatic car spawning.
    Estructura de trafficBase.CityModel y roombaSimulation2.RoombaMultiAgentModel
    """

    def __init__(self, seed=42):
        super().__init__(seed=seed)

        # Load the map dictionary
        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        self.traffic_lights = []
        self.destinations = []
        self.spawn_points = []
        self.cars = []
        self.steps_count = 0
        self.cars_spawned = 0
        self.cars_reached_destination = 0
        self.spawn_interval = 10  # Spawn a car every 5 steps

        # Load the map file
        with open("city_files/2024_base.txt") as baseFile:
            lines = baseFile.readlines()
            # Strip whitespace from lines
            lines = [line.strip() for line in lines if line.strip()]
            self.width = len(lines[0])
            self.height = len(lines)

            self.grid = OrthogonalMooreGrid(
                [self.width, self.height], capacity=100, torus=False, random=self.random
            )

            # Create the agents based on the map
            for r, row in enumerate(lines):
                for c, col in enumerate(row):
                    cell = self.grid[(c, self.height - r - 1)]

                    if col in ["v", "^", ">", "<"]:
                        agent = Road(self, cell, dataDictionary[col])
                        # Check if this is a spawn point (edge of the map)
                        if self.is_spawn_point(c, self.height - r - 1, dataDictionary[col]):
                            self.spawn_points.append(cell)

                    elif col in ["S", "s"]:
                        # detectar la dirección del semáforo checando las calles vecinas
                        direction = self.detect_traffic_light_direction(lines, r, c)
                        agent = Traffic_Light(
                            self,
                            cell,
                            False if col == "S" else True,
                            int(dataDictionary[col]),
                            direction
                        )
                        self.traffic_lights.append(agent)

                    elif col == "#":
                        agent = Obstacle(self, cell)

                    elif col == "D":
                        agent = Destination(self, cell)
                        self.destinations.append(cell)
        
        # Set up data collection
        model_reporters = {
            "Cars": lambda m: len(m.cars),
            "Cars Spawned": lambda m: m.cars_spawned,
            "Cars at Destination": lambda m: m.cars_reached_destination,
        }

        self.datacollector = DataCollector(model_reporters)
        self.running = True
        self.datacollector.collect(self)

    def detect_traffic_light_direction(self, lines, row, col):
        """
        Detecta la dirección de un semáforo checando las calles adyacentes.
        El semáforo hereda la dirección de las calles que lo rodean.
        """
        # mapeo de caracteres a direcciones
        direction_map = {
            ">": "Right",
            "<": "Left",
            "^": "Up",
            "v": "Down"
        }

        # checa las 4 direcciones adyacentes
        # izquierda
        if col > 0 and lines[row][col - 1] in direction_map:
            return direction_map[lines[row][col - 1]]
        # derecha
        if col < len(lines[row]) - 1 and lines[row][col + 1] in direction_map:
            return direction_map[lines[row][col + 1]]
        # arriba
        if row > 0 and lines[row - 1][col] in direction_map:
            return direction_map[lines[row - 1][col]]
        # abajo
        if row < len(lines) - 1 and lines[row + 1][col] in direction_map:
            return direction_map[lines[row + 1][col]]

        # si no encontró ninguna calle vecina, default a Right
        return "Right"

    def is_spawn_point(self, x, y, direction):
        """
        Determines if a road cell is a spawn point (at the edge of the map).
        """
        # Check if the cell is at the edge based on direction
        if direction == "Right" and x == 0:
            return True
        if direction == "Left" and x == self.width - 1:
            return True
        if direction == "Up" and y == 0:
            return True
        if direction == "Down" and y == self.height - 1:
            return True
        return False

    def spawn_car(self):
        """
        Spawns a new car at a random edge spawn point with a destination as goal.
        Los carros spawean en los bordes del mapa y se mueven hacia destinos D.
        Solo crea el carro si existe una ruta válida.
        """
        if len(self.spawn_points) == 0 or len(self.destinations) == 0:
            return None

        # Intentar hasta 100 veces encontrar una combinación válida
        for attempt in range(100):
            # Seleccionar un punto de spawn aleatorio (borde del mapa)
            spawn_cell = self.random.choice(self.spawn_points)
            
            # Debug
            # print(f"Attempt {attempt}: trying spawn at {spawn_cell.coordinate}")

            # Verificar si el spawn point está ocupado
            has_car = any(isinstance(agent, Car) for agent in spawn_cell.agents)
            if has_car:
                continue

            # Seleccionar un destino aleatorio como objetivo
            destination_cell = self.random.choice(self.destinations)

            # Verificar que existe una ruta válida
            temp_car = Car(self, spawn_cell, destination_cell)
            path = temp_car.find_path_to_destination()

            # Remover el temp_car para que no interfiera
            temp_car.remove()

            if len(path) > 0:
                # Crear el carro real
                car = Car(self, spawn_cell, destination_cell)

                # Obtener la dirección del road donde spawneó
                road = car.get_road_at(spawn_cell)
                if road:
                    car.direction = road.direction

                self.cars.append(car)
                self.cars_spawned += 1

                return car

        # No se encontró una combinación válida después de 100 intentos
        return None

    def can_spawn_more_cars(self):
        """
        Checks if more cars can be spawned (if there are available spawn points).
        """
        for spawn_cell in self.spawn_points:
            has_car = any(isinstance(agent, Car) for agent in spawn_cell.agents)
            if not has_car:
                return True
        return False

    def step(self):
        """
        Advance the model by one step.
        Estructura de roombaSimulation2.RoombaMultiAgentModel.step()
        """
        self.steps_count += 1

        # Spawn a new car every spawn_interval steps
        if self.steps_count % self.spawn_interval == 0:
            self.spawn_car()

        # Execute the step for all agents
        # Patrón de roombaSimulation2 para ejecutar agentes en orden aleatorio
        agents_list = list(self.agents)
        self.random.shuffle(agents_list)
        for agent in agents_list:
            agent.step()

        # Remove cars that reached their destination
        # Patrón de roombaSimulation2 para actualizar listas de agentes
        self.cars = [car for car in self.cars if car in self.agents]
        self.cars_reached_destination = self.cars_spawned - len(self.cars)

        # Stop if no more cars can be spawned and all cars have reached destination
        if not self.can_spawn_more_cars() and len(self.cars) == 0:
            self.running = False

        # Collect data
        self.datacollector.collect(self)
