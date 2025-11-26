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

// Car model reference
let carModelRef = null;

// Test car reference para animarlo
let testCarRef = null;

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

    // Load car model
    await loadCarModel(gl, phongProgramInfo);

    // Initialize the scene
    setupScene();

    // Position the objects in the scene
    setupObjects(scene, gl, phongProgramInfo);

    // Prepare the user interface
    setupUI();

    // First call to the drawing loop
    drawScene();
}

// Cargar el modelo 3D del coche desde el archivo OBJ
async function loadCarModel(gl, programInfo) {
    try {
        // Hacer fetch del archivo OBJ desde la carpeta public
        // Vite sirve automaticamente los archivos de public/ desde la raiz
        // Usando coche_ciudadano.obj que es el coche normal
        const response = await fetch('/car_files/coche_ciudadano.obj');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const objText = await response.text();

        console.log('Archivo cargado, primeras 200 caracteres:');
        console.log(objText.substring(0, 200));
        console.log('Tamaño del archivo:', objText.length, 'caracteres');

        // Crear un objeto 3D con el modelo cargado
        // Este objeto se usara como referencia para todos los coches
        carModelRef = new Object3D(-2);
        carModelRef.prepareVAO(gl, programInfo, objText);

        console.log('Modelo de coche cargado exitosamente');
    } catch (error) {
        console.error('Error cargando modelo de coche:', error);
        console.log('Usando modelo de cubo como alternativa');
        // Si falla la carga carModelRef quedara null y los coches usaran cubos
    }
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

    // Ya no creamos coche de prueba porque el modelo funciona correctamente

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

    // Configurar coches que se agregaran dinamicamente
    // Al inicio puede que no haya coches pero se iran agregando durante la simulacion
    for (const car of cars) {
        // Usar el modelo de coche si se cargo correctamente sino usar un cubo
        if (carModelRef) {
            car.arrays = carModelRef.arrays;
            car.bufferInfo = carModelRef.bufferInfo;
            car.vao = carModelRef.vao;
            car.scale = { x: 0.5, y: 0.5, z: 0.5 }; // Escala ajustada para el modelo 3D
        } else {
            car.arrays = baseCube.arrays;
            car.bufferInfo = baseCube.bufferInfo;
            car.vao = baseCube.vao;
            car.scale = { x: 0.6, y: 0.4, z: 0.4 };
        }
        // Cada coche tiene un color aleatorio para distinguirlos
        car.color = [Math.random(), Math.random(), Math.random(), 1.0];
        scene.addObject(car);
    }
}

// Dibujar un objeto con sus transformaciones correspondientes
function drawObject(gl, programInfo, object, viewProjectionMatrix, fract) {
    // Verificar que el objeto tenga datos validos antes de dibujarlo
    // Esto previene errores cuando un objeto no se ha inicializado completamente
    if (!object.vao || !object.bufferInfo) {
        return;
    }

    // Preparar los vectores para traslacion y escala
    let v3_tra = object.posArray;
    let v3_sca = object.scaArray;

    // Crear las matrices de transformacion individuales
    const scaMat = M4.scale(v3_sca);
    const rotXMat = M4.rotationX(object.rotRad.x);
    const rotYMat = M4.rotationY(object.rotRad.y);
    const rotZMat = M4.rotationZ(object.rotRad.z);
    const traMat = M4.translation(v3_tra);

    // Crear la matriz compuesta con todas las transformaciones
    // Se aplican en orden escala rotacion traslacion
    let transforms = M4.identity();
    transforms = M4.multiply(scaMat, transforms);
    transforms = M4.multiply(rotXMat, transforms);
    transforms = M4.multiply(rotYMat, transforms);
    transforms = M4.multiply(rotZMat, transforms);
    transforms = M4.multiply(traMat, transforms);

    object.matrix = transforms;

    // Aplicar la proyeccion a la matriz final
    const wvpMat = M4.multiply(viewProjectionMatrix, transforms);

    // La matriz para transformaciones de normales
    // Necesaria para que la iluminacion funcione correctamente
    const normalMat = M4.transpose(M4.inverse(object.matrix));

    // Uniforms del modelo para el shader de Phong
    // Estos valores se pasan al shader para calcular la iluminacion
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

    // Dibujar el objeto usando su VAO y buffer info
    gl.bindVertexArray(object.vao);
    twgl.drawBufferInfo(gl, object.bufferInfo);
}

// Dibujar un coche con su modelo 3D
function drawCar(gl, programInfo, car, viewProjectionMatrix, fract) {
    // Dibujar el cuerpo del coche usando el modelo 3D cargado
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

    // Deshabilitar face culling para ver ambos lados de las caras
    // Esto muestra las caras desde ambos lados y arregla las "paredes" raras
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Actualizar follow mode antes de checkear keys
    scene.camera.updateFollowMode();
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

    // Debug: contar cuantos objetos hay en la escena solo la primera vez
    if (!window.debugLogged) {
        console.log('Total objetos en escena:', scene.objects.length);
        console.log('Coches de la API:', cars.length);
        window.debugLogged = true;
    }

    // Ya no animamos el coche de prueba porque lo quitamos

    // Actualizar dropdown de coches disponibles
    if (window.carIdController && cars.length > 0) {
        const currentCarIds = cars.map(c => c.id);
        const dropdownOptions = ['None', ...currentCarIds];

        // Solo actualizar si cambio el numero de coches
        if (!window.lastCarCount || window.lastCarCount !== cars.length) {
            // Destruir el controller viejo
            window.carIdController.destroy();

            // Crear uno nuevo con las opciones actualizadas
            const cameraFolder = window.carIdController.parent;
            window.carIdController = cameraFolder.add(window.cameraControls, 'carId', dropdownOptions)
                .name('Car ID')
                .onChange((carId) => {
                    if (carId === 'None') {
                        scene.camera.followTarget = null;
                        scene.camera.followMode = false;
                        window.cameraControls.followMode = false;
                    } else {
                        const car = cars.find(c => c.id === carId);
                        if (car) {
                            scene.camera.followTarget = car;
                            scene.camera.followMode = true;
                            window.cameraControls.followMode = true;
                        }
                    }
                });

            window.lastCarCount = cars.length;
        }
    }

    // Dibujar todos los coches
    // Esto dibuja cada coche usando su modelo 3D o cubo
    for (const car of cars) {
        drawCar(gl, phongProgramInfo, car, viewProjectionMatrix, fract);
    }

    // Agregar coches nuevos a la escena si no existen ya
    // Esto maneja coches que aparecen durante la simulacion
    for (const car of cars) {
        if (!scene.objects.includes(car)) {
            // Usar el modelo de coche si se cargo correctamente sino usar un cubo
            if (carModelRef) {
                car.arrays = carModelRef.arrays;
                car.bufferInfo = carModelRef.bufferInfo;
                car.vao = carModelRef.vao;
                car.scale = { x: 0.5, y: 0.5, z: 0.5 };
            } else {
                car.arrays = baseCubeRef.arrays;
                car.bufferInfo = baseCubeRef.bufferInfo;
                car.vao = baseCubeRef.vao;
                car.scale = { x: 0.6, y: 0.4, z: 0.4 };
            }
            // Color aleatorio para cada coche nuevo
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

    // Camera follow controls
    const cameraFolder = gui.addFolder('Camera Follow:')

    // Objeto para controlar el GUI
    const cameraControls = {
        followMode: false,
        carId: 'None',
        followDistance: 15
    };

    // Toggle follow mode
    cameraFolder.add(cameraControls, 'followMode')
        .name('Follow Mode')
        .onChange((value) => {
            scene.camera.followMode = value;
            if (!value) {
                scene.camera.followTarget = null;
            }
        });

    // Dropdown para seleccionar coche (se actualizara dinamicamente)
    const carIdController = cameraFolder.add(cameraControls, 'carId', ['None'])
        .name('Car ID')
        .onChange((carId) => {
            if (carId === 'None') {
                scene.camera.followTarget = null;
                scene.camera.followMode = false;
                cameraControls.followMode = false;
            } else {
                // Buscar el coche por ID
                const car = cars.find(c => c.id === carId);
                if (car) {
                    scene.camera.followTarget = car;
                    scene.camera.followMode = true;
                    cameraControls.followMode = true;
                }
            }
        });

    // Control de distancia
    cameraFolder.add(cameraControls, 'followDistance', 5, 30)
        .name('Distance')
        .onChange((value) => {
            scene.camera.followDistance = value;
        });

    // Guardar referencia para actualizar el dropdown
    window.carIdController = carIdController;
    window.cameraControls = cameraControls;
}

main();
