uniform vec4 colour; // Add maxDistance as a uniform
varying vec3 vPosition; // Particle position passed from the vertex shader

void main() {
    gl_FragColor = colour;

}