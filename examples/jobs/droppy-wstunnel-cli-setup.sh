#!/bin/sh
curdir=$(cd $(dirname $0) && pwd)

$curdir/gitrepo-mirror.sh \
	https://github.com/t-k-cloud/wsproxy ~/wsproxy

cd ~/wsproxy
echo "start new instances ..."

for i in `seq 1 4`; do
	echo "instance $i ..."
	node ./wsproxy-cli.js >wsproxy-cli-${i}.log <&- 2>&1 &
	pid=$!
	echo $pid > wsproxy-cli-${i}.pid
done
