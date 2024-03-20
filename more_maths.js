import Vec3 from "./vec3.js";

export default class MoreMaths {
    static clamp(x, lowerLimit = 0, upperLimit = 1) {
        if (x < lowerLimit) return lowerLimit;
        if (x > upperLimit) return upperLimit;
        return x;
    }

    static smoothstep(edge0, edge1, x) {
        x = this.clamp((x - edge0) / (edge1 - edge0));
    
        return x * x * (3 - 2 * x);
    }
    
    static randomValueNormalDistribution() {
        let theta = 2 * Math.PI * Math.random();
        let rho = Math.sqrt(-2 * Math.log(1 - Math.random()));
        return rho * Math.cos(theta);
    }

    static randomDirection() {
        let x = this.randomValueNormalDistribution();
        let y = this.randomValueNormalDistribution();
        let z = this.randomValueNormalDistribution();
        return new Vec3(x, y, z).normalised();
    }

    static randomPointInCircle() {
        let angle = Math.random() * 2 * Math.PI;
        let pointOnCircle = new Vec3(Math.cos(angle), Math.sin(angle), 0);
        return pointOnCircle.scale(Math.sqrt(Math.random()));
    }
}