/*
 * Functions to connect to traffic simulation API
 * Estructura de AgentsVisualization.api_connection.js
 *
 * 2024
 */

'use strict';

import { Object3D } from '../libs/object3d';

// Define the agent server URI
const agent_server_uri = "http://localhost:8585/";

// Initialize arrays to store different types of objects
const cars = [];
const trafficLights = [];
const obstacles = [];
const roads = [];
const destinations = [];

/* FUNCTIONS FOR THE INTERACTION WITH THE MESA SERVER */

/*
 * Initializes the traffic model by sending a POST request to the server.
 */
async function initTrafficModel() {
    try {
        // Send a POST request to initialize the model
        let response = await fetch(agent_server_uri + "init", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        // Check if the response was successful
        if (response.ok) {
            let result = await response.json();
            console.log(result.message);
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Retrieves the current positions of all cars from the server.
 */
async function getCars() {
    try {
        let response = await fetch(agent_server_uri + "getCars");

        if (response.ok) {
            let result = await response.json();

            // If cars array is empty, create new car objects
            if (cars.length == 0) {
                for (const car of result.positions) {
                    const newCar = new Object3D(car.id, [car.x, car.y, car.z]);
                    newCar.oldPosArray = newCar.posArray;
                    newCar.waiting = car.waiting;
                    cars.push(newCar);
                }
            } else {
                // Update existing car positions
                // Remove cars that no longer exist
                const currentIds = new Set(result.positions.map(c => c.id));
                for (let i = cars.length - 1; i >= 0; i--) {
                    if (!currentIds.has(cars[i].id)) {
                        cars.splice(i, 1);
                    }
                }

                // Update or add cars
                for (const car of result.positions) {
                    const current_car = cars.find((obj) => obj.id == car.id);

                    if (current_car != undefined) {
                        current_car.oldPosArray = current_car.posArray;
                        current_car.position = { x: car.x, y: car.y, z: car.z };
                        current_car.waiting = car.waiting;
                    } else {
                        // New car appeared
                        const newCar = new Object3D(car.id, [car.x, car.y, car.z]);
                        newCar.oldPosArray = newCar.posArray;
                        newCar.waiting = car.waiting;
                        cars.push(newCar);
                    }
                }
            }
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Retrieves traffic light positions and states.
 */
async function getTrafficLights() {
    try {
        let response = await fetch(agent_server_uri + "getTrafficLights");

        if (response.ok) {
            let result = await response.json();

            // Create traffic light objects only once
            if (trafficLights.length == 0) {
                for (const light of result.positions) {
                    const newLight = new Object3D(light.id, [light.x, light.y, light.z]);
                    newLight.state = light.state;
                    trafficLights.push(newLight);
                }
            } else {
                // Update traffic light states
                for (const light of result.positions) {
                    const current_light = trafficLights.find((obj) => obj.id == light.id);
                    if (current_light != undefined) {
                        current_light.state = light.state;
                    }
                }
            }
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Retrieves obstacle (building) positions.
 */
async function getObstacles() {
    try {
        let response = await fetch(agent_server_uri + "getObstacles");

        if (response.ok) {
            let result = await response.json();

            // Create obstacle objects only once
            for (const obstacle of result.positions) {
                const newObstacle = new Object3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
                obstacles.push(newObstacle);
            }
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Retrieves road positions.
 */
async function getRoads() {
    try {
        let response = await fetch(agent_server_uri + "getRoads");

        if (response.ok) {
            let result = await response.json();

            // Create road objects only once
            for (const road of result.positions) {
                const newRoad = new Object3D(road.id, [road.x, road.y, road.z]);
                newRoad.direction = road.direction;
                roads.push(newRoad);
            }
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Retrieves destination positions.
 */
async function getDestinations() {
    try {
        let response = await fetch(agent_server_uri + "getDestinations");

        if (response.ok) {
            let result = await response.json();

            // Create destination objects only once
            for (const dest of result.positions) {
                const newDest = new Object3D(dest.id, [dest.x, dest.y, dest.z]);
                destinations.push(newDest);
            }
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Updates the simulation by sending a request to the server.
 */
async function update() {
    try {
        let response = await fetch(agent_server_uri + "update");

        if (response.ok) {
            // Retrieve updated positions
            await getCars();
            await getTrafficLights();
        }

    } catch (error) {
        console.log(error);
    }
}

export {
    cars, trafficLights, obstacles, roads, destinations,
    initTrafficModel, update, getCars, getTrafficLights,
    getObstacles, getRoads, getDestinations
};
