uniform float elapsedTime;

const float PI = 3.14159265359;
const float a0 = 1.0; // Bohr radius
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
// Dz² Orbital ---------------------------------------------------------
float R_3d(float r) {
    // Radial part of 3d orbital
    return r * r * exp(-r / (3.0 * a0));
}

float Y_20(float theta) {
    // Angular part of Dz² (d₃z²-r²) orbital
    return (3.0 * cos(theta) * cos(theta) - 1.0) * 0.5;
}


// ------------------------------
// Radial part of 2p orbital (n=2, l=1)
float R_2p(float r) {
    return r * exp(-r / (2.0 * a0));
}

// Angular part of Px orbital (real part, proportional to spherical harmonic Y_{1,1} + Y_{1,-1})
float Y_1px(float theta, float phi) {
    return sin(theta) * cos(phi);
}
// Biased random direction to give more emphasis to z-axis
vec3 biasedRandomDirection(vec2 seed, float timeSeed) {
    float h1 = hash(seed + timeSeed);
    float h2 = hash(seed * 3.1 + timeSeed * 0.5);
    float h3 = hash(seed * 2.5 + timeSeed * 1.3);
    
    // Bias the theta distribution to favor poles
    float bias = 0.6; // Adjust this value to control bias strength
    float theta;
    
    if (h3 < 0.4) {
        // 40% chance to be in the lobes (close to poles)
        theta = mix(0.0, PI * 0.3, h1) * (h3 < 0.2 ? 1.0 : -1.0) + (h3 < 0.2 ? 0.0 : PI);
    } else {
        // 60% chance to be in the ring region
        theta = mix(PI * 0.4, PI * 0.6, h1);
    }
    
    float phi = 2.0 * PI * h2;
    
    return vec3(
        sin(theta) * cos(phi),
        sin(theta) * sin(phi),
        cos(theta)
    );
}

// Generate a random radius in a plausible range
float randomRadius(vec2 seed, float timeSeed) {
    return hash(seed * 5.0 + timeSeed) * 8.0; // Max r = 8
}

vec3 slerp(vec3 a, vec3 b, float t) {
    float omega = acos(dot(a, b));
    if (omega < 0.001) return mix(a, b, t); // Avoid division by small values
    float sinOmega = sin(omega);
    return (sin((1.0 - t) * omega) * a + sin(t * omega) * b) / sinOmega;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 seed =  uv * 100.0; // scale to increase randomness

    // SLOW TIME: only update every few seconds
    float t = floor(elapsedTime * 10.0);
    float t0 = floor(t);
    float t1 = t0 + 1.0;
    float mixVal = fract(t);

    // Get two random directions and radii
    vec3 dir0 = biasedRandomDirection(seed, t);
    vec3 dir1 = biasedRandomDirection(seed, t1);
    vec3 dir = dir0;
    //vec3 dir = slerp(dir0, dir1, mixVal);

    float r0 = randomRadius(seed, t);
    float r1 = randomRadius(seed, t1);
    float r = r0;
    //float r = mix(r0, r1, mixVal);

    // Calculate spherical components
    float theta = acos(dir.z);
    float radial = R_3d(r);
    float angular = Y_20(theta);
    
    // Weight the lobes more heavily to balance the visualization
    float boost = abs(angular) > 0.2 ? 1.5 : 1.0;
    float probDensity = radial * radial * angular * angular * boost;
    if (probDensity < 8.0) discard; // or: if (U > probDensity) discard;
    // Apply density to scale outward motion, with emphasis on the lobes
    float finalR = r * abs(probDensity);
    
    // Boost particles along z-axis (lobes)
    if (abs(dir.z) > 0.8) {
        finalR *= 1.5;
    }

    vec3 pos = dir * finalR; // Add some oscillation
    
    
    gl_FragColor = vec4(pos, 1.0);
    // For colored particles: gl_FragColor = vec4(color, 1.0);
}