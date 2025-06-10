uniform sampler2D atomicEmissionSpectrum;
uniform float maxDistance; // Add maxDistance as a uniform

// UNIFORMS FOR VISUALISING SPIN STATE ------------
uniform float mode;       // -1.0 (blue), 0.0 (off), 1.0 (red)
//-------------------------------------------------


varying vec3 vPosition; // Particle position passed from the vertex shader
void main() {
    float distance = length(vPosition);
    float normalizedDistance = clamp(distance / maxDistance, 0.0, 1.0);
    
    vec3 neutral = texture2D(atomicEmissionSpectrum, vec2(normalizedDistance, 0.5)).rgb;
    // vec3 red = vec3(1.0, 0.0, 0.0);
    // vec3 blue = vec3(0.0, 0.0, 1.0);

    // vec3 targetColor = mix(blue, red, clamp(mode * 0.5 + 0.5, 0.0, 1.0)); // -1→0, 0→0.5, 1→1
    // vec3 finalColor = mix(neutral, targetColor, abs(mode));

    float alpha = (vPosition == vec3(0.0)) ? 0.0 : 1.0;

    gl_FragColor = vec4(neutral, alpha);

}