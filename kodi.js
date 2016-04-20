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
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
		var param = null;
	    var ids = id.split(".");
		var methods = ids[ids.length - 2];
		ids = ids[ids.length - 1];
		var cmd = (methods +'.'+ ids).toString();
		
		if (ids === 'ShowNotification') ShowNotification(state);
		
		if (methods == 'Player'){
			if(ids == 'Open'){
				//cmd = cmd;
				state.val = {'item': {'file' : state.val.toString() }};
			//plugin://plugin.video.youtube/?action=play_video&amp;videoid=LDZX4ooRsWs
			} else {
				state.val = {'playerid': player_id};
			}
			
		}
		if (methods == 'Input_ExecuteAction'){
			cmd = 'Input.ExecuteAction';
			state.val = ids.toString();
		}
		
			sendCommand(cmd,state,param);
    }
});
// "Player.PlayPause","params":[true]}
//"method": "Input.ExecuteAction","params": { "action": name},
function sendCommand(cmd,state,param) {
	getConnection(function (err, _connection) {
		// call your command here
		//_connection.Player.DoSomething().then(function (result) {
		if (param){
			state.val = param;
		}
		//var cm = 'Application.SetMute';
		//connection.run('Application.SetMute', true);
		//connection.Application.SetMute(true);
		//_connection.run('Player.GetActivePlayers', {"playerid":0,"to":"next"}).then(function(result) {

		adapter.log.info('sending in KODI: '+ cmd +' - '+JSON.stringify(state));
		_connection.run(cmd, state.val).then(function(result) {
				
				adapter.log.debug('response from KODI: '+JSON.stringify(result));
				adapter.setState(id, {val: JSON.stringify(result), ack: true});
			
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
		/* Get all active players and log them */
		_connection.Player.GetActivePlayers().then(function (players) {
			adapter.log.debug('Active players:' + JSON.stringify(players));
			/* Log the currently played item for all players */
			Promise.all(players.map(function(player) {
				_connection.Player.GetItem(player.playerid).then(function(res) {
					adapter.log.debug('Currently played for player[' + player.playerid + ']:' + JSON.stringify(res));
					player_id = player.playerid;
					//if (item.label){
						adapter.setState('CurrentPlay', {val: res.item.label, ack: true});
					//} else {
					//	adapter.setState('CurrentPlay', {val: '', ack: true});
					//}
				});
			}));
		}, function (error) {
			adapter.log.warn(error);
			connection = null;
		}).catch(function (error) {
			adapter.log.error(error);
			connection = null;
		});
		setTimeout(GetPlayerId, 5000, _connection);
	} else {
		if (err) adapter.log.error(err);
	}
	
}
function main() {

	adapter.log.info('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);

	getConnection(function (err, _connection) {
		GetPlayerId(_connection);
	});
	
	adapter.setObject('Player.Open', {
        type: 'state',
        common: {
            name: 'Open',
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
	adapter.setObject('Player.PlayPause', {
        type: 'state',
        common: {
            name: 'PlayPause',
            type: 'boolean',
            role: 'indicator'
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
	adapter.setObject('Application.SetMute', {
        type: 'state',
        common: {
            name: 'SetMute',
            type: 'boolean',
            role: 'indicator'
        },
        native: {}
    });
	adapter.setObject('CurrentPlay', {
        type: 'state',
        common: {
            name: 'CurrentPlay',
            type: 'string',
            role: 'indicator'
        },
        native: {}
    });
	var action = ['left','right','up','down','pageup','pagedown','select','highlight','parentdir','parentfolder','back','previousmenu','info','pause','stop','skipnext','skipprevious','fullscreen','aspectratio','stepforward','stepback','bigstepforward','bigstepback','osd','showsubtitles','nextsubtitle','codecinfo','nextpicture','previouspicture','zoomout','zoomin','playlist','queue','zoomnormal','zoomlevel1','zoomlevel2','zoomlevel3','zoomlevel4','zoomlevel5','zoomlevel6','zoomlevel7','zoomlevel8','zoomlevel9','nextcalibration','resetcalibration','analogmove','rotate','rotateccw','close','subtitledelayminus','subtitledelay','subtitledelayplus','audiodelayminus','audiodelay','audiodelayplus','subtitleshiftup','subtitleshiftdown','subtitlealign','audionextlanguage','verticalshiftup','verticalshiftdown','nextresolution','audiotoggledigital','number0','number1','number2','number3','number4','number5','number6','number7','number8','number9','osdleft','osdright','osdup','osddown','osdselect','osdvalueplus','osdvalueminus','smallstepback','fastforward','rewind','play','playpause','delete','copy','move','mplayerosd','hidesubmenu','screenshot','rename','togglewatched','scanitem','reloadkeymaps','volumeup','volumedown','mute','backspace','scrollup','scrolldown','analogfastforward','analogrewind','moveitemup','moveitemdown','contextmenu','shift','symbols','cursorleft','cursorright','showtime','analogseekforward','analogseekback','showpreset','presetlist','nextpreset','previouspreset','lockpreset','randompreset','increasevisrating','decreasevisrating','showvideomenu','enter','increaserating','decreaserating','togglefullscreen','nextscene','previousscene','nextletter','prevletter','jumpsms2','jumpsms3','jumpsms4','jumpsms5','jumpsms6','jumpsms7','jumpsms8','jumpsms9','filter','filterclear','filtersms2','filtersms3','filtersms4','filtersms5','filtersms6','filtersms7','filtersms8','filtersms9','firstpage','lastpage','guiprofile','red','green','yellow','blue','increasepar','decreasepar','volampup','volampdown','channelup','channeldown','previouschannelgroup','nextchannelgroup','leftclick','rightclick','middleclick','doubleclick','wheelup','wheeldown','mousedrag','mousemove','noop'];
	
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
		
	
	
    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');


    /**
     *   setState examples
     *   you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
     */

    // the variable testVariable is set to true as command (ack=false)
//    adapter.setState('testVariable', true);

    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
//   adapter.setState('testVariable', {val: true, ack: true});

    // same thing, but the state is deleted after 30s (getState will return null afterwards)
//    adapter.setState('testVariable', {val: true, ack: true, expire: 30});



    // examples for the checkPassword/checkGroup functions
/*    adapter.checkPassword('admin', 'iobroker', function (res) {
        console.log('check user admin pw ioboker: ' + res);
    });

    adapter.checkGroup('admin', 'admin', function (res) {
        console.log('check group user admin group admin: ' + res);
    });
*/
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
