![Logo](admin/kodi.png)

[![NPM version](https://img.shields.io/npm/v/iobroker.kodi.svg)](https://www.npmjs.com/package/iobroker.kodi)
[![Downloads](https://img.shields.io/npm/dm/iobroker.kodi.svg)](https://www.npmjs.com/package/iobroker.kodi)

[![NPM](https://nodei.co/npm/iobroker.kodi.png?downloads=true)](https://nodei.co/npm/iobroker.kodi/)

# Kodi's JSON-RPC API for IoBroker
You can find kodi's official documentation of the JSON-RCP API [here](http://kodi.wiki/view/JSON-RPC_API) and the full list of available commands (for protocol version 6) [here](http://kodi.wiki/view/JSON-RPC_API/v6).

## Конфигурация KODI
Remote control enable.

JSON-RPC API использует по умолчанию порт 9090, для того чтобы его изменить необходимо внести изменения в файл [advancedsettings.xml](http://kodi.wiki/view/AdvancedSettings.xml)
Note: The advancedsettings.xml file does not exist by default. You have to create it first!
```
<jsonrpc>
    <compactoutput>false</compactoutput>
    <tcpport>9999</tcpport>
</jsonrpc>
```

## Конфигурация драйвера
В найстройках драйвера указывается IP адрес KODI и порт для JSON-RPC API (по умолчанию 9090).

## Using
###ShowNotif: 
Один важный момент, если используется заголовок сообщения, то он должен всегда находится перед самим текстом сообщения (Внимание;Протечка воды), расположение остальных параметров не критично.
####Image:
Уровень сообщения
  * 'info' - 0 (default),
  * 'warning' - 1,
  * 'error' - 2.

####displaytime:
Время отображения сообщения в милисекундах, минимум 1500 макс 30000 мс.

Пример: 
 * 1;Внимание;Протечка воды;15000
 * Внимание;Протечка воды;2;10000
 * Внимание;Протечка воды
 * Протечка воды

Так же сообщения можно отправлять из javascript:
```
sendTo("kodi.0", {
    message:  'Возможно протечка воды ',
    title:    'ВНИМАНИЕ!!!',
    image: 'https://raw.githubusercontent.com/instalator/ioBroker.kodi/master/admin/kodi.png',
    delay: ''
});
```
###SwitchPVR: 
Переключение PVR IPTV каналов по названию канала в плейлисте.
Пример:
	ТВ канал - Discovery Science найдет как по полному наименованию так и по discover,
	
###youtube: 
Для открытия видео с сайта youtube достаточно записать код видео в данный статус.
Например: Для открытия этого [видео](https://www.youtube.com/watch?v=Bvmxr24D4TA), необходимо установить в статус - Bvmxr24D4TA

###open: 
Сюда записывается ссылка на медиконтент в сети интернет либо путь до локального медиа файла.
После записи значения начнется воспроизведение на проигрователе KODI.

###position: 
Текущая позиция в плейлисте, так же в этот статус можно записать необходимую позицую и KODI тут же перейдет к воспроизведению этой позиции.

###seek: 
Текущее значение позиции воспроизведения в процентах от 0 до 100.

###repeat: 
Повтор воспроизведения, принимает следующие значения:
* off - повтор воспроизведения отключен
* on - повтор воспроизведения текущего трека
* all - повтор всего плейлиста

###shuffle: 
Перемешивание списка треков в плейлисте для случайного воспроизведения.
Принимает значения true и false

###play: 
Старт воспроизведения (true, false)

###speed: 
Скорость воспроизведения. Фиксированные значения -32, -16, -8, -4, -2, -1, 0, 1, 2, 4, 8, 16, 32, а также increment и decrement

###Directory: 
Сюда записывается путь до папки или диска, в ответ в этот статус записывается список каталогов указанной папки или диска.

###ActivateWindow: 
Активизирует в проигрывателе окно. Поддерживает следующий список:
```
"home","programs","pictures","filemanager","files","settings","music","video","videos","tv","pvr","pvrguideinfo","pvrrecordinginfo","pvrtimersetting","pvrgroupmanager","pvrchannelmanager",,"pvrchannelmanager","pvrguidesearch","pvrchannelscan","pvrupdateprogress","pvrosdchannels","pvrosdguide","pvrosddirector","pvrosdcutter","pvrosdteletext","systeminfo","testpattern","screencalibration","guicalibration","picturessettings","programssettings","weathersettings","musicsettings","systemsettings","videossettings","networksettings","servicesettings","appearancesettings","pvrsettings","tvsettings","scripts","videofiles","videolibrary","videoplaylist","loginscreen","profiles","skinsettings","addonbrowser","yesnodialog","progressdialog","virtualkeyboard","volumebar","submenu","favourites","contextmenu","infodialog","numericinput","gamepadinput","shutdownmenu","mutebug","playercontrols","seekbar","musicosd","addonsettings","visualisationsettings","visualisationpresetlist","osdvideosettings","osdaudiosettings","videobookmarks","filebrowser","networksetup","mediasource","profilesettings","locksettings","contentsettings","songinformation","smartplaylisteditor","smartplaylistrule","busydialog","pictureinfo","accesspoints","fullscreeninfo","karaokeselector","karaokelargeselector","sliderdialog","addoninformation","musicplaylist","musicfiles","musiclibrary","musicplaylisteditor","teletext","selectdialog","musicinformation","okdialog","movieinformation","textviewer","fullscreenvideo","fullscreenlivetv","visualisation","slideshow","filestackingdialog","karaoke","weather","screensaver","videoosd","videomenu","videotimeseek","musicoverlay","videooverlay","startwindow","startup","peripherals","peripheralsettings","extendedprogressdialog","mediafilter".
```

###ExecuteAction: 
Можно выполнить одно из следующих действий:
```
"left","right","up","down","pageup","pagedown","select","highlight","parentdir","parentfolder","back","previousmenu","info","pause","stop","skipnext","skipprevious","fullscreen","aspectratio","stepforward","stepback","bigstepforward","bigstepback","osd","showsubtitles","nextsubtitle","codecinfo","nextpicture","previouspicture","zoomout","zoomin","playlist","queue","zoomnormal","zoomlevel1","zoomlevel2","zoomlevel3","zoomlevel4","zoomlevel5","zoomlevel6","zoomlevel7","zoomlevel8","zoomlevel9","nextcalibration","resetcalibration","analogmove","rotate","rotateccw","close","subtitledelayminus","subtitledelay","subtitledelayplus","audiodelayminus","audiodelay","audiodelayplus","subtitleshiftup","subtitleshiftdown","subtitlealign","audionextlanguage","verticalshiftup","verticalshiftdown","nextresolution","audiotoggledigital","number0","number1","number2","number3","number4","number5","number6","number7","number8","number9","osdleft","osdright","osdup","osddown","osdselect","osdvalueplus","osdvalueminus","smallstepback","fastforward","rewind","play","playpause","delete","copy","move","mplayerosd","hidesubmenu","screenshot","rename","togglewatched","scanitem","reloadkeymaps","volumeup","volumedown","mute","backspace","scrollup","scrolldown","analogfastforward","analogrewind","moveitemup","moveitemdown","contextmenu","shift","symbols","cursorleft","cursorright","showtime","analogseekforward","analogseekback","showpreset","presetlist","nextpreset","previouspreset","lockpreset","randompreset","increasevisrating","decreasevisrating","showvideomenu","enter","increaserating","decreaserating","togglefullscreen","nextscene","previousscene","nextletter","prevletter","jumpsms2","jumpsms3","jumpsms4","jumpsms5","jumpsms6","jumpsms7","jumpsms8","jumpsms9","filter","filterclear","filtersms2","filtersms3","filtersms4","filtersms5","filtersms6","filtersms7","filtersms8","filtersms9","firstpage","lastpage","guiprofile","red","green","yellow","blue","increasepar","decreasepar","volampup","volampdown","channelup","channeldown","previouschannelgroup","nextchannelgroup","leftclick","rightclick","middleclick","doubleclick","wheelup","wheeldown","mousedrag","mousemove","noop".
```

## Changelog

#### 0.1.0 (2016-05-22)
* (instalator) beta

#### 0.0.6 (2016-05-08)
* (bluefox) fixed crash when the driver turned on the KODI
* (bluefox) make adapter disabled by default, because no IP set
* (instalator) Thumbnail widget
* (instalator) added GetDirectory, GetVideoLibrary
* (instalator) added Scan & Clean Library

#### 0.0.5 (2016-05-04)
* (instalator) change creating object
* (instalator) added info.connection state

#### 0.0.4 (2016-05-03)
* (instalator) fix error
* (instalator) added VIS widgets

#### 0.0.3 (2016-05-01)
* (instalator) fix error
* (instalator) added send message from JS

#### 0.0.2 (2016-04-24)
* (instalator) remote player
* (instalator) ShowNotification
* (instalator) info playing
* (instalator) GetPVRChannel

#### 0.0.1
* (instalator) initial (17.04.2016)
