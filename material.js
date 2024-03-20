import Vec3 from "./vec3.js";

export default class Material {
    constructor(colour, smoothness = 0, specularProbability = 0, specularColour = new Vec3(1, 1, 1), emissionColour = new Vec3(0, 0, 0), emissionStrength = 0) {
        this.colour = colour;
        this.smoothness = smoothness;
        this.specularProbability = specularProbability;
        this.specularColour = specularColour;
        this.emissionColour = emissionColour;
        this.emissionStrength = emissionStrength;
    }
}