import Vec3 from "./vec3.js";

export default class DirectionalLight {
    constructor(direction = new Vec3(0.6, 0.5, -1)) { 
        this.direction = direction.normalised();
        this.intensity = 40;
        this.focus = 200;
    }
}