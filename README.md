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

Create config.json in same directory as bob.js with your auth token.

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
* `!exit` - Leave the race.
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
* `!elo <game name>/<category name>` - Shows the ELO leaderboard for the given game/category (e.g. `!elo lbp/die%`).
* `!help` - Shows the bot commands.

**Fun command**
* `!nr` / `!newrunner` - Mixes two halves of the names of random LBP runners (that have a full-game run on sr.c) together.

**Admin/moderator only**
* `!kick @user` - Kicks someone from the race (in case they're afk or something).
* `!clearrace` - Resets the bot; forces ending the race without recording any results.

**speedrun.com role commands**

*Using the keyword `all` requires admin/mod rights.*
* `!roles autoconnect <sr.c name>` / `all` - Reloads the user's discord data / all auto connected discord accounts entered on sr.c.
* `!roles connect <sr.c name>` - Manually connects an sr.c profile to you.
* `!roles disconnect <sr.c name>` - Disconnects an sr.c profile.
* `!roles reload leaderboard <game name>` / `all` - Reloads the runs on the specified sr.c leaderboards / all leaderboards.
* `!roles reload categories` - Reloads all categories.
* `!roles reload all` - Reloads everything. Don't use this unless it's necessary.

## Upcoming Features?

**Stuff I kinda want to do but might be too lazy**
* `!coop` - Start a co-op race.

**Stuff that probably won't happen but would be cool**
* Allow multiple simultaneous races (LBP isn't that popular of a speedgame, so this probably isn't necessary).
* Bingo support (would make the bot name fit a little better, but how would LBP bingo even work?).
