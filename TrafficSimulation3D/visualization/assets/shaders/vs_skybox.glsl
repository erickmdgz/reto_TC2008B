#version 300 es

in vec4 a_position;
in vec2 a_texcoord;

out vec2 v_texcoord;

uniform mat4 u_matrix;

void main() {
    v_texcoord = a_texcoord;
    gl_Position = u_matrix * a_position;
}
