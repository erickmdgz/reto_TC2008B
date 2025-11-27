/*
 * Generador CLI de modelo 3D OBJ para semaforo
 * Estructura de generate_building.js
 *
 * Uso:
 *   node generate_traffic_light.js
 *
 * Emiliano Deyta
 * 2025-11-27
 */


'use strict';

const fs = require('fs');

// Parametros del semaforo
const PARAMS = {
    poleRadius: 0.08,
    poleHeight: 1.5,
    poleSides: 8,
    boxWidth: 0.3,
    boxHeight: 0.8,
    boxDepth: 0.15
};


// Generar vertices de un cilindro (poste)
function generatePole(params) {
    const vertices = [];
    const normals = [];
    const faces = [];

    const r = params.poleRadius;
    const h = params.poleHeight;
    const sides = params.poleSides;

    // Vertices del cilindro
    // Anillo inferior
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * 2.0 * Math.PI;
        const x = r * Math.cos(angle);
        const z = r * Math.sin(angle);
        vertices.push({ x: x, y: 0, z: z });
        normals.push({ x: Math.cos(angle), y: 0, z: Math.sin(angle) });
    }

    // Anillo superior
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * 2.0 * Math.PI;
        const x = r * Math.cos(angle);
        const z = r * Math.sin(angle);
        vertices.push({ x: x, y: h, z: z });
        normals.push({ x: Math.cos(angle), y: 0, z: Math.sin(angle) });
    }

    // Centro inferior y superior
    vertices.push({ x: 0, y: 0, z: 0 });
    normals.push({ x: 0, y: -1, z: 0 });
    vertices.push({ x: 0, y: h, z: 0 });
    normals.push({ x: 0, y: 1, z: 0 });

    const bottomCenter = vertices.length - 1;  // indice 1-based sera vertices.length
    const topCenter = vertices.length;

    // Caras laterales
    for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        // Triangulo inferior
        faces.push([i + 1, next + 1, sides + next + 1]);
        // Triangulo superior
        faces.push([i + 1, sides + next + 1, sides + i + 1]);
    }

    // Tapa inferior
    for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        faces.push([bottomCenter, next + 1, i + 1]);
    }

    // Tapa superior
    for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        faces.push([topCenter, sides + i + 1, sides + next + 1]);
    }

    return { vertices, normals, faces, offset: 0 };
}


// Generar vertices de una caja (luz del semaforo)
function generateBox(params, yOffset) {
    const vertices = [];
    const normals = [];
    const faces = [];

    const w = params.boxWidth / 2;
    const h = params.boxHeight / 2;
    const d = params.boxDepth / 2;
    const y = yOffset;

    // 8 vertices de la caja
    // Cara frontal
    vertices.push({ x: -w, y: y - h, z: d });  // 0
    vertices.push({ x: w, y: y - h, z: d });   // 1
    vertices.push({ x: w, y: y + h, z: d });   // 2
    vertices.push({ x: -w, y: y + h, z: d });  // 3
    // Cara trasera
    vertices.push({ x: -w, y: y - h, z: -d }); // 4
    vertices.push({ x: w, y: y - h, z: -d });  // 5
    vertices.push({ x: w, y: y + h, z: -d });  // 6
    vertices.push({ x: -w, y: y + h, z: -d }); // 7

    // Normales para cada cara (6 caras, 4 vertices cada una = 24 normales)
    // Frontal
    for (let i = 0; i < 4; i++) normals.push({ x: 0, y: 0, z: 1 });
    // Trasera
    for (let i = 0; i < 4; i++) normals.push({ x: 0, y: 0, z: -1 });
    // Derecha
    for (let i = 0; i < 4; i++) normals.push({ x: 1, y: 0, z: 0 });
    // Izquierda
    for (let i = 0; i < 4; i++) normals.push({ x: -1, y: 0, z: 0 });
    // Arriba
    for (let i = 0; i < 4; i++) normals.push({ x: 0, y: 1, z: 0 });
    // Abajo
    for (let i = 0; i < 4; i++) normals.push({ x: 0, y: -1, z: 0 });

    // Caras (indices 1-based, se ajustaran con offset)
    // Frontal
    faces.push([1, 2, 3]);
    faces.push([1, 3, 4]);
    // Trasera
    faces.push([6, 5, 8]);
    faces.push([5, 8, 7]);
    // Derecha
    faces.push([2, 6, 7]);
    faces.push([2, 7, 3]);
    // Izquierda
    faces.push([5, 1, 4]);
    faces.push([5, 4, 8]);
    // Arriba
    faces.push([4, 3, 7]);
    faces.push([4, 7, 8]);
    // Abajo
    faces.push([5, 6, 2]);
    faces.push([5, 2, 1]);

    return { vertices, normals, faces };
}


// Escribir archivo OBJ
function writeOBJ(pole, box) {
    let objContent = '';

    const totalVertices = pole.vertices.length + box.vertices.length;
    const totalNormals = pole.normals.length + box.normals.length;
    const totalFaces = pole.faces.length + box.faces.length;

    // Encabezado
    objContent += `# OBJ file traffic_light.obj\n`;
    objContent += `# ${totalVertices} vertices\n`;
    objContent += `# ${totalNormals} normals\n`;
    objContent += `# ${totalFaces} faces\n`;

    // Vertices del poste
    for (const v of pole.vertices) {
        objContent += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
    }

    // Vertices de la caja
    for (const v of box.vertices) {
        objContent += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
    }

    // Normales del poste
    for (const n of pole.normals) {
        objContent += `vn ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}\n`;
    }

    // Normales de la caja
    for (const n of box.normals) {
        objContent += `vn ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}\n`;
    }

    // Caras del poste
    for (const f of pole.faces) {
        objContent += `f ${f[0]}//${f[0]} ${f[1]}//${f[1]} ${f[2]}//${f[2]}\n`;
    }

    // Caras de la caja (con offset)
    const vOffset = pole.vertices.length;
    const nOffset = pole.normals.length;
    for (const f of box.faces) {
        const v1 = f[0] + vOffset;
        const v2 = f[1] + vOffset;
        const v3 = f[2] + vOffset;
        objContent += `f ${v1}//${v1} ${v2}//${v2} ${v3}//${v3}\n`;
    }

    // Escribir archivo
    const outfile = 'traffic_light.obj';
    try {
        fs.writeFileSync(outfile, objContent);
        console.log(`Archivo generado: ${outfile}`);
    } catch (error) {
        console.error(`Error al escribir archivo: ${error.message}`);
        process.exit(1);
    }
}


// Funcion principal
function main() {
    console.log('Generando semaforo con parametros:');
    console.log(`  Radio del poste: ${PARAMS.poleRadius}`);
    console.log(`  Altura del poste: ${PARAMS.poleHeight}`);
    console.log(`  Lados del poste: ${PARAMS.poleSides}`);
    console.log(`  Ancho de caja: ${PARAMS.boxWidth}`);
    console.log(`  Alto de caja: ${PARAMS.boxHeight}`);
    console.log(`  Profundidad de caja: ${PARAMS.boxDepth}`);

    // Generar geometria
    const pole = generatePole(PARAMS);
    const box = generateBox(PARAMS, PARAMS.poleHeight + PARAMS.boxHeight / 2);

    console.log(`  Vertices del poste: ${pole.vertices.length}`);
    console.log(`  Vertices de la caja: ${box.vertices.length}`);

    // Escribir archivo OBJ
    writeOBJ(pole, box);
}


// Ejecutar programa
main();
