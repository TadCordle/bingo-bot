# Bingo Bot

LittleBigPlanet speedrunning race bot for Discord.

## Setup

Install Node.js (version 6.x or higher).

Get build tools.
* Windows: Install "VC++ 2015.3 v14.00 (v140) toolset for desktop" through VS Installer
* Linux: `sudo apt-get install build-essential`

Get dependencies.

```
npm i
```

Create discord_auth.json in same directory as bob.js with your auth token.

```json
{
    "token": "discord auth token goes here"
}
```

Run bot.

```
npm start
```

## Features

**Pre-race commands**
* `!race` - Starts a new full-game race, or joins the current open race if someone already started one.
* `!game <game name>` - Sets the game (e.g. `!game LBP2`).
* `!category <category name>` - Sets the category (e.g. `!category styrofoam%`).
* `!team <discord id> [<discord id> ... <team name>]` - Creates a team of you + the specified users for co-op races (with an optional team name).
* `!randomteams [<team size>]` - Randomly assigns entrants to teams of the given size. Default size is 2.
* `!leave` - Leave the race.
* `!ready` - Indicate that you're ready to start.
* `!unready` - Indicate that you're not actually ready.

**Mid-race commands**
* `!d` / `!done` - Indicate that you finished.
* `!ud` / `!undone` - Get back in the race if you finished by accident.
* `!f` / `!forfeit` - Drop out of the race.
* `!uf` / `!unforfeit` - Rejoin the race if you forfeited by accident.

**IL race commands**
* `!ilrace` - Starts a new series of IL races.
* `!level <level name>` - Sets the next level to race. Also accepts lbp.me links.
* `!luckydip` - Sets the next level to race to a random lucky dip level.
* `!ilresults` - Shows the ILs that have been played so far in a series, and the winner of each one.

**Stat commands**
* `!status` - Shows current race status/entrants.
* `!results <race num>` - Shows results of the specified race number (e.g. `!results 2`).
* `!me <game name>` - Shows your race statistics for the specified game (e.g. `!me LBP`).
* `!runner <id or username> <game name>` - Shows someone else's race statistics (e.g. `!runner RbdJellyfish LBP`).
* `!elo <game name>/<category name>` - Shows the ELO leaderboard for the given game/category (e.g. `!elo lbp/die%`).
* `!help` - Shows the bot commands.

**Other commands**
* `!roles <speedrun.com name>` - Updates your roles to match races finished + speedrun.com PBs (if you linked your discord account on speedrun.com).
* `!removeroles` - Removes your runner roles.
* `!nr` / `!newrunner` - Mixes two halves of the names of random LBP runners (that have a full-game run on sr.c) together.

**Admin/moderator only (mid-race)**
* `!modhelp` - Shows mod-only commands.
* `!clearrace` - Resets the bot; forces ending the race without recording any results.
* `!clearteams` - Disbands all current teams.
* `!roles <speedrun.com name> <discord id>` - Updates someone else's roles.
* `!removeroles <discord id>` - Remove someone else's roles.
* `!reloadroles` - Refreshes all registered roles.
