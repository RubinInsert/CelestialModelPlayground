uniform sampler2D atomicEmissionSpectrum;
uniform float maxDistance;
uniform vec3 spinStateColor;
uniform float spinStateFadeFactor; // Controls how much normal particles fade out when visualising spin state
uniform float spinStateRatio; // The ratio of spin state particles to total normal coloured particles

float rand(vec3 co) {
    // Simple hash function for pseudo-randomness
    return fract(sin(dot(co, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}
varying vec3 vPosition; // Particle position passed from the vertex shader
void main() {
    float distance = length(vPosition);
    float normalizedDistance = clamp(distance / maxDistance, 0.0, 1.0);

    vec3 neutral = texture2D(atomicEmissionSpectrum, vec2(normalizedDistance, 0.5)).rgb;
    vec3 red = vec3(1.0, 0.0, 0.0);
    vec3 blue = vec3(0.0, 0.0, 1.0);

    float r = rand(vPosition);
    vec3 finalColor;
    if (r < spinStateRatio) {
        finalColor = spinStateColor;
    } else {
        finalColor = neutral * spinStateFadeFactor;
    }

    float alpha = (vPosition == vec3(0.0)) ? 0.0 : 1.0;

    gl_FragColor = vec4(finalColor, alpha);

}