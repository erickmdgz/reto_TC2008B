#version 300 es
// Vertex shader for emission (traffic lights)
// Estructura de CG-2025

in vec4 a_position;
in vec3 a_normal;
in vec4 a_color;

// Model uniforms
uniform mat4 u_transforms;
uniform mat4 u_modelMatrix;
uniform mat4 u_normalMatrix;

// Scene uniforms
uniform vec3 u_lightPosition;
uniform vec3 u_viewPosition;

// Outputs to fragment shader
out vec3 v_normal;
out vec3 v_surfaceToLight;
out vec3 v_surfaceToView;
out vec4 v_color;

void main() {
    // Transform the position of the vertices
    gl_Position = u_transforms * a_position;

    // Transform the normal vector along with the object
    v_normal = mat3(u_normalMatrix) * a_normal;

    // Get world position of the surface
    vec3 surfaceWorldPosition = (u_modelMatrix * a_position).xyz;

    // Direction from the surface to the light
    v_surfaceToLight = u_lightPosition - surfaceWorldPosition;

    // Direction from the surface to the view
    v_surfaceToView = u_viewPosition - surfaceWorldPosition;

    // Pass vertex color
    v_color = a_color;
}
