"use strict";
const utils = require('@iobroker/adapter-core');
const kodi = require('kodi-ws');
let adapter, connection = null, player_id = null, channel = false, playlist_id = 0, mem = null,
    mem_pos = null, mem_time = null, timer, reconnectTimer, getPlayListTimer, SwitchPVRTimer, GetSourcesTimer, GetNameVersionTimer, infoFileTimer, version;

let states = {
    system:     {
        EjectOpticalDrive: {val: false, name: "Ejects or closes the optical disc drive (if available)", role: "button", type: "boolean", read: false, write: true},
        Hibernate:         {val: false, name: "Puts the system running Kodi into hibernate mode", role: "button", type: "boolean", read: false, write: true},
        Reboot:            {val: false, name: "Reboots the system running Kodi", role: "button", type: "boolean", read: false, write: true},
        Shutdown:          {val: false, name: "Shuts the system running Kodi down", role: "button", type: "boolean", read: false, write: true},
        Suspend:           {val: false, name: "Suspends the system running Kodi", role: "button", type: "boolean", read: false, write: true},
        webport:           {val: 0, name: "Port Webserver Kodi", role: "media.webport", type: "number", read: false, write: false},
        webserver:         {val: '', name: "Webserver Kodi", role: "media.webserver", type: "string", read: false, write: false}
    },
    systeminfo: {
        name:    {val: "", name: "name", role: "media", type: "string", read: true, write: false},
        version: {val: "", name: "version", role: "media", type: "string", read: true, write: false},
        system:  {val: "", name: "system", role: "media", type: "string", read: true, write: false},
        kernel:  {val: "", name: "kernel", role: "media", type: "string", read: true, write: false},
    },
    input:      {
        Back:        {val: false, name: "Button Back", role: "button", type: "boolean", read: false, write: true},
        ContextMenu: {val: false, name: "Button ContextMenu", role: "button", type: "boolean", read: false, write: true},
        Down:        {val: false, name: "Button Down", role: "button", type: "boolean", read: false, write: true},
        Home:        {val: false, name: "Button Home", role: "button", type: "boolean", read: false, write: true},
        Info:        {val: false, name: "Button Info", role: "button", type: "boolean", read: false, write: true},
        Left:        {val: false, name: "Button Left", role: "button", type: "boolean", read: false, write: true},
        Right:       {val: false, name: "Button Right", role: "button", type: "boolean", read: false, write: true},
        Select:      {val: false, name: "Button Select", role: "button", type: "boolean", read: false, write: true},
        SendText:    {val: false, name: "Button SendText", role: "button", type: "boolean", read: false, write: true},
        ShowCodec:   {val: false, name: "Button ShowCodec", role: "button", type: "boolean", read: false, write: true},
        ShowOSD:     {val: false, name: "Button ShowOSD", role: "button", type: "boolean", read: false, write: true},
        Up:          {val: false, name: "Button Up", role: "button", type: "boolean", read: false, write: true}
    },
    pvr:        {
        SwitchPVR:      {val: '', name: "Switch PVR by name channel", role: "media", type: "string", read: false, write: true},
        SwitchPVRbyId:  {val: 0, name: "Switch PVR by id channel", role: "state", type: "number", read: false, write: true},
        playlist_tv:    {val: '', name: "PVR playlist tv channel", role: "media", type: "string", read: true, write: true},
        playlist_radio: {val: '', name: "PVR playlist radio channel", role: "media", type: "string", read: true, write: true},
    },
    info:       {
        album:              {val: '', name: "Album of current played song", role: "media.album", type: "string", read: true, write: false},
        artist:             {val: '', name: "Artist of current played song", role: "media.artist", type: "string", read: true, write: false},
        genre:              {val: false, name: "Genre", role: "media.genre", type: "string", read: true, write: false},
        title:              {val: '', name: "Title of current played song", role: "media.title", type: "string", read: true, write: false},
        playing_time:       {val: '', name: "playback duration", role: "media.elapsed.text", type: "string", read: true, write: false},
        playing_time_total: {val: '', name: "playback duration", role: "media.duration.text", type: "string", read: true, write: false},
        fanart:             {val: '', name: "fanart", role: "media", type: "string", read: true, write: false},
        file:               {val: '', name: "file", role: "media", type: "string", read: true, write: false},
        playcount:          {val: 0, name: "Number of plays", role: "media", type: "number", read: true, write: false},
        rating:             {val: 0, name: "rating", role: "media", type: "number", read: true, write: true},
        userrating:         {val: 0, name: "user rating", role: "media", type: "number", min: 0, max: 10, read: true, write: true},
        userrating_album:   {val: 0, name: "user rating album", role: "media", type: "number", min: 0, max: 10, read: true, write: true},
        albumid:            {val: 0, name: "albumid", role: "media", type: "number", read: true, write: false},
        thumbnail:          {val: '', name: "thumbnail", role: "media.cover", type: "string", read: true, write: false},
        track:              {val: 0, name: "track", role: "media", type: "number", read: true, write: false},
        type:               {val: '', name: "type", role: "media.type", type: "string", read: true, write: false},
        year:               {val: 0, name: "year", role: "media", type: "number", read: true, write: false},
        episode:            {val: 0, name: "episode", role: "media", type: "number", read: true, write: false},
        imdbnumber:         {val: '', name: "imdb number", role: "media", type: "string", read: true, write: false},
        originaltitle:      {val: '', name: "original title", role: "media", type: "string", read: true, write: false},
        plot:               {val: '', name: "plot", role: "media", type: "string", read: true, write: false},
        season:             {val: 0, name: "season", role: "media", type: "number", read: true, write: false},
        showtitle:          {val: '', name: "show title", role: "media", type: "string", read: true, write: false},
        subtitle:           {val: '', name: "subtitle", role: "media", type: "object", read: true, write: false},
        tagline:            {val: '', name: "tag line", role: "media", type: "string", read: true, write: false},
        audio_channels:     {val: 0, name: "audio channels", role: "media", type: "number", read: true, write: false},
        audio_codec:        {val: '', name: "audio codec", role: "media", type: "string", read: true, write: false},
        audio_language:     {val: '', name: "audio language", role: "media", type: "string", read: true, write: false},
        video_aspect:       {val: 0, name: "video aspect", role: "media", type: "number", read: true, write: false},
        video_codec:        {val: '', name: "video codec", role: "media", type: "string", read: true, write: false},
        video_duration:     {val: 0, name: "video duration", role: "media", type: "number", read: true, write: false},
        video_height:       {val: 0, name: "video height", role: "media", type: "number", read: true, write: false},
        video_stereomode:   {val: '', name: "video stereomode", role: "media", type: "string", read: true, write: false},
        video_width:        {val: 0, name: "video width", role: "media", type: "number", read: true, write: false},
        subtitle_language:  {val: '', name: "subtitle language", role: "media", type: "string", read: true, write: false},
        id:                 {val: 0, name: "id", role: "media", type: "number", read: true, write: false},
        albumartist:        {val: '', name: "album artist", role: "media", type: "string", read: true, write: false},
        currentplay:        {val: '', name: "current play", role: "media", type: "string", read: true, write: false},
        player_id:          {val: '', name: "player id", role: "media", type: "number", read: true, write: false},
        player_type:        {val: '', name: "player type", role: "media", type: "string", read: true, write: false},
        audio_bitrate:      {val: '', name: "audio bitrate", role: "media", type: "string", read: true, write: false},
        audio_stream:       {val: '', name: "audio stream", role: "media", type: "string", read: true, write: false},
        video_language:     {val: '', name: "video language", role: "media", type: "string", read: true, write: false},
        video_stream:       {val: '', name: "video stream", role: "media", type: "string", read: true, write: false},
        live:               {val: false, name: "live", role: "media", type: "boolean", read: true, write: false},
        canseek:            {val: false, name: "can seek", role: "media", type: "boolean", read: true, write: false},
        canrepeat:          {val: false, name: "Can repeat", role: "media", type: "boolean", read: false, write: false},
        canshuffle:         {val: false, name: "Can shuffle", role: "media", type: "boolean", read: false, write: false},
        canchangespeed:     {val: false, name: "Can change speed", role: "media", type: "boolean", read: false, write: false},
    },
    main:       {
        play:              {val: false, name: "Controlling playback play", role: "button.play", type: "boolean", read: false, write: true},
        pause:             {val: false, name: "Controlling playback pause", role: "button.pause", type: "boolean", read: false, write: true},
        state:             {val: "stop", name: "Status Play, stop, or pause", role: "media.state", type: "string", values: "stop,play,pause", read: true, write: false},
        next:              {val: false, name: "Controlling playback next", role: "button.next", type: "boolean", read: false, write: true},
        previous:          {val: false, name: "Controlling playback previous", role: "button.prev", type: "boolean", read: false, write: true},
        stop:              {val: false, name: "Controlling playback stop", role: "button.stop", type: "boolean", read: false, write: true},
        mute:              {val: false, name: "Mute mode", role: "media.mute", type: "boolean", read: true, write: true},
        playid:            {val: 0, name: "Controlling playback playid", role: "media.playid", type: "number", read: true, write: true},
        seek:              {val: 0, name: "Controlling playback seek", role: "media.seek", type: "number", unit: "%", min: 0, max: 100, read: true, write: true},
        volume:            {val: 0, name: "Volume control", role: "level.volume", type: "number", read: true, write: true, min: 0, max: 100},
        repeat:            {val: '', name: "Repeat control", role: "media.mode.repeat", type: "string", read: true, write: true, states: {off: "Off", all: "All", one: "One"}},
        shuffle:           {val: false, name: "Shuffle control", role: "media.mode.shuffle", type: "boolean", read: true, write: true},
        position:          {val: 0, name: "Current playing track", role: "media.track", type: "number", read: true, write: true},
        playlist:          {val: '', name: "Current playlist", role: "media.playlist", type: "string", read: true, write: true},
        Directory:         {val: '', name: "The database browser", role: "media.browser", type: "string", read: true, write: true},
        clear:             {val: false, name: "Clear current playlist", role: "media.clear", type: "boolean", read: false, write: true},
        add:               {val: '', name: "Add to current playlist", role: "media.add", type: "string", read: false, write: true},
        OnInputRequested:  {val: '', name: "On Input Requested", role: "media", type: "string", read: false, write: true},
        Sources:           {val: '', name: "Sources", role: "media", type: "string", read: true, write: true},
        CleanAudioLibrary: {val: '', name: "Clean Audio Library", role: "media", type: "string", read: false, write: true},
        CleanVideoLibrary: {val: '', name: "Clean Video Library", role: "media", type: "string", read: false, write: true},
        ScanAudioLibrary:  {val: '', name: "Scan Audio Library", role: "media", type: "string", read: false, write: true},
        ScanVideoLibrary:  {val: '', name: "Scan Video Library", role: "media", type: "string", read: false, write: true},
        VideoLibrary:      {val: '', name: "Video Library", role: "media", type: "object", read: true, write: true},
        setsubtitle:       {val: '', name: "Set subtitle", role: "media", type: "string", read: false, write: true, states: {previous: "Previous", next: "Next", off: "Off", on: "On"}},
        zoom:              {val: '', name: "Zoom", role: "media", type: "string", read: false, write: true},
        ExecuteAction:     {val: '', name: "Execute Action", role: "media", type: "string", read: false, write: true},
        ActivateWindow:    {val: '', name: "Activate Window", role: "media", type: "string", read: false, write: true},
        ShowNotif:         {val: '', name: "Show Notification", role: "media", type: "string", read: false, write: true},
        open:              {val: '', name: "Play file or URL", role: "media", type: "string", read: false, write: true},
        youtube:           {val: '', name: "Open youtube video", role: "media", type: "string", read: false, write: true},
        speed:             {val: 0, name: "Playback speed", role: "media.speed", type: "number", read: true, write: true, states: {'-32': '-32', '-16': '-16', '-8': '-8', '-4': '-4', '-2': '-2', '-1': '-1', '0': '0', '1': '1', '2': '2', '4': '4', '8': '8', '16': '16', '32': '32'}},
        playlistid:        {val: 0, name: "Playlist id", role: "media", type: "number", read: true, write: true},
        partymode:         {val: false, name: "Party mode toggle", role: "media", type: "boolean", read: true, write: true},
        subtitleenabled:   {val: false, name: "Subtitle enabled", role: "media", type: "string", read: true, write: false},
    }
};

function startAdapter(options){
    return adapter = utils.adapter(Object.assign({}, options, {
        systemConfig: true,
        name:         'kodi',
        ready:        main,
        unload:       (callback) => {
            try {
                adapter.log.debug('cleaned everything up...');
                timer && clearTimeout(timer);
                reconnectTimer && clearTimeout(reconnectTimer);
                getPlayListTimer && clearTimeout(getPlayListTimer);
                SwitchPVRTimer && clearTimeout(SwitchPVRTimer);
                GetSourcesTimer && clearTimeout(GetSourcesTimer);
                GetNameVersionTimer && clearTimeout(GetNameVersionTimer);
                infoFileTimer && clearTimeout(infoFileTimer);
                callback();
            } catch (e) {
                callback();
            }
        },
        stateChange:  (id, state) => {
            let ids = id.split(".");
            const _id = ids[ids.length - 1].toString();
            if (_id === 'playing_time_total' && state.val !== mem_time){
                if (channel){
                    mem_time = state.val;
                }
            }
            if (_id === 'currentplay' && state.val !== mem){
                mem = state.val;
                getPlayListTimer = setTimeout(() => {
                    GetPlayList();
                }, 1000);
            }
            if (_id === 'position' && state.val !== mem_pos){
                mem_pos = state.val;
                getPlayListTimer = setTimeout(() => {
                    GetPlayList();
                }, 1000);
            }
            if (id && state && !state.ack){
                adapter.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                const param = state.val;
                let name = ids[ids.length - 2].toString();
                if (isNumeric(name)){
                    name = null;
                }
                ids = ids[ids.length - 1].toString();
                ConstructorCmd(name, ids, param);
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

function subscribeNotification(cb){
    adapter.log.debug('subscribeNotification Application.OnVolumeChanged');
    connection.notification('Application.OnVolumeChanged', (res) => {
        adapter.log.debug('notification: Application.OnVolumeChanged ' + JSON.stringify(res));
        saveState('main.volume', res.data.volume);
        saveState('main.mute', res.data.muted);
    });
    adapter.log.debug('subscribeNotification Player.OnResume');
    if (version > 8){
        connection.notification('Player.OnResume', (res) => {
            adapter.log.debug('notification: Player.OnResume ' + JSON.stringify(res));
            saveState('main.state', 'play');
        });
    }
    adapter.log.debug('subscribeNotification Player.OnPlay');
    connection.notification('Player.OnPlay', (res) => {
        adapter.log.debug('notification: Player.OnPlay ' + JSON.stringify(res));
        saveState('main.state', 'play');
        GetCurrentItem();
    });
    adapter.log.debug('subscribeNotification Player.OnPause');
    connection.notification('Player.OnPause', (res) => {
        adapter.log.debug('notification: Player.OnPause ' + JSON.stringify(res));
        saveState('main.state', 'pause');
    });
    adapter.log.debug('subscribeNotification Player.OnStop');
    connection.notification('Player.OnStop', (res) => {
        adapter.log.debug('notification: Player.OnStop ' + JSON.stringify(res));
        if (res.data.item.channeltype !== 'tv'){
            clearInfo();
        }
    });
    adapter.log.debug('subscribeNotification Input.OnInputRequested');
    connection.notification('Input.OnInputRequested', (res) => {
        adapter.log.debug('notification: Input.OnInputRequested ' + JSON.stringify(res));
        //{"data":{"title":"Строка поиска","type":"keyboard","value":""},"sender":"xbmc"}
        //setState('OnInputRequested', true);
    });
    adapter.log.debug('subscribeNotification Playlist.OnClear');
    connection.notification('Playlist.OnClear', (res) => {
        adapter.log.debug('notification: Playlist.OnClear ' + JSON.stringify(res));
        //saveState('main.playlist', '[]');
    });
    cb && cb();
}

function clearInfo(){
    adapter.getState('state', (err, state) => {
        if (state.val !== 'stop'){
            saveState('main.state', 'stop');
        }
    });
    for (let key in states.info) {
        if (!Object.hasOwnProperty.call(states.info, key)) continue;
        if (states.info[key].type === 'string'){
            states.info[key].val = '';
        } else if (states.info[key].type === 'number'){
            states.info[key].val = 0;
        } else if (states.info[key].type === 'boolean'){
            states.info[key].val = false;
        }
    }
    setObject('states');
}

function creatObject(_id, key, key2){
    adapter.getObject(_id, function (err, _obj){
        let common = {};
        common.name = states[key][key2].name;
        common.role = states[key][key2].role;
        common.type = states[key][key2].type;
        if (states[key][key2].unit !== undefined) common.unit = states[key][key2].unit;
        if (states[key][key2].min !== undefined) common.min = states[key][key2].min;
        if (states[key][key2].max !== undefined) common.max = states[key][key2].max;
        if (states[key][key2].states !== undefined) common.states = states[key][key2].states;
        common.read = states[key][key2].read;
        common.write = states[key][key2].write;
        common.def = states[key][key2].val;
        if (err || !_obj){
            adapter.setObject(_id, {
                type:   'state',
                common: common,
                native: {}
            });
            adapter.setState(_id, {val: common.def, ack: true});
        } else {
            adapter.extendObject(_id, {common: common});
        }
    });
}

function setObject(type){
    let _id = '';
    for (let key in states) {
        if (!Object.hasOwnProperty.call(states, key)) continue;
        if (typeof states[key] === 'object'){
            let obj = states[key];
            for (let key2 in obj) {
                if (!Object.hasOwnProperty.call(obj, key2)) continue;
                if (key !== 'main'){
                    _id = key + '.' + key2;
                } else {
                    _id = key2;
                }
                if (type === undefined || !type){
                    creatObject(_id, key, key2);
                } else {
                    setStates(_id, key, key2);
                }
            }
        }
    }
}

function setStates(_id, key, key2){
    const val = states[key][key2].val;
    adapter.getState(_id, (err, state) => {
        if (!state){
            adapter.setState(_id, val, true);
        } else if (state.val !== val || !state.ack){
            adapter.setState(_id, val, true);
            //adapter.log.debug('setState ' + _id + ' { oldVal: ' + state.val + ' != newVal: ' + val + ' }');
        } else if (state.val === val){
            //adapter.log.debug('setState ' + _id + ' { oldVal: ' + state.val + ' = newVal: ' + val + ' }');
        }
    });
}

function isPlayerId(cb){
    if (connection){
        if (player_id !== undefined && player_id !== null){
            cb && cb();
        } else {
            connection.run('Player.GetActivePlayers').then((res) => {
                adapter.log.debug('Response isPlayerId: ' + JSON.stringify(res));
                if (res.length > 0){
                    player_id = res[0].playerid;
                } else {
                    player_id = null;
                }
                cb && cb();
            }, (e) => {
                ErrProcessing(e + ' {isPlayerId}');
            }).catch((e) => {
                ErrProcessing(e + ' {isPlayerId}');
            });
        }
    }
}

function GetCurrentItem(cb){
    adapter.log.debug('GetCurrentItem');
    if (connection){
        isPlayerId(() => {
            if (player_id !== undefined && player_id !== null){
                // https://github.com/xbmc/xbmc/issues/16245
                connection.run('Player.GetItem', { // !!! Выдает данные только при первом запрос, если постоянно оправшивать выдает пыстые значения
                    "playerid":   player_id,
                    "properties": ["albumid", "userrating", "album", "albumartist", "artist", "director", "episode", "fanart", "file", "genre", "plot", "rating", "season", "showtitle", "studio", "imdbnumber", "tagline", "thumbnail", "title", "track", "writer", "year", "streamdetails", "originaltitle", "cast", "playcount"]
                }).then(function (res){
                    adapter.log.debug('GetCurrentItem: ' + JSON.stringify(res));
                    try {
                        res = res.item;
                        saveState('info.tagline', res.tagline);
                        saveState('info.fanart', res.fanart);
                        saveState('info.thumbnail', res.thumbnail);
                        saveState('info.currentplay', res.label);
                        saveState('info.title', res.title ? res.title :res.label);
                        saveState('info.album', res.album);
                        saveState('info.episode', res.episode);
                        saveState('info.season', res.season);
                        saveState('info.file', res.file);
                        saveState('info.imdbnumber', res.imdbnumber);
                        saveState('info.originaltitle', res.originaltitle);
                        saveState('info.plot', res.plot);
                        saveState('info.playcount', res.playcount);
                        saveState('info.rating', res.rating);
                        saveState('info.userrating', res.userrating);
                        saveState('info.albumid', res.albumid);
                        saveState('info.year', res.year);
                        saveState('info.genre', res.genre ? res.genre.join(', ') :'');
                        saveState('info.id', res.id);
                        saveState('info.artist', res.artist ? res.artist.join(', ') :'');
                        saveState('info.albumartist', res.albumartist ? res.albumartist.join(', ') :'');
                    } catch (e) {
                        ErrProcessing(e + ' catch {GetCurrentItem}');
                    }
                    cb && cb();
                }, function (e){
                    ErrProcessing(e + '{GetCurrentItem}');
                }).catch(function (e){
                    ErrProcessing(e + '{GetCurrentItem}');
                });
            } else {
                cb && cb();
            }
        });
    }
}

function getRatigsSong(cb){
    if (connection && player_id !== undefined && player_id !== null && states.info.id.val && states.info.albumid.val){
        const batch = connection.batch();
        const GetSongDetails = batch.AudioLibrary.GetSongDetails({
            "songid":     states.info.id.val,
            "properties": ["albumid", "userrating"]
        });
        const GetAlbumDetails = batch.AudioLibrary.GetAlbumDetails({
            "albumid":    states.info.albumid.val,
            "properties": ["userrating"]
        });
        batch.send();
        Promise.all([GetSongDetails, GetAlbumDetails]).then((res) => {
            adapter.log.debug('Response getRatigs ' + JSON.stringify(res));
            ///////////////////////////////////////////////////////////////////////////////////////
            try {
                saveState('info.userrating', res[0].songdetails.userrating);
                saveState('info.userrating_album', res[1].albumdetails.userrating);
            } catch (e) {
                ErrProcessing(e + ' catch getRatigs');
            }
            cb && cb();
        }, (e) => {
            cb && cb();
        }).catch((e) => {
            cb && cb();
        });
    } else {
        cb && cb();
    }
}

function GetPlayerProperties(){
    if (connection && player_id !== undefined && player_id !== null){
        const batch = connection.batch();
        const Properties = batch.Player.GetProperties({
            "playerid":   player_id,
            "properties": ["audiostreams", "canchangespeed", "canrepeat", "canseek", "canshuffle", "percentage", "live", "currentvideostream", "currentaudiostream", "currentsubtitle", "partymode", "playlistid", "position", "repeat", "shuffled", "speed", "subtitleenabled", "subtitles", "time", "totaltime", "type"]
        });
        const InfoLabels = batch.XBMC.GetInfoLabels({"labels": ["MusicPlayer.Codec", "MusicPlayer.SampleRate", "MusicPlayer.BitRate", "MusicPlayer.Channels", "MusicPlayer.Rating", "MusicPlayer.UserRating", "MusicPlayer.Artist"]});
        const CurrentPlay = batch.Player.GetItem({"playerid": player_id});
        batch.send();
        Promise.all([Properties, InfoLabels, CurrentPlay]).then((res) => {
            adapter.log.debug('Response GetPlayerProperties ' + JSON.stringify(res));
            ///////////////////////////////////////////////////////////////////////////////////////
            try {
                playlist_id = res[0].playlistid;
                saveState('info.playing_time', time(res[0].time.hours, res[0].time.minutes, res[0].time.seconds));
                saveState('info.playing_time_total', time(res[0].totaltime.hours, res[0].totaltime.minutes, res[0].totaltime.seconds));
                saveState('info.canseek', res[0].canseek);
                saveState('main.repeat', res[0].repeat);
                saveState('main.shuffle', res[0].shuffled);
                saveState('main.speed', res[0].speed);
                saveState('main.position', res[0].position);
                saveState('main.playlistid', res[0].playlistid);
                saveState('main.partymode', res[0].partymode);
                if (res[0].currentaudiostream){
                    saveState('info.audio_codec', res[0].currentaudiostream.codec);
                    saveState('info.audio_bitrate', res[0].currentaudiostream.bitrate > 10000 ? (res[0].currentaudiostream.bitrate / 1000) :res[0].currentaudiostream.bitrate);
                    saveState('info.audio_channels', res[0].currentaudiostream.channels);
                    saveState('info.audio_language', res[0].currentaudiostream.language);
                    saveState('info.audio_stream', res[0].currentaudiostream.name);
                }
                if (res[0].currentvideostream){
                    saveState('info.video_codec', res[0].currentvideostream.codec);
                    saveState('info.video_height', res[0].currentvideostream.height);
                    saveState('info.video_width', res[0].currentvideostream.width);
                    saveState('info.video_language', res[0].currentvideostream.language);
                    saveState('info.video_stream', res[0].currentvideostream.name);
                }
                if (res[0].type === 'audio'){
                    saveState('info.audio_codec', res[1]['MusicPlayer.Codec']);
                    saveState('info.audio_bitrate', res[1]['MusicPlayer.BitRate']);
                    saveState('info.audio_channels', res[1]['MusicPlayer.Channels']);
                    //saveState('info.rating', res[1]['MusicPlayer.Rating']);
                    //saveState('info.artist', res[1]['MusicPlayer.Artist']);
                }
                if (res[2].item.type === 'channel'){
                    saveState('info.type', res[2].item.type);
                    channel = true;
                } else {
                    saveState('info.type.val', res[0].type);
                    channel = false;
                }
                saveState('info.live', res[0].live);
                saveState('main.seek', parseFloat(res[0].percentage).toFixed(4));
                saveState('main.subtitleenabled', res[0].subtitleenabled);
                saveState('info.canchangespeed', res[0].canchangespeed);
                saveState('info.canrepeat', res[0].canrepeat);
                saveState('info.canshuffle', res[0].canshuffle);
            } catch (e) {
                ErrProcessing(e + ' catch GetPlayerProperties');
            }
            if (!res[0].live){
                GetCurrentItem(() => {
                    getRatigsSong(() => {
                        setObject('states');
                    });
                    //setObject('states');
                });
            } else {
                setObject('states');
            }
        }, (e) => {
            ErrProcessing(e + ' GetPlayerProperties');
        }).catch((e) => {
            ErrProcessing(e + ' GetPlayerProperties');
        });
    }
}

function saveState(name, val){
    const k = name.split('.');
    if(k.length === 1){
        k.unshift('main');
    }
    if (!states[k[0]][k[1]]){
        adapter.log.error('saveState Object not found - ' + name + ': {val: false, name: "' + name + '", role: "media", type: "string", read: false, write: true}');
    } else {
        if (val === undefined){
            if (states[k[0]][k[1]].type === 'string'){
                val = '';
            } else if (states[k[0]][k[1]].type === 'number'){
                val = 0;
            } else if (states[k[0]][k[1]].type === 'boolean'){
                val = false;
            }
        }
        states[k[0]][k[1]].val = val;
    }
}

function GetPlayerId(cb){
    timer && clearTimeout(timer);
    if (connection){
        connection.run('Player.GetActivePlayers').then((res) => {
            adapter.log.debug('Response GetPlayerId: ' + JSON.stringify(res));
            if (res.length > 0){
                player_id = res[0].playerid;
                saveState('info.player_id', player_id);
                saveState('info.player_type', res[0].playertype + ' ' + res[0].type);
                if (states.main.state === 'stop'){
                    saveState('main.state', 'play');
                }
                GetPlayerProperties();
            } else {
                player_id = null;
                clearInfo();
            }
            timer = setTimeout(() => {
                GetPlayerId();
            }, 2000);
            cb && cb();
        }, (e) => {
            ErrProcessing(e + ' {GetPlayerId}');
        }).catch((e) => {
            ErrProcessing(e + ' {GetPlayerId}');
        })
    } else {
        connect();
    }
}

function connect(){
    adapter.setState('info.connection', false, true);
    adapter.log.debug('KODI connecting to: ' + adapter.config.ip + ':' + adapter.config.port);
    connection = null;
    getConnection((err, _connection) => {
        if (_connection){
            GetPortWebServer(() => {
                GetNameVersion(() => {
                    GetVolume(() => {
                        GetPVRChannels(() => {
                            GetVideoLibrary(() => {
                                subscribeNotification(() => {
                                    GetPlayerId(() => {
                                        GetSources();
                                        GetCurrentItem();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }
    });
}

function getConnection(cb){
    if (connection){
        cb && cb(null, connection);
        return;
    }
    timer && clearTimeout(timer);
    kodi(adapter.config.ip, adapter.config.port).then((_connection) => {
        connection = _connection;
        _connection.on('error', (err) => {
            adapter.log.debug('Error: ' + err);
        }).on('close', () => {
            if (connection){
                adapter.log.debug('Connection closed');
                if (connection.socket) connection.socket.close();
                connection = null;
                reconnectTimer = setTimeout(connect, 5000);
            }
        });
        adapter.log.info('KODI connected');
        adapter.setState('info.connection', true, true);
        version = parseInt(connection.schema.rawSchema.version, 10);
        cb && cb(null, connection);
    }, (error) => {
        adapter.log.debug('getConnection ' + error);
        adapter.setState('info.connection', false, true);
        reconnectTimer = setTimeout(connect, 5000, cb);
    }).catch((error) => {
        if (error.stack){
            adapter.log.error('getConnection error.stack' + error.stack);
        } else {
            adapter.log.error('getConnection stack' + error);
        }
        adapter.setState('info.connection', false, true);
        reconnectTimer = setTimeout(connect, 5000, cb);
    });
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
                    //adapter.setState('Sources', JSON.stringify(obj), true);
                    saveState('main.Sources', JSON.stringify(obj));
                    fileManager(root, obj);
                }
            }, (e) => {
                ErrProcessing(e + ' {GetSources}');
            }).catch((e) => {
                ErrProcessing(e + ' {GetSources}');
            })
        });
    }
}

function fileManager(root, obj){
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
    saveState('main.Directory', JSON.stringify(browser));
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
                saveState('main.Directory', JSON.stringify(res));
            }, (e) => {
                ErrProcessing(e + '{GetDirectory}');
            }).catch((e) => {
                ErrProcessing(e + '{GetDirectory}');
            })
        }
    } else {
        GetSources(true);
    }
}

function GetVideoLibrary(cb){
    if (connection){
        connection.run('VideoLibrary.GetMovies', {
            "properties": ["genre", "director", "trailer", "tagline", "plot", "plotoutline", "title", "originaltitle", "lastplayed", "runtime", "year", "playcount", "rating", "thumbnail", "file"],
            "limits":     {"start": 0},
            "sort":       {"method": "dateadded", "ignorearticle": true}
        }).then((res) => {
            adapter.log.debug('GetVideoLibrary: ' + JSON.stringify(res));
            saveState('main.VideoLibrary', JSON.stringify(res));
            cb && cb();
        }, (e) => {
            ErrProcessing(e + '{GetVideoLibrary}');
        }).catch((e) => {
            ErrProcessing(e + '{GetVideoLibrary}');
        })
    }
}

function GetPlayList(){
    if (connection && player_id !== undefined && player_id !== null){
        connection.run('Playlist.GetItems', {
            "playlistid": playlist_id,
            "properties": ["title", "thumbnail", "fanart", "rating", "genre", "artist", "track", "season", "episode", "year", "duration", "album", "showtitle", "playcount", "file"]/*,"limits":{"start":0,"end":750}*/
        }).then((res) => {
            let plst = res ? res.items :'';
            adapter.log.debug('GetPlayList: ' + JSON.stringify(plst));
            saveState('main.playlist', JSON.stringify(plst));
        }, (e) => {
            ErrProcessing(e + '{GetPlayList}');
        }).catch((e) => {
            ErrProcessing(e + '{GetPlayList}');
        })
    }
}

function GetPortWebServer(cb){
    if (connection){
        connection.run('Settings.GetSettingValue', {"setting": "services.webserverport"}).then((res) => {
            adapter.log.debug('GetPortWebServer: ' + JSON.stringify(res));
            saveState('system.webport', res.value);
            saveState('system.webserver', adapter.config.ip + ':' + res.value);
            adapter.config.portweb = res.value;
            cb && cb();
        }, (e) => {
            ErrProcessing(e + '{GetPlayList}');
        }).catch((e) => {
            ErrProcessing(e + '{GetPlayList}');
        })

    }
}

function GetPVRChannels(cb){
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
                saveState('pvr.playlist_tv', JSON.stringify(res[0]));
                saveState('pvr.playlist_radio', JSON.stringify(res[1]));
            }
            cb && cb();
        }, (e) => {
            adapter.log.debug('Error GetChannels: PVR is not use?' + JSON.stringify(e));
            cb && cb();
            //ErrProcessing(e + '{GetChannels}');
        }).catch((e) => {
            ErrProcessing(e + '{GetChannels}');
        });
    }
}

function GetNameVersion(cb){
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
                saveState('systeminfo.name', res[0].name + ' ' + res[0].version.revision);
                saveState('systeminfo.version', res[0].version.major + '.' + res[0].version.minor);
                for (let key in res[1]) {
                    if (!Object.hasOwnProperty.call(res[1], key)) continue;
                    if (res[1][key] === true){
                        const system = key.replace('System.Platform.', '').replace('.', ' ');
                        saveState('systeminfo.system', system);
                    }
                }
                saveState('systeminfo.kernel', res[2]['System.KernelVersion']);
            }
            cb && cb();
        }, (e) => {
            ErrProcessing(e + ' {GetNameVersion}');
        }).catch((e) => {
            ErrProcessing(e + ' {GetNameVersion}');
        });
    }
}

function SwitchPVRbyId(val, cb){
    adapter.getState('pvr.playlist_tv', (err, state) => {
        if (val < 1) val = 1;
        if (state){
            let Break = {};
            let obj = JSON.parse(state.val);
            try {
                if (obj.channels[val - 1]) cb({"item": {"channelid": obj.channels[val - 1].channelid}});
            } catch (e) {
                if (e !== Break) throw e;
            }
        }
    });
}

function SwitchPVR(val, callback){
    adapter.getState('pvr.playlist_tv', (err, state) => {
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

function GetVolume(cb){
    if (connection){
        connection.run('Application.GetProperties', {
            'properties': ['volume', 'muted']
        }).then((res) => {
            adapter.log.debug('GetVolume: ' + JSON.stringify(res));
            saveState('main.mute', res.muted);
            saveState('main.volume', res.volume);
            cb && cb();
        }, (e) => {
            ErrProcessing(e + ' {GetVolume}');
        }).catch((e) => {
            ErrProcessing(e + ' {GetVolume}');
        })
    }
}

function ConstructorCmd(name, ids, param){
    adapter.log.debug('ConstructorCmd ' + name + ' - ' + ids + ' = ' + param);
    let method = null;
    if (name === 'input'){
        method = 'Input.' + ids;
        param = [];
    } else if (name === 'system'){
        method = 'System.' + ids;
        param = [];
    } else {
        switch (ids) {
            case "SwitchPVR":
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
            case "SwitchPVRbyId":
                SwitchPVRbyId(param, (res) => {
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
                if (param >= 0 && param <= 100 && states.info.canseek){
                    method = 'Player.Seek'; //int 0-100
                    param = {"playerid": player_id, "value": parseInt(param)}
                } else if (!states.info.canseek){
                    adapter.log.warn('(seek) The operation for this content is not available.');
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
                if (states.info.canrepeat){
                    method = 'Player.SetRepeat'; //off, on, all
                    if (param === true || param === 'true'){
                        param = 'all';
                    } else if (param === false || param === 'false'){
                        param = 'off';
                    }
                    param = {'playerid': player_id, "repeat": param};
                } else {
                    adapter.log.warn('(repeat) The operation for this content is not available.');
                }
                break;
            case "shuffle":
                if (states.info.canshuffle){
                    method = 'Player.SetShuffle'; //bool
                    param = {'playerid': player_id, "shuffle": !!param};
                } else {
                    adapter.log.warn('(shuffle) The operation for this content is not available.');
                }
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
                if (player_id !== 'undefined'){
                    method = 'Player.GoTo';
                } else {
                    sendCommand('Input.ExecuteAction', 'play', () => { 
                        setTimeout(() => {
                            if(player_id){
                                sendCommand('Player.GoTo', {"playerid": player_id, "to": param}, () => {
                                });
                            }
                            else {
                                sendCommand('Player.Open', {'item': {'playlistid': 0, 'position': 0}}, () => {
                                    sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                                });
                            }
                        }, 5000);
                    });
                }
                param = {"playerid": player_id, "to": param};
                break;
            case "position":
                if (player_id !== 'undefined' && player_id !== null){
                    method = 'Player.GoTo';
                } else {
                    sendCommand('Input.ExecuteAction', 'play', () => { 
                        setTimeout(() => {
                            if(player_id){
                                sendCommand('Player.GoTo', {"playerid": player_id, "to": param}, () => {
                                });
                            } else {
                                sendCommand('Player.Open', {'item': {'playlistid': 0, 'position': 0}}, () => {
                                    sendCommand('GUI.SetFullscreen', {"fullscreen": true});
                                });
                            }
                        }, 5000);
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
                saveState('playlist', '[]');
                break;
            case "partymode":
                method = 'Player.SetPartymode';
                param = {'playerid': player_id, "partymode": "toggle"};
                break;
            case "add":
                let type;
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
            case "userrating_album":
                method = 'AudioLibrary.SetAlbumDetails';
                param = param > 10 ? 10:param;
                param = param < 0 ? 0:param;
                param = {'albumid': states.info.albumid.val, "userrating": param};
                break;
            case "userrating":
                adapter.log.debug('userrating type ' + states.info.player_type.val);
                param = param > 10 ? 10:param;
                param = param < 0 ? 0:param;
                if(states.info.player_type.val === 'internal audio' && states.info.id.val){
                    method = 'AudioLibrary.SetSongDetails';
                    param = {'songid': states.info.id.val, "userrating": param};
                } else if(states.info.player_type.val === 'internal video' && states.info.season.val === -1 && states.info.episode.val === -1 && states.info.id.val){
                    method = 'VideoLibrary.SetMovieDetails';
                    param = {'movieid': states.info.id.val, "userrating": param};
                }
                break;
            case "rating":
                adapter.log.debug('rating type' + states.info.player_type.val);
                param = param > 10 ? 10:param;
                param = param < 0 ? 0:param;
                if(states.info.player_type.val === 'internal audio' && states.info.id.val){
                    method = 'AudioLibrary.SetSongDetails';
                    param = {'songid': states.info.id.val, "rating": param};
                } else if(states.info.player_type.val === 'internal video' && states.info.season.val === -1 && states.info.episode.val === -1 && states.info.id.val){
                    method = 'VideoLibrary.SetMovieDetails';
                    param = {'movieid': states.info.id.val, "rating": param};
                }
                break;
            default:
        }
    }
    method && sendCommand(method, param);
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
                    ErrProcessing(e + ' sendCommand: ' + method + ' - ' + JSON.stringify(param));
                }).catch((e) => {
                    ErrProcessing(e + ' sendCommand: ' + method + ' - ' + JSON.stringify(param));
                })
            } else {
                ErrProcessing(e + ' getConnection Error: ' + method + ' - ' + JSON.stringify(param));
            }
        });
    } else {
        adapter.log.debug('It does not specify commands or invalid value!');
    }
}

function ErrProcessing(error){
    adapter.log.debug(error);
    if (connection && connection.socket) connection.socket.close();
    connection = null;
    connect();
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

function isNumeric(n){
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function main(){
    setObject();
    setTimeout(() => {
        adapter.subscribeStates('*');
        connect();
    }, 5000);
}

if (module.parent){
    module.exports = startAdapter;
} else {
    startAdapter();
}
