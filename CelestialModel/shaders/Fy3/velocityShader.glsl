uniform float threshold;
bool isInsideFyOrbital(vec3 point, float threshold) {
float r = length(point);
float angular = point.x * (5.0 * point.x * point.x - 3.0 * (r * r));
float psiSquared = angular * angular * exp(-2.0 * r);
return psiSquared > threshold;
}

// Computes the gradient of psiSquared = [x*(5x^2 - 3r^2)]^2 * exp(-2r).
// We write psiSquared = P * exp(-2r), where
// f = x*(5x^2 - 3r^2)
// P = f^2.
vec3 gradientPsiSquared(vec3 point) {
float r = length(point);
// Avoid division by zero near the origin.
float safeR = max(r, 0.0001);
float radial = exp(-2.0 * r);


// Compute f = x*(5x^2 - 3r^2)
float f = point.x * (5.0 * point.x * point.x - 3.0 * (r * r));
// Its partial derivatives:
// Write r^2 = x^2 + y^2 + z^2.
// f = 5x^3 - 3x*(x^2+y^2+z^2) = 2x^3 - 3x*(y^2+z^2)
float df_dx = 6.0 * point.x * point.x - 3.0 * (point.y * point.y + point.z * point.z);
float df_dy = -6.0 * point.x * point.y;
float df_dz = -6.0 * point.x * point.z;

// Now, let P = f^2. Then, dP/dk = 2*f * df/dk for k in {x, y, z}.
float dPdx = 2.0 * f * df_dx;
float dPdy = 2.0 * f * df_dy;
float dPdz = 2.0 * f * df_dz;

// The derivative of exp(-2r) with respect to each coordinate:
// d/dx exp(-2r) = -2 * (x/safeR)*exp(-2r), etc.
float dExpDx = -2.0 * (point.x / safeR) * radial;
float dExpDy = -2.0 * (point.y / safeR) * radial;
float dExpDz = -2.0 * (point.z / safeR) * radial;

// Using the product rule:
// d/dk (P*exp(-2r)) = (dP/dk)*exp(-2r) + P * d/dk[exp(-2r)]
float dPsiDx = dPdx * radial + (f * f) * dExpDx;
float dPsiDy = dPdy * radial + (f * f) * dExpDy;
float dPsiDz = dPdz * radial + (f * f) * dExpDz;

return vec3(dPsiDx, dPsiDy, dPsiDz);
}

// A standard helper function to reflect a velocity vector about a given normal.
vec3 reflectVelocity(vec3 velocity, vec3 normal) {
return velocity - 2.0 * dot(velocity, normal) * normal;
}

// A simple randomness generator based on the fragment UV coordinate.
float random(vec2 uv) {
return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
vec2 uv = gl_FragCoord.xy / resolution.xy;
vec4 position = texture2D(texturePosition, uv);
vec4 velocity = texture2D(textureVelocity, uv);


// Apply a force when the point is outside the orbital region;
// inside means psi² > threshold.

if (!isInsideFyOrbital(position.xyz, threshold * 40.0)) {
    vec3 gradPsi = gradientPsiSquared(position.xyz);
    // A simple scaling factor controls how strongly the particle reacts.
    velocity.xyz += normalize(gradPsi) * 0.01;
}

// Add a small random perturbation to avoid static behavior.
float randomFactor = 0.003;
velocity.xyz += vec3(
    random(uv + vec2(0.1, 0.2)) * randomFactor - randomFactor * 0.5,
    random(uv + vec2(0.3, 0.4)) * randomFactor - randomFactor * 0.5,
    random(uv + vec2(0.5, 0.6)) * randomFactor - randomFactor * 0.5
);

// // A central force toward the origin.
vec3 centralForce = -normalize(position.xyz) * 0.003;
velocity.xyz += centralForce;

// Clamp the velocities to prevent runaway movement.
velocity.xyz = clamp(velocity.xyz, -0.5, 0.5);

gl_FragColor = velocity;
}