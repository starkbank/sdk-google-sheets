const Balance = {
    get: function() {
        let [json, status] = parseResponse(
            fetch("/balance", method = 'GET', null)
        );

        if (status != 200) {
            throw new Error(JSON.parse(json)["errors"]["message"]);
        }

        let balance = parseInt(json["balances"][0]["amount"]) / 100.0;
        return balance;
    }
}