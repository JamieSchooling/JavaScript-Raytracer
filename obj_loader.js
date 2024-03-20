import Vec3 from "./vec3.js";
import { Triangle, Mesh } from "./shapes.js";

export default class OBJLoader {
    static async meshFromOBJ(objPath, trianglesArray, material) {
        const objFile = await fetch(objPath); 
        const text = await objFile.text();
    
        let lines = text.split("\n");
    
        let verts = []
        let normals = []
        let tris = []
    
        for (let line of lines) {
            let chunks = line.split(" ");
            if (chunks[0] === "v") {
                verts.push(new Vec3(parseFloat(chunks[1]), parseFloat(chunks[2]), parseFloat(chunks[3])))
            }
            if (chunks[0] === "vn") {
                normals.push(new Vec3(parseFloat(chunks[1]), parseFloat(chunks[2]), parseFloat(chunks[3])))
            }
            if (chunks[0] === "f") {
                let vert1Index = chunks[1].split("//")[0] - 1;
                let vert2Index = chunks[2].split("//")[0] - 1;
                let vert3Index = chunks[3].split("//")[0] - 1;
                let normal1Index = chunks[1].split("//")[1] - 1;
                let normal2Index = chunks[2].split("//")[1] - 1;
                let normal3Index = chunks[3].split("//")[1] - 1;
                tris.push(
                    new Triangle(
                        verts[vert1Index], verts[vert2Index], verts[vert3Index], 
                        normals[normal1Index], normals[normal2Index], normals[normal3Index]
                    )
                );
            }
        }
    
        let mesh = new Mesh(trianglesArray.length, tris.length, material);
        mesh.calculateMeshBounds(verts);
        trianglesArray.push(...tris);
        return mesh;
    }
}