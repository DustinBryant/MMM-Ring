/* Magic Mirror
 * Module: MMM-Ring
 *
 * By Dustin Bryant
 * MIT Licensed.
 * 
 * Huge thanks to dgreif on GitHub for the RingAPI and 
 * examples which resulted in ability to create this 
 * Magic Mirror module.
 * https://github.com/dgreif/ring
 */

Module.register("MMM-Ring", {
	DisplayTypes: {
		NONE: 1,
		ERROR: 2,
		VIDEO: 3
	},
	
	defaults: {
		ringEmail: undefined,
		ringPwd: undefined,
		ring2faRefreshToken: undefined,
		ringMinutesToStreamVideo: 1.5,
		ringVideoWidth: "600"
	},

   	start: function() {
		this.errorMessage = '';
		this.displayType = this.DisplayTypes.NONE;
		this.hls = '';
		
		if (this.config.ringEmail !== undefined || this.config.ringPwd !== undefined) {
			this.displayType = this.DisplayTypes.ERROR;
			this.errorMessage = "ringEmail and ringPwd are no longer valid configuration properties. Ring now requires a 2 factor authentication (2fa) refresh token. Must use ring2faRefreshToken property in config.";
			return;
		}
		
		if (this.config.ring2faRefreshToken === undefined) {
			this.displayType = this.DisplayTypes.ERROR;
			this.errorMessage = "Must provide ring2faRefreshToken within the MMM-Ring configuration within the Magic Mirror config file.";
			return;
		}
					
		if (this.config.ringMinutesToStreamVideo > 5) {
			this.displayType = this.DisplayTypes.ERROR;
			this.errorMessage = "ringMinutesToStreamVideo configuration property can not be larger than 5";
			return;
		}
	
		this.sendSocketNotification("BEGIN_RING_MONITORING", this.config);
	},
	
	getScripts: function() {
		return [ "https://cdn.jsdelivr.net/npm/hls.js" ];
	},
	
	getStyles: function() {
		return [ "MMM-Ring.css" ];
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	getDom: function() {
		if(this.hls) {
			this.hls.destroy();
			this.hls = null;
		}
		
		var wrapper = document.createElement("div");
		
		switch(this.displayType) {
			case this.DisplayTypes.NONE:
				return wrapper;
			case this.DisplayTypes.ERROR:
				wrapper.innerHTML = this.errorMessage;
				return wrapper;
			case this.DisplayTypes.VIDEO:
				var streamPath = window.location.href + "MMM-Ring/stream.m3u8";
				var video = document.createElement("video");
				video.className = "video";
				video.width = this.config.ringVideoWidth;
				video.muted = true;
				wrapper.appendChild(video);
					
				if (Hls.isSupported()) {
					const config = { liveDurationInfinity: true	};
					
					var hls = new Hls(config);
					this.hls = hls;
					
					hls.on(Hls.Events.ERROR, function (event, data) {
						var errorType = data.type;
						var errorDetails = data.details;
						var errorFatal = data.fatal;
						Log.error(`***************** MMM-Ring ERROR! Type: ${errorType}, Details: ${errorDetails}, Fatal: ${errorFatal}`);
					});
										
					hls.attachMedia(video);

					hls.on(Hls.Events.MEDIA_ATTACHED, function() {
						hls.loadSource(streamPath);
						hls.on(Hls.Events.MANIFEST_PARSED,function() {
							video.play();
						});
					});
				}
				else if (video.canPlayType("application/vnd.apple.mpegurl")) {
					video.src = streamPath;
					video.addEventListener("loadedmetadata", function() {
						video.play();
					});
				}
				
				return wrapper;
		}
	},
		
	socketNotificationReceived: function(notification, payload) {
		switch(notification) {
			case "DISPLAY_ERROR":
				this.displayType = this.DisplayTypes.ERROR;
				this.errorMessage = payload;
				this.updateDom();
				break;
			case "VIDEO_STREAM_ENDED":
				this.displayType = this.DisplayTypes.NONE;
				this.updateDom();
				break;
			case "VIDEO_STREAM_AVAILABLE":
				// if we are already on video stream then bail
				if (this.displayType === this.DisplayTypes.VIDEO) {
					break;
				}

				this.displayType = this.DisplayTypes.VIDEO;
				this.updateDom();
				break;
		}
    },
});
