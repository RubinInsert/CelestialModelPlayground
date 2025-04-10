    bool isInsidePxOrbital(vec3 point, float threshold) {
    float r = length(point); // r = sqrt(x^2 + y^2 + z^2)
    float psiSquared = point.x * point.x * exp(-2.0 * r);
    return psiSquared > threshold;
    }
    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 position = texture2D(texturePosition, uv);
        vec4 velocity = texture2D(textureVelocity, uv);

        // Update position based on velocity

        position.xyz += velocity.xyz * 0.01; // Adjust the time step as needed
        gl_FragColor = position;
    }