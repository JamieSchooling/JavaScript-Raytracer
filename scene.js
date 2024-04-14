import Camera from "./camera.js";
import DirectionalLight from "./directional_light.js";
import Skybox from "./skybox.js";

export default class Scene {
    constructor() {
        this.name = "";
        this.camera = new Camera();
        this.sun = new DirectionalLight();
        this.skybox = new Skybox();
        this.spheres = [];
        this.meshes = [];
        this.triangles = [];
    }
}