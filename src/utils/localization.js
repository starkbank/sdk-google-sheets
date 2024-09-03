class Localization {
    constructor(localizationStrings) {
        this.localizationStrings = localizationStrings;
    }

    getLocalized(userLanguage, index) {
        if (Object.keys(this.localizationStrings).indexOf(userLanguage) == -1) {
            userLanguage = Object.keys(this.localizationStrings)[0];
        }
        return this.localizationStrings[userLanguage][index];
    }
}