/**
 * Callback for rendering the homepage card.
 * @return {CardService.Card} The card to show to the user.
 */
function onHomepage(e) {
    console.log(e);
    var now = new Date();
    var caption = "This is a caption";
    var imageUrl = Utilities.formatString(
        'https://cataas.com/cat/says/%s?time=%s',
        encodeURIComponent(caption), 
        now.getTime()
    );
    var image = CardService.newImage()
        .setImageUrl(imageUrl)
        .setAltText('Meow')

    var action = CardService.newAction()
        .setFunctionName('onChangeCat')
        .setParameters({
            text: text, 
            isHomepage: "true"
        });

    var button = CardService.newTextButton()
        .setText('Change cat')
        .setOnClickAction(action)
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

    var buttonSet = CardService.newButtonSet()
        .addButton(button);

    var footer = CardService.newFixedFooter()
        .setPrimaryButton(
            CardService.newTextButton()
            .setText('Powered by cataas.com')
            .setOpenLink(
                CardService.newOpenLink()
                .setUrl('https://cataas.com')
            )
        );

    var section = CardService.newCardSection()
        .addWidget(image)
        .addWidget(buttonSet);
        
    var card = CardService.newCardBuilder()
        .addSection(section)
        .setFixedFooter(footer);

    return card.build();
}

/**
 * Callback for the "Change cat" button.
 * @param {Object} e The event object, documented {@link
 *     https://developers.google.com/gmail/add-ons/concepts/actions#action_event_objects
 *     here}.
 * @return {CardService.ActionResponse} The action response to apply.
 */
function onChangeCat(e) {
    console.log(e);
    // Get the text that was shown in the current cat image. This was passed as a
    // parameter on the Action set for the button.
    var text = e.parameters.text;

    // The isHomepage parameter is passed as a string, so convert to a Boolean.
    var isHomepage = e.parameters.isHomepage === 'true';

    // Create a new card with the same text.
    var card = createCatCard(text, isHomepage);

    // Create an action response that instructs the add-on to replace
    // the current card with the new one.
    var navigation = CardService.newNavigation()
        .updateCard(card);
    var actionResponse = CardService.newActionResponseBuilder()
        .setNavigation(navigation);
    return actionResponse.build();
}

