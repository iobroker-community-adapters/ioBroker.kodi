"use strict";

var kodi = require('kodi-ws');
var utils = require(__dirname + '/lib/utils');
var adapter = utils.adapter('kodi');

var object = {};
var connection = null;
var player_id =  null;
var player_type = null;
var playlist_id = null;
var mem = null;
var mem_pos = null;
var timer;

adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

adapter.on('message', function (obj) {
	if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            adapter.log.debug('send command ' + JSON.stringify(obj));
			var _obj = obj.message;
			var param = {'title': '', 'message': '', 'image': 'info', 'displaytime': 5000};
			if (typeof _obj.message !== "object") {
				param.message = _obj.message;
			}
			param.title		  = _obj.title || '';
			param.image		  = _obj.image || 'info';
			param.displaytime = _obj.delay || 5000;
			
			sendCommand('GUI.ShowNotification', param);
			
			if (obj.callback){
				adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
			}
		}
    }
});

adapter.on('stateChange', function (id, state) {
		// adapter.log.error('stateChange ' + id + ' ' + JSON.stringify(state));
	if ( id == adapter.namespace + '.currentplay' && state.val !== mem ){
		mem = state.val;
		GetCurrentItem();
		setTimeout(function() { GetPlayList(); }, 1000);
	}
	if ( id == adapter.namespace + '.position' && state.val !== mem_pos ){
		mem_pos = state.val;
		GetCurrentItem();
		setTimeout(function() { GetPlayList(); }, 1000);
	}
    if (state && !state.ack) {
		adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
		var param = state.val;
		var ids = id.split(".");
		var method = ids[ids.length - 2].toString();
		if (method === '0'){ //
			method = null;
		}
		ids = ids[ids.length - 1].toString();
		
		ConstructorCmd(method, ids, param);
	}
});

function ConstructorCmd( method, ids, param ){
	//adapter.log.error('stateChange ' + method + ' - ' + ids + ' = ' + param);
		if (method === 'input'){
			method = 'Input.' + ids;
			param = [];
		} else {
			switch(ids) {
			  case "SwitchPVR":
					method = null;
					SwitchPVR(param, function(res){
						sendCommand('Player.Open', res);
						setTimeout(function() { sendCommand('GUI.SetFullscreen', {"fullscreen":true}); }, 5000);
					});
				break;
			  case "ShowNotif":
					ShowNotification(param, function(res){
						method = 'GUI.ShowNotification';
						param = res;
					});
				break;
			  case "zoom":
					if (param >= 0 && param <= 10){
						method = 'Player.Zoom'; //
						param = {"playerid":player_id,"zoom": parseInt(param)}
					}
				break;
			  case "setsubtitle":
					method = 'Player.SetSubtitle'; //"previous", "next", "off", "on
					param = {"playerid":player_id,"subtitle": param}
				break;
			  case "GoTo":
					method = 'Player.GoTo'; //
					param = {"playerid":player_id,"to": param}
				break;
			  case "position": //
					method = 'Player.GoTo'; //
					param = {"playerid":player_id,"to": param}
				break;
			  case "seek":
					if (param >= 0 && param <= 100){
						method = 'Player.Seek'; //int 0-100
						param = {"playerid":player_id,"value": parseInt(param)}
					}
				break;
			  case "volume":
					if (param >= 0 && param <= 100){
						method = 'Application.SetVolume'; //int 0-100
						param = parseInt(param);
					}
				break;
			  case "mute":
					method = 'Application.SetMute'; //bool
					param = bool(param);
				break;
			  case "repeat":
					method = 'Player.SetRepeat'; //off, on, all
					param = {'playerid': player_id,"repeat": param}; 
				break;
			  case "shuffle":
					method = 'Player.SetShuffle'; //bool
					param = {'playerid': player_id,"shuffle": bool(param)}; 
				break;
			  case "play":
					method = 'Input.ExecuteAction';
					param = 'play';
				break;
			  case "next":
					method = 'Input.ExecuteAction';
					param = 'skipnext';
				break;
			  case "previous":
					method = 'Input.ExecuteAction';
					param = 'skipprevious';
				break;
			  case "pause":
					method = 'Player.PlayPause';
					param = {'playerid': player_id, "play": "toggle"};
				break;
			  case "stop":
					method = 'Player.Stop';
					param = {'playerid': player_id};
				break;
			  case "youtube":
					method = 'Player.Open';
					param = {'item': {'file': 'plugin://plugin.video.youtube/?action=play_video&amp;videoid=' + param.toString() }};
				break;
			  case "ActivateWindow":
					method = 'GUI.ActivateWindow';
					param = {"window": param };
				break;
			  case "ExecuteAction":
					method = 'Input.ExecuteAction';
					param = param.toString();
				break;
			  case "open":
					method = 'Player.Open';
					param = {'item': {'file' : param.toString() }};
				break;
			case "speed":
					if (~[-32,-16,-8,-4,-2,-1,0,1,2,4,8,16,32].indexOf(parseInt(param))){
						method = 'Player.SetSpeed';
						param = {'playerid': player_id,'speed': parseInt(param)};
					}
				break;
			
			default:
			
			}
		}
	//adapter.log.error('stateChange ' + method + ' - ' + ids + ' = ' + JSON.stringify(param));
	sendCommand(method, param);
}

function sendCommand(method, param) {
	if (method){
		getConnection(function (err, _connection) {
			if (_connection){
				adapter.log.info('sending in KODI: '+ method +' - '+JSON.stringify(param));
				_connection.run(method, param).then(function(result) {
						adapter.log.debug('response from KODI: '+JSON.stringify(result));
				}, function (error) {
					adapter.log.error(error);
					connection = null;
				}).catch(function (error) {
					adapter.log.error(error);
					connection = null;
				})
			}
		});
	} else {
		adapter.log.warn('It does not specify commands or invalid value!');
	}
}
function ShowNotification(param, callback){
	var title = '';
	var message = '';
	var displaytime = 5000;
	var img = ['info','warning','error'];
	var image = 'info';
	var c = (';' + param).split(';');
	var flag = false;
	c.forEach(function(item, i, arr) {
		if (!isNaN(item)){
			var num = parseInt(item);
			if (num >= 1500 && num <= 30000){
				displaytime = num;
			}
			else if (num >= 0 && num <= 2){
				image = img[num];
			}
		}
		if (isNaN(arr[i]) && isNaN(arr[i+1]) && flag === false){
			if (arr[i] && arr[i+1]){
				title = arr[i].toString();
				message = arr[i+1].toString();
				flag = true;
			}
		}
	});
	if (!flag){
		c.forEach(function(item, i, arr) {
			if (isNaN(arr[i]) && arr[i]){
				message = arr[i].toString();
			}
		});
	}
	callback ({'title': title, 'message': message, 'image': image, 'displaytime': displaytime});
}

adapter.on('ready', function () {
    main();
});

function connect () {
	adapter.setState('info.connection', false, true);
	adapter.log.info('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);
	getConnection(function (err, _connection) {
		if (_connection){
			//adapter.sendTo(adapter.namespace, 'send','', function(r){});//Иначе не работает подписка на message
			//		GetNameVersion();
			//		GetPlayerId();
			//		GetChannels();
		}
	});

}

function main() {
    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
	connect();
}

function GetPlayList(){  
	if (connection){
		connection.run('Playlist.GetItems', {"playlistid":playlist_id,"properties":["title","thumbnail","fanart","rating","genre","artist","track","season","episode","year","duration","album","showtitle","playcount","file"]/*,"limits":{"start":0,"end":750}*/}).then(function(res) {
			adapter.log.debug('GetPlayList: ' + JSON.stringify(res));
			adapter.setState('playlist', {val: JSON.stringify(res), ack: true});
		}, function (error) {
			adapter.log.error(error);
			connection = null;
			getConnection();
		}).catch(function (error) {
			adapter.log.error(error);
			connection = null;
			getConnection();
		})
	}
}
function GetCurrentItem(){
if (connection){
	adapter.getStates('info.*',function (err, obj) {
		for (var state in obj) {
			if (state !== adapter.namespace + '.info.connection'){
				adapter.setState(state, {val: '', ack: true});
			}
		}
		connection.run('Player.GetItem', {"playerid":player_id,"properties":["album","albumartist","artist","director","episode","fanart","file","genre","plot","rating","season","showtitle","studio","imdbnumber","tagline","thumbnail","title","track","writer","year","streamdetails","originaltitle","cast","playcount"]}).then(function(res) {
			adapter.log.debug('GetCurrentItem: ' + JSON.stringify(res));
			res = res.item;
			for (var key in res) {
				if (typeof res[key] == 'object'){
					var obj = res[key];
					if (key === 'streamdetails'){
						for (var _key in obj) {
							if (obj[_key].length > 0){
								var _obj = obj[_key][0];
								for (var __key in _obj) {
									adapter.setState('info.'+_key+'_'+__key, {val: _obj[__key], ack: true});
									//adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
								}
							} else {
								adapter.setState('info.'+_key, {val: obj[_key], ack: true});
								//adapter.log.debug('GetPlayList: ' +_key+' = '+ JSON.stringify(obj[_key]) +' - '+typeof obj[_key] +' length = '+obj[_key].length);
							}
						}
					} else {
						for (var id in obj) { //TODO
							adapter.setState('info.'+key, {val: obj[id], ack: true});
							//adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
						}
					}
				} else {
					adapter.setState('info.'+key, {val: res[key], ack: true});
					//adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
				}
				//adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
			}
		}, function (error) {
			adapter.log.error(error);
			connection = null;
			getConnection();
		}).catch(function (error) {
			adapter.log.error(error);
			connection = null;
			getConnection();
		});	
	});
}
}
function GetNameVersion(){
if (connection){
	var batch = connection.batch();
	var GetProperties = batch.Application.GetProperties({"properties":["name","version"]});
	var GetInfoBooleans = batch.XBMC.GetInfoBooleans({"booleans":["System.Platform.Linux","System.Platform.Linux.RaspberryPi","System.Platform.Windows","System.Platform.OSX","System.Platform.IOS","System.Platform.Darwin","System.Platform.ATV2","System.Platform.Android"]});
	var GetInfoLabels = batch.XBMC.GetInfoLabels({"labels":["System.KernelVersion","System.BuildVersion"]});
	batch.send();
	Promise.all([GetProperties, GetInfoBooleans, GetInfoLabels]).then(function(res) {
		adapter.log.debug('GetNameVersion: ' + JSON.stringify(res[1]));
		if (res[2]['System.KernelVersion'] === 'Ждите…'){
			setTimeout(function() { GetNameVersion(); }, 10000);
		} else {
			adapter.setState('systeminfo.name', {val: res[0].name, ack: true});
			adapter.setState('systeminfo.version', {val: res[0].version.major+'.'+res[0].version.minor, ack: true});
			for (var key in res[1]) {
				if (res[1][key] === true){
					var system = key.split(".");
					system = system[system.length - 1];
					adapter.setState('systeminfo.system', {val: system, ack: true});
				}
			}
			adapter.setState('systeminfo.kernel', {val: res[2]['System.KernelVersion'], ack: true});
		}
	}, function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	});	
}
}
function GetChannels(){
if (connection){
	var batch = connection.batch();
	var alltv = batch.PVR.GetChannels({"channelgroupid":"alltv","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	var allradio = batch.PVR.GetChannels({"channelgroupid":"allradio","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	batch.send();
	Promise.all([alltv, allradio]).then(function(res) {
		adapter.setState('pvr.playlist_tv', {val: JSON.stringify(res[0]), ack: true});
		adapter.setState('pvr.playlist_radio', {val: JSON.stringify(res[1]), ack: true});
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
}
function GetPlayerProperties(){
if (connection){
	var batch = connection.batch();
	var Properties = batch.Player.GetProperties({"playerid":player_id,"properties":["audiostreams","canseek","currentaudiostream","currentsubtitle","partymode","playlistid","position","repeat","shuffled","speed","subtitleenabled","subtitles","time","totaltime","type"]});
	var InfoLabels = batch.XBMC.GetInfoLabels({"labels":["MusicPlayer.Codec","MusicPlayer.SampleRate","MusicPlayer.BitRate"]});
	var CurrentPlay = batch.Player.GetItem({"playerid":player_id});
	batch.send();
	Promise.all([Properties, InfoLabels, CurrentPlay]).then(function(res) {
		adapter.log.debug('Response GetPlayerProperties '+ JSON.stringify(res));
		var total = (res[0].totaltime.hours * 3600) + (res[0].totaltime.minutes * 60) + res[0].totaltime.seconds;
		var cur = (res[0].time.hours * 3600) + (res[0].time.minutes * 60) + res[0].time.seconds;
		playlist_id = res[0].playlistid;
		adapter.setState('playing_time', {val: time(res[0].time.hours, res[0].time.minutes, res[0].time.seconds), ack: true});
		adapter.setState('playing_time_total', {val: time(res[0].totaltime.hours, res[0].totaltime.minutes, res[0].totaltime.seconds), ack: true});
		adapter.setState('seek', {val: parseInt(cur * 100 / total), ack: true});
		adapter.setState('canseek', {val: res[0].canseek, ack: true});
		adapter.setState('repeat', {val: res[0].repeat, ack: true});
		adapter.setState('shuffle', {val: res[0].shuffled, ack: true});
		adapter.setState('speed', {val: res[0].speed, ack: true});
		adapter.setState('position', {val: res[0].position, ack: true});
		adapter.setState('playlistid', {val: res[0].playlistid, ack: true});
		adapter.setState('partymode', {val: res[0].partymode, ack: true});
		if (res[0].audiostreams.length > 0){
			adapter.setState('codec', {val: res[0].audiostreams[0].codec, ack: true});
			adapter.setState('bitrate', {val: res[0].audiostreams[0].bitrate, ack: true});
			adapter.setState('channels', {val: res[0].audiostreams[0].channels, ack: true});
			adapter.setState('language', {val: res[0].audiostreams[0].language, ack: true});
			adapter.setState('audiostream', {val: res[0].audiostreams[0].name, ack: true});
		} else {
			adapter.setState('channels', {val: 2, ack: true});
			adapter.setState('audiostream', {val: '', ack: true});
			adapter.setState('language', {val: '', ack: true});
			adapter.setState('codec', {val: res[1]['MusicPlayer.Codec'], ack: true});
			adapter.setState('samplerate', {val: res[1]['MusicPlayer.SampleRate'], ack: true});
			adapter.setState('bitrate', {val: res[1]['MusicPlayer.BitRate'], ack: true});
		}
		adapter.setState('type', {val: res[0].type, ack: true});
		adapter.setState('currentplay', {val: res[2].item.label, ack: true});

	}, function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	});	
}
}

function GetPlayerId(){
if (connection){
	clearTimeout(timer);
	var batch = connection.batch();
	var ActivePlayers = batch.Player.GetActivePlayers();
	var Properties = batch.Application.GetProperties({'properties':['volume','muted']});
	batch.send();
	Promise.all([ActivePlayers, Properties]).then(function(res) {
		adapter.log.debug('Response GetPlayerId '+ JSON.stringify(res));
		if (res[0][0]){
			adapter.log.debug('Active players = ' + res[0][0].playerid +'. Type = '+ res[0][0].type);
			adapter.setState('mute', {val: res[1].muted, ack: true});
			adapter.setState('volume', {val: res[1].volume, ack: true});
			player_id = res[0][0].playerid;
			player_type = res[0][0].type;
			GetPlayerProperties();
		}
		timer = setTimeout(function() { GetPlayerId(); }, 2000);
	}, function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
		getConnection();
	});
}
}

function getConnection(cb) {
	if (connection) {
		cb && cb(null, connection);
		return;
	}
	clearTimeout(timer);
	kodi(adapter.config.ip, adapter.config.port).then(function (_connection) {
		connection = _connection;
		_connection.on('error', function (err) {
			adapter.log.warn('Error: ' + err);
		}).on('close', function () {
			if (connection) {
				console.log('Connection closed');
				if (connection.socket) connection.socket.close();
				connection = null;
				setTimeout(connect, 5000);
			}
		});

		adapter.log.info('KODI connected');
		adapter.setState('info.connection', true, true);
//		GetPlayerId();
		cb && cb(null, connection);
	}, function (error) {
		//do something if error
		adapter.log.debug(error);
		// try again in 5 seconds
		adapter.setState('info.connection', false, true);
		setTimeout(getConnection, 5000, cb);
	}).catch(function(error) {
		// Handle errors 
		if (error.stack) {
			adapter.log.error(error.stack);
		} else {
			adapter.log.error(error);
		}
		adapter.setState('info.connection', false, true);
		// try again in 5 seconds
		setTimeout(getConnection, 5000, cb);
	});
}
function time(hour,min,sec){
	var time = '';
	hour = (parseInt(hour) < 10 ? '0': '') + hour;
	min = (parseInt(min) < 10 ? '0': '') + min;
	sec = (parseInt(sec) < 10 ? '0': '') + sec;
	if (parseInt(hour) === 0){
		time = min + '-' + sec;
	} else {
		time = hour + '-' + min + '-' + sec;
	}
	return time;
}

function SwitchPVR(val, callback){
	adapter.getState(adapter.namespace + '.pvr.playlist_tv', function (err, state) {
		if (state){
			var Break = {};
			val = val.toString().toLowerCase();
			var obj = JSON.parse(state.val);
			try {
				obj.channels.forEach(function(item, i, a) {
					var channel = item.label.toString().toLowerCase();
					var pos = channel.indexOf(val);
					if (pos === 0){ //TODO
						//adapter.log.debug('PVR.GetChannelsIPTV: '+item.channelid);
						callback ({"item":{"channelid":item.channelid}});
						throw Break;
					}
				});
			} catch(e){
				if (e !== Break) throw e;
			}
		}
	}); 
}

function bool(s){
	//s = s.toString();
	if (s === 1 || s === '1' || s === 'true' || s === true){
		return true;
	} else {
		return false;
	}
}
