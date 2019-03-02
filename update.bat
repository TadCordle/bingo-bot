@echo off

REM Small script I use to upload bot to a raspberry pi
scp -r bob.js categories.js config.json emotes.json ubuntu@192.168.1.163:~/bingo-bot/
ssh ubuntu@192.168.1.163