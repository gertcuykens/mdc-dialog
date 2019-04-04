#!/bin/bash
# npm i http-server -g
# npm i typescript -g
# npm i sass -g

npm i
tsc
sass -I node_modules mdc-dialog.scss dist/mdc-dialog.css
cp -r node_modules/* dist/
