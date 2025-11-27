#version 300 es
// Fragment shader for emission (traffic lights)
// Estructura de CG-2025
// Los semaforos brillan con su color propio
precision highp float;

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

out vec4 outColor;

void main() {
    // Normalize vectors
    vec3 normal = normalize(v_normal);
    vec3 surfaceToLightDirection = normalize(v_surfaceToLight);
    vec3 surfaceToViewDirection = normalize(v_surfaceToView);

    // Half vector for specular calculation
    vec3 halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);

    // Diffuse component (iluminacion normal)
    float diffuseLight = max(dot(normal, surfaceToLightDirection), 0.0);
    vec4 diffuse = u_lightDiffuse * u_materialColor * diffuseLight;

    // Ambient component
    vec4 ambient = u_lightAmbient * u_materialColor;

    // Specular component
    float specularLight = 0.0;
    if (diffuseLight > 0.0) {
        specularLight = pow(max(dot(normal, halfVector), 0.0), u_materialShininess);
    }
    vec4 specular = u_lightSpecular * specularLight;

    // Brillo propio - el color del material se intensifica ligeramente
    // No emite luz, solo brilla mas de lo normal
    vec4 selfGlow = u_materialColor * 0.4;

    // Final color: iluminacion Phong normal + brillo propio sutil
    outColor = ambient + diffuse + specular + selfGlow;
    outColor = clamp(outColor, 0.0, 1.0);
    outColor.a = u_materialColor.a;
}
