from mesa.discrete_space import CellAgent, FixedAgent
from enum import Enum, IntEnum
import heapq
from collections import deque


# =============================================================================
# ENUMS Y CONSTANTES
# =============================================================================

class Orientation(IntEnum):
    """Orientaciones cardinales para la dirección del coche."""
    UP = 0
    RIGHT = 1
    DOWN = 2
    LEFT = 3

    def to_offset(self):
        """Retorna (dx, dy) para moverse hacia adelante en esta orientación."""
        return [(0, 1), (1, 0), (0, -1), (-1, 0)][self.value]

    def turn_left(self):
        """Retorna la orientación al girar a la izquierda."""
        return Orientation((self.value - 1) % 4)

    def turn_right(self):
        """Retorna la orientación al girar a la derecha."""
        return Orientation((self.value + 1) % 4)

    @classmethod
    def from_string(cls, s):
        """Convierte string a Orientation."""
        return {"Up": cls.UP, "Right": cls.RIGHT, "Down": cls.DOWN, "Left": cls.LEFT}[s]

    def to_string(self):
        """Convierte Orientation a string."""
        return ["Up", "Right", "Down", "Left"][self.value]


class CarMode(Enum):
    """Modos de operación del coche."""
    NORMAL = "normal"       # Siguiendo ruta A* hacia destino
    WAITING = "waiting"     # Esperando a que se despeje obstáculo
    CIRCULAR = "circular"   # Circulando cerca del destino bloqueado


# Offsets diagonales por orientación (para cambio de carril)
DIAGONAL_OFFSETS = {
    Orientation.UP:    {"left": (-1, 1), "right": (1, 1)},
    Orientation.RIGHT: {"left": (1, 1),  "right": (1, -1)},
    Orientation.DOWN:  {"left": (1, -1), "right": (-1, -1)},
    Orientation.LEFT:  {"left": (-1, -1), "right": (-1, 1)}
}

# Costos de movimiento
FORWARD_COST = 1.0
TURN_COST = 1.5
DIAGONAL_COST = 1.2

# Pesos de obstáculos
CAR_WEIGHT = 50
ACCIDENT_WEIGHT = 500
MEMORY_BASE_WEIGHT = 100
WEIGHT_DECAY = 0.15

# Comportamiento
MAX_WAIT_STEPS = 5
DESTINATION_CHECK_INTERVAL = 4
MAX_CIRCULAR_LENGTH = 15


# =============================================================================
# AGENTES
# =============================================================================

class Car(CellAgent):
    """
    Agente coche que navega usando A* con estado (posición, orientación).
    Soporta 5 tipos de movimiento y manejo de obstáculos temporales.
    """
    def __init__(self, model, cell, destination):
        """
        Crea un nuevo agente coche.
        Args:
            model: Referencia al modelo
            cell: Celda inicial del coche
            destination: Celda destino
        """
        super().__init__(model)
        self.cell = cell
        self.pos = cell.coordinate  # Requerido para visualización Mesa
        self.destination = destination
        self.path = []  # Lista de estados ((x,y), Orientation)
        self.reached_destination = False
        self.waiting_at_light = False

        # Orientación del coche (independiente de la calle)
        road = self._get_road_at_pos(cell.coordinate)
        if road:
            self.orientation = Orientation.from_string(road.direction)
        else:
            self.orientation = Orientation.RIGHT

        # Para compatibilidad con el servidor (string)
        self.direction = self.orientation.to_string()

        # Sistema de pesos dinámicos (memoria de obstáculos)
        self.obstacle_memory = {}  # {pos: (weight, last_seen_step)}

        # Máquina de estados
        self.mode = CarMode.NORMAL
        self.waiting_steps = 0
        self.circular_route = []
        self.circular_idx = 0
        self.steps_since_check = 0

    # =========================================================================
    # MÉTODOS HELPER
    # =========================================================================

    def _in_bounds(self, pos):
        """Verifica si una posición está dentro del grid."""
        x, y = pos
        return (0 <= x < self.model.grid.dimensions[0] and
                0 <= y < self.model.grid.dimensions[1])

    def _get_road_at_pos(self, pos):
        """Obtiene el Road agent en una posición, si existe."""
        if not self._in_bounds(pos):
            return None
        cell = self.model.grid[pos]
        roads = [a for a in cell.agents if isinstance(a, Road)]
        return roads[0] if roads else None

    def _is_destination(self, pos):
        """Verifica si una posición es un destino."""
        if not self._in_bounds(pos):
            return False
        cell = self.model.grid[pos]
        return any(isinstance(a, Destination) for a in cell.agents)

    def _has_obstacle(self, pos):
        """Verifica si hay un obstáculo (edificio o accidente) en la posición."""
        if not self._in_bounds(pos):
            return True
        cell = self.model.grid[pos]
        return any(isinstance(a, (Obstacle, Accident)) for a in cell.agents)

    def _has_car(self, pos):
        """Verifica si hay otro coche en la posición."""
        if not self._in_bounds(pos):
            return False
        cell = self.model.grid[pos]
        return any(isinstance(a, Car) for a in cell.agents if a != self)

    # =========================================================================
    # A* PATHFINDING
    # =========================================================================

    def find_path_astar(self):
        """
        A* con estado expandido (posición, orientación).
        Retorna lista de estados o lista vacía si no hay ruta.
        """
        start_pos = self.cell.coordinate
        goal_pos = self.destination.coordinate

        if start_pos == goal_pos:
            return []

        start = (start_pos, self.orientation)

        # Priority queue: (f_score, counter, state, path)
        counter = 0
        open_set = [(self._heuristic(start_pos, goal_pos), counter, start, [])]
        g_scores = {start: 0}
        closed = set()

        while open_set:
            f, _, current, path = heapq.heappop(open_set)

            # Goal check: cualquier orientación en el destino es válida
            if current[0] == goal_pos:
                return path

            if current in closed:
                continue
            closed.add(current)

            for successor, cost in self._get_successors(current):
                if successor in closed:
                    continue

                # Agregar peso dinámico por obstáculos
                dynamic_weight = self._get_dynamic_weight(successor[0])
                total_cost = cost + dynamic_weight

                tentative_g = g_scores[current] + total_cost

                if tentative_g < g_scores.get(successor, float('inf')):
                    g_scores[successor] = tentative_g
                    f_score = tentative_g + self._heuristic(successor[0], goal_pos)
                    counter += 1
                    heapq.heappush(open_set, (f_score, counter, successor, path + [successor]))

        return []  # Sin ruta

    def _heuristic(self, pos, goal):
        """Chebyshev distance (admisible con movimientos diagonales)."""
        return max(abs(pos[0] - goal[0]), abs(pos[1] - goal[1]))

    def _get_successors(self, state):
        """Genera estados sucesores válidos con sus costos."""
        pos, orient = state
        successors = []

        # 1. Forward
        fwd = self._try_forward(pos, orient)
        if fwd:
            successors.append(((fwd, orient), FORWARD_COST))

        # 2. Turn left
        left = self._try_turn(pos, orient, "left")
        if left:
            new_orient = orient.turn_left()
            successors.append(((left, new_orient), TURN_COST))

        # 3. Turn right
        right = self._try_turn(pos, orient, "right")
        if right:
            new_orient = orient.turn_right()
            successors.append(((right, new_orient), TURN_COST))

        # 4. Diagonal left (cambio de carril)
        diag_left = self._try_diagonal(pos, orient, "left")
        if diag_left:
            successors.append(((diag_left, orient), DIAGONAL_COST))

        # 5. Diagonal right (cambio de carril)
        diag_right = self._try_diagonal(pos, orient, "right")
        if diag_right:
            successors.append(((diag_right, orient), DIAGONAL_COST))

        return successors

    # =========================================================================
    # VALIDACIÓN DE MOVIMIENTOS
    # =========================================================================

    def _try_forward(self, pos, orient):
        """Intenta movimiento hacia adelante."""
        dx, dy = orient.to_offset()
        new_pos = (pos[0] + dx, pos[1] + dy)

        if not self._in_bounds(new_pos):
            return None

        # Destinos aceptan cualquier dirección
        if self._is_destination(new_pos):
            return new_pos

        road = self._get_road_at_pos(new_pos)
        if road is None:
            return None

        # Forward: destino debe tener misma orientación
        if Orientation.from_string(road.direction) != orient:
            return None

        if self._has_obstacle(new_pos):
            return None

        return new_pos

    def _try_turn(self, pos, orient, direction):
        """Intenta giro cardinal (left/right)."""
        new_orient = orient.turn_left() if direction == "left" else orient.turn_right()
        dx, dy = new_orient.to_offset()
        new_pos = (pos[0] + dx, pos[1] + dy)

        if not self._in_bounds(new_pos):
            return None

        # Destinos aceptan cualquier dirección
        if self._is_destination(new_pos):
            return new_pos

        road = self._get_road_at_pos(new_pos)
        if road is None:
            return None

        # Turn: destino debe tener la nueva orientación
        if Orientation.from_string(road.direction) != new_orient:
            return None

        if self._has_obstacle(new_pos):
            return None

        return new_pos

    def _try_diagonal(self, pos, orient, direction):
        """Intenta movimiento diagonal (cambio de carril)."""
        offsets = DIAGONAL_OFFSETS[orient]
        dx, dy = offsets[direction]
        new_pos = (pos[0] + dx, pos[1] + dy)

        if not self._in_bounds(new_pos):
            return None

        road = self._get_road_at_pos(new_pos)
        if road is None:
            return None

        # Diagonal: destino debe tener MISMA orientación (carril paralelo)
        if Orientation.from_string(road.direction) != orient:
            return None

        if self._has_obstacle(new_pos):
            return None

        return new_pos

    # =========================================================================
    # SISTEMA DE PESOS DINÁMICOS
    # =========================================================================

    def _get_dynamic_weight(self, pos):
        """Obtiene peso dinámico para una posición."""
        weight = 0

        if not self._in_bounds(pos):
            return float('inf')

        cell = self.model.grid[pos]

        # Peso por otros coches
        if any(isinstance(a, Car) for a in cell.agents if a != self):
            weight += CAR_WEIGHT

        # Peso por accidentes
        if any(isinstance(a, Accident) for a in cell.agents):
            weight += ACCIDENT_WEIGHT

        # Peso por memoria de obstáculos (con decaimiento)
        if pos in self.obstacle_memory:
            mem_weight, last_seen = self.obstacle_memory[pos]
            steps_elapsed = self.model.steps_count - last_seen
            decay = (1 - WEIGHT_DECAY) ** steps_elapsed
            decayed_weight = mem_weight * decay
            if decayed_weight > 1:
                weight += decayed_weight
            else:
                del self.obstacle_memory[pos]

        return weight

    def _mark_obstacle(self, pos, weight=MEMORY_BASE_WEIGHT):
        """Marca posición como obstáculo en memoria."""
        self.obstacle_memory[pos] = (weight, self.model.steps_count)

    # =========================================================================
    # MÁQUINA DE ESTADOS
    # =========================================================================

    def _update_mode(self):
        """Actualiza el modo del coche según la situación actual."""
        if self.mode == CarMode.NORMAL:
            if self._is_destination_blocked():
                if self._is_safe_to_wait():
                    self.mode = CarMode.WAITING
                    self.waiting_steps = 0
                else:
                    self._enter_circular_mode()

        elif self.mode == CarMode.WAITING:
            if not self._is_destination_blocked():
                self.mode = CarMode.NORMAL
                self.path = []
            elif self.waiting_steps >= MAX_WAIT_STEPS or not self._is_safe_to_wait():
                self._enter_circular_mode()

        elif self.mode == CarMode.CIRCULAR:
            self.steps_since_check += 1
            if self.steps_since_check >= DESTINATION_CHECK_INTERVAL:
                self.steps_since_check = 0
                if not self._is_destination_blocked():
                    self.mode = CarMode.NORMAL
                    self.path = []
                    self.circular_route = []

    def _enter_circular_mode(self):
        """Entra en modo circular."""
        self.mode = CarMode.CIRCULAR
        self.circular_route = self._calculate_circular_route()
        self.circular_idx = 0
        self.steps_since_check = 0

    # =========================================================================
    # DETECCIÓN DE BLOQUEO Y GRIDLOCK
    # =========================================================================

    def _is_destination_blocked(self):
        """Verifica si el destino está bloqueado."""
        # Accidente directamente en destino
        if any(isinstance(a, Accident) for a in self.destination.agents):
            return True

        # Sin ruta posible
        test_path = self.find_path_astar()
        return len(test_path) == 0

    def _is_safe_to_wait(self):
        """Verifica si esperar no causa gridlock."""
        # No esperar en carril único
        if self._is_single_lane():
            return False

        # No esperar si hay coches atrás
        if self._has_cars_behind():
            return False

        # No esperar cerca de intersección (semáforo)
        if self._near_intersection():
            return False

        return True

    def _is_single_lane(self):
        """Detecta si está en calle de un solo carril."""
        x, y = self.cell.coordinate
        road = self._get_road_at_pos((x, y))
        if not road:
            return False

        orient = Orientation.from_string(road.direction)

        # Verificar carriles paralelos perpendiculares a la dirección
        if orient in [Orientation.UP, Orientation.DOWN]:
            checks = [(x-1, y), (x+1, y)]
        else:
            checks = [(x, y-1), (x, y+1)]

        for cx, cy in checks:
            if self._in_bounds((cx, cy)):
                adj_road = self._get_road_at_pos((cx, cy))
                if adj_road and adj_road.direction == road.direction:
                    return False  # Tiene carril paralelo

        return True  # Carril único

    def _has_cars_behind(self):
        """Detecta coches detrás que se bloquearían."""
        road = self._get_road_at_pos(self.cell.coordinate)
        if not road:
            return False

        orient = Orientation.from_string(road.direction)

        # "Atrás" es opuesto a la dirección
        back_offset = {
            Orientation.UP: (0, -1),
            Orientation.DOWN: (0, 1),
            Orientation.LEFT: (1, 0),
            Orientation.RIGHT: (-1, 0)
        }[orient]

        x, y = self.cell.coordinate
        for i in range(1, 4):
            bx, by = x + back_offset[0] * i, y + back_offset[1] * i
            if self._in_bounds((bx, by)):
                cell = self.model.grid[(bx, by)]
                if any(isinstance(a, Car) for a in cell.agents if a != self):
                    return True
        return False

    def _near_intersection(self):
        """Detecta si está cerca de una intersección (semáforo)."""
        x, y = self.cell.coordinate
        radius = 2

        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if self._in_bounds((x + dx, y + dy)):
                    cell = self.model.grid[(x + dx, y + dy)]
                    if any(isinstance(a, Traffic_Light) for a in cell.agents):
                        return True
        return False

    # =========================================================================
    # RUTA CIRCULAR
    # =========================================================================

    def _calculate_circular_route(self):
        """Calcula ruta circular cerca de la posición actual."""
        max_length = MAX_CIRCULAR_LENGTH
        queue = deque([(self.cell, [self.cell])])
        visited_paths = set()

        while queue:
            current, path = queue.popleft()

            if len(path) > max_length:
                continue

            path_key = tuple(c.coordinate for c in path)
            if path_key in visited_paths:
                continue
            visited_paths.add(path_key)

            road = self._get_road_at_pos(current.coordinate)
            if not road:
                continue

            # Siguiente celda según la dirección de la calle
            orient = Orientation.from_string(road.direction)
            dx, dy = orient.to_offset()
            nx, ny = current.coordinate[0] + dx, current.coordinate[1] + dy

            if not self._in_bounds((nx, ny)):
                continue

            next_cell = self.model.grid[(nx, ny)]

            # ¿Cierra el loop?
            if next_cell == self.cell and len(path) > 3:
                return path[1:]  # Excluir celda inicial

            # Evitar obstáculos en la ruta circular
            if self._has_obstacle(next_cell.coordinate):
                continue

            if next_cell not in path:
                if self._get_road_at_pos(next_cell.coordinate):
                    queue.append((next_cell, path + [next_cell]))

        return []  # Sin loop encontrado

    def _move_circular(self):
        """Sigue la ruta circular precalculada."""
        if not self.circular_route:
            # Fallback: intentar moverse normal
            self._move_normal()
            return False

        next_cell = self.circular_route[self.circular_idx]

        if self._can_move_to(next_cell):
            self.cell = next_cell
            self.pos = next_cell.coordinate  # Actualizar pos para visualización
            self.circular_idx = (self.circular_idx + 1) % len(self.circular_route)
            road = self._get_road_at_pos(self.cell.coordinate)
            if road:
                self.orientation = Orientation.from_string(road.direction)
                self.direction = self.orientation.to_string()
            return True
        return False

    def _can_move_to(self, target_cell):
        """Verifica si puede moverse a una celda objetivo."""
        # Verificar semáforo en celda actual
        traffic_lights = [a for a in self.cell.agents if isinstance(a, Traffic_Light)]
        if traffic_lights and not traffic_lights[0].state:
            self.waiting_at_light = True
            return False

        self.waiting_at_light = False

        # Verificar coche en destino
        if self._has_car(target_cell.coordinate):
            return False

        # Verificar accidente en destino
        if self._has_obstacle(target_cell.coordinate):
            return False

        return True

    # =========================================================================
    # MOVIMIENTO NORMAL (A*)
    # =========================================================================

    def _move_normal(self):
        """Movimiento normal siguiendo ruta A*."""
        # Recalcular ruta si está vacía
        if not self.path:
            self.path = self.find_path_astar()

        if not self.path:
            return False

        next_state = self.path[0]
        next_pos, next_orient = next_state
        next_cell = self.model.grid[next_pos]

        # Verificar semáforo
        traffic_lights = [a for a in self.cell.agents if isinstance(a, Traffic_Light)]
        if traffic_lights and not traffic_lights[0].state:
            self.waiting_at_light = True
            return False

        self.waiting_at_light = False

        # Verificar coche adelante
        if self._has_car(next_pos):
            self._mark_obstacle(next_pos, CAR_WEIGHT)
            return False

        # Verificar accidente
        if self._has_obstacle(next_pos):
            self._mark_obstacle(next_pos, ACCIDENT_WEIGHT)
            # Forzar recálculo de ruta
            self.path = []
            return False

        # Moverse
        self.path.pop(0)
        self.cell = next_cell
        self.pos = next_cell.coordinate  # Actualizar pos para visualización
        self.orientation = next_orient
        self.direction = self.orientation.to_string()

        return True

    # =========================================================================
    # STEP PRINCIPAL
    # =========================================================================

    def step(self):
        """Ejecuta un paso del agente."""
        # Verificar si llegó al destino
        if self.cell.coordinate == self.destination.coordinate:
            self.reached_destination = True
            self.remove()
            return

        # Actualizar modo según situación
        self._update_mode()

        # Ejecutar comportamiento según modo
        if self.mode == CarMode.NORMAL:
            self._move_normal()

        elif self.mode == CarMode.WAITING:
            self.waiting_steps += 1
            # No hacer nada, solo esperar

        elif self.mode == CarMode.CIRCULAR:
            self._move_circular()


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
        self.pos = cell.coordinate  # Requerido para visualización Mesa
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
        self.pos = cell.coordinate  # Requerido para visualización Mesa

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
        self.pos = cell.coordinate  # Requerido para visualización Mesa

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
        self.pos = cell.coordinate  # Requerido para visualización Mesa
        self.direction = direction

    def step(self):
        pass


class Accident(FixedAgent):
    """
    Accidente temporal que bloquea una celda de la calle.
    Se genera aleatoriamente y desaparece después de cierta duración.
    """
    def __init__(self, model, cell, duration=None):
        """
        Crea un nuevo accidente.
        Args:
            model: Referencia al modelo
            cell: Celda donde ocurre el accidente
            duration: Duración en steps (aleatorio si es None)
        """
        super().__init__(model)
        self.cell = cell
        self.pos = cell.coordinate  # Requerido para visualización Mesa
        self.duration = duration if duration else model.random.randint(20, 60)
        self.steps_active = 0
        self.is_active = True

    def step(self):
        """Incrementa contador y se elimina al expirar."""
        self.steps_active += 1
        if self.steps_active >= self.duration:
            self.is_active = False
            self.remove()
