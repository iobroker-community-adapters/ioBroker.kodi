/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var kodi = require('kodi-ws');
//var connect1 = require('Connection');
var utils = require(__dirname + '/lib/utils');
var adapter = utils.adapter('kodi');

var connection = null;
var player_id =  null;
var player_type = null;
var playlist_id = null;


// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
		// adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    if (state && !state.ack) {
	
	
	}
});



function sendCommand(cmd,state,param) {
	if (cmd){
		getConnection(function (err, _connection) {
			if (_connection){
			// call your command here
				adapter.log.info('sending in KODI: '+ cmd +' - '+JSON.stringify(state.val));
				_connection.run(cmd, state.val).then(function(result) {
						adapter.log.debug('response from KODI: '+JSON.stringify(result));
					//adapter.setState(id, {val: JSON.stringify(result), ack: true});
				}, function (error) {
					adapter.log.warn(error);
					connection = null;
				}).catch(function (error) {
					adapter.log.error(error);
					connection = null;
				})
			}
		});
	} else {
		adapter.log.warn('Not set command!');
	}
}

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');
            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});




function main() {

	adapter.log.info('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);

	getConnection(function (err, _connection) {
		if (_connection){
			GetNameVersion();
			GetPlayerId();
			GetChannels();
			//GetPlayList();
		}
	});
	
	
    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
}

function GetPlayList(){
	var batch = connection.batch();	//*********** playlistid
	var GetItems = batch.Playlist.GetItems({"playlistid":playlist_id,"properties":["title","thumbnail","fanart","rating","genre","artist","track","season","episode","year","duration","album","showtitle","playcount","file"],"limits":{"start":0,"end":750}});
	//var GetInfoBooleans = batch.XBMC.GetInfoBooleans({"booleans":["System.Platform.Linux","System.Platform.Linux.RaspberryPi","System.Platform.Windows","System.Platform.OSX","System.Platform.IOS","System.Platform.Darwin","System.Platform.ATV2","System.Platform.Android"]});
	//var GetInfoLabels = batch.XBMC.GetInfoLabels({"labels":["System.KernelVersion","System.BuildVersion"]});
	batch.send();
	Promise.all([GetItems]).then(function(res) {
	
		adapter.log.debug('GetPlayList: ' + JSON.stringify(res));
	
	}, function (error) {
		adapter.log.warn(error);
		connection = null;
		getConnection();
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	});	
}

function GetNameVersion(){
	var batch = connection.batch();
	var GetProperties = batch.Application.GetProperties({"properties":["name","version"]});
	var GetInfoBooleans = batch.XBMC.GetInfoBooleans({"booleans":["System.Platform.Linux","System.Platform.Linux.RaspberryPi","System.Platform.Windows","System.Platform.OSX","System.Platform.IOS","System.Platform.Darwin","System.Platform.ATV2","System.Platform.Android"]});
	var GetInfoLabels = batch.XBMC.GetInfoLabels({"labels":["System.KernelVersion","System.BuildVersion"]});
	batch.send();
	Promise.all([GetProperties, GetInfoBooleans, GetInfoLabels]).then(function(res) {
	
		adapter.log.debug('GetNameVersion: ' + JSON.stringify(res));
	
	}, function (error) {
		adapter.log.warn(error);
		connection = null;
		getConnection();
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	});	
}
function GetChannels(){
	var batch = connection.batch();
	var alltv = batch.PVR.GetChannels({"channelgroupid":"alltv","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	var allradio = batch.PVR.GetChannels({"channelgroupid":"allradio","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	batch.send();
	Promise.all([alltv, allradio]).then(function(res) {
		adapter.setState('PVR.ChannelsIPTV', {val: JSON.stringify(res[0]), ack: true});
		adapter.setState('PVR.ChannelsRadio', {val: JSON.stringify(res[1]), ack: true});
	}, function (error) {
		adapter.log.warn(error);
		connection = null;
		getConnection();
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	});	
}
function GetPlayerProperties(){
	var batch = connection.batch();
		var Properties = batch.Player.GetProperties({"playerid":player_id,"properties":["audiostreams","canseek","currentaudiostream","currentsubtitle","partymode","playlistid","position","repeat","shuffled","speed","subtitleenabled","subtitles","time","totaltime","type"]});
		var InfoLabels = batch.XBMC.GetInfoLabels({"labels":["MusicPlayer.Codec","MusicPlayer.SampleRate","MusicPlayer.BitRate"]});
		batch.send();
		Promise.all([Properties, InfoLabels]).then(function(res) {
			adapter.log.debug('Response GetPlayerProperties '+ JSON.stringify(res));
			
			playlist_id = res[0].playlistid;
		/*	adapter.setState('Info.PlayingTime', {val: time(res[0].time.hours, res[0].time.minutes, res[0].time.seconds), ack: true});
			adapter.setState('Info.PlayingTotalTime', {val: time(res[0].totaltime.hours, res[0].totaltime.minutes, res[0].totaltime.seconds), ack: true});
			
			adapter.setState('Repeat', {val: res[0].repeat, ack: true});
			adapter.setState('Shuffle', {val: res[0].shuffled, ack: true});
			adapter.setState('Speed', {val: res[0].speed, ack: true});
			adapter.setState('Position', {val: res[0].position, ack: true});
			adapter.setState('Playlistid', {val: res[0].playlistid, ack: true});
			adapter.setState('Partymode', {val: res[0].partymode, ack: true});
			//adapter.log.error('---------------:' + res[0].audiostreams.length);
			if (res[0].audiostreams.length > 0){
				adapter.setState('Info.Codec', {val: res[0].audiostreams[0].codec, ack: true});
				adapter.setState('Info.BitRate', {val: res[0].audiostreams[0].bitrate, ack: true});
				adapter.setState('Info.Channels', {val: res[0].audiostreams[0].channels, ack: true});
				adapter.setState('Info.Language', {val: res[0].audiostreams[0].language, ack: true});
				adapter.setState('Info.Audiostreams', {val: res[0].audiostreams[0].name, ack: true});
			} else {
				adapter.setState('Info.Codec', {val: res[1]['MusicPlayer.Codec'], ack: true});
				adapter.setState('Info.SampleRate', {val: res[1]['MusicPlayer.SampleRate'], ack: true});
				adapter.setState('Info.BitRate', {val: res[1]['MusicPlayer.BitRate'], ack: true});	
			}
			adapter.setState('Info.Type', {val: res[0].type, ack: true});
*/
		}, function (error) {
			adapter.log.warn(error);
			connection = null;
			getConnection();
		}).catch(function (error) {
			adapter.log.error(error);
			connection = null;
			getConnection();
		});	


}

function GetPlayerId(){
	// Get all active players and log them 
	var batch = connection.batch();
	var ActivePlayers = batch.Player.GetActivePlayers();
	var Properties = batch.Application.GetProperties({'properties':['volume','muted']});
	batch.send();
	Promise.all([ActivePlayers, Properties]).then(function(res) {
		adapter.log.debug('Response GetPlayerId '+ JSON.stringify(res));
		if (res[0][0]){
			adapter.log.debug('Active players = ' + res[0][0].playerid +'. Type = '+ res[0][0].type);
			adapter.setState('Mute', {val: res[0].muted, ack: true});
			adapter.setState('Volume', {val: res[0].volume, ack: true});
			player_id = res[0][0].playerid;
			player_type = res[0][0].type;
			GetPlayerProperties();
		}
		setTimeout(function() { GetPlayerId(); }, 2000);
	}, function (error) {
		adapter.log.warn(error);
		connection = null;
		getConnection();
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	});	
}

function getConnection(cb) {
	if (connection) {
		cb && cb(null, connection);
		return;
	}
	kodi(adapter.config.ip, adapter.config.port).then(function (_connection) {
		connection = _connection;
		adapter.log.info('KODI connected');
		cb && cb(null, connection);
	}, function (error) {
		//do something if error
		adapter.log.debug(error);
		// try again in 5 seconds
		setTimeout(getConnection, 5000, cb);
	}).catch(function(error) {
		// Handle errors 
		if (error.stack) {
			adapter.log.error(error.stack);
		} else {
			adapter.log.error(error);
		}
		// try again in 5 seconds
		setTimeout(getConnection, 5000, cb);
	});
}