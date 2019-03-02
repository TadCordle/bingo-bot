# Bingo Bot

LBP Speedrunning race bot for Discord.

# Setup

Install nodejs (version 6.x or higher).

Get build tools.
* Windows: Install "VC++ 2015.3 v14.00 (v140) toolset for desktop" through VS Installer
* Linux: `sudo apt-get install build-essential`

Get dependencies.

* `npm init -y`
* `npm i discord.js node-gyp better-sqlite3`

Create config.json in same directory as bob.js with your auth token.

```
{
    "token": "discord auth token goes here"
}
```

Run bot

```
node bob.js
```