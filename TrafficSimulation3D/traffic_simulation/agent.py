from mesa.discrete_space import CellAgent, FixedAgent
import heapq

class Car(CellAgent):
    """
    Car agent that moves through the city following traffic rules.
    Patrón de roombaSimulation2.CleaningAgent para movimiento inteligente
    """
    def __init__(self, model, cell, destination):
        """
        Creates a new car agent.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
            destination: The destination cell for this car
        """
        super().__init__(model)
        self.cell = cell
        self.destination = destination
        self.path = []
        self.reached_destination = False
        self.waiting_at_light = False
        # Direccion del coche basada en la calle donde esta
        # Puede ser: "Up", "Down", "Left", "Right"
        self.direction = "Right"  # Direccion por defecto

    def find_path_to_destination(self):
        """
        Usa A* para encontrar el camino óptimo al destino siguiendo direcciones de calles.
        Permite llegar a destinos adyacentes incluso sin Road directo.
        """
        if self.cell == self.destination:
            return []

        # Cola de prioridad: (f_score, contador, celda, camino)
        counter = 0
        open_set = [(0, counter, self.cell, [self.cell])]

        # g_score: costo desde inicio hasta el nodo
        g_score = {self.cell: 0}

        # Conjunto de nodos ya procesados
        closed_set = set()

        while open_set:
            f, _, current, path = heapq.heappop(open_set)

            if current in closed_set:
                continue

            closed_set.add(current)

            if current == self.destination:
                return path[1:]

            current_road = self.get_road_at(current)
            neighbors = self.get_valid_neighbors(current, current_road)
            
            # Debug pathfinding
            # if len(closed_set) < 5:
            #     print(f"Checking {current.coordinate}, road: {current_road.direction if current_road else 'None'}, neighbors: {[n.coordinate for n in neighbors]}")

            for neighbor in neighbors:
                if neighbor in closed_set:
                    continue

                tentative_g = g_score[current] + 1

                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    g_score[neighbor] = tentative_g
                    h = self.heuristic(neighbor, self.destination)
                    f_score = tentative_g + h

                    counter += 1
                    heapq.heappush(open_set, (f_score, counter, neighbor, path + [neighbor]))

        print(f"No path found from {self.cell.coordinate} to {self.destination.coordinate}")
        return []

    def heuristic(self, cell1, cell2):
        """
        Distancia Manhattan entre dos celdas (heurística admisible para A*).
        """
        x1, y1 = cell1.coordinate
        x2, y2 = cell2.coordinate
        return abs(x1 - x2) + abs(y1 - y2)

    def get_road_at(self, cell):
        """
        Returns the Road or Traffic_Light agent at the given cell, if any.
        Patrón de roombaSimulation2 para buscar agentes en celdas
        """
        roads = [agent for agent in cell.agents if isinstance(agent, (Road, Traffic_Light))]
        return roads[0] if roads else None

    def get_valid_neighbors(self, cell, current_road):
        """
        Returns valid neighbors following road directions and avoiding obstacles.
        Permite moverse desde destinos a calles adyacentes y viceversa.
        """
        neighbors = []

        direction_offsets = {
            "Up": (0, 1),
            "Down": (0, -1),
            "Left": (-1, 0),
            "Right": (1, 0)
        }

        # Verificar si estamos en un destino
        is_at_destination = any(isinstance(agent, Destination) for agent in cell.agents)
        # Verificar si estamos en un semáforo
        is_at_traffic_light = any(isinstance(agent, Traffic_Light) for agent in cell.agents)

        if is_at_traffic_light:
            # print(f"At Traffic Light {cell.coordinate}")
            pass

        if is_at_destination or is_at_traffic_light:
            # Desde un destino o semáforo, podemos movernos a cualquier calle adyacente
            # siempre que la dirección de la calle sea compatible
            for dir_name, (dx, dy) in direction_offsets.items():
                next_x = cell.coordinate[0] + dx
                next_y = cell.coordinate[1] + dy

                if (0 <= next_x < self.model.grid.dimensions[0] and
                    0 <= next_y < self.model.grid.dimensions[1]):
                    next_cell = self.model.grid[(next_x, next_y)]

                    has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
                    has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                    
                    # Check for road, destination or traffic light
                    road_agent = self.get_road_at(next_cell)
                    has_destination = any(isinstance(agent, Destination) for agent in next_cell.agents)
                    
                    if (road_agent or has_destination) and not has_car and not has_obstacle:
                        # Si es una calle, verificar dirección
                        if isinstance(road_agent, Road):
                            if road_agent.direction == dir_name:
                                neighbors.append(next_cell)
                        # Si es otro semáforo o destino, siempre es válido (asumiendo conectividad)
                        else:
                            neighbors.append(next_cell)

        elif current_road:
            # Desde una calle, seguir la dirección del flujo
            direction = current_road.direction
            if direction in direction_offsets:
                dx, dy = direction_offsets[direction]
                next_x = cell.coordinate[0] + dx
                next_y = cell.coordinate[1] + dy

                if (0 <= next_x < self.model.grid.dimensions[0] and
                    0 <= next_y < self.model.grid.dimensions[1]):
                    next_cell = self.model.grid[(next_x, next_y)]

                    has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                    # Allow moving to Road, Destination, or Traffic_Light
                    has_valid_path = any(isinstance(agent, (Road, Destination, Traffic_Light)) for agent in next_cell.agents)
                    has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)

                    if has_valid_path and not has_obstacle and not has_car:
                        neighbors.append(next_cell)
                    else:
                        pass
                        # print(f"Rejected {next_cell.coordinate}: path={has_valid_path}, obs={has_obstacle}, car={has_car}")

            # También permitir moverse a destinos adyacentes (si no están en la dirección principal)
            for dx, dy in direction_offsets.values():
                next_x = cell.coordinate[0] + dx
                next_y = cell.coordinate[1] + dy

                if (0 <= next_x < self.model.grid.dimensions[0] and
                    0 <= next_y < self.model.grid.dimensions[1]):
                    next_cell = self.model.grid[(next_x, next_y)]

                    has_destination = any(isinstance(agent, Destination) for agent in next_cell.agents)
                    has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)

                    if has_destination and not has_car and next_cell not in neighbors:
                        neighbors.append(next_cell)

        return neighbors

    def can_move_forward(self):
        """
        Checks if the car can move forward (no red light, no car ahead).
        Patrón de roombaSimulation2 para verificar disponibilidad
        """
        if not self.path:
            return False

        next_cell = self.path[0]

        # Verificar si hay un semáforo en rojo en la celda actual
        traffic_lights = [agent for agent in self.cell.agents if isinstance(agent, Traffic_Light)]
        if traffic_lights and not traffic_lights[0].state:
            self.waiting_at_light = True
            return False

        self.waiting_at_light = False

        # Verificar si hay otro carro en la siguiente celda
        has_car = any(isinstance(agent, Car) for agent in next_cell.agents)
        if has_car:
            return False

        return True

    def move_along_path(self):
        """
        Moves one step along the calculated path.
        Actualiza la dirección del coche según el movimiento realizado.
        """
        if not self.path:
            self.path = self.find_path_to_destination()

        if self.path and self.can_move_forward():
            next_cell = self.path.pop(0)
            old_x, old_y = self.cell.coordinate
            new_x, new_y = next_cell.coordinate

            # Actualizar posición
            self.cell = next_cell

            # Actualizar dirección basado en el movimiento real
            dx = new_x - old_x
            dy = new_y - old_y

            if dx > 0:
                self.direction = "Right"
            elif dx < 0:
                self.direction = "Left"
            elif dy > 0:
                self.direction = "Up"
            elif dy < 0:
                self.direction = "Down"

            return True

        return False

    def step(self):
        """
        Executes one step of the agent's behavior.
        Estructura de roombaSimulation2.CleaningAgent.step()
        """
        # Si llegó al destino, marcar como completado
        if self.cell == self.destination:
            self.reached_destination = True
            self.remove()
            return

        # Moverse hacia el destino
        self.move_along_path()


class Traffic_Light(FixedAgent):
    """
    Traffic light agent.
    Estructura de trafficBase.Traffic_Light
    """
    def __init__(self, model, cell, state=False, timeToChange=10):
        """
        Creates a new traffic light.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
            state: Whether the traffic light is green or red
            timeToChange: After how many steps should the traffic light change color
        """
        super().__init__(model)
        self.cell = cell
        self.state = state
        self.timeToChange = timeToChange

    def step(self):
        """
        Changes the state (green or red) of the traffic light.
        """
        if self.model.steps_count % self.timeToChange == 0:
            self.state = not self.state


class Destination(FixedAgent):
    """
    Destination agent where cars should go.
    Estructura de trafficBase.Destination
    """
    def __init__(self, model, cell):
        """
        Creates a new destination agent.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
        """
        super().__init__(model)
        self.cell = cell

    def step(self):
        pass


class Obstacle(FixedAgent):
    """
    Obstacle agent (buildings).
    Estructura de trafficBase.Obstacle
    """
    def __init__(self, model, cell):
        """
        Creates a new obstacle.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
        """
        super().__init__(model)
        self.cell = cell

    def step(self):
        pass


class Road(FixedAgent):
    """
    Road agent that determines where cars can move and in which direction.
    Estructura de trafficBase.Road
    """
    def __init__(self, model, cell, direction="Left"):
        """
        Creates a new road.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
            direction: Direction of traffic flow
        """
        super().__init__(model)
        self.cell = cell
        self.direction = direction

    def step(self):
        pass
