#!/bin/sh
curdir=$(cd $(dirname $0) && pwd)

ssh 'ubuntu@211.159.189.25' 'bash -s' << EOF
if [ ! -e ~/wsproxy ]; then
	git clone https://github.com/t-k-cloud/wsproxy ~/wsproxy;
fi;

cd ~/wsproxy
git fetch origin master
git reset --hard origin/master
nodejs ./wsproxy-srv.js >wsproxy-srv.log <&- 2>&1 &
EOF
