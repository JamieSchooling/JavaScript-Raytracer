export default class SceneManager {
    static currentScene = undefined;
    static scenes = [];

    static loadScene(index) {
        this.currentScene = this.scenes[index];
    }
}