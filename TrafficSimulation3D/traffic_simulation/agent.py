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

        # Parámetros de choque para coches normales
        self.crashed = False
        self.crash_prob = self.model.normal_crash_prob
        self.crash_recovery_steps = 0

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
        Regresa los vecinos válidos siguiendo las direcciones de las calles.
        Ahora sí trata el mapa como un grafo dirigido porque antes estaba mal jaja.
        """
        neighbors = []

        direction_offsets = {
            "Up": (0, 1),
            "Down": (0, -1),
            "Left": (-1, 0),
            "Right": (1, 0)
        }

        # checa si estamos en un destino
        is_at_destination = any(isinstance(agent, Destination) for agent in cell.agents)
        # checa si estamos en un semáforo
        is_at_traffic_light = any(isinstance(agent, Traffic_Light) for agent in cell.agents)

        if is_at_destination:
            # si estamos en un destino D, solo podemos movernos a calles que apunten en la dirección correcta
            # o sea si hay un > en (x+1,y) solo puedes entrar si te mueves a la derecha desde (x,y)
            # antes dejaba que te movieras a cualquier lado y por eso se bugueaba el pathfinding
            for dir_name, (dx, dy) in direction_offsets.items():
                next_x = cell.coordinate[0] + dx
                next_y = cell.coordinate[1] + dy

                if (0 <= next_x < self.model.grid.dimensions[0] and
                    0 <= next_y < self.model.grid.dimensions[1]):
                    next_cell = self.model.grid[(next_x, next_y)]

                    has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
                    has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)

                    if has_car or has_obstacle:
                        continue

                    # busca si hay una calle o semáforo
                    road_agent = self.get_road_at(next_cell)

                    # solo te puedes mover a una calle si su dirección coincide con hacia donde te mueves
                    if isinstance(road_agent, (Road, Traffic_Light)):
                        if road_agent.direction == dir_name:
                            neighbors.append(next_cell)

                    # también puedes ir a otro destino D
                    has_destination = any(isinstance(agent, Destination) for agent in next_cell.agents)
                    if has_destination:
                        neighbors.append(next_cell)

        elif is_at_traffic_light:
            # los semáforos tienen dirección igual que las calles normales
            # básicamente son calles pero con estado de verde/rojo
            direction = current_road.direction if current_road else None

            if direction and direction in direction_offsets:
                dx, dy = direction_offsets[direction]
                next_x = cell.coordinate[0] + dx
                next_y = cell.coordinate[1] + dy

                if (0 <= next_x < self.model.grid.dimensions[0] and
                    0 <= next_y < self.model.grid.dimensions[1]):
                    next_cell = self.model.grid[(next_x, next_y)]

                    has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
                    has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)

                    if has_car or has_obstacle:
                        return neighbors

                    # puedes moverte a cualquier celda válida (calle, destino, semáforo)
                    has_valid_path = any(isinstance(agent, (Road, Destination, Traffic_Light)) for agent in next_cell.agents)

                    if has_valid_path:
                        neighbors.append(next_cell)

        elif current_road:
            # si estamos en una calle normal, podemos:
            # 1. seguir en la dirección del flujo (siempre)
            # 2. doblar a una calle perpendicular si su flujo es compatible (intersecciones)

            # primero agregar el vecino en la dirección actual
            direction = current_road.direction
            if direction in direction_offsets:
                dx, dy = direction_offsets[direction]
                next_x = cell.coordinate[0] + dx
                next_y = cell.coordinate[1] + dy

                if (0 <= next_x < self.model.grid.dimensions[0] and
                    0 <= next_y < self.model.grid.dimensions[1]):
                    next_cell = self.model.grid[(next_x, next_y)]

                    has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                    has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)

                    if not has_obstacle and not has_car:
                        # puedes ir a calles, destinos o semáforos
                        has_valid_path = any(isinstance(agent, (Road, Destination, Traffic_Light)) for agent in next_cell.agents)
                        if has_valid_path:
                            neighbors.append(next_cell)

            # Permitir doblar en intersecciones: puedes entrar a una calle perpendicular
            # siempre que NO vayas en contra de su flujo
            opposite_dirs = {
                "Up": "Down",
                "Down": "Up",
                "Left": "Right",
                "Right": "Left"
            }

            for dir_name, (dx, dy) in direction_offsets.items():
                if dir_name == direction:
                    continue

                next_x = cell.coordinate[0] + dx
                next_y = cell.coordinate[1] + dy

                if (0 <= next_x < self.model.grid.dimensions[0] and
                    0 <= next_y < self.model.grid.dimensions[1]):
                    next_cell = self.model.grid[(next_x, next_y)]

                    has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                    has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)

                    if has_obstacle or has_car:
                        continue

                    road_agent = self.get_road_at(next_cell)
                    has_destination = any(isinstance(agent, Destination) for agent in next_cell.agents)

                    # Permitir movimiento a destinos adyacentes
                    if has_destination and next_cell not in neighbors:
                        neighbors.append(next_cell)

                    # Permitir cambio de carril: moverse a una calle adyacente con la MISMA dirección
                    if isinstance(road_agent, (Road, Traffic_Light)):
                        if road_agent.direction == direction:
                            # Cambio de carril permitido
                            if next_cell not in neighbors:
                                neighbors.append(next_cell)
                        # Permitir doblar a una calle SI NO vas en dirección opuesta a su flujo
                        # Ejemplo: si la calle va Right, NO puedes entrar desde la derecha (irías contra flujo)
                        elif road_agent.direction != opposite_dirs.get(dir_name):
                            # No estás yendo contra el flujo, puedes entrar (doblar en intersección)
                            if next_cell not in neighbors:
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

            # Verificar colisión con probabilidad de choque
            has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
            if has_car and self.model.random.random() < self.crash_prob:
                self.crashed = True
                self.crash_recovery_steps = 10
                return False

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

        # Si no hay ruta, seguir en la dirección del camino
        if not self.path:
            return self.continue_in_road_direction()

        return False

    def continue_in_road_direction(self):
        """
        Si no hay ruta, sigue avanzando en la dirección del camino actual.
        Evita congestionamientos cuando el pathfinding falla.
        """
        direction_offsets = {
            "Up": (0, 1),
            "Down": (0, -1),
            "Left": (-1, 0),
            "Right": (1, 0)
        }

        current_road = self.get_road_at(self.cell)
        if not current_road:
            return False

        direction = current_road.direction
        if direction not in direction_offsets:
            return False

        dx, dy = direction_offsets[direction]
        next_x = self.cell.coordinate[0] + dx
        next_y = self.cell.coordinate[1] + dy

        # Verificar límites del grid
        if not (0 <= next_x < self.model.grid.dimensions[0] and
                0 <= next_y < self.model.grid.dimensions[1]):
            return False

        next_cell = self.model.grid[(next_x, next_y)]

        # Verificar obstáculos y otros coches
        has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
        has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)

        if has_obstacle or has_car:
            return False

        # Verificar semáforo en rojo en celda actual
        traffic_lights = [agent for agent in self.cell.agents if isinstance(agent, Traffic_Light)]
        if traffic_lights and not traffic_lights[0].state:
            self.waiting_at_light = True
            return False

        self.waiting_at_light = False

        # Moverse en la dirección del camino
        self.cell = next_cell
        self.direction = direction
        return True

    def step(self):
        """
        Executes one step of the agent's behavior.
        Estructura de roombaSimulation2.CleaningAgent.step()
        """
        # Si está en recuperación de choque
        if self.crash_recovery_steps > 0:
            self.crash_recovery_steps -= 1
            if self.crash_recovery_steps == 0:
                self.crashed = False
            return

        # Si llegó al destino, marcar como completado
        if self.cell == self.destination:
            self.reached_destination = True
            self.remove()
            return

        # Moverse hacia el destino
        self.move_along_path()


class drunkDriver(Car):
    """
    Drunk driver car that moves randomly without following traffic rules.
    Tiene probabilidad de moverse 2 celdas o hacer movimientos aleatorios.
    """
    def __init__(self, model, cell, destination):
        """
        Creates a new drunk driver.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
            destination: The destination cell (aunque puede que no llegue nunca)
        """
        super().__init__(model, cell, destination)
        self.crashed = False
        self.random_move_prob = self.model.drunk_random_move_prob  # Configurable via slider

        # Parámetros controlados por sliders del modelo
        self.crash_prob = self.model.drunk_crash_prob
        self.ignore_light_prob = self.model.drunk_ignore_light_prob
        self.wrong_way_prob = self.model.drunk_wrong_way_prob
        self.forget_route_prob = self.model.drunk_forget_route_prob
        self.zigzag_intensity = self.model.drunk_zigzag_intensity  # 0.0 a 1.0
        self.zigzag_state = "left"  # Alterna entre "left" y "right"
        self.random_steps_remaining = 0  # Pasos de movimiento random cuando olvida ruta
        self.crash_recovery_steps = 0  # Pasos restantes de recuperación tras choque

    def get_random_neighbor(self):
        """
        Obtiene un vecino aleatorio sin importar obstáculos o direcciones.
        """
        direction_offsets = {
            "Up": (0, 1),
            "Down": (0, -1),
            "Left": (-1, 0),
            "Right": (1, 0)
        }

        possible_neighbors = []
        for dir_name, (dx, dy) in direction_offsets.items():
            next_x = self.cell.coordinate[0] + dx
            next_y = self.cell.coordinate[1] + dy

            if (0 <= next_x < self.model.grid.dimensions[0] and
                0 <= next_y < self.model.grid.dimensions[1]):
                next_cell = self.model.grid[(next_x, next_y)]
                possible_neighbors.append((next_cell, dir_name))

        if possible_neighbors:
            return self.model.random.choice(possible_neighbors)
        return None, None

    def can_move_forward_drunk(self):
        """
        Verifica si puede avanzar, con posibilidad de ignorar semáforos.
        """
        if not self.path:
            return False

        next_cell = self.path[0]

        # Verificar semáforo en rojo
        traffic_lights = [agent for agent in self.cell.agents if isinstance(agent, Traffic_Light)]
        if traffic_lights and not traffic_lights[0].state:
            # Decidir si ignora el semáforo
            if self.model.random.random() < self.ignore_light_prob:
                self.waiting_at_light = False
            else:
                self.waiting_at_light = True
                return False

        self.waiting_at_light = False

        # Verificar coche adelante
        has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
        if has_car:
            return False

        return True

    def get_wrong_way_neighbor(self):
        """
        Obtiene vecino en dirección contraria al flujo.
        """
        opposite_dirs = {"Up": "Down", "Down": "Up", "Left": "Right", "Right": "Left"}
        direction_offsets = {"Up": (0, 1), "Down": (0, -1), "Left": (-1, 0), "Right": (1, 0)}

        current_road = self.get_road_at(self.cell)
        if current_road and current_road.direction in opposite_dirs:
            opposite_dir = opposite_dirs[current_road.direction]
            dx, dy = direction_offsets[opposite_dir]
            next_x = self.cell.coordinate[0] + dx
            next_y = self.cell.coordinate[1] + dy

            if (0 <= next_x < self.model.grid.dimensions[0] and
                0 <= next_y < self.model.grid.dimensions[1]):
                return self.model.grid[(next_x, next_y)], opposite_dir

        return None, None

    def apply_zigzag(self, intended_cell):
        """
        Aplica movimiento en zig zag alternando izquierda/derecha.
        La intensidad determina la probabilidad de aplicar el zigzag.
        """
        # Probabilidad basada en intensidad (0.0 = nunca, 1.0 = siempre)
        if self.model.random.random() > self.zigzag_intensity:
            return intended_cell

        direction_offsets = {"Up": (0, 1), "Down": (0, -1), "Left": (-1, 0), "Right": (1, 0)}

        current_road = self.get_road_at(self.cell)
        if not current_road:
            return intended_cell

        current_dir = current_road.direction

        # Offset perpendicular según dirección y estado zigzag
        if current_dir in ["Up", "Down"]:
            offset = (-1, 0) if self.zigzag_state == "left" else (1, 0)
        else:
            offset = (0, 1) if self.zigzag_state == "left" else (0, -1)

        zigzag_x = intended_cell.coordinate[0] + offset[0]
        zigzag_y = intended_cell.coordinate[1] + offset[1]

        if (0 <= zigzag_x < self.model.grid.dimensions[0] and
            0 <= zigzag_y < self.model.grid.dimensions[1]):
            zigzag_cell = self.model.grid[(zigzag_x, zigzag_y)]

            has_obstacle = any(isinstance(agent, Obstacle) for agent in zigzag_cell.agents)
            has_car = any(isinstance(agent, Car) for agent in zigzag_cell.agents if agent != self)

            if not has_obstacle and not has_car:
                self.zigzag_state = "right" if self.zigzag_state == "left" else "left"
                return zigzag_cell

        self.zigzag_state = "right" if self.zigzag_state == "left" else "left"
        return intended_cell

    def step(self):
        """
        Executes one step with drunk driving behavior.
        """
        # Si está en recuperación de choque, decrementar contador y no moverse
        if self.crash_recovery_steps > 0:
            self.crash_recovery_steps -= 1
            if self.crash_recovery_steps == 0:
                self.crashed = False  # Se recuperó
            return

        # Si llegó al destino, terminar
        if self.cell == self.destination:
            self.reached_destination = True
            self.remove()
            return

        # Si está en modo "olvidó ruta", hacer movimiento random
        if self.random_steps_remaining > 0:
            self.random_steps_remaining -= 1
            next_cell, new_direction = self.get_random_neighbor()
            if next_cell:
                # Verificar colisión con obstáculo
                has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                if has_obstacle:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10  # Se detiene 10 steps
                    return
                # Verificar colisión con coche
                has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
                if has_car:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10  # Se detiene 10 steps
                    return
                self.cell = next_cell
                if new_direction:
                    self.direction = new_direction
            return

        # Probabilidad de olvidar la ruta (activa modo random por 3-5 pasos)
        if self.model.random.random() < self.forget_route_prob:
            self.path = []
            self.random_steps_remaining = self.model.random.randint(3, 5)
            return

        # Probabilidad de ir en sentido contrario
        if self.model.random.random() < self.wrong_way_prob:
            next_cell, new_direction = self.get_wrong_way_neighbor()
            if next_cell:
                has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                if has_obstacle:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10
                    return
                has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
                if has_car:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10
                    return
                self.cell = next_cell
                if new_direction:
                    self.direction = new_direction
            return

        # Decidir si hace movimiento random normal
        if self.model.random.random() < self.random_move_prob:
            next_cell, new_direction = self.get_random_neighbor()
            if next_cell:
                has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                if has_obstacle:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10
                    return
                has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
                if has_car:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10
                    return
                self.cell = next_cell
                if new_direction:
                    self.direction = new_direction
        else:
            # Seguir path normal
            if not self.path:
                self.path = self.find_path_to_destination()

            # Siempre avanza 1 celda (speeding eliminado)
            if self.path and self.can_move_forward_drunk():
                next_cell = self.path.pop(0)

                has_obstacle = any(isinstance(agent, Obstacle) for agent in next_cell.agents)
                if has_obstacle:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10
                    return

                has_car = any(isinstance(agent, Car) for agent in next_cell.agents if agent != self)
                if has_car:
                    if self.model.random.random() < self.crash_prob:
                        self.crashed = True
                        self.crash_recovery_steps = 10
                    return

                # Aplicar zigzag
                next_cell = self.apply_zigzag(next_cell)

                old_x, old_y = self.cell.coordinate
                new_x, new_y = next_cell.coordinate
                self.cell = next_cell

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


class Traffic_Light(Road):
    """
    Traffic light agent que hereda de Road porque básicamente es una calle con semáforo.
    Tiene todo lo de una calle normal pero con estado de verde/rojo.
    """
    def __init__(self, model, cell, state=False, timeToChange=10, direction="Right"):
        """
        Creates a new traffic light.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
            state: Whether the traffic light is green or red
            timeToChange: After how many steps should the traffic light change color
            direction: Direction of traffic flow (igual que la calle que reemplaza)
        """
        # llama al init de Road para que herede direction correctamente
        super().__init__(model, cell, direction)
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
