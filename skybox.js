import Vec3 from "./vec3.js";

export default class Skybox {
    constructor() {
        this.skyColourHorizon = new Vec3(1, 1, 1);
        this.skyColourZenith = new Vec3(0.3, 0.5, 0.9);
        this.groundColour = new Vec3(0.2, 0.2, 0.2);
    }
}