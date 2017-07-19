#!/bin/sh
curdir=$(cd $(dirname $0) && pwd)

if [ ! -e ~/wsproxy ]; then
	git clone https://github.com/t-k-cloud/wsproxy ~/wsproxy;
fi;

cd ~/wsproxy
git fetch origin master
git reset --hard origin/master

# start new instances
for i in `seq 1 2`; do
	node ./wsproxy-cli.js >wsproxy-cli-${i}.log <&- 2>&1 &
	pid=$!
	echo $pid > wsproxy-cli-${i}.pid
done
