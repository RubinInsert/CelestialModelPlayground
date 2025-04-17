uniform float threshold; // Determines when a point is considered "inside" the orbital.

// Returns true if the psi² value is above the threshold.
// For the 4fz orbital, psi² = [z*(5z² - 3r²)]² * exp(-2r)
bool isInsideFzOrbital(vec3 point, float threshold) {
float r = length(point);
float angular = point.z * (5.0 * point.z * point.z - 3.0 * (r * r));
float psiSquared = angular * angular * exp(-2.0 * r);
return psiSquared > threshold;
}

// Computes the gradient of psi² = [z*(5z^2 - 3r^2)]² * exp(-2r).
// We write psi² = P * exp(-2r) with P = f^2 and f = z*(5z^2 - 3r^2).
//
// It is often helpful to expand f. Notice that:
// f = 5z³ - 3z*(x²+y²+z²)
// = (5z³ - 3z³) - 3z*(x²+y²)
// = 2z³ - 3z*(x²+y²)
//
vec3 gradientPsiSquared(vec3 point) {
float r = length(point);
// Avoid division by zero at or near the origin.
float safeR = max(r, 0.0001);
float radial = exp(-2.0 * r);


// Compute f = z*(5z² - 3r²)
float f = point.z * (5.0 * point.z * point.z - 3.0 * (r * r));

// Compute the partial derivatives of f.
// Using the expanded form: f = 2z³ - 3z*(x²+y²).
// Partial derivative with respect to x:
//   f does not depend on x in the first term, and for the second term:
//   d/dx[-3z*(x²+y²)] = -3z*(2x) = -6*x*z.
float df_dx = -6.0 * point.x * point.z;

// Partial derivative with respect to y:
//   Similarly, df/dy = -6.0 * point.y * point.z.
float df_dy = -6.0 * point.y * point.z;

// Partial derivative with respect to z:
//   From f = 2z³, d/dz (2z³) = 6z².
//   And from -3z*(x²+y²), the derivative with respect to z is -3*(x²+y²).
float df_dz = 6.0 * point.z * point.z - 3.0 * (point.x * point.x + point.y * point.y);

// Now, let P = f². Then, dP/dk = 2 * f * (df/dk), for k ∈ {x,y,z}.
float dPdx = 2.0 * f * df_dx;
float dPdy = 2.0 * f * df_dy;
float dPdz = 2.0 * f * df_dz;

// Derivatives of the radial factor: d/dk exp(-2r) = -2*(point.k/safeR)*exp(-2r).
float dExpDx = -2.0 * (point.x / safeR) * radial;
float dExpDy = -2.0 * (point.y / safeR) * radial;
float dExpDz = -2.0 * (point.z / safeR) * radial;

// Using the product rule:
// d/dk [P * exp(-2r)] = (dP/dk)*exp(-2r) + P * d/dk[exp(-2r)]
float dPsiDx = dPdx * radial + (f * f) * dExpDx;
float dPsiDy = dPdy * radial + (f * f) * dExpDy;
float dPsiDz = dPdz * radial + (f * f) * dExpDz;

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


// Apply a force when the point is outside the orbital region;
// inside means psi² > threshold.

if (!isInsideFzOrbital(position.xyz, threshold * 40.0)) {
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