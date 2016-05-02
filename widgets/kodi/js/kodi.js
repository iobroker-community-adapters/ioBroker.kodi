/*
    kodi Widget-Set

    version: "0.0.3"

    Copyright 10.2015-2016 instalator<vvvalt@mail.ru>

*/
"use strict";

// add translations for edit mode
if (vis.editMode) {
    $.extend(true, systemDictionary, {
        "myColor":          {"en": "myColor",       "de": "mainColor",  "ru": "Мой цвет"},
        "myColor_tooltip":  {
            "en": "Description of\x0AmyColor",
            "de": "Beschreibung von\x0AmyColor",
            "ru": "Описание\x0AmyColor"
        },
        "htmlText":         {"en": "htmlText",      "de": "htmlText",   "ru": "htmlText"},
        "group_extraMyset": {"en": "extraMyset",    "de": "extraMyset", "ru": "extraMyset"},
        "extraAttr":        {"en": "extraAttr",     "de": "extraAttr",  "ru": "extraAttr"}
    });
}

// add translations for non-edit mode
$.extend(true, systemDictionary, {
    "Instance":  {"en": "Instance", "de": "Instanz", "ru": "Инстанция"}
});

// this code can be placed directly in kodi.html
vis.binds.kodi = {
    version: "0.0.3",
    showVersion: function () {
        if (vis.binds.kodi.version) {
            console.log('Version kodi: ' + vis.binds.kodi.version);
            vis.binds.kodi.version = null;
        }
    },
	states: {
		oid_seek:			{val: 0, selector: '', objName: 'oid_seek'},
		oid_curtimetotal:	{val: undefined, selector: '', objName: 'curtimetotal'}
	},
/***********************************************************************/	
	createWidgetProgress: function (widgetID, view, data, style) {
		var $div = $('#' + widgetID);
		
		if (!$div.length) {
            return setTimeout(function () {
                vis.binds.kodi.createWidgetProgress(widgetID, view, data, style);
            }, 100);
        }
		
		$(function(){
			$("#progressbar").progressbar({
				value: 0
			});
		});
		
		$("#progressbar").on('click', function(e){
			var maxWidth = $($div).css("width").slice(0, -2);
			var left = $($div).css("left").slice(0, -2);
			var clickPos = e.pageX - this.offsetLeft - left;
			var percentage = clickPos / maxWidth * 100;
			vis.setValue(data.oid_seek, percentage);
			$('#progressbar').progressbar("option","value", percentage);
		});

		// subscribe on updates of value
		if (data.oid_seek) {
			vis.states.bind(data.oid_seek + '.val', function (e, newVal, oldVal) {
				$('#progressbar').progressbar("value", newVal);
			});
		}
	},
/**************************************************************************/
createWidgetButton: function (widgetID, view, data, style) {
		var $div = $('#' + widgetID);
		
		if (!$div.length) {
            return setTimeout(function () {
                vis.binds.kodi.createWidgetButton(widgetID, view, data, style);
            }, 100);
        }
		

		// subscribe on updates of value
		if (data.prev) {
			vis.states.bind(data.prev + '.val', function (e, newVal, oldVal) {
				
			});
		}
	},
/**************************************************************************/
	createWidgetPlaylist: function (widgetID, view, data, style) {
        var $div = $('#' + widgetID);
        // if nothing found => wait
        if (!$div.length) {
            return setTimeout(function () {
                vis.binds.kodi.createWidgetPlaylist(widgetID, view, data, style);
            }, 100);
        }

		function SetPlaylist(val){
			var playlist = JSON.parse(val);
			playlist = playlist.items;
			$("#playListContainer").empty();
			playlist.forEach(function(item, i, arr) {
				$("#playListContainer").append("<li class='item"+i+"'>"+i+' - '+playlist[i].label+"</li>");
			});
			$("#playListContainer .item"+vis.states[data.oid_position + '.val']).addClass("active");			
			$('#playListContainer').on('click', "li", function(){
				  var n=$(this).index();
				  vis.setValue(data.oid_position, n);
			});
		}
		// subscribe on updates of value
		if (data.oid_playlist) {
			vis.states.bind(data.oid_playlist + '.val', function (e, newVal, oldVal) {
				SetPlaylist(newVal);
			});
		}
		if (data.oid_position) {
			vis.states.bind(data.oid_position + '.val', function (e, newVal, oldVal) {
				$("#playListContainer li").removeClass("active");
				$("#playListContainer .item"+newVal).addClass("active");
			});
		}
		if ($div.length){
			SetPlaylist(vis.states[data.oid_playlist + '.val']);
		}
		
	},
/************************************************************************/
	createWidgetPlayer: function (widgetID, view, data, style) {
        var $div = $('#' + widgetID);
        // if nothing found => wait
        if (!$div.length) {
            return setTimeout(function () {
                vis.binds.kodi.createWidgetPlayer(widgetID, view, data, style);
            }, 100);
        }

       $("#playListContainer").audioControls(
		   {
			   autoPlay : false,
			   timer: 'increment',
			   onAudioChange : function(response){
				   $('.songPlay').text(response.title + ' ...'); //Song title information
			   },
			   onVolumeChange : function(vol){
				   var obj = $('.volume');
				   if(vol <= 0){
					   obj.attr('class','volume mute');
				   }
				   else if(vol <= 33)
				   {
					   obj.attr('class','volume volume1');
				   }
				   else if(vol > 33 && vol <= 66)
				   {
					   obj.attr('class','volume volume2');
				   }
				   else if(vol > 66)
				   {
					   obj.attr('class','volume volume3');
				   }
				   else
				   {
					   obj.attr('class','volume volume1');
				   }
			   }
		   });

	},
/***********************************************************************/
	createWidget: function (widgetID, view, data, style) {
        var $div = $('#' + widgetID);
        // if nothing found => wait
        if (!$div.length) {
            return setTimeout(function () {
                vis.binds.kodi.createWidget(widgetID, view, data, style);
            }, 100);
        }

        var text = '';
        text += 'OID: ' + data.oid + '</div><br>';
        text += 'OID value: <span class="myset-value">' + vis.states[data.oid + '.val'] + '</span><br>';
        text += 'Color: <span style="color: ' + data.myColor + '">' + data.myColor + '</span><br>';
        text += 'extraAttr: ' + data.extraAttr + '<br>';
        text += 'Browser instance: ' + vis.instance + '<br>';
        text += 'htmlText: <textarea readonly style="width:100%">' + (data.htmlText || '') + '</textarea><br>';

        $('#' + widgetID).html(text);

        // subscribe on updates of value
        if (data.oid) {
            vis.states.bind(data.oid + '.val', function (e, newVal, oldVal) {
                $div.find('.kodi-value').html(newVal);
            });
        }
    }
};
	/*if (vis.editMode) {
		vis.binds.kodi.changeOid = function (widgetID, view, newId, attr, isCss) {
			//console.log('---------: ' + widgetID +' - '+view+' - '+newId+' - '+attr+' - '+isCss);
			newId = newId ? newId.substring(0, newId.length - attr.length + 'oid_'.length) : '';
			var changed = [];
			for (var s in vis.binds.kodi.states) {
				if (s === 'oid_curtime' || !vis.binds.kodi.states[s].objName) continue;
				if (vis.objects[newId + vis.binds.kodi.states[s].objName]) {
					changed.push(s);
					vis.views[view].widgets[widgetID].data[s] 	= newId + vis.binds.kodi.states[s].objName;
					vis.widgets[widgetID].data[s] 				= newId + vis.binds.kodi.states[s].objName;
				}
			}
			return changed;
	};
}*/

vis.binds.kodi.showVersion();
