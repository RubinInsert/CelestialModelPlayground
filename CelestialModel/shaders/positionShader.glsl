    uniform float deltaTime; // Time step for simulation
    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 position = texture2D(texturePosition, uv);
        vec4 velocity = texture2D(textureVelocity, uv);

        // Update position based on velocity

        position.xyz += velocity.xyz * deltaTime * 2.0; // Adjust the time step as needed
        gl_FragColor = position;
    }