uniform float threshold;
bool isInsideDxyOrbital(vec3 point, float threshold) {
    float r = length(point); // r = sqrt(x^2 + y^2 + z^2)
    float psiSquared = pow(point.x * point.y, 2.0) * exp(-2.0 * r);
    return psiSquared > threshold;
}

vec3 gradientPsiSquared(vec3 point) {
    float r = length(point);
    float psiSquared = pow(point.x * point.y, 2.0) * exp(-2.0 * r);

    // Partial derivatives of (xy)^2 * exp(-2r)
    float dPsiDx = 2.0 * point.x * point.y * point.y * exp(-2.0 * r)
                   - 2.0 * psiSquared * point.x / r;
    float dPsiDy = 2.0 * point.y * point.x * point.x * exp(-2.0 * r)
                   - 2.0 * psiSquared * point.y / r;
    float dPsiDz = -2.0 * psiSquared * point.z / r; // Optional, but typically zero for Dxy orbital

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
        if(!isInsideDxyOrbital(position.xyz, threshold)) { // THESHOLD is half the size to account for the smaller value it produces
            vec3 gradient = gradientPsiSquared(position.xyz);
            velocity.xyz += normalize(gradient) * 0.01; // Reflect the velocity

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