/*
 * Generador CLI de modelo 3D OBJ para edificio tipo cono truncado
 *
 * Uso:
 *   node generate_building.js <sides> <height> <radiusBottom> <radiusTop>
 *
 *
 * Emiliano Deyta
 * 2025-11-12
 */


'use strict';

const fs = require('fs');
const path = require('path');

// Valores por defecto
const DEFAULTS = {
    sides: 8,
    height: 6.0,
    radiusBottom: 1.0,
    radiusTop: 0.8
};

// Límites de validación
const LIMITS = {
    minSides: 3,
    maxSides: 36
};


// Parsear argumentos de línea de comandos
function parseArgs() {
    const args = process.argv.slice(2);

    const params = {
        sides: DEFAULTS.sides,
        height: DEFAULTS.height,
        radiusBottom: DEFAULTS.radiusBottom,
        radiusTop: DEFAULTS.radiusTop
    };

    // Parsear argumentos posicionales
    if (args.length >= 1) {
        params.sides = parseInt(args[0]);
    }
    if (args.length >= 2) {
        params.height = parseFloat(args[1]);
    }
    if (args.length >= 3) {
        params.radiusBottom = parseFloat(args[2]);
    }
    if (args.length >= 4) {
        params.radiusTop = parseFloat(args[3]);
    }

    // Validar parámetros
    validateParams(params);

    // Generar nombre de archivo automáticamente
    const s = params.sides;
    const h = params.height;
    const rb = params.radiusBottom;
    const rt = params.radiusTop;
    params.outfile = `building_${s}_${h}_${rb}_${rt}.obj`;

    return params;
}


// Validar parámetros de entrada
function validateParams(params) {
    // Validar sides
    if (isNaN(params.sides) || params.sides < LIMITS.minSides) {
        params.sides = LIMITS.minSides;
        console.warn(`Advertencia: sides ajustado a ${LIMITS.minSides}`);
    }
    if (params.sides > LIMITS.maxSides) {
        params.sides = LIMITS.maxSides;
        console.warn(`Advertencia: sides ajustado a ${LIMITS.maxSides}`);
    }

    // Validar height
    if (isNaN(params.height) || params.height <= 0) {
        console.error('Error: height debe ser mayor que 0');
        process.exit(1);
    }

    // Validar radios
    if (isNaN(params.radiusBottom) || params.radiusBottom <= 0) {
        console.error('Error: radiusBottom debe ser mayor que 0');
        process.exit(1);
    }
    if (isNaN(params.radiusTop) || params.radiusTop <= 0) {
        console.error('Error: radiusTop debe ser mayor que 0');
        process.exit(1);
    }
}


// Construir perfil de radios a lo largo de la altura
function buildProfile(params) {
    // Generar perfil con múltiples segmentos intermedios
    // Esto permite crear formas con secciones más anchas o delgadas
    const rb = params.radiusBottom;
    const rt = params.radiusTop;
    const h = params.height;

    // Determinar número de segmentos según la altura
    // Más altura = más segmentos para mejor detalle
    const numSegments = Math.max(3, Math.min(Math.floor(h / 2), 8));

    const profile = [];

    for (let i = 0; i < numSegments; i++) {
        const t = i / (numSegments - 1);  // Factor de interpolación [0, 1]

        // Aplicar función de forma para crear variaciones interesantes
        // Usamos una función sinusoidal para crear abultamientos
        let radius;

        if (i === 0) {
            // Primer segmento siempre es radiusBottom
            radius = rb;
        } else if (i === numSegments - 1) {
            // Último segmento siempre es radiusTop
            radius = rt;
        } else {
            // Segmentos intermedios: interpolación base + variación
            const baseRadius = rb + (rt - rb) * t;

            // Factor de abultamiento (0.0 = sin abultamiento, 1.0 = máximo)
            const bulgeFactor = 0.3;

            // Variación sinusoidal para crear forma interesante
            // Sin(π*t) da un pico en el medio
            const variation = Math.sin(Math.PI * t) * bulgeFactor * Math.max(rb, rt);

            radius = baseRadius + variation;
        }

        profile.push(radius);
    }

    return profile;
}


// Generar anillos de vértices
function generateRings(params, profile) {
    const vertices = [];
    const numRings = profile.length;
    const sides = params.sides;
    const height = params.height;

    for (let ring = 0; ring < numRings; ring++) {
        const y = (ring / (numRings - 1)) * height;
        const radius = profile[ring];

        for (let side = 0; side < sides; side++) {
            const angle = (side / sides) * 2.0 * Math.PI;
            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);

            vertices.push({ x: x, y: y, z: z });
        }
    }

    return vertices;
}


// Calcular normales laterales por sector usando derivadas de la superficie
function computeSectorNormals(sides, r0, r1, height) {
    const normals = [];
    const step = 2.0 * Math.PI / sides;

    // Radio medio y derivada radial
    const r_mid = (r0 + r1) / 2.0;
    const rprime = (r1 - r0) / height;

    for (let i = 0; i < sides; i++) {
        // Ángulo medio del sector
        const theta = (i + 0.5) * step;

        // Derivadas de la superficie paramétrica p(theta, y)
        // p_theta = (-r_mid*sin(theta), 0, r_mid*cos(theta))
        const pt_x = -r_mid * Math.sin(theta);
        const pt_y = 0.0;
        const pt_z = r_mid * Math.cos(theta);

        // p_y = (rprime*cos(theta), 1, rprime*sin(theta))
        const py_x = rprime * Math.cos(theta);
        const py_y = 1.0;
        const py_z = rprime * Math.sin(theta);

        // Normal = cross(p_theta, p_y)
        let nx = pt_y * py_z - pt_z * py_y;
        let ny = pt_z * py_x - pt_x * py_z;
        let nz = pt_x * py_y - pt_y * py_x;

        // Normalizar
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= length;
        ny /= length;
        nz /= length;

        // Asegurar que ny sea positiva
        if (ny < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
        }

        normals.push({ x: nx, y: ny, z: nz });
    }

    return normals;
}


// Construir caras laterales
function buildSideFaces(params, profile) {
    const faces = [];
    const numRings = profile.length;
    const sides = params.sides;

    for (let ring = 0; ring < numRings - 1; ring++) {
        for (let side = 0; side < sides; side++) {
            const nextSide = (side + 1) % sides;

            // Índices de vértices (1-based para OBJ)
            const v0 = ring * sides + side + 1;
            const v1 = ring * sides + nextSide + 1;
            const v2 = (ring + 1) * sides + nextSide + 1;
            const v3 = (ring + 1) * sides + side + 1;

            // Dos triángulos por cara, CCW desde fuera
            // Triángulo inferior
            faces.push({
                vertices: [v0, v1, v2],
                normals: [v0, v1, v2]
            });

            // Triángulo superior
            faces.push({
                vertices: [v0, v2, v3],
                normals: [v0, v2, v3]
            });
        }
    }

    return faces;
}


// Construir tapas superior e inferior
function buildCaps(params, profile, vertices) {
    const caps = {
        bottom: [],
        top: []
    };

    const sides = params.sides;
    const numRings = profile.length;

    // Tapa inferior (y = 0)
    // Centro en el origen
    const bottomCenterIndex = vertices.length + 1;

    for (let side = 0; side < sides; side++) {
        const nextSide = (side + 1) % sides;

        // Índices de vértices en el primer anillo
        const v0 = side + 1;
        const v1 = nextSide + 1;

        // Fan desde el centro, CCW visto desde abajo (para normal hacia afuera = -Y)
        // Invertimos el orden para que la normal apunte hacia abajo
        caps.bottom.push({
            vertices: [bottomCenterIndex, v1, v0]
        });
    }

    // Tapa superior (y = height)
    const topCenterIndex = vertices.length + 2;
    const topRingStart = (numRings - 1) * sides;

    for (let side = 0; side < sides; side++) {
        const nextSide = (side + 1) % sides;

        // Índices de vértices en el último anillo
        const v0 = topRingStart + side + 1;
        const v1 = topRingStart + nextSide + 1;

        // Fan desde el centro, CCW visto desde arriba (para normal hacia arriba = +Y)
        caps.top.push({
            vertices: [topCenterIndex, v0, v1]
        });
    }

    return caps;
}


// Escribir archivo OBJ
function writeOBJ(params, vertices, normals, sideFaces, caps, profile) {
    const sides = params.sides;
    const height = params.height;
    const numRings = profile.length;

    // Calcular conteos para el encabezado
    // 2 centros + vértices de todos los anillos
    const numVertices = 2 + sides * numRings;
    // 2 normales de tapas + 2 laterales por sector por segmento
    const numNormals = 2 + sides * (numRings - 1) * 2;
    // 2 tapas + 2 triángulos laterales por sector por segmento
    const numFaces = sides * 2 + sides * (numRings - 1) * 2;

    let objContent = '';

    // Encabezado con conteos (sin líneas vacías intermedias)
    objContent += `# OBJ file ${params.outfile}\n`;
    objContent += `# ${numVertices} vertices\n`;
    objContent += `# ${numNormals} normals\n`;
    objContent += `# ${numFaces} faces\n`;

    // Escribir vértices: primero centro bottom, luego todos los anillos, finalmente centro top
    // Centro bottom (índice 1)
    objContent += `v ${(0.0).toFixed(4)} ${(0.0).toFixed(4)} ${(0.0).toFixed(4)}\n`;

    // Vértices de todos los anillos en orden: anillo 0, anillo 1, ..., anillo N-1
    for (let ring = 0; ring < numRings; ring++) {
        for (let side = 0; side < sides; side++) {
            const v = vertices[ring * sides + side];
            objContent += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
        }
    }

    // Centro top (último índice)
    objContent += `v ${(0.0).toFixed(4)} ${height.toFixed(4)} ${(0.0).toFixed(4)}\n`;

    // Escribir normales
    // Normal de tapa inferior (apunta hacia abajo)
    objContent += `vn ${(0.0).toFixed(4)} ${(-1.0).toFixed(4)} ${(0.0).toFixed(4)}\n`;

    // Normal de tapa superior (apunta hacia arriba)
    objContent += `vn ${(0.0).toFixed(4)} ${(1.0).toFixed(4)} ${(0.0).toFixed(4)}\n`;

    // Normales laterales: para cada segmento vertical, calcular normales por sector
    for (let seg = 0; seg < numRings - 1; seg++) {
        const r0 = profile[seg];
        const r1 = profile[seg + 1];
        const segHeight = height / (numRings - 1);
        const segNormals = computeSectorNormals(sides, r0, r1, segHeight);

        for (let i = 0; i < sides; i++) {
            const n = segNormals[i];
            // Duplicar cada normal (para los dos triángulos del quad)
            objContent += `vn ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}\n`;
            objContent += `vn ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}\n`;
        }
    }

    // Escribir caras
    const centerBottom = 1;
    const centerTop = numVertices;

    // Tapa inferior: conectar centro bottom con primer anillo
    for (let side = 0; side < sides; side++) {
        const nextSide = (side + 1) % sides;
        const v0 = 2 + side;
        const v1 = 2 + nextSide;
        // CCW desde abajo (normal hacia abajo)
        objContent += `f ${v1}//1 ${centerBottom}//1 ${v0}//1\n`;
    }

    // Caras laterales: para cada segmento vertical
    for (let seg = 0; seg < numRings - 1; seg++) {
        for (let side = 0; side < sides; side++) {
            const nextSide = (side + 1) % sides;

            // Índices de vértices para este quad
            const ringStart0 = 2 + seg * sides;
            const ringStart1 = 2 + (seg + 1) * sides;

            const v0 = ringStart0 + side;
            const v1 = ringStart0 + nextSide;
            const v2 = ringStart1 + nextSide;
            const v3 = ringStart1 + side;

            // Índices de normales para este segmento y sector
            const nBase = 3 + seg * sides * 2 + side * 2;
            const n1 = nBase;
            const n2 = nBase + 1;

            // Dos triángulos por quad
            // Triángulo inferior: v0, v1, v2
            objContent += `f ${v2}//${n1} ${v1}//${n1} ${v0}//${n1}\n`;

            // Triángulo superior: v0, v2, v3
            objContent += `f ${v3}//${n2} ${v2}//${n2} ${v0}//${n2}\n`;
        }
    }

    // Tapa superior: conectar último anillo con centro top
    const lastRingStart = 2 + (numRings - 1) * sides;
    for (let side = 0; side < sides; side++) {
        const nextSide = (side + 1) % sides;
        const v0 = lastRingStart + side;
        const v1 = lastRingStart + nextSide;
        // CCW desde arriba (normal hacia arriba)
        objContent += `f ${v0}//2 ${centerTop}//2 ${v1}//2\n`;
    }

    // Escribir archivo
    try {
        fs.writeFileSync(params.outfile, objContent);
        console.log(`Archivo generado: ${params.outfile}`);
    } catch (error) {
        console.error(`Error al escribir archivo: ${error.message}`);
        process.exit(1);
    }
}


// Función principal
function main() {
    const params = parseArgs();

    console.log('Generando edificio con parámetros:');
    console.log(`  Lados: ${params.sides}`);
    console.log(`  Altura: ${params.height}`);
    console.log(`  Radio inferior: ${params.radiusBottom}`);
    console.log(`  Radio superior: ${params.radiusTop}`);

    // Construir perfil de radios
    const profile = buildProfile(params);
    console.log(`  Anillos: ${profile.length}`);

    // Generar geometría
    const vertices = generateRings(params, profile);
    const r0 = profile[0];
    const r1 = profile[profile.length - 1];
    const normals = computeSectorNormals(params.sides, r0, r1, params.height);
    const sideFaces = buildSideFaces(params, profile);
    const caps = buildCaps(params, profile, vertices);

    const numRings = profile.length;
    const numVertices = 2 + params.sides * numRings;
    const numNormals = 2 + params.sides * (numRings - 1) * 2;
    const numFaces = params.sides * 2 + params.sides * (numRings - 1) * 2;

    console.log(`  Vértices: ${numVertices}`);
    console.log(`  Normales: ${numNormals}`);
    console.log(`  Caras: ${numFaces}`);

    // Escribir archivo OBJ
    writeOBJ(params, vertices, normals, sideFaces, caps, profile);
}


// Ejecutar programa
main();
