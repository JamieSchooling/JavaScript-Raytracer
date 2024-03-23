let fragmentShaderSrc = `#version 300 es
precision mediump float;

in vec2 pixelPos;

const float PI = 3.141592653589793;
const int MAX_SPHERES = 100;
const int MAX_TRIS = 10;
const int MAX_BOUNCE_COUNT = 5;
const float PIXEL_SAMPLE_COUNT = 32.0;

uniform vec2 ScreenParams;
uniform vec3 ViewParams;
uniform mat4 CamLocalToWorldMatrix;
uniform vec3 WorldSpaceCameraPos;

uniform vec3 SunDirection;
uniform float SunFocus;
uniform float SunIntensity;

uniform vec3 SkyColourHorizon;
uniform vec3 SkyColourZenith;
uniform vec3 GroundColour;

uniform float Frame;

out vec4 fragColour;

struct Ray 
{
    vec3 origin;
    vec3 dir;
};

struct RayTracingMaterial
{
    vec3 colour;
    vec3 emissionColour;
    float emissionStrength;
    float smoothness;
    float specularProbability;
    vec3 specularColour;
};

struct Triangle
{
    vec3 posA, posB, posC;
    vec3 normalA, normalB, normalC;
};

struct HitInfo
{
    bool didHit;
    float dst;
    vec3 hitPoint;
    vec3 normal;
    RayTracingMaterial material;
};

uniform int NumSpheres;
uniform sampler2D SphereGeometryTex;
uniform vec2 SphereGeometryTexSize;

uniform sampler2D SphereMatsTex;
uniform vec2 SphereMatsTexSize;

uniform int NumTris;

uniform sampler2D TrianglesInfoTex;
uniform vec2 TrianglesInfoTexSize;

vec4 texelFetch(sampler2D tex, vec2 texSize, vec2 pixelCoord) {
    vec2 uv = (pixelCoord + 0.5) / texSize;
    return texture(tex, uv);
}

vec4 getValueByIndexFromTexture(sampler2D tex, vec2 texSize, float index) {
    float col = mod(index, texSize.x);
    float row = floor(index / texSize.x);
    return texelFetch(tex, texSize, vec2(col, row));
}

HitInfo RaySphere(Ray ray, vec3 sphereCentre, float sphereRadius)
{
    HitInfo hitInfo;
    vec3 offsetRayOrigin = ray.origin - sphereCentre;
    float a = dot(ray.dir, ray.dir);
    float b = 2.0 * dot(offsetRayOrigin, ray.dir);
    float c = dot(offsetRayOrigin, offsetRayOrigin) - sphereRadius * sphereRadius;
    float discriminant = b * b - 4.0 * a * c; 

    if (discriminant >= 0.0) {
        float dst = (-b - sqrt(discriminant)) / (2.0 * a);

        if (dst >= 0.0) {
            hitInfo.didHit = true;
            hitInfo.dst = dst;
            hitInfo.hitPoint = ray.origin + ray.dir * dst;
            hitInfo.normal = normalize(hitInfo.hitPoint - sphereCentre);
        }
    }
    return hitInfo;
}

HitInfo RayTriangle(Ray ray, Triangle tri) {
    float epsilon = 0.0000001;

    HitInfo hitInfo;
    hitInfo.didHit = false;

    vec3 edge1 = tri.posB - tri.posA;
    vec3 edge2 = tri.posC - tri.posA;
    vec3 rayCrossEdge2 = cross(ray.dir, edge2);
    float determinant = dot(edge1, rayCrossEdge2);

    if (determinant > -epsilon && determinant < epsilon) {
        return hitInfo;
    }

    float invDet = 1.0 / determinant;
    vec3 s = ray.origin - tri.posA;
    float u = invDet * dot(s, rayCrossEdge2);

    if (u < 0.0 || u > 1.0) {
        return hitInfo;
    }

    vec3 sCrossEdge1 = cross(s, edge1);
    float v = invDet * dot(ray.dir, sCrossEdge1);
    float w = 1.0 - u - v; 

    if (v < 0.0 || u + v > 1.0) {
        return hitInfo;
    }

    float dst = invDet * dot(edge2, sCrossEdge1);

    if (dst > epsilon) {
        hitInfo.didHit = true;
        hitInfo.hitPoint = ray.origin + ray.dir * dst;
        hitInfo.normal = normalize(tri.normalB * u + tri.normalC * v + tri.normalA * w);
        hitInfo.dst = dst;
        return hitInfo;
    } else {
        return hitInfo;
    }      
}

HitInfo TraceRay(Ray ray) 
{
    HitInfo closestHit;
    closestHit.dst = 1000000000000.0;

    for (int i = 0; i < MAX_SPHERES; i++)
    {
        if (i == NumSpheres) break;

        vec4 sphereInfo = getValueByIndexFromTexture(SphereGeometryTex, SphereGeometryTexSize, float(i));

        vec4 colourSmoothness = getValueByIndexFromTexture(SphereMatsTex, SphereMatsTexSize, float(i * 3));
        vec4 emission = getValueByIndexFromTexture(SphereMatsTex, SphereMatsTexSize, float((i * 3) + 1));
        vec4 specular = getValueByIndexFromTexture(SphereMatsTex, SphereMatsTexSize, float((i * 3) + 2));
        
        RayTracingMaterial material;
        material.colour = colourSmoothness.rgb;
        material.smoothness = colourSmoothness.a;

        material.emissionColour = emission.rgb;
        material.emissionStrength = emission.a;

        material.specularColour = specular.rgb;
        material.specularProbability = specular.a;
        
        HitInfo hitInfo = RaySphere(ray, sphereInfo.xyz, sphereInfo.w);

        if (hitInfo.didHit && hitInfo.dst < closestHit.dst) 
        {
            closestHit = hitInfo;
            
            closestHit.material = material;
        }
    }

    for (int i = 0; i < MAX_TRIS; i++) 
    {
        if (i == NumTris) break;

        Triangle triangle;
        triangle.posA = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(i*6)).xyz;
        triangle.posB = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(i*6 + 1)).xyz;
        triangle.posC = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(i*6 + 2)).xyz;

        triangle.normalA = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(i*6 + 3)).xyz;
        triangle.normalB = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(i*6 + 4)).xyz;
        triangle.normalC = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(i*6 + 5)).xyz;

        HitInfo hitInfo = RayTriangle(ray, triangle);

        if (hitInfo.didHit && hitInfo.dst < closestHit.dst) {
            closestHit = hitInfo;
            closestHit.material.colour = vec3(1, 1, 1);
        }

    }

    return closestHit;
}

// PCG (permuted congruential generator). Thanks to:
// www.pcg-random.org and www.shadertoy.com/view/XlGcRh
uint NextRandom(inout uint state)
{
    state = state * 747796405u + 2891336453u;
    uint result = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    result = (result >> 22u) ^ result;
    return result;
}

float Random(inout uint state)
{
    return float(NextRandom(state)) / 4294967295.0; // 2^32 - 1
}

float RandomValueNormalDistribution(inout uint rngState) 
{
    float theta = 2.0 * 3.14159265359 * Random(rngState);
    float rho = sqrt(-2.0 * log(1.0 - Random(rngState)));
    return rho * cos(theta);
}

vec3 RandomDirection(inout uint rngState) 
{
    float x = RandomValueNormalDistribution(rngState);
    float y = RandomValueNormalDistribution(rngState);
    float z = RandomValueNormalDistribution(rngState);
    return normalize(vec3(x, y, z));
}

vec3 GetEnvironmentLight(Ray ray)
{    
    float skyGradientT = pow(smoothstep(0.0, 0.4, ray.dir.y), 0.35);
    float groundToSkyT = smoothstep(-0.01, 0.0, ray.dir.y);

    vec3 skyGradient = mix(SkyColourHorizon, SkyColourZenith, skyGradientT);
    float sun = pow(max(0.0, dot(ray.dir, SunDirection)), SunFocus) * SunIntensity;
    
    vec3 composite = mix(GroundColour, skyGradient, groundToSkyT) + sun * float(groundToSkyT >= 1.0);

    return composite;
}

vec3 RayColour(Ray ray, inout uint rngState)
{
    vec3 incomingLight = vec3(0.0);
    vec3 rayColour = vec3(1.0);

    for (int i = 0; i <= MAX_BOUNCE_COUNT; i++)
    {
        HitInfo hitInfo = TraceRay(ray);
        RayTracingMaterial material = hitInfo.material;
        if (hitInfo.didHit)
        {
            bool isSpecularBounce = material.specularProbability >= Random(rngState);

            ray.origin = hitInfo.hitPoint;
            vec3 diffuseDirection = normalize(hitInfo.normal + RandomDirection(rngState));
            vec3 specularDirection = normalize(ray.dir - (hitInfo.normal * 2.0 * dot(hitInfo.normal, ray.dir)));
            ray.dir = normalize(mix(diffuseDirection, specularDirection, material.smoothness * float(isSpecularBounce)));

            vec3 emittedLight = material.emissionColour * material.emissionStrength;
            incomingLight += emittedLight * rayColour;
            rayColour *= mix(material.colour, material.specularColour, float(isSpecularBounce));
        }
        else
        {
            incomingLight += GetEnvironmentLight(ray) * rayColour;
            break;
        }
    }

    return incomingLight;
}

uniform sampler2D BaseImage;
void main() 
{
    // Create seed for random number generator
    uvec2 numPixels = uvec2(ScreenParams.xy);
    uvec2 pixelCoord = uvec2(pixelPos) * numPixels;
    uint pixelIndex = pixelCoord.y * numPixels.x + pixelCoord.x;
    uint rngState = pixelIndex + uint(Frame) * 719393u;

    vec3 viewPointLocal = vec3(pixelPos - 0.5, 1.0) * ViewParams;
    vec4 viewPoint = CamLocalToWorldMatrix * vec4(viewPointLocal, 1.0);

    Ray ray;
    ray.origin = WorldSpaceCameraPos;
    ray.dir = normalize(viewPoint.xyz - ray.origin); 

    vec3 totalIncomingLight = vec3(0.0);

    for (float i = 0.0; i < PIXEL_SAMPLE_COUNT;  i++)
    {
        totalIncomingLight += RayColour(ray, rngState);
    }
    vec3 pixelColour = totalIncomingLight / PIXEL_SAMPLE_COUNT;

    vec3 baseColour = texture(BaseImage, pixelPos).xyz;
    fragColour = vec4(baseColour + (pixelColour - baseColour) / (Frame + 1.0), 1.0);
}
`

let drawFragShaderSrc = 
`#version 300 es
precision mediump float;

uniform sampler2D CurrentFrame;

in vec2 pixelPos;

out vec4 fragColour;

void main() 
{
    vec4 colour = texture(CurrentFrame, pixelPos);

    fragColour = colour;
}
`

let vertexShaderSrc = 
`#version 300 es
precision mediump float;

in vec2 a_position;

out vec2 pixelPos;

void main() 
{
    pixelPos = vec2(max(0.0, a_position.x), max(0.0, a_position.y));
    gl_Position = vec4(a_position, 0, 1);
}
`

import Material from "./material.js";
import { Sphere, Triangle } from "./shapes.js";
import Vec3 from "./vec3.js";

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");

let raytraceProgram;
let drawProgram;

function initWebGL() {
    gl.clearColor(1.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let vertexShader = gl.createShader(gl.VERTEX_SHADER);
    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    let drawFragShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexShaderSrc);
    gl.shaderSource(fragmentShader, fragmentShaderSrc);
    gl.shaderSource(drawFragShader, drawFragShaderSrc);

    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling vertex shader!', gl.getShaderInfoLog(vertexShader));
    }

    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling fragment shader!', gl.getShaderInfoLog(fragmentShader));
    }

    gl.compileShader(drawFragShader);
    if (!gl.getShaderParameter(drawFragShader, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling draw fragment shader!', gl.getShaderInfoLog(drawFragShader));
    }

    raytraceProgram = gl.createProgram();
    gl.attachShader(raytraceProgram, vertexShader);
    gl.attachShader(raytraceProgram, fragmentShader);
    gl.linkProgram(raytraceProgram);
    if (!gl.getProgramParameter(raytraceProgram, gl.LINK_STATUS)) {
        console.error('ERROR linking raytrace program!', gl.getProgramInfoLog(raytraceProgram));
    }
    gl.validateProgram(raytraceProgram);
    if (!gl.getProgramParameter(raytraceProgram, gl.VALIDATE_STATUS)) {
        console.error('ERROR validating raytrace program!', gl.getProgramInfoLog(raytraceProgram));
    }

    drawProgram = gl.createProgram();
    gl.attachShader(drawProgram, vertexShader);
    gl.attachShader(drawProgram, drawFragShader);
    gl.linkProgram(drawProgram);
    if (!gl.getProgramParameter(drawProgram, gl.LINK_STATUS)) {
        console.error('ERROR linking draw program!', gl.getProgramInfoLog(drawProgram));
    }
    gl.validateProgram(drawProgram);
    if (!gl.getProgramParameter(drawProgram, gl.VALIDATE_STATUS)) {
        console.error('ERROR validating draw program!', gl.getProgramInfoLog(drawProgram));
    }

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

    let positionAttribLocation = gl.getAttribLocation(raytraceProgram, "a_position");
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
}

function updateCameraParams() {
    let planeWidth = focusDistance * Math.tan(fov * 0.5 * (Math.PI / 180)) * 2;
    let planeHeight = planeWidth * aspectRatio;
    let viewParamsLocation = gl.getUniformLocation(raytraceProgram, "ViewParams");
    gl.uniform3fv(viewParamsLocation, [planeWidth, planeHeight, focusDistance]);
    let camLocalToWorldMatrixLocation = gl.getUniformLocation(raytraceProgram, "CamLocalToWorldMatrix");
    gl.uniformMatrix4fv(camLocalToWorldMatrixLocation, false,
        [
            camRight.x, camRight.y, camRight.z, 0,
            camUp.x, camUp.y, camUp.z, 0,
            camForward.x, camForward.y, camForward.z, 0,
            camPosition.x, camPosition.y, camPosition.z, 1,
        ]
    );
    let worldSpaceCameraPosLocation = gl.getUniformLocation(raytraceProgram, "WorldSpaceCameraPos");
    gl.uniform3fv(worldSpaceCameraPosLocation, [camPosition.x, camPosition.y, camPosition.z]);
}

function updateScreenParams() {
    let screenParamsLocation = gl.getUniformLocation(raytraceProgram, "ScreenParams");
    gl.uniform2fv(screenParamsLocation, [imageWidth, imageHeight]);
}

function updateLightParams() {
    let sunDirLocation = gl.getUniformLocation(raytraceProgram, "SunDirection");
    gl.uniform3fv(sunDirLocation, [sunDirection.x, sunDirection.y, sunDirection.z]);
    let sunFocusLocation = gl.getUniformLocation(raytraceProgram, "SunFocus");
    gl.uniform1f(sunFocusLocation, sunFocus);
    let sunIntensityLocation = gl.getUniformLocation(raytraceProgram, "SunIntensity");
    gl.uniform1f(sunIntensityLocation, sunIntensity);
    

    let horizonColourLocation = gl.getUniformLocation(raytraceProgram, "SkyColourHorizon");
    gl.uniform3fv(horizonColourLocation, [skyColourHorizon.x, skyColourHorizon.y, skyColourHorizon.z]);
    let skyColourLocation = gl.getUniformLocation(raytraceProgram, "SkyColourZenith");
    gl.uniform3fv(skyColourLocation, [skyColourZenith.x, skyColourZenith.y, skyColourZenith.z]);
    let groundColourLocation = gl.getUniformLocation(raytraceProgram, "GroundColour");
    gl.uniform3fv(groundColourLocation, [groundColour.x, groundColour.y, groundColour.z]);
}

function setSpheres() {
    let numSpheresLocation = gl.getUniformLocation(raytraceProgram, "NumSpheres");
    gl.uniform1i(numSpheresLocation, spheres.length);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, spheresInfoTex);
    let sphereGeometryTexLocation = gl.getUniformLocation(raytraceProgram, "SphereGeometryTex");
    gl.uniform1i(sphereGeometryTexLocation, 1);
    let sphereGeometryTexSizeLoc = gl.getUniformLocation(raytraceProgram, "SphereGeometryTexSize");
    gl.uniform2f(sphereGeometryTexSizeLoc, spheresInfo.length / 4, 1);
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, sphereMatsTex);
    let sphereMatsTexLocation = gl.getUniformLocation(raytraceProgram, "SphereMatsTex");
    gl.uniform1i(sphereMatsTexLocation, 2);
    let sphereMatsTexSizeLoc = gl.getUniformLocation(raytraceProgram, "SphereMatsTexSize");
    gl.uniform2f(sphereMatsTexSizeLoc, sphereMaterials.length / 4, 1);

}

function setTriangles() {
    let numTrisLocation = gl.getUniformLocation(raytraceProgram, "NumTris");
    gl.uniform1i(numTrisLocation, triangles.length);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, trianglesInfoTex);
    let trianglesInfoTexLoc = gl.getUniformLocation(raytraceProgram, "TrianglesInfoTex");
    gl.uniform1i(trianglesInfoTexLoc, 3);
    let trianglesInfoTexSizeLoc = gl.getUniformLocation(raytraceProgram, "TrianglesInfoTexSize");
    gl.uniform2f(trianglesInfoTexSizeLoc, triangleInfo.length / 3, 1);
}

let imageWidth = canvas.width;
let imageHeight = canvas.height;
let aspectRatio = imageHeight / imageWidth;

let camPosition = new Vec3(0, 0, -1);
let camUp = new Vec3(0, 1, 0);
let camRight = new Vec3(1, 0, 0);
let camForward = new Vec3(0, 0, 1);
let fov = 60;
let focusDistance = 1;

let sunDirection  = new Vec3(0.6, 0.5, -1).normalised();
let sunIntensity = 40;
let sunFocus = 200;

let skyColourHorizon = new Vec3(1, 1, 1);
let skyColourZenith = new Vec3(0.3, 0.5, 0.9);
let groundColour = new Vec3(0.2, 0.2, 0.2);

initWebGL();

const spheres = [
    new Sphere(new Vec3(-0.5, -0.2, 2), 0.3, new Material(new Vec3(1, 0, 0), new Vec3(1, 1, 1), 0, 1, 0.1)),       // Red sphere
    new Sphere(new Vec3(0.3,-0.35, 1.8), 0.15, new Material(new Vec3(0,0,1), new Vec3(1, 1, 1), 0, 1, 0.1)),  // Blue sphere
    new Sphere(new Vec3(0,-100.5, 2), 100, new Material(new Vec3(.7,.1,.7))),    // Big sphere
];
let spheresInfo = [];
let sphereMaterials = [];
for (let i = 0; i < spheres.length; i++)
{
    spheresInfo.push(spheres[i].centre.x);
    spheresInfo.push(spheres[i].centre.y);
    spheresInfo.push(spheres[i].centre.z);
    spheresInfo.push(spheres[i].radius);
    
    sphereMaterials.push(spheres[i].material.colour.x);
    sphereMaterials.push(spheres[i].material.colour.y);
    sphereMaterials.push(spheres[i].material.colour.z);
    sphereMaterials.push(spheres[i].material.smoothness);
    
    sphereMaterials.push(spheres[i].material.emissionColour.x);
    sphereMaterials.push(spheres[i].material.emissionColour.y);
    sphereMaterials.push(spheres[i].material.emissionColour.z);
    sphereMaterials.push(spheres[i].material.emissionStrength);
    
    sphereMaterials.push(spheres[i].material.specularColour.x);
    sphereMaterials.push(spheres[i].material.specularColour.y);
    sphereMaterials.push(spheres[i].material.specularColour.z);
    sphereMaterials.push(spheres[i].material.specularProbability);
}
let spheresInfoTex = makeDataTexture(gl, spheresInfo, 4);
let sphereMatsTex = makeDataTexture(gl, sphereMaterials, 4);

const triangles = [
    new Triangle(
        new Vec3(-0.5, -0.45, 1.5), new Vec3(-1, -0.45, 1), new Vec3(0, -0.45, 1),
        new Vec3(0, 1, 0), new Vec3(0, 1, 0), new Vec3(0, 1, 0),
    ),
    new Triangle(
        new Vec3(0.5, -0.35, 1.5), new Vec3(0, -0.35, 1), new Vec3(1, -0.35, 1),
        new Vec3(0, 1, 0), new Vec3(0, 1, 0), new Vec3(0, 1, 0),
    ),
    new Triangle(
        new Vec3(0.5, 0.35, 1.5), new Vec3(0, 0.35, 1), new Vec3(1, 0.35, 1),
        new Vec3(0, 1, 0), new Vec3(0, 1, 0), new Vec3(0, 1, 0),
    ),
    new Triangle(
        new Vec3(0.2, 0.3, 2.5), new Vec3(-0.3, 0.3, 2), new Vec3(0.7, 0.3, 2),
        new Vec3(0, 1, 0), new Vec3(0, 1, 0), new Vec3(0, 1, 0),
    ),
];

let triangleInfo = [];
for (let i = 0; i < triangles.length; i++) {
    triangleInfo.push(triangles[i].posA.x);
    triangleInfo.push(triangles[i].posA.y);
    triangleInfo.push(triangles[i].posA.z);

    triangleInfo.push(triangles[i].posB.x);
    triangleInfo.push(triangles[i].posB.y);
    triangleInfo.push(triangles[i].posB.z);
    
    triangleInfo.push(triangles[i].posC.x);
    triangleInfo.push(triangles[i].posC.y);
    triangleInfo.push(triangles[i].posC.z);

    triangleInfo.push(triangles[i].normalA.x);
    triangleInfo.push(triangles[i].normalA.y);
    triangleInfo.push(triangles[i].normalA.z);
    
    triangleInfo.push(triangles[i].normalB.x);
    triangleInfo.push(triangles[i].normalB.y);
    triangleInfo.push(triangles[i].normalB.z);

    triangleInfo.push(triangles[i].normalC.x);
    triangleInfo.push(triangles[i].normalC.y);
    triangleInfo.push(triangles[i].normalC.z);
}
let trianglesInfoTex = makeDataTexture(gl, triangleInfo, 3);

function makeDataTexture(gl, data, numComponents) {
    // expand the data to 4 values per pixel.
    const numElements = data.length / numComponents;
    const expandedData = new Float32Array(numElements * 4);
    for (let i = 0; i < numElements; ++i) {
        const srcOff = i * numComponents;
        const dstOff = i * 4;
        for (let j = 0; j < numComponents; ++j) {
        expandedData[dstOff + j] = data[srcOff + j];
        }
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,            // mip level
        gl.RGBA32F,      // format
        numElements,  // width
        1,            // height
        0,            // border
        gl.RGBA,      // format
        gl.FLOAT,     // type
        expandedData,
    );
    // make it possible to use a non-power-of-2 texture and
    // we don't need any filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return tex;
}

// Create (empty) texture for raytracer output
const textureA = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textureA);
gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, imageWidth, imageHeight);
gl.bindTexture(gl.TEXTURE_2D, null);

const fboA = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureA, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

const textureB = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textureB);
gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, imageWidth, imageHeight);
gl.bindTexture(gl.TEXTURE_2D, null);

const fboB = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureB, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

function rayTrace() {
    gl.useProgram(raytraceProgram);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, (frame % 2 == 0) ? textureA : textureB);
    let currentFrameLocation = gl.getUniformLocation(raytraceProgram, "BaseImage");
    gl.uniform1i(currentFrameLocation, 0);
    
    updateScreenParams();
    updateCameraParams();
    updateLightParams();
    setSpheres();
    setTriangles();
    
    let frameLocation = gl.getUniformLocation(raytraceProgram, "Frame");
    gl.uniform1f(frameLocation, frame);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, (frame % 2 == 0) ? fboB : fboA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function draw() {
    gl.useProgram(drawProgram);   

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, (frame % 2 == 0) ? textureB : textureA);
    let currentFrameLocation = gl.getUniformLocation(drawProgram, "CurrentFrame");
    gl.uniform1i(currentFrameLocation, 0);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

let frame = 0;
function render() {
    
    rayTrace();    
    draw();

    frame++;
    requestAnimationFrame(render);   
}
render();

