#version 300 es
// Fragment shader for Phong lighting
// Estructura de CG-2025
// Con soporte para luces de semaforos y coches
precision highp float;

// Maximo numero de semaforos, coches y edificios
const int MAX_TRAFFIC_LIGHTS = 30;
const int MAX_CARS = 50;
const int MAX_BUILDING_LIGHTS = 80;

in vec3 v_normal;
in vec3 v_surfaceToLight;
in vec3 v_surfaceToView;
in vec4 v_color;
in vec3 v_worldPosition;
in vec2 v_texcoord;

// Scene uniforms
uniform vec4 u_lightAmbient;
uniform vec4 u_lightDiffuse;
uniform vec4 u_lightSpecular;

// Model uniforms
uniform vec4 u_materialColor;
uniform float u_materialShininess;
uniform sampler2D u_texture;
uniform bool u_useTexture;
uniform bool u_isSkybox;

// Traffic light uniforms
uniform vec3 u_trafficLightPositions[MAX_TRAFFIC_LIGHTS];
uniform vec4 u_trafficLightColors[MAX_TRAFFIC_LIGHTS];
uniform int u_numTrafficLights;

// Car light uniforms
uniform vec3 u_carPositions[MAX_CARS];
uniform int u_numCars;

// Building light uniforms
uniform vec3 u_buildingLightPositions[MAX_BUILDING_LIGHTS];
uniform vec4 u_buildingLightColors[MAX_BUILDING_LIGHTS];
uniform int u_numBuildingLights;

out vec4 outColor;

void main() {
    // Get base color from texture or material color
    vec4 baseColor = u_useTexture ? texture(u_texture, v_texcoord) : u_materialColor;

    // If it's a skybox, just return the texture with full brightness (no lighting)
    // Multiply by material color to apply tint
    if (u_isSkybox && u_useTexture) {
        outColor = baseColor * u_materialColor;
        return;
    }

    // Normalize vectors
    vec3 normal = normalize(v_normal);
    vec3 surfaceToLightDirection = normalize(v_surfaceToLight);
    vec3 surfaceToViewDirection = normalize(v_surfaceToView);

    // Half vector for specular calculation
    vec3 halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);

    // Ambient component
    vec4 ambient = u_lightAmbient * baseColor;

    // Diffuse component
    float diffuseLight = max(dot(normal, surfaceToLightDirection), 0.0);
    vec4 diffuse = u_lightDiffuse * baseColor * diffuseLight;

    // Specular component
    float specularLight = 0.0;
    if (diffuseLight > 0.0) {
        specularLight = pow(max(dot(normal, halfVector), 0.0), u_materialShininess);
    }
    vec4 specular = u_lightSpecular * specularLight;

    // Calcular contribucion de luces de semaforos
    vec4 trafficLightContribution = vec4(0.0);
    for (int i = 0; i < MAX_TRAFFIC_LIGHTS; i++) {
        if (i >= u_numTrafficLights) break;

        // Direccion y distancia al semaforo
        vec3 toLight = u_trafficLightPositions[i] - v_worldPosition;
        float distance = length(toLight);
        vec3 lightDir = normalize(toLight);

        // Atenuacion por distancia (luz puntual)
        float attenuation = 1.0 / (1.0 + 0.5 * distance + 0.2 * distance * distance);

        // Solo afecta si la superficie mira hacia la luz
        float diff = max(dot(normal, lightDir), 0.0);

        // Contribucion de esta luz de semaforo (intensidad fuerte)
        vec4 lightColor = u_trafficLightColors[i];
        trafficLightContribution += lightColor * baseColor * diff * attenuation * 0.8;
    }

    // Calcular contribucion de luces de coches (luz blanca suave)
    // Patron de luces de semaforos
    vec4 carLightContribution = vec4(0.0);
    vec4 carLightColor = vec4(1.0, 1.0, 0.9, 1.0); // Blanco ligeramente calido
    for (int i = 0; i < MAX_CARS; i++) {
        if (i >= u_numCars) break;

        // Direccion y distancia al coche
        vec3 toCarLight = u_carPositions[i] - v_worldPosition;
        float carDistance = length(toCarLight);
        vec3 carLightDir = normalize(toCarLight);

        // Atenuacion por distancia (luz puntual)
        // Mismo patron que semaforos
        float carAttenuation = 1.0 / (1.0 + 0.5 * carDistance + 0.2 * carDistance * carDistance);

        // Solo afecta si la superficie mira hacia la luz
        float carDiff = max(dot(normal, carLightDir), 0.0);

        // Contribucion de esta luz de coche
        // Mismo patron que semaforos
        carLightContribution += carLightColor * baseColor * carDiff * carAttenuation * 0.8;
    }

    // Calcular contribucion de luces de edificios (colores calidos aleatorios)
    // Patron de luces de semaforos
    vec4 buildingLightContribution = vec4(0.0);
    for (int i = 0; i < MAX_BUILDING_LIGHTS; i++) {
        if (i >= u_numBuildingLights) break;

        // Direccion y distancia al edificio
        vec3 toBuildingLight = u_buildingLightPositions[i] - v_worldPosition;
        float buildingDistance = length(toBuildingLight);
        vec3 buildingLightDir = normalize(toBuildingLight);

        // Atenuacion por distancia (luz puntual mas suave que coches)
        float buildingAttenuation = 1.0 / (1.0 + 0.3 * buildingDistance + 0.1 * buildingDistance * buildingDistance);

        // Solo afecta si la superficie mira hacia la luz
        float buildingDiff = max(dot(normal, buildingLightDir), 0.0);

        // Contribucion de esta luz de edificio (intensidad cyberpunk neon)
        vec4 buildingColor = u_buildingLightColors[i];
        buildingLightContribution += buildingColor * baseColor * buildingDiff * buildingAttenuation * 0.25;
    }

    // Final color: iluminacion principal + luces de semaforos + luces de coches + luces de edificios
    outColor = ambient + diffuse + specular + trafficLightContribution + carLightContribution + buildingLightContribution;
    outColor = clamp(outColor, 0.0, 1.0);
    outColor.a = u_materialColor.a;
}
