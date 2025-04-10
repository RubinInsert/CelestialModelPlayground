uniform float threshold;
const float scaleFactor = 2.0; // Arbitrary scaling factor because Dz2 uses a different estimation function
bool isInsideDz2Orbital(vec3 point, float threshold) {
    point *= scaleFactor; // Apply scaling to the point
    float r2 = dot(point, point); // r^2 = x^2 + y^2 + z^2
    float psiSquared = pow(3.0 * point.z * point.z - r2, 2.0) * exp(-2.0 * sqrt(r2));
    return psiSquared > (threshold * scaleFactor);
}

vec3 gradientPsiSquared(vec3 point) {
    point *= scaleFactor; // Apply scaling to the point
    float r2 = dot(point, point);
    float r = sqrt(r2);
    float psiSquared = pow(3.0 * point.z * point.z - r2, 2.0) * exp(-2.0 * r);

    // Partial derivatives of (3z^2 - r^2)^2 * exp(-2r)
    float dPsiDx = -4.0 * psiSquared * point.x / r
                   - 4.0 * (3.0 * point.z * point.z - r2) * point.x * exp(-2.0 * r);
    float dPsiDy = -4.0 * psiSquared * point.y / r
                   - 4.0 * (3.0 * point.z * point.z - r2) * point.y * exp(-2.0 * r);
    float dPsiDz = 12.0 * point.z * (3.0 * point.z * point.z - r2) * exp(-2.0 * r)
                   - 4.0 * psiSquared * point.z / r;

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
        if(!isInsideDz2Orbital(position.xyz, threshold * scaleFactor)) { // THESHOLD is half the size to account for the smaller value it produces
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