uniform float threshold;
bool isInsideFxyzOrbital(vec3 point, float threshold) {
float r = length(point); // r = sqrt(x² + y² + z²)
// f_xyz orbital: psi ~ xyz * exp(-r). (We use exp(-2*r) for the squared amplitude.)
float psiSquared = (point.x * point.y * point.z) * (point.x * point.y * point.z) * exp(-2.0 * r);
return psiSquared > threshold;
}

vec3 gradientPsiSquared(vec3 point) {
float r = length(point);
float radial = exp(-2.0 * r); // common exponential factor

// The squared wavefunction is: psiSquared = (x*y*z)² * exp(-2r).
// Let P = x² y² z². Then dP/dx = 2*x*y²*z², etc.
// And note: d/dr exp(-2r) = -2 exp(-2r) with chain derivative (x/r, y/r, z/r).

float P = point.x * point.x * point.y * point.y * point.z * point.z;

// Partial derivative with respect to x:
float dPdx = 2.0 * point.x * point.y * point.y * point.z * point.z;
float dExpDx = -2.0 * (point.x / r) * radial;
// By product rule:
float dPsiDx = dPdx * radial + P * dExpDx;

// Partial derivative with respect to y:
float dPdy = 2.0 * point.y * point.x * point.x * point.z * point.z;
float dExpDy = -2.0 * (point.y / r) * radial;
float dPsiDy = dPdy * radial + P * dExpDy;

// Partial derivative with respect to z:
float dPdz = 2.0 * point.z * point.x * point.x * point.y * point.y;
float dExpDz = -2.0 * (point.z / r) * radial;
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
        if(!isInsideFxyzOrbital(position.xyz, threshold)) {
            vec3 gradient = gradientPsiSquared(position.xyz);
            velocity.xyz += gradient * 0.5; // Reflect the velocity

        }
        float randomFactor = 0.002; // Adding randomness prevents the particles from entering a stable state
        velocity.xyz += vec3(
            random(uv + vec2(0.1, 0.2)) * randomFactor - randomFactor / 2.0,
            random(uv + vec2(0.3, 0.4)) * randomFactor - randomFactor / 2.0,
            random(uv + vec2(0.5, 0.6)) * randomFactor - randomFactor / 2.0
        );
        vec3 centralForce = -normalize(position.xyz) * 0.003; // Central force towards the origin
        velocity.xyz += centralForce;

        velocity.xyz = clamp(velocity.xyz, -0.5, 0.5);
        gl_FragColor = velocity;
    }