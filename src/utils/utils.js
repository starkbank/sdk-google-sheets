class Utils {
    static getEnv () {
        return "sandbox";
    }
    static logJson (json) {
        const jsonString = JSON.stringify(json,null,"\t")
        Browser.msgBox(jsonString)
    }
}