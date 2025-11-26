/*
 * Script to read a model stored in Wavefront OBJ format
 *
 * Gilberto Echeverria
 * 2025-07-29
 */


'use strict';

/*
 * Lee el contenido de un archivo OBJ recibido como string
 * Retorna un objeto llamado arrays con los arrays necesarios para crear un
 * Vertex Array Object VAO para WebGL
 * Basicamente convierte el formato OBJ a un formato que WebGL entiende
 */
function loadObj(objString) {

    // El array con los atributos que se pasaran a WebGL
    // Cada atributo tiene el numero de componentes y los datos
    let arrays = {
        a_position: {
            numComponents: 3,
            data: [ ]
        },
        a_color: {
            numComponents: 4,
            data: [ ]
        },
        a_normal: {
            numComponents: 3,
            data: [ ]
        },
        a_texCoord: {
            numComponents: 2,
            data: [ ]
        }
    };

    // Arrays temporales para guardar los datos del archivo OBJ
    // Estos se llenan primero y luego se usan para crear las caras
    const vertices = [];
    const normals = [];
    const texCoords = [];

    // Dividir el archivo en lineas para procesarlo linea por linea
    const lines = objString.split('\n');

    console.log('Parseando OBJ, total de lineas:', lines.length);

    // Variable para trackear si estamos en un objeto que debemos ignorar
    // Solo ignoramos las CARAS, no los vertices
    let ignoringCurrentObject = false;

    // Procesar cada linea del archivo OBJ
    for (let line of lines) {
        line = line.trim();

        // Ignorar comentarios y lineas vacias
        if (line.startsWith('#') || line.length === 0) {
            continue;
        }

        const parts = line.split(/\s+/);
        const type = parts[0];

        // Detectar declaraciones de objetos para filtrar widgets de Blender
        if (type === 'o') {
            const objectName = parts.slice(1).join(' ');
            // Ignorar objetos que empiezan con WGT (widgets de Blender)
            // o con Plane que suelen ser planos de referencia
            if (objectName.startsWith('WGT-') || objectName.startsWith('Plane')) {
                ignoringCurrentObject = true;
                console.log('Ignorando objeto:', objectName);
            } else {
                ignoringCurrentObject = false;
                console.log('Procesando objeto:', objectName);
            }
            continue;
        }

        // Parsear posiciones de vertices las lineas que empiezan con v
        // Los vertices SIEMPRE se parsean sin importar el objeto
        if (type === 'v') {
            vertices.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            ]);
        }
        // Parsear normales las lineas que empiezan con vn
        // Las normales SIEMPRE se parsean
        else if (type === 'vn') {
            normals.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            ]);
        }
        // Parsear coordenadas de textura las lineas que empiezan con vt
        // Las coordenadas de textura SIEMPRE se parsean
        else if (type === 'vt') {
            texCoords.push([
                parseFloat(parts[1]),
                parseFloat(parts[2])
            ]);
        }
        // Parsear caras las lineas que empiezan con f
        // Las caras definen triangulos usando indices de vertices
        // Solo parseamos caras de objetos que NO estamos ignorando
        else if (type === 'f') {
            // Si estamos ignorando el objeto actual saltamos sus caras
            if (ignoringCurrentObject) {
                continue;
            }
            // Las caras en OBJ pueden ser v, v/vt, v/vt/vn, o v//vn
            // Necesitamos procesarlas y convertirlas a triangulos
            const faceVertices = [];

            for (let i = 1; i < parts.length; i++) {
                const vertexData = parts[i].split('/');
                const vIndex = parseInt(vertexData[0]) - 1; // Los indices en OBJ empiezan en 1 no en 0
                // vtIndex puede ser string vacio en formato v//vn
                const vtIndex = (vertexData[1] && vertexData[1].length > 0) ? parseInt(vertexData[1]) - 1 : -1;
                const vnIndex = (vertexData[2] && vertexData[2].length > 0) ? parseInt(vertexData[2]) - 1 : -1;

                faceVertices.push({ vIndex, vtIndex, vnIndex });
            }

            // Triangular caras con mas de 3 vertices
            // Si una cara tiene 4 vertices la convertimos en 2 triangulos
            for (let i = 1; i < faceVertices.length - 1; i++) {
                const v1 = faceVertices[0];
                const v2 = faceVertices[i];
                const v3 = faceVertices[i + 1];

                // Agregar vertices del triangulo
                for (const v of [v1, v2, v3]) {
                    // Posicion del vertice
                    arrays.a_position.data.push(...vertices[v.vIndex]);

                    // Normal del vertice para calcular iluminacion
                    if (v.vnIndex >= 0 && normals[v.vnIndex]) {
                        arrays.a_normal.data.push(...normals[v.vnIndex]);
                    } else {
                        // Normal por defecto apuntando hacia arriba
                        arrays.a_normal.data.push(0, 1, 0);
                    }

                    // Coordenadas de textura
                    if (v.vtIndex >= 0 && texCoords[v.vtIndex]) {
                        arrays.a_texCoord.data.push(...texCoords[v.vtIndex]);
                    } else {
                        arrays.a_texCoord.data.push(0, 0);
                    }

                    // Color por defecto blanco que sera reemplazado por el color del material
                    arrays.a_color.data.push(1, 1, 1, 1);
                }
            }
        }
    }

    console.log('Vertices encontrados:', vertices.length);
    console.log('Normales encontradas:', normals.length);
    console.log('Caras procesadas, triangulos totales:', arrays.a_position.data.length / 3);

    //console.log("ATTRIBUTES:")
    //console.log(arrays);

    //console.log("OBJ DATA:")
    //console.log(objData);

    return arrays;
}

/*
 * Read the contents of an MTL file received as a string
 * Return an object containing all the materials described inside,
 * with their illumination attributes.
 */
function loadMtl(mtlString) {


    return /* SOMETHING */;
}

export { loadObj, loadMtl };
