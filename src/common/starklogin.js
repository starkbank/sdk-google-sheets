StarkLogin = {
    isAuthorized: function() {
        // Check if there is a private key
        
        // Check if private key is working
        try {
            Balance.get()
            return true;
        } catch(e) {
            return false;
        }
    },
    renderLoginCard: function() {
        // Build login card
        return;
    },
    requestChallenge: function(email, pass, workspace) {
        // Generate challenge
        // Build card with QRCode
        return;
    },
    isChallengeApproved: function() {
        // Check challenge status
        return;
    },
    saveCredentials: function(private, public, workspace) {
        // Save on user properties
        StarkLogin.refreshAddOn();
        return;
    },
    refreshAddOn: function() {
        // Refresh add-on after successfull login
    }
}