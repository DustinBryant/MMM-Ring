# MMM-Ring
This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/). 

Whenever someone rings your doorbell by pressing the button on your ring device, a video will appear wherever the module is placed within MM. This module will only work for ding events and will not do anything for motion events. Whenever there is no video being displayed nothing else is shown in its place.

**Caveats:**
* Must have an active Ring subscription
* Only works with someone ringing your doorbell (no motion events).
* There is a slight unavoidable delay (couple seconds) with the videos.
* In your ring app, all of these events will show as answered rings. This may get fixed in the future.
* You will not be able to interact, talk with, or hear the person on the other end through MM.
* The RingAPI being used is unofficial which means there could be potential issues if Ring ever decides to make changes.
* Though it will work most of the time, there are slight chances a video may not get picked up/streamed properly. This is due partly because of using an unoffical API and sometimes hls (video component used for streaming) picks up the stream too early or faults for other reasons.

## Installation
1. Install ffmpeg if it isn't already installed
```
sudo apt-get install ffmpeg
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
				ringEmail: "<YOUR RING ACCOUNT EMAIL ADDRESS>",
				ringPwd: "<YOUR RING ACCOUNT PASSWORD>"
			}
		},
```

## General configuration options
| Option                     | Description
|--------------------------- |-----------
| `ringEmail`                | *Required* This is the username of your Ring.com account
| `ringPwd`                  | *Required* This is the password for your Ring.com account
| `ring2faRefreshToken`      | *Optional* If your Ring.com account uses 2fa you'll want to include your RefreshToken here. If you do not have 2fa then do not include this configuration.
| `ringMinutesToStreamVideo` | *Optional* How long a ding event video stream should last before ending. MAX 5 minutes! <br><br>**Type:** `int`(minutes) <br>Default: 2
| `ringVideoWidth`           | *Optional* Width of the video display. <br><br>**Type:** `string`(px) <br>Default: "600"

## Dependencies
(installed via `npm install` in the installation instructions above)
* [ring-client-api](https://www.npmjs.com/package/ring-client-api) - version 5.6.2 or higher
* [hls.js](https://www.npmjs.com/package/hls.js/v/canary) - version 0.12.4 or higher
* [rxjs](https://www.npmjs.com/package/rxjs) - version 6.5.2 or higher
* [chokidar](https://www.npmjs.com/package/chokidar) - version 3.0.2 or higher

## Thanks
Huge thanks to [dgreif](https://github.com/dgreif) on github for doing the reverse engineering to figure out how to get a video stream from a ring event (see [ring-client-api](https://www.npmjs.com/package/ring-client-api) dependency)). Without it, this module wouldn't be possible!
