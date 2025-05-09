uniform sampler2D atomicEmissionSpectrum;
uniform float maxDistance; // Add maxDistance as a uniform
varying vec3 vPosition; // Particle position passed from the vertex shader
void main() {
    // Calculate the distance from the center
    float distance = length(vPosition);

    // Normalize the distance to a range [0, 1] (adjust maxDistance as needed)
    float normalizedDistance = clamp(distance / maxDistance, 0.0, 1.0);
vec3 pos = vPosition; // Use the passed position from the vertex shader
float r = length(pos);
float theta = acos(pos.z / (r + 1e-6));
// Spherical harmonic Y_20
float y20 = (3.0 * cos(theta) * cos(theta) - 1.0) * 0.5;

// Classic coloring: lobes (positive) are orange, donut (negative) is blue
vec3 color = y20 > 0.0 ? vec3(1.0, 0.5, 0.2) : vec3(0.2, 0.6, 1.0);
gl_FragColor = vec4(color, 1.0);

}