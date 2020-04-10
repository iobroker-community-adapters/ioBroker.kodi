"use strict";
const utils = require('@iobroker/adapter-core');
const kodi = require('kodi-ws');
let adapter, object = {}, connection = null, player_id = null, player_type = null, channel = false, canseek = false, playlist_id = 0, mem = null,
    mem_pos = null, mem_time = null, timer, reconnectTimer, getPlayListTimer, SwitchPVRTimer, GetSourcesTimer, GetNameVersionTimer, infoFileTimer;

function startAdapter(options){
    return adapter = utils.adapter(Object.assign({}, options, {
        systemConfig: true,
        name:         'kodi',
        ready:        main,
        unload:       (callback) => {
            try {
                adapter.log.debug('cleaned everything up...');
                clearTimeout(timer);
                clearTimeout(reconnectTimer);
                clearTimeout(getPlayListTimer);
                clearTimeout(SwitchPVRTimer);
                clearTimeout(GetSourcesTimer);
                clearTimeout(GetNameVersionTimer);
                clearTimeout(infoFileTimer);
                callback();
            } catch (e) {
                callback();
            }
        },
        stateChange:  (id, state) => {
            if (id && state && !state.ack){
                adapter.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                if (id === 'playing_time_total' && state.val !== mem_time){
                    if (channel){
                        mem_time = state.val;
                        GetCurrentItem();
                    }
                }
                if (id === 'currentplay' && state.val !== mem){
                    mem = state.val;
                    GetCurrentItem();
                    getPlayListTimer = setTimeout(() => {
                        GetPlayList();
                    }, 1000);
                }
                if (id === 'position' && state.val !== mem_pos){
                    mem_pos = state.val;
                    GetCurrentItem();
                    getPlayListTimer = setTimeout(() => {
                        GetPlayList();
                    }, 1000);
                }
                if (state && !state.ack){
                    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
                    let param = state.val;
                    let ids = id.split(".");
                    let method = ids[ids.length - 2].toString();
                    if (isNumeric(method)){
                        method = null;
                    }
                    ids = ids[ids.length - 1].toString();

                    ConstructorCmd(method, ids, param);
                }
            }
        },
        message:      (obj) => {
            if (typeof obj === 'object' && obj.command){
                adapter.log.debug(`message ******* ${JSON.stringify(obj)}`);
                if (obj.command === 'send'){
                    adapter.log.debug('send command ' + JSON.stringify(obj));
                    let _obj = obj.message;
                    let param = {'title': '', 'message': '', 'image': 'info', 'displaytime': 5000};
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
            } else {
                adapter.log.debug(`message x ${obj.command}`);
            }
        }
    }));
}

function ConstructorCmd(method, ids, param){
    adapter.log.debug('ConstructorCmd ' + method + ' - ' + ids + ' = ' + param);
    if (method === 'input'){
        method = 'Input.' + ids;
        param = [];
    } else if (method === 'system'){
        method = 'System.' + ids;
        param = [];
    } else {
        switch (ids) {
            case "SwitchPVR":
                method = null;
                SwitchPVR(param, (res) => {
                    if (player_id){
                        sendCommand('Player.Stop', {'playerid': player_id}, () => {
                            sendCommand('Player.Open', res);
                            SwitchPVRTimer = setTimeout(() => {
                                sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                            }, 5000);
                        });
                    } else {
                        sendCommand('Player.Open', res);
                        SwitchPVRTimer = setTimeout(() => {
                            sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                        }, 5000);
                    }
                });
                break;
            case "SwitchPVRbyID":
                method = null;
                if (player_id){
                    sendCommand('Player.Stop', {'playerid': player_id}, () => {
                        sendCommand('Player.Open', {"item": {"channelid": param}});
                        SwitchPVRTimer = setTimeout(() => {
                            sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                        }, 5000);
                    });
                } else {
                    sendCommand('Player.Open', {"item": {"channelid": param}});
                    SwitchPVRTimer = setTimeout(() => {
                        sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                    }, 5000);
                }
                break;
            case "ShowNotif":
                ShowNotification(param, (res) => {
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
                param = !!param;
                break;
            case "repeat":
                method = 'Player.SetRepeat'; //off, on, all
                param = !!param;
                if (param){
                    param = 'all';
                } else {
                    param = 'off';
                }
                param = {'playerid': player_id, "repeat": param};
                break;
            case "shuffle":
                method = 'Player.SetShuffle'; //bool
                param = {'playerid': player_id, "shuffle": !!param};
                break;
            case "play":
                param = !!param;
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
                    sendCommand('Input.ExecuteAction', 'play', () => { //TODO
                        sendCommand('Player.GoTo', {"playerid": player_id, "to": param}, () => {
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
                setState('playlist', '[]');
                break;
            case "add":
                let type;
                method = null;
                param = param.toString();
                playlist_id = 0;
                type = {'playlistid': playlist_id, 'item': {'file': param}};
                if (param.slice(-1) === '\\' || param.slice(-1) === '/' || param.slice(-4) === '.xsp'){
                    type = {'playlistid': playlist_id, 'item': {'directory': param}};
                }
                sendCommand('Playlist.Add', type, () => {
                    sendCommand('Player.Open', {'item': {'playlistid': playlist_id, 'position': 0}}, () => {
                        sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                    });
                });
                break;
            case "youtube":
                method = null;
                if (param){
                    if (~param.indexOf('http')){
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
                sendCommand('Player.Open', param, () => {
                    sendCommand('Input.ExecuteAction', {"action": "select"}, () => {
                        sendCommand('Player.Open', {'item': {'playlistid': 1, 'position': 0}}, () => {
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
                param = {"action": param};
                break;
            case "open":
                let type2;
                method = null;
                param = param.toString();
                playlist_id = 0;
                type2 = {'playlistid': playlist_id, 'item': {'file': param}};
                if (param.slice(-1) === '\\'){
                    type2 = {'playlistid': playlist_id, 'item': {'directory': param}};
                }
                sendCommand('Playlist.Clear', {'playlistid': playlist_id}, () => {
                    sendCommand('Playlist.Add', type2, () => {
                        sendCommand('Player.Open', {'item': {'playlistid': playlist_id, 'position': 0}}, () => {
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
    sendCommand(method, param);
}

function sendCommand(method, param, callback){
    if (method){
        getConnection((err, _connection) => {
            if (_connection){
                adapter.log.info('sending in KODI: ' + method + ' - ' + JSON.stringify(param));
                _connection.run(method, param).then((result) => {
                    adapter.log.debug('response from KODI: ' + JSON.stringify(result));
                    if (callback) callback();
                }, (e) => {
                    ErrProcessing(e);
                }).catch((e) => {
                    ErrProcessing(e);
                })
            }
        });
    } else {
        adapter.log.debug('It does not specify commands or invalid value!');
    }
}

function connection_emit(){
    connection.notification('Application.OnVolumeChanged', (res) => {
        adapter.log.debug('notification: Application.OnVolumeChanged ' + JSON.stringify(res));
        setState('volume', res.volume);
        setState('mute', res.muted);
    });
    connection.notification('Player.OnResume', (res) => {
        adapter.log.debug('notification: Player.OnResume ' + JSON.stringify(res));
        setState('state', 'play');
    });
    connection.notification('Player.OnPlay', (res) => {
        adapter.log.debug('notification: Player.OnPlay ' + JSON.stringify(res));
        setState('state', 'play');
    });
    connection.notification('Player.OnPause', (res) => {
        adapter.log.debug('notification: Player.OnPause ' + JSON.stringify(res));
        setState('state', 'pause');
    });
    connection.notification('Player.OnStop', (res) => {
        adapter.log.debug('notification: Player.OnStop ' + JSON.stringify(res));
        setState('state', 'stop');
    });
    connection.notification('Input.OnInputRequested', (res) => {
        adapter.log.debug('notification: Input.OnInputRequested ' + JSON.stringify(res));
        //{"data":{"title":"Строка поиска","type":"keyboard","value":""},"sender":"xbmc"}
        //setState('OnInputRequested', true);
    });
    connection.notification('Playlist.OnClear', (res) => {
        adapter.log.debug('notification: Playlist.OnClear ' + JSON.stringify(res));
        setState('playlist', '[]');
    });
}

function main(){
    adapter.subscribeStates('*');
    connect();
}

function GetSources(root){
    let obj = {
        'video':    [],
        'music':    [],
        'pictures': [],
        'files':    [],
        'programs': []
    };
    let count = 0;
    if (connection){
        Object.keys(obj).forEach((key) => {
            connection.run('Files.GetSources', {"media": key}).then((res) => {
                if (res.limits.total > 0){
                    for (let i = 0; i < res.limits.total; i++) {
                        obj[key][i] = res.sources[i];
                    }
                }
                count++;
                if (count === 5){
                    adapter.log.debug('GetSources: ' + JSON.stringify(obj));
                    adapter.setState('Sources', JSON.stringify(obj), true);
                    filemanager(root, obj);
                }
            }, (e) => {
                ErrProcessing(e);
            }).catch((e) => {
                ErrProcessing(e);
            })
        });
    }
}

function filemanager(root, obj){
    let browser = {};
    let files = [];
    for (let key in obj) {
        if (!Object.hasOwnProperty.call(obj, key)) continue;
        if (obj[key].length > 0){
            for (let i = 0; i < obj[key].length; i++) {
                let o = {};
                o.file = obj[key][i].file;
                o.filetype = 'directory';
                files.push(o);
            }
        }
    }
    browser.files = files;
    adapter.setState('Directory', JSON.stringify(browser), true);
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
            }).then((res) => {
                adapter.log.debug('GetDirectory: ' + JSON.stringify(res));
                adapter.setState('Directory', JSON.stringify(res), true);
            }, (e) => {
                ErrProcessing(e);
            }).catch((e) => {
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
        }).then((res) => {
            adapter.log.debug('GetVideoLibrary: ' + JSON.stringify(res));
            adapter.setState('VideoLibrary', JSON.stringify(res), true);
        }, (e) => {
            ErrProcessing(e);
        }).catch((e) => {
            ErrProcessing(e);
        })
    }
}

function GetPlayList(){
    if (connection){
        connection.run('Playlist.GetItems', {
            "playlistid": playlist_id,
            "properties": ["title", "thumbnail", "fanart", "rating", "genre", "artist", "track", "season", "episode", "year", "duration", "album", "showtitle", "playcount", "file"]/*,"limits":{"start":0,"end":750}*/
        }).then((res) => {
            let plst = res.items;
            adapter.log.debug('GetPlayList: ' + JSON.stringify(plst));
            adapter.setState('playlist', JSON.stringify(plst), true);
        }, (e) => {
            ErrProcessing(e);
        }).catch((e) => {
            ErrProcessing(e);
        })
    }
}

function GetCurrentItem(){
    if (connection){
        adapter.getStates('info.*', (err, obj) => {
            for (let state in obj) {
                if (!Object.hasOwnProperty.call(obj, state)) continue;
                if (state !== adapter.namespace + '.info.connection'){
                    setState(state, '');
                }
            }
            connection.run('Player.GetItem', {
                "playerid":   player_id,
                "properties": ["album", "albumartist", "artist", "director", "episode", "fanart", "file", "genre", "plot", "rating", "season", "showtitle", "studio", "imdbnumber", "tagline", "thumbnail", "title", "track", "writer", "year", "streamdetails", "originaltitle", "cast", "playcount"]
            }).then((res) => {
                adapter.log.debug('GetCurrentItem: ' + JSON.stringify(res));
                res = res.item;
                for (let key in res) {
                    if (!Object.hasOwnProperty.call(res, key)) continue;
                    if (typeof res[key] == 'object'){
                        let obj = res[key];
                        if (key === 'streamdetails'){
                            for (let _key in obj) {
                                if (!Object.hasOwnProperty.call(obj, _key)) continue;
                                if (obj[_key].length > 0){
                                    let _obj = obj[_key][0];
                                    for (let __key in _obj) {
                                        if (!Object.hasOwnProperty.call(_obj, __key)) continue;
                                        setState('info.' + _key + '_' + __key, _obj[__key]);
                                        //adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
                                    }
                                } else {
                                    setState('info.' + _key, obj[_key]);
                                    //adapter.log.debug('GetPlayList: ' +_key+' = '+ JSON.stringify(obj[_key]) +' - '+typeof obj[_key] +' length = '+obj[_key].length);
                                }
                            }
                        } else {
                            for (let id in obj) { //TODO
                                if (!Object.hasOwnProperty.call(obj, id)) continue;
                                setState('info.' + key, obj[id]);
                                //adapter.log.debug('GetPlayList: ' +_key+'_'+__key+' = '+ JSON.stringify(_obj[__key]) +' - '+typeof _obj[__key]);
                            }
                        }
                    } else {
                        setState('info.' + key, res[key]);
                        //adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
                    }
                    //adapter.log.debug('GetPlayList: ' +key+' = '+ JSON.stringify(res[0][key]) +' - '+typeof res[0][key]);
                }
            }, (e) => {
                ErrProcessing(e);
            }).catch((e) => {
                ErrProcessing(e);
            });
        });
    }
}

function GetNameVersion(){
    if (connection){
        let batch = connection.batch();
        let GetProperties = batch.Application.GetProperties({"properties": ["name", "version"]});
        let GetInfoBooleans = batch.XBMC.GetInfoBooleans({"booleans": ["System.Platform.Linux", "System.Platform.Linux.RaspberryPi", "System.Platform.Windows", "System.Platform.OSX", "System.Platform.IOS", "System.Platform.Darwin", "System.Platform.ATV2", "System.Platform.Android"]});
        let GetInfoLabels = batch.XBMC.GetInfoLabels({"labels": ["System.KernelVersion", "System.BuildVersion"]});
        batch.send();
        Promise.all([GetProperties, GetInfoBooleans, GetInfoLabels]).then((res) => {
            adapter.log.debug('GetNameVersion: ' + JSON.stringify(res[1]));
            if (res[2]['System.KernelVersion'] === 'Ждите…' || res[2]['System.KernelVersion'] === 'Wait…' || res[2]['System.KernelVersion'] === 'Warten…'){
                GetNameVersionTimer = setTimeout(() => {
                    GetNameVersion();
                }, 10000);
            } else {
                setState('systeminfo.name', res[0].name);
                setState('systeminfo.version', res[0].version.major + '.' + res[0].version.minor);
                for (let key in res[1]) {
                    if (!Object.hasOwnProperty.call(res[1], key)) continue;
                    if (res[1][key] === true){
                        let system = key.split(".");
                        system = system[system.length - 1];
                        setState('systeminfo.system', system);
                    }
                }
                setState('systeminfo.kernel', res[2]['System.KernelVersion']);
            }
        }, (e) => {
            ErrProcessing(e);
        }).catch((e) => {
            ErrProcessing(e);
        });
    }
}

function GetChannels(){
    if (connection){
        let batch = connection.batch();
        let alltv = batch.PVR.GetChannels({
            "channelgroupid": "alltv",
            "properties":     ["channel", "channeltype", "hidden", "lastplayed", "locked", "thumbnail", "broadcastnow"]
        });
        let allradio = batch.PVR.GetChannels({
            "channelgroupid": "allradio",
            "properties":     ["channel", "channeltype", "hidden", "lastplayed", "locked", "thumbnail", "broadcastnow"]
        });
        batch.send();
        Promise.all([alltv, allradio]).then((res) => {
            if (res){
                adapter.setState('pvr.playlist_tv', JSON.stringify(res[0]), true);
                adapter.setState('pvr.playlist_radio', JSON.stringify(res[1]), true);
            }
        }, (e) => {
            ErrProcessing(e);
        }).catch((e) => {
            ErrProcessing(e);
        });
    }
}

function setState(name, val, cb){
    adapter.getState(name, (err, state) => {
        if (!state){
            adapter.setState(name, val, true);
        } else if (state.val === val){
            adapter.log.debug('setState ' + name + ' { oldVal: ' + state.val + ' = newVal: ' + val + ' }');
        } else if (state.val !== val){
            adapter.setState(name, val, true);
            adapter.log.debug('setState ' + name + ' { oldVal: ' + state.val + ' != newVal: ' + val + ' }');
        }
        cb && cb();
    });
}

function GetPlayerProperties(){
    if (connection && player_id !== undefined && player_id !== null){
        let batch = connection.batch();
        let Properties = batch.Player.GetProperties({
            "playerid":   player_id,
            "properties": ["audiostreams", "canseek", "currentaudiostream", "currentsubtitle", "partymode", "playlistid", "position", "repeat", "shuffled", "speed", "subtitleenabled", "subtitles", "time", "totaltime", "type"]
        });
        let InfoLabels = batch.XBMC.GetInfoLabels({"labels": ["MusicPlayer.Codec", "MusicPlayer.SampleRate", "MusicPlayer.BitRate"]});
        let CurrentPlay = batch.Player.GetItem({"playerid": player_id});
        batch.send();
        Promise.all([Properties, InfoLabels, CurrentPlay]).then((res) => {
            adapter.log.debug('Response GetPlayerProperties ' + JSON.stringify(res));
            let total = (res[0].totaltime.hours * 3600) + (res[0].totaltime.minutes * 60) + res[0].totaltime.seconds;
            let cur = (res[0].time.hours * 3600) + (res[0].time.minutes * 60) + res[0].time.seconds;
            playlist_id = res[0].playlistid;
            canseek = res[0].canseek;
            const seek = parseInt(cur * 100 / total);
            setState('playing_time', time(res[0].time.hours, res[0].time.minutes, res[0].time.seconds));
            setState('playing_time_total', time(res[0].totaltime.hours, res[0].totaltime.minutes, res[0].totaltime.seconds));
            setState('seek', isNaN(seek) ? 0 :seek);
            setState('canseek', res[0].canseek);
            setState('repeat', res[0].repeat);
            setState('shuffle', res[0].shuffled);
            setState('speed', res[0].speed);
            setState('position', res[0].position);
            setState('playlistid', res[0].playlistid);
            setState('partymode', res[0].partymode);
            if (res[0].audiostreams.length > 0){
                setState('codec', res[0].audiostreams[0].codec);
                setState('bitrate', res[0].audiostreams[0].bitrate);
                setState('channels', res[0].audiostreams[0].channels);
                setState('language', res[0].audiostreams[0].language);
                setState('audiostream', res[0].audiostreams[0].name);
            } else {
                setState('channels', 2);
                setState('audiostream', '');
                setState('language', '');
                setState('codec', res[1]['MusicPlayer.Codec']);
                setState('samplerate', res[1]['MusicPlayer.SampleRate']);
                setState('bitrate', res[1]['MusicPlayer.BitRate']);
            }
            if (res[2].item.type === 'channel'){
                setState('type', res[2].item.type);
                channel = true;
            } else {
                setState('type', res[0].type);
                channel = false;
            }
            if (res[2].item.label.toString().length < 2){
                infoFileTimer = setTimeout(() => {
                    adapter.getState(adapter.namespace + '.info.file', (err, state) => {
                        state = state.val.substring(state.val.lastIndexOf('/') + 1, state.val.length - 4);
                        setState('currentplay', state);
                    });
                }, 1000);
            } else {
                setState('currentplay', res[2].item.label);
            }

        }, (e) => {
            ErrProcessing(e);
        }).catch((e) => {
            ErrProcessing(e);
        });
    }
}

function GetPlayerId(){
    clearTimeout(timer);
    if (connection){
        connection.run('Player.GetActivePlayers').then((res) => {
            adapter.log.debug('Response GetPlayerId: ' + JSON.stringify(res));
            if (res.length > 0){
                player_id = res[0].playerid;
                player_type = res[0].type;
                GetPlayerProperties();
            } else {
                player_id = null;
                player_type = null;
            }
            timer = setTimeout(() => {
                GetPlayerId();
            }, 2000);
        }, (e) => {
            ErrProcessing(e);
        }).catch((e) => {
            ErrProcessing(e);
        })
    } else {
        connect();
    }
}

function connect(){
    adapter.setState('info.connection', false, true);
    adapter.log.debug('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);
    getConnection((err, _connection) => {
        if (_connection){
            GetNameVersion();
            GetPlayerId();
            GetVolume();
            GetChannels();
            GetVideoLibrary();
            GetSourcesTimer = setTimeout(() => {
                GetSources();
            }, 10000);
            connection_emit();
        }
    });
}

function getConnection(cb){
    if (connection){
        cb && cb(null, connection);
        return;
    }
    clearTimeout(timer);
    kodi(adapter.config.ip, adapter.config.port).then((_connection) => {
        connection = _connection;
        _connection.on('error', (err) => {
            adapter.log.debug('Error: ' + err);
        }).on('close', () => {
            if (connection){
                console.log('Connection closed');
                if (connection.socket) connection.socket.close();
                connection = null;
                reconnectTimer = setTimeout(connect, 5000);
            }
        });
        adapter.log.info('KODI connected');
        adapter.setState('info.connection', true, true);
        cb && cb(null, connection);
    }, (error) => {
        adapter.log.debug(error);
        adapter.setState('info.connection', false, true);
        reconnectTimer = setTimeout(connect, 5000, cb);
    }).catch((error) => {
        if (error.stack){
            adapter.log.error(error.stack);
        } else {
            adapter.log.error(error);
        }
        adapter.setState('info.connection', false, true);
        reconnectTimer = setTimeout(connect, 5000, cb);
    });
}

function SwitchPVR(val, callback){
    adapter.getState(adapter.namespace + '.pvr.playlist_tv', (err, state) => {
        if (state){
            let Break = {};
            val = val.toString().toLowerCase();
            let obj = JSON.parse(state.val);
            try {
                obj.channels.forEach((item, i, a) => {
                    let channel = item.label.toString().toLowerCase();
                    let pos = channel.indexOf(val);
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
    let title = '';
    let message = '';
    let displaytime = 5000;
    let img = ['info', 'warning', 'error'];
    let image = 'info';
    let c = (';' + param).split(';');
    let flag = false;
    c.forEach((item, i, arr) => {
        if (!isNaN(item)){
            let num = parseInt(item);
            if (num >= 1500 && num <= 30000){
                displaytime = num;
            } else if (num >= 0 && num <= 2){
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
        c.forEach((item, i, arr) => {
            if (isNaN(arr[i]) && arr[i]){
                message = arr[i].toString();
            }
        });
    }
    callback({'title': title, 'message': message, 'image': image, 'displaytime': displaytime});
}

function GetVolume(){
    if (connection){
        connection.run('Application.GetProperties', {
            'properties': ['volume', 'muted']
        }).then((res) => {
            adapter.log.debug('GetVolume: ' + JSON.stringify(res));
            setState('mute', res.muted);
            setState('volume', res.volume);
        }, (e) => {
            ErrProcessing(e);
        }).catch((e) => {
            ErrProcessing(e);
        })
    }
}

function time(hour, min, sec){
    let time = '';
    hour = (parseInt(hour) < 10 ? '0' :'') + hour;
    min = (parseInt(min) < 10 ? '0' :'') + min;
    sec = (parseInt(sec) < 10 ? '0' :'') + sec;
    if (parseInt(hour) === 0){
        time = min + ':' + sec;
    } else {
        time = hour + ':' + min + ':' + sec;
    }
    return time;
}

function ErrProcessing(error){
    adapter.log.error(error);
    connection = null;
    getConnection();
}

function isNumeric(n){
    return !isNaN(parseFloat(n)) && isFinite(n);
}

if (module.parent){
    module.exports = startAdapter;
} else {
    startAdapter();
}
