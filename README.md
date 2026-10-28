# AFK

*Away from keyboard. A story about where the night goes.*

A 15–20 minute interactive story for secondary school students, written for Sec 1. It's Wednesday, 10:47 PM, and G3 Math WA1 is tomorrow. Your attention is split between your room (revision, Mum, your brother Ryan, a friend at the void deck) and your phone (a ranked match with your guild, an endless video feed, Unitygram, chats). At the end, the game shows where your night actually went.

Built for whole-class play on Chromebooks, followed by a teacher-led debrief. It also works on phones (switch between ROOM and PHONE at the bottom).

## What it is for

- **Action management / self-regulated learning:** players write a plan (stop time, lights out, where the phone goes), then see planned vs actual at the end.
- **The illusion of time:** the clock disappears inside phone apps, and phone time quietly costs more than it feels like (one swipe = 3 minutes). Come back to the room and the clock has jumped. The end screen reveals the exchange rate.
- **Peer pressure:** the guild uses guilt, exclusion and FOMO. Kai messages you privately too. When pressure tips into name-calling, a guild member pushes back.
- **Validation and comparison:** post your desk on Unitygram, then watch the likes pull you back. A classmate posts "3 hrs done ✅".
- **Peer support:** a friend needs someone. Noticing is the hard part.

## Endings

| Ending | Roughly how you get it |
|---|---|
| PRESENT | You noticed Hafiz, asked Mum, and went down to the void deck |
| ON TIME | You revised and slept, and missed one thing that wasn't on the list |
| CARRIED | Rift took most of the night |
| GHOST | Loop took most of the night |
| LIKED | Unitygram took most of the night |
| LOGGED OFF | You deleted Rift without telling anyone |

## Privacy

Nothing is sent anywhere. No accounts, no analytics, no camera or microphone. The only things stored are the list of endings found and the name typed, in the browser's own local storage on that device.

## Files

- `index.html`: page layout
- `style.css`: all styling
- `game.js`: the whole game (no libraries)
- `img/`: the photographs

## For whoever edits this next

- All story text lives in `game.js`. Search for the line you want to change.
- Night timeline: the `EV` array (who messages or knocks, and when).
- Chats: `deliver()` sends messages with typing delays; `setOpts()` offers replies. Hafiz is in `hAwake()`/`hInvite()`, the guild in `gInvite()`/`gAfterMatch()`, Kai's private messages in `kaiDecline()`/`kaiOff()`/`kaiLeft()`.
- Unitygram: `GR`, `pGram()`, `doPost()` (the like schedule).
- Endings: `pickEnding()` decides; `endingScene()`, `morning()`, `otherSide()`, `owlReveal()`, `exchange()` and `mirror()` write the end sequence.
- Test mode: add `?test=1&name=Alex&phone=drawer` to the URL to skip the intro.
