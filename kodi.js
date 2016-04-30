/* jshint -W097 */// jshint strict:false
/*jslint node: true */
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
		// adapter.log.error('stateChange ' + id + ' ' + JSON.stringify(state));
	if (id == 'kodi.0.playing_time_total' && state.val !== mem){
		mem = state.val;
		GetPlayList();
	}
    if (state && !state.ack) {
		adapter.log.error('stateChange ' + id + ' ' + JSON.stringify(state));
		var param = state.val.toString();
		var ids = id.split(".");
		var method = ids[ids.length - 2].toString();
		if (method === '0'){ //
			method = null;
		}
		ids = ids[ids.length - 1].toString();
		
		ConstructorCmd(method, ids, param);
	}
});
function ConstructorCmd(method, ids, param){
	//adapter.log.error('stateChange ' + method + ' - ' + ids + ' = ' + param);
		if (method === 'input'){
			param = [];
		}
		switch(ids) {
		  case "shownotif":
				ShowNotification(param, function(res){
					method = 'GUI.ShowNotification';
					param = res;
				});
			break;
		  case "123":
				param = [];
			break;
		
		default:
		
		}
	adapter.log.error('stateChange ' + method + ' - ' + ids + ' = ' + JSON.stringify(param));
	sendCommand(method, param);
}


function sendCommand(method, param) {
	if (method){
		getConnection(function (err, _connection) {
			if (_connection){
			// call your command here
				adapter.log.info('sending in KODI: '+ method +' - '+JSON.stringify(param));
				_connection.run(method, param).then(function(result) {
						adapter.log.debug('response from KODI: '+JSON.stringify(result));
					//adapter.setState(id, {val: JSON.stringify(result), ack: true});
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
		adapter.log.warn('Not set command!');
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
		}
	});
	
    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
	
	//SetSpeed', { //-32,-16,-8,-4,-2,-1,0,1,2,4,8,16,32
	//SetSubtitle', { //"previous","next","off","on"
	var input = ['back','contextmenu','down','home','info','left','right','select','sendtext','showcodec','showOSD','up',];
	var media = ['setsubtitle','zoom','ExecuteAction','GoTo','ActivateWindow','shownotif','seek','open','youtube','switchPVR','next','previous','stop','playpause'];
	
	input.forEach(function(item, i, arr) {
		adapter.setObject('input.'+item, {
			type: 'state',
			common: {
				name: item,
				type: 'boolean',
				role: 'button'
			},
			native: {}
		});
		adapter.setState('input.'+item, {val: false, ack: true});
	});
	media.forEach(function(item, i, arr) {
		adapter.setObject(item, {
			type: 'state',
			common: {
				name: item,
				type: 'string',
				role: 'media'
			},
			native: {}
		});
		adapter.setState(item, {val: '', ack: true});
	});
}

function GetPlayList(){  
adapter.getStates('info.*',function (err, obj) {
	for (var state in obj) {
		adapter.setState(state, {val: '', ack: true});
	}	
	var batch = connection.batch();	//*********** playlistid
	var GetItem = batch.Player.GetItem({"playerid":player_id,"properties":["album","albumartist","artist","director","episode","fanart","file","genre","plot","rating","season","showtitle","studio","imdbnumber","tagline","thumbnail","title","track","writer","year","streamdetails","originaltitle","cast","playcount"]});
	var GetItems = batch.Playlist.GetItems({"playlistid":playlist_id,"properties":["title","thumbnail","fanart","rating","genre","artist","track","season","episode","year","duration","album","showtitle","playcount","file"],"limits":{"start":0,"end":750}});
	batch.send();
	Promise.all([GetItem, GetItems]).then(function(res) {
		adapter.log.debug('GetPlayList: ' + JSON.stringify(res));
		res[0] = res[0].item;
		for (var key in res[0]) {
			if (typeof res[0][key] == 'object'){
				var obj = res[0][key];
				if (key === 'streamdetails'){
					for (var _key in obj) {
						if (obj[_key].length > 0){
							var _obj = obj[_key][0];
							for (var __key in _obj) {
								setObject(_key+'_'+__key, _obj[__key], 'info');
								//adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
							}
						} else {
							setObject(_key, obj[_key], 'info');
							//adapter.log.debug('GetPlayList: ' +_key+' = '+ JSON.stringify(obj[_key]) +' - '+typeof obj[_key] +' length = '+obj[_key].length);
						}
					}
				} else {
					for (var id in obj) { //TODO
						setObject(key, obj[id], 'info');
						//adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
					}
				}
			} else {
				setObject(key, res[0][key], 'info');
				//adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
			}
			//adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
		}
		setObject('playlist', JSON.stringify(res[1]));
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

function setObject(name, val, type){
	if (type){
		name = type +'.'+ name;
	}
	object = {
		type: 'state',
		common: {
			name: name,
			role: 'media',
			type: typeof val
		},
		native: {}
	};
	adapter.setObject(name, object, function (err, obj) {
		adapter.setState(name, {val: val, ack: true});
	});
}
function GetNameVersion(){
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
			setObject('name', res[0].name, 'systeminfo');
			setObject('version', res[0].version.major+'.'+res[0].version.minor, 'systeminfo');
			for (var key in res[1]) {
				if (res[1][key] === true){
					var system = key.split(".");
					system = system[system.length - 1];
					setObject('system', system, 'systeminfo');
				}
			}
			setObject('kernel', res[2]['System.KernelVersion'], 'systeminfo');
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
function GetChannels(){
	var batch = connection.batch();
	var alltv = batch.PVR.GetChannels({"channelgroupid":"alltv","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	var allradio = batch.PVR.GetChannels({"channelgroupid":"allradio","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	batch.send();
	Promise.all([alltv, allradio]).then(function(res) {
		setObject('playlist_tv', JSON.stringify(res[0]), 'pvr');
		setObject('playlist_radio', JSON.stringify(res[1]), 'pvr');
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
		setObject('playing_time', time(res[0].time.hours, res[0].time.minutes, res[0].time.seconds));
		setObject('playing_time_total', time(res[0].totaltime.hours, res[0].totaltime.minutes, res[0].totaltime.seconds));
		setObject('canseek', res[0].canseek);
		setObject('repeat', res[0].repeat);
		setObject('shuffle', res[0].shuffled);
		setObject('speed', res[0].speed);
		setObject('position', res[0].position);
		setObject('playlistid', res[0].playlistid);
		setObject('partymode', res[0].partymode);
		if (res[0].audiostreams.length > 0){
			setObject('codec', res[0].audiostreams[0].codec);
			setObject('bitrate', res[0].audiostreams[0].bitrate);
			setObject('channels', res[0].audiostreams[0].channels);
			setObject('language', res[0].audiostreams[0].language);
			setObject('audiostream', res[0].audiostreams[0].name);
		} else {
			setObject('codec', res[1]['MusicPlayer.Codec']);
			setObject('samplerate', res[1]['MusicPlayer.SampleRate']);
			setObject('bitrate', res[1]['MusicPlayer.BitRate']);
		}
		setObject('type', res[0].type);

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

function GetPlayerId(){
	var batch = connection.batch();
	var ActivePlayers = batch.Player.GetActivePlayers();
	var Properties = batch.Application.GetProperties({'properties':['volume','muted']});
	batch.send();
	Promise.all([ActivePlayers, Properties]).then(function(res) {
		adapter.log.debug('Response GetPlayerId '+ JSON.stringify(res));
		if (res[0][0]){
			adapter.log.debug('Active players = ' + res[0][0].playerid +'. Type = '+ res[0][0].type);
			setObject('mute', res[1].muted);
			setObject('volume', res[1].volume);
			player_id = res[0][0].playerid;
			player_type = res[0][0].type;
			GetPlayerProperties();
		}
		setTimeout(function() { GetPlayerId(); }, 2000);
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