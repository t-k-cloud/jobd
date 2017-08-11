#!/bin/bash
# must be root permission
touch /root/test || exit

# install commands used through jobs
pacman --noconfirm -S nodejs yarn npm lsof

# create job directory under home
ln -sf `pwd`/examples/jobs /home/tk/

# install node modules for src
pushd src
yarn install
popd

# install node modules for tests
pushd tests
yarn install
popd
