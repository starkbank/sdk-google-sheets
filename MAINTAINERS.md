To synchronize the Google AppScript with your computer, you use Google Clasp. It dependns on Node, whose version should be newer than 10.0. To install clasp, type the following command on terminal.
```
npm install -g @google/clasp
``` 

If the installation was successful, login to your GSuite account, using ```clasp login```.

Every Google AppScript has an ID, which is saved on ```.clasp.json```. This ID is associated with a Google AppScript, with which the whole code is sychronized. Creating a new Google Sheet will generate another ID and will not sync with the current code, unless the ID is updated on ```.clasp.json```.

The file ```appscript.json``` saves the dependecies for the code. The only current dependency is the [ecdsa-gs](https://github.com/starkbank/ecdsa-google-sheets).

These are some basic useful commands for clasp:

* ```clasp clone <id>``` clones the script from the GSuit to your computer, like ```git clone```.
* ```clasp pull``` fetches all the files from the script on the GSuit, overwriting your local files.
* ```clasp push``` pushed your local files to the GSuit repository, overwriting the latter.