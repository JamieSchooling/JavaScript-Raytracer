import Vec3 from "./vec3.js";
import Material from "./material.js";

// Ray which has an origin and direction, both are Vec3s
export class Ray {
    constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction;
        this.invDir = direction.inverse();
    }

    // Calculate and return the point in space (a Vec3) for this ray for the given value of t
    pointAt(t) {
        return this.origin.add(this.direction.scale(t));
    }
}

// The result of casting a ray into our scene
// Position is the point where the ray intersects a sphere in the scene
// Normal is the normal unit vector of the sphere at the intersection point
// t is the t value along the ray where the intersection point is.  This value should, be -1 when the ray hits nothing
// SphereIndex is the array index of the sphere hit by the ray
export class RayCastResult {
    constructor(position, normal, t, material = new Material(new Vec3(1, 1, 1))) {
        this.position = position;
        this.normal = normal;
        this.t = t;
        this.material = material;
    }

    // Return a RayCastResult when a ray misses everything in the scene
    static miss() {
        return new RayCastResult(new Vec3(0,0,0), new Vec3(0,0,0), -1, -1);
    }
}