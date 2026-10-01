# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to the following versioning pattern:

Given a version number MAJOR.MINOR.PATCH, increment:

- MAJOR version when the **API** version is incremented. This may include backwards incompatible changes;
- MINOR version when **breaking changes** are introduced OR **new functionalities** are added in a backwards compatible manner;
- PATCH version when backwards compatible bug **fixes** are implemented.


## [Unreleased]
### Changed
- session keys and access id are kept in the user's script properties and the login data in the user's cache (10 minutes), instead of the `Credentials` sheet; the password is no longer stored anywhere
- each person who opens a shared spreadsheet must log in on their own, and everyone has to log in again after updating
- who the user is (workspace, e-mail, environment, name and workspace id) is kept in the user's script properties with the session, so people who share a spreadsheet no longer overwrite each other's identity; the cells of the `Credentials` sheet only show who logged in last and changing them has no effect
- sign out no longer calls `DELETE /auth/access-token/`: the "token" it sent was the account password, and the login only creates a session
- the login form stops polling after an error and ignores answers that arrive after the login is over (approved, denied or expired)
- the script declares the permissions it asks for (spreadsheet in use, dialogs, external requests and Google Drive) instead of leaving Apps Script to infer them, and no longer asks for access to all spreadsheets; everyone has to authorize the script once more after updating
- the unused development screens (`teste()` and `teste.html`) were removed
### Fixed
- generate ECDSA private keys and signature nonces locally
- sign out now revokes the session on the API (it never did: the request was built with an undefined variable and the error was swallowed)
### Security
- the account password, the session keys and the pending login data are no longer written to the `Credentials` sheet, where anyone with access to the spreadsheet or its version history could read them
- secrets that earlier versions left in the `Credentials` sheet are removed on first use, and the session stored there is revoked on the API (best effort)
- the dialogs show messages (API errors, spreadsheet content, file names) as plain text instead of HTML, so data can no longer run script in them; line breaks are still shown, but HTML entities such as `&amp;` are no longer interpreted
- text from the API or from other cells that Sheets could read as a formula (it starts with `=`, or with `+`/`-` and is not a plain number or phone) is written as plain text, so a name such as `=IMPORTXML(...)` can no longer send data of the spreadsheet to someone else; the values of the link formulas are escaped too, and text typed by hand in the cart sheet is kept as text as well (`onEdit`). The protection is the apostrophe prefix of Sheets: a file exported to CSV or Excel carries the raw text, so handle those exports with care
- values that become part of a request path (Pix key, document ids) or of a query string (filters, cursors, the workspace typed in the login) can no longer change the route or add parameters; ids, e-mails, phone numbers with `+`, dates and lists are sent exactly as before
- the link to the cart is only built from a valid workspace, environment and cart id, so editing the cart cell can no longer send the user to another site; a cart id that the spreadsheet holds as a number now works instead of failing
- starting a new login ends the previous session on the API too, so it does not stay valid without an owner
- not changed here: the login key is derived from the password with chained SHA-256 and fixed salts per environment (`src/keyGen.js`), the same way the server does it, so a stronger derivation needs a change of protocol on the server first
- earlier versions sent the account password in the path of the sign out request (`DELETE /auth/access-token/<password>`), so it may be present in API access logs
- spreadsheets that were in use before this version still carry the old secrets in their version history, copies and exports, which cannot be removed by the SDK. Treat them as exposed: change the account password (the old login key is derived from it) and review who has access to those files

## [0.8.2] - 2025-01-17
### Fixed
- dictKey message

## [0.8.1] - 2024-11-26
### Fixed
- boleto descriptions

## [0.8.0] - 2024-11-26
### Added
- displayDescription to paymentRequest

## [0.7.2] - 2024-11-06
### Fixed
- paymentRequest tags

## [0.7.1] - 2024-10-24
### Fixed
- paymentRequest ExternalId

## [0.7.0] - 2024-09-18
### Changed
- Transfer, Boleto Payment and get Dict Key implementation

## [0.6.5] - 2024-06-28
### Added
- idempotent session
### Fixed
- cardShop regex param
- error null alert
- getBalance dynamic request

## [0.6.4] - 2024-06-13
### Added
- new corporate card design
