            uniform vec3 uCameraPosition; // Camera position passed as a uniform
            uniform vec3 uColor; // Color passed as a uniform
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            const float RIM_START = 0.95;
            float stepFresnel(float fresnel, int steps) {
                float s = float(steps);
                float idx = floor(fresnel * s);
                return idx / (s - 1.0);
            }

            void main() {
                vec3 cameraDirection = normalize(uCameraPosition - vWorldPosition); // Calculate direction to the camera
                float d = abs(dot(normalize(vNormal), cameraDirection));
                float rim = sqrt(1.0 - d * d); // 0 at center, 1 at edge (linear with radius)
                float fresnel = 1.0 - smoothstep(RIM_START, 1.0, rim);
                //float fresnel = pow((dot(normalize(vNormal), cameraDirection)), 1.5);
                //fresnel = smoothstep(0.0, 1.0, fresnel);
                // Step the fresnel value into 4 bands
                float stepped = stepFresnel(fresnel, 4);
                vec3 color = mix(vec3(0.0, 0.0, 0.0), uColor, fresnel);

                if (rim < RIM_START) {
                    color = vec3(0.0, 0.0, 0.0);
                }
                gl_FragColor = vec4(color, 1.0); // Use stepped for opacity
            }