uniform sampler2D atomicEmissionSpectrum;
uniform float maxDistance; // Add maxDistance as a uniform
varying vec3 vPosition; // Particle position passed from the vertex shader
void main() {
    // Calculate the distance from the center
    float distance = length(vPosition);

    // Normalize the distance to a range [0, 1] (adjust maxDistance as needed)
    float normalizedDistance = clamp(distance / maxDistance, 0.0, 1.0);
    vec3 color = texture2D(atomicEmissionSpectrum, vec2(normalizedDistance, 0.5)).rgb;
gl_FragColor = vec4(color, vPosition == vec3(0, 0, 0) ? 0.0 : 1.0);

}