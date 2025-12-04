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
    getObstacles, getRoads, getDestinations, setSpawnInterval,
    normalCarParams, updateNormalParams,
    drunkDriverParams, updateDrunkParams
} from './libs/api_connection.js';

// Define the shader code, using GLSL 3.00
import vsGLSL from './assets/shaders/vs_phong_301.glsl?raw';
import fsGLSL from './assets/shaders/fs_phong_301.glsl?raw';

// Shaders de emision para semaforos
import vsEmissionGLSL from './assets/shaders/vs_emission_301.glsl?raw';
import fsEmissionGLSL from './assets/shaders/fs_emission_301.glsl?raw';

const scene = new Scene3D();

// Global variables
let phongProgramInfo = undefined;
let emissionProgramInfo = undefined;
let gl = undefined;
let duration = 1000; // ms - ahora es variable para poder ajustarla con el slider
let elapsed = 0;
let then = 0;

// Base cube reference for dynamic objects
// Patrón de AgentsVisualization para compartir VAO
let baseCubeRef = null;

// Car model reference
let carModelRef = null;

// Drunk driver model reference
let drunkDriverModelRef = null;

// Building model references
// Array de modelos de edificios para asignar aleatoriamente
let buildingModelRefs = [];

// Traffic light model reference
let trafficLightModelRef = null;

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

    // Prepare the emission program for traffic lights
    emissionProgramInfo = twgl.createProgramInfo(gl, [vsEmissionGLSL, fsEmissionGLSL]);

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

    // Load drunk driver model
    await loadDrunkDriverModel(gl, phongProgramInfo);

    // Load building models
    await loadBuildingModels(gl, phongProgramInfo);

    // Load traffic light model
    await loadTrafficLightModel(gl, emissionProgramInfo);

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

// Cargar el modelo 3D del borrachin para drunk drivers
async function loadDrunkDriverModel(gl, programInfo) {
    try {
        const response = await fetch('/car_files/borrachin.obj');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const objText = await response.text();

        console.log('Drunk driver model loaded, size:', objText.length, 'characters');

        drunkDriverModelRef = new Object3D(-50);
        drunkDriverModelRef.prepareVAO(gl, programInfo, objText);

        console.log('BEFORE TRANSFORMATION:');
        console.log('  - Arrays exist:', !!drunkDriverModelRef.arrays);
        console.log('  - Position data exists:', !!drunkDriverModelRef.arrays.a_position);
        console.log('  - Position data length:', drunkDriverModelRef.arrays.a_position?.data?.length);
        console.log('  - First 10 vertices:', drunkDriverModelRef.arrays.a_position?.data?.slice(0, 30));

        // Transform the model vertices to fix orientation
        // Applying proper transformation matrices: Ry(-90°) * Rx(90°)
        if (drunkDriverModelRef.arrays && drunkDriverModelRef.arrays.a_position) {
            const positions = drunkDriverModelRef.arrays.a_position.data;
            const normals = drunkDriverModelRef.arrays.a_normal?.data;

            // Create temporary arrays to store transformed positions
            const newPositions = new Float32Array(positions.length);
            const newNormals = normals ? new Float32Array(normals.length) : null;

            // Copy original positions
            for (let i = 0; i < positions.length; i++) {
                newPositions[i] = positions[i];
            }
            if (normals) {
                for (let i = 0; i < normals.length; i++) {
                    newNormals[i] = normals[i];
                }
            }

            // Build rotation matrices
            // Rotation around Y axis by -90 degrees
            const angleY = -Math.PI / 2;
            const cosY = Math.cos(angleY);
            const sinY = Math.sin(angleY);

            // Rotation around X axis by 90 degrees
            const angleX = Math.PI / 2;
            const cosX = Math.cos(angleX);
            const sinX = Math.sin(angleX);

            // Additional 180 degree rotation on X axis to flip upside down
            const angleX2 = Math.PI; // 180 degrees
            const cosX2 = Math.cos(angleX2);
            const sinX2 = Math.sin(angleX2);

            // Combined rotation matrix: Ry(-90°) * Rx(90°) * Rx(180°)
            // Applying transformations: First Y, then X, then X again
            // Simplified: Rx(180°) * Rx(90°) = Rx(270°) or Rx(-90°)
            // So the combined is: Ry(-90°) * Rx(-90°)
            const angleXCombined = -Math.PI / 2; // 90 + 180 = 270 = -90
            const cosXC = Math.cos(angleXCombined);
            const sinXC = Math.sin(angleXCombined);

            // Combined rotation matrix: Rx * Ry (applied right to left)
            const m00 = cosY;
            const m01 = sinXC * sinY;
            const m02 = cosXC * sinY;
            const m10 = 0;
            const m11 = cosXC;
            const m12 = -sinXC;
            const m20 = -sinY;
            const m21 = sinXC * cosY;
            const m22 = cosXC * cosY;

            // Apply combined rotation to each vertex
            for (let i = 0; i < positions.length; i += 3) {
                const x = newPositions[i];
                const y = newPositions[i + 1];
                const z = newPositions[i + 2];

                positions[i]     = m00 * x + m01 * y + m02 * z;
                positions[i + 1] = m10 * x + m11 * y + m12 * z;
                positions[i + 2] = m20 * x + m21 * y + m22 * z;
            }

            // Apply same rotation to normals
            if (normals && newNormals) {
                for (let i = 0; i < normals.length; i += 3) {
                    const nx = newNormals[i];
                    const ny = newNormals[i + 1];
                    const nz = newNormals[i + 2];

                    normals[i]     = m00 * nx + m01 * ny + m02 * nz;
                    normals[i + 1] = m10 * nx + m11 * ny + m12 * nz;
                    normals[i + 2] = m20 * nx + m21 * ny + m22 * nz;
                }
            }

            // Recreate buffers with transformed vertices
            drunkDriverModelRef.bufferInfo = twgl.createBufferInfoFromArrays(gl, drunkDriverModelRef.arrays);
            drunkDriverModelRef.vao = twgl.createVAOFromBufferInfo(gl, programInfo, drunkDriverModelRef.bufferInfo);

            console.log('AFTER TRANSFORMATION:');
            console.log('  - First 10 transformed vertices:', drunkDriverModelRef.arrays.a_position?.data?.slice(0, 30));
            console.log('  - BufferInfo recreated:', !!drunkDriverModelRef.bufferInfo);
            console.log('  - VAO recreated:', !!drunkDriverModelRef.vao);
        } else {
            console.error('TRANSFORMATION FAILED: Arrays not accessible');
        }

        console.log('Drunk driver model loaded and transformed successfully');
    } catch (error) {
        console.error('Error loading drunk driver model:', error);
        console.log('Using cube model as fallback for drunk drivers');
    }
}

// Cargar los modelos 3D de edificios desde archivos OBJ
// Patron de loadCarModel adaptado para multiples modelos
async function loadBuildingModels(gl, programInfo) {
    // Lista de archivos de edificios generados con BuildingGenerator
    // Variedad de formas: triangulares, cuadrados, pentagonales, hexagonales, octagonales, cilindricos
    const buildingFiles = [
        '/building_files/building_3_2_0.35_0.2.obj',        // Triangular piramide
        '/building_files/building_4_3_0.4_0.35.obj',        // Cuadrado cono truncado
        '/building_files/building_4_3_0.45_0.2.obj',        // Cuadrado piramide
        '/building_files/building_4_4.5_0.3_0.3.obj',       // Cuadrado torre
        '/building_files/building_5_2.5_0.35_0.3.obj',      // Pentagonal bajo
        '/building_files/building_5_5_0.25_0.4.obj',        // Pentagonal expandido (mas ancho arriba)
        '/building_files/building_6_3.5_0.4_0.3.obj',       // Hexagonal cono truncado
        '/building_files/building_6_4_0.2_0.45.obj',        // Hexagonal invertido (mas ancho arriba)
        '/building_files/building_8_3.5_0.5_0.15.obj',      // Octagonal cono puntiagudo
        '/building_files/building_8_4_0.4_0.25.obj',        // Octagonal cono truncado
        '/building_files/building_12_3_0.4_0.35.obj'        // Cilindrico
    ];

    for (const file of buildingFiles) {
        try {
            // Hacer fetch del archivo OBJ desde la carpeta public
            // Vite sirve automaticamente los archivos de public/ desde la raiz
            const response = await fetch(file);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const objText = await response.text();

            console.log('Edificio cargado:', file);
            console.log('Tamaño del archivo:', objText.length, 'caracteres');

            // Crear un objeto 3D con el modelo cargado
            // Este objeto se usara como referencia para edificios
            const buildingModel = new Object3D(-3 - buildingModelRefs.length);
            buildingModel.prepareVAO(gl, programInfo, objText);

            buildingModelRefs.push(buildingModel);

            console.log('Modelo de edificio cargado exitosamente:', file);
        } catch (error) {
            console.error('Error cargando modelo de edificio:', file, error);
            // Si falla la carga continuamos con los otros modelos
        }
    }

    console.log('Total modelos de edificios cargados:', buildingModelRefs.length);
}

// Cargar el modelo 3D del semaforo desde el archivo OBJ
// Patron de loadCarModel
async function loadTrafficLightModel(gl, programInfo) {
    try {
        // Hacer fetch del archivo OBJ desde la carpeta public
        // Vite sirve automaticamente los archivos de public/ desde la raiz
        const response = await fetch('/traffic_light_files/traffic_light.obj');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const objText = await response.text();

        console.log('Semaforo cargado, tamaño:', objText.length, 'caracteres');

        // Crear un objeto 3D con el modelo cargado
        // Este objeto se usara como referencia para todos los semaforos
        trafficLightModelRef = new Object3D(-100);
        trafficLightModelRef.prepareVAO(gl, programInfo, objText);

        console.log('Modelo de semaforo cargado exitosamente');
    } catch (error) {
        console.error('Error cargando modelo de semaforo:', error);
        console.log('Usando modelo de cubo como alternativa');
        // Si falla la carga trafficLightModelRef quedara null y los semaforos usaran cubos
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
    // Luz difusa y suave para iluminacion mas natural
    let light = new Light3D(0,
        [15, 20, 15],              // Position
        [0.3, 0.3, 0.3, 1.0],      // Ambient (suave)
        [0.6, 0.6, 0.6, 1.0],      // Diffuse (moderado)
        [0.4, 0.4, 0.4, 1.0]);     // Specular (reducido)
    scene.addLight(light);
}

function setupObjects(scene, gl, programInfo) {
    // Create base shapes
    // Patrón de AgentsVisualization.random_agents.setupObjects()
    const baseCube = new Object3D(-1);
    baseCube.prepareVAO(gl, programInfo);
    baseCubeRef = baseCube;

    // Setup roads (gray ground)
    // Escala 0.5 porque el cubo base tiene 2 unidades (de -1 a 1) y las celdas son de 1 unidad
    for (const road of roads) {
        road.arrays = baseCube.arrays;
        road.bufferInfo = baseCube.bufferInfo;
        road.vao = baseCube.vao;
        road.scale = { x: 0.5, y: 0.025, z: 0.5 };
        road.color = [0.3, 0.3, 0.3, 1.0];  // Gray
        scene.addObject(road);
    }

    // Setup destinations (green ground)
    // Escala 0.5 porque el cubo base tiene 2 unidades (de -1 a 1) y las celdas son de 1 unidad
    for (const dest of destinations) {
        dest.arrays = baseCube.arrays;
        dest.bufferInfo = baseCube.bufferInfo;
        dest.vao = baseCube.vao;
        dest.scale = { x: 0.5, y: 0.025, z: 0.5 };
        dest.color = [0.2, 0.8, 0.2, 1.0];  // Green
        scene.addObject(dest);
    }

    // Setup obstacles (buildings - usando modelos OBJ generados)
    // Escala 0.45 para que ocupen 0.9 unidades (90% de una celda de 1 unidad)
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];

        // Agregar tile de suelo debajo de cada edificio
        // Patron de roads para crear suelo consistente
        const groundTile = new Object3D('ground_' + obstacle.id, [obstacle.position.x, 0.03, obstacle.position.z]);
        groundTile.arrays = baseCube.arrays;
        groundTile.bufferInfo = baseCube.bufferInfo;
        groundTile.vao = baseCube.vao;
        groundTile.scale = { x: 0.5, y: 0.025, z: 0.5 };
        groundTile.color = [0.2, 0.2, 0.2, 1.0];  // Dark gray for building ground
        scene.addObject(groundTile);

        // Usar modelo de edificio si se cargo correctamente sino usar cubo
        if (buildingModelRefs.length > 0) {
            // Asignar modelo de edificio basado en el indice para variedad
            const modelIndex = i % buildingModelRefs.length;
            const buildingModel = buildingModelRefs[modelIndex];
            obstacle.arrays = buildingModel.arrays;
            obstacle.bufferInfo = buildingModel.bufferInfo;
            obstacle.vao = buildingModel.vao;
            obstacle.scale = { x: 0.45, y: 0.45, z: 0.45 }; // Escala para modelos OBJ
            // Offset upward to show floor beneath
            obstacle.position.y += 0.05;
        } else {
            obstacle.arrays = baseCube.arrays;
            obstacle.bufferInfo = baseCube.bufferInfo;
            obstacle.vao = baseCube.vao;
            obstacle.scale = { x: 0.45, y: 1.5, z: 0.45 };
            // Offset upward to show floor beneath
            obstacle.position.y += 0.75;
        }
        obstacle.color = [0.6, 0.6, 0.7, 1.0];  // Light gray/blue
        scene.addObject(obstacle);
    }

    // Setup traffic lights (usando modelo OBJ y shader de emision)
    for (const light of trafficLights) {
        // Agregar tile de suelo debajo de cada semaforo
        // Patron de roads para crear suelo consistente
        const groundTile = new Object3D('ground_light_' + light.id, [light.position.x, 0, light.position.z]);
        groundTile.arrays = baseCube.arrays;
        groundTile.bufferInfo = baseCube.bufferInfo;
        groundTile.vao = baseCube.vao;
        groundTile.scale = { x: 0.5, y: 0.025, z: 0.5 };
        groundTile.color = [0.3, 0.3, 0.3, 0.0];  // Transparent
        scene.addObject(groundTile);

        // Usar modelo de semaforo si se cargo correctamente sino usar cubo
        if (trafficLightModelRef) {
            light.arrays = trafficLightModelRef.arrays;
            light.bufferInfo = trafficLightModelRef.bufferInfo;
            light.vao = trafficLightModelRef.vao;
            light.scale = { x: 0.4, y: 0.4, z: 0.4 }; // Escala para modelo OBJ
        } else {
            light.arrays = baseCube.arrays;
            light.bufferInfo = baseCube.bufferInfo;
            light.vao = baseCube.vao;
            light.scale = { x: 0.15, y: 0.4, z: 0.15 };
        }
        // Color will be updated based on state
        // Marcar como objeto emisivo para usar shader de emision
        light.isEmissive = true;
        light.color = light.state ? [0.0, 1.0, 0.0, 1.0] : [1.0, 0.0, 0.0, 1.0];
        // Ajustar altura del semaforo
        light.position.y = 0.1;
        scene.addObject(light);
    }

    // Configurar coches que se agregaran dinamicamente
    // Al inicio puede que no haya coches pero se iran agregando durante la simulacion
    // Escala 0.25 para mantener proporcion correcta con el cubo base de 2 unidades
    for (const car of cars) {
        // Usar drunk driver model para drunk drivers, modelo normal para coches normales
        if (car.type === 'drunk' && drunkDriverModelRef) {
            console.log('Assigning drunk driver model to car:', car.id);
            console.log('  - Using drunkDriverModelRef with', drunkDriverModelRef.arrays.a_position?.data?.length / 3, 'vertices');
            console.log('  - First 10 vertices from ref:', drunkDriverModelRef.arrays.a_position?.data?.slice(0, 30));
            car.arrays = drunkDriverModelRef.arrays;
            car.bufferInfo = drunkDriverModelRef.bufferInfo;
            car.vao = drunkDriverModelRef.vao;
            car.scale = { x: 0.25, y: 0.25, z: 0.25 };
        } else if (carModelRef) {
            car.arrays = carModelRef.arrays;
            car.bufferInfo = carModelRef.bufferInfo;
            car.vao = carModelRef.vao;
            car.scale = { x: 0.25, y: 0.25, z: 0.25 };
        } else {
            car.arrays = baseCube.arrays;
            car.bufferInfo = baseCube.bufferInfo;
            car.vao = baseCube.vao;
            car.scale = { x: 0.3, y: 0.2, z: 0.2 };
        }

        // Color especial para drunk drivers (rojo si crasheó)
        if (car.type === 'drunk') {
            car.color = car.crashed ? [1.0, 0.0, 0.0, 1.0] : [0.8, 0.8, 0.0, 1.0]; // Amarillo o rojo
        } else {
            car.color = [Math.random(), Math.random(), Math.random(), 1.0];
        }

        // Guardar posicion inicial para interpolacion
        car.startPos = { x: car.position.x, y: car.position.y, z: car.position.z };
        car.targetPos = { x: car.position.x, y: car.position.y, z: car.position.z };

        scene.addObject(car);
    }
}

// Preparar arrays de posiciones y colores de semaforos para el shader
// Maximo 30 semaforos segun el shader
const MAX_TRAFFIC_LIGHTS = 30;
const MAX_CARS = 50;

function getTrafficLightUniforms() {
    const positions = [];
    const colors = [];
    const numLights = Math.min(trafficLights.length, MAX_TRAFFIC_LIGHTS);

    for (let i = 0; i < MAX_TRAFFIC_LIGHTS; i++) {
        if (i < trafficLights.length) {
            const light = trafficLights[i];
            positions.push(light.position.x, light.position.y, light.position.z);
            colors.push(light.color[0], light.color[1], light.color[2], light.color[3]);
        } else {
            // Llenar con ceros para los slots no usados
            positions.push(0, 0, 0);
            colors.push(0, 0, 0, 0);
        }
    }

    return {
        u_trafficLightPositions: positions,
        u_trafficLightColors: colors,
        u_numTrafficLights: numLights
    };
}

// Preparar arrays de posiciones de coches para el shader
// Patron de getTrafficLightUniforms
function getCarUniforms(fract) {
    const positions = [];
    const numCars = Math.min(cars.length, MAX_CARS);

    for (let i = 0; i < MAX_CARS; i++) {
        if (i < cars.length) {
            const car = cars[i];
            // Interpolar posicion de luz igual que la posicion del coche
            if (car.startPos && car.targetPos) {
                const x = car.startPos.x + (car.targetPos.x - car.startPos.x) * fract;
                const y = car.startPos.y + (car.targetPos.y - car.startPos.y) * fract;
                const z = car.startPos.z + (car.targetPos.z - car.startPos.z) * fract;
                positions.push(x, y, z);
            } else {
                positions.push(car.position.x, car.position.y, car.position.z);
            }
        } else {
            // Llenar con posiciones muy lejanas para no afectar iluminacion
            positions.push(1000.0, 1000.0, 1000.0);
        }
    }

    return {
        u_carPositions: positions,
        u_numCars: numCars
    };
}

// Convertir direccion del coche a angulo de rotacion
function getRotationFromDirection(direction) {
    // Ajustar rotacion segun la direccion
    const directionAngles = {
        "Norte": 0,
        "Este": Math.PI / 2,
        "Sur": Math.PI,
        "Oeste": 3 * Math.PI / 2
    };
    return directionAngles[direction] || 0;
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

    // Obtener uniforms de luces de semaforos y coches
    const trafficLightUniforms = getTrafficLightUniforms();
    const carUniforms = getCarUniforms(fract);

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
        u_viewPosition: scene.camera.posArray,
        ...trafficLightUniforms,
        ...carUniforms
    }
    twgl.setUniforms(programInfo, objectUniforms);

    // Dibujar el objeto usando su VAO y buffer info
    gl.bindVertexArray(object.vao);
    twgl.drawBufferInfo(gl, object.bufferInfo);
}

// Dibujar un coche con su modelo 3D
function drawCar(gl, programInfo, car, viewProjectionMatrix, fract) {
    // Interpolacion de posicion usando delta time (fract va de 0 a 1)
    // Lerp entre startPos y targetPos
    if (car.startPos && car.targetPos) {
        car.position.x = car.startPos.x + (car.targetPos.x - car.startPos.x) * fract;
        car.position.y = car.startPos.y + (car.targetPos.y - car.startPos.y) * fract;
        car.position.z = car.startPos.z + (car.targetPos.z - car.startPos.z) * fract;
    }

    // Actualizar rotacion del coche segun su direccion de movimiento
    if (car.direction) {
        car.rotRad.y = getRotationFromDirection(car.direction);
    }

    // Si es drunk driver y crasheó, actualizar color a rojo
    if (car.type === 'drunk' && car.crashed) {
        car.color = [1.0, 0.0, 0.0, 1.0];
    }

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

    // Draw static objects (roads, destinations, obstacles)
    // Usando shader Phong para objetos normales
    for (let object of scene.objects) {
        // Skip cars, they will be drawn separately
        if (cars.includes(object)) {
            continue;
        }
        // Skip traffic lights, they will be drawn with emission shader
        if (trafficLights.includes(object)) {
            continue;
        }
        drawObject(gl, phongProgramInfo, object, viewProjectionMatrix, fract);
    }

    // Draw traffic lights with emission shader
    // Usar shader de emision para que los semaforos brillen
    gl.useProgram(emissionProgramInfo.program);
    for (const light of trafficLights) {
        drawObject(gl, emissionProgramInfo, light, viewProjectionMatrix, fract);
    }

    // Volver al shader Phong para el resto de objetos
    gl.useProgram(phongProgramInfo.program);

    // Debug: contar cuantos objetos hay en la escena solo la primera vez
    if (!window.debugLogged) {
        console.log('Total objetos en escena:', scene.objects.length);
        console.log('Coches de la API:', cars.length);
        window.debugLogged = true;
    }

    // Ya no animamos el coche de prueba porque lo quitamos

    // Actualizar dropdown de coches disponibles - SOLO drunk drivers
    if (window.carIdController && cars.length > 0) {
        // Filtrar solo drunk drivers
        const drunkDrivers = cars.filter(c => c.type === 'drunk');
        const drunkDriverIds = drunkDrivers.map(c => c.id);
        const dropdownOptions = ['None', ...drunkDriverIds];

        // Solo actualizar si cambio el numero de drunk drivers
        const drunkCount = drunkDrivers.length;
        if (!window.lastDrunkCount || window.lastDrunkCount !== drunkCount) {
            // Destruir el controller viejo
            window.carIdController.destroy();

            // Crear uno nuevo con las opciones actualizadas
            const cameraFolder = window.carIdController.parent;
            window.carIdController = cameraFolder.add(window.cameraControls, 'carId', dropdownOptions)
                .name('Drunk Driver ID')
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

            window.lastDrunkCount = drunkCount;
        }
    }

    // Dibujar todos los coches
    // Esto dibuja cada coche usando su modelo 3D o cubo
    for (const car of cars) {
        drawCar(gl, phongProgramInfo, car, viewProjectionMatrix, fract);
    }

    // Agregar coches nuevos a la escena si no existen ya
    // Esto maneja coches que aparecen durante la simulacion
    // Escala 0.25 para mantener proporcion correcta con el cubo base de 2 unidades
    for (const car of cars) {
        if (!scene.objects.includes(car)) {
            // Usar drunk driver model para drunk drivers, modelo normal para coches normales
            if (car.type === 'drunk' && drunkDriverModelRef) {
                console.log('[DYNAMIC] Assigning drunk driver model to new car:', car.id);
                car.arrays = drunkDriverModelRef.arrays;
                car.bufferInfo = drunkDriverModelRef.bufferInfo;
                car.vao = drunkDriverModelRef.vao;
                car.scale = { x: 0.25, y: 0.25, z: 0.25 };
            } else if (carModelRef) {
                car.arrays = carModelRef.arrays;
                car.bufferInfo = carModelRef.bufferInfo;
                car.vao = carModelRef.vao;
                car.scale = { x: 0.25, y: 0.25, z: 0.25 };
            } else {
                car.arrays = baseCubeRef.arrays;
                car.bufferInfo = baseCubeRef.bufferInfo;
                car.vao = baseCubeRef.vao;
                car.scale = { x: 0.3, y: 0.2, z: 0.2 };
            }

            // Color especial para drunk drivers
            if (car.type === 'drunk') {
                car.color = car.crashed ? [1.0, 0.0, 0.0, 1.0] : [0.8, 0.8, 0.0, 1.0];
            } else {
                car.color = [Math.random(), Math.random(), Math.random(), 1.0];
            }

            // Inicializar posiciones para interpolacion
            car.startPos = { x: car.position.x, y: car.position.y, z: car.position.z };
            car.targetPos = { x: car.position.x, y: car.position.y, z: car.position.z };

            scene.addObject(car);
        }
    }

    // Remover coches que ya no están en el array del API
    // Esto maneja coches que llegaron a su destino y fueron eliminados
    const currentCarIds = new Set(cars.map(c => c.id));
    const objectsToRemove = [];

    for (const obj of scene.objects) {
        // Verificar si es un coche (tiene id que no está en obstacles, roads, etc)
        if (obj.id && !currentCarIds.has(obj.id)) {
            // Verificar que no sea obstáculo, road, destination, traffic light o ground tile
            const isStatic = obstacles.some(o => o.id === obj.id) ||
                roads.some(r => r.id === obj.id) ||
                destinations.some(d => d.id === obj.id) ||
                trafficLights.some(l => l.id === obj.id) ||
                obj.id.startsWith('ground_');

            if (!isStatic) {
                objectsToRemove.push(obj);
            }
        }
    }

    // Remover los objetos identificados
    for (const obj of objectsToRemove) {
        const index = scene.objects.indexOf(obj);
        if (index > -1) {
            scene.objects.splice(index, 1);
        }

        // Si el carro que se está siguiendo fue eliminado, detener follow mode
        if (scene.camera.followTarget === obj) {
            scene.camera.followTarget = null;
            scene.camera.followMode = false;
            if (window.cameraControls) {
                window.cameraControls.followMode = false;
                window.cameraControls.carId = 'None';
            }
        }
    }

    // Update the scene after the elapsed duration
    if (elapsed >= duration) {
        elapsed = 0;

        // Guardar posiciones actuales como startPos antes del update
        for (const car of cars) {
            if (car.startPos && car.targetPos) {
                car.startPos.x = car.targetPos.x;
                car.startPos.y = car.targetPos.y;
                car.startPos.z = car.targetPos.z;
            }
        }

        await update();

        // Actualizar targetPos con las nuevas posiciones del servidor
        for (const car of cars) {
            if (!car.startPos) {
                car.startPos = { x: car.position.x, y: car.position.y, z: car.position.z };
            }
            car.targetPos = { x: car.position.x, y: car.position.y, z: car.position.z };
        }
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

    // === SIMULATION (general) ===
    const simulationFolder = gui.addFolder('Simulation:')

    // Objeto para controlar velocidad de simulacion
    const simulationControls = {
        updateSpeed: 1000, // Valor inicial en ms
        spawnInterval: 10  // Cada cuantos steps aparece un coche
    };

    // Slider para controlar velocidad de actualizacion
    // Rango de 100ms (rapido) a 2000ms (lento)
    simulationFolder.add(simulationControls, 'updateSpeed', 100, 2000)
        .name('Update Speed (ms)')
        .onChange((value) => {
            duration = value;
        });

    // Slider para controlar cada cuantos steps aparecen coches
    // Rango de 1 (muy frecuente) a 50 (poco frecuente)
    simulationFolder.add(simulationControls, 'spawnInterval', 1, 50, 1)
        .name('Spawn Interval')
        .onChange((value) => {
            setSpawnInterval(value);
        });

    // === NORMAL CARS ===
    const normalFolder = gui.addFolder('Normal Cars:')

    normalFolder.add(normalCarParams, 'normal_spawn_ratio', 0, 1)
        .name('Spawn Ratio')
        .step(0.05)
        .onChange((value) => {
            updateNormalParams({ normal_spawn_ratio: value });
        });

    normalFolder.add(normalCarParams, 'normal_crash_prob', 0, 1)
        .name('Crash Prob')
        .step(0.05)
        .onChange((value) => {
            updateNormalParams({ normal_crash_prob: value });
        });

    // === DRUNK DRIVERS ===
    const drunkFolder = gui.addFolder('Drunk Drivers:')

    drunkFolder.add(drunkDriverParams, 'drunk_crash_prob', 0, 1)
        .name('Crash Prob')
        .step(0.05)
        .onChange((value) => {
            updateDrunkParams({ drunk_crash_prob: value });
        });

    drunkFolder.add(drunkDriverParams, 'drunk_ignore_light_prob', 0, 1)
        .name('Ignore Lights')
        .step(0.05)
        .onChange((value) => {
            updateDrunkParams({ drunk_ignore_light_prob: value });
        });

    drunkFolder.add(drunkDriverParams, 'drunk_forget_route_prob', 0, 1)
        .name('Forget Route')
        .step(0.05)
        .onChange((value) => {
            updateDrunkParams({ drunk_forget_route_prob: value });
        });

    drunkFolder.add(drunkDriverParams, 'drunk_zigzag_intensity', 0, 1)
        .name('Zigzag')
        .step(0.05)
        .onChange((value) => {
            updateDrunkParams({ drunk_zigzag_intensity: value });
        });

    // Guardar referencia para actualizar el dropdown
    window.carIdController = carIdController;
    window.cameraControls = cameraControls;
}

main();
