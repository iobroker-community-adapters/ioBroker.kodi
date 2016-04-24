/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var kodi = require('kodi-ws');
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = utils.adapter('kodi');

var connection = null;
var player_id =  null;
var player_type = null;

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
		var InfoStates = 'BitRate,Codec,CurrentPlay,Name,PlayingTime,PlayingTotalTime,SampleRate,Version,GetChannelsIPTV,GetChannelsRadio';
		
    if (state && !state.ack) {
		var param = null;
	    var ids = id.split(".");
		var methods = ids[ids.length - 2];
		ids = ids[ids.length - 1];
		if (~InfoStates.indexOf(ids)){
			adapter.log.warn('States "'+ids+'" not supported changes!');
		} else {
			if (methods !== 0){
				var cmd = (methods +'.'+ ids).toString();
			}
			adapter.log.info('sending methods: '+ methods);
			
			if (methods === 'Input'){
				state.val = [];
			}
			if (methods == 'Player'){
				if(ids == 'youtube'){
					cmd = (methods +'.Open');
					state.val = {'item': {'file': 'plugin://plugin.video.youtube/?action=play_video&amp;videoid=' + state.val.toString() }};
				}
				else if(ids == 'open'){
					state.val = {'item': {'file' : state.val.toString() }};
				}
				else if (ids !== 'open' && ids !== 'youtube'){
					state.val = {'playerid': player_id};
				}
			}
			switch(ids) {
				case "ShowNotification":
					ShowNotification(state);
				  break;
				case "ActivateWindow":
					state.val = {"window": state.val };
				  break;
				case "Input_ExecuteAction":
					cmd = 'Input.ExecuteAction';
					state.val = state.val.toString();
				  break;
				case "Volume":
					cmd = 'Application.SetVolume';
				  break;
				case "Repeat":
					cmd = 'Player.SetRepeat';
					state.val = {'playerid': player_id,"repeat": state.val};
				  break;
				case "Shuffle": //off, on, all
					cmd = 'Player.SetRepeat';
					state.val = {'playerid': player_id,"repeat": state.val};
				  break;
				case "Mute":
					cmd = 'Application.SetMute';
				  break;
				case "Next":
					cmd = 'Input.ExecuteAction';
					state.val = 'skipnext';
				  break;
				case "Previous":
					cmd = 'Input.ExecuteAction';
					state.val = 'skipprevious';
				  break;
				case "PlayPause":
					cmd = 'Player.PlayPause';
					state.val = {'playerid': player_id};
				  break;
				case "Stop":
					cmd = 'Player.Stop';
					state.val = {'playerid': player_id};
				  break;

				default:
				
			}	
			sendCommand(cmd,state,param);
		
		}
	}
});

function sendCommand(cmd,state,param) {
	getConnection(function (err, _connection) {
		// call your command here
		if (param){
			state.val = param;
		}

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
	});
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
		adapter.log.warn(error);
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
function GetPlayerId(_connection){
	if (_connection) {
		// Get all active players and log them 
		_connection.Player.GetActivePlayers().then(function (players) {
			adapter.log.debug('Active players:' + JSON.stringify(players));
			// Log the currently played item for all players 
			Promise.all(players.map(function(player) {
				_connection.Player.GetItem(player.playerid).then(function(res) {
					adapter.log.debug('Currently played for player[' + player.playerid + ']:' + JSON.stringify(res));
					player_id = player.playerid;
						adapter.setState('CurrentPlay', {val: res.item.label, ack: true});
				});
			}));
			GetProperties(_connection);
			//GetPlayProperties(_connection);
		}, function (error) {
			adapter.log.warn(error);
			connection = null;
		}).catch(function (error) {
			adapter.log.error(error);
			connection = null;
		});
		setTimeout(GetPlayerId, 1000, _connection);
		GetPlayProperties(_connection);
	} else {
		if (err) adapter.log.error(err);
	}
}

function GetNameVersion(_connection){
	_connection.run('Application.GetProperties', {"properties":["name","version"]}).then(function (res) {
	adapter.log.debug('Application.GetProperties:' + JSON.stringify(res));
	adapter.setState('Name', {val: res.name, ack: true});
	adapter.setState('Version', {val: res.version.major+'.'+res.version.minor+' '+res.version.tag, ack: true});
	}, function (error) {
		adapter.log.warn(error);
		connection = null;
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
	});
}

function main() {

	adapter.log.info('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);

	getConnection(function (err, _connection) {
		GetNameVersion(_connection);
		GetPlayerId(_connection);
		GetProperties(_connection);
		GetPVRChannel(_connection);
		
	});
	var media = ['Repeat','Shuffle','Mute','Next','Previous','Stop','Volume','PlayPause'];
	media.forEach(function(item, i, arr) {
		adapter.setObject(item, {
			type: 'state',
			common: {
				"name":  item,
				"type":  "string",
				"role":  "media."+item,
				"read":  true,
				"write": true,
				"def":   null
			},
			native: {}
		});
		adapter.setState(item, {val: '', ack: true});
	});
		
	var info = ['CurrentPlay','PlayingTime','PlayingTotalTime','Name','Version','Codec','SampleRate','BitRate'];
	info.forEach(function(item, i, arr) {
		adapter.setObject(item, {
			type: 'state',
			common: {
				"name":  item,
				"type":  "string",
				"read":  true,
				"write": false
			},
			native: {}
		});
		adapter.setState(item, {val: '', ack: true});
	});
	var input = ['Back','ContextMenu','Down','Home','Info','Left','Right','Select','SendText','ShowCodec','ShowOSD','Up'];
	input.forEach(function(item, i, arr) {
		adapter.setObject('Input.'+item, {
			type: 'state',
			common: {
				name: item,
				type: 'string',
				role: 'indicator'
			},
			native: {}
		});
		adapter.setState('Input.'+item, {val: '', ack: true});
	});
	
	
	adapter.setObject('Player.YouTube', {
        type: 'state',
        common: {
            name: 'YouTube',
            type: 'string',
        },
        native: {}
    });
	adapter.setObject('Player.Open', {
        type: 'state',
        common: {
            name: 'Open',
            type: 'string',
        },
        native: {}
    });
	adapter.setObject('Player.Seek', {
        type: 'state',
        common: {
            name: 'Seek',
            type: 'string',
        },
        native: {}
    });
	
	adapter.setObject('Player.SetSpeed', { //-32,-16,-8,-4,-2,-1,0,1,2,4,8,16,32
        type: 'state',
        common: {
            name: 'SetSpeed',
            type: 'string',
        },
        native: {}
    });
	adapter.setObject('Player.SetSubtitle', { //"previous","next","off","on"
        type: 'state',
        common: {
            name: 'SetSubtitle',
            type: 'string',
        },
        native: {}
    });
	adapter.setObject('Player.Zoom', { //1-10
        type: 'state',
        common: {
            name: 'Zoom',
            type: 'string',
        },
        native: {}
    });
	adapter.setObject('GUI.ShowNotification', {//
        type: 'state',
        common: {
            name: 'ShowNotification',
            type: 'string',
        },
        native: {}
    });
	adapter.setObject('GUI.ActivateWindow', {
        type: 'state',
        common: {
            name: 'ActivateWindow',
            type: 'string',
        },
        native: {}
    });

    adapter.setObject('Player.GoTo', {
        type: 'state',
        common: {
            name: 'GoTo',
            type: 'string',
        },
        native: {}
    });

	adapter.setObject('Input_ExecuteAction', {
        type: 'state',
        common: {
            name: 'Input_ExecuteAction',
            type: 'string',
            role: 'indicator'
        },
        native: {}
    });
	
	/*var action = ['left','right','up','down','pageup','pagedown','select','highlight','parentdir','parentfolder','back','previousmenu','info','pause','stop','skipnext','skipprevious','fullscreen','aspectratio','stepforward','stepback','bigstepforward','bigstepback','osd','showsubtitles','nextsubtitle','codecinfo','nextpicture','previouspicture','zoomout','zoomin','playlist','queue','zoomnormal','zoomlevel1','zoomlevel2','zoomlevel3','zoomlevel4','zoomlevel5','zoomlevel6','zoomlevel7','zoomlevel8','zoomlevel9','nextcalibration','resetcalibration','analogmove','rotate','rotateccw','close','subtitledelayminus','subtitledelay','subtitledelayplus','audiodelayminus','audiodelay','audiodelayplus','subtitleshiftup','subtitleshiftdown','subtitlealign','audionextlanguage','verticalshiftup','verticalshiftdown','nextresolution','audiotoggledigital','number0','number1','number2','number3','number4','number5','number6','number7','number8','number9','osdleft','osdright','osdup','osddown','osdselect','osdvalueplus','osdvalueminus','smallstepback','fastforward','rewind','play','playpause','delete','copy','move','mplayerosd','hidesubmenu','screenshot','rename','togglewatched','scanitem','reloadkeymaps','volumeup','volumedown','mute','backspace','scrollup','scrolldown','analogfastforward','analogrewind','moveitemup','moveitemdown','contextmenu','shift','symbols','cursorleft','cursorright','showtime','analogseekforward','analogseekback','showpreset','presetlist','nextpreset','previouspreset','lockpreset','randompreset','increasevisrating','decreasevisrating','showvideomenu','enter','increaserating','decreaserating','togglefullscreen','nextscene','previousscene','nextletter','prevletter','jumpsms2','jumpsms3','jumpsms4','jumpsms5','jumpsms6','jumpsms7','jumpsms8','jumpsms9','filter','filterclear','filtersms2','filtersms3','filtersms4','filtersms5','filtersms6','filtersms7','filtersms8','filtersms9','firstpage','lastpage','guiprofile','red','green','yellow','blue','increasepar','decreasepar','volampup','volampdown','channelup','channeldown','previouschannelgroup','nextchannelgroup','leftclick','rightclick','middleclick','doubleclick','wheelup','wheeldown','mousedrag','mousemove','noop'];
	
	action.forEach(function(item, i, arr) {
		adapter.setObject('Input_ExecuteAction.'+item, {
			type: 'state',
			common: {
				name: item,
				type: 'string',
				role: 'indicator'
			},
			native: {}
		});								
	});
	*/	
	
    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    // examples for the checkPassword/checkGroup functions
/*    adapter.checkPassword('admin', 'iobroker', function (res) {
        console.log('check user admin pw ioboker: ' + res);
    });

    adapter.checkGroup('admin', 'admin', function (res) {
        console.log('check group user admin group admin: ' + res);
    });
*/
}
function GetPlayProperties(_connection){
	var batch = _connection.batch();
	var Properties = batch.Player.GetProperties({"playerid":player_id,"properties":["audiostreams","canseek","currentaudiostream","currentsubtitle","partymode","playlistid","position","repeat","shuffled","speed","subtitleenabled","subtitles","time","totaltime","type"]});
	var InfoLabels = batch.XBMC.GetInfoLabels({"labels":["MusicPlayer.Codec","MusicPlayer.SampleRate","MusicPlayer.BitRate"]});
	batch.send();
	Promise.all([Properties, InfoLabels]).then(function(res) {
		adapter.setState('PlayingTime', {val: time(res[0].time.hours, res[0].time.minutes, res[0].time.seconds), ack: true});
		adapter.setState('PlayingTotalTime', {val: time(res[0].totaltime.hours, res[0].totaltime.minutes, res[0].totaltime.seconds), ack: true});
		
		adapter.setState('Repeat', {val: res[0].repeat, ack: true});
		adapter.setState('shuffle', {val: res[0].shuffled, ack: true});
		adapter.setState('Speed', {val: res[0].speed, ack: true});
		adapter.setState('Position', {val: res[0].position, ack: true});
		adapter.setState('Playlistid', {val: res[0].playlistid, ack: true});
		adapter.setState('Partymode', {val: res[0].partymode, ack: true});
		
		adapter.setState('Codec', {val: res[1]['MusicPlayer.Codec'], ack: true});
		adapter.setState('SampleRate', {val: res[1]['MusicPlayer.SampleRate'], ack: true});
		adapter.setState('BitRate', {val: res[1]['MusicPlayer.BitRate'], ack: true});
	});
}
function GetPVRChannel(_connection){
	var batch = _connection.batch();
	var alltv = batch.PVR.GetChannels({"channelgroupid":"alltv","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	var allradio = batch.PVR.GetChannels({"channelgroupid":"allradio","properties":["channel","channeltype","hidden","lastplayed","locked","thumbnail","broadcastnow"]});
	batch.send();
	Promise.all([alltv, allradio]).then(function(res) {
		adapter.setState('PVR.GetChannelsIPTV', {val: JSON.stringify(res[0]), ack: true});
		adapter.setState('PVR.GetChannelsRadio', {val: JSON.stringify(res[1]), ack: true});
	});
}
function GetProperties(_connection){
	_connection.run('Application.GetProperties', {"properties":["volume","muted"]}).then(function (res) {
		adapter.log.debug('Application.GetProperties:' + JSON.stringify(res));
		adapter.setState('Mute', {val: res.muted, ack: true});
		adapter.setState('Volume', {val: res.volume, ack: true});
	}, function (error) {
		adapter.log.warn(error);
		connection = null;
	}).catch(function (error) {
		adapter.log.error(error);
		connection = null;
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
function ShowNotification(state){
	var title = '';
	var message = '';
	var displaytime = 5000;
	var img = ['info','warning','error'];
	var image = 'info';
	var c = (';'+state.val).split(';');
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
	return state.val = {'title': title, 'message': message, 'image': image, 'displaytime': displaytime};
}
