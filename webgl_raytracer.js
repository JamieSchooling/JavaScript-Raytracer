let fragmentShaderSrc = `
precision mediump float;

varying vec2 pixelPos;
uniform vec3 ViewParams;
uniform mat4 CamLocalToWorldMatrix;
uniform vec3 SunDirection;
uniform float SunFocus;
uniform float SunIntensity;

struct Ray 
{
    vec3 origin;
    vec3 direction;
};

struct Material
{
    vec3 colour;
    float smoothness;
    float specularProbability;
    vec3 specularColour;
    vec3 emissionColour;
    float emissionStrength;
};

struct RaycastResult 
{
    bool didHit;
    vec3 position;
    vec3 normal;
    float t;
    Material material;
};

struct Sphere
{
    vec3 position;
    float radius;
    Material material;
};
uniform Sphere spheres[{spheresLength}];

RaycastResult RaySphere(Ray ray, vec3 sphereCentre, float sphereRadius)
{
    RaycastResult hit;
    hit.didHit = false;
    hit.t = 0.0;
    hit.position = vec3(0, 0, 0);
    hit.normal = vec3(0, 0, 0);

    vec3 offsetRayOrigin = ray.origin - sphereCentre;

    float a = dot(ray.direction, ray.direction);
    float b = 2.0 * dot(offsetRayOrigin, ray.direction);
    float c = dot(offsetRayOrigin, offsetRayOrigin) - sphereRadius * sphereRadius;
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant >= 0.0) {
        float t = (-b - sqrt(discriminant)) / (2.0 * a);
        if (t >= 0.0) {
            hit.didHit = true;
            hit.t = t;
            hit.position = ray.origin + ray.direction * t;
            hit.normal = normalize(hit.position - sphereCentre);
        }
    }

    return hit;
}

float Random(vec2 co)
{
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float RandomValueNormalDistribution(vec2 co) 
{
    float theta = 2.0 * 3.14159265359 * Random(co);
    float rho = sqrt(-2.0 * log(1.0 - Random(co)));
    return rho * cos(theta);
}

vec3 RandomDirection(vec2 co) 
{
    float x = RandomValueNormalDistribution(co);
    float y = RandomValueNormalDistribution(co);
    float z = RandomValueNormalDistribution(co);
    return normalize(vec3(x, y, z));
}

vec2 RandomPointInCircle(vec2 co)
{
    float angle = Random(co) * 2.0 * 3.14159265359;
    vec2 pointOnCircle = vec2(cos(angle), sin(angle));
    return pointOnCircle * sqrt(Random(co));
}

RaycastResult TraceRay(Ray ray) 
{
    RaycastResult closestHit;
    closestHit.t = 100000000.0;

    for (int i = 0; i < {spheresLength}; i++) {
        Sphere sphere = spheres[i];
        RaycastResult raycastResult = RaySphere(ray, sphere.position, sphere.radius);

        if (raycastResult.didHit && raycastResult.t < closestHit.t) {
            closestHit = raycastResult;
            closestHit.material = sphere.material;
        }
    }

    return closestHit;
}

vec3 GetEnvironmentLight(Ray ray)
{
    vec3 skyColourHorizon = vec3(1, 1, 1);
    vec3 skyColourZenith = vec3(0.3, 0.5, 0.9);
    vec3 groundColour = vec3(0.2, 0.2, 0.2);
    
    float skyGradientT = pow(smoothstep(0.0, 0.4, ray.direction.y), 0.35);
    vec3 skyGradient = mix(skyColourHorizon, skyColourZenith, skyGradientT);
    float sun = pow(max(0.0, dot(ray.direction, -SunDirection)), SunFocus) * SunIntensity;

    float groundToSkyT = smoothstep(-0.15, 0.0, ray.direction.y);
    bool sunMask = groundToSkyT >= 1.0;   

    return mix(groundColour, skyGradient, groundToSkyT) + sun * float(sunMask);
}

vec3 RayColour(Ray ray, vec2 co)
{
    vec3 incomingLight = vec3(0, 0, 0);
    vec3 rayColour = vec3(1, 1, 1);

    for (int i = 0; i < 3; i++) 
    {
        RaycastResult castResult = TraceRay(ray);
        Material material = castResult.material;

        if (!castResult.didHit) incomingLight += GetEnvironmentLight(ray) * rayColour;

        ray.origin = castResult.position;
        vec3 diffuseDirection = normalize(castResult.normal + RandomDirection(co));
        ray.direction = diffuseDirection;

        vec3 emittedLight = material.emissionColour * material.emissionStrength;
        incomingLight += emittedLight * rayColour;
    }

    return incomingLight;
}

void main()
{
    vec3 viewPointLocal = vec3(pixelPos.xy - 0.5, 1) * ViewParams;
    vec4 viewPoint = CamLocalToWorldMatrix * vec4(viewPointLocal, 1);

    vec3 colour;
    for (int i = 0; i < 30; i++) {
        Ray ray;
        ray.origin = vec3(0, 0, 0);
        ray.direction = normalize(viewPoint.xyz - ray.origin);
        colour += RayColour(ray, pixelPos);
    }
    colour = colour / 30.0;

    gl_FragColor = vec4(colour, 1.0);
}
`

let vertexShaderSrc = 
`
attribute vec2 a_position;

varying vec2 pixelPos;

void main() 
{
    pixelPos = vec2(max(0.0, a_position.x), max(0.0, a_position.y));
    gl_Position = vec4(a_position, 0, 1);
}
`

import Material from "./material.js";
import { Sphere } from "./shapes.js";
import Vec3 from "./vec3.js";

const spheres = [
    new Sphere(new Vec3(0, 0, -1), 0.3, new Material(new Vec3(1, 0, 0))),       // Red sphere
    new Sphere(new Vec3(0, 0.2, -0.8), 0.15, new Material(new Vec3(0, 0, 1))),       // Blue sphere
    new Sphere(new Vec3(0, -100.5, -1), 100, new Material(new Vec3(0, 1, ))),       // Big green sphere
];

fragmentShaderSrc = fragmentShaderSrc.replaceAll("{spheresLength}", spheres.length)

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");

gl.clearColor(1.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);

let vertexShader = gl.createShader(gl.VERTEX_SHADER);
let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

gl.shaderSource(vertexShader, vertexShaderSrc);
gl.shaderSource(fragmentShader, fragmentShaderSrc);

gl.compileShader(vertexShader);
if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('ERROR compiling vertex shader!', gl.getShaderInfoLog(vertexShader));
}

gl.compileShader(fragmentShader);
if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('ERROR compiling fragment shader!', gl.getShaderInfoLog(fragmentShader));
}

let program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('ERROR linking program!', gl.getProgramInfoLog(program));
}
gl.validateProgram(program);
if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
    console.error('ERROR validating program!', gl.getProgramInfoLog(program));
}
gl.useProgram(program);

let buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(
  gl.ARRAY_BUFFER, 
  new Float32Array([
    -1.0, -1.0, 
     1.0, -1.0, 
     -1.0,  1.0, 
    -1.0,  1.0, 
     1.0, -1.0, 
     1.0,  1.0
    ]), 
  gl.STATIC_DRAW
);

let positionAttribLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionAttribLocation);
gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);

let imageWidth = canvas.width;
let imageHeight = canvas.height;
let aspectRatio = imageHeight / imageWidth;

let camPosition = [0, 0, 0];
let camUp = [0, 1, 0];
let camRight = [1, 0, 0];
let camForward = [0, 0, -1];
let fov = 60;
let focusDistance = 1;

let sunDirection = new Vec3(-1.1, -1.3, -1.5).normalised();
let sunIntensity = 5;
let sunFocus = 500;

function updateCameraParams(camPos, fov, focusDistance, aspectRatio) {
    let viewParamsLocation = gl.getUniformLocation(program, "ViewParams");
    let camMatrixLocation = gl.getUniformLocation(program, "CamLocalToWorldMatrix");
    let planeHeight = focusDistance * Math.tan(fov * 0.5 * (Math.PI / 180)) * 2;
    let planeWidth = planeHeight / aspectRatio;
    gl.uniform3fv(viewParamsLocation, [planeWidth, planeHeight, focusDistance]);
    gl.uniformMatrix4fv(camMatrixLocation, false,
        [
            camRight[0], camRight[1], camRight[2], 0, 
            camUp[0], camUp[1], camUp[2], 0,
            camForward[0], camForward[1], camForward[2], 0,
            camPos[0], camPos[1], camPos[2], 1,
        ]
    );
}

function updateLightParams(sunDirection, sunIntensity, sunFocus) {
    let sunDirectionLocation = gl.getUniformLocation(program, "SunDirection");
    let sunIntensityLocation = gl.getUniformLocation(program, "SunIntensity");
    let sunFocusLocation = gl.getUniformLocation(program, "SunFocus");
    gl.uniform3fv(sunDirectionLocation, [sunDirection.x, sunDirection.y, sunDirection.z]);
    gl.uniform1f(sunIntensityLocation, sunIntensity);
    gl.uniform1f(sunFocusLocation, sunFocus);
}

let spheresLocations = []; 


for (let i = 0; i < spheres.length; i++) {
    spheresLocations.push({
        position: gl.getUniformLocation(program, `spheres[${i}].position`),
        radius: gl.getUniformLocation(program, `spheres[${i}].radius`),
        colour: gl.getUniformLocation(program, `spheres[${i}].material.colour`),
    });
}

function setSpheres(spheres) {
    for (let i = 0; i < spheres.length; i++) {
        gl.uniform3fv(spheresLocations[i].position, [spheres[i].centre.x, spheres[i].centre.y, spheres[i].centre.z]);
        gl.uniform1f(spheresLocations[i].radius, spheres[i].radius);
        gl.uniform3fv(spheresLocations[i].colour, [spheres[i].material.colour.x, spheres[i].material.colour.y, spheres[i].material.colour.z]);
    }
}

setSpheres(spheres);
updateCameraParams(camPosition, fov, focusDistance, aspectRatio);
updateLightParams(sunDirection, sunIntensity, sunFocus);

gl.drawArrays(gl.TRIANGLES, 0, 6);



