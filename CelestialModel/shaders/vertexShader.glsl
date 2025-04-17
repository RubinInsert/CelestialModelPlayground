uniform sampler2D texturePosition;
uniform float scale;

varying vec2 vUv;
varying vec3 vPosition; // Declare vPosition to pass to the fragment shader

void main() {
    vUv = uv;

    // Get the particle position from the texture
    vec4 pos = texture2D(texturePosition, uv);

    // Apply scaling to the position
    vec3 scaledPosition = pos.xyz * scale;

    // Pass the scaled position to the fragment shader
    vPosition = scaledPosition;

    // Set the final position
    gl_Position = projectionMatrix * modelViewMatrix * vec4(scaledPosition, 1.0);
    gl_PointSize = 3.0;
}