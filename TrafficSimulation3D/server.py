# TC2008B. Sistemas Multiagentes y Gráficas Computacionales
# Python flask server to interact with WebGL visualization
# Estructura de AgentsVisualization.server_traffic.py

from flask import Flask, request, jsonify
from traffic_simulation.model import CityModel
from traffic_simulation.agent import Car, Road, Traffic_Light, Obstacle, Destination, drunkDriver

# Model instance
trafficModel = None
currentStep = 0

# This application will be used to interact with the WebGL visualization
app = Flask("Traffic 3D Simulation")

# Enable CORS for all routes
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST')
    return response

# Route to initialize the model
@app.route('/init', methods=['POST'])
def initModel():
    global currentStep, trafficModel

    if request.method == 'POST':
        currentStep = 0

        # Get parameters from request body
        data = request.get_json() or {}
        spawn_interval = data.get('spawn_interval', 10)
        drunk_crash_prob = data.get('drunk_crash_prob', 0.5)
        drunk_ignore_light_prob = data.get('drunk_ignore_light_prob', 0.3)
        drunk_wrong_way_prob = data.get('drunk_wrong_way_prob', 0.2)
        drunk_forget_route_prob = data.get('drunk_forget_route_prob', 0.15)
        drunk_zigzag_intensity = data.get('drunk_zigzag_intensity', 0.0)

        print(f"Initializing traffic model with spawn_interval={spawn_interval}...")

        # Create the model with all parameters
        trafficModel = CityModel(
            spawn_interval=spawn_interval,
            drunk_crash_prob=drunk_crash_prob,
            drunk_ignore_light_prob=drunk_ignore_light_prob,
            drunk_wrong_way_prob=drunk_wrong_way_prob,
            drunk_forget_route_prob=drunk_forget_route_prob,
            drunk_zigzag_intensity=drunk_zigzag_intensity
        )

        # Return success message
        return jsonify({
            "message": "Traffic model initialized successfully.",
            "spawn_interval": trafficModel.spawn_interval
        })

# Route to update spawn interval during simulation
@app.route('/setSpawnInterval', methods=['POST'])
def setSpawnInterval():
    global trafficModel

    if request.method == 'POST':
        data = request.get_json() or {}
        spawn_interval = data.get('spawn_interval', 10)

        if trafficModel:
            trafficModel.spawn_interval = max(1, int(spawn_interval))
            return jsonify({
                "message": f"Spawn interval updated to {trafficModel.spawn_interval}.",
                "spawn_interval": trafficModel.spawn_interval
            })
        else:
            return jsonify({"error": "Model not initialized."}), 400

# Route to get car positions
@app.route('/getCars', methods=['GET'])
def getCars():
    global trafficModel

    if request.method == 'GET':
        # Mapeo de direcciones a puntos cardinales
        direction_map = {
            "Up": "Norte",
            "Down": "Sur",
            "Right": "Este",
            "Left": "Oeste"
        }

        # Get the positions of the cars
        # y=0.25 para que esten sobre las calles (escala corregida del cubo base)
        carPositions = [
            {
                "id": str(car.unique_id),
                "x": float(car.cell.coordinate[0]),
                "y": 0.25,
                "z": float(car.cell.coordinate[1]),
                "waiting": car.waiting_at_light,
                "direction": direction_map.get(car.direction, "Norte"),
                "type": "drunk" if isinstance(car, drunkDriver) else "normal",
                "crashed": car.crashed if isinstance(car, drunkDriver) else False
            }
            for car in trafficModel.cars
        ]

        return jsonify({'positions': carPositions})

# Route to get traffic light positions and states
@app.route('/getTrafficLights', methods=['GET'])
def getTrafficLights():
    global trafficModel

    if request.method == 'GET':
        # Get the positions and states of traffic lights
        # y=0.4 para que esten sobre el suelo (escala 0.4, altura real 0.8, centro en 0.4)
        lightPositions = [
            {
                "id": str(light.unique_id),
                "x": float(light.cell.coordinate[0]),
                "y": 0.4,
                "z": float(light.cell.coordinate[1]),
                "state": light.state  # True = green, False = red
            }
            for light in trafficModel.traffic_lights
        ]

        return jsonify({'positions': lightPositions})

# Route to get obstacle positions (buildings)
@app.route('/getObstacles', methods=['GET'])
def getObstacles():
    global trafficModel

    if request.method == 'GET':
        # Get the positions of obstacles
        obstaclePositions = []

        for cell in trafficModel.grid.all_cells:
            x, z = cell.coordinate
            for agent in cell.agents:
                if isinstance(agent, Obstacle):
                    # y=0.0 porque los modelos OBJ tienen su base en Y=0
                    obstaclePositions.append({
                        "id": str(agent.unique_id),
                        "x": float(x),
                        "y": 0.0,
                        "z": float(z)
                    })

        return jsonify({'positions': obstaclePositions})

# Route to get road positions
@app.route('/getRoads', methods=['GET'])
def getRoads():
    global trafficModel

    if request.method == 'GET':
        # Get the positions of roads
        roadPositions = []

        for cell in trafficModel.grid.all_cells:
            x, z = cell.coordinate
            for agent in cell.agents:
                if isinstance(agent, Road):
                    roadPositions.append({
                        "id": str(agent.unique_id),
                        "x": float(x),
                        "y": 0.0,
                        "z": float(z),
                        "direction": agent.direction
                    })

        return jsonify({'positions': roadPositions})

# Route to get destination positions
@app.route('/getDestinations', methods=['GET'])
def getDestinations():
    global trafficModel

    if request.method == 'GET':
        # Get the positions of destinations
        destPositions = []

        for cell in trafficModel.grid.all_cells:
            x, z = cell.coordinate
            for agent in cell.agents:
                if isinstance(agent, Destination):
                    destPositions.append({
                        "id": str(agent.unique_id),
                        "x": float(x),
                        "y": 0.0,
                        "z": float(z)
                    })

        return jsonify({'positions': destPositions})

# Route to update the model
@app.route('/update', methods=['GET'])
def updateModel():
    global currentStep, trafficModel

    if request.method == 'GET':
        # Update the model
        trafficModel.step()
        currentStep += 1

        return jsonify({
            'message': f'Model updated to step {currentStep}.',
            'currentStep': currentStep,
            'running': trafficModel.running
        })

# Route to update drunk driver parameters during simulation
@app.route('/updateDrunkParams', methods=['POST'])
def updateDrunkParams():
    global trafficModel

    if request.method == 'POST':
        data = request.get_json() or {}

        if 'drunk_crash_prob' in data:
            trafficModel.drunk_crash_prob = data['drunk_crash_prob']
        if 'drunk_ignore_light_prob' in data:
            trafficModel.drunk_ignore_light_prob = data['drunk_ignore_light_prob']
        if 'drunk_wrong_way_prob' in data:
            trafficModel.drunk_wrong_way_prob = data['drunk_wrong_way_prob']
        if 'drunk_forget_route_prob' in data:
            trafficModel.drunk_forget_route_prob = data['drunk_forget_route_prob']
        if 'drunk_zigzag_intensity' in data:
            trafficModel.drunk_zigzag_intensity = data['drunk_zigzag_intensity']

        # Actualizar drunk drivers existentes
        for car in trafficModel.cars:
            if isinstance(car, drunkDriver):
                car.crash_prob = trafficModel.drunk_crash_prob
                car.ignore_light_prob = trafficModel.drunk_ignore_light_prob
                car.wrong_way_prob = trafficModel.drunk_wrong_way_prob
                car.forget_route_prob = trafficModel.drunk_forget_route_prob
                car.zigzag_intensity = trafficModel.drunk_zigzag_intensity

        return jsonify({"message": "Drunk driver parameters updated."})

if __name__ == '__main__':
    # Run the flask server
    app.run(host="localhost", port=8585, debug=True)
