/*
 * Traffic 3D Simulation with lighting and vehicle models
 * Estructura de CG-2025.base_lighting.js y AgentsVisualization.random_agents.js
 *
 * 2024
 */

'use strict';

import * as twgl from 'twgl.js';
import GUI from 'lil-gui';
import { M4 } from './libs/3d-lib';
import { Scene3D } from './libs/scene3d';
import { Object3D } from './libs/object3d';
import { Light3D } from './libs/light3d';
import { Camera3D } from './libs/camera3d';

// Functions and arrays for API communication
import {
    cars, trafficLights, obstacles, roads, destinations,
    initTrafficModel, update, getCars, getTrafficLights,
    getObstacles, getRoads, getDestinations
} from './libs/api_connection.js';

// Define the shader code, using GLSL 3.00
import vsGLSL from './assets/shaders/vs_phong_301.glsl?raw';
import fsGLSL from './assets/shaders/fs_phong_301.glsl?raw';

const scene = new Scene3D();

// Global variables
let phongProgramInfo = undefined;
let gl = undefined;
const duration = 1000; // ms
let elapsed = 0;
let then = 0;

// Base cube reference for dynamic objects
// Patrón de AgentsVisualization para compartir VAO
let baseCubeRef = null;

// Main function is async to make API requests
async function main() {
    // Setup the canvas area
    const canvas = document.querySelector('canvas');
    gl = canvas.getContext('webgl2');
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Prepare the program with the shaders
    phongProgramInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

    // Initialize the traffic model
    await initTrafficModel();

    // Get all static elements
    await getObstacles();
    await getRoads();
    await getDestinations();
    await getTrafficLights();

    // Get initial cars
    await getCars();

    // Initialize the scene
    setupScene();

    // Position the objects in the scene
    setupObjects(scene, gl, phongProgramInfo);

    // Prepare the user interface
    setupUI();

    // First call to the drawing loop
    drawScene();
}

function setupScene() {
    // Setup camera
    // Patrón de CG-2025.base_lighting.setupScene()
    let camera = new Camera3D(0,
        40,             // Distance to target
        0.8,              // Azimut
        0.5,              // Elevation
        [0, 0, 15],
        [0, 0, 0]);
    camera.panOffset = [15, 0, 15];
    scene.setCamera(camera);
    scene.camera.setupControls();

    // Setup lighting
    // Patrón de CG-2025.base_lighting.setupScene()
    let light = new Light3D(0,
        [15, 20, 15],              // Position
        [0.3, 0.3, 0.3, 1.0],   // Ambient
        [1.0, 1.0, 1.0, 1.0],   // Diffuse
        [1.0, 1.0, 1.0, 1.0]);  // Specular
    scene.addLight(light);
}

function setupObjects(scene, gl, programInfo) {
    // Create base shapes
    // Patrón de AgentsVisualization.random_agents.setupObjects()
    const baseCube = new Object3D(-1);
    baseCube.prepareVAO(gl, programInfo);
    baseCubeRef = baseCube;

    // Setup roads (gray ground)
    for (const road of roads) {
        road.arrays = baseCube.arrays;
        road.bufferInfo = baseCube.bufferInfo;
        road.vao = baseCube.vao;
        road.scale = { x: 1, y: 0.05, z: 1 };
        road.color = [0.3, 0.3, 0.3, 1.0];  // Gray
        scene.addObject(road);
    }

    // Setup destinations (green ground)
    for (const dest of destinations) {
        dest.arrays = baseCube.arrays;
        dest.bufferInfo = baseCube.bufferInfo;
        dest.vao = baseCube.vao;
        dest.scale = { x: 1, y: 0.05, z: 1 };
        dest.color = [0.2, 0.8, 0.2, 1.0];  // Green
        scene.addObject(dest);
    }

    // Setup obstacles (buildings - tall cubes)
    for (const obstacle of obstacles) {
        obstacle.arrays = baseCube.arrays;
        obstacle.bufferInfo = baseCube.bufferInfo;
        obstacle.vao = baseCube.vao;
        obstacle.scale = { x: 0.9, y: 3, z: 0.9 };
        obstacle.color = [0.6, 0.6, 0.7, 1.0];  // Light gray/blue
        scene.addObject(obstacle);
    }

    // Setup traffic lights (cubes that will change color)
    for (const light of trafficLights) {
        light.arrays = baseCube.arrays;
        light.bufferInfo = baseCube.bufferInfo;
        light.vao = baseCube.vao;
        light.scale = { x: 0.3, y: 0.8, z: 0.3 };
        // Color will be updated based on state
        light.color = light.state ? [0.0, 1.0, 0.0, 1.0] : [1.0, 0.0, 0.0, 1.0];
        scene.addObject(light);
    }

    // Setup cars (will be added dynamically)
    // Patrón de AgentsVisualization.random_agents.setupObjects()
    for (const car of cars) {
        car.arrays = baseCube.arrays;
        car.bufferInfo = baseCube.bufferInfo;
        car.vao = baseCube.vao;
        car.scale = { x: 0.6, y: 0.4, z: 0.4 };
        car.color = [Math.random(), Math.random(), Math.random(), 1.0];
        scene.addObject(car);
    }
}

// Draw an object with its corresponding transformations
function drawObject(gl, programInfo, object, viewProjectionMatrix, fract) {
    // Prepare the vector for translation and scale
    // Patrón de CG-2025.base_lighting.drawObject()
    let v3_tra = object.posArray;
    let v3_sca = object.scaArray;

    // Create the individual transform matrices
    const scaMat = M4.scale(v3_sca);
    const rotXMat = M4.rotationX(object.rotRad.x);
    const rotYMat = M4.rotationY(object.rotRad.y);
    const rotZMat = M4.rotationZ(object.rotRad.z);
    const traMat = M4.translation(v3_tra);

    // Create the composite matrix with all transformations
    let transforms = M4.identity();
    transforms = M4.multiply(scaMat, transforms);
    transforms = M4.multiply(rotXMat, transforms);
    transforms = M4.multiply(rotYMat, transforms);
    transforms = M4.multiply(rotZMat, transforms);
    transforms = M4.multiply(traMat, transforms);

    object.matrix = transforms;

    // Apply the projection to the final matrix
    const wvpMat = M4.multiply(viewProjectionMatrix, transforms);

    // The matrix for normal transformations
    const normalMat = M4.transpose(M4.inverse(object.matrix));

    // Model uniforms
    // Patrón de CG-2025.base_lighting para uniforms de Phong
    let objectUniforms = {
        u_transforms: wvpMat,
        u_modelMatrix: object.matrix,
        u_normalMatrix: normalMat,
        u_materialColor: object.color,
        u_materialShininess: object.shininess,
        u_lightPosition: scene.lights[0].posArray,
        u_lightAmbient: scene.lights[0].ambient,
        u_lightDiffuse: scene.lights[0].diffuse,
        u_lightSpecular: scene.lights[0].specular,
        u_viewPosition: scene.camera.posArray
    }
    twgl.setUniforms(programInfo, objectUniforms);

    gl.bindVertexArray(object.vao);
    twgl.drawBufferInfo(gl, object.bufferInfo);
}

// Draw a car
// Patrón de AgentsVisualization.random_agents para dibujar agentes
function drawCar(gl, programInfo, car, viewProjectionMatrix, fract) {
    // Draw car body
    drawObject(gl, programInfo, car, viewProjectionMatrix, fract);
}

// Function to do the actual display of the objects
async function drawScene() {
    // Compute time elapsed since last frame
    // Patrón de AgentsVisualization.random_agents.drawScene()
    let now = Date.now();
    let deltaTime = now - then;
    elapsed += deltaTime;
    let fract = Math.min(1.0, elapsed / duration);
    then = now;

    // Clear the canvas
    gl.clearColor(0.1, 0.1, 0.15, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Enable face culling and depth testing
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    scene.camera.checkKeys();
    const viewProjectionMatrix = setupViewProjection(gl);

    gl.useProgram(phongProgramInfo.program);

    // Update traffic light colors based on state
    // Usar iluminación para visualizar colores de semáforos
    for (const light of trafficLights) {
        if (light.state) {
            // Green light - bright green with emission
            light.color = [0.0, 1.0, 0.0, 1.0];
            light.shininess = 200;
        } else {
            // Red light - bright red with emission
            light.color = [1.0, 0.0, 0.0, 1.0];
            light.shininess = 200;
        }
    }

    // Draw static objects (roads, destinations, obstacles, traffic lights)
    for (let object of scene.objects) {
        // Skip cars, they will be drawn separately with wheels
        if (cars.includes(object)) {
            continue;
        }
        drawObject(gl, phongProgramInfo, object, viewProjectionMatrix, fract);
    }

    // Draw cars with wheels
    for (const car of cars) {
        drawCar(gl, phongProgramInfo, car, viewProjectionMatrix, fract);
    }

    // Add new cars to scene if they don't exist
    // Patrón de AgentsVisualization para agregar agentes dinámicamente
    for (const car of cars) {
        if (!scene.objects.includes(car)) {
            car.arrays = baseCubeRef.arrays;
            car.bufferInfo = baseCubeRef.bufferInfo;
            car.vao = baseCubeRef.vao;
            car.scale = { x: 0.6, y: 0.4, z: 0.4 };
            car.color = [Math.random(), Math.random(), Math.random(), 1.0];
            scene.addObject(car);
        }
    }

    // Update the scene after the elapsed duration
    if (elapsed >= duration) {
        elapsed = 0;
        await update();
    }

    requestAnimationFrame(drawScene);
}

function setupViewProjection(gl) {
    // Field of view of 60 degrees vertically, in radians
    // Patrón de CG-2025.base_lighting.setupViewProjection()
    const fov = 60 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

    // Matrices for the world view
    const projectionMatrix = M4.perspective(fov, aspect, 1, 200);

    const cameraPosition = scene.camera.posArray;
    const target = scene.camera.targetArray;
    const up = [0, 1, 0];

    const cameraMatrix = M4.lookAt(cameraPosition, target, up);
    const viewMatrix = M4.inverse(cameraMatrix);
    const viewProjectionMatrix = M4.multiply(projectionMatrix, viewMatrix);

    return viewProjectionMatrix;
}

// Setup a ui
function setupUI() {
    // Patrón de CG-2025.base_lighting.setupUI()
    const gui = new GUI();

    // Settings for the light
    const lightFolder = gui.addFolder('Light:')
    lightFolder.add(scene.lights[0].position, 'x', -30, 30)
        .decimals(2)
    lightFolder.add(scene.lights[0].position, 'y', 0, 40)
        .decimals(2)
    lightFolder.add(scene.lights[0].position, 'z', -30, 30)
        .decimals(2)

    lightFolder.addColor(scene.lights[0], 'ambient')
    lightFolder.addColor(scene.lights[0], 'diffuse')
    lightFolder.addColor(scene.lights[0], 'specular')
}

main();
