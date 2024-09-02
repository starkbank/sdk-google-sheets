/**
 * Calculates the sale price of a value at a given discount.
 *
 * @param {number} input The value to discount.
 * @param {number} discount The discount to apply, such as .5 or 50%.
 * @return The sale price formatted as USD.
 * @customfunction
 */
function STK_SALEPRICE(input, discount) {
    let price = input - (input * discount);
    let currency = Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

    return currency.format(price);
}