# ryht-charter-campuses
Interactive map showing the expansion of charter campuses over time in Texas

## Local testing

Loading the data for the line chart is liable to fail because of https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSRequestNotHttp .  If the chart doesn't display, then we have at least two options:

* Put code on github.io and test there
* Run a local web server

Setting up a local server should be easy with Python.  Simply open a command line window, go to this folder, type `python -m SimpleHTTPServer 1883` (for Python 2) or `python -m http.server 1883` (for Python 3) or `python3 -m http.server 1883` (to explicitly select Python3 in an environment that also has Python 2 installed), and leave that session running.

Then the page should be available at http://localhost:1883/ (of course you can change the number).
