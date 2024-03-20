// Simple vector in 3D with numbers for x, y and z
export default class Vec3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // Add other vector to this one and return the result
    add(other) {
        return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    // Subtract other vector from this one and return the result
    minus(other) {
        return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    // Multiply other vector by this one and return the result
    multiply(other) {
        return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
    }

    // Scale this vector by the number scalar and return the result
    scale(scalar) {
        return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
    }
    
    // Calculate the dot product of this vector with the other and return the result
    dot(other) {
        return (this.x * other.x) + (this.y * other.y) + (this.z * other.z);
    }

    cross(other) {
        return new Vec3(this.y * other.z - this.z * other.y, this.z * other.x - this.x * other.z, this.x * other.y - this.y * other.x);
    }

    // Calculate and return the magnitude of this vector
    magnitude() {
        return Math.sqrt(this.magnitudeSquared());
    }
    
    // Calculate and return the magnitude of this vector without the square root
    magnitudeSquared() {
        return (this.x * this.x) + (this.y * this.y) + (this.z * this.z);
    }

    // Return a normalised version of this vector
    normalised() {
        return this.scale(1 / this.magnitude());
    }

    inverse() {
        return new Vec3(1 / this.x, 1 / this.y, 1 / this.z)
    }

    min(other) {
        return new Vec3(Math.min(this.x, other.x), Math.min(this.y, other.y), Math.min(this.z, other.z));
    }

    max(other) {
        return new Vec3(Math.max(this.x, other.x), Math.max(this.y, other.y), Math.max(this.z, other.z));
    }

    static lerp(a, b, t) {
        return a.scale(1-t).add(b.scale(t));
    }
}