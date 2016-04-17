/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var kodi = require('kodi-ws');
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = utils.adapter('kodi');


var connection = null;

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
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
       // adapter.log.info('ack is not set!');
		var ids = id.split(".");
		ids = ids[ids.length - 1];
		if (ids == 'mute'){
			kodi(adapter.config.ip, adapter.config.port).then(function(connection) {
				connection.Application.SetMute(state.val).then(function() {
				adapter.setState(id, {val: state.val, ack: true});
				});
			});
			
		}
    }
});

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
function send(){
	kodi(adapter.config.ip, adapter.config.port).then(function (connection) {
		adapter.log.info('KODI connected');
		
		}).catch(function(e) {
			// Handle errors 
			if(e.stack) {
				adapter.log.error(e.stack);
			} else {
				adapter.log.error(e);
			}
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

function sendCommand(param) {
	getConnection(function (err, _connection) {
		// call your command here
		_connection.Player.DoSomething().then(function (result) {
			
		}, function (error) {
			adapter.log.warn(error);
			connection = null;
		}).catch(function (error) {
			adapter.log.error(error);
			connection = null;
		})
	});
}

function main() {

	adapter.log.info('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);

	getConnection(function (err, _connection) {
		if (_connection) {
			/* Get all active players and log them */
			_connection.Player.GetActivePlayers().then(function (players) {
				adapter.log.info('Active players:' + JSON.stringify(players));
	
				/* Log the currently played item for all players */
				Promise.all(players.map(function(player) {
					_connection.Player.GetItem(player.playerid).then(function(item) {
						adapter.log.info('Currently played for player[' + player.playerid + ']:' + JSON.stringify(item));
					});
				}));
			}, function (error) {
				adapter.log.warn(error);
				connection = null;
			}).catch(error, function () {
				adapter.log.error(error);
				connection = null;
			});
		} else {
			if (err) adapter.log.error(err);
		}
	});

    adapter.setObject('testVariable', {
        type: 'state',
        common: {
            name: 'testVariable',
            type: 'boolean',
            role: 'indicator'
        },
        native: {}
    });
	adapter.setObject('mute', {
        type: 'state',
        common: {
            name: 'mute',
            type: 'boolean',
            role: 'indicator'
        },
        native: {}
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
