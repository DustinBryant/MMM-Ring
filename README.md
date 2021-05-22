# MMM-Ring

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

Whenever someone rings your doorbell by pressing the button on your ring device, or when motion is detected a video will appear wherever the module is placed within MM. Whenever there is no video being displayed nothing else is shown in its place.

**Caveats:**

- Must have an active Ring subscription
- Only displays the earliest stream sent to it with no way to view multiple streams.
- There is a slight unavoidable delay (couple seconds) with the videos.
- In your ring app, all of these events will show as answered rings or answered motion. This may get fixed in the future.
- You will not be able to interact, talk with, or hear the person on the other end through MM.
- The RingAPI being used is unofficial which means there could be potential issues if Ring ever decides to make changes.
- Though it will work most of the time, there are slight chances a video may not get picked up/streamed properly. This is due partly because of using an unoffical API and sometimes hls (video component used for streaming) picks up the stream too early or faults for other reasons.

## Installation

1. Install ffmpeg if it isn't already installed. You need to install ffmpeg-for-homebridge to support audio.

```
sudo curl -Lf# https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-raspbian-armv6l.tar.gz | sudo tar xzf - -C / --no-same-owner

```

2. Using the terminal, navigate to your `MagicMirror/modules` folder
3. Execute: `git clone https://github.com/DustinBryant/MMM-Ring.git`
4. Navigate to this new folder `cd MMM-Ring`
5. Execute: `npm install`

## Using the module

To use this module, add the following configuration block to the modules array in the `config/config.js` file:

```js
		{
			module: "MMM-Ring",
			position: "middle_center",
			config: {
				ring2faRefreshToken: "<YOUR REFRESH TOKEN>"
			}
		},
```

## General configuration options

| Option                     | Description                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ring2faRefreshToken`      | (_Required_) Look at the [Refresh Tokens](https://github.com/DustinBryant/MMM-Ring/wiki/Refresh-Tokens)) wiki entry for how to set this up. |
| `ringMinutesToStreamVideo` | (_Optional_) How long a ding event video stream should last before ending. MAX 5 minutes! <br><br>**Type:** `int`(minutes) <br>Default: 1.5 |
| `ringVideoWidth`           | (_Optional_) Width of the video display. <br><br>**Type:** `string`(px) <br>Default: "600"                                                  |
| `ringStreamMotion`         | (_Optional_) Displays stream if there is motion, not just a ring. If more than one motion event or doorbell press happens within the "ringMinutesToStreamVideo" length of time it will prioitize the first event that was triggered. Motion can also not be triggered more than once within 65 seconds.  <br><br>**Type:** `boolean`(true/false) <br>Default: false                                                  |
|`muted`| (_Optional_) Mute video stream. <br><br>**Type:** `boolean`(true/false) <br>Default: "false"  |

## Dependencies

(installed via `npm install` in the installation instructions above)

- [ring-client-api](https://www.npmjs.com/package/ring-client-api) - version 8.2.0 or higher
- [hls.js](https://www.npmjs.com/package/hls.js/v/canary) - version 0.13.0 or higher
- [rxjs](https://www.npmjs.com/package/rxjs) - version 6.5.5 or higher
- [chokidar](https://www.npmjs.com/package/chokidar) - version 3.4.0 or higher
- [dotenv](https://www.npmjs.com/package/dotenv) - version 8.2.0 or higher

## Thanks

Huge thanks to [dgreif](https://github.com/dgreif) on github for doing the reverse engineering to figure out how to get a video stream from a ring event (see [ring-client-api](https://www.npmjs.com/package/ring-client-api) dependency)). Without it, this module wouldn't be possible!
