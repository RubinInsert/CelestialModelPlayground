uniform float threshold;
bool isInsideFzOrbital(vec3 point, float threshold) {
    float r = length(point);
    // Angular part: z * (x^2 - y^2)
    float angular = point.z * (point.x * point.x - point.y * point.y);
    float psiSquared = angular * angular * exp(-2.0 * r);
    return psiSquared > threshold;
}

// Computes the gradient of psiSquared = [z*(x^2 - y^2)]^2 * exp(-2r)
// We write it as: psiSquared = P * exp(-2r), with P = z^2 * (x^2 - y^2)^2.
vec3 gradientPsiSquared(vec3 point) {
    float r = length(point);
    // Avoid division by zero (e.g., close to the origin)
    float safeR = max(r, 0.0001);
    float radial = exp(-2.0 * r);
    // Define Q = (x^2 - y^2)^2 and P = z^2 * Q.
    float Q = (point.x * point.x - point.y * point.y) * (point.x * point.x - point.y * point.y);
    float P = point.z * point.z * Q;

    // Compute partial derivatives of P:
    // dP/dx = z^2 * d/dx[(x^2 - y^2)^2] = z^2 * 4*x*(x^2 - y^2)
    float dPdx = point.z * point.z * (4.0 * point.x * (point.x * point.x - point.y * point.y));
    // dP/dy = z^2 * d/dy[(x^2 - y^2)^2] = z^2 * -4*y*(x^2 - y^2)
    float dPdy = point.z * point.z * (-4.0 * point.y * (point.x * point.x - point.y * point.y));
    // dP/dz = 2*z * Q
    float dPdz = 2.0 * point.z * Q;

    // The derivative of exp(-2r) with respect to each coordinate:
    // d/dx exp(-2r) = -2*(x/safeR)*exp(-2r), etc.
    float dExpDx = -2.0 * (point.x / safeR) * radial;
    float dExpDy = -2.0 * (point.y / safeR) * radial;
    float dExpDz = -2.0 * (point.z / safeR) * radial;

    // Using the product rule: d/dk (P*exp(-2r)) = dP/dk * exp(-2r) + P * d/dk[exp(-2r)].
    float dPsiDx = dPdx * radial + P * dExpDx;
    float dPsiDy = dPdy * radial + P * dExpDy;
    float dPsiDz = dPdz * radial + P * dExpDz;

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
    if (!isInsideFzOrbital(position.xyz, threshold)) {
        vec3 gradient = gradientPsiSquared(position.xyz);
        velocity.xyz += gradient * 0.5; // Reflect the velocity
    }

    float randomFactor = 0.002; // Adding randomness prevents the particles from entering a stable state
    velocity.xyz += vec3(
        random(uv + vec2(0.1, 0.2)) * randomFactor - randomFactor / 2.0,
        random(uv + vec2(0.3, 0.4)) * randomFactor - randomFactor / 2.0,
        random(uv + vec2(0.5, 0.6)) * randomFactor - randomFactor / 2.0
    );
    vec3 centralForce = -normalize(position.xyz) * 0.004; // Central force towards the origin
    velocity.xyz += centralForce;

    velocity.xyz = clamp(velocity.xyz, -0.5, 0.5);
    gl_FragColor = velocity;
}