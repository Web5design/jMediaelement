/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function($){
	jQuery.multimediaSupport = {};
	var m 	= $.multimediaSupport,
		vID = new Date().getTime(),
		doc	= document
	;
	$.support.video = !!($('<video />')[0].canPlayType);
	$.support.audio = !!($('<audio />')[0].canPlayType);
	$.support.mediaElements = ($.support.video && $.support.audio);
	
	
	var oldAttr 		= $.attr,
		attrElems 		= /video|audio|source/i,
		srcNames 		= {
					src: true,
					poster: true
				},
		booleanNames 	= {
					loop: true,
					autoplay: true,
					controls: true,
					autobuffer: true
				},
		mixedNames 		= {
			srces: true,
			getConfig: true
		}
	;
	
	$.attr = function(elem, name, value, pass){
		
		if( !(elem.nodeName && attrElems.test(elem.nodeName) && (mixedNames[name] || $.multimediaSupport.attrFns[name] || booleanNames[name] || srcNames[name])) ){
			return oldAttr(elem, name, value, pass);
		}
		
		var set = (value !== undefined), elemName, api, ret;
		
		if($.multimediaSupport.attrFns[name]){
			
			api = $.data(elem, 'mediaElemSupport');
			if( !api ) {
				return oldAttr(elem, name, value, pass);
			} else {
				ret = api.apis[api.name][name](value, pass);
				if(!set){
					return ret;
				}
			} 
		}
		if(!set){
			if(booleanNames[name]){
				return ( typeof elem[name] === 'boolean' ) ? elem[name] : !!((elem.attributes[name] || {}).specified);
			}
			if(srcNames[name]){
				return $.support.video && elem[name] || m.helper.makeAbsURI(elem.getAttribute(name));
			}
			if(name === 'srces'){
				ret = $.attr(elem, 'src');
				if( ret ){
					ret = [{
							src: ret,
							type: elem.getAttribute('type'),
							media: elem.getAttribute('media')
						}]
					;
				} else {
					ret = [];
					$('source', elem).each(function(i){
						ret.push({
							src: $.attr(this, 'src'),
							type: this.getAttribute('type'),
							media: this.getAttribute('media')
						});
					});
					// safari without quicktime ignores source-tags, initially
					if(!ret.length){
						$('a.source', elem).each(function(){
							ret.push({
								src: this.href,
								type: this.getAttribute('type'),
								media: this.getAttribute('data-media')
							});
						});
					}
				}
				return ret;
			} 
			if(name === 'getConfig'){
				ret = {};
				$.each(['autobuffer', 'autoplay', 'loop', 'controls', 'poster'], function(i, name){
					ret[name] = $.attr(elem, name);
				});
				return ret;
			}
		} else {
			if(booleanNames[name]){
				value = !!(value);
				elem[name] = value;
				if(value){
					elem.setAttribute(name, name);
					elem[name] = value;
				} else {
					elem.removeAttribute(name);
					elem[name] = value;
				}
			} else if(srcNames[name]){
				elem.setAttribute(name, value);
			} else if (name === 'srces') {
				$('source, a.source', elem).remove();
				elem.removeAttribute('src');
				value = $.isArray(value) ? value : [value];
				
				$.each(value, function(i, src){
					
					ret = doc.createElement('source');
					if(typeof src === 'string'){
						src = {src: src};
					}
					ret.setAttribute('src', src.src);
					if(src.type){
						ret.setAttribute('type', src.type);
					}
					if(src.media){
						ret.setAttribute('media', src.media);
					}
					elem.appendChild(ret);
				});
			} else if(name === 'getConfig'){
				//works, but you shouldn´t use as a setter
				$.each(value, function(n, v){
					$.attr(elem, n, v);
				});
			}
		}
	};
	
	function sourceError(){
		$.event.special.mediaerror.handler.apply($(this).closest('video, audio')[0], arguments);
	}
	
	function bindSource(e){
		if(!$.support.mediaElements){return;}
		var apis = $.data(this, 'mediaElemSupport');
		if(!apis || !apis.apis){return;}
		apis = apis.apis;
		
		//webkit is really stupid with the error event, so fallback to canPlaytype
		var elem 	= this,
			srces 	= $.attr(this, 'srces')
		;
		
		if(srces.length && !apis.nativ.canPlaySrces(srces)){
			setTimeout(function(){
				$(elem).triggerHandler('mediaerror');
			}, 0);
			//stop trying to play
			try {
				elem.pause();
			} catch(er){}
		}
		
		// we don´t need loadstart workaround
		if(e && e.type === 'emptied' && e.orginalEvent && e.orginalEvent.type === 'emptied'){
			$(this).unbind('loadstart', bindSource);
		}
		//END: webkit workaround
		
		//bind error 
		$('source', this)
			.unbind('error', sourceError)
			.filter(':last')
			.bind('error', sourceError)
		;
	}
	
	$.event.special.mediaerror = {
		setup: function(){
			//ff always triggers an error on video/audio | w3c/webkit/opera triggers error event on source, if available
			$(this)
				.bind('error', $.event.special.mediaerror.handler)
				.each(bindSource)
				.bind('emtptied', bindSource)
			;
			//some webkit do not support emptied
			$(this).bind('loadstart', bindSource);
		},
		teardown: function(){
			$(this)
				.unbind('error', $.event.special.mediaerror.handler)
				.find('source')
				.unbind('error', sourceError)
			;
		},
		handler: function(e){
			e = $.extend({}, e || {}, {type: 'mediaerror'});
			return $.event.handle.apply(this, arguments);
		}
	};
	
	function getExt(src){
		var pos = (src.indexOf('?') + 1),
			ext = ''
		;
		src = (pos) ? src.substring(0, pos) : src;
		pos = src.lastIndexOf('.') + 1;
		ext = src.substr(pos);
		return ext;
	}
	
	var mimeTypes = {
			audio: {
				//oga shouldn´t be used!
				'application/ogg': ['ogg','oga', 'ogm'],
				'audio/mpeg': ['mp2','mp3','mpga','mpega'],
				'audio/mp4': ['mp4','mpg4'],
				'audio/wav': ['wav'],
				'audio/x-m4a': ['m4a'],
				'audio/x-m4p': ['m4p']
			},
			video: {
				//ogv shouldn´t be used!
				'application/ogg': ['ogg','ogv', 'ogm'],
				'video/mpeg': ['mpg','mpeg','mpe'],
				'video/mp4': ['mp4','mpg4', 'm4v'],
				'video/quicktime': ['mov','qt'],
				'video/x-msvideo': ['avi'],
				'video/x-ms-asf': ['asf', 'asx'],
				'video/flv': ['flv', 'f4v']
			}
		}
	;
	
	$.extend($.multimediaSupport, {
		registerMimetype: function(elemName, mimeObj){
			if(arguments.length === 1){
				$.each(mimeTypes, function(name){
					m.registerMimetype(name, elemName);
				});
				return;
			}
			$.each(mimeObj, function(mime, exts){
				if(mimeTypes[elemName][mime]){
					mimeTypes[elemName][mime] = [];
				}
				mimeTypes[elemName][mime] = mimeTypes[elemName][mime].concat(exts);
			});
			
		},
		_showMimeTypes: function(){
			if(window.console){
				console.log(mimeTypes);
			}
		},
		attrFns: {},
		add: function(name, elemName, api){
			if(!this.apis[elemName][name]){
				this.apis[elemName][name] = m.helper.beget(this.apiProto);
				if(name !== 'nativ' && $.inArray(name, $.fn.mediaElementEmbed.defaults.apiOrder) === -1){
					$.fn.mediaElementEmbed.defaults.apiOrder.push(name);
				}
			} 
			$.extend(true, this.apis[elemName][name], api);
		},
		apiProto: {
			_init: function(){},
			canPlayType: function(type){
				var elem = this.apiElem;
				if(elem && elem.canPlayType){
					return elem.canPlayType(type);
				}
				var parts 	= m.helper.extractContainerCodecsFormType(type),
					that 	= this,
					ret		= 'probably'
				;
				if(!parts[1]){
					return (this.canPlayContainer && $.inArray(parts[0], this.canPlayContainer) !== -1) ? 'maybe' : '';
				}
				$.each(parts[1], function(i, part){
					if(!that.canPlayCodecs || $.inArray(part, that.canPlayCodecs) === -1){
						ret = '';
						return false;
					}
				});
				return ret;
			},
			canPlaySrc: function(src){
				var that = this;
				if(typeof src !== 'string'){
					if(src.type){
						return this.canPlayType(src.type);
					}
					src = src.src;
				}
				
				var ext = getExt(src), ret = '';
				$.each(mimeTypes[this.nodeName], function(mime, exts){
					var index = $.inArray(ext, exts);
					if(index !== -1){
						ret = that.canPlayType(mime);
						return false;
					}
				});
				return ret;
			},
			canPlaySrces: function(srces){
				srces = srces || $.attr(this.html5elem, 'srces');
				if(!$.isArray(srces)){
					srces = [srces];
				}
				var that 	= this,
					canplay = false,
					src 	= ''
				;
				$.each(srces, function(i, curSrc){
					canplay = that.canPlaySrc(curSrc);
					if(canplay){
						src = curSrc;
						return false;
					}
				});
				return src;
			},
			_setActive: function(fromAPI){},
			_setInactive: function(fromAPI){}
		},
		apis: {
			audio: {},
			video: {}
		},
		
		helper: {
			extractContainerCodecsFormType: function(type){
				var types = type.split(/\s*;\s*/g);
				if(types[1] && types[1].indexOf('codecs') !== -1){
					types[1] = types[1].replace(/["|']$/, '').replace(/^\s*codecs=('|")/, '').split(/\s*,\s*/g);
				}
				return types;
			},
			makeAbsURI: (function(){
				return function(src){
					if(src && typeof src === 'string'){
						src = $('<a href="'+ src +'"></a>')[0].href;
					}
					return src;
				};
			})(),
			beget: function(sup){
				var F = function(){};
				F.prototype = sup;
				return new F();
			},
			_create: function(elemName, supType, html5elem, opts){
				var data = $.data(html5elem, 'mediaElemSupport') || $.data(html5elem, 'mediaElemSupport', {apis: {}, nodeName: elemName});
				if(!data.apis[supType]){
					data.apis[supType] = m.helper.beget( m.apis[elemName][supType]);
					data.apis[supType].html5elem = html5elem;
					data.apis[supType].nodeName = elemName;
					data.apis[supType].name = supType;
					data.apis[supType].data = {};
					data.apis[supType].embedOpts = opts;
				}
				return data;
			},
			_setAPIActive: function(html5elem, supType){
				var data 		= $.data(html5elem, 'mediaElemSupport'),
					oldActive 	= data.name
				;
				if(oldActive === supType){return true;}
				
				var hideElem = data.apis[oldActive].apiElem,
					showElem = data.apis[supType] && data.apis[supType].apiElem,
					apiReady = false
				;
				
				if(showElem && showElem.nodeName){
					if(data.nodeName !== 'audio' || $.attr(html5elem, 'controls')){
						showElem.style.display = '';
						if(supType !== 'nativ'){
							data.apis[supType].visualElem.css({
								width: $(data.apis[supType].html5elem).width(),
								height: $(data.apis[supType].html5elem).height(),
								visibility: ''
							});
						}
					}
					data.apis[supType]._setActive(oldActive);
					apiReady = true;
				}
				
				if(hideElem && hideElem.nodeName){
					if(oldActive === 'nativ'){
						hideElem.style.display = 'none';
					} else {
						data.apis[oldActive].visualElem.css({
							height: 0,
							width: 0,
							overflow: 'hidden',
							visibility: 'hidden'
						});
					}
					data.apis[oldActive]._setInactive(supType);
				}
				
				data.name = supType;
				
				return apiReady;
			}
		},
		getSuitedPlayers: function(elem, apiOrder){
			var apis = $.data(elem, 'mediaElemSupport');
			if(!apis || !apis.apis){return;}
			apis = apis.apis;
			var srces 		= $.attr(elem, 'srces'),
				supported 	= false,
				getSupported = function(name, api){
					if( !api.isTechAvailable || ( $.isFunction(api.isTechAvailable) && !api.isTechAvailable() ) ){
						return;
					}
					var src = api.canPlaySrces(srces);
					
					if(src){
						supported = {
							src: src.src || src,
							name: name
						};
					}
					return supported;
				}
			;
			if(!srces.length){return 'noSource';}
			if(apiOrder){
				$.each(apiOrder, function(i, name){
					return !(getSupported(name, apis[name]));
				});
			} else {
				$.each(apis, function(name, api){
					return !(getSupported(name, api));
				});
			}
			return supported;
		},
		_embedApi: function(elem, supported, apiData){
			var config 	= $.attr(elem, 'getConfig'),
				jElm 	= $(elem),
				dims 	= {},
				id 		= elem.id,
				fn 		= function(apiElem){
							apiData.apis[supported.name].apiElem = apiElem;
							$(apiElem).addClass(apiData.nodeName);
							apiData.apis[supported.name]._init();
						}
			;
			
			if(!id){
				vID++;
				id = apiData.nodeName +'-'+vID;
				elem.id = id;
			}
			apiData.apis[supported.name].visualElem = $('<div class="media-element-box mm-'+ apiData.nodeName +'-box" />').insertAfter(elem);
			if(apiData.nodeName === 'audio' && !config.controls){
				apiData.apis[supported.name].visualElem
					.css({
						height: 0,
						width: 0,
						overflow: 'hidden'
					})
				;
			} else {
				apiData.apis[supported.name].visualElem
					.css({
							width: jElm.width(),
							height: jElm.height()
					})
				;
			}
			apiData.apis[supported.name]._embed(supported.src, apiData.name +'-'+ id, config, fn);
		},
		getPluginVersion: function(name){
			var plugin 	= (navigator.plugins && navigator.plugins[name]),
				version = -1,
				description
			;
			if(plugin){
				description = (plugin.description || '').match(/(\d+\.\d+)/) || ['0'];
				if(description && description[0]){
					version = parseFloat(description[0], 10);
				}
			}
			return version;
		},
		embedObject: function(elem, id, attrs, params, activeXAttrs){
			elem = $('<div />').appendTo(elem)[0];
			var obj;
			
			if(!window.ActiveXObject || !elem.outerHTML){
				obj = doc.createElement('object');
				$.each(attrs, function(name, val){
					obj.setAttribute(name, val);
				});
				
				$.each(params, function(name, val){
					var param = doc.createElement('param');
					param.setAttribute('name', name);
					param.setAttribute('value', val);
					obj.appendChild(param);
				});
				obj.setAttribute('id', id);
				obj.setAttribute('name', id);
				elem.parentNode.replaceChild(obj, elem);
			} else {
				obj = '<object';
				$.each($.extend({}, attrs, activeXAttrs), function(name, val){
					obj += ' '+ name +'="'+ val +'"';
				});
				obj += ' name="'+ id +'"';
				obj += ' id="'+ id +'"';
				obj += '>';
				$.each(params, function(name, val){
					obj += ' <param name="'+ name +'" value="'+ val +'" />';
				});
				obj += '</object>';
				elem.outerHTML = obj;
				obj = doc.getElementById(id);
			}
			if(obj){
				obj.setAttribute('width', '100%');
				obj.setAttribute('height', '100%');
				obj.style.display.width = '100%';
				obj.style.display.height = '100%';
			}
			$(window).unload(function(){
				jQuery.cleanData( [ obj ] );
				obj = null;
			});
			return obj;
		}
	});
	
	m.add('nativ', 'video', {});
	m.add('nativ', 'audio', {});
	
	function findInitFallback(elem, opts){
		var elemName 	= elem.nodeName.toLowerCase();
		
		//getSupportedSrc and Player
		var supported = m.getSuitedPlayers(elem, opts.apiOrder),
			apiData	= $.data(elem, 'mediaElemSupport')
		;
		
		// important total fail error event
		if(!supported){
			apiData.apis.nativ._trigger({type: 'totalerror'});
			try {
				elem.pause();
			} catch(e){}
			return;
		}
		if(supported === 'noSource'){return;}
		//returns false if player isn´t embeded
		if(!m.helper._setAPIActive(elem, supported.name)){
			m._embedApi(elem, supported, apiData, elemName);
		}
	}
	
	
	
	function loadedmetadata(e){
		$(this).trigger('multiMediaAPIIsReady');
	}
	
	$.fn.mediaElementEmbed = function(opts){
		opts = $.extend(true, {}, $.fn.mediaElementEmbed.defaults, opts);
		
		return this.each(function(){
			var elemName 	= this.nodeName.toLowerCase();
			
			if(elemName !== 'video' && elemName !== 'audio'){return;}
			var elem = this;
			if(opts.removeControls){
				this.controls = false;
				$(this).removeAttr('controls');
			}
			
			var apiData = m.helper._create(elemName, 'nativ', this, opts);
			
			apiData.name = 'nativ';
			apiData.apis.nativ.apiElem = this;
			$.each(m.apis[elemName], function(name){
				if(name !== 'nativ'){
					m.helper._create(elemName, name, elem, opts);
				}
			});
			if(opts.debug || !$.support.mediaElements || this.error){
				 findInitFallback(this, opts);
			} else {
				apiData.apis[apiData.name]._init();
			}
			$(this)
				.bind('mediaerror', function findInitFallbackOnError(e){
					
					if(apiData.name === 'nativ'){
						findInitFallback(this, opts);
					}
				})
				.bind('loadedmetadata', loadedmetadata)
			;
		});
	};
	
	$.fn.mediaElementEmbed.defaults = {
		debug: false,
		removeControls: false,
		apiOrder: []
	};
	
	
	if($.cleanData){
		var _cleanData = $.cleanData;
		$.cleanData = function(elems){
			_cleanData(elems);
			for(var i = 0, len = elems.length; i < len; i++){
				if(elems[i].nodeName === 'OBJECT'){
					try {
						for (var j in elems[i]) {
							if (typeof elems[i][j] === "function") {
								elems[i][j] = null;
							}
						}
					} catch(e){}
				}
			}
		};
	}
	
})(jQuery);/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function($){
	
	function bindState(jElm, con, evt, fn, bindStyle){
		bindStyle = bindStyle || 'bind';
		if(con){
			fn();
		} else if(bindStyle === 'one'){
			jElm.one(evt, fn);
		}
		if(!con || bindStyle !== 'one'){
			jElm.bind(evt, fn);
		}
	}
	
	var toggleModells = {
		'play-pause': {stateMethod: 'isPlaying', actionMethod: 'togglePlay', evts: 'play playing pause ended', trueClass: 'ui-icon-pause', falseClass: 'ui-icon-play'},
		'mute-unmute': {stateMethod: 'muted', actionMethod: 'toggleMuted', evts: 'mute', trueClass: 'ui-icon-volume-off', falseClass: 'ui-icon-volume-on'}
	};
	var sliderMethod = ($.fn.a11ySlider) ? 'a11ySlider' : 'slider';
	var split = /\s*\/\s*|\s*\|\s*/,
		controls = {
			'timeline-slider': function(control, mm, api, o){
				var stopSlide = false;
				control[sliderMethod](o.timeSlider)[sliderMethod]('option', 'disabled', true);
				
				function changeTimeState(e, ui){
					if(ui.timeProgress !== undefined && !stopSlide){
						control[sliderMethod]('value', ui.timeProgress);
					}
				}
				
				function changeDisabledState(e){
					if(api.apis[api.name].loadedmeta && api.apis[api.name].loadedmeta.duration){
						control[sliderMethod]('option', 'disabled', false);
					} else {
						control[sliderMethod]('option', 'disabled', true);
					}
				}
				
				bindState(mm, api.apis[api.name].isAPIReady, 'mmAPIReady', function(){
					mm
						.bind('emptied loadedmeta', changeDisabledState)
						.bind('timechange', changeTimeState)
					;
					control
						.bind('slidestart', function(e, ui){
							if (e.originalEvent) {
								stopSlide = true;
							}
						})
						.bind('slidestop', function(e, ui){
							stopSlide = false;
						})
						.bind('slide', function(e, ui){
							if(e.originalEvent){
								api.apis[api.name].relCurrentTime(ui.value);
							}
						})
					;
					
					changeDisabledState();
				}, 'one');
				
			},
			'volume-slider': function(control, mm, api, o){
				var stopSlide = false;
				control[sliderMethod](o.volumeSlider)[sliderMethod]('option', 'disabled', true);
				
				function changeVolumeUI(e, ui){
					if(!stopSlide){
						control[sliderMethod]('value', ui.volumelevel);
					}
				}
				
				bindState(mm, api.apis[api.name].isAPIReady, 'mmAPIReady', function(){
					mm.bind('volumelevelchange', changeVolumeUI);
					control
						.bind('slidestart', function(e, ui){
							if (e.originalEvent) {
								stopSlide = true;
							}
						})
						.bind('slidestop', function(e, ui){
							stopSlide = false;
						})
						.bind('slide', function(e, ui){
							if(e.originalEvent){
								api.apis[api.name].volume(ui.value);
							}
						})
					;
					control[sliderMethod]('option', 'disabled', false);
					control[sliderMethod]('value', api.apis[api.name].volume());
					
				}, 'one');
			},
			'progressbar': function(control, mm, api, o){
				control.progressbar(o.progressbar).progressbar('option', 'disabled', true);
				
				function changeProgressUI(e, ui){
					if (ui.lengthComputable) {
						control.progressbar('option', 'disabled', false).progressbar('value', ui.relLoaded);
					} else {
						control.progressbar('option', 'disabled', true);
					}
				}
				
				function resetProgress(e, ui){
					control.progressbar('option', 'disabled', true).progressbar('value', 0);
				}
				
				bindState(mm, api.apis[api.name].isAPIReady, 'mmAPIReady', function(){
					mm
						.bind('progresschange', changeProgressUI)
						.bind('emptied', resetProgress)
					;
				}, 'one');
				
			},
			duration: function(control, mm, api, o){
				if(o.addThemeRoller){
					control.addClass('ui-widget-content ui-corner-all');
				}
				control.html('--:--');
				mm.bind('loadedmeta emptied', function(e, evt){
					control.html(api.apis[api.name]._format(evt.duration));
				});
				bindState(mm, api.apis[api.name].isAPIReady, 'mmAPIReady', function(){
					control.html(api.apis[api.name].getFormattedDuration());
				}, 'one');
				
			},
			'current-time': function(control, mm, api, o){
				if(o.addThemeRoller){
					control.addClass('ui-widget-content ui-corner-all');
				}
				control.html('--:--');
				mm.bind('timechange', function(e, evt){
					control.html(api.apis[api.name]._format(evt.time));
				});
				bindState(mm, api.apis[api.name].isAPIReady, 'mmAPIReady', function(){
					control.html(api.apis[api.name].getFormattedTime());
				}, 'one');
			},
			'media-controls': function(control, mm, api, o){
				if(o.addThemeRoller){
					control.addClass('ui-widget ui-widget-header ui-corner-all');
				}
				
				function calcSlider(){
					var space 		= control.innerWidth() + o.mediaControls.timeSliderAdjust,
						occupied 	= timeSlider.outerWidth(true) - timeSlider.innerWidth()
					;
					$('> *', control).each(function(){
						if(timeSlider[0] !== this && this.offsetWidth){
							occupied += $(this).outerWidth(true);
						}
					});
					timeSlider.css('width', space - occupied);
				}
				
				if(o.mediaControls.dynamicTimeslider){
					var timeSlider  = $('.'+ o.classPrefix +'timeline-slider', control),
						calcTimer	= setTimeout(calcSlider, 0)
					;
					
					bindState(mm, api.apis[api.name].isAPIReady, 'mmAPIReady', function(){
						clearInterval(calcTimer);
						setTimeout(calcSlider, 0);
					}, 'one');
					$(window).bind('resize', calcSlider);
					mm.bind('resize emchange', calcSlider);
				}
			}
		}
	;
	
	//create Toggle Button UI
	$.each(toggleModells, function(name, opts){
		controls[name] = function(control, mm, api, o){
			var iconElem 	= $('.ui-icon', control),
				textElem 	= $('.button-text', control),
				stateNames 	= textElem.text().split(split),
				that 		= this
			;
			
			if(o.addThemeRoller){
				control.addClass('ui-state-default ui-corner-all');
			}
			
			if(!iconElem[0]){
				iconElem = control;
			}
			if(!textElem[0]){
				textElem = control;
			}
			if(stateNames.length < 2){
				stateNames = [stateNames[0], stateNames[1]];
			}
			
			function changeState(e, ui){
				var state = api.apis[api.name][opts.stateMethod]();
				
				if(state){
					textElem.text(stateNames[1]);
					iconElem.addClass(opts.trueClass).removeClass(opts.falseClass);
				} else {
					textElem.text(stateNames[0]);
					iconElem.addClass(opts.falseClass).removeClass(opts.trueClass);
				}
			}
			
			bindState(mm, api.apis[api.name].isAPIReady, 'mmAPIReady', function(){
				mm.bind(opts.evts, changeState);
				changeState();
			}, 'one');
			control.bind('click', function(e){
				api.apis[api.name][opts.actionMethod]();
				e.preventDefault();
			});
		};
	});
	
	
	
	function getElems(elem, o){
		var jElm 	= $(elem),
			ret 	= {},
			mmID 	= jElm.attr('data-controls')
		;
		
		ret.mm = (mmID) ? $('#'+ mmID) : $('video, audio', jElm).filter(':first');
		ret.api = ret.mm.getMMAPI(true) || ret.mm.mediaElementEmbed(o.embed).getMMAPI(true);
		if(jElm.is(o.controlSel)){
			ret.controls = jElm;
		} else {
			ret.controlsgroup = jElm;
			ret.controls = $(o.controlSel, jElm);
			ret.api.controlWrapper = jElm;
		}
		ret.api.controls = (ret.api.controls) ? ret.api.controls.add(ret.controls) : ret.controls;
		return ret;
	}
	
	$.fn.registerMMControl = function(o){
		o = $.extend(true, {}, $.fn.registerMMControl.defaults, o);
		o.controlSel = [];
		$.each(controls, function(name){
			if(name !== 'media-controls'){
				o.controlSel.push('.'+ o.classPrefix + name);
			}
		});
		o.controlSel.push('.'+ o.classPrefix + 'media-controls');
		o.controlSel = o.controlSel.join(', ');
		function registerControl(){
			var elems = getElems(this, o);
			
			if(!elems.api){return;}
			elems.controls.each(function(){
				var jElm = $(this);
				$.each(controls, function(name, ui){
					if( jElm.hasClass(o.classPrefix+name) ){
						ui(jElm, elems.mm, elems.api, o);
						return false;
					}
				});
			});
		}
		
		return this.each(registerControl);
	};
	
	$.fn.registerMMControl.defaults = {
		//common
		embed: $.fn.mediaElementEmbed.defaults,
		classPrefix: '',
		addThemeRoller: true,
		
		mediaControls: {
			dynamicTimeslider: true,
			timeSliderAdjust: 0
		},
		progressbar: {},
		volumeSlider: {},
		timeSlider: {}
	};
	
	$.fn.registerMMControl.addControl = function(name, fn){
		controls[name] = fn;
	};
})(jQuery);/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function($){
	$.extend($.fn.mediaElementEmbed.defaults, 
			{
				jwPlayer: {
					path: 'player.swf',
					vars: {},
					attrs: {},
					params: {
						allowscriptaccess: 'always',
						allowfullscreen: 'true'
					}
				}
			}
		)
	;
	
	var swfAttr = {type: 'application/x-shockwave-flash'},
		aXAttrs = {classid: 'clsid:D27CDB6E-AE6D-11cf-96B8-444553540000'},
		m 		= $.multimediaSupport,
		jwMM 	= {
			//isTechAvailable: swfobject.hasFlashPlayerVersion('9.0.124'),
			isTechAvailable: function(){
				if($.support.flash9 !== undefined){
					return $.support.flash9;
				}
				$.support.flash9 = false;
				var swf = m.getPluginVersion('Shockwave Flash');
				if(swf >= 9){
					$.support.flash9 = true;
				} else if(window.ActiveXObject){
					try {
						swf = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
						if(!swf){return;}
						swf = swf.GetVariable("$version").match(/(\d+\,\d+)/);
						if(swf && swf[0]){
							if( parseFloat( swf[0].replace(',', '.' ), 10) >= 9){
								$.support.flash9 = true;
							}
						}
					} catch(e){}
				}
				return $.support.flash9;
			},
			_embed: function(src, id, cfg, fn){
				var opts 		= this.embedOpts.jwPlayer,
					vars 		= $.extend({}, opts.vars, {file: src, id: id}),
					attrs	 	= $.extend({name: id, data: opts.path}, opts.attrs, swfAttr),
					params 		= $.extend({movie: opts.path}, opts.params)
				;
				
				if(cfg.poster){
					vars.image = cfg.poster;
				}
				vars.autostart = ''+ cfg.autoplay;
				vars.repeat = (cfg.loop) ? 'single' : 'false';
				vars.controlbar = (cfg.controls) ? 'bottom' : 'none';
				
				if( (opts.playFirstFrame || cfg.autobuffer) && !cfg.poster && !cfg.autoplay ){
					this.data.playFirstFrame = true;
					vars.autostart = 'true';
				}
				params.flashvars = [];
				$.each(vars, function(name, val){
					params.flashvars.push(name+'='+val);
				});
				params.flashvars = params.flashvars.join('&');
				fn(m.embedObject( this.visualElem[0], id, attrs, params, aXAttrs ));
			},
			canPlayCodecs: ['avc1.42E01E', 'mp4a.40.2', 'avc1.58A01E', 'avc1.4D401E', 'avc1.64001E'],
			canPlayContainer: ['video/x-msvideo', 'video/quicktime', 'video/x-m4v', 'video/mp4', 'video/m4p', 'video/x-flv', 'video/flv', 'audio/mpeg', 'audio/mp3', 'audio/x-fla', 'audio/fla']
		}
	;
	
	m.add('jwPlayer', 'video', jwMM);
	m.add('jwPlayer', 'audio', jwMM);
	
})(jQuery);
/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function($){
	var doc = document,
		rep = /^jwPlayer-/
	;
	
	function getAPI(id){
		id = id.replace(rep, '');
		return $.data(doc.getElementById(id), 'mediaElemSupport').apis.jwPlayer;
	}
	var privJwEvents = {
		View: {
			PLAY: function(obj){
				var api = obj.state && getAPI(obj.id);
				if(!api){return;}
				api._trigger('play');
			}
		},
		Model: {
			META: function(obj){
				if(obj.type === 'metadata'){
					var api = getAPI(obj.id);
					if(!api){return;}
					api._trigger({
						type: 'loadedmeta',
						duration: obj.duration
					});
				}
				
			},
			TIME: function(obj){
				var api = getAPI(obj.id),
					e 	= {
							type: 'timechange',
							time: obj.position
						}
				;
				if(!api){return;}
				
				//workaround: meta isn´t triggered on audio
				if(!api.loadedmeta){
					api._trigger({
						type: 'loadedmeta',
						duration: obj.duration
					});
				}
				
				
				api.currentPos = obj.position;
				if(obj.duration){
					e.duration = obj.duration;
					e.timeProgress = obj.position / obj.duration * 100;
				}
				if(obj.position && api.data.playFirstFrame && !api.data.playThrough){
					api.pause();
					api.data.playThrough = true;
				}
				api._trigger(e);
			},
			STATE: function(obj){
				if(obj.newstate === 'IDLE'){
					return false;
				}
				var api = getAPI(obj.id),
					type
				;
				if(!api){return false;}
				
				switch(obj.newstate) {
					case 'PLAYING':
						type = 'playing';
						break;
					case 'PAUSED':
						type = 'pause';
						break;
					case 'COMPLETED':
						type = 'ended';
						break;
					case 'BUFFERING':
						type = 'waiting';
					break;
				}
				
				if(type){
					api._trigger(type);
				}
				return type;
			}
		},
		Controller: {
			VOLUME: function(obj){
				var api = getAPI(obj.id);
				if(!api){return;}
				api._trigger({type: 'volumelevelchange', volumelevel: obj.percentage});
			},
			MUTE: function(obj){
				var api = getAPI(obj.id);
				if(!api){return;}
				api._trigger({type: 'mute', isMuted: obj.state});
			}
		}
	};
	window.jwEvents = {
		four: $.extend(true, {}, privJwEvents, {
			Model: {
				LOADED: function(obj){
					var api = getAPI(obj.id);
					if(!api){return;}
					var evt = {
						type: 'progresschange',
						lengthComputable: !!(obj.total),
						loaded: obj.loaded
					};
					if(obj.total){
						$.extend(evt, {
							total: obj.total,
							relLoaded: obj.total / obj.loaded * 100
						});
					}
					api._trigger(evt);
				}
			}
			
		}),
		// version five is a little bit buggy, the following methods are al workarounds
		five: $.extend(true, {}, privJwEvents, {
			Model: {
				BUFFER: function(obj){
					var api = getAPI(obj.id);
					if(!api){return;}
					var evt = {
						type: 'progresschange',
						lengthComputable: !!(isFinite(obj.percentage)),
						relLoaded: obj.percentage
					};
					api._trigger(evt);
				},
				STATE: function(obj){
					var state = privJwEvents.Model.STATE(obj);
					if(state === 'playing'){
						api._trigger('play');
					}
				}
			}
		})
	};
	
	window.playerReady = function (obj) {
		
		var api = getAPI(obj.id);
		if(api){
			var apiVersion = (parseInt(obj.version, 10) > 4)? 'five' : 'four';
			//add events
			$.each(jwEvents[apiVersion], function(mvcName, evts){
				$.each(evts, function(evtName){
					api.apiElem['add'+ mvcName +'Listener'](evtName, 'jwEvents.'+ apiVersion +'.'+ mvcName +'.'+ evtName);
				});
				
			});
			
			api._trigger('mmAPIReady');
		}		
	};
	
	var jwAPI = {
		play: function(){
			this.data.playThrough = true;
			this.apiElem.sendEvent('PLAY', 'true');
			this._trigger('play');
		},
		pause: function(){
			this.apiElem.sendEvent('PLAY', 'false');
		},
		isPlaying: function(){
			var cfg = this.apiElem.getConfig();
			return (cfg) ? (cfg.state === 'PLAYING' ) : undefined;
		},
		_mmload: function(src, poster, extras){
			this.apiElem.sendEvent('LOAD', src);
			if (!$.attr(this.html5elem, 'autoplay')) {
				this.apiElem.sendEvent('PLAY', 'false');
			}
		},
		muted: function(state){
			if(typeof state !== 'boolean'){
				var cfg = this.apiElem.getConfig();
				return (cfg || {}).mute;
			} 
			this.apiElem.sendEvent('mute', (state) ? 'true' : false);
		},
		currentTime: function(t){
			if(!isFinite(t)){
				return this.currentPos || 0;
			}
			var isPlaying = (this.apiElem.getConfig().state === 'PLAYING');
			if(!isPlaying){
				this.apiElem.sendEvent('PLAY', 'true');
			}
			
			this.apiElem.sendEvent('SEEK', ''+t);
			if(!isPlaying){
				this.apiElem.sendEvent('PLAY', 'false');
			}
		},
		getDuration: function(){
			var t = this.apiElem.getPlaylist()[0].duration || 0;
			return t < 0 ? 0 : t;
		},
		volume: function(v){
			if(!isFinite(v)){
				return parseInt(this.apiElem.getConfig().volume, 10);
			}
			this.apiElem.sendEvent('VOLUME', ''+v);
		}
	};
	
	$.multimediaSupport.add('jwPlayer', 'video', jwAPI);
	$.multimediaSupport.add('jwPlayer', 'audio', jwAPI);
})(jQuery);
/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
(function($){
	$.extend($.fn.mediaElementEmbed.defaults, 
			{
				vlc: {
					params: {},
					attrs: {}
				}
			}
		)
	;
	
	var $m 				= $.multimediaSupport,
		defaultAttrs 	= {
			pluginspage: 'http://www.videolan.org',
			version: 'VideoLAN.VLCPlugin.2',
			progid: 'VideoLAN.VLCPlugin.2',
			events: 'true',
			type: 'application/x-vlc-plugin'
		},
		activeXAttrs 	= {
			classid: 'clsid:9BE31822-FDAD-461B-AD51-BE1D1C159921'
		}
	;
	
	var vlcMM = {
			isTechAvailable: function(){
				if($.support.vlc !== undefined){
					return $.support.vlc;
				}
				$.support.vlc = false;
				var vlc = $m.getPluginVersion('VLC Multimedia Plug-in');
				if(vlc >= 0.9){
					$.support.vlc = true;
				} else if(window.ActiveXObject){
					try {
						if(new ActiveXObject('VideoLAN.VLCPlugin.2')){
							$.support.vlc = true;
						}
					} catch(e){}
				}
				return $.support.vlc;
			},
			_embed: function(src, id, attrs, fn){
				var opts 	= this.embedOpts.vlc,
					vlcAttr = $.extend({}, opts.attrs, {width: '100%', height: '100%', src: src}, defaultAttrs),
					params 	= $.extend({}, opts.params, {
						src: src,
						showdisplay: 'true',
						autoplay: ''+ attrs.autoplay,//
						autoloop: ''+attrs.loop
					}),
					elem 	= $m.embedObject( this.visualElem[0], id, vlcAttr, params, activeXAttrs )
				;

				fn( elem );
				elem = null;
			},
			canPlayCodecs: ['avc1.42E01E', 'mp4a.40.2', 'avc1.58A01E', 'avc1.4D401E', 'avc1.64001E', 'theora', 'vorbis'],
			canPlayContainer: ['video/x-msvideo', 'video/quicktime', 'video/x-m4v', 'video/mp4', 'video/m4p', 'video/x-flv', 'video/flv', 'audio/mpeg', 'audio/x-fla', 'audio/fla', 'video/ogg', 'video/x-ogg', 'audio/x-ogg', 'audio/ogg', 'application/ogg', 'application/x-ogg']
		}
	;
			
	$m.add('vlc', 'video', vlcMM);
	$m.add('vlc', 'audio', vlcMM);
})(jQuery);
/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function($){
	function isReady(api){
		var timer;
		function testReady(){
			try{
				if(api.apiElem.input){
					queueEvent('mmAPIReady', api);
				} else {
					return;
				}
				clearInterval(timer);
				if($.attr(api.html5elem, 'autoplay')){
					interval.start(api);
				} else {
					api.apiElem.playlist.stop();
					setTimeout(function(){
						api.apiElem.playlist.stop();
					}, 0);
				}
			} catch(e){}
			
		}
		clearInterval(timer);
		timer = setInterval(testReady, 333);
		testReady();
	}
	
	function queueEvent(event, api){
		setTimeout(function(){
			api._trigger(event);
		}, 0);
	}
	
	var interval = {
		start: function(api){
			interval.end(api);
			api._intervalCheckTimer = setInterval(function(){
				api._intervalCheck.call(api);
			}, 1000);
		},
		end: function(api){
			if(api._intervalCheckTimer){
				clearInterval(api._intervalCheckTimer);
			}
		}
	};
	
	function queueCheck(api){
		setTimeout(function(){
			api._intervalCheck();
		}, 9);
	}
	
	var states = {
		2: 'waiting',
		3: 'playing',
		4: 'pause',
		6: 'ended'
	};
	
	var vlcAPI = {
		_init: function(){
			var api = this;
			isReady(api);
		},
		_intervalCheck: function(){
			var vlc 	= this.apiElem,
				state 	= vlc.input.state,
				api 	= this,
				meta 	= {
					type: 'loadedmeta',
					duration: vlc.input.length / 1000
				},
				evt
			;
			if((state && state > 1 && !this.data.metaLoaded) || (this.data.metaLoaded && this.data.metaLoaded.duration !== meta.duration)){
				queueEvent(meta, api);
				this.data.metaLoaded = meta;
			}
			
			evt = {
				type: 'timechange',
				time: vlc.input.time / 1000
			};
			
			if(state && state > 1 && this.data.time !== evt.time){
				if(meta.duration){
					evt.duration = meta.duration;
					evt.timeProgress = vlc.input.position * 100;
				}
				this.data.time = evt.time;
				queueEvent(evt, api);
			}
			
			evt = {
				type: 'mute',
				isMuted: vlc.audio.mute
			};
			
			if(evt.isMuted !== this.data.isMuted){
				this.data.isMuted = evt.isMuted;
				queueEvent(evt, api);
			}
			
			evt = {
				type: 'volumelevelchange',
				volumelevel: vlc.audio.volume / 2
			};
			
			if(evt.volumelevel !== this.data.volumelevel){
				this.data.volumelevel = evt.volumelevel;
				queueEvent(evt, api);
			}
			
			
			if(state !== this.data.state){
				this.data.state = state;
				if(states[state]){
					queueEvent(states[state], api);
				}
				if(states[state] === 'ended'){
					vlc.playlist.stop();
				}
				if(state === 3){
					interval.start(api);
				} else if(state === 4 || state === 5 || state === 6 || state === 7) {
					interval.end(api);
				}
			}
			
		},
		play: function(){
			this.apiElem.playlist.play();
			this._trigger('play');
			interval.start(this);
			queueCheck(this);
		},
		pause: function(){
			if(states[this.apiElem.input.state] === 'playing'){
				interval.end(this);
				this.apiElem.playlist.togglePause();
				queueCheck(this);
			}
		},
		isPlaying: function(){
			var ret = false;
			try {
				ret = states[this.apiElem.input.state] === 'playing';
			} catch(e){}
			return ret;
		},
		_mmload: function(src){
			$(this.html5elem).unbind('playing.enterFullscreen');
			this.apiElem.playlist.stop();
			this.data = {};
			var item = this.apiElem.playlist.add(src);
			this.apiElem.playlist.playItem(item);
			this.apiElem.playlist.items.clear();
			if(!$.attr(this.html5elem, 'autoplay')){
				interval.end(this);
				this.apiElem.playlist.stop();
			}
		},
		currentTime: function(t){
			try {
				if(!isFinite(t)){
					return this.apiElem.input.time / 1000;
				}
				this.apiElem.input.time = t * 1000;
				queueCheck(this);
			} catch(e){
				if(!isFinite(t)){
					return 0;
				}
			}
		},
		getDuration: function(){
			var dur;
			try {
				dur = this.apiElem.input.length / 1000 || 0;
			} catch(e){
				dur = 0;
			}
			return dur;
		},
		volume: function(v){
			if (!isFinite(v)) {
				return parseInt(this.apiElem.audio.volume / 2, 10);
			}
			this.apiElem.audio.volume = v * 2;
			queueCheck(this);
		},
		muted: function(state){
			if(typeof state !== 'boolean'){
				return this.apiElem.audio.mute;
			} 
			this.apiElem.audio.mute = state;
			queueCheck(this);
		}
	};
	
	$.multimediaSupport.add('vlc', 'video', $.extend({ 
			_videoFullscreen: true,
			enterFullScreen: function(){
				if(!this.isPlaying()){
					var that = this;
					$(that.html5elem).one('playing.enterFullscreen', function(){
						that.apiElem.video.fullscreen = true;
					});
					this.play();
				} else {
					this.apiElem.video.fullscreen = true;
				}
				
			},
			exitFullScreen: function(){
				this.apiElem.video.fullscreen = false;
			}
		}, vlcAPI)
	);
	$.multimediaSupport.add('vlc', 'audio', vlcAPI);
})(jQuery);
