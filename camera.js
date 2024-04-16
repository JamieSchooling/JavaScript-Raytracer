import Vec3 from "./vec3.js";

export default class Camera {
    constructor(){
        this.position = new Vec3(0, 0, 0);
        this.up = new Vec3(0, 1, 0);
        this.right = new Vec3(1, 0, 0);
        this.forward = new Vec3(0, 0, -1);
        this.fov = 40;
        this.divergeStrength = 1;
        this.defocusStrength = 1;
        this.focusDistance = 1;
    }
}