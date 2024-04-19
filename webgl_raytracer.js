let fragmentShaderSrc = `#version 300 es
precision mediump float;

in vec2 pixelPos;

const float PI = 3.141592653589793;
const int MAX_SPHERES = 10000;
const int MAX_TRIS = 10000;
const int MAX_MESHES = 10000;
const int MAX_BOUNCE_COUNT = 4;
const int PIXEL_SAMPLE_COUNT = 32;

uniform vec2 ScreenParams;
uniform vec3 ViewParams;
uniform mat4 CamLocalToWorldMatrix;
uniform vec3 WorldSpaceCameraPos;
uniform float DivergeStrength;
uniform float DefocusStrength;

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

struct MeshInfo
{
    int firstTriangleIndex;
    int numTriangles;
    vec3 min;
    vec3 max;
    RayTracingMaterial material;
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

uniform int NumMeshes;
uniform sampler2D MeshInfoTex;
uniform vec2 MeshInfoTexSize;
uniform sampler2D MeshMatsTex;
uniform vec2 MeshMatsTexSize;

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

    vec3 edgeAB = tri.posB - tri.posA;
    vec3 edgeAC = tri.posC - tri.posA;
    vec3 normalVector = cross(edgeAB, edgeAC);
    vec3 ao = ray.origin - tri.posA;
    vec3 dao = cross(ao, ray.dir);

    float determinant = -dot(ray.dir, normalVector);
    float invDet = 1.0 / determinant;

    float dst = dot(ao, normalVector) * invDet;
    float u = dot(edgeAC, dao) * invDet;
    float v = -dot(edgeAB, dao) * invDet;
    float w = 1.0 - u - v;

    HitInfo hitInfo;
    hitInfo.didHit = determinant >= epsilon && dst >= 0.0 && u >= 0.0 && v >= 0.0 && w >= 0.0;
    hitInfo.hitPoint = ray.origin + ray.dir * dst;
    hitInfo.normal = normalize(tri.normalB * u + tri.normalC * v + tri.normalA * w);
    hitInfo.dst = dst;
    return hitInfo;
}

bool RayBoundingBox(Ray ray, vec3 boxMin, vec3 boxMax)
{
    vec3 invDir = 1.0 / ray.dir;
    vec3 tMin = (boxMin - ray.origin) * invDir;
    vec3 tMax = (boxMax - ray.origin) * invDir;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    return tNear <= tFar;
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

    for (int meshIndex = 0; meshIndex < MAX_MESHES; meshIndex++) 
    {
        if (meshIndex == NumMeshes) break;

        vec4 meshInfoA = getValueByIndexFromTexture(MeshInfoTex, MeshInfoTexSize, float(meshIndex * 2));
        vec4 meshInfoB = getValueByIndexFromTexture(MeshInfoTex, MeshInfoTexSize, float(meshIndex * 2 + 1));
        MeshInfo mesh;
        mesh.firstTriangleIndex = int(meshInfoA.w);
        mesh.numTriangles = int(meshInfoB.w);
        mesh.min = meshInfoA.xyz;
        mesh.max = meshInfoB.xyz;

        if (!RayBoundingBox(ray, mesh.min, mesh.max)) {
            continue;
        }
        
        vec4 colourSmoothness = getValueByIndexFromTexture(MeshMatsTex, MeshMatsTexSize, float(meshIndex * 3));
        vec4 emission = getValueByIndexFromTexture(MeshMatsTex, MeshMatsTexSize, float((meshIndex * 3) + 1));
        vec4 specular = getValueByIndexFromTexture(MeshMatsTex, MeshMatsTexSize, float((meshIndex * 3) + 2));
        
        RayTracingMaterial material;
        material.colour = colourSmoothness.rgb;
        material.smoothness = colourSmoothness.a;

        material.emissionColour = emission.rgb;
        material.emissionStrength = emission.a;

        material.specularColour = specular.rgb;
        material.specularProbability = specular.a;

        for (int i = 0; i < MAX_TRIS; i++)
        {
            if (i == mesh.numTriangles) break;
            int triIndex = mesh.firstTriangleIndex + i;

            Triangle triangle;
            triangle.posA = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(triIndex*6)).xyz;
            triangle.posB = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(triIndex*6 + 1)).xyz;
            triangle.posC = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(triIndex*6 + 2)).xyz;

            triangle.normalA = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(triIndex*6 + 3)).xyz;
            triangle.normalB = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(triIndex*6 + 4)).xyz;
            triangle.normalC = getValueByIndexFromTexture(TrianglesInfoTex, TrianglesInfoTexSize, float(triIndex*6 + 5)).xyz;

            HitInfo hitInfo = RayTriangle(ray, triangle);

            if (hitInfo.didHit && hitInfo.dst < closestHit.dst) {
                closestHit = hitInfo;
                closestHit.material = material;
            }
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

vec2 RandomPointInCircle(inout uint rngState)
{
    float angle = Random(rngState) * 2.0 * PI;
    vec2 pointOnCircle = vec2(cos(angle), sin(angle));
    return pointOnCircle * sqrt(Random(rngState));
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
    uvec2 pixelCoord = uvec2(pixelPos) * uvec2(ScreenParams);
    uint pixelIndex = pixelCoord.y * uint(ScreenParams.x) + pixelCoord.x;
    uint rngState = pixelIndex + uint(Frame) * 719393u;

    vec3 viewPointLocal = vec3(pixelPos - 0.5, 1.0) * ViewParams;
    vec4 viewPoint = CamLocalToWorldMatrix * vec4(viewPointLocal, 1.0);
    vec3 camRight = CamLocalToWorldMatrix[0].xyz;
    vec3 camUp = CamLocalToWorldMatrix[1].xyz;

    Ray ray;
    
    vec3 totalIncomingLight = vec3(0.0);
    
    for (int i = 0; i < PIXEL_SAMPLE_COUNT; i++)
    {
        vec2 defocusJitter = RandomPointInCircle(rngState) * DefocusStrength / ScreenParams.x;
        ray.origin = WorldSpaceCameraPos + camRight * defocusJitter.x + camUp * defocusJitter.y;
        vec2 jitter = RandomPointInCircle(rngState) * DivergeStrength / ScreenParams.x;
        vec3 jitteredFocusPoint = viewPoint.xyz + camRight * jitter.x + camUp * jitter.y;
        ray.dir = normalize(jitteredFocusPoint - ray.origin); 
        totalIncomingLight += RayColour(ray, rngState);
    }
    vec3 pixelColour = totalIncomingLight / float(PIXEL_SAMPLE_COUNT);

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
import OBJLoader from "./obj_loader.js";
import Scene from "./scene.js";
import SceneManager from "./scene_manager.js";


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
    let camera = SceneManager.currentScene.camera;
    let planeWidth = camera.focusDistance * Math.tan(camera.fov * 0.5 * (Math.PI / 180)) * 2;
    let planeHeight = planeWidth * aspectRatio;
    let viewParamsLocation = gl.getUniformLocation(raytraceProgram, "ViewParams");
    gl.uniform3fv(viewParamsLocation, [planeWidth, planeHeight, camera.focusDistance]);
    let camLocalToWorldMatrixLocation = gl.getUniformLocation(raytraceProgram, "CamLocalToWorldMatrix");
    gl.uniformMatrix4fv(camLocalToWorldMatrixLocation, false,
        [
            camera.right.x, camera.right.y, camera.right.z, 0,
            camera.up.x, camera.up.y, camera.up.z, 0,
            camera.forward.x, camera.forward.y, camera.forward.z, 0,
            camera.position.x, camera.position.y, camera.position.z, 1,
        ]
    );
    let worldSpaceCameraPosLocation = gl.getUniformLocation(raytraceProgram, "WorldSpaceCameraPos");
    gl.uniform3fv(worldSpaceCameraPosLocation, [camera.position.x, camera.position.y, camera.position.z]);

    let divergeStrengthLocation = gl.getUniformLocation(raytraceProgram, "DivergeStrength");
    gl.uniform1f(divergeStrengthLocation, camera.divergeStrength);
    
    let defocusStrengthLocation = gl.getUniformLocation(raytraceProgram, "DefocusStrength");
    gl.uniform1f(defocusStrengthLocation, camera.defocusStrength);
}

function updateScreenParams() {
    let screenParamsLocation = gl.getUniformLocation(raytraceProgram, "ScreenParams");
    gl.uniform2fv(screenParamsLocation, [imageWidth, imageHeight]);
}

function updateLightParams() {
    let sun = SceneManager.currentScene.sun;
    let sky = SceneManager.currentScene.skybox;

    let sunDirLocation = gl.getUniformLocation(raytraceProgram, "SunDirection");
    gl.uniform3fv(sunDirLocation, [sun.direction.x, sun.direction.y, sun.direction.z]);
    let sunFocusLocation = gl.getUniformLocation(raytraceProgram, "SunFocus");
    gl.uniform1f(sunFocusLocation, sun.focus);
    let sunIntensityLocation = gl.getUniformLocation(raytraceProgram, "SunIntensity");
    gl.uniform1f(sunIntensityLocation, sun.intensity);
    

    let horizonColourLocation = gl.getUniformLocation(raytraceProgram, "SkyColourHorizon");
    gl.uniform3fv(horizonColourLocation, [sky.colourHorizon.x, sky.colourHorizon.y, sky.colourHorizon.z]);
    let skyColourLocation = gl.getUniformLocation(raytraceProgram, "SkyColourZenith");
    gl.uniform3fv(skyColourLocation, [sky.colourZenith.x, sky.colourZenith.y, sky.colourZenith.z]);
    let groundColourLocation = gl.getUniformLocation(raytraceProgram, "GroundColour");
    gl.uniform3fv(groundColourLocation, [sky.groundColour.x, sky.groundColour.y, sky.groundColour.z]);
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
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, trianglesInfoTex);
    let trianglesInfoTexLoc = gl.getUniformLocation(raytraceProgram, "TrianglesInfoTex");
    gl.uniform1i(trianglesInfoTexLoc, 3);
    let trianglesInfoTexSizeLoc = gl.getUniformLocation(raytraceProgram, "TrianglesInfoTexSize");
    gl.uniform2f(trianglesInfoTexSizeLoc, triangleInfo.length / 3, 1);
}

function setMeshes() {
    let numMeshesLoc = gl.getUniformLocation(raytraceProgram, "NumMeshes");
    gl.uniform1i(numMeshesLoc, meshes.length);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, meshInfoTex);
    let meshInfoTexLoc = gl.getUniformLocation(raytraceProgram, "MeshInfoTex");
    gl.uniform1i(meshInfoTexLoc, 4);
    let meshInfoTexSizeLoc = gl.getUniformLocation(raytraceProgram, "MeshInfoTexSize");
    gl.uniform2f(meshInfoTexSizeLoc, meshInfo.length / 4, 1);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, meshMatsTex);
    let meshMatsTexLocation = gl.getUniformLocation(raytraceProgram, "MeshMatsTex");
    gl.uniform1i(meshMatsTexLocation, 5);
    let meshMatsTexSizeLoc = gl.getUniformLocation(raytraceProgram, "MeshMatsTexSize");
    gl.uniform2f(meshMatsTexSizeLoc, meshMaterials.length / 4, 1);
}

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

function rayTrace() {
    gl.useProgram(raytraceProgram);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, (currentFrame % 2 === 0) ? textureA : textureB);
    let currentFrameLocation = gl.getUniformLocation(raytraceProgram, "BaseImage");
    gl.uniform1i(currentFrameLocation, 0);
    
    updateScreenParams();
    updateCameraParams();
    updateLightParams();
    setSpheres();
    setTriangles();
    setMeshes();
    
    let frameLocation = gl.getUniformLocation(raytraceProgram, "Frame");
    gl.uniform1f(frameLocation, currentFrame);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, (currentFrame % 2 === 0) ? fboB : fboA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function draw() {
    gl.useProgram(drawProgram);   

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, (currentFrame % 2 === 0) ? textureB : textureA);
    let currentFrameLocation = gl.getUniformLocation(drawProgram, "CurrentFrame");
    gl.uniform1i(currentFrameLocation, 0);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

async function initObjects() {
    let scene = SceneManager.currentScene;

    spheres = scene.spheres;
    meshes = scene.meshes;
    triangles = scene.triangles;

    spheresInfo = [];
    sphereMaterials = [];
    
    triangleInfo = [];
    meshInfo = [];
    meshMaterials = [];

    for (let i = 0; i < scene.triangles.length; i++) {
        triangleInfo.push(scene.triangles[i].posA.x);
        triangleInfo.push(scene.triangles[i].posA.y);
        triangleInfo.push(scene.triangles[i].posA.z);

        triangleInfo.push(scene.triangles[i].posB.x);
        triangleInfo.push(scene.triangles[i].posB.y);
        triangleInfo.push(scene.triangles[i].posB.z);

        triangleInfo.push(scene.triangles[i].posC.x);
        triangleInfo.push(scene.triangles[i].posC.y);
        triangleInfo.push(scene.triangles[i].posC.z);

        triangleInfo.push(scene.triangles[i].normalA.x);
        triangleInfo.push(scene.triangles[i].normalA.y);
        triangleInfo.push(scene.triangles[i].normalA.z);

        triangleInfo.push(scene.triangles[i].normalB.x);
        triangleInfo.push(scene.triangles[i].normalB.y);
        triangleInfo.push(scene.triangles[i].normalB.z);

        triangleInfo.push(scene.triangles[i].normalC.x);
        triangleInfo.push(scene.triangles[i].normalC.y);
        triangleInfo.push(scene.triangles[i].normalC.z);
    } 
    trianglesInfoTex = makeDataTexture(gl, triangleInfo, 3);

    for (let i = 0; i < scene.meshes.length; i++) {
        meshInfo.push(scene.meshes[i].min.x);
        meshInfo.push(scene.meshes[i].min.y);
        meshInfo.push(scene.meshes[i].min.z);
        meshInfo.push(scene.meshes[i].firstTriangleIndex);

        meshInfo.push(scene.meshes[i].max.x);
        meshInfo.push(scene.meshes[i].max.y);
        meshInfo.push(scene.meshes[i].max.z);
        meshInfo.push(scene.meshes[i].numTriangles);

        meshMaterials.push(scene.meshes[i].material.colour.x);
        meshMaterials.push(scene.meshes[i].material.colour.y);
        meshMaterials.push(scene.meshes[i].material.colour.z);
        meshMaterials.push(scene.meshes[i].material.smoothness);
        
        meshMaterials.push(scene.meshes[i].material.emissionColour.x);
        meshMaterials.push(scene.meshes[i].material.emissionColour.y);
        meshMaterials.push(scene.meshes[i].material.emissionColour.z);
        meshMaterials.push(scene.meshes[i].material.emissionStrength);
        
        meshMaterials.push(scene.meshes[i].material.specularColour.x);
        meshMaterials.push(scene.meshes[i].material.specularColour.y);
        meshMaterials.push(scene.meshes[i].material.specularColour.z);
        meshMaterials.push(scene.meshes[i].material.specularProbability);
    }
    meshInfoTex = makeDataTexture(gl, meshInfo, 4);
    meshMatsTex = makeDataTexture(gl, meshMaterials, 4);

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
    spheresInfoTex = makeDataTexture(gl, spheresInfo, 4);
    sphereMatsTex = makeDataTexture(gl, sphereMaterials, 4);
}

async function createScenePlanet() {
    spheres = [];
    meshes = [];
    triangles = [];

    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/light_left.obj", triangles, new Material(new Vec3(0, 0, 0), new Vec3(1, 1, 1), 6.5, 0, 0, new Vec3(0, 0, 0), )));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/light_right.obj", triangles, new Material(new Vec3(0, 0, 0), new Vec3(1, 1, 1), 6.5, 0, 0, new Vec3(0, 0, 0))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/grass.obj", triangles, new Material(new Vec3(0.108, 0.576, 0.060))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/river.obj", triangles, new Material(new Vec3(0.155, 0.534, 0.793))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/mountain.obj", triangles, new Material(new Vec3(0.145, 0.145, 0.145))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/tree1.obj", triangles, new Material(new Vec3(0.145, 0.048, 0.010))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/tree2.obj", triangles, new Material(new Vec3(0.145, 0.048, 0.010))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/tree3.obj", triangles, new Material(new Vec3(0.145, 0.048, 0.010))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/leaves1.obj", triangles, new Material(new Vec3(0.108, 0.576, 0.060))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/leaves2.obj", triangles, new Material(new Vec3(0.108, 0.576, 0.060))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/leaves3.obj", triangles, new Material(new Vec3(0.995, 0.170, 0))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/cloud1.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/cloud2.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/cloud3.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/cloud4.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/cloud5.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/cloud6.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/cloud5.obj", triangles, new Material(new Vec3(1, 1, 1))));

    let scene = new Scene();
    scene.name = "Planet";
    scene.spheres = spheres;
    scene.meshes = meshes;
    scene.triangles = triangles;
    scene.skybox.colourHorizon = new Vec3(0, 0, 0);
    scene.skybox.colourZenith = new Vec3(0.05, 0.1, 0.2);
    scene.skybox.groundColour = new Vec3(0, 0, 0);
    SceneManager.scenes.push(scene);
}

async function createSceneCornellBox() {
    spheres = [];
    meshes = [];
    triangles = [];

    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_light_centred.obj", triangles, new Material(new Vec3(0, 0, 0), new Vec3(1, 1, 1), 25)));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_top_bottom.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_left.obj", triangles, new Material(new Vec3(1, 0, 0))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_right.obj", triangles, new Material(new Vec3(0, 1, 0))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_back.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_cube_small.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_cube_tall.obj", triangles, new Material(new Vec3(1, 1, 1))));

    let scene = new Scene();
    scene.name = "Cornell-Box";
    scene.spheres = spheres;
    scene.meshes = meshes;
    scene.triangles = triangles;
    SceneManager.scenes.push(scene);
}

function createSceneSpheres()
{
    spheres = [];
    meshes = [];
    triangles = [];

    spheres.push(new Sphere(new Vec3(0, 0, 1), 0.3, new Material(new Vec3(1, 0, 0), new Vec3(1, 1, 1), 0, 0.5, 0.2, new Vec3(1, 0, 0))));       // Red sphere
    spheres.push(new Sphere(new Vec3(0, 0.2, 0.8), 0.15, new Material(new Vec3(0,0,1), new Vec3(1, 1, 1), 0, 0.5, 0.2, new Vec3(0, 0, 1))));  // Blue sphere
    spheres.push(new Sphere(new Vec3(0, -100.5, 2), 100, new Material(new Vec3(0, 1, 0))));    // Big sphere

    let scene = new Scene();
    scene.name = "Spheres";
    scene.spheres = spheres;
    scene.camera.forward = new Vec3(0, 0, 1);
    scene.camera.fov = 90;
    SceneManager.scenes.push(scene);
}

async function createSceneShinySpheres()
{
    spheres = [];
    meshes = [];
    triangles = [];

    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_light.obj", triangles, new Material(new Vec3(0, 0, 0), new Vec3(1, 1, 1), 25)));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_top_bottom.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_left.obj", triangles, new Material(new Vec3(1, 0, 0))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_right.obj", triangles, new Material(new Vec3(0, 1, 0))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_back.obj", triangles, new Material(new Vec3(1, 1, 1))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/cornell_box/box_front.obj", triangles, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(-0.5, -0.65, -5.1), 0.3, new Material(new Vec3(1, 1, 1), new Vec3(1, 1, 1), 0, 1, 1)));
    spheres.push(new Sphere(new Vec3(0.5, -0.55, -5.1), 0.4, new Material(new Vec3(1, 1, 1), new Vec3(1, 1, 1), 0, 1, 1)));

    let scene = new Scene(); 
    scene.name = "Reflections";
    scene.spheres = spheres;
    scene.meshes = meshes;
    scene.triangles = triangles;
    scene.camera.position = new Vec3(0, 0, -3.6); 
    scene.camera.fov = 90;
    SceneManager.scenes.push(scene);
}

async function createSceneDoF()
{
    spheres = [];
    meshes = [];
    triangles = [];

    meshes.push(await OBJLoader.meshFromOBJ("resources/depth_of_field_objects/plane.obj", triangles, new Material(new Vec3(0.7, 0.1, 0.7))));
    meshes.push(await OBJLoader.meshFromOBJ("resources/depth_of_field_objects/suzanne.obj", triangles, new Material(new Vec3(0, 0.7, 0.7))));
    
    
    spheres.push(new Sphere(new Vec3(5.9, -1.15, -22), 0.55, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(4.7, -1.15, -20), 0.55, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(3.6, -1.15, -18), 0.55, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(2.5, -1.15, -16), 0.55, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(1.5, -1.15, -14), 0.55, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(-0.2, -1.15, -10), 0.55, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(-0.8, -1.15, -8), 0.55, new Material(new Vec3(1, 1, 1))));
    spheres.push(new Sphere(new Vec3(-1.3, -1.15, -6), 0.55, new Material(new Vec3(1, 1, 1))));

    let scene = new Scene(); 
    scene.name = "Depth-of-Field";
    scene.spheres = spheres;
    scene.meshes = meshes;
    scene.triangles = triangles;
    scene.camera.position = new Vec3(0.4, -0.4, 0);
    scene.camera.fov = 30;
    scene.camera.focusDistance = 12;
    scene.camera.defocusStrength = 100;
    scene.skybox.groundColour = new Vec3(1, 1, 1);
    SceneManager.scenes.push(scene);
}

async function loadScene(index) {

    // Create (empty) texture for raytracer output

    gl.deleteTexture(textureA);
    textureA = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureA);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, imageWidth, imageHeight);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureA, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.deleteTexture(textureB);
    textureB = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureB);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, imageWidth, imageHeight);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureB, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    currentFrame = 0;

    SceneManager.loadScene(index);

    await initObjects();
}

function render() { 

    rayTrace();    
    draw();

    currentFrame++;
    requestAnimationFrame(render);   
}

async function main() {
    await createScenePlanet();
    createSceneSpheres();
    await createSceneCornellBox();
    await createSceneShinySpheres();
    await createSceneDoF();

    loadScene(1);
    render();
}

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");

let raytraceProgram;
let drawProgram;

let imageWidth = canvas.width;
let imageHeight = canvas.height;
let aspectRatio = imageHeight / imageWidth;

let spheres = [];
let triangles = [];
let meshes = [];

// Create (empty) texture for raytracer output
let textureA = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textureA);
gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, imageWidth, imageHeight);
gl.bindTexture(gl.TEXTURE_2D, null);

let fboA = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureA, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

let textureB = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textureB);
gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, imageWidth, imageHeight);
gl.bindTexture(gl.TEXTURE_2D, null);

let fboB = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureB, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

let spheresInfo = [];
let sphereMaterials = [];
let spheresInfoTex;
let sphereMatsTex;

let triangleInfo = [];
let trianglesInfoTex;

let meshInfo = [];
let meshMaterials = [];
let meshInfoTex;
let meshMatsTex;

let currentFrame = 0;

let dropdown = document.getElementById("sceneSelect");
dropdown.addEventListener("change", async (event) => {
    await loadScene(event.target.value);
});

let saveButton = document.getElementById("saveImage");
saveButton.addEventListener("click", (event) => {
    rayTrace();
    draw();
    currentFrame++;

    let canvasUrl = canvas.toDataURL();
    const element = document.createElement('a');
    element.href = canvasUrl;

    element.download = `raytracer-${SceneManager.currentScene.name}`;

    element.click();
    element.remove();
});

initWebGL();
main();