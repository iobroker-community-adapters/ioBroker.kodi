"use strict";

var kodi = require('kodi-ws');
var utils = require('@iobroker/adapter-core');
var adapter = utils.Adapter('kodi');
//var querystring = require('querystring');

var object = {};

var connection = null;
var player_id = null;
var player_type = null;
var channel = false;
var canseek = false;
var playlist_id = 0;
var mem = null;
var mem_pos = null;
var mem_time = null;
var timer;

//TODO Изменить виджеты Коди под новый формат
adapter.on('unload', function (callback){
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

adapter.on('objectChange', function (id, obj){
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

adapter.on('message', function (obj){
    if (typeof obj === 'object' && obj.message){
        if (obj.command === 'send'){
            adapter.log.debug('send command ' + JSON.stringify(obj));
            var _obj = obj.message;
            var param = {'title': '', 'message': '', 'image': 'info', 'displaytime': 5000};
            if (typeof _obj.message !== "object"){
                param.message = _obj.message;
            }
            param.title = _obj.title || '';
            param.image = _obj.image || 'info';
            param.displaytime = _obj.delay || 5000;
            sendCommand('GUI.ShowNotification', param);
            if (obj.callback){
                adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
            }
        }
    }
});

adapter.on('stateChange', function (id, state){
    // adapter.log.error('stateChange ' + id + ' ' + JSON.stringify(state));
    if (id == adapter.namespace + '.playing_time_total' && state.val !== mem_time){
        if (channel){
            mem_time = state.val;
            GetCurrentItem();
        }
    }
    if (id == adapter.namespace + '.currentplay' && state.val !== mem){
        mem = state.val;
        GetCurrentItem();
        setTimeout(function (){
            GetPlayList();
        }, 1000);
    }
    if (id == adapter.namespace + '.position' && state.val !== mem_pos){
        mem_pos = state.val;
        GetCurrentItem();
        setTimeout(function (){
            GetPlayList();
        }, 1000);
    }
    if (state && !state.ack){
        adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
        var param = state.val;
        var ids = id.split(".");
        var method = ids[ids.length - 2].toString();
        if (isNumeric(method)){
            method = null;
        }
        ids = ids[ids.length - 1].toString();

        ConstructorCmd(method, ids, param);
    }
});

function ConstructorCmd(method, ids, param){
    adapter.log.debug('ConstructorCmd ' + method + ' - ' + ids + ' = ' + param);
    if (method === 'input'){
        method = 'Input.' + ids;
        param = [];
    } else if (method === 'system'){
        method = 'System.' + ids;
        param = [];
    }  else {
        switch (ids) {
            case "SwitchPVR":
                method = null;
                SwitchPVR(param, function (res){
                    if(player_id){
                        sendCommand('Player.Stop', {'playerid': player_id}, function (){
                            sendCommand('Player.Open', res);
                            setTimeout(function (){
                                sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                            }, 5000);
                        });
                    } else {
                        sendCommand('Player.Open', res);
                        setTimeout(function (){
                            sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                        }, 5000);
                    }
                });
                break;
            case "ShowNotif":
                ShowNotification(param, function (res){
                    method = 'GUI.ShowNotification';
                    param = res;
                });
                break;
            case "zoom":
                if (param >= 0 && param <= 10){
                    method = 'Player.Zoom'; //
                    param = {"playerid": player_id, "zoom": parseInt(param)};
                }
                break;
            case "setsubtitle":
                method = 'Player.SetSubtitle'; //"previous", "next", "off", "on
                param = {"playerid": player_id, "subtitle": param};
                break;
            case "seek":
                if (param >= 0 && param <= 100 && canseek){
                    method = 'Player.Seek'; //int 0-100
                    param = {"playerid": player_id, "value": parseInt(param)}
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
                param = bool(param);
                if (param){
                    param = 'all';
                } else {
                    param = 'off';
                }
                param = {'playerid': player_id, "repeat": param};
                break;
            case "shuffle":
                method = 'Player.SetShuffle'; //bool
                param = {'playerid': player_id, "shuffle": bool(param)};
                break;
            case "play":
                param = bool(param);
                if (param){
                    method = 'Input.ExecuteAction';
                    param = 'play';
                } else {
                    method = 'Player.SetSpeed';
                    param = {'playerid': player_id, 'speed': 0};
                }

                break;
            case "playid":
                method = null;
                if (player_id !== 'undefined'){
                    method = 'Player.GoTo';
                } else {
                    sendCommand('Input.ExecuteAction', 'play', function (){ //TODO
                        sendCommand('Player.GoTo', {"playerid": player_id, "to": param}, function (){
                        });
                    });
                }
                param = {"playerid": player_id, "to": param};
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
            case "clear":
                method = 'Playlist.Clear';
                param = {'playlistid': playlist_id};
                adapter.setState('playlist', {val: '[]', ack: true});
                break;
            case "add":
                var type;
                method = null;
                param = param.toString();
                playlist_id = 0;
                    type = {'playlistid': playlist_id, 'item': {'file': param}};
                if (param.slice(-1) === '\\' || param.slice(-1) === '/'){
                    type = {'playlistid': playlist_id, 'item': {'directory': param}};
                }
                sendCommand('Playlist.Add', type, function (){
                    sendCommand('Player.Open', {'item': {'playlistid': playlist_id, 'position': 0}}, function (){
                        sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                    });
                });
                break;
            case "youtube":
				method = null;
				if (param){
					if (~param.indexOf('http')){
                        /*param = param.replace('&', '?').replace('#', '?');
                        param = querystring.parse(param, '?', '=');*/
						param = param.toString().split('=');
						if (param.length > 2){
							param = param[param.length - 1];
							param = {'item': {'file': 'plugin://plugin.video.youtube/?path=/root/video&action=play_all&playlist=' + param.toString()}};
						} else if (param.length === 2){
							param = param[1];
							param = {'item': {'file': 'plugin://plugin.video.youtube/?path=/root/video&action=play_video&videoid=' + param.toString()}};
						}
					} else {
						if (param.toString().length > 12){
							param = {'item': {'file': 'plugin://plugin.video.youtube/?path=/root/video&action=play_all&playlist=' + param.toString()}};
						} else {
							param = {'item': {'file': 'plugin://plugin.video.youtube/?path=/root/video&action=play_video&videoid=' + param.toString()}};
						}
					}
				}
				sendCommand('Player.Open', param, function (){
					sendCommand('Input.ExecuteAction', { "action": "select" }, function (){
						sendCommand('Player.Open', {'item': {'playlistid': 1, 'position': 0}}, function (){
								sendCommand('GUI.SetFullscreen', {"fullscreen": true});
						});
					});	
                });
                break;
            case "ActivateWindow":
                method = 'GUI.ActivateWindow';
                param = {"window": param};
                break;
            case "ExecuteAction":
                method = 'Input.ExecuteAction';
                param = { "action": param };
                break;
            case "open":
                var type2;
                method = null;
                param = param.toString();
                playlist_id = 0;
                    type2 = {'playlistid': playlist_id, 'item': {'file': param}};
                if (param.slice(-1) === '\\'){
                    type2 = {'playlistid': playlist_id, 'item': {'directory': param}};
                }
                sendCommand('Playlist.Clear', {'playlistid': playlist_id}, function (){
                    sendCommand('Playlist.Add', type2, function (){
                        sendCommand('Player.Open', {'item': {'playlistid': playlist_id, 'position': 0}}, function (){
                            sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                        });
                    });
                });
                break;
            case "speed":
                if (~[-32, -16, -8, -4, -2, -1, 0, 1, 2, 4, 8, 16, 32].indexOf(parseInt(param))){
                    method = 'Player.SetSpeed';
                    param = {'playerid': player_id, 'speed': parseInt(param)};
                } else if (param === 'increment' || param === 'decrement'){
                    method = 'Player.SetSpeed';
                    param = {'playerid': player_id, 'speed': param};
                }
                break;
            case "Directory":
                method = null;
                param = param.toString().replace("\\", "\\\\");
                GetDirectory(param);
                break;
            case "ScanVideoLibrary":
                method = 'VideoLibrary.Scan';
                break;
            case "ScanAudioLibrary":
                method = 'AudioLibrary.Scan';
                break;
            case "CleanVideoLibrary":
                method = 'VideoLibrary.Clean';
                break;
            case "CleanAudioLibrary":
                method = 'AudioLibrary.Clean';
                break;

            default:
        }
    }
    //adapter.log.error('stateChange ' + method + ' - ' + ids + ' = ' + JSON.stringify(param));
    sendCommand(method, param);
}

function sendCommand(method, param, callback){
    if (method){
        getConnection(function (err, _connection){
            if (_connection){
                adapter.log.info('sending in KODI: ' + method + ' - ' + JSON.stringify(param));
                _connection.run(method, param).then(function (result){
                    adapter.log.debug('response from KODI: ' + JSON.stringify(result));
                    if (callback) callback();
                }, function (e){
                    ErrProcessing(e);
                }).catch(function (e){
                    ErrProcessing(e);
                })
            }
        });
    } else {
        adapter.log.debug('It does not specify commands or invalid value!');
    }
}

adapter.on('ready', function (){
    main();
});

function connect(){
    adapter.setState('info.connection', false, true);
    adapter.log.debug('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);
    getConnection(function (err, _connection){
        if (_connection){
            GetNameVersion();
            GetPlayerId();
        	GetVolume();
            GetChannels();
            GetVideoLibrary();
            setTimeout(function (){
                GetSources();
            }, 10000);
            connection_emit();
        }
    });
}
function connection_emit(){
    connection.notification('Player.OnPlay', function(res) {
        adapter.setState('state', {val: 'play', ack: true});
    });
    connection.notification('Player.OnPause', function(res) {
        adapter.setState('state', {val: 'pause', ack: true});
    });
	
    connection.notification('Player.OnResume', function(res) {
        adapter.setState('state', {val: 'play', ack: true});
    });
	
    connection.notification('Player.OnStop', function(res) {
        adapter.setState('state', {val: 'stop', ack: true});
    });
    connection.notification('Input.OnInputRequested', function(res) {
        //adapter.log.error('OnInputRequested: ' + JSON.stringify(res));
        //{"data":{"title":"Строка поиска","type":"keyboard","value":""},"sender":"xbmc"}
        //adapter.setState('OnInputRequested', {val: true, ack: true});
    });
    connection.notification('Playlist.OnClear', function(res) {
        adapter.setState('playlist', {val: '[]', ack: true});
    });

}
function GetVolume(){
    if (connection){
        connection.run('Application.GetProperties', {'properties': ['volume', 'muted']
        }).then(function (res){
            adapter.log.debug('GetVolume: ' + JSON.stringify(res));
            adapter.setState('mute', {val: res.muted, ack: true});
            adapter.setState('volume', {val: res.volume, ack: true});
            connection.notification('Application.OnVolumeChanged', function(res) {
                adapter.log.debug('OnVolumeChanged: ' + JSON.stringify(res));
                adapter.setState('mute', {val: res.data.muted, ack: true});
                adapter.setState('volume', {val: res.data.volume, ack: true});
            });
        }, function (e){
            ErrProcessing(e);
        }).catch(function (e){
            ErrProcessing(e);
        })
    }
}

function main(){
    /***/
    //adapter.setState('Directory', false, true);
    adapter.subscribeStates('*');
    connect();
}

function GetSources(root){
    var obj = {
        'video':[],
        'music':[],
        'pictures':[],
        'files':[],
        'programs':[]
    };
    var count = 0;
    if (connection){
        Object.keys(obj).forEach(function(key) {
            connection.run('Files.GetSources', {"media": key}).then(function (res){
                //adapter.log.debug('GetSources: ' + JSON.stringify(res));
                if (res.limits.total > 0){
                    for (var i = 0; i < res.limits.total; i++) {
                        obj[key][i] = res.sources[i];
                        //adapter.log.debug('GetSources: ' + JSON.stringify(obj));
                    }
                }
                count++;
                if (count === 5){
                    adapter.log.debug('GetSources: ' + JSON.stringify(obj));
                    adapter.setState('Sources', {val: JSON.stringify(obj), ack: true});
                    filemanager(root, obj);
                }
            }, function (e){
                ErrProcessing(e);
            }).catch(function (e){
                ErrProcessing(e);
            })
        });
    }
}

function filemanager(root, obj){
    var browser = {};
    var files = [];
    for (var key in obj){
        if (obj.hasOwnProperty(key)){
            if (obj[key].length > 0){
                for (var i = 0; i < obj[key].length; i++) {
                    var o = {};
                    o.file = obj[key][i].file;
                    o.filetype = 'directory';
                    files.push(o);
                }
            }
        }
    }
    browser.files = files;
    adapter.setState('Directory', {val: JSON.stringify(browser), ack: true});
}
function GetDirectory(path){
    adapter.log.debug('GetDirectory path: ' + JSON.stringify(path));
    if (path !== '/'){
        if (connection){
            connection.run('Files.GetDirectory', {
                "directory":  path,
                "media":      "files",
                "properties": ["title", "thumbnail", "fanart", "rating", "genre", "artist", "track", "season", "episode", "year", "duration", "album", "showtitle", "playcount", "file", "mimetype", "size", "lastmodified", "resume"],
                "sort":       {"method": "none", "order": "ascending"}
            }).then(function (res){
                adapter.log.debug('GetDirectory: ' + JSON.stringify(res));
                adapter.setState('Directory', {val: JSON.stringify(res), ack: true});
            }, function (e){
                ErrProcessing(e);
            }).catch(function (e){
                ErrProcessing(e);
            })
        }
    } else {
        GetSources(true);
    }
}
function GetVideoLibrary(){
    if (connection){
        connection.run('VideoLibrary.GetMovies', {
            "properties": ["genre", "director", "trailer", "tagline", "plot", "plotoutline", "title", "originaltitle", "lastplayed", "runtime", "year", "playcount", "rating", "thumbnail", "file"],
            "limits":     {"start": 0},
            "sort":       {"method": "dateadded", "ignorearticle": true}
        }).then(function (res){
            adapter.log.debug('GetVideoLibrary: ' + JSON.stringify(res));
            adapter.setState('VideoLibrary', {val: JSON.stringify(res), ack: true});
        }, function (e){
            ErrProcessing(e);
        }).catch(function (e){
            ErrProcessing(e);
        })
    }
}
function GetPlayList(){
    if (connection){
        connection.run('Playlist.GetItems', {
            "playlistid": playlist_id,
            "properties": ["title", "thumbnail", "fanart", "rating", "genre", "artist", "track", "season", "episode", "year", "duration", "album", "showtitle", "playcount", "file"]/*,"limits":{"start":0,"end":750}*/
        }).then(function (res){
            var plst = res.items;
            adapter.log.debug('GetPlayList: ' + JSON.stringify(plst));
            adapter.setState('playlist', {val: JSON.stringify(plst), ack: true});
        }, function (e){
            ErrProcessing(e);
        }).catch(function (e){
            ErrProcessing(e);
        })
    }
}
function GetCurrentItem(){
    if (connection){
        adapter.getStates('info.*', function (err, obj){
            for (var state in obj) {
                if (state !== adapter.namespace + '.info.connection'){
                    adapter.setState(state, {val: '', ack: true});
                }
            }
            connection.run('Player.GetItem', {
                "playerid":   player_id,
                "properties": ["album", "albumartist", "artist", "director", "episode", "fanart", "file", "genre", "plot", "rating", "season", "showtitle", "studio", "imdbnumber", "tagline", "thumbnail", "title", "track", "writer", "year", "streamdetails", "originaltitle", "cast", "playcount"]
            }).then(function (res){
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
                                        adapter.setState('info.' + _key + '_' + __key, {val: _obj[__key], ack: true});
                                        //adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
                                    }
                                } else {
                                    adapter.setState('info.' + _key, {val: obj[_key], ack: true});
                                    //adapter.log.debug('GetPlayList: ' +_key+' = '+ JSON.stringify(obj[_key]) +' - '+typeof obj[_key] +' length = '+obj[_key].length);
                                }
                            }
                        } else {
                            for (var id in obj) { //TODO
                                adapter.setState('info.' + key, {val: obj[id], ack: true});
                                //adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
                            }
                        }
                    } else {
                        adapter.setState('info.' + key, {val: res[key], ack: true});
                        //adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
                    }
                    //adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
                }
            }, function (e){
                ErrProcessing(e);
            }).catch(function (e){
                ErrProcessing(e);
            });
        });
    }
}
function GetNameVersion(){
    if (connection){
        var batch = connection.batch();
        var GetProperties = batch.Application.GetProperties({"properties": ["name", "version"]});
        var GetInfoBooleans = batch.XBMC.GetInfoBooleans({"booleans": ["System.Platform.Linux", "System.Platform.Linux.RaspberryPi", "System.Platform.Windows", "System.Platform.OSX", "System.Platform.IOS", "System.Platform.Darwin", "System.Platform.ATV2", "System.Platform.Android"]});
        var GetInfoLabels = batch.XBMC.GetInfoLabels({"labels": ["System.KernelVersion", "System.BuildVersion"]});
        batch.send();
        Promise.all([GetProperties, GetInfoBooleans, GetInfoLabels]).then(function (res){
            adapter.log.debug('GetNameVersion: ' + JSON.stringify(res[1]));
            if (res[2]['System.KernelVersion'] === 'Ждите…' || res[2]['System.KernelVersion'] === 'Wait…' || res[2]['System.KernelVersion'] === 'Warten…'){
                setTimeout(function (){
                    GetNameVersion();
                }, 10000);
            } else {
                adapter.setState('systeminfo.name', {val: res[0].name, ack: true});
                adapter.setState('systeminfo.version', {
                    val: res[0].version.major + '.' + res[0].version.minor,
                    ack: true
                });
                for (var key in res[1]) {
                    if (res[1][key] === true){
                        var system = key.split(".");
                        system = system[system.length - 1];
                        adapter.setState('systeminfo.system', {val: system, ack: true});
                    }
                }
                adapter.setState('systeminfo.kernel', {val: res[2]['System.KernelVersion'], ack: true});
            }
        }, function (e){
            ErrProcessing(e);
        }).catch(function (e){
            ErrProcessing(e);
        });
    }
}
function GetChannels(){
    if (connection){
        var batch = connection.batch();
        var alltv = batch.PVR.GetChannels({
            "channelgroupid": "alltv",
            "properties":     ["channel", "channeltype", "hidden", "lastplayed", "locked", "thumbnail", "broadcastnow"]
        });
        var allradio = batch.PVR.GetChannels({
            "channelgroupid": "allradio",
            "properties":     ["channel", "channeltype", "hidden", "lastplayed", "locked", "thumbnail", "broadcastnow"]
        });
        batch.send();
        Promise.all([alltv, allradio]).then(function (res){
			if(res){
		   		adapter.setState('pvr.playlist_tv', {val: JSON.stringify(res[0]), ack: true});
            	adapter.setState('pvr.playlist_radio', {val: JSON.stringify(res[1]), ack: true});
			}
        }, function (e){
            ErrProcessing(e);
        }).catch(function (e){
            ErrProcessing(e);
        });
    }
}
function GetPlayerProperties(){
    if (connection && player_id !== undefined && player_id !== null){
        var batch = connection.batch();
        var Properties = batch.Player.GetProperties({
            "playerid":   player_id,
            "properties": ["audiostreams", "canseek", "currentaudiostream", "currentsubtitle", "partymode", "playlistid", "position", "repeat", "shuffled", "speed", "subtitleenabled", "subtitles", "time", "totaltime", "type"]
        });
        var InfoLabels = batch.XBMC.GetInfoLabels({"labels": ["MusicPlayer.Codec", "MusicPlayer.SampleRate", "MusicPlayer.BitRate"]});
        var CurrentPlay = batch.Player.GetItem({"playerid": player_id});
        batch.send();
        Promise.all([Properties, InfoLabels, CurrentPlay]).then(function (res){
                //TODO сохранять только изменения
                //pre = res[0];
                adapter.log.debug('Response GetPlayerProperties ' + JSON.stringify(res));
                var total = (res[0].totaltime.hours * 3600) + (res[0].totaltime.minutes * 60) + res[0].totaltime.seconds;
                var cur = (res[0].time.hours * 3600) + (res[0].time.minutes * 60) + res[0].time.seconds;
                playlist_id = res[0].playlistid;
                adapter.setState('playing_time', {
                    val: time(res[0].time.hours, res[0].time.minutes, res[0].time.seconds),
                    ack: true
                });
                adapter.setState('playing_time_total', {
                    val: time(res[0].totaltime.hours, res[0].totaltime.minutes, res[0].totaltime.seconds),
                    ack: true
                });
                canseek = res[0].canseek;
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
                if (res[2].item.type == 'channel'){
                    adapter.setState('type', {val: res[2].item.type, ack: true});
                    channel = true;
                } else {
                    adapter.setState('type', {val: res[0].type, ack: true});
                    channel = false;
                }
                if (res[2].item.label.toString().length < 2){
                    setTimeout(function (){
                        adapter.getState(adapter.namespace + '.info.file', function (err, state){
                            state = state.val.substring(state.val.lastIndexOf('/') + 1, state.val.length - 4);
                            adapter.setState('currentplay', {val: state, ack: true});
                        });
                    }, 1000);
                } else {
                    adapter.setState('currentplay', {val: res[2].item.label, ack: true});
                }

        }, function (e){
            ErrProcessing(e);
        }).catch(function (e){
            ErrProcessing(e);
        });
    }
}

function GetPlayerId(){
    clearTimeout(timer);
    if (connection){
        connection.run('Player.GetActivePlayers').then(function (res){
            adapter.log.debug('Response GetPlayerId: ' + JSON.stringify(res));
                if (res.length > 0){
                    player_id = res[0].playerid;
                    player_type = res[0].type;
                    GetPlayerProperties();
                } else {
                    player_id = null;
                    player_type = null;
                }
            timer = setTimeout(function (){
                GetPlayerId();
            }, 2000);
        }, function (e){
            ErrProcessing(e);
        }).catch(function (e){
            ErrProcessing(e);
        })
    } else {
        connect();
    }
}

function getConnection(cb){
    if (connection){
        cb && cb(null, connection);
        return;
    }
    clearTimeout(timer);
    kodi(adapter.config.ip, adapter.config.port).then(function (_connection){
        connection = _connection;
        _connection.on('error', function (err){
            adapter.log.warn('Error: ' + err);
        }).on('close', function (){
            if (connection){
                console.log('Connection closed');
                if (connection.socket) connection.socket.close();
                connection = null;
                setTimeout(connect, 5000);
            }
        });
        adapter.log.info('KODI connected');
        adapter.setState('info.connection', true, true);
		GetPlayerId();
        cb && cb(null, connection);
    }, function (error){
        adapter.log.debug(error);
        adapter.setState('info.connection', false, true);
        setTimeout(connect, 5000, cb);
    }).catch(function (error){
        if (error.stack){
            adapter.log.error(error.stack);
        } else {
            adapter.log.error(error);
        }
        adapter.setState('info.connection', false, true);
        setTimeout(connect, 5000, cb);
    });
}
function time(hour, min, sec){
    var time = '';
    hour = (parseInt(hour) < 10 ? '0' : '') + hour;
    min = (parseInt(min) < 10 ? '0' : '') + min;
    sec = (parseInt(sec) < 10 ? '0' : '') + sec;
    if (parseInt(hour) === 0){
        time = min + ':' + sec;
    } else {
        time = hour + ':' + min + ':' + sec;
    }
    return time;
}
function SwitchPVR(val, callback){
    adapter.getState(adapter.namespace + '.pvr.playlist_tv', function (err, state){
        if (state){
            var Break = {};
            val = val.toString().toLowerCase();
            var obj = JSON.parse(state.val);
            try {
                obj.channels.forEach(function (item, i, a){
                    var channel = item.label.toString().toLowerCase();
                    var pos = channel.indexOf(val);
                    if (pos === 0){ //TODO
                        //adapter.log.debug('PVR.GetChannelsIPTV: '+item.channelid);
                        callback({"item": {"channelid": item.channelid}});
                        throw Break;
                    }
                });
            } catch (e) {
                if (e !== Break) throw e;
            }
        }
    });
}
function ShowNotification(param, callback){
    var title = '';
    var message = '';
    var displaytime = 5000;
    var img = ['info', 'warning', 'error'];
    var image = 'info';
    var c = (';' + param).split(';');
    var flag = false;
    c.forEach(function (item, i, arr){
        if (!isNaN(item)){
            var num = parseInt(item);
            if (num >= 1500 && num <= 30000){
                displaytime = num;
            }
            else if (num >= 0 && num <= 2){
                image = img[num];
            }
        }
        if (isNaN(arr[i]) && isNaN(arr[i + 1]) && flag === false){
            if (arr[i] && arr[i + 1]){
                title = arr[i].toString();
                message = arr[i + 1].toString();
                flag = true;
            }
        }
    });
    if (!flag){
        c.forEach(function (item, i, arr){
            if (isNaN(arr[i]) && arr[i]){
                message = arr[i].toString();
            }
        });
    }
    callback({'title': title, 'message': message, 'image': image, 'displaytime': displaytime});
}
function bool(s){
    //s = s.toString();
    if (s === 1 || s === '1' || s === 'true' || s === true){
        return true;
    } else {
        return false;
    }
}
function ErrProcessing(error){
    adapter.log.error(error);
    connection = null;
    getConnection();
}
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
