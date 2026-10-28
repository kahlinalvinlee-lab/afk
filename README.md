# AFK

*Away from keyboard. A story about where the night goes.*

A 15-minute interactive story for secondary school students. Wednesday, 10:47 PM, Math Common Test tomorrow. Your attention is split between your room (revision, Mum, your brother, a friend at the void deck) and your phone (a ranked match with your guild, an endless feed, chats). Time moves when you act. At the end, the game shows you where your night actually went.

Built for whole-class play on Chromebooks, followed by a teacher-led debrief. It also works on phones (switch between ROOM and PHONE at the bottom).

## What it is for

- **Action management / self-regulated learning:** players write a plan (stop time, lights out, where the phone goes), then see planned vs actual at the end.
- **Balanced online/offline use:** the game's pull is real and acknowledged (the guild is fun, the friendships are real). The best ending is about limits and showing up, not quitting. Quitting cold turkey without telling anyone is its own ending, and not the best one.
- **Peer support:** a friend needs someone. Noticing is the hard part.

## Endings

| Ending | Roughly how you get it |
|---|---|
| PRESENT | You noticed Hafiz, asked Mum, and went down to the void deck |
| ON TIME | You revised and slept, and missed one thing that wasn't on the list |
| CARRIED | Rift took most of the night |
| GHOST | Loop took most of the night |
| LOGGED OFF | You deleted Rift without telling anyone |

## Privacy

Nothing is sent anywhere. No accounts, no analytics, no camera or microphone. The only thing stored is the list of endings found and the name typed, in the browser's own local storage on that device.

## Files

- `index.html`: the whole game (HTML, CSS and JavaScript, no libraries)
- `img/`: the photographs

## For whoever edits this next

- All story text lives in `index.html`. Search for the line you want to change.
- Night timeline: the `EV` array (who messages or knocks, and when).
- Endings: `pickEnding()` decides; `endingScene()`, `morning()`, `otherSide()`, `owlReveal()` and `mirror()` write the end sequence.
- Test mode: add `?test=1&name=Alex&phone=drawer` to the URL to skip the intro.
