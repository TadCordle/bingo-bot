#!/bin/sh
ps aux | grep node | awk '{print $2}' | while read line ; do kill $line ; done
npm start > stdout.log 2> stderr.log &
