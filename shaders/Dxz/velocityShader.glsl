uniform float threshold;
bool isInsideDxzOrbital(vec3 point, float threshold) {
    float r = length(point); // r = sqrt(x^2 + y^2 + z^2)
    float psiSquared = pow(point.x * point.z, 2.0) * exp(-2.0 * r); // Use xz instead of xy
    return psiSquared > threshold;
}

vec3 gradientPsiSquared(vec3 point) {
    float r = length(point);
    float psiSquared = pow(point.x * point.z, 2.0) * exp(-2.0 * r);

    // Partial derivatives of (xz)^2 * exp(-2r)
    float dPsiDx = 2.0 * point.x * point.z * point.z * exp(-2.0 * r)
                   - 2.0 * psiSquared * point.x / r;
    float dPsiDy = -2.0 * psiSquared * point.y / r; // No dependence on y for Dxz orbital
    float dPsiDz = 2.0 * point.z * point.x * point.x * exp(-2.0 * r)
                   - 2.0 * psiSquared * point.z / r;

    return vec3(dPsiDx, dPsiDy, dPsiDz);
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
        if(!isInsideDxzOrbital(position.xyz, threshold)) { // THESHOLD is half the size to account for the smaller value it produces
            vec3 gradient = gradientPsiSquared(position.xyz);
            velocity.xyz += normalize(gradient) * 0.01; // Reflect the velocity

        }
        float randomFactor = 0.005; // Adding randomness prevents the particles from entering a stable state
        velocity.xyz += vec3(
            random(uv + vec2(0.1, 0.2)) * randomFactor - randomFactor / 2.0,
            random(uv + vec2(0.3, 0.4)) * randomFactor - randomFactor / 2.0,
            random(uv + vec2(0.5, 0.6)) * randomFactor - randomFactor / 2.0
        );
        vec3 centralForce = -normalize(position.xyz) * 0.003;
        velocity.xyz += centralForce;
        velocity.xyz = clamp(velocity.xyz, -0.5, 0.5);
        gl_FragColor = velocity;
    }