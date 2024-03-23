import Vec3 from "./vec3.js";

export default class Material {
    constructor(colour, emissionColour = new Vec3(0, 0, 0), emissionStrength = 0, smoothness = 0, specularProbability = 0, specularColour = new Vec3(1, 1, 1)) {
        this.colour = colour;
        this.emissionColour = emissionColour;
        this.emissionStrength = emissionStrength;
        this.smoothness = smoothness;
        this.specularProbability = specularProbability;
        this.specularColour = specularColour;
    }
}