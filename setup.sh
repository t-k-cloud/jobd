#!/bin/bash
pacman --noconfirm -S nodejs yarn npm
ln -sf `pwd`/examples/jobs /home/tk/jobs
pushd src
yarn install
popd
