/* Magic Mirror
 * Node Helper: MMM-Ring
 *
 * By Dustin Bryant
 * MIT Licensed.
 *
 * Huge thanks to dgreif on GitHub for the RingAPI and
 * examples which resulted in ability to create this
 * Magic Mirror module.
 * https://github.com/dgreif/ring
 */

const NodeHelper = require("node_helper");
const pathApi = require("path");
const util = require("util");
const fs = require("fs");
const mainRingApi = require("ring-client-api");
const operators = require("rxjs/operators");
const fileWatcher = require("chokidar");

module.exports = NodeHelper.create({
  requiresVersion: "2.11.0",

  start: function () {
    this.toLog("Starting module: MMM-Ring");
    this.videoOutputDirectory = pathApi.join(this.path, "public");
    this.envFile = pathApi.join(this.path, ".env");
    this.ringApi = null;
    this.config = null;
    this.watcher = null;
    this.audioPlaylistFile = "stream.m3u8";
    this.sipSession = null;
    this.sessionRunning = false;
  },

  stop: function () {
    this.toLog("Stopping module helper: MMM-Ring");
    this.stopWatchingFile();

    if (this.sipSession) {
      this.sipSession.stop();
      this.sipSession = null;
    }

    this.cleanUpVideoStreamDirectory();
  },

  socketNotificationReceived: async function (notification, payload) {
    if (notification === "BEGIN_RING_MONITORING") {
      this.config = payload;

      if (!(await util.promisify(fs.exists)(this.envFile))) {
        await util.promisify(fs.writeFile)(
          this.envFile,
          `RING_2FA_REFRESH_TOKEN=${this.config.ring2faRefreshToken}`
        );
      }

      require("dotenv").config({ path: this.envFile });

      this.monitorRingActivity();
    }
  },

  cleanUpVideoStreamDirectory: async function () {
    if (!(await util.promisify(fs.exists)(this.videoOutputDirectory))) {
      await util.promisify(fs.mkdir)(this.videoOutputDirectory);
    }

    const files = await util.promisify(fs.readdir)(this.videoOutputDirectory);
    const unlinkPromises = files.map((filename) =>
      util.promisify(fs.unlink)(`${this.videoOutputDirectory}/${filename}`)
    );
    return await Promise.all(unlinkPromises);
  },

  monitorRingActivity: async function () {
    this.ringApi = new mainRingApi.RingApi({
      refreshToken: process.env.RING_2FA_REFRESH_TOKEN,
      debug: true,
      cameraDingsPollingSeconds: 2
    });

    this.ringApi.onRefreshTokenUpdated.subscribe(
      async ({ newRefreshToken, oldRefreshToken }) => {
        this.toLog("Refresh Token Updated");

        if (!oldRefreshToken) {
          return;
        }

        const currentConfig = await util.promisify(fs.readFile)(this.envFile);
        const updateConfig = currentConfig
          .toString()
          .replace(oldRefreshToken, newRefreshToken);
        await util.promisify(fs.writeFile)(this.envFile, updateConfig);
      }
    );

    const locations = await this.ringApi.getLocations();
    const allCameras = await this.ringApi.getCameras();

    this.toLog(
      `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`
    );

    for (const location of locations) {
      location.onConnected.pipe(operators.skip(1)).subscribe((connected) => {
        const status = connected ? "Connected to" : "Disconnected from";
        this.toLog(
          `**** ${status} location ${location.locationDetails.name} - ${location.locationId}`
        );
      });
    }

    for (const location of locations) {
      const cameras = location.cameras,
        devices = await location.getDevices();

      this.toLog(
        `Location ${location.locationDetails.name} has the following ${cameras.length} camera(s):`
      );

      for (const camera of cameras) {
        this.toLog(`- ${camera.id}: ${camera.name} (${camera.deviceType})`);
      }

      this.toLog(
        `Location ${location.locationDetails.name} has the following ${devices.length} device(s):`
      );

      for (const device of devices) {
        this.toLog(`- ${device.zid}: ${device.name} (${device.deviceType})`);
      }
    }

    if (allCameras === undefined || allCameras.length == 0) {
      this.toLog(
        `no cameras were found! Ensure you have a camera on your account or that you provided accurate login information in the config. You'll need to restart MagicMirror.`
      );
      this.sendSocketNotification(
        "DISPLAY_ERROR",
        "No cameras were found! Check console for more info."
      );
      return;
    }

    // Start listening for doorbell presses on each camera
    allCameras.forEach((camera) => {
      camera.onDoorbellPressed.subscribe(async () => {
        if (!this.sipSession) {
          await this.startSession(camera, "ring");
        }
      });
      this.toLog(`Actively listening for doorbell presses`);
      //Check config value if node app should stream motion
      if(this.config.ringStreamMotion){
        camera.onMotionDetected.subscribe(async (newMotion) => {
          //NewMotion is a true false value indicating whether the motion is new based on the dings made in the last 65 seconds
          // This prevents the stream from being triggered on startup because it would not be an active motion event.
          if (!this.sipSession && newMotion) {
            await this.startSession(camera, "motion");
          }
        });
        this.toLog(`Actively listening for Motion events`);
      }
      
    });

    
  },

  startSession: async function (camera, type) {
    if (this.sipSession || this.sessionRunning === true) {
      return;
    }

    this.sessionRunning = true;
    if(type === "ring"){
      this.toLog(`${camera.name} had its doorbell rung! Preparing video stream.`);
    }else if(type === "motion"){
      this.toLog(`${camera.name} has sensed motion Preparing video stream.`);
    }else{
      this.toLog(`${camera.name} been summoned by something other than a ring or motion. (spooky) Preparing video stream.`); 
    }
    

    await this.cleanUpVideoStreamDirectory();
    this.watchForStreamStarted();

    const streamTimeOut = this.config.ringMinutesToStreamVideo * 60 * 1000;
    this.sipSession = await camera.streamVideo({
      output: [
        "-preset",
        "veryfast",
        "-g",
        "25",
        "-sc_threshold",
        "0",
        "-f",
        "hls",
        "-hls_time",
        "2",
        "-hls_list_size",
        "6",
        "-hls_flags",
        "delete_segments",
        pathApi.join(this.videoOutputDirectory, this.audioPlaylistFile)
      ]
    });
    this.sipSession.onCallEnded.subscribe(() => {
      this.toLog(`${camera.name} video stream has ended`);
      this.sendSocketNotification("VIDEO_STREAM_ENDED", null);
      this.stopWatchingFile();
      this.sipSession = null;
      this.sessionRunning = false;
    });
    setTimeout(() => {
      this.toLog(`timeout hit`);
      if (this.sipSession) {
        this.sipSession.stop();
      }
    }, streamTimeOut);
  },

  stopWatchingFile: function () {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  },

  toLog: function (message) {
    console.log(`MMM-Ring at (${new Date().toLocaleString()}): ${message}`);
  },

  watchForStreamStarted: function () {
    this.stopWatchingFile();

    // only watch for file for 15 seconds
    setTimeout(() => this.stopWatchingFile(), 15 * 1000);

    this.watcher = fileWatcher.watch(this.videoOutputDirectory, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    });

    this.watcher.on("add", (filePath) => {
      var fileName = filePath.split("\\").pop().split("/").pop();

      if (fileName === this.audioPlaylistFile) {
        this.stopWatchingFile();
        this.sendSocketNotification("VIDEO_STREAM_AVAILABLE", null);
      }
    });
  }
});
