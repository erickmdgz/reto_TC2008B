#version 300 es
// Fragment shader for emission (traffic lights)
// Estructura de CG-2025
precision highp float;

in vec3 v_normal;
in vec3 v_surfaceToLight;
in vec3 v_surfaceToView;
in vec4 v_color;

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

    // Emission component - el color del material brilla por si mismo
    vec4 emission = u_materialColor * 1.5;

    // Ambient component (reduced for emission effect)
    vec4 ambient = u_lightAmbient * u_materialColor * 0.3;

    // Specular component for glow effect
    float specularLight = pow(max(dot(normal, halfVector), 0.0), u_materialShininess);
    vec4 specular = u_lightSpecular * specularLight * 0.5;

    // Final color with emission glow
    outColor = emission + ambient + specular;
    outColor = clamp(outColor, 0.0, 1.0);
    outColor.a = u_materialColor.a;
}
