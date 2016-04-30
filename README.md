![Logo](admin/kodi.png)
# Kodi's JSON-RPC API for IoBroker
You can find kodi's official documentation of the JSON-RCP API [here](http://kodi.wiki/view/JSON-RPC_API) and the full list of available commands (for protocol version 6) [here](http://kodi.wiki/view/JSON-RPC_API/v6).

## Using
###ShowNotification: 
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

## Changelog

#### 0.0.3 (2016-05-01)
* (instalator) 0.0.3

#### 0.0.2 (2016-04-24)
* (instalator) remote player
* (instalator) ShowNotification
* (instalator) info playing
* (instalator) GetPVRChannel

#### 0.0.1
* (instalator) initial (17.04.2016)
