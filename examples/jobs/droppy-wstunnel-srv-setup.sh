#!/bin/sh
curdir=$(cd $(dirname $0) && pwd)
source $curdir/env.cfg

alias ssh="$SSHPASS ssh"

ssh $SSHTO 'bash -s' -- < $curdir/gitrepo-mirror.sh \
	https://github.com/t-k-cloud/wsproxy '~/wsproxy'

ssh $SSHTO 'bash -s' << EOF
	cd ~/wsproxy;
	nodejs ./wsproxy-srv.js > ./wsproxy-srv.log <&- 2>&1 &
EOF
