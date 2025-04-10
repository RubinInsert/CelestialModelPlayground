uniform float threshold;
bool isInsideSOrbital(vec3 point, float radius) {
    float r = length(point); // Calculate the radial distance
    return r <= radius; // Check if the point is within the radius
}
    vec3 reflectVelocity(vec3 velocity, vec3 normal) {
        return velocity - 2.0 * dot(velocity, normal) * normal;
    }
    float random(vec2 uv) {
    return fract(sin(dot(uv.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 position = texture2D(texturePosition, uv);
    vec4 velocity = texture2D(textureVelocity, uv);
    
    // Apply some simple physics (e.g., gravity)
    if (!isInsideSOrbital(position.xyz, 2.5)) { // Use a radius of 0.5 for the S orbital
        vec3 direction = normalize(position.xyz); // Direction pointing outward
        velocity.xyz -= direction * 0.01; // Push particles back towards the circle
    }
    float randomFactor = 0.005; // Adding randomness prevents the particles from entering a stable state
    velocity.xyz += vec3(
        random(uv + vec2(0.1, 0.2)) * randomFactor - randomFactor / 2.0,
        random(uv + vec2(0.3, 0.4)) * randomFactor - randomFactor / 2.0,
        random(uv + vec2(0.5, 0.6)) * randomFactor - randomFactor / 2.0
    );
    velocity.xyz = clamp(velocity.xyz, -0.5, 0.5);
    gl_FragColor = velocity;
}