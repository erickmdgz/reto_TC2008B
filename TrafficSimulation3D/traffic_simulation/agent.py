from mesa.discrete_space import CellAgent, FixedAgent

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

    def find_path_to_destination(self):
        """
        Uses BFS to find path to destination following road directions.
        Patrón de roombaSimulation2.CleaningAgent.find_path_to_station()
        """
        from collections import deque

        if self.cell == self.destination:
            return []

        # BFS para encontrar el camino más corto
        queue = deque([(self.cell, [self.cell])])
        visited = {self.cell}

        while queue:
            current, path = queue.popleft()

            if current == self.destination:
                return path[1:]  # Excluir la celda actual

            # Obtener la dirección de la calle actual si existe
            current_road = self.get_road_at(current)

            # Explorar vecinos válidos
            neighbors = self.get_valid_neighbors(current, current_road)

            for neighbor in neighbors:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))

        return []  # No se encontró camino

    def get_road_at(self, cell):
        """
        Returns the Road agent at the given cell, if any.
        Patrón de roombaSimulation2 para buscar agentes en celdas
        """
        roads = [agent for agent in cell.agents if isinstance(agent, Road)]
        return roads[0] if roads else None

    def get_valid_neighbors(self, cell, current_road):
        """
        Returns valid neighbors following road directions and avoiding obstacles.
        Similar a roombaSimulation2.CleaningAgent neighbor selection
        """
        if not current_road:
            return []

        # Determinar la dirección de movimiento permitida
        direction = current_road.direction

        # Mapeo de dirección a offset
        direction_offsets = {
            "Up": (0, 1),
            "Down": (0, -1),
            "Left": (-1, 0),
            "Right": (1, 0)
        }

        if direction not in direction_offsets:
            return []

        dx, dy = direction_offsets[direction]
        next_x = cell.coordinate[0] + dx
        next_y = cell.coordinate[1] + dy

        # Verificar si la siguiente celda está dentro del grid
        if (0 <= next_x < self.model.grid.dimensions[0] and
            0 <= next_y < self.model.grid.dimensions[1]):
            next_cell = self.model.grid[(next_x, next_y)]

            # Verificar que no haya obstáculos y que sea una calle válida
            has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
            has_road = any(isinstance(agent, (Road, Destination)) for agent in next_cell.agents)
            has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)

            if has_road and not has_obstacle and not has_car:
                return [next_cell]

        return []

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
        Patrón de roombaSimulation2.CleaningAgent.move_to_station()
        """
        if not self.path:
            self.path = self.find_path_to_destination()

        if self.path and self.can_move_forward():
            next_cell = self.path.pop(0)
            self.cell = next_cell
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
