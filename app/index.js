require('../resources/less/index.less');
var $ = require('./jquery.min.js');
require('./preloadjs.min.js');
// require('./main.js');

/*
	EaselJS：用于 Sprites 、动画、向量和位图的绘制
	TweenJS：用于做动画效果
	对于有频繁发生改变的物体，如果在每一处变化都刷新舞台的话，
	代码会比较冗余，因此我们可以写一个 Tick 事件，在每一次 Tick 的时候 update 舞台。
	 Tick 事件，每一次触发的频率是可以修改的。理想的帧频率是 60FPS。

*/


(function(){
	//Music按钮
	var music = {
        init: function() {

            var music = $('audio')[0];
            //触摸music_swictch按钮切换播放
            $('#music_switch').bind('touchstart', function() {

                $(this).toggleClass('active');

                if ($(this).hasClass('active')) {
                    music.play();
                } else {
                    music.pause();
                }

                return false;
            });

            return this;
        }
    };
    // Page scale controller
    // 根据当前屏幕的大小和目标元素的大小计算元素的缩放比例，并缩放元素适应屏幕
    var scale = {

        // Configs
        _fixMode       : 'height',      // Could be 'width' / 'height' / 'auto'
        _contentWidth  : 1400,
        _contentHeight : 640,
        _resizeDelay   : 0,

        // Local vars
        _curRatio  : 1,
        _docWidth  : 0,
        _docHeight : 0,
        _rotate    : false,

        _els : [],

        _calcScaleRatio: function(){

            this._docWidth  = document.documentElement.clientWidth;
            this._docHeight = document.documentElement.clientHeight;

            // If 'width' < 'height', switch them
            if (this._docWidth < this._docHeight) {
                this._docWidth  ^= this._docHeight;
                this._docHeight ^= this._docWidth;
                this._docWidth  ^= this._docHeight;
                this._rotate = false;
            } else {
                this._rotate = true;
            }

            var ratio = {
                width  : this._docWidth  / this._contentWidth,
                height : this._docHeight / this._contentHeight
            };

            this._curRatio = ratio[this._fixMode] ? ratio[this._fixMode] :
                    ratio.width > ratio.height ? ratio.height : ratio.width;

            return this;
        },

        _fixEl: function(){

            var ratio  = this._curRatio;
            var rotate = this._rotate ? 0 : 90;

            // If 'width' < 'height', rotate the canvas by 90deg
            for (var l = this._els.length; l--;) {
                this._els[l].attr('style', '-webkit-transform:rotate(' +
                        rotate + 'deg) scale(' + ratio + ',' + ratio + ')');
            }

            if (!this._rotate) {
                $('#music_switch').addClass('rotate');
            } else {
                $('#music_switch').removeClass('rotate');
            }

            return this;
        },

        _bindResize: function() {

            var resizeTimeoutId = null,
                that = this;

            // Calculate ratio and fix the element on 'resize' event
            $(window).bind('resize', function() {

                resizeTimeoutId && clearTimeout(resizeTimeoutId);

                resizeTimeoutId = setTimeout(function() {
                    that._calcScaleRatio()._fixEl();
                }, that._resizeDelay);
            });

            return this;
        },

        getScaleInfo: function() {
            return {
                ratio       : this._curRatio,
                docWidth    : this._docWidth,
                docHeight   : this._docHeight,
                slideWidth  : this._contentWidth,
                slideHeight : this._contentHeight,
                rotate      : this._rotate
            };
        },

        addEl: function(elSeletor) {
            this._els.push($(elSeletor));
            return this._fixEl();
        },

        init: function() {
            return this._calcScaleRatio()._bindResize();
        }
    };
    /*
    	封装了touch事件处理，根据scale对象提供的缩放信息，
    	把touch事件发生的屏幕位置换算成canvas上的位置，
		并调用注册的回调函数
    */
    var touch = {
        // Event handler queue
        _q : {
            start : [],
            move  : []
        },

        _on: function(name, callback) {
            this._q[name].push(callback);
            return this._q[name].length - 1;
        },

        _off: function(name, id) {
            this._q[name][id] = null;
            return this;
        },

        _traverseQueue: function(name, data) {

            var q = this._q[name];

            for (var i = q.length; i--;) {
                q[i] && q[i](data);
            }

            return this;
        },

        _translatePos: function(pos) {

            var info      = scale.getScaleInfo(),
                frameLeft = Math.round(info.docWidth  - info.slideWidth  * info.ratio) / 2,
                frameTop  = Math.round(info.docHeight - info.slideHeight * info.ratio) / 2,
                x, y;

            if (!info.rotate) {
                x = pos.y;
                y = info.docHeight - pos.x;
            } else {
                x = pos.x,
                y = pos.y
            }

            return {
                x : (x - frameLeft) / info.ratio,
                y : (y - frameTop ) / info.ratio
            };
        },

        onStart: function(callback) {
            return this._on('start', callback);
        },

        onMove: function(callback) {
            return this._on('move', callback);
        },

        offStart: function(id) {
            return this._off('start', id);
        },

        offMove: function(id) {
            return this._off('move', id);
        },

        init: function() {

            var that = this;

            $('body, html').bind('touchstart', function(e) {
                e.preventDefault();

                that._traverseQueue('start', that._translatePos({
                    x : e.originalEvent.touches[0].clientX,
                    y : e.originalEvent.touches[0].clientY
                }));

                return false;
            });

            $('body, html').bind('touchmove', function(e) {
                e.preventDefault();

                that._traverseQueue('move', that._translatePos({
                    x : e.originalEvent.touches[0].clientX,
                    y : e.originalEvent.touches[0].clientY
                }));

                return false;
            });

            return this;
        }
    };
    /*
    	这里编写了页面上所有的精灵,
    	并提供了操作精灵的方法，供director对象调用
    */
    var loader = {

        _manifest : [],

        get: function(id) {
            return this._loader.getResult(id);
        },

        load: function(doneCbk, progressCbk) {

            this._doneCbk     = doneCbk;
            this._progressCbk = progressCbk;

            this._loader.loadManifest(this._manifest);;

            return this;
        },

        init: function() {

            var manifestEl = $('#preload_manifest img'),
                that = this;

            // Build manifest
            for (var i = manifestEl.length; i-- > 0;) {
                this._manifest.push({
                    src : manifestEl.eq(i).data('src'),
                    id  : manifestEl.eq(i).data('id')
                });
            }

            // Create loader
            this._loader = new createjs.LoadQueue(false);

            // Bind events
            this._loader.addEventListener('complete', function() {
                that._doneCbk && that._doneCbk();
            });

            this._loader.addEventListener('progress', function(event) {
                that._progressCbk && that._progressCbk(event.progress);
            });

            return this;
        }
    };
    // 七个花瓣的指引页面
    var guidePage = {

        _HIDE_SPEED : 3000,

        // Words tip
        _OP_TIP_WORDS_POS_X : 562,
        _OP_TIP_WORDS_POS_Y : 500,

        // Flowers的位置信息
        _FLOWER_CONTAINER_X : 300,
        _FLOWER_CONTAINER_Y : 50,

        _FLOWER1_POS_X   : 31,
        _FLOWER1_POS_Y   : 333,
        _FLOWER1_POS_X_H : -19,
        _FLOWER1_POS_Y_H : 383,

        _FLOWER2_POS_X   : 151,
        _FLOWER2_POS_Y   : 233,
        _FLOWER2_POS_X_H : 81,
        _FLOWER2_POS_Y_H : 203,

        _FLOWER3_POS_X   : 301,
        _FLOWER3_POS_Y   : 183,
        _FLOWER3_POS_X_H : 281,
        _FLOWER3_POS_Y_H : 133,

        _FLOWER4_POS_X   : 461,
        _FLOWER4_POS_Y   : 183,
        _FLOWER4_POS_X_H : 471,
        _FLOWER4_POS_Y_H : 163,

        _FLOWER5_POS_X   : 581,
        _FLOWER5_POS_Y   : 293,
        _FLOWER5_POS_X_H : 571,
        _FLOWER5_POS_Y_H : 313,

        _FLOWER6_POS_X   : 746,
        _FLOWER6_POS_Y   : 248,
        _FLOWER6_POS_X_H : 756,
        _FLOWER6_POS_Y_H : 258,

        _FLOWER7_POS_X   : 741,
        _FLOWER7_POS_Y   : 98,
        _FLOWER7_POS_X_H : 741,
        _FLOWER7_POS_Y_H : 78,

        _FLOWER_FLY_SPEED    : 2500,
        _FLOWER_ROTATE_SPEED : 1300,
        _FLOWER_REG_X        : 31,
        _FLOWER_REG_Y        : 33,

        _FLOWER_COUNT     : 7,
        _FLOWER_AREA_SIZE : 100,

        // Flower touch areas
        _FLOWER_AREA_LIST : [
            { x : 280, y : 333 },
            { x : 400, y : 233 },
            { x : 550, y : 183 },
            { x : 710, y : 183 },
            { x : 830, y : 293 },
            { x : 997, y : 248 },
            { x : 990, y : 98 }
        ],

        // Dots between flowers
        _DOT_SCALE : 0.7,

        _DOT1_POS_X  : 55,
        _DOT1_POS_Y  : 295,
        _DOT1_ROTATE : -45,

        _DOT2_POS_X  : 190,
        _DOT2_POS_Y  : 205,
        _DOT2_ROTATE : -20,

        _DOT3_POS_X  : 345,
        _DOT3_POS_Y  : 165,
        _DOT3_ROTATE : 2,

        _DOT4_POS_X  : 510,
        _DOT4_POS_Y  : 200,
        _DOT4_ROTATE : 50,

        _DOT5_POS_X  : 630,
        _DOT5_POS_Y  : 270,
        _DOT5_ROTATE : -20,

        _DOT6_POS_X  : 730,
        _DOT6_POS_Y  : 205,
        _DOT6_ROTATE : -92,

        _DOT_ALPHA      : 0.2,
        _DOT_FADE_SPEED : 1000,

        // Hand tip
        _HAND_TIP_WIDTH  : 218,
        _HAND_TIP_HEIGHT : 200,
        _HAND_TIP_X      : 450,
        _HAND_TIP_Y      : 400,
        _HAND_TIP_ROTATE : -39,
        _HAND_TIP_SPEED  : 500,
        _FRAME_SPEED     : 0.05,

        _buildSprites: function() {

            this._flowerSprite1 = new createjs.Bitmap(loader.get('flower'));
            this._flowerSprite2 = new createjs.Bitmap(loader.get('flower'));
            this._flowerSprite3 = new createjs.Bitmap(loader.get('flower'));
            this._flowerSprite4 = new createjs.Bitmap(loader.get('flower'));
            this._flowerSprite5 = new createjs.Bitmap(loader.get('flower'));
            this._flowerSprite6 = new createjs.Bitmap(loader.get('flower'));
            this._flowerSprite7 = new createjs.Bitmap(loader.get('flower'));

            this._dotSprite1 = new createjs.Bitmap(loader.get('dot'));
            this._dotSprite2 = new createjs.Bitmap(loader.get('dot'));
            this._dotSprite3 = new createjs.Bitmap(loader.get('dot'));
            this._dotSprite4 = new createjs.Bitmap(loader.get('dot'));
            this._dotSprite5 = new createjs.Bitmap(loader.get('dot'));
            this._dotSprite6 = new createjs.Bitmap(loader.get('dot'));

            this._opTipWordsSprite = new createjs.Bitmap(loader.get('optipwords'));

            this._flowerContainer = new createjs.Container();
            this._flowerContainer.addChild(this._flowerSprite1, this._flowerSprite2,
                    this._flowerSprite3, this._flowerSprite4, this._flowerSprite5,
                    this._flowerSprite6, this._flowerSprite7, this._dotSprite1,
                    this._dotSprite2, this._dotSprite3, this._dotSprite4,
                    this._dotSprite5, this._dotSprite6);

            this._handTipSprite = new createjs.Sprite(new createjs.SpriteSheet({
                images : [loader.get('handtip')],
                frames : {
                    width  : this._HAND_TIP_WIDTH,
                    height : this._HAND_TIP_HEIGHT,
                    regX   : this._HAND_TIP_WIDTH / 2,
                    regY   : this._HAND_TIP_HEIGHT / 2
                },
                animations : {
                    slide : [0, 4, 'slide', this._FRAME_SPEED]
                }
            }), 'slide');

            this._itemContainer = new createjs.Container();
            this._itemContainer.addChild(this._opTipWordsSprite,
                    this._flowerContainer, this._handTipSprite);

            return this;
        },

        _setSprites: function() {

            this._opTipWordsSprite.set({
                x : this._OP_TIP_WORDS_POS_X,
                y : this._OP_TIP_WORDS_POS_Y
            });

            this._flowerContainer.set({
                x : this._FLOWER_CONTAINER_X,
                y : this._FLOWER_CONTAINER_Y
            });

            this._flowerSprite1.set({
                x    : this._FLOWER1_POS_X,
                y    : this._FLOWER1_POS_Y,
                regX : this._FLOWER_REG_X,
                regY : this._FLOWER_REG_Y
            });
            this._flowerSprite2.set({
                x    : this._FLOWER2_POS_X,
                y    : this._FLOWER2_POS_Y,
                regX : this._FLOWER_REG_X,
                regY : this._FLOWER_REG_Y
            });
            this._flowerSprite3.set({
                x    : this._FLOWER3_POS_X,
                y    : this._FLOWER3_POS_Y,
                regX : this._FLOWER_REG_X,
                regY : this._FLOWER_REG_Y
            });
            this._flowerSprite4.set({
                x    : this._FLOWER4_POS_X,
                y    : this._FLOWER4_POS_Y,
                regX : this._FLOWER_REG_X,
                regY : this._FLOWER_REG_Y
            });
            this._flowerSprite5.set({
                x    : this._FLOWER5_POS_X,
                y    : this._FLOWER5_POS_Y,
                regX : this._FLOWER_REG_X,
                regY : this._FLOWER_REG_Y
            });
            this._flowerSprite6.set({
                x    : this._FLOWER6_POS_X,
                y    : this._FLOWER6_POS_Y,
                regX : this._FLOWER_REG_X,
                regY : this._FLOWER_REG_Y
            });
            this._flowerSprite7.set({
                x    : this._FLOWER7_POS_X,
                y    : this._FLOWER7_POS_Y,
                regX : this._FLOWER_REG_X,
                regY : this._FLOWER_REG_Y
            });

            this._dotSprite1.set({
                x        : this._DOT1_POS_X,
                y        : this._DOT1_POS_Y,
                scaleX   : this._DOT_SCALE,
                scaleY   : this._DOT_SCALE,
                rotation : this._DOT1_ROTATE,
                alpha    : this._DOT_ALPHA
            });
            this._dotSprite2.set({
                x        : this._DOT2_POS_X,
                y        : this._DOT2_POS_Y,
                scaleX   : this._DOT_SCALE,
                scaleY   : this._DOT_SCALE,
                rotation : this._DOT2_ROTATE,
                alpha    : this._DOT_ALPHA
            });
            this._dotSprite3.set({
                x        : this._DOT3_POS_X,
                y        : this._DOT3_POS_Y,
                scaleX   : this._DOT_SCALE,
                scaleY   : this._DOT_SCALE,
                rotation : this._DOT3_ROTATE,
                alpha    : this._DOT_ALPHA
            });
            this._dotSprite4.set({
                x        : this._DOT4_POS_X,
                y        : this._DOT4_POS_Y,
                scaleX   : this._DOT_SCALE,
                scaleY   : this._DOT_SCALE,
                rotation : this._DOT4_ROTATE,
                alpha    : this._DOT_ALPHA
            });
            this._dotSprite5.set({
                x        : this._DOT5_POS_X,
                y        : this._DOT5_POS_Y,
                scaleX   : this._DOT_SCALE,
                scaleY   : this._DOT_SCALE,
                rotation : this._DOT5_ROTATE,
                alpha    : this._DOT_ALPHA
            });
            this._dotSprite6.set({
                x        : this._DOT6_POS_X,
                y        : this._DOT6_POS_Y,
                scaleX   : this._DOT_SCALE,
                scaleY   : this._DOT_SCALE,
                rotation : this._DOT6_ROTATE,
                alpha    : this._DOT_ALPHA
            });

            this._handTipSprite.set({
                x        : this._HAND_TIP_X,
                y        : this._HAND_TIP_Y,
                rotation : this._HAND_TIP_ROTATE
            });

            return this;
        },

        _hideTip: function() {
            createjs.Tween.get(this._handTipSprite).to({
                alpha : 0
            }, this._HAND_TIP_SPEED);
            return this;
        },

        _hide: function(callback) {

            var that = this;

            createjs.Tween.get(this._flowerSprite1).to({
                x : this._FLOWER1_POS_X_H,
                y : this._FLOWER1_POS_Y_H
            }, this._FLOWER_FLY_SPEED);
            createjs.Tween.get(this._flowerSprite2).to({
                x : this._FLOWER2_POS_X_H,
                y : this._FLOWER2_POS_Y_H
            }, this._FLOWER_FLY_SPEED);
            createjs.Tween.get(this._flowerSprite3).to({
                x : this._FLOWER3_POS_X_H,
                y : this._FLOWER3_POS_Y_H
            }, this._FLOWER_FLY_SPEED);
            createjs.Tween.get(this._flowerSprite4).to({
                x : this._FLOWER4_POS_X_H,
                y : this._FLOWER4_POS_Y_H
            }, this._FLOWER_FLY_SPEED);
            createjs.Tween.get(this._flowerSprite5).to({
                x : this._FLOWER5_POS_X_H,
                y : this._FLOWER5_POS_Y_H
            }, this._FLOWER_FLY_SPEED);
            createjs.Tween.get(this._flowerSprite6).to({
                x : this._FLOWER6_POS_X_H,
                y : this._FLOWER6_POS_Y_H
            }, this._FLOWER_FLY_SPEED);
            createjs.Tween.get(this._flowerSprite7).to({
                x : this._FLOWER7_POS_X_H,
                y : this._FLOWER7_POS_Y_H
            }, this._FLOWER_FLY_SPEED);

            createjs.Tween.get(this._itemContainer).to({
                alpha : 0
            }, this._HIDE_SPEED).call(function() {
                callback && callback.call(that);
            });

            return this;
        },

        // Rotate the target flower and light the target dot
        _setRotate: function(index) {

            var arrFlower = [this._flowerSprite1, this._flowerSprite2,
                    this._flowerSprite3, this._flowerSprite4,
                    this._flowerSprite5, this._flowerSprite6,
                    this._flowerSprite7],
                arrDot = [this._dotSprite1, this._dotSprite2,
                    this._dotSprite3, this._dotSprite4,
                    this._dotSprite5, this._dotSprite6];

            createjs.Tween.get(arrFlower[index], {
                loop : true
            }).to({
                rotation : 360
            }, this._FLOWER_ROTATE_SPEED);

            index > 0 && createjs.Tween.get(arrDot[index - 1]).to({
                alpha : 1
            }, this._DOT_FADE_SPEED);

            return this;
        },

        // Listen to the touch event and enable the target flower
        _bindTouch: function() {

            var currFlower = 0,
                currArea   = this._FLOWER_AREA_LIST[currFlower],
                that       = this,
                touchId    = null,
                tipHidden  = false;

            function isPointInArea(data) {
                var diffX = data.x - currArea.x,
                    diffY = data.y - currArea.y;

                return diffX > 0 && diffX < that._FLOWER_AREA_SIZE &&
                        diffY > 0 && diffY < that._FLOWER_AREA_SIZE;
            }

            touchId = touch.onMove(function(data) {

                if (isPointInArea(data)) {

                    if (!tipHidden) {
                        tipHidden = true;
                        that._hideTip();
                    }

                    that._setRotate(currFlower);

                    if (++currFlower >= that._FLOWER_COUNT) {

                        touch.offMove(touchId);

                        that._hide(function() {
                            that._doneCbk && that._doneCbk();
                        });

                    } else {
                        currArea = that._FLOWER_AREA_LIST[currFlower];
                    }
                }
            });

            return this;
        },

        addToStage: function(stage, index) {
            stage.addChildAt(this._itemContainer, index);
            return this;
        },

        removeFromStage: function(stage) {
            stage.removeChild(this._itemContainer);
            return this;
        },

        // Set the 'operation done' callback
        setDone: function(callback) {
            this._doneCbk = callback;
            return this;
        },

        init: function() {
            return this._buildSprites()._setSprites()._bindTouch();
        }
    };
    /*
    	Animation director 动画导演
    	这里控制了所有的动画播放顺序和页面之间的逻辑关系
    */
    var director = {
    	 _curr    : 0,
        _queue   : [],
        _enabled : false,
        playGuide: function(callback){
        	var that = this;
        	var stage = stageController.getStage();
        	var index = stage.getChildIndex();
        	// var index = stage.getChildIndex(girl.getSprite());
        	// homePage.addToStage(stage, index);
        	//调用guidePage对象的addToStage方法
            guidePage.addToStage(stage, index + 1);
            //把回调传入guidePage对象中
            guidePage.setDone(function() {
                // callback && callback.call(that);
            });

            return this;
        },
        startPlay: function() {
            return this.playGuide(function() {
                this.playPage1(function() {
                    this._enabled = true;
                });
            });
        },
        init: function(){
        	var that = this;
        	this._curr = 0;
        	this._enabled = false;
        	// this._queue.push(this.playPage2);
         //    this._queue.push(this.playPage3);
         //    this._queue.push(this.playPage4);

            touch.onStart(function() {
                if (that._enabled && that._curr < 3) {
                    that._enabled = false;
                    that._queue[that._curr++](function() {
                        that._enabled = true;
                    });
                }
            });

            return this;
        }
    }
    /*
    	这里是转屏提示页面，通过判断width和height的关系，以及devicemotion事件中的zy的值
    	来判断用户是否处于横屏状态，显示或隐藏横屏提示
    */
    var pageCover = {
    	_hideTip: function(){
    		$('#page_cover').fadeOut();
            return this;
    	},
    	_showTip: function() {},
    	init: function(ready){
    		//传入一个横屏确认之后的回调函数
    		var self = this,
    			done = false,
    			listeningStarted = false;
    		function onDone() {
                if (!done) {
                    done = true;

                    $(window).unbind('resize', onWindowResize);
                    window.removeEventListener('devicemotion', onDeviceMotion);

                    that._hideTip();
                    typeof ready === 'function' && ready();
                }
            }
            function onDeviceMotion(event) {
                if (Math.abs(event.accelerationIncludingGravity.x) > 6) {
                    if (listeningStarted) {
                        onDone();
                    }
                }

                return false
            }
            function onWindowResize(){
            	/*
            		当浏览器宽度改变，即用户调整横竖屏，
            		如果为横屏，调用onDone
            	*/
                if (document.documentElement.clientWidth >
                        document.documentElement.clientHeight) {
                    onDone();
                }
                return false;
            }
            //如果当前处于横屏
            if (document.documentElement.clientWidth >
                    document.documentElement.clientHeight) {
                this._hideTip();
                typeof ready === 'function' && ready();

            } else {
                this._showTip();
                $(window).bind('resize', onWindowResize);
                /*
                	devicemotion事件是在一个固定的时间间隔内触发的，
                	并指示设备在那个时候接收到的加速度的物理力量。
                	它还提供了关于旋转速度的信息
                */
                window.addEventListener('devicemotion', onDeviceMotion, false);

                setTimeout(function() {
                    listeningStarted = true;
                }, 2000);
            }
    	}
    }
    //核心stage调用
    var stageController = {
    	_FRAME_RATE: 30,
    	/*
    		Ticker提供了一个集中的滴答声和心跳在设定的时间间隔广播。
    		当一个集合的时间间隔已经过去，听众可以订阅的滴答事件。
    	*/
    	_play: function(){
    		createjs.Ticker.timingMode = createjs.Ticker.RAF;
    		createjs.Ticker.setFPS(this._FRAME_RATE);
    		createjs.Ticker.addEventListener('tick', this._stage);
    	},
    	getStage: function(){
    		return this._stage;
    	},
    	//_stage属性在init方法中设定
    	init: function(){
    		//传入canvas元素的id
    		this._stage = new createjs.Stage('stage_canvas');
    		//多个页面的初始化
    		guidePage.init();
            // homePage.init();
            // treePage.init();
            // flowerPage.init();
            // girl.init().addToStage(this._stage);
            // words.init().addToStage(this._stage);
            // nextTip.init().addToStage(this._stage);
            this._stage.set({
            	x: 0,
            	y: 0
            });
            //开启移动端支持
            createjs.Touch.enable(this._stage);
    		this._play();
    		return this;
    	}
    }
    //初始化调用
    scale.init().addEl($('#stage_canvas'));
    touch.init();
    music.init();

    var loadingEl    = $('#loading'),
        loadingTipEl = $('#loading_tip span');

    loader.init().load(function() {

        setTimeout(function() {
            loadingEl.fadeOut(500, function() {
                loadingEl.remove();
            });
        }, 1000);
        //核心stage调用
        stageController.init();

        pageCover.init(function() {

            director.init().startPlay();

        });

    }, function(progress) {
        loadingTipEl.html(Math.floor(progress * 100));
    });
})()
