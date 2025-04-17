uniform float threshold; // Determines the “inside” region for the orbital.
// Returns true if the psi² value is larger than the threshold.
// Here, psi² = [y*(5y² - 3r²)]² * exp(-2r)
bool isInsideFxOrbital(vec3 point, float threshold) {
float r = length(point);
float angular = point.y * (5.0 * point.y * point.y - 3.0 * (r * r));
float psiSquared = angular * angular * exp(-2.0 * r);
return psiSquared > threshold;
}

// Computes the gradient of psiSquared = [y*(5y^2 - 3r^2)]^2 * exp(-2r).
// Here we write psiSquared = P * exp(-2r), with P = f^2 and
// f = y*(5y^2 - 3r^2).
vec3 gradientPsiSquared(vec3 point) {
float r = length(point);
// Avoid division by zero near the origin.
float safeR = max(r, 0.0001);
float radial = exp(-2.0 * r);


// Define f = y * (5y^2 - 3r^2).
// For clarity, r^2 = x^2 + y^2 + z^2.
float f = point.y * (5.0 * point.y * point.y - 3.0 * (r * r));

// It can be helpful to expand f:
// f = 5y^3 - 3y*(x^2 + y^2 + z^2) = 2y^3 - 3y*(x^2+z^2)
// Now compute the partial derivatives of f:
// df/dx = derivative of -3y*(x^2+z^2) with respect to x = -6*x*y.
float df_dx = -6.0 * point.x * point.y;
// df/dy = derivative of 2y^3 is 6y^2; derivative of -3y*(x^2+z^2) is -3*(x^2+z^2).
float df_dy = 6.0 * point.y * point.y - 3.0 * (point.x * point.x + point.z * point.z);
// df/dz = derivative of -3y*(x^2+z^2) with respect to z = -6*z*y.
float df_dz = -6.0 * point.z * point.y;

// Now let P = f^2. Then the partial derivatives of P are:
// dP/dk = 2*f * (df/dk), for k in {x, y, z}.
float dPdx = 2.0 * f * df_dx;
float dPdy = 2.0 * f * df_dy;
float dPdz = 2.0 * f * df_dz;

// Derivatives of the radial part: d/dx exp(-2r) = -2*(x/safeR)*exp(-2r), etc.
float dExpDx = -2.0 * (point.x / safeR) * radial;
float dExpDy = -2.0 * (point.y / safeR) * radial;
float dExpDz = -2.0 * (point.z / safeR) * radial;

// Using the product rule,
// d/dk [P * exp(-2r)] = (dP/dk)*exp(-2r) + P * d/dk[exp(-2r)].
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

if (!isInsideFxOrbital(position.xyz, threshold * 40.0)) {
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