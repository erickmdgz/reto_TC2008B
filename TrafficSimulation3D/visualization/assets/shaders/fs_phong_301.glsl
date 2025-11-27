#version 300 es
// Fragment shader for Phong lighting
// Estructura de CG-2025
// Con soporte para luces de semaforos y coches
precision highp float;

// Maximo numero de semaforos y coches
const int MAX_TRAFFIC_LIGHTS = 30;
const int MAX_CARS = 50;

in vec3 v_normal;
in vec3 v_surfaceToLight;
in vec3 v_surfaceToView;
in vec4 v_color;
in vec3 v_worldPosition;

// Scene uniforms
uniform vec4 u_lightAmbient;
uniform vec4 u_lightDiffuse;
uniform vec4 u_lightSpecular;

// Model uniforms
uniform vec4 u_materialColor;
uniform float u_materialShininess;

// Traffic light uniforms
uniform vec3 u_trafficLightPositions[MAX_TRAFFIC_LIGHTS];
uniform vec4 u_trafficLightColors[MAX_TRAFFIC_LIGHTS];
uniform int u_numTrafficLights;

// Car light uniforms
uniform vec3 u_carPositions[MAX_CARS];
uniform int u_numCars;

out vec4 outColor;

void main() {
    // Normalize vectors
    vec3 normal = normalize(v_normal);
    vec3 surfaceToLightDirection = normalize(v_surfaceToLight);
    vec3 surfaceToViewDirection = normalize(v_surfaceToView);

    // Half vector for specular calculation
    vec3 halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);

    // Ambient component
    vec4 ambient = u_lightAmbient * u_materialColor;

    // Diffuse component
    float diffuseLight = max(dot(normal, surfaceToLightDirection), 0.0);
    vec4 diffuse = u_lightDiffuse * u_materialColor * diffuseLight;

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

        // Contribucion de esta luz de semaforo (intensidad reducida)
        vec4 lightColor = u_trafficLightColors[i];
        trafficLightContribution += lightColor * u_materialColor * diff * attenuation * 0.3;
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
        carLightContribution += carLightColor * u_materialColor * carDiff * carAttenuation * 0.8;
    }

    // Final color: iluminacion principal + luces de semaforos + luces de coches
    outColor = ambient + diffuse + specular + trafficLightContribution + carLightContribution;
    outColor = clamp(outColor, 0.0, 1.0);
    outColor.a = u_materialColor.a;
}
