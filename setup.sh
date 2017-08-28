#!/bin/bash
# install node modules for src
pushd src
yarn install
popd

# install node modules for tests
pushd tests
yarn install
popd

echo 'Test it:'
echo 'cd tests; sudo node ./test-jobd-handler.js `whoami`'
