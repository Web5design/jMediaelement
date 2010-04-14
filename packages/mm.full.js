/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function($){
	$.multimediaSupport = {};
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
					src: 1,
					poster: 1
				},
		booleanNames 	= {
					loop: 1,
					autoplay: 1,
					controls: 1
				},
		mixedNames 		= {
			srces: 1,
			getConfig: 1,
			preload: 1
		},
		preloadVals = {
			auto: 1,
			metadata: 1,
			none: 1
		} 
	;
	
	$.attr = function(elem, name, value, pass){
		
		if( !(elem.nodeName && attrElems.test(elem.nodeName) && (mixedNames[name] || m.attrFns[name] || booleanNames[name] || srcNames[name])) ){
			return oldAttr(elem, name, value, pass);
		}
		
		var set = (value !== undefined), elemName, api, ret;
		
		if(m.attrFns[name]){
			
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
				return $.support.video && elem[name] || m.makeAbsURI(elem.getAttribute(name));
			}
			switch(name) {
				case 'srces':
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
					break;
				case 'getConfig':
					ret = {};
					$.each(['autoplay', 'loop', 'controls', 'poster', 'preload'], function(i, name){
						ret[name] = $.attr(elem, name);
					});
					break;
				case 'preload':
					ret = elem.getAttribute('preload');
					if(!preloadVals[ret]){
						ret = 'auto';
					}
					break;
			}
			return ret;
		} else {
			if(booleanNames[name]){
				value = !!(value);
				elem[name] = value;
				if(value){
					elem[name] = value;
					elem.setAttribute(name, name);
				} else {
					elem[name] = value;
					elem.removeAttribute(name);
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
			} else if(name === 'preload'){
				if(!preloadVals[value]){return;}
				elem.setAttribute(name, value);
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
		//reset error
		if(e && e.type){
			$.data(this, 'calledMediaError', false);
		}
		apis = apis.apis;
		
		//webkit is really stupid with the error event, so fallback to canPlaytype
		var elem 	= this,
			srces 	= $.attr(this, 'srces')
		;
		
		if( elem.error || (srces.length && !apis.nativ.canPlaySrces(srces)) ){
			$.event.special.mediaerror.handler.call(this, $.Event('mediaerror'));
			//stop trying to play
			try {
				elem.pause();
			} catch(er){}
		}
				
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
			var media = $(this)
				.bind('error', $.event.special.mediaerror.handler)
				//older webkit do not support emptied
				.bind('native_mediareset', bindSource)
			;
			//bindSource can trigger mediaerror, but event is always bound after setup
			setTimeout(function(){
				media.each(bindSource);
			}, 0);
		},
		teardown: function(){
			$(this)
				.unbind('error', $.event.special.mediaerror.handler)
				.find('source')
				.unbind('error', sourceError)
			;
		},
		handler: function(e){
			if($.data(this, 'calledMediaError')){return;}
			e = $.extend({}, e || {}, {type: 'mediaerror'});
			$.data(this, 'calledMediaError', true);
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
				'audio/x-m4p': ['m4p'],
				'audio/3gpp': ['3gp','3gpp']
			},
			video: {
				//ogv shouldn´t be used!
				'application/ogg': ['ogg','ogv', 'ogm'],
				'video/mpeg': ['mpg','mpeg','mpe'],
				'video/mp4': ['mp4','mpg4', 'm4v'],
				'video/quicktime': ['mov','qt'],
				'video/x-msvideo': ['avi'],
				'video/x-ms-asf': ['asf', 'asx'],
				'video/flv': ['flv', 'f4v'],
				'video/3gpp': ['3gp','3gpp']
			}
		}
	;
	
	$.extend(m, {
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
				this.apis[elemName][name] = m.beget(this.fn);
				if(name !== 'nativ' && $.inArray(name, $.fn.mediaElementEmbed.defaults.apiOrder) === -1){
					$.fn.mediaElementEmbed.defaults.apiOrder.push(name);
				}
			} 
			$.extend(true, this.apis[elemName][name], api);
		},
		fn: {
			_init: $.noop,
			canPlayType: function(type){
				var elem = this.apiElem,
					ret
				;
				if(elem && elem.canPlayType){
					ret = elem.canPlayType(type);
					return (ret === 'no') ? '' : ret;
				}
				var parts 	= m.extractContainerCodecsFormType(type),
					that 	= this
				;
				ret		= 'probably';
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
				srces = srces || $.attr(this.element, 'srces');
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
			_setActive: $.noop,
			_setInactive: $.noop,
			_trigger: function(e){$(this.element).triggerHandler(e, e);}
		},
		apis: {
			audio: {},
			video: {}
		},
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
		// simple, but powerfull
		beget: function(sup){
			var F = function(){};
			F.prototype = sup;
			return new F();
		},
		_create: function(elemName, supType, element, opts){
			var data = $.data(element, 'mediaElemSupport') || $.data(element, 'mediaElemSupport', {apis: {}, nodeName: elemName});
			if(!data.apis[supType]){
				data.apis[supType] = m.beget( m.apis[elemName][supType]);
				data.apis[supType].element = element;
				data.apis[supType].nodeName = elemName;
				data.apis[supType].name = supType;
				data.apis[supType].data = {};
				data.apis[supType].embedOpts = opts;
			}
			return data;
		},
		_setAPIActive: function(element, supType){
			var data 		= $.data(element, 'mediaElemSupport'),
				oldActive 	= data.name
			;
			if(oldActive === supType){return true;}
			
			var hideElem = data.apis[oldActive].apiElem,
				showElem = data.apis[supType] && data.apis[supType].apiElem,
				apiReady = false
			;
			
			if(showElem && showElem.nodeName){
				if(data.nodeName !== 'audio' || $.attr(element, 'controls')){
					if(supType === 'nativ'){
						data.apis[supType].visualElem.css({display: ''});
					} else {
						data.apis[supType].visualElem.css({
							width: data.apis[oldActive].visualElem.width(),
							height: data.apis[oldActive].visualElem.height(),
							visibility: ''
						});
					}
				}
				data.apis[supType]._setActive(oldActive);
				apiReady = true;
				data.apis[supType]._trigger({type: 'apiActivated', api: supType});
			}
			data.apis[supType].isAPIActive = true;
			if(hideElem && hideElem.nodeName){
				if(oldActive === 'nativ'){
					hideElem.style.display = 'none';
				} else {
					data.apis[oldActive].visualElem.css({
						height: 0,
						width: 0,
						visibility: 'hidden'
					});
				}
				data.apis[oldActive]._setInactive(supType);
				data.apis[oldActive].isAPIActive = false;
				data.apis[supType]._trigger({type: 'apiDeActivated', api: oldActive});
			}
			
			data.name = supType;
			
			return apiReady;
		},
		getSuitedPlayers: function(elem, apiOrder){
			var apis = $.data(elem, 'mediaElemSupport');
			if(!apis || !apis.apis){return;}
			apis = apis.apis;
			var srces 		= $.attr(elem, 'srces'),
				supported 	= false,
				getSupported = function(name, api){
					if( (typeof api.isTechAvailable === 'boolean' && !api.isTechAvailable) || ( $.isFunction(api.isTechAvailable) && !api.isTechAvailable() ) ){
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
							apiData.apis[supported.name]._trigger({type: 'apiActivated', api: supported.name});
						}
			;
			
			if(!id){
				vID++;
				id = apiData.nodeName +'-'+vID;
				elem.id = id;
			}
			apiData.apis[supported.name].visualElem = $('<div class="media-element-box mm-'+ apiData.nodeName +'-box" />').insertBefore(elem);
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
		getPluginVersion: function(name, plugDesc){
			var plugin 	= plugDesc || (navigator.plugins && navigator.plugins[name]),
				version = [-1, 0],
				desc
			;
			if(plugin){
				desc = (plugin.description || '').replace(/,/g, '.').match(/(\d+)/g) || ['0'];
				if(desc && desc[0]){
				    version[0] = desc[0];
					if(desc[1]){
					    version[0] += '.'+desc[1];
					}
					version[0] = parseFloat(version[0], 10);
					if(desc[2]){
					    version[1] = parseInt(desc[2], 10);
					}
				}
			}
			return version;
		},
		embedObject: function(elem, id, attrs, params, activeXAttrs, pluginName){
			elem = $('<div />').appendTo(elem)[0];
			var obj;
			
			if(navigator.plugins && navigator.plugins[pluginName]){
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
			} else if(window.ActiveXObject){
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
			}
			$(window).unload(function(){
				jQuery.cleanData( [ obj ] );
				obj = null;
			});
//			vlc in ie is a little stupid here
//			don´t use the style property!
			setTimeout(function(){
				if(!obj || !obj.setAttribute){return;}
				obj.setAttribute('width', '100%');
				obj.setAttribute('height', '100%');
			}, 0);
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
		if(!m._setAPIActive(elem, supported.name)){
			m._embedApi(elem, supported, apiData, elemName);
		} else if(apiData.apis[supported.name]._mmload){
			apiData.apis[supported.name]._mmload(supported.src, $.attr(elem, 'poster'));
		}
	}
		
	$.fn.mediaElementEmbed = function(opts){
		opts = $.extend(true, {}, $.fn.mediaElementEmbed.defaults, opts);
		
		return this.each(function(){
			var elemName 	= this.nodeName.toLowerCase();
			
			if(elemName !== 'video' && elemName !== 'audio'){return;}
			var elem = this;
			if(opts.removeControls){
				$.attr(this, 'controls', false);
			}
			
			var apiData = m._create(elemName, 'nativ', this, opts);
			apiData.name = 'nativ';
			apiData.apis.nativ.apiElem = this;
			apiData.apis.nativ.visualElem = $(this);
			apiData.apis.nativ.isAPIActive = true;
			$.each(m.apis[elemName], function(name){
				if(name !== 'nativ'){
					m._create(elemName, name, elem, opts);
				}
			});
			
			if(opts.showFallback && $.support.mediaElements){
				$(this).bind('totalerror', function(){
					$(this).hide().children(':not(source, itext)').insertAfter(this);
				});
			}
			
			if(opts.debug || !$.support.mediaElements){
				 findInitFallback(this, opts);
				 apiData.apis.nativ.isAPIReady = true;
			} else {
				apiData.apis.nativ._init();
			}
			$(this)
				.bind('mediaerror', function(e){
					if(apiData.name === 'nativ'){
						findInitFallback(this, opts);
					}
				})
			;
		});
	};
	
	$.fn.mediaElementEmbed.defaults = {
		debug: false,
		removeControls: false,
		showFallback: false,
		apiOrder: []
	};
	
	
	if($.cleanData && window.ActiveXObject){
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
	var video 			= document.createElement('video'), 
		$m 				= $.multimediaSupport,
		noAPIEvents 	= {
			apiActivated: 1,
			apiDeActivated: 1,
			mediareset: 1,
			totalerror: 1
		},
		nuBubbleEvents 	= {
			native_mediareset: 1,
			timechange: 1,
			progresschange: 1
		},
		fsMethods		= {}
	;
	
	if('enterFullScreen' in video && video.supportsFullscreen){
		$.support.videoFullscreen = true;
		fsMethods.enter = 'enterFullScreen';
		fsMethods.exit = 'exitFullScreen';
	} else {
		$.each(['webkit', 'moz', 'o', 'ms'], function(i, name){
			if(name+'EnterFullScreen' in video && video[name+'SupportsFullscreen']){
				$.support.videoFullscreen = true;
				fsMethods.enter = name+'EnterFullScreen';
				fsMethods.exit = name+'ExitFullScreen';
				return false;
			}
		});
	}
	
	video = null;
	
	$.extend($m, {
		formatTime: function(sec){
			return $.map(
				[
					parseInt(sec/60, 10),
					parseInt(sec%60, 10)
				], 
				function(num){
					return (isNaN(num)) ? '--' : (num < 10) ? ('0'+num) : num;
				})
				.join(':')
			;
		}
	});
	
	//ToDo add onAPIReady/mmAPIReady
	$.event.special.loadedmeta = {
	    add: function( details ) {
			var api = $(this).getMMAPI();
			if(api && api.loadedmeta){
				var evt = $.extend({}, api.loadedmeta);
				details.handler.call(this, evt, evt);
			}
	    }
	};
	
	

	//extend fn
	$.extend($m.fn, {
		_trigger: function(e){
			var evt  = (e.type) ? e : {type: e},
				type = evt.type
			;

			switch(type){
				case 'mmAPIReady':
					if(this.isAPIReady){
						
						return;	
					}
					this.isAPIReady = true;
					break;
				case 'loadedmeta':
					this.loadedmeta = evt;
					break;
				case 'totalerror':
					this.totalerror = true;
					break;
				case 'mediareset':
					this.loadedmeta = false;
					this.totalerror = false;
					break;
			}
			
			if(!this.isAPIActive || (this.totalerror && !noAPIEvents[type])){return;}
			if(!this.isAPIReady && !noAPIEvents[type]){
				this._trigger('mmAPIReady');
			}
			if(e.type === 'progresschange'){
				e.relStart = e.relStart || 0;
				if(this._concerningBufferStart !== e.relStart){
					this._concerningBufferStart = e.relStart;
					this._trigger({type: 'bufferrange', relStart: e.relStart, relLoaded: e.relLoaded});
				}
			}
			
			e.target = this.element;
			e = $.Event(e);
			e.preventDefault();
			
			evt.mediaAPI = this.name;
			
			if(nuBubbleEvents[type]){
				e.stopPropagation();
			}
			
			$.event.trigger( e, evt, this.element );
		},
		supportsFullScreen: function(){
			return this._videoFullscreen || false;
		},
		enterFullscreen: $.noop,
		exitFullscreen: $.noop,
		isAPIReady: false,
		relCurrentTime: function(rel){
			var dur = this.getDuration() || Number.MIN_VALUE;
			if(rel && isFinite(rel)){
				this.currentTime(dur * rel / 100);
			}
			return this.currentTime() / dur * 100; 
		},
		getMediaAPI: function(){
			return this.mediaAPI;
		},
		togglePlay: function(){
			this[(this.isPlaying()) ? 'pause' : 'play']();
		},
		toggleMuted: function(){
			this.muted(!(this.muted()));
		},
		getMMVisual: function(){
			return this.visualElem;
		},
		onAPIReady: function(fn, n){
			var e = {type: 'mmAPIReady'};
			if(this.isAPIReady){
				fn.call(this.element, e, e);
			} else {
				n = n || 'jmediaelement';
				$(this.element).one('mmAPIReady.'+n, fn);
			}
		},
		unAPIReady: function(name){
			$(this.element).unbind('mmAPIReady.'+name);
		},
		_format: $m.formatTime,
		getFormattedDuration: function(){
			return this._format(this.getDuration());
		},
		getFormattedTime: function(){
			return this._format(this.currentTime());
		},
		loadSrc: function(srces, poster){
			if(srces){
				$.attr(this.element, 'srces', srces);
				srces = $.isArray(srces) ? srces : [srces];
			} else {
				srces = $.attr(this.element, 'srces');
			}
			if(poster !== undefined){
				if(poster){
					$.attr(this.element, 'poster', poster);
				} else {
					$(this.element).removeAttr('poster');
				}
			} else {
				poster = $.attr(this.element, 'poster');
			}
			this._isResetting = true;
			
			var canPlaySrc = this.canPlaySrces(srces);
			this._trigger('mediareset');
			if(canPlaySrc){
				canPlaySrc = canPlaySrc.src || canPlaySrc;
				
				this._mmload(canPlaySrc, poster);
			} else {
				$m._setAPIActive(this.element, 'nativ');
				this._trigger('native_mediareset');
				$(this.element).data('mediaElemSupport').apis.nativ._mmload();
			}
			this._isResetting = false;
		},
		isPlaying: function(){
			return (this._isResetting) ? false : this._isPlaying();
		}
	});
	
	// firefox and old webkits (safari 4/chrome 4) are using an extended event, but safari uses load instead of progress
	// newer webkits are compilant to the current w3c specification (progress is a simple event + buffered is a timerange-object)
	// opera 10.5 hasn´t implemented the timerange-object yet <- no support
	var fixProgressEvent = function(api){
		var unboundNeedless,
		 	getConcerningRange 			= function(){
				var time 	= api.element.currentTime,
					buffer 	= api.element.buffered,
					bufLen 	= buffer.length,
					ret 	= {}
				;
				
				for(var i = 0; i < bufLen; i++){
					ret.start = buffer.start(i);
					ret.end = buffer.end(i);
					if(ret.start <= time && ret.end >= time){
						break;
					}
				}
				return ret;
			},
			
			calculateProgress 	= function(e){
				var evt = {type: 'progresschange'}, 
					dur, bufRange
				;
				//current implementation -> chrome 5
				if(this.buffered && this.buffered.length){
					dur = this.duration;
					if(dur){
						bufRange = getConcerningRange();
						evt.relStart = bufRange.start / dur * 100;
						evt.relLoaded = bufRange.end / dur * 100;
					}
					api._trigger(evt);
				//ff implementation implementation
				} else if(e.originalEvent && 'lengthComputable' in e.originalEvent && e.originalEvent.loaded){
					if(e.originalEvent.lengthComputable && e.originalEvent.total){
						evt.relStart = 0;
						evt.relLoaded = e.originalEvent.loaded / e.originalEvent.total * 100;
					}
					//remove event
					if(!unboundNeedless){
						$(this).unbind((e.type === 'load') ? 'progress' : 'load', calculateProgress);
						unboundNeedless = true;
					}
					api._trigger(evt);
				}
				
			}
		;
		$(api.element).bind('progress load', calculateProgress);
	};
	
	//add API for native MM-Support
	var nativ = {
		isTechAvailable: $.support.mediaElements,
		_init: function(){
			var that 				= this,
				curMuted 			= this.apiElem.muted,
				hasInitialError 	= false,
				catchInitialError 	= function(){
					hasInitialError = true;
				}
			;
			
			//addEvents
			fixProgressEvent(this);
			$(this.element)
				.bind({
					volumechange: function(){
						if(curMuted !== that.apiElem.muted){
							curMuted = that.apiElem.muted;
							that._trigger.call(that, {type: 'mute', isMuted: curMuted});
						} else {
							that._trigger.call(that, {type: 'volumelevelchange', volumelevel: that.apiElem.volume * 100});
						}
					},
					
					timeupdate: function(){
						var e = {
							type: 'timechange',
							time: this.currentTime
						};
						if(this.duration){
							e.duration = this.duration;
							e.timeProgress = e.time / e.duration * 100;
						}
						that._trigger(e);
					},
					loadedmetadata: function(){
						that._trigger({
							type: 'loadedmeta',
							duration: this.duration
						});
					}
				})
				.one('mediaerror', catchInitialError)
			;
			//workaround
			if(this.element.readyState > 0 && !this.element.error){
				$(that.element).unbind('mediaerror', catchInitialError);
				this._trigger({
					type: 'loadedmeta',
					duration: this.element.duration
				});
			} else if( ( $.attr(this.element, 'preload') === 'none' && !$.attr(this.element, 'autoplay') ) || !$.attr(this.element, 'srces').length ){
				this._trigger('mmAPIReady');
			}
		},
		play: function(src){
			this.element.play();
		},
		pause: function(){
			this.element.pause();
		},
		muted: function(bool){
			if(typeof bool === 'boolean'){
				this.element.muted = bool;
			}
			return this.element.muted;
		},
		volume: function(vol){
			if(isFinite(vol)){
				this.element.volume = vol / 100;
			}
			return this.element.volume * 100;
		},
		currentTime: function(sec){
			if(isFinite(sec)){
				try {
					this.element.currentTime = sec;
				} catch(e){}
			}
			return this.element.currentTime;
		},
		_mmload: function(){
			if(this.element.load){
				this.element.load();
			} else {
				$(this.element).triggerHandler('error');
			}
		},
		_isPlaying: function(){
			return (!this.element.paused && this.element.readyState > 2 && !this.error && !this.ended);
		},
		getDuration: function(){
			return this.element.duration;
		},
		getCurrentSrc: function(){
			return this.element.currentSrc;
		}
	};
	
	
	
	$m.add('nativ', 'video', $.extend({
		_videoFullscreen: $.support.videoFullscreen,
		enterFullScreen: function(){
			if(!this._videoFullscreen){return false;}
			try {
				this.element[fsMethods.enter]();
			} catch(e){}
		},
		exitFullScreen: function(){
			if(!this._videoFullscreen){return false;}
			try {
				this.element[fsMethods.exit]();
			} catch(e){}
		}
	}, nativ));
	
	
	$m.add('nativ', 'audio', nativ);
	
	
	//public-methods
	$.fn.getMMAPI = function(full){
		if(!this[0]){return;}
		var api = $.data(this[0], 'mediaElemSupport');
		return ( full || !api || !api.name || !api.apis ) ? api : api.apis[api.name];
	};
	
	var noAPIMethods = {
			onAPIReady: 1,
			loadSrc: 1
		}
	;
	$m.registerAPI = function(names){
		if(typeof names === 'string'){
			names = [names];
		}
		$.each(names, function(i, name){
			var fn = $m.apis.video.nativ[name];
			if(fn && $.isFunction(fn) && name.indexOf('_') !== 0){
				$m.attrFns[name] = true;
				if($.fn[name]){return;}
				$.fn[name] =  function(){
					var args = arguments,
						ret
					;
					this.each(function(){
						var api = $(this).getMMAPI();
						if(!api){return;}
						if( (api.isAPIReady && !api.totalerror) || noAPIMethods[name] ){
							ret = api[name].apply(api, args);
						} else {
							api.unAPIReady(name+'queue');
							api.onAPIReady.call(api, function(){
								api[name].apply(api, args);
							}, name+'queue');
						}
					});
					return (ret === undefined) ? this : ret; 
				};
			}
		});
	};
	
	var fnNames = [];
	$.each($m.apis.video.nativ, function(name, fn){
		fnNames.push(name);
	});
	
	$m.registerAPI(fnNames);
	//plugin mechanism
	$m.fn._extend = function(exts){
		var names = [];
		$.each(exts, function(name, fn){
			$m.fn[name] = fn;
			names.push(name);
		});
		$m.registerAPI(names);
	};
})(jQuery);/**!
 * Part of the jMediaelement-Project | http://github.com/aFarkas/jMediaelement
 * @author Alexander Farkas
 * Copyright 2010, Alexander Farkas
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function($){
	
	var split 			= /\s*\/\s*|\s*\|\s*/,
		sliderMethod 	= ($.fn.a11ySlider) ? 'a11ySlider' : 'slider',
		controls 		= {
			'timeline-slider': function(control, mm, api, o){
				var stopSlide = false;
				control[sliderMethod](o.timeSlider)[sliderMethod]('option', 'disabled', true);
				
				function changeTimeState(e, ui){
					if(ui.timeProgress !== undefined && !stopSlide){
						control[sliderMethod]('value', ui.timeProgress);
					}
				}
				
				function changeDisabledState(){
					if(api.apis[api.name].loadedmeta && api.apis[api.name].loadedmeta.duration){
						control[sliderMethod]('option', 'disabled', false);
					} else {
						control[sliderMethod]('option', 'disabled', true);
					}
				}
				
				api.apis[api.name].onAPIReady(function(){
					mm
						.bind('loadedmeta', changeDisabledState)
						.bind('timechange', changeTimeState)
						.bind('mediareset', function(){
							control[sliderMethod]('value', 0);
							changeDisabledState();
						})
						.bind('ended', function(){
							control[sliderMethod]('value', 100);
						})
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
				});
				
			},
			'volume-slider': function(control, mm, api, o){
				var stopSlide = false;
				control[sliderMethod](o.volumeSlider)[sliderMethod]('option', 'disabled', true);
				
				function changeVolumeUI(e, ui){
					if(!stopSlide){
						control[sliderMethod]('value', ui.volumelevel);
					}
				}
				
				api.apis[api.name].onAPIReady(function(){
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
					control[sliderMethod]('value', mm.volume() || 100);
				});
			},
			'progressbar': function(control, mm, api, o){
				control.progressbar(o.progressbar).progressbar('option', 'disabled', true);
				
				function changeProgressUI(e, ui){
					if ('relLoaded' in ui) {
						control.progressbar('option', 'disabled', false).progressbar('value', ui.relLoaded);
					} else {
						control.progressbar('option', 'disabled', true);
					}
				}
				
				function resetProgress(e, ui){
					control.progressbar('option', 'disabled', true).progressbar('value', 0);
				}
				
				api.apis[api.name].onAPIReady(function(){
					mm
						.bind('progresschange', changeProgressUI)
						.bind('mediareset', resetProgress)
					;
				}, 'one');
				
			},
			duration: function(control, mm, api, o){
				if(o.addThemeRoller){
					control.addClass('ui-widget-content ui-corner-all');
				}
				control.html('--:--');
				mm
					.bind('loadedmeta', function(e, evt){
						control.html(api.apis[api.name]._format(evt.duration));
					})
					.bind('mediareset', function(){
						control.html('--:--');
					})
				;
				api.apis[api.name].onAPIReady(function(){
					control.html(api.apis[api.name].getFormattedDuration());
				});
				
			},
			'current-time': function(control, mm, api, o){
				if(o.addThemeRoller){
					control.addClass('ui-widget-content ui-corner-all');
				}
				control.html('--:--');
				mm
					.bind('timechange', function(e, evt){
						control.html(api.apis[api.name]._format(evt.time));
					})
					.bind('mediareset', function(){
						control.html('--:--');
					})
				;
				api.apis[api.name].onAPIReady(function(){
					control.html(api.apis[api.name].getFormattedTime());
				});
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
						if(timeSlider[0] !== this && this.offsetWidth && $.curCSS(this, 'position') !== 'absolute' && ( !o.excludeSel || !$(this).is(o.excludeSel) ) ){
							occupied += $(this).outerWidth(true);
						}
					});
					timeSlider.css('width', space - occupied);
				}
				
				if(o.mediaControls.dynamicTimeslider){
					var timeSlider  = $('.'+ o.classPrefix +'timeline-slider', control),
						calcTimer	= setTimeout(calcSlider, 0)
					;
					
					api.apis[api.name].onAPIReady(function(){
						clearInterval(calcTimer);
						setTimeout(calcSlider, 0);
					}, 'one');
					$(window).bind('resize', calcSlider);
					mm.bind('resize emchange', calcSlider);
				}
			}
		},
		toggleModells = {
				'play-pause': {stateMethod: 'isPlaying', actionMethod: 'togglePlay', evts: 'play playing pause ended loadedmeta mediareset', trueClass: 'ui-icon-pause', falseClass: 'ui-icon-play'},
				'mute-unmute': {stateMethod: 'muted', actionMethod: 'toggleMuted', evts: 'mute', trueClass: 'ui-icon-volume-off', falseClass: 'ui-icon-volume-on'}
			}
	;
	
	//create Toggle Button UI
	$.each(toggleModells, function(name, opts){
		controls[name] = function(control, mm, api, o){
			var elems = $.fn.registerMMControl.getBtn(control);
			if(o.addThemeRoller){
				control.addClass('ui-state-default ui-corner-all');
			}		
			function changeState(e, ui){
				var state = mm[opts.stateMethod]();
				
				if(state){
					elems.text.text(elems.names[1]);
					elems.icon.addClass(opts.trueClass).removeClass(opts.falseClass);
				} else {
					elems.text.text(elems.names[0]);
					elems.icon.addClass(opts.falseClass).removeClass(opts.trueClass);
				}
			}
			
			api.apis[api.name].onAPIReady(function(){
				mm.bind(opts.evts, changeState);
				changeState();
			});
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
		} 
		if(!ret.controls || ret.controls.hasClass(o.classPrefix+'media-controls')) {
			ret.controlsgroup = jElm;
			ret.api.controlWrapper = (ret.api.controlWrapper) ? ret.api.controlWrapper.add(jElm) : jElm;
			ret.controls = (ret.controls) ? $(o.controlSel, jElm).add(ret.controls) : $(o.controlSel, jElm);
			ret.api.controlBar = ret.controls.filter('.'+o.classPrefix+'media-controls');
		}
		return ret;
	}
	
	var moveKeys = {
		40: true,
		37: true,
		39: true,
		38: true
	};
	
	function addWrapperBindings(wrapper, mm, api, o){
		//classPrefix
		var stateClasses 		= o.classPrefix+'playing '+ o.classPrefix +'totalerror '+o.classPrefix+'waiting',
			removeStateClasses 	= function(){
				wrapper.removeClass(stateClasses);
			}
		;
		wrapper
			.addClass(o.classPrefix+api.name)
			.bind({
				apiActivated: function(e, d){
					wrapper.addClass(o.classPrefix+d.api);
				},
				apiDeActivated: function(e, d){
					wrapper.removeClass(o.classPrefix+d.api);
				}
			})
			.bind('playing totalerror waiting', function(e){
				removeStateClasses();
				wrapper.addClass(o.classPrefix+e.type);
			})
			.bind('pause ended mediareset', function(e){
				removeStateClasses();
			})
			.bind('canplay canplaythrough', function(e){
				wrapper.removeClass(o.classPrefix+'waiting');
			})
		;
		
		if($.ui && $.ui.keyCode){
			wrapper.bind('keydown', function(e){
				if(moveKeys[e.keyCode]){
					//user is interacting with the slider don´t do anything
					if($(e.target).is('.ui-slider-handle')){return;}
					var dif = 5;
					switch(e.keyCode) {
						case $.ui.keyCode.UP:
							if(e.ctrlKey){
								dif += 5;
							}
							api.apis[api.name].volume( Math.min(100, api.apis[api.name].volume() + dif ) );
							break;
						case $.ui.keyCode.DOWN:
							if(e.ctrlKey){
								dif += 5;
							}
							api.apis[api.name].volume( Math.max(0, api.apis[api.name].volume() - dif ) );
							break;
						case $.ui.keyCode.LEFT:
							if(e.ctrlKey){
								dif += 55;
							}
							api.apis[api.name].currentTime( Math.max(0, api.apis[api.name].currentTime() - dif ) );
							break;
						case $.ui.keyCode.RIGHT:
							if(e.ctrlKey){
								dif += 55;
							}
							api.apis[api.name].currentTime( Math.min( api.apis[api.name].getDuration(), api.apis[api.name].currentTime() + dif ) );
							break;
					}
					e.preventDefault();
				} else if(e.keyCode === $.ui.keyCode.SPACE && !$.nodeName(e.target, 'button')){
					api.apis[api.name].togglePlay();
					e.preventDefault();
				}
			});
		}
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
			elems.api.controls = elems.api.controls || [];
			if(!elems.api){return;}
			elems.controls.each(function(){
				var jElm = $(this);
				if($.inArray(this, elems.api.controls) !== -1){return;}
				elems.api.controls.push(this);
				$.each(controls, function(name, ui){
					if( jElm.hasClass(o.classPrefix+name) ){
						ui(jElm, elems.mm, elems.api, o);
						return false;
					}
				});
			});
			if(elems.controlsgroup && elems.controlsgroup[0]){
				addWrapperBindings(elems.controlsgroup, elems.mm, elems.api, o);
			}
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
			timeSliderAdjust: 0,
			excludeSel: false
		},
		progressbar: {},
		volumeSlider: {},
		timeSlider: {}
	};
	
	$.fn.registerMMControl.getBtn = function(control){
		var elems = {
			icon: $('.ui-icon', control),
			text: $('.button-text', control)
		};
			
		if(!elems.icon[0] && !elems.text[0] && !$('*', control)[0]){
			elems.icon = control;
			elems.text = control;
		}
		
		elems.names = elems.text.text().split(split);
		
		if(elems.names.length !== 2){
			elems.text = $([]);
		}
		return elems;
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
		m 		= $.multimediaSupport
	;
	(function(){
		$.support.flash9 = false;
		var swf 				= m.getPluginVersion('Shockwave Flash'),
			supportsMovieStar 	= function(obj){
				$.support.flash9 = false;
				try {
					obj = m.getPluginVersion('', {
						description: obj.GetVariable("$version")
					});
					$.support.flash9 = !!(obj[0] > 9 || (obj[0] === 9 && obj[1] >= 115));
				} catch(e){}
			}
		;
		if(swf[0] > 9 || (swf[0] === 9 && swf[1] >= 115)){
			//temp result
			$.support.flash9 = true;
			$(function(){
				swf = $('<object />', swfAttr).appendTo('body');
				supportsMovieStar(swf[0]);
				swf.remove();
			});
		} else if(window.ActiveXObject){
			try {
				swf = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
				supportsMovieStar(swf);
				swf = null;
			} catch(e){}
		}
	})();
	
	var jwMM 	= {
			isTechAvailable: function(){
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
				
//				if( opts.playFirstFrame && !cfg.poster && !cfg.autoplay ){ //ToDo: change this implementation
//					this.data.playFirstFrame = true;
//					vars.autostart = 'true';
//				}
				params.flashvars = [];
				$.each(vars, function(name, val){
					params.flashvars.push(name+'='+val);
				});
				params.flashvars = params.flashvars.join('&');
				fn(m.embedObject( this.visualElem[0], id, attrs, params, aXAttrs, 'Shockwave Flash' ));
			},
			canPlayCodecs: ['avc1.42E01E', 'mp4a.40.2', 'avc1.58A01E', 'avc1.4D401E', 'avc1.64001E'],
			canPlayContainer: ['video/3gpp', 'video/x-msvideo', 'video/quicktime', 'video/x-m4v', 'video/mp4', 'video/m4p', 'video/x-flv', 'video/flv', 'audio/mpeg', 'audio/mp3', 'audio/x-fla', 'audio/fla']
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
				
				//workaround: meta isn´t triggered on audio | ToDo: Is this needed with jwplayer 5.1.x?
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
						lengthComputable: !!(obj.total)
					};
					if(obj.total){
						$.extend(evt, {
							relLoaded: obj.total / obj.loaded * 100
						});
						api._buffered = evt.relLoaded;
					}
					api._trigger(evt);
				}
			}
			
		}),
		five: $.extend(true, {}, privJwEvents, {
			Model: {
				BUFFER: function(obj){
					var api = getAPI(obj.id);
					if(!api){return;}
					var evt = {
						type: 'progresschange',
						relLoaded: obj.percentage,
						relStart: 0
					};
					api._buffered = obj.percentage;
					api._trigger(evt);
				},
				STATE: function(obj){
					var state = privJwEvents.Model.STATE(obj);
					if(state === 'playing'){
						var api = getAPI(obj.id);
						if(!api){return;}
						api._trigger('play');
					}
				}
			}
		})
	};
	
	window.playerReady = function (obj) {
		
		var api = getAPI(obj.id);
		if(api){
			
			//https://bugzilla.mozilla.org/show_bug.cgi?id=90268 every html5video shim has this problem fix it!!!
			if(api.isAPIReady){
				if(!api.apiElem.sendEvent){
					api._reInit();
					return;
				} else if( api._lastLoad ){
					api._mmload(api._lastLoad.file, api._lastLoad.image);
				}
				api._trigger('flashRefresh');
			}
			
			var apiVersion = (parseInt(obj.version, 10) > 4)? 'five' : 'four';
			//add events
			$.each(jwEvents[apiVersion], function(mvcName, evts){
				$.each(evts, function(evtName){
					api.apiElem['add'+ mvcName +'Listener'](evtName, 'jwEvents.'+ apiVersion +'.'+ mvcName +'.'+ evtName);
				});
			});
			
			//preload workaround
			setTimeout(function(){
				var cfg = $.attr(api.element, 'getConfig');
				if(!cfg.autoplay){
					if( api.nodeName === 'audio' && cfg.preload === 'metadata' ){
						api.apiElem.sendEvent('PLAY', 'true');
						api.apiElem.sendEvent('PLAY', 'false');
					} else if( api.nodeName === 'video' && cfg.preload !== 'none' && !cfg.poster ){
						api.currentTime(0);
					}
				}
				api._trigger('mmAPIReady');
			}, 0);
		}		
	};
	
	var jwAPI = {
		_init: function(){
			this._buffered = this._buffered || 0;
		},
		_reInitCount: 0,
		_reInitTimer: false,
		_reInit: function(){
			var that = this;
			if(this._reInitCount < 5){
				var overflow = this.visualElem[0].style.overflow;
				this.visualElem[0].style.overflow = 'hidden';
				setTimeout(function(){
					that.visualElem[0].style.overflow = 'visible';
					that.visualElem[0].style.overflow = overflow;
				}, 0);
			}
			this._reInitCount++;
			
			if(!this._reInitTimer){
				this._reInitTimer = true;
				setTimeout(function(){
					that._reInitCount = 0;
					that._reInitTimer = false;
				}, 20000);
			}
		},
		play: function(){
			this.apiElem.sendEvent('PLAY', 'true');
			this._trigger('play');
		},
		pause: function(){
			this.apiElem.sendEvent('PLAY', 'false');
		},
		_isPlaying: function(){
			var cfg = this.apiElem.getConfig();
			return (cfg) ? (cfg.state === 'PLAYING' ) : undefined;
		},
		_mmload: function(src, poster){
			this._lastLoad = {
				file: src,
				image: poster || false
			};
			this.apiElem.sendEvent('LOAD', this._lastLoad);
			if(this.isAPIActive && $.attr(this.element, 'autoplay')){
				this.apiElem.sendEvent('PLAY', 'true');
			} else {
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
		_isSeekable: function(t){
			var file = this.getCurrentSrc();
			if(this._buffered === 100 || (file.indexOf('http') !== 0 && file.indexOf('file') !== 0)){
				return true;
			}
			var dur = this.getDuration();
			if(!dur){
				return false;
			}
			return (t / dur * 100 < this._buffered);
		},
		currentTime: function(t){
			if(!isFinite(t)){
				return this.currentPos || 0;
			}
			var api 			= this,
				wantsPlaying 	= (/PLAYING|BUFFERING/.test( this.apiElem.getConfig().state)),
				doSeek 			= function(){
					api.apiElem.sendEvent('SEEK', t);
					if(!wantsPlaying){
						api.apiElem.sendEvent('PLAY', 'false');
					}
					api.currentPos = t;
					api._trigger({type: 'timechange', time: t});
				},
				unbind 			= function(){
					$(api.element).unbind('.jwseekrequest');
				}
			;
			if(!wantsPlaying){
				this.apiElem.sendEvent('PLAY', 'true');
				this.apiElem.sendEvent('PLAY', 'false');
			}
			clearTimeout(this._seekrequestTimer);
			unbind();
			if(this._isSeekable(t)){
				doSeek();
			} else {
				this.apiElem.sendEvent('PLAY', 'false');
				this._trigger('waiting');
				$(this.element)
					.bind('progresschange.jwseekrequest', function(){
						if(api._isSeekable(t)){
							var wasMuted = api.muted();
							unbind();
							clearTimeout(api._seekrequestTimer);
							api.muted(true);
							api.apiElem.sendEvent('PLAY', 'true');
							api._seekrequestTimer = setTimeout(doSeek, 40);
							api.muted(wasMuted);
						}
					})
					.bind('mediareset.jwseekrequest', unbind)
					.bind('play.jwseekrequest', function(){
						api.apiElem.sendEvent('PLAY', 'false');
						api._trigger('waiting');
						wantsPlaying = true;
					})
					.bind('pause.jwseekrequest', function(){
						wantsPlaying = false;
					})
				;
				
				//seek aborted
				this._seekrequestTimer = setTimeout(function(){
					$(api.element)
						.unbind('play.jwseekrequest')
						.unbind('pause.jwseekrequest')
						.bind('play.jwseekrequest', unbind)
						.bind('pause.jwseekrequest', unbind)
					;
				}, 999);
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
		},
		getCurrentSrc: function(){
			return (this.apiElem.getConfig() || {}).file || '';
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
			events: 'True',
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
				if(vlc[0] >= 0.9){
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
					vlcAttr = $.extend({}, opts.attrs, {data: src}, defaultAttrs),
					params 	= $.extend({}, opts.params, {
						Src: src,
						ShowDisplay: 'True',
						autoplay: ''+ attrs.autoplay,//
						autoloop: ''+attrs.loop
					}),
					elem = $m.embedObject( this.visualElem[0], id, vlcAttr, params, activeXAttrs, 'VLC Multimedia Plug-in' )
				;
				this._currentSrc = src;
				fn( elem );
				elem = null;
			},
			canPlayCodecs: ['avc1.42E01E', 'mp4a.40.2', 'avc1.58A01E', 'avc1.4D401E', 'avc1.64001E', 'theora', 'vorbis'],
			canPlayContainer: ['video/3gpp', 'video/x-msvideo', 'video/quicktime', 'video/x-m4v', 'video/mp4', 'video/m4p', 'video/x-flv', 'video/flv', 'audio/mpeg', 'audio/x-fla', 'audio/fla', 'video/ogg', 'video/x-ogg', 'audio/x-ogg', 'audio/ogg', 'application/ogg', 'application/x-ogg']
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
				if($.attr(api.element, 'autoplay')){
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
		_isPlaying: function(){
			var ret = false;
			try {
				ret = states[this.apiElem.input.state] === 'playing';
			} catch(e){}
			return ret;
		},
		_mmload: function(src){
			$(this.element).unbind('playing.enterFullscreen');
			this.apiElem.playlist.stop();
			this.data = {};
			var item = this.apiElem.playlist.add(src, " ", ":no-video-title-show");
			this._currentSrc = src;
			this.apiElem.playlist.playItem(item);
			this.apiElem.playlist.items.clear();
			if(!$.attr(this.element, 'autoplay')){
				interval.end(this);
				this.apiElem.playlist.stop();
			}
		},
		getCurrentSrc: function(){
			return this._currentSrc;
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
				if(!this._isPlaying()){
					var that = this;
					$(that.element).one('playing.enterFullscreen', function(){
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

