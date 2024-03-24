import Vec3 from "./vec3.js";
import { RayCastResult } from "./ray.js";
import Material from "./material.js";

// A sphere in 3D space. Has centre, radius and colour all of which are Vec3s
export class Sphere {
    constructor(centre, radius, material = new Material(new Vec3(1, 1, 1))) {
        this.centre = centre;
        this.radius = radius;
        this.material = material;
    }

    // Calculate the point on the sphere  where the ray intersects using 
    // a quadratic equation and return the t value of the ray for that point
    // If two solutions exist return the minus solution
    // If no solutions exist return -1
    rayIntersects(ray) {
        let rayOrigin = ray.origin.minus(this.centre);
        let a = ray.direction.dot(ray.direction);
        let b = 2 * rayOrigin.dot(ray.direction);
        let c = rayOrigin.dot(rayOrigin) - this.radius * this.radius;
        let discriminant = b * b - 4 * a * c;

        if (discriminant >= 0) {
            let t = (-b - Math.sqrt(discriminant)) / (2 * a);
            let intersectionPoint = ray.pointAt(t);
            let intersectionNormal = intersectionPoint.minus(this.centre).normalised();
            return new RayCastResult(intersectionPoint, intersectionNormal, t, this.material);
        } else {
            return RayCastResult.miss();
        }
    }
}

export class Triangle {
    constructor(posA, posB, posC, normalA, normalB, normalC) {
        this.posA = posA;
        this.posB = posB;
        this.posC = posC;
        this.normalA = normalA;
        this.normalB = normalB;
        this.normalC = normalC;
    }

    rayIntersects(ray) {
        const epsilon = 0.0000001;

        let edge1 = this.posB.minus(this.posA);
        let edge2 = this.posC.minus(this.posA);
        let rayCrossEdge2 = ray.direction.cross(edge2);
        let determinant = edge1.dot(rayCrossEdge2);

        if (determinant > -epsilon && determinant < epsilon) {
            return RayCastResult.miss();
        }

        let invDet = 1 / determinant;
        let s = ray.origin.minus(this.posA);
        let u = invDet * s.dot(rayCrossEdge2);

        if (u < 0 || u > 1) {
            return RayCastResult.miss();
        }

        let sCrossEdge1 = s.cross(edge1);
        let v = invDet * ray.direction.dot(sCrossEdge1);
        let w = 1 - u - v; 

        if (v < 0 || u + v > 1) {
            return RayCastResult.miss();
        }

        let t = invDet * edge2.dot(sCrossEdge1);

        if (t > epsilon) {
            let normal = this.normalB.scale(u).add(this.normalC.scale(v)).add(this.normalA.scale(w)).normalised();
            return new RayCastResult(ray.pointAt(t), normal, t);
        } else {
            return RayCastResult.miss();
        }      
    }
}

export class Mesh {
    constructor(firstTriangleIndex, numTriangles, material) {
        this.firstTriangleIndex = firstTriangleIndex;
        this.numTriangles = numTriangles;
        this.min = new Vec3(0, 0, 0);
        this.max = new Vec3(0, 0, 0);
        this.material = material;
    }

    calculateMeshBounds(verts) {
        let boundsMin = new Vec3(Infinity, Infinity, Infinity);
        let boundsMax = new Vec3(-Infinity, -Infinity, -Infinity);
        
        for (let i = 0; i < verts.length; i++) {
            if (verts[i].x >= boundsMax.x) {
                boundsMax.x = verts[i].x;
            }
            if (verts[i].y >= boundsMax.y) {
                boundsMax.y = verts[i].y;
            }
            if (verts[i].z >= boundsMax.z) {
                boundsMax.z = verts[i].z;
            }
            
            if (verts[i].x < boundsMin.x) {
                boundsMin.x = verts[i].x;
            }
            if (verts[i].y < boundsMin.y) {
                boundsMin.y = verts[i].y;
            }
            if (verts[i].z < boundsMin.z) {
                boundsMin.z = verts[i].z;
            }
        }
    
        this.min = boundsMin;
        this.max = boundsMax;
    }
}