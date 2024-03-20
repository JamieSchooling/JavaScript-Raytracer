import Vec3 from "./vec3.js";
import MoreMaths from "./more_maths.js";
import { Sphere } from "./shapes.js";
import OBJLoader from "./obj_loader.js";
import Material from "./material.js";
import { Ray, RayCastResult } from "./ray.js";


// Check whether a ray hits anything in the scene and return a RayCast Result
function traceRay(ray) {
    let closestHit = RayCastResult.miss();
    let t = Infinity;

    for (let i = 0; i < spheres.length; i++) {
        let raycastResult = spheres[i].rayIntersects(ray);
        if (raycastResult.t > 0 && raycastResult.t < t) {
            t = raycastResult.t;
            closestHit = raycastResult;
        }
    }

    for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
        if (!meshes[meshIndex].boundingSphere.rayIntersects(ray)) {
            continue;
        }

        for (let i = 0; i < meshes[meshIndex].numTriangles; i++) {
            let triIndex = meshes[meshIndex].firstTriangleIndex + i;
            let raycastResult = triangles[triIndex].rayIntersects(ray);
            if (raycastResult.t > 0 && raycastResult.t < t) {
                t = raycastResult.t;
                closestHit = raycastResult;
                closestHit.material = meshes[meshIndex].material;
            }   
        }   
    }

    return closestHit;
}

function getEnvironmentLight(ray) {
    const skyColourHorizon = new Vec3(0.1, 0.1, 0.3);
    const skyColourZenith = new Vec3(0.05, 0.1, 0.2);
    const groundColour = new Vec3(0, 0, 0);

    let skyGradientT = Math.pow(MoreMaths.smoothstep(0, 0.4, ray.direction.y), 0.35);
    let skyGradient = skyColourHorizon.scale(1-skyGradientT).add(skyColourZenith.scale(skyGradientT));
    let sun = Math.pow(Math.max(0, ray.direction.dot(negLightDirection)), sunFocus) * lightIntensity;

    let groundToSkyT = MoreMaths.smoothstep(-0.15, 0, ray.direction.y);
    let sunMask = groundToSkyT >= 1 ? 1 : 0;
    let lerped = groundColour.scale(1-groundToSkyT).add(skyGradient.scale(groundToSkyT));
    return lerped.add(new Vec3(sun, sun, sun).scale(sunMask));
}

// Returns the colour the ray should have as a Vec3 with RGB values in [0,1]
const maxBounceCount = 3;
function rayColour(ray) {
    let incomingLight = new Vec3(0, 0, 0);
    let rayColour = new Vec3(1, 1, 1);

    for (let i = 0; i < maxBounceCount; i++) {
        let castResult = traceRay(ray);
        let material = castResult.material;

        if (castResult.t >= 0) {
            let isSpecularBounce = material.specularProbability >= Math.random() ? 1 : 0;

            ray.origin = castResult.position;
            let diffuseDirection = castResult.normal.add(MoreMaths.randomDirection()).normalised();
            let specularDirection = ray.direction.minus(castResult.normal.scale(2).scale(castResult.normal.dot(ray.direction))).normalised();
            ray.direction = Vec3.lerp(diffuseDirection, specularDirection, material.smoothness * isSpecularBounce).normalised();
            
            let emittedLight = material.emissionColour.scale(material.emissionStrength);
            incomingLight = incomingLight.add(emittedLight.multiply(rayColour));
            rayColour = rayColour.multiply(Vec3.lerp(material.colour, material.specularColour, isSpecularBounce));
        } else {
            incomingLight = incomingLight.add(getEnvironmentLight(ray).multiply(rayColour));
            break;
        }
    }

    return incomingLight;
}

// Sets a pixel at (x, y) in the canvas with an RGB Vec3
function setPixel(x, y, colour) {
    var c = document.getElementById("canvas");
    var ctx = c.getContext("2d");
    ctx.fillStyle = "rgba("+colour.x+","+colour.y+","+colour.z+","+1+")";
    ctx.fillRect(x, c.height - y, 1, 1);
}

const spheres = [
    // new Sphere(new Vec3(-0.5,-0.2,-1), 0.2, new Material(new Vec3(0,0,0), new Vec3(0, 1, 0), 2)),       // Light sphere
    // new Sphere(new Vec3(0.2,-0.2,-2), 0.3, new Material(new Vec3(1,0,0), 1, 0.02)),       // Red sphere
    // new Sphere(new Vec3(0.25,-0.35,-1.25), 0.15, new Material(new Vec3(1,1,1), 0, 0, new Vec3(1, 1, 1), new Vec3(1, 1, 1), 10)),  // Blue sphere 
    // new Sphere(new Vec3(-0.3,-0.35,-1.8), 0.1, new Material(new Vec3(1,1,0), 0, 0, new Vec3(1, 1, 1), new Vec3(1, 1, 0), 30)),  // Blue sphere 
    // new Sphere(new Vec3(0,-100.5,-1), 100, new Material(new Vec3(.7,.1,.7))),   // Big sphere
    // new Sphere(new Vec3(-0.4,-0.2,-3), 0.3, new Material(new Vec3(0,1,0), 1, 0.02)),
    // new Sphere(new Vec3(-1, 0.2,-5.1), 0.6, new Material(new Vec3(0,1,1), 1, 0.02)),
];

const triangles = [];

const meshes = [];

let lightDirection  = new Vec3(-0.2, -0.2, 1).normalised();
// let lightDirection  = new Vec3(-2.5, -0.6, -1).normalised();
let negLightDirection = new Vec3(-lightDirection.x, -lightDirection.y, -lightDirection.z);
let lightIntensity = 5;
let sunFocus = 500;


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
const offscreenCtx = offscreenCanvas.getContext("2d", {
    willReadFrequently: true,
});

let imageWidth = canvas.width;
let imageHeight = canvas.height;
let aspectRatio = imageHeight / imageWidth;

let viewportWidth = 2;
let viewportHeight = viewportWidth * aspectRatio;
let focalLength = 2;

let camPosition = new Vec3(0, 0, 0);
let camForward = new Vec3(0, 0, -1);
let camUp = new Vec3(0, 1, 0);
let camRight = new Vec3(1, 0, 0);
let horizontal = new Vec3(viewportWidth, 0, 0);
let vertical = new Vec3(0, viewportHeight, 0);
let lowerLeftCorner = camPosition.minus(horizontal.scale(0.5)).minus(vertical.scale(0.5)).minus(new Vec3(0, 0, focalLength));

let colour = new Vec3(0,0,0);

let numRaysPerPixel = 5;

let divergeStrength = 1;
let defocusStrength = 1;
let focusDistance = 1;

let lastFrameImageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
let numFramesRendered = 0;

async function main() {
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/light_left.obj", triangles, new Material(new Vec3(0, 0, 0), 0, 0, new Vec3(0, 0, 0), new Vec3(1, 1, 1), 6.5)));
    meshes.push(await OBJLoader.meshFromOBJ("resources/scene_objects/light_right.obj", triangles, new Material(new Vec3(0, 0, 0), 0, 0, new Vec3(0, 0, 0), new Vec3(1, 1, 1), 6.5)));
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

    
    for (let i = 0; i < imageWidth; i++)
    {
        for (let j = 0; j <= imageHeight; j++)
        {
            let u = i / (imageWidth-1);
            let v = j / (imageHeight-1);
            let ray = new Ray(camPosition, lowerLeftCorner.add(horizontal.scale(u)).add(vertical.scale(v)).minus(camPosition).normalised());
            for (let n = 0; n < (traceRay(ray).t < 0 ? 1 : numRaysPerPixel); n++) {
                
                let defocusJitter = MoreMaths.randomPointInCircle().scale(defocusStrength / imageWidth);
                ray.origin = camPosition.add(camRight.scale(defocusJitter.x)).add(camUp.scale(defocusJitter.y)); 

                //let focusPoint = ray.pointAt(focusDistance);
                let focusPoint = lowerLeftCorner.add(horizontal.scale(u)).add(vertical.scale(v)).add(new Vec3(0, 0, -focusDistance));
                ray.direction = focusPoint.minus(ray.origin).normalised();
                colour = colour.add(rayColour(ray).scale(255));
            }
            colour = colour.scale(1/numRaysPerPixel);
            setPixel(i,j,colour);
        }
    }

    let weight = 1 / (numFramesRendered + 1);

    offscreenCtx.drawImage(canvas, 0, 0, imageWidth, imageHeight, 0, 0, imageWidth, imageHeight);

    let imageData = offscreenCtx.getImageData(0, 0, imageWidth, imageHeight);
    for (let pixelIndex = 0; pixelIndex < imageData.data.length; pixelIndex += 4) {
        let r = lastFrameImageData.data[pixelIndex] * (1 - weight) + imageData.data[pixelIndex] * weight;
        let g = lastFrameImageData.data[pixelIndex+1] * (1 - weight) + imageData.data[pixelIndex+1] * weight;
        let b = lastFrameImageData.data[pixelIndex+2] * (1 - weight) + imageData.data[pixelIndex+2] * weight;
        imageData.data[pixelIndex] = r;
        imageData.data[pixelIndex+1] = g;
        imageData.data[pixelIndex+2] = b;
    }
    offscreenCtx.putImageData(imageData, 0, 0);
    lastFrameImageData = offscreenCtx.getImageData(0, 0, imageWidth, imageHeight);
    ctx.drawImage(offscreenCanvas, 0, 0, imageWidth, imageHeight, 0, 0, imageWidth, imageHeight);

    numFramesRendered++;
    requestAnimationFrame(main);
}

main();