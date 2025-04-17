uniform float maxDistance; // Add maxDistance as a uniform
varying vec3 vPosition; // Particle position passed from the vertex shader

void main() {
    // Calculate the distance from the center
    float distance = length(vPosition);

    // Normalize the distance to a range [0, 1] (adjust maxDistance as needed)
    float normalizedDistance = clamp(distance / maxDistance, 0.0, 1.0);

    // Define the 5 colors for the gradient
    vec3 color1 = vec3(0.0, 0.0, 1.0); // Blue
    vec3 color2 = vec3(0.0, 1.0, 1.0); // Cyan
    vec3 color3 = vec3(0.0, 1.0, 0.0); // Green
    vec3 color4 = vec3(1.0, 1.0, 0.0); // Yellow
    vec3 color5 = vec3(1.0, 0.0, 0.0); // Red

    // Interpolate between the colors based on normalizedDistance
    vec3 color;
    if (normalizedDistance < 0.25) {
        color = mix(color1, color2, normalizedDistance / 0.25);
    } else if (normalizedDistance < 0.5) {
        color = mix(color2, color3, (normalizedDistance - 0.25) / 0.25);
    } else if (normalizedDistance < 0.75) {
        color = mix(color3, color4, (normalizedDistance - 0.5) / 0.25);
    } else {
        color = mix(color4, color5, (normalizedDistance - 0.75) / 0.25);
    }

    // Set the particle color
    gl_FragColor = vec4(color, 1.0);

}