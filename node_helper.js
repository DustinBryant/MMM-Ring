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
	
	start: function() {
		console.log("Starting module: MMM-Ring");
		this.videoOutputDirectory = pathApi.join(this.path, "public");
		this.ringApi = null;
		this.config = null;
		this.watcher = null;
		this.audioPlaylistFile = "stream.m3u8";
		this.sipSession = null;
	},
	
	stop: function() {
		console.log("Stopping module helper: MMM-Ring");
		this.stopWatchingFile();
		
		if (this.sipSession) {
			this.sipSession.stop();
			this.sipSession = null;
		}
		
		this.cleanUpVideoStreamDirectory();
	},
	
    socketNotificationReceived: function(notification, payload) {
		if (notification === "BEGIN_RING_MONITORING") {
			this.config = payload;
			this.monitorRingActivity();
		}
    },
    
	cleanUpVideoStreamDirectory: async function() {
		if (!(await util.promisify(fs.exists)(this.videoOutputDirectory))) {
			await util.promisify(fs.mkdir)(this.videoOutputDirectory);
		}
		
		const files = await util.promisify(fs.readdir)(this.videoOutputDirectory);
		const unlinkPromises = files.map(filename => util.promisify(fs.unlink)(`${this.videoOutputDirectory}/${filename}`));
		return await Promise.all(unlinkPromises);
	},
	
	monitorRingActivity: async function() {
		this.ringApi = new mainRingApi.RingApi({
			email: this.config.ringEmail,
			password: this.config.ringPwd,
			refreshToken: this.config.ring2faRefreshToken,
			debug: true,
			cameraDingsPollingSeconds: 2
		});
		const locations = await this.ringApi.getLocations();
		const allCameras = await this.ringApi.getCameras();
		
		this.toLog(`Found ${locations.length} location(s) with ${allCameras.length} camera(s).`);

		for (const location of locations) {
			location.onConnected.pipe(operators.skip(1)).subscribe(connected => {
				const status = connected ? "Connected to" : "Disconnected from";
				this.toLog(`**** ${status} location ${location.locationDetails.name} - ${location.locationId}`);
			});
		}
		
		for (const location of locations) {
			const cameras = location.cameras, devices = await location.getDevices();
			
			this.toLog(`Location ${location.locationDetails.name} has the following ${cameras.length} camera(s):`);

			for (const camera of cameras) {
				this.toLog(`- ${camera.id}: ${camera.name} (${camera.deviceType})`);
			}

			this.toLog(`Location ${location.locationDetails.name} has the following ${devices.length} device(s):`);

			for (const device of devices) {
				this.toLog(`- ${device.zid}: ${device.name} (${device.deviceType})`);
			}
		}
		
		if (allCameras === undefined || allCameras.length == 0) {
			this.toLog(`no cameras were found! Ensure you have a camera on your account or that you provided accurate login information in the config. You'll need to restart MagicMirror.`);
			this.sendSocketNotification("DISPLAY_ERROR", "No cameras were found! Check console for more info.");
			return;
		}
		
		// Start listening for doorbell presses on each camera
		allCameras.forEach(camera => {
			camera.onDoorbellPressed.subscribe(async () => {
				if (!this.sipSession) {
					await this.startSession(camera);
				}
			});
		});

		this.toLog(`Actively listening for doorbell presses`);
	},
	
	startSession: async function(camera) {
		if (this.sipSession) {
			return;
		}
		
		this.toLog(`${camera.name} had its doorbell rung! Preparing video stream.`);
		
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
		});
		setTimeout(() => this.sipSession.stop(), streamTimeOut);
	},
	
	stopWatchingFile: function() {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
	},
	
	toLog: function(message) {
		console.log(`MMM-Ring at (${new Date().toLocaleString()}): ${message}`);
	},
	
	watchForStreamStarted: function() {
		this.stopWatchingFile();
		
		// only watch for file for 15 seconds
		setTimeout(() => this.stopWatchingFile(), 15 * 1000);
		
		this.watcher = fileWatcher.watch(this.videoOutputDirectory, {
			ignored: /(^|[\/\\])\../,
			persistent: true
		});
		
		this.watcher.on("add", filePath => {
			var fileName = filePath.split("\\").pop().split("/").pop();
			
			if (fileName === this.audioPlaylistFile) {
				this.stopWatchingFile();
				this.sendSocketNotification("VIDEO_STREAM_AVAILABLE", null);
			}
		});
	}
});