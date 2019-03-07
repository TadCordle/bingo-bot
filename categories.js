var exports = module.exports = {};

// Given a string (game), returns the name of the closest matching LBP game.
exports.normalizeGameName = (game) => {
    game = game.toLowerCase()
            .replace(new RegExp(" ", 'g'), "")
            .replace(new RegExp("'", 'g'), "")
            .replace("littlebigplanet", "lbp");
    
    if (game === "lbp" || game === "lbp1" || game === "1") {
        return "LittleBigPlanet";

    } else if (game === "psp" || game === "lbppsp") {
        return "LittleBigPlanet PSP";

    } else if (game === "memes"
            || game === "spm"
            || game === "sackboysprehistoricmoves"
            || game === "prehistoricmemes"
            || game === "sackboysprehistoricmemes"
            || game === "lbpspm"
            || game === "lbpsackboysprehistoricmoves"
            || game === "lbpprehistoricmemes"
            || game === "lbpsackboysprehistoricmemes") {
        return "Sackboy's Prehistoric Moves";
    
    } else if (game === "lbp2" || game === "2") {
        return "LittleBigPlanet 2";

    } else if (game === "lbpv" || game === "lbpvita" || game === "v" || game === "vita") {
        return "LittleBigPlanet Vita";
    
    } else if (game === "lbpk" || game === "lbpkarting" || game === "k" || game === "karting") {
        return "LittleBigPlanet Karting";

    } else if (game === "lbp3" || game === "3") {
        return "LittleBigPlanet 3"

    } else {
        return null;
    }
}

// Given a game name (normalizedGame) and a category string, returns the closest matching category name.
exports.normalizeCategory = (normalizedGame, category) => {
    normalizedCategory = category.toLowerCase()
            .replace(new RegExp(" ", 'g'), "")
            .replace(new RegExp("-", 'g'), "")
            .replace("%", "")
            .replace("new game", "ng")
            .replace("plus", "+");

    // Categories common between all games
    if (normalizedCategory === "any") {
        return "Any%";
    } else if (normalizedCategory === "100") {
        return "100%";
    } else if (normalizedCategory === "coop" || normalizedCategory === "coopng+" || normalizedCategory === "2pcoop" || normalizedCategory === "2pcoopng+") {
        return "2p Co-op NG+";
    } else if (normalizedCategory === "3pcoop" || normalizedCategory === "3pcoopng+") {
        return "3p Co-op NG+";
    } else if (normalizedCategory === "4pcoop" || normalizedCategory === "4pcoopng+") {
        return "4p Co-op NG+";
    } else if (normalizedCategory === "an3") {
        return "An3%";
    } else if (normalizedCategory === "an7") {
        return "An7%";
    }

    if (normalizedGame === "LittleBigPlanet") {
        // LBP1-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno") {
            return "Any% No-Overlord";
        } else if (normalizedCategory === "100nooverlord" || normalizedCategory === "100no") {
            return "100% No-Overlord";
        } else if (normalizedCategory === "alllevels" || normalizedCategory === "al") {
            return "All Levels"
        } else if (normalizedCategory === "styrofoam") {
            return "Styrofoam%";
        } else if (normalizedCategory === "die") {
            return "Die%";
        } else {
            return null;
        }

    } else if (normalizedGame === "LittleBigPlanet 2") {
        // LBP2-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno" || normalizedCategory === "ng+" || normalizedCategory === "solong+") {
            return "Any% No-Overlord";
        } else {
            return null;
        }

    } else if (normalizedGame === "LittleBigPlanet 3") {
        // LBP3-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno" || normalizedCategory === "anynocreate" || normalizedCategory === "anync") {
            return "Any% No-Create";
        } else if (normalizedCategory === "profilecorruption" || normalizedCategory === "corruption") {
            return "Profile Corruption%"
        } else {
            return null;
        }

    } else {
        return null;
    }
}

// this function is so dumb
exports.normalizeLevels = (normalizedGame, level) => {
    level = level.toLowerCase()
            .replace(new RegExp("'", 'g'), "")
            .replace(new RegExp("-", 'g'), "")
            .replace(new RegExp(":", 'g'), "")
            .replace(new RegExp("?", 'g'), "")
            .replace(new RegExp("&", 'g'), "and")
            .replace(new RegExp("!", 'g'), "")
            .replace(new RegExp(",", 'g'), "")
            .replace(new RegExp(" ", 'g'), "")
            .replace(new RegExp("the", 'g'), "");
    
    if (normalizedGame === "LittleBigPlanet") {
        // LBP1 levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "firststeps") {
            return "First Steps";
        } else if (level === "getagrip") {
            return "Get a Grip";
        } else if (level === "skatetovictory") {
            return "Skate to Victory";
        } else if (level === "tieskipping") {
            return "Tie Skipping";
        } else if (level === "castleclimbchallenge") {
            return "Castle Climb Challenge";
        } else if (level === "skateboardfreefall") {
            return "Skateboard Freefall";
        }

        else if (level === "swingingsafari") {
            return "Swinging Safari";
        } else if (level === "burningforest") {
            return "Burning Forest";
        } else if (level === "meerkatkingdom") {
            return "Meerkat Kingdom";
        } else if (level === "flamingseesawseasy") {
            return "Flaming Seesaws - Easy";
        } else if (level === "flamingseesawsmedium") {
            return "Flaming Seesaws - Medium";
        } else if (level === "flamingseesawshard") {
            return "Flaming Seesaws - Hard";
        } else if (level === "tunnelplunge") {
            return "Tunnel Plunge";
        } else if (level === "meerkatbounce") {
            return "Meerkat Bounce";
        }

        else if (level === "weddingreception") {
            return "The Wedding Reception";
        } else if (level === "darkness") {
            return "The Darkness";
        } else if (level === "skulldozer") {
            return "Skulldozer";
        } else if (level === "dangerousdescent") {
            return "The Dangerous Descent";
        } else if (level === "wobblepoles") {
            return "Wobble Poles";
        } else if (level === "bubblelabyrinth") {
            return "Bubble Labyrinth";
        }

        else if (level === "boomtown") {
            return "Boom Town";
        } else if (level === "mines") {
            return "The Mines";
        } else if (level === "serpentshrine") {
            return "Serpent Shrine";
        } else if (level === "wrestlersdrag") {
            return "Wrestler's Drag";
        } else if (level === "cowabunga") {
            return "Cowabunga";
        } else if (level === "rollerruneasy") {
            return "Roller Run - Easy";
        } else if (level === "rollerrunmedium") {
            return "Roller Run - Medium";
        } else if (level === "rollerrunhard") {
            return "Roller Run - Hard";
        } else if (level === "puzzlewheel") {
            return "Puzzle Wheel";
        }

        else if (level === "lowrider") {
            return "Lowrider";
        } else if (level === "subway") {
            return "The Subway";
        } else if (level === "constructionsite") {
            return "The Construction Site";
        } else if (level === "dragrace") {
            return "The Drag Race";
        } else if (level === "elevation") {
            return "Elevation";
        } else if (level === "discombobulator") {
            return "The Discombobulator";
        }
        
        else if (level === "endurancedojo") {
            return "Endurance Dojo";
        } else if (level === "senseislostcastle") {
            return "Sensei's Lost Castle";
        } else if (level === "terribleonisvolcano") {
            return "The Terrible Oni's Volcano";
        } else if (level === "darumasan") {
            return "Daruma San";
        } else if (level === "wheelofmisfortune") {
            return "Wheel of Misfortune";
        } else if (level === "rollercastle") {
            return "Roller Castle";
        }

        else if (level === "dancerscourt") {
            return "The Dancer's Court";
        } else if (level === "elephanttemple") {
            return "Elephant Temple";
        } else if (level === "greatmagicianspalace") {
            return "Great Magician's Palace";
        } else if (level === "shiftingtemple") {
            return "The Shifting Temple";
        } else if (level === "pillarjumping") {
            return "Pillar Jumping";
        } else if (level === "firepits") {
            return "Fire Pits";
        }

        else if (level === "frozentundra") {
            return "The Frozen Tundra";
        } else if (level === "bunker") {
            return "The Bunker";
        } else if (level === "collectorslair") {
            return "The Collector's Lair";
        } else if (level === "collector") {
            return "The Collector";
        } else if (level === "splinerider") {
            return "Spline Rider";
        } else if (level === "rotortubes") {
            return "Rotor Tubes";
        } else if (level === "jetpacktunnel") {
            return "Jetpack Tunnel";
        }

    } else if (normalizedGame === "LittleBigPlanet PSP") {
        // PSP levels
        if (level === "intro" || level === "introduction") {
            return "The Introduction";
        } else if (level === "walkabout") {
            return "Walkabout";
        } else if (level === "giftofgrab") {
            return "Gift of the Grab";
        } else if (level === "didgeridoodidgeridont") {
            return "Didgeridoo Didgeridon't";
        } else if (level === "dreamtime") {
            return "Dreamtime";
        }

        else if (level === "mortardo") {
            return "Mortar Do";
        } else if (level === "dragononabite") {
            return "Dragon on a Bite";
        } else if (level === "eggstraction") {
            return "Eggstraction";
        }

        else if (level === "cheekymonkey") {
            return "Cheeky Monkey";
        } else if (level === "thievesden") {
            return "Thieves' Den";
        } else if (level === "rugsnkisses" || level === "highonrugs") {
            return "Rugs n Kisses";
        }

        else if (level === "gethump") {
            return "Get the Hump";
        } else if (level === "sandahoy") {
            return "Sand Ahoy";
        } else if (level === "funpharaoh") {
            return "Fun Pharaoh";
        }

        else if (level === "mountinexcitement") {
            return "Mountin' Excitement";
        } else if (level === "peakperformance") {
            return "Peak Performance";
        } else if (level === "doggeddetermination") {
            return "Dogged Determination";
        }

        else if (level === "stitchgordon") {
            return "Stitch Gordon";
        } else if (level === "fryingsaucers") {
            return "Frying Saucers";
        } else if (level === "sewnidentity") {
            return "The Sewn Identity";
        }

        else if (level === "openingfright") {
            return "Opening Fright";
        } else if (level === "crashingparty") {
            return "Crashing the Party";
        } else if (level === "roadtojoy") {
            return "Road to Joy";
        } else if (level === "carnival") {
            return "The Carnival";
        }

    } else if (normalizedGame === "Sackboy's Prehistoric Moves") {
        // Memes levels
        if (level === "learningtomove") {
            return "Learning to Move";
        } else if (level === "prehistoricparadise") {
            return "Prehistoric Paradise";
        } else if (level === "insidebigrex") {
            return "Inside Big Rex";
        } else if (level === "cromagnoncity") {
            return "Cro-Magnon City";
        } else if (level === "hotstepping") {
            return "Hot Stepping";
        } else if (level === "fossilfight") {
            return "Fossil Fight";
        }
        
    } else if (normalizedGame === "LittleBigPlanet 2") {
        // LBP2 levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "rookietest") {
            return "Rookie Test";
        } else if (level === "grabandswing") {
            return "Grab and Swing";
        } else if (level === "gripplegrapple") {
            return "Gripple Grapple";
        } else if (level === "braverytest") {
            return "Bravery Test";
        } else if (level === "finaltest") {
            return "Final Test";
        }

        else if (level === "runawaytrain") {
            return "Runaway Train";
        } else if (level === "brainycakes") {
            return "Brainy Cakes";
        } else if (level === "cakeinator") {
            return "Cakeinator";
        } else if (level === "currantaffairs") {
            return "Currant Affairs";
        } else if (level === "klingklong") {
            return "Kling Klong";
        }

        else if (level === "maximumsecurity") {
            return "Maximum Security";
        } else if (level === "pipedreams") {
            return "Pipe Dreams";
        } else if (level === "bangforbuck") {
            return "Bang for Buck";
        } else if (level === "wastedisposal") {
            return "Waste Disposal";
        } else if (level === "fowlplay") {
            return "Fowl Play";
        }

        else if (level === "aaaa" || level === "avalonsadvancedarmamentsacademy") {
            return "Avalon's Advanced Armaments Academy";
        } else if (level === "gothump") {
            return "Got the Hump";
        } else if (level === "sackbotredemption") {
            return "The Sackbot Redemption";
        } else if (level === "fitfod" || level === "flyinginfaceofdanger") {
            return "Flying in the Face of Danger";
        } else if (level === "hpfhs" || level === "hugeperilforhugespaceship") {
            return "Huge Peril for Huge Spaceship";
        }

        else if (level === "upandatem") {
            return "Up and At 'Em";
        } else if (level === "patientsareavirtue") {
            return "Patients Are a Virtue";
        } else if (level === "fwyhf" || level === "ffwyhf" || level === "fireflieswhenyourehavingfun") {
            return "Fireflies When You're Having Fun";
        } else if (level === "casadelhigginbotham") {
            return "Casa del Higginbotham";
        } else if (level === "iotbi" || level === "invasionofthebodyinvaders") {
            return "Invasion of the Body Invaders";
        }

        else if (level === "stcfthotn" || level === "setcontrolsforheartofnegativatron") {
            return "Set the Controls for the Heart of the Negativatron";
        } else if (level === "fullmetalrabbit") {
            return "Full Metal Rabbit";
        } else if (level === "witwiac" || level === "whereinworldisavaloncentrifuge") {
            return "Where in the World is Avalon Centrifuge?";
        } else if (level === "fightofthebumblebee") {
            return "Fight of the Bumblebee";
        } else if (level === "intoheartofnegativitron") {
            return "Into the Heart of the Negativitron";
        }
        // TODO: Side levels?

    } else if (normalizedGame === "LittleBigPlanet Vita") {
        // TODO?
        return null;

    } else if (normalizedGame === "LittleBigPlanet Karting") {
        // TODO?
        return null;

    } else if (normalizedGame === "LittleBigPlanet 3") {
        // LBP3 levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "needlepointpeaks") {
            return "Needlepoint Peaks";
        } else if (level === "newtonsairship") {
            return "Newton's Airship";
        } else if (level === "stitchemmanor") {
            return "Stitchem Manor";
        } else if (level === "tinpottowers") {
            return "Tinpot Towers";
        }

        else if (level === "highstakesheist") {
            return "High Stakes Heist";
        } else if (level === "deepspacedrivein") {
            return "Deep Space Drive-In";
        } else if (level === "shakerattleandroll") {
            return "Shake, Rattle & Roll";
        } else if (level === "crumblingcrypts") {
            return "Crumbling Crypts";
        } else if (level === "lightscameratraction") {
            return "Lights, Camera, Traction!";
        }

        else if (level === "goloco") {
            return "Go Loco";
        } else if (level === "furrysoleshotcoals") {
            return "Furry Soles, Hot Coals";
        } else if (level === "flipfloppedfolios") {
            return "Flip-Flopped Folios";
        } else if (level === "tututango") {
            return "Tutu Tango";
        } else if (level === "onlinkofdisaster") {
            return "On the Link of Disaster";
        }

        else if (level === "masquemakerstower") {
            return "Masque Maker's Tower";
        } else if (level === "bellyofbeast") {
            return "Belly of the Beast";
        } else if (level === "cloudcaravan") {
            return "Cloud Caravan";
        } else if (level === "greatescape") {
            return "The Great Escape";
        } else if (level === "evenbosseswearhatssometimes") {
            return "Even Bosses Wear Hats Sometimes";
        }
        // TODO: Side levels?
    }

    return null;
}