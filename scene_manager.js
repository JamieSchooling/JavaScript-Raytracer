export default class SceneManager {
    static currentScene = undefined;
    static scenes = [];

    static loadScene(gl, index) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.currentScene = this.scenes[index];
    }
}