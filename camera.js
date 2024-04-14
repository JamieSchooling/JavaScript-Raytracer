import Vec3 from "./vec3.js";

export default class Camera {
    constructor(){
        this.camPosition = new Vec3(0, 0, 0);
        this.camUp = new Vec3(0, 1, 0);
        this.camRight = new Vec3(1, 0, 0);
        this.camForward = new Vec3(0, 0, -1);
        this.fov = 40;
        this.divergeStrength = 1;
        this.defocusStrength = 1;
        this.focusDistance = 1;
    }
}