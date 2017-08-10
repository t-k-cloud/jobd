#!/bin/bash
pacman --noconfirm -S nodejs yarn npm lsof
ln -sf `pwd`/examples/jobs /home/tk/
pushd src
yarn install
popd
