var $ = require('./jquery.min.js');
require('./preloadjs.min.js');


$(function() {

    'use strict';

    // ************************************************************************
    // Music
    // ************************************************************************
    var music = {

        init: function() {

            var music = $('audio')[0];

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

    // ************************************************************************
    // Page scale controller
    // 根据当前屏幕的大小和目标元素的大小计算元素的缩放比例，并缩放元素适应屏幕
    // ************************************************************************
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

    // ************************************************************************
    // Touch event handler
    // 封装了touch事件处理，根据scale对象提供的缩放信息，把touch事件发生的屏幕位置换算成
    // canvas上的位置，并调用注册的回调函数
    // ************************************************************************
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

    // ************************************************************************
    // Image loader
    // ************************************************************************
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

    // ************************************************************************
    // Sprites
    // 这里编写了页面上所有的精灵，并提供了操作精灵的方法，供director对象调用
    // ************************************************************************
    // 小女孩
    var girl = {

        // Frame size
        _PICWIDTH  : 135,
        _PICHEIGHT : 100,

        // Frame speed
        _FRAME_RATE        : 15,
        _STAND_FRAME_SPEED : 1,
        _WALK_FRAME_SPEED  : 1,
        _RUN_FRAME_SPEED   : 1,

        // Animation ease
        _EASE : createjs.Ease.sineInOut,
        // Animation positions
        _INIT_POS_X      : 500,
        _INIT_POS_Y      : 1030,
        _CENTER_POS_X    : 660,
        _MOVE_DOWN_POS_Y : 400,
        _DROP_DOWN_POS_Y : 490,
        _RUN_IN_POS_X    : -100,
        _RUN_OUT_POS_X   : 1500,
        // Animation speed
        _WALK_SPEED : 5000,
        _RUN_SPEED  : 5000,
        _MOVE_SPEED : 5000,
        _DROP_SPEED : 12000,

        _GIRLLIGHT_WIDTH       : 180,
        _GIRLLIGHT_HEIGHT      : 150,
        _GIRLLIGHT_POS_X       : 600,
        _GIRLLIGHT_POS_Y       : 500,
        _GIRLLIGHT_ALPHA       : 0.8,
        _GIRLLIGHT_SPEED       : 2000,
        _GIRLLIGHT_FRAME_SPEED : 0.3,

        _CLOUD_POS_X   : 600,
        _CLOUD_POS_Y   : 505,
        _CLOUD_POS_Y_H : 415,
        _CLOUD_SCALE_X : 0.3,
        _CLOUD_SCALE_Y : 0.25,
        _CLOUD_ALPHA   : 0.8,

        _buildSprites: function() {

            this._girlSprite = new createjs.Sprite(new createjs.SpriteSheet({
                images : [loader.get('girl')],
                frames : {
                    width  : this._PICWIDTH,
                    height : this._PICHEIGHT,
                    regX   : this._PICWIDTH  / 2,
                    regY   : this._PICHEIGHT / 2
                },
                animations : {
                    stand : [0,  20, 'stand', this._STAND_FRAME_SPEED],
                    walk  : [21, 36, 'walk',  this._WALK_FRAME_SPEED],
                    run   : [37, 47, 'run',   this._RUN_FRAME_SPEED]
                }
            }), 'stand');

            this._girlLightsSprite = new createjs.Sprite(new createjs.SpriteSheet({
                images : [loader.get('girllights')],
                frames : {
                    width  : this._GIRLLIGHT_WIDTH,
                    height : this._GIRLLIGHT_HEIGHT,
                    regX   : this._GIRLLIGHT_WIDTH  / 2,
                    regY   : this._GIRLLIGHT_HEIGHT / 2
                },
                animations : {
                    light : [0,  29, 'light', this._GIRLLIGHT_FRAME_SPEED],
                }
            }), 'light');

            this._cloudSprite = new createjs.Bitmap(loader.get('cloud1'));

            this._itemContainer = new createjs.Container();
            this._itemContainer.addChild(this._girlSprite, this._girlLightsSprite,
                    this._cloudSprite);

            return this;
        },

        _setSprites: function() {

            this._girlSprite.set({
                framerate : this._FRAME_RATE,
                x : this._INIT_POS_X,
                y : this._INIT_POS_Y
            });

            this._girlLightsSprite.set({
                x     : this._GIRLLIGHT_POS_X,
                y     : this._GIRLLIGHT_POS_Y,
                alpha : 0
            });

            this._cloudSprite.set({
                x      : this._CLOUD_POS_X,
                y      : this._CLOUD_POS_Y_H,
                scaleX : this._CLOUD_SCALE_X,
                scaleY : this._CLOUD_SCALE_Y,
                alpha  : 0
            });

            return this;
        },

        // Animation switcher
        _doSwitch: function(callback) {

            var that = this;

            // createjs.Tween.get(this._girlSprite).to({ alpha : 0.4 }, 500).call(function() {
            //     callback && callback.call(that);
            //     createjs.Tween.get(that._sprite).to({ alpha : 1 }, 2000);
            // });

            callback && callback.call(that);

            return this;
        },

        addToStage: function(stage) {
            stage.addChild(this._itemContainer);
            return this;
        },

        getSprite: function() {
            return this._itemContainer;
        },

        stand: function() {
            return this._doSwitch(function() {
                this._girlSprite.gotoAndPlay('stand');
            });
        },

        runIn: function(callback) {

            var that = this;

            return this._doSwitch(function() {

                this._girlSprite.gotoAndPlay('run');
                this._girlSprite.x = this._RUN_IN_POS_X;

                createjs.Tween.get(this._girlSprite).to({
                    x : this._CENTER_POS_X
                }, this._RUN_SPEED).call(function() {
                    that.stand();
                    callback && callback.call(that);
                });
            });
        },

        runOut: function(callback) {

            var that = this;

            return this._doSwitch(function() {

                this._girlSprite.gotoAndPlay('run');

                createjs.Tween.get(this._girlSprite).to({
                    x : this._RUN_OUT_POS_X
                }, this._RUN_SPEED).call(function() {
                    callback && callback.call(that);
                });
            });
        },

        walk: function() {
            return this._doSwitch(function() {
                this._girlSprite.gotoAndPlay('walk');
            });
        },

        walkToCenter: function(callback) {

            var that = this;

            return this._doSwitch(function() {

                this._girlSprite.gotoAndPlay('walk');

                createjs.Tween.get(this._girlSprite).to({
                    x : this._CENTER_POS_X
                }, this._WALK_SPEED).call(function() {
                    that.stand();
                    callback && callback.call(that);
                });
            });
        },

        moveDown: function(callback) {

            var that = this;

            this._girlSprite.gotoAndPlay('stand');

            createjs.Tween.get(this._girlSprite).to({
                y : this._MOVE_DOWN_POS_Y
            }, this._MOVE_SPEED, this._EASE).call(function() {
                callback && callback.call(that);
            });

            return this;
        },

        dropDown: function(callback) {

            var that = this;

            this._girlSprite.gotoAndPlay('stand');

            createjs.Tween.get(this._girlSprite).to({
                y : this._DROP_DOWN_POS_Y
            }, this._DROP_SPEED, this._EASE).call(function() {
                callback && callback.call(that);
            });

            createjs.Tween.get(this._cloudSprite).to({
                y : this._CLOUD_POS_Y
            }, this._DROP_SPEED, this._EASE);

            createjs.Tween.get(this._cloudSprite).to({
                alpha : this._CLOUD_ALPHA
            }, this._DROP_SPEED / 3).to({
                alpha : 0
            }, this._DROP_SPEED / 3);

            return this;
        },

        shine: function() {
            createjs.Tween.get(this._girlLightsSprite).to({
                alpha : this._GIRLLIGHT_ALPHA
            }, this._GIRLLIGHT_SPEED);
            return this;
        },

        init: function() {
            return this._buildSprites()._setSprites();
        }
    };

    // 每一屏的文字信息
    var words = {

        _SPEED : 1000,

        // Words1
        _P1W1_POS_X   : 288,
        _P1W1_POS_X_H : 268,
        _P1W1_POS_Y   : 110,
        _P1W1_POS_Y_H : 110,

        _P1W2_POS_X   : 372,
        _P1W2_POS_X_H : 352,
        _P1W2_POS_Y   : 134,
        _P1W2_POS_Y_H : 134,

        _P1W1_SPEED   : 2000,
        _P1W2_SPEED   : 2000,
        _P1W1_SPEED_H : 1000,
        _P1W2_SPEED_H : 1000,

        // Words2
        _P2W1_POS_X   : 390,
        _P2W1_POS_X_H : 390,
        _P2W1_POS_Y   : 230,
        _P2W1_POS_Y_H : 230,

        _P2W2_POS_X   : 430,
        _P2W2_POS_X_H : 450,
        _P2W2_POS_Y   : 230,
        _P2W2_POS_Y_H : 230,

        _P2W1_SPEED   : 2000,
        _P2W2_SPEED   : 2000,
        _P2W1_SPEED_H : 1000,
        _P2W2_SPEED_H : 1000,

        // Words3
        _P3W1_POS_X   : 300,
        _P3W1_POS_X_H : 280,
        _P3W1_POS_Y   : 70,
        _P3W1_POS_Y_H : 70,

        _P3W2_POS_X   : 400,
        _P3W2_POS_X_H : 420,
        _P3W2_POS_Y   : 144,
        _P3W2_POS_Y_H : 144,

        _P3W1_SPEED   : 2000,
        _P3W2_SPEED   : 2000,
        _P3W1_SPEED_H : 1000,
        _P3W2_SPEED_H : 1000,

        // Words4
        _P4W1_POS_X   : 525,
        _P4W1_POS_X_H : 525,
        _P4W1_POS_Y   : 270,
        _P4W1_POS_Y_H : 270,

        _P4W2_POS_X   : 304,
        _P4W2_POS_X_H : 304,
        _P4W2_POS_Y   : 165,
        _P4W2_POS_Y_H : 165,

        _P4W3_POS_X   : 609,
        _P4W3_POS_X_H : 609,
        _P4W3_POS_Y   : 315,
        _P4W3_POS_Y_H : 315,

        _P4W1_SPEED   : 3000,
        _P4W2_SPEED   : 3000,
        _P4W3_SPEED   : 1000,
        _P4W1_SPEED_H : 1000,
        _P4W2_SPEED_H : 1000,
        _P4W3_SPEED_H : 1000,

        _buildSprites: function() {

            this._p1w1 = new createjs.Bitmap(loader.get('p1w1'));
            this._p1w2 = new createjs.Bitmap(loader.get('p1w2'));
            this._p2w1 = new createjs.Bitmap(loader.get('p2w1'));
            this._p2w2 = new createjs.Bitmap(loader.get('p2w2'));
            this._p3w1 = new createjs.Bitmap(loader.get('p3w1'));
            this._p3w2 = new createjs.Bitmap(loader.get('p3w2'));
            this._p4w1 = new createjs.Bitmap(loader.get('p4w1'));
            this._p4w2 = new createjs.Bitmap(loader.get('p4w2'));
            this._p4w3 = new createjs.Bitmap(loader.get('p4w3'));

            return this;
        },

        _setSprites: function() {

            this._p1w1.set({
                x : this._P1W1_POS_X_H,
                y : this._P1W1_POS_Y_H,
                alpha : 0
            });
            this._p1w2.set({
                x : this._P1W2_POS_X_H,
                y : this._P1W2_POS_Y_H,
                alpha : 0
            });
            this._p2w1.set({
                x : this._P2W1_POS_X_H,
                y : this._P2W1_POS_Y_H,
                alpha : 0
            });
            this._p2w2.set({
                x : this._P2W2_POS_X_H,
                y : this._P2W2_POS_Y_H,
                alpha : 0
            });
            this._p3w1.set({
                x : this._P3W1_POS_X_H,
                y : this._P3W1_POS_Y_H,
                alpha : 0
            });
            this._p3w2.set({
                x : this._P3W2_POS_X_H,
                y : this._P3W2_POS_Y_H,
                alpha : 0
            });
            this._p4w1.set({
                x : this._P4W1_POS_X_H,
                y : this._P4W1_POS_Y_H,
                alpha : 0
            });
            this._p4w2.set({
                x : this._P4W2_POS_X_H,
                y : this._P4W2_POS_Y_H,
                alpha : 0
            });
            this._p4w3.set({
                x : this._P4W3_POS_X_H,
                y : this._P4W3_POS_Y_H,
                alpha : 0
            });

            return this;
        },

        _show: function(item, x, y, speed, callback) {

            var that = this;

            createjs.Tween.get(item).to({
                alpha : 1,
                x     : x,
                y     : y
            }, speed || this._SPEED).call(function() {
                callback && callback.call(that);
            });

            return this;
        },

        _hide: function(item, x, y, speed, callback) {

            var that = this;

            createjs.Tween.get(item).to({
                alpha : 0,
                x     : x,
                y     : y
            }, speed || this._SPEED).call(function() {
                callback && callback.call(that);
            });

            return this;
        },

        addToStage: function(stage) {
            stage.addChild(this._p1w1, this._p1w2,
                    this._p2w1, this._p2w2,
                    this._p3w1, this._p3w2,
                    this._p4w1, this._p4w2, this._p4w3);
            return this;
        },

        showP1: function(callback) {
            return this._show(this._p1w1, this._P1W1_POS_X,
                    this._P1W1_POS_Y, this._P1W1_SPEED, function() {
                this._show(this._p1w2, this._P1W2_POS_X, this._P1W2_POS_Y,
                        this._P1W2_SPEED, callback);
            });
        },

        showP2: function(callback) {
            return this._show(this._p2w1, this._P2W1_POS_X,
                    this._P2W1_POS_Y, this._P2W1_SPEED, function() {
                this._show(this._p2w2, this._P2W2_POS_X, this._P2W2_POS_Y,
                        this._P2W2_SPEED, callback);
            });
        },

        showP3: function(callback) {
            return this._show(this._p3w1, this._P3W1_POS_X,
                    this._P3W1_POS_Y, this._P3W1_SPEED, function() {
                this._show(this._p3w2, this._P3W2_POS_X, this._P3W2_POS_Y,
                        this._P3W2_SPEED, callback);
            });
        },

        showP4: function(callback) {
            return this._show(this._p4w1, this._P4W1_POS_X,
                    this._P4W1_POS_Y, this._P4W1_SPEED, function() {
                this._show(this._p4w2, this._P4W2_POS_X, this._P4W2_POS_Y,
                        this._P4W2_SPEED, function() {
                    this._show(this._p4w3, this._P4W3_POS_X, this._P4W3_POS_Y,
                            this._P4W3_SPEED, callback);
                });
            });
        },

        hideP1: function(callback) {
            var that = this;
            this._hide(this._p1w1, this._P1W1_POS_X_H, this._P1W1_POS_Y_H, null);
            this._hide(this._p1w2, this._P1W2_POS_X_H, this._P1W2_POS_Y_H, null);
            setTimeout(function() {
                callback && callback.call(that);
            }, this._P1W2_SPEED_H);
            return this;
        },

        hideP2: function(callback) {
            var that = this;
            this._hide(this._p2w1, this._P2W1_POS_X_H, this._P2W1_POS_Y_H, null);
            this._hide(this._p2w2, this._P2W2_POS_X_H, this._P2W2_POS_Y_H, null);
            setTimeout(function() {
                callback && callback.call(that);
            }, this._P2W2_SPEED_H);
            return this;
        },

        hideP3: function(callback) {
            var that = this;
            this._hide(this._p3w1, this._P3W1_POS_X_H, this._P3W1_POS_Y_H, null);
            this._hide(this._p3w2, this._P3W2_POS_X_H, this._P3W2_POS_Y_H, null);
            setTimeout(function() {
                callback && callback.call(that);
            }, this._P3W2_SPEED_H);
            return this;
        },

        init: function() {
            return this._buildSprites()._setSprites();
        }
    };

    // 点击进入下一屏的圆点提示
    var nextTip = {

        _HIDE_SPEED : 1000,
        _RECT_SIZE  : 100,

        _RECT_POS : [
            { x : 1000, y : 380 },
            { x : 1000, y : 380 },
            { x : 1000, y : 380 }
        ],

        _CIRCLE_SIZE  : 69,
        _CIRCLE_ALPHA : 0.6,
        _CIRCLE_SCALE : 1.4,
        _CIRCLE_SPEED : 1000,

        _buildSprites: function() {

            this._optipSprite  = new createjs.Bitmap(loader.get('optipbtn'));
            this._circleSprite = new createjs.Bitmap(loader.get('optipcircle'));

            this._itemContainer = new createjs.Container();
            this._itemContainer.addChild(this._circleSprite, this._optipSprite);

            return this;
        },

        _setSprites: function() {

            this._optipSprite.set({
                x    : this._RECT_SIZE / 2,
                y    : this._RECT_SIZE / 2,
                regX : this._CIRCLE_SIZE / 2,
                regY : this._CIRCLE_SIZE / 2
            });

            this._circleSprite.set({
                x     : this._RECT_SIZE / 2,
                y     : this._RECT_SIZE / 2,
                regX  : this._CIRCLE_SIZE / 2,
                regY  : this._CIRCLE_SIZE / 2,
                alpha : this._CIRCLE_ALPHA
            });

            this._itemContainer.set({
                x     : this._RECT_POS_X,
                y     : this._RECT_POS_Y,
                alpha : 0
            });

            return this;
        },

        _startPlay: function() {

            createjs.Tween.get(this._circleSprite, {
                loop : true
            }).to({
                alpha  : 0,
                scaleX : this._CIRCLE_SCALE,
                scaleY : this._CIRCLE_SCALE
            }, this._CIRCLE_SPEED);

            return this;
        },

        show: function(index) {

            this._itemContainer.set(this._RECT_POS[index]);

            createjs.Tween.get(this._itemContainer).to({
                alpha : 1
            }, this._HIDE_SPEED);

            return this;
        },

        hide: function() {

            var that = this;

            this._itemContainer.set({
                x : 2000
            });

            setTimeout(function() {
                that._itemContainer.set({
                    alpha : 0
                });
            }, this._HIDE_SPEED + 1000);

            return this;
        },

        addToStage: function(stage) {
            stage.addChild(this._itemContainer);
            return this;
        },

        showTip1: function() {
            return this.show(0);
        },

        showTip2: function() {
            return this.show(1);
        },

        showTip3: function() {
            return this.show(2);
        },

        init: function() {
            return this._buildSprites()._setSprites()._startPlay();
        }
    };

    // 七个花瓣的指引页面
    var guidePage = {

        _HIDE_SPEED : 3000,

        // Words tip
        _OP_TIP_WORDS_POS_X : 562,
        _OP_TIP_WORDS_POS_Y : 500,

        // Flowers
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

    // 小女孩从空中掉落的页面
    var homePage = {

        _EASE : createjs.Ease.sineInOut,

        _MOVE_POS_Y : -600,
        _DROP_POS_Y : -1815,
        _MOVE_SPEED : 5000,
        _WALK_SPEED : 6000,
        _DROP_SPEED : 7000,

        _SHAKE_DISTANCE : 5,
        _SHAKE_TIMES    : 5,
        _SHAKE_SPEED    : 100,

        // moon
        _MOON_POS_X : 842,
        _MOON_POS_Y : 600,

        // clouds
        _CLOUD_POS_X      : -50,
        _CLOUD_POS_X_H    : 50,
        _CLOUD_POS_Y      : 1050,
        _CLOUD_ALPHA      : 0.9,
        _CLOUD_MOVE_POS_Y : 450,
        _CLOUD_DROP_POS_Y : -765,

        _CLOUD_WALK_SPEED : 15000,

        _CLOUD1_DROP_POS_Y : 150,
        _CLOUD2_DROP_POS_Y : 20,
        _CLOUD3_DROP_POS_Y : 130,
        _CLOUD4_DROP_POS_Y : 60,

        _CLOUD_ITEM_DROP_SPEED : 6000,

        // stairs
        _BLOCK1_POS_X  : 648,
        _BLOCK2_POS_X  : 582,
        _BLOCK3_POS_X  : -90,
        _BLOCK_POS_X   : 0,
        _BLOCK_POS_X_H : 20,
        _BLOCK_POS_Y   : 1040,

        _STAIR_POS_X : 854,
        _STAIR_POS_Y : -149,

        _BLOCK1_DROP_POS_X  : 710,
        _BLOCK1_DROP_POS_Y  : 582,
        _BLOCK1_DROP_ROTATE : 45,
        _BLOCK2_DROP_POS_X  : 540,
        _BLOCK2_DROP_POS_Y  : 300,
        _BLOCK2_DROP_ROTATE : -30,

        _BLOCK_DROP_SPEED : 3900,

        // Sky light
        _LIGHT1_POS_X : 100,
        _LIGHT2_POS_X : 150,
        _LIGHT_POS_Y  : 1815,
        _LIGHT_SPEED  : 4000,
        _LIGHT_ALPHA  : 0.8,

        _buildSprites: function() {

            this._bgSprite     = new createjs.Bitmap(loader.get('homePage'));
            this._moonSprite   = new createjs.Bitmap(loader.get('moon'));
            this._cloudSprite1 = new createjs.Bitmap(loader.get('cloud1'));
            this._cloudSprite2 = new createjs.Bitmap(loader.get('cloud2'));
            this._cloudSprite3 = new createjs.Bitmap(loader.get('cloud3'));
            this._cloudSprite4 = new createjs.Bitmap(loader.get('cloud4'));
            this._blockSprite1 = new createjs.Bitmap(loader.get('block1'));
            this._blockSprite2 = new createjs.Bitmap(loader.get('block2'));
            this._blockSprite3 = new createjs.Bitmap(loader.get('blockbig'));
            this._stairSprite  = new createjs.Bitmap(loader.get('stair'));
            this._lightSprite1 = new createjs.Bitmap(loader.get('light'));
            this._lightSprite2 = new createjs.Bitmap(loader.get('light'));

            // Clouds
            this._cloudContainer = new createjs.Container();
            this._cloudContainer.addChild(this._cloudSprite1, this._cloudSprite2,
                    this._cloudSprite3, this._cloudSprite4);

            // Stairs
            this._blockContainer = new createjs.Container();
            this._blockContainer.addChild(this._blockSprite1, this._blockSprite2,
                    this._blockSprite3, this._stairSprite);

            this._itemContainer = new createjs.Container();
            this._itemContainer.addChild(this._bgSprite, this._moonSprite,
                    this._blockContainer, this._lightSprite1, this._lightSprite2);

            return this;
        },

        _setSprites: function() {

            this._bgSprite.set({
                x : 0,
                y : 0
            });

            this._moonSprite.set({
                x : this._MOON_POS_X,
                y : this._MOON_POS_Y
            });

            this._cloudContainer.set({
                x     : this._CLOUD_POS_X_H,
                y     : this._CLOUD_POS_Y,
                alpha : this._CLOUD_ALPHA
            });

            this._blockSprite1.set({
                x : this._BLOCK1_POS_X
            });
            this._blockSprite2.set({
                x : this._BLOCK2_POS_X
            });
            this._blockSprite3.set({
                x : this._BLOCK3_POS_X
            });

            this._blockContainer.set({
                x : this._BLOCK_POS_X_H,
                y : this._BLOCK_POS_Y
            });

            this._stairSprite.set({
                x : this._STAIR_POS_X,
                y : this._STAIR_POS_Y
            });

            this._lightSprite1.set({
                x     : this._LIGHT1_POS_X,
                y     : this._LIGHT_POS_Y,
                alpha : 0
            });
            this._lightSprite2.set({
                x     : this._LIGHT2_POS_X,
                y     : this._LIGHT_POS_Y,
                alpha : 0
            });

            this._itemContainer.set({
                x : 0,
                y : 0
            });

            return this;
        },

        addToStage: function(stage, index) {
            stage.addChildAt(this._itemContainer, index);
            stage.addChild(this._cloudContainer);
            return this;
        },

        removeFromStage: function(stage) {
            stage.removeChild(this._itemContainer);
            stage.removeChild(this._cloudContainer);
            return this;
        },

        moveDown: function() {

            createjs.Tween.get(this._cloudContainer).to({
                y : this._CLOUD_MOVE_POS_Y
            }, this._MOVE_SPEED, this._EASE);

            createjs.Tween.get(this._itemContainer).to({
                y : this._MOVE_POS_Y
            }, this._MOVE_SPEED, this._EASE);

            return this;
        },

        walk: function() {

            createjs.Tween.get(this._blockContainer).to({
                x : this._BLOCK_POS_X
            }, this._WALK_SPEED);

            createjs.Tween.get(this._cloudContainer).to({
                x : this._CLOUD_POS_X
            }, this._CLOUD_WALK_SPEED);

            return this;
        },

        shake: function(callback) {

            var target = createjs.Tween.get(this._itemContainer);

            for (var i = 0; i < this._SHAKE_TIMES; ++i) {
                target.to({
                    x : -this._SHAKE_DISTANCE,
                    y : this._MOVE_POS_Y - this._SHAKE_DISTANCE
                }, this._SHAKE_SPEED).to({
                    x : this._SHAKE_DISTANCE,
                    y : this._MOVE_POS_Y + this._SHAKE_DISTANCE
                }, this._SHAKE_SPEED);
            }

            target.to({
                x : 0,
                y : this._MOVE_POS_Y
            }, this._SHAKE_SPEED).call(function() {
                callback && callback();
            });
        },

        dropDown: function(callback) {

            createjs.Tween.get(this._cloudContainer).to({
                y : this._CLOUD_DROP_POS_Y
            }, this._DROP_SPEED, this._EASE);

            createjs.Tween.get(this._blockSprite1).to({
                x        : this._BLOCK1_DROP_POS_X,
                y        : this._BLOCK1_DROP_POS_Y,
                alpha    : 0,
                rotation : this._BLOCK1_DROP_ROTATE
            }, this._BLOCK_DROP_SPEED, this._EASE);
            createjs.Tween.get(this._blockSprite2).to({
                x        : this._BLOCK2_DROP_POS_X,
                y        : this._BLOCK2_DROP_POS_Y,
                alpha    : 0,
                rotation : this._BLOCK2_DROP_ROTATE
            }, this._BLOCK_DROP_SPEED, this._EASE);

            createjs.Tween.get(this._cloudSprite1).to({
                y : this._CLOUD1_DROP_POS_Y
            }, this._CLOUD_ITEM_DROP_SPEED);
            createjs.Tween.get(this._cloudSprite2).to({
                y : this._CLOUD2_DROP_POS_Y
            }, this._CLOUD_ITEM_DROP_SPEED);
            createjs.Tween.get(this._cloudSprite3).to({
                y : this._CLOUD3_DROP_POS_Y
            }, this._CLOUD_ITEM_DROP_SPEED);
            createjs.Tween.get(this._cloudSprite4).to({
                y : this._CLOUD4_DROP_POS_Y
            }, this._CLOUD_ITEM_DROP_SPEED);

            createjs.Tween.get(this._itemContainer).to({
                y : this._DROP_POS_Y
            }, this._DROP_SPEED, this._EASE).call(function() {
                callback && callback();
            });

            return this;
        },

        showLight: function() {

            var that = this;

            createjs.Tween.get(this._lightSprite1, {
                loop : true
            }).to({
                alpha : this._LIGHT_ALPHA
            }, this._LIGHT_SPEED).to({
                alpha : 0
            }, this._LIGHT_SPEED);

            setTimeout(function() {
                createjs.Tween.get(that._lightSprite2, {
                    loop : true
                }).to({
                    alpha : that._LIGHT_ALPHA
                }, that._LIGHT_SPEED).to({
                    alpha : 0
                }, that._LIGHT_SPEED);
            }, that._LIGHT_SPEED / 2);

            return this;
        },

        init: function() {
            return this._buildSprites()._setSprites();
        }
    };

    // 白色大树的页面
    var treePage = {

        _BIGTREE_POS_Y   : 0,
        _BIGTREE_POS_X   : -1400,
        _BIGTREE_POS_X_H : 1400,
        _BIGTREE_ALPHA   : 1,
        _BIGTREE_SPEED   : 3000,

        _FG_POS_DONE   : -150,
        _FADEIN_SPEED  : 2000,
        _FG_MOVE_SPEED : 8000,

        _buildSprites: function() {

            this._bgSprite = new createjs.Bitmap(loader.get('treePage'));
            this._groundSprite = new createjs.Bitmap(loader.get('ground'));

            this._bigtreeSprite = new createjs.Bitmap(loader.get('bigtree'));

            this._itemContainer = new createjs.Container();
            this._itemContainer.addChild(this._bgSprite, this._groundSprite);

            return this;
        },

        _setSprites: function() {

            this._bigtreeSprite.set({
                x     : this._BIGTREE_POS_X_H,
                y     : 0,
                alpha : this._BIGTREE_ALPHA
            });

            this._itemContainer.set({
                x     : 0,
                y     : 0,
                alpha : 0
            });

            return this;
        },

        addToStage: function(stage, index) {
            stage.addChildAt(this._itemContainer, index);
            stage.addChild(this._bigtreeSprite);
            return this;
        },

        removeFromStage: function(stage) {
            stage.removeChild(this._itemContainer);
            stage.removeChild(this._bigtreeSprite);
            return this;
        },

        move: function(callback) {

            createjs.Tween.get(this._groundSprite).to({
                x : this._FG_POS_DONE
            }, this._FG_MOVE_SPEED).call(function() {
                callback && callback();
            });

            return this;
        },

        show: function(callback) {

            var that = this;

            createjs.Tween.get(this._bigtreeSprite).to({
                x : this._BIGTREE_POS_X
            }, this._BIGTREE_SPEED);

            setTimeout(function() {
                createjs.Tween.get(that._itemContainer).to({
                    alpha : 1
                }, that._FADEIN_SPEED).call(function() {
                    callback && callback();
                });
            }, this._BIGTREE_SPEED / 2);

            return this;
        },

        init: function() {
            return this._buildSprites()._setSprites();
        }
    };

    // 最后花田的页面
    var flowerPage = {

        _TARGET_LINK : 'http://app-down.x.netease.com/download/game/hyy/channel/gw?type=ios',

        _BG_POS_Y     : 1360,
        _FADEIN_SPEED : 2000,

        // Moon light
        _MOONLIGHT_REG_X : 149,
        _MOONLIGHT_REG_Y : 149,
        _MOONLIGHT_POS_X : 690,
        _MOONLIGHT_POS_Y : 155,
        _MOONLIGHT_SPEED : 2000,
        _MOONLIGHT_ALPHA : 0.2,
        _MOONLIGHT_SCALE : 0.9,

        // Meteor
        _METEOR1_POS_X_H : 500,
        _METEOR1_POS_X   : -1100,
        _METEOR1_POS_Y_H : -200,
        _METEOR1_POS_Y   : 1400,
        _METEOR1_SCALE   : 0.6,
        _METEOR1_SPEED   : 4000,
        _METEOR1_DELAY   : 3000,

        _METEOR2_POS_X_H : 600,
        _METEOR2_POS_X   : 200,
        _METEOR2_POS_Y_H : -120,
        _METEOR2_POS_Y   : 320,
        _METEOR2_SCALE   : 0.8,
        _METEOR2_SPEED   : 1000,
        _METEOR2_DELAY   : 2500,

        _METEOR3_POS_X_H : 1200,
        _METEOR3_POS_X   : 800,
        _METEOR3_POS_Y_H : -120,
        _METEOR3_POS_Y   : 280,
        _METEOR3_SCALE   : 0.9,
        _METEOR3_SPEED   : 1000,
        _METEOR3_DELAY   : 2000,

        _METEOR4_POS_X_H : 1400,
        _METEOR4_POS_X   : 1100,
        _METEOR4_POS_Y_H : -120,
        _METEOR4_POS_Y   : 180,
        _METEOR4_SCALE   : 0.6,
        _METEOR4_SPEED   : 1000,
        _METEOR4_DELAY   : 4000,

        _FLOWER1_POS_X : 364,
        _FLOWER1_POS_Y : 576,
        _FLOWER2_POS_X : 403,
        _FLOWER2_POS_Y : 597,
        _FLOWER3_POS_X : 903,
        _FLOWER3_POS_Y : 581,
        _FLOWER4_POS_X : 983,
        _FLOWER4_POS_Y : 554,
        _FLOWER5_POS_X : 182,
        _FLOWER5_POS_Y : 575,
        _FLOWER6_POS_X : 1047,
        _FLOWER6_POS_Y : 600,

        _FLOWER1_DIFF_X : 5,
        _FLOWER2_DIFF_X : 7,
        _FLOWER3_DIFF_X : 6,
        _FLOWER4_DIFF_X : 8,
        _FLOWER5_DIFF_X : 9,
        _FLOWER6_DIFF_X : 7,
        _FLOWER1_DIFF_Y : 0,
        _FLOWER2_DIFF_Y : 0,
        _FLOWER3_DIFF_Y : 0,
        _FLOWER4_DIFF_Y : 0,
        _FLOWER5_DIFF_Y : 0,
        _FLOWER6_DIFF_Y : 0,

        _FLOWER1_SPEED : 2000,
        _FLOWER2_SPEED : 3000,
        _FLOWER3_SPEED : 2500,
        _FLOWER4_SPEED : 2200,
        _FLOWER5_SPEED : 2100,
        _FLOWER6_SPEED : 3100,

        // Click rect
        _RECT_TOP    : 300,
        _RECT_BOTTOM : 470,
        _RECT_LEFT   : 580,
        _RECT_RIGHT  : 820,

        _buildSprites: function() {

            this._bgSprite = new createjs.Bitmap(loader.get('flowerPage'));
            this._moonlightSprite = new createjs.Bitmap(loader.get('moonlight'));
            this._meteorSprite1 = new createjs.Bitmap(loader.get('meteor'));
            this._meteorSprite2 = new createjs.Bitmap(loader.get('meteor'));
            this._meteorSprite3 = new createjs.Bitmap(loader.get('meteor'));
            this._meteorSprite4 = new createjs.Bitmap(loader.get('meteor'));
            this._flowerSprite1 = new createjs.Bitmap(loader.get('frontflower1'));
            this._flowerSprite2 = new createjs.Bitmap(loader.get('frontflower2'));
            this._flowerSprite3 = new createjs.Bitmap(loader.get('frontflower3'));
            this._flowerSprite4 = new createjs.Bitmap(loader.get('frontflower4'));
            this._flowerSprite5 = new createjs.Bitmap(loader.get('frontflower5'));
            this._flowerSprite6 = new createjs.Bitmap(loader.get('frontflower6'));

            this._itemContainer = new createjs.Container();
            this._itemContainer.addChild(this._bgSprite, this._moonlightSprite,
                    this._meteorSprite1, this._meteorSprite2,
                    this._meteorSprite3, this._meteorSprite4,
                    this._flowerSprite1, this._flowerSprite2,
                    this._flowerSprite3, this._flowerSprite4,
                    this._flowerSprite5, this._flowerSprite6);

            return this;
        },

        _setSprites: function() {

            this._bgSprite.set({
                x : 0,
                y : 0
            });

            this._moonlightSprite.set({
                x      : this._MOONLIGHT_POS_X,
                y      : this._MOONLIGHT_POS_Y,
                regX   : this._MOONLIGHT_REG_X,
                regY   : this._MOONLIGHT_REG_Y,
                scaleX : this._MOONLIGHT_SCALE,
                scaleY : this._MOONLIGHT_SCALE,
                alpha  : 0
            });

            this._meteorSprite1.set({
                x      : this._METEOR1_POS_X_H,
                y      : this._METEOR1_POS_Y_H,
                scaleX : this._METEOR1_SCALE,
                scaleY : this._METEOR1_SCALE
            });
            this._meteorSprite2.set({
                x      : this._METEOR2_POS_X_H,
                y      : this._METEOR2_POS_Y_H,
                scaleX : this._METEOR2_SCALE,
                scaleY : this._METEOR2_SCALE
            });
            this._meteorSprite3.set({
                x      : this._METEOR3_POS_X_H,
                y      : this._METEOR3_POS_Y_H,
                scaleX : this._METEOR3_SCALE,
                scaleY : this._METEOR3_SCALE
            });
            this._meteorSprite4.set({
                x      : this._METEOR4_POS_X_H,
                y      : this._METEOR4_POS_Y_H,
                scaleX : this._METEOR4_SCALE,
                scaleY : this._METEOR4_SCALE
            });

            this._flowerSprite1.set({
                x : this._FLOWER1_POS_X,
                y : this._FLOWER1_POS_Y
            });
            this._flowerSprite2.set({
                x : this._FLOWER2_POS_X,
                y : this._FLOWER2_POS_Y
            });
            this._flowerSprite3.set({
                x : this._FLOWER3_POS_X,
                y : this._FLOWER3_POS_Y
            });
            this._flowerSprite4.set({
                x : this._FLOWER4_POS_X,
                y : this._FLOWER4_POS_Y
            });
            this._flowerSprite5.set({
                x : this._FLOWER5_POS_X,
                y : this._FLOWER5_POS_Y
            });
            this._flowerSprite6.set({
                x : this._FLOWER6_POS_X,
                y : this._FLOWER6_POS_Y
            });

            this._itemContainer.set({
                alpha : 0
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

        show: function(callback) {

            createjs.Tween.get(this._itemContainer).to({
                alpha : 1
            }, this._FADEIN_SPEED).call(function() {
                callback && callback();
            });

            return this;
        },

        shine: function() {

            createjs.Tween.get(this._moonlightSprite, {
                loop : true
            }).to({
                alpha : this._MOONLIGHT_ALPHA
            }, this._MOONLIGHT_SPEED).to({
                alpha : 0
            }, this._MOONLIGHT_SPEED);

            return this;
        },

        showMeteor: function() {

            createjs.Tween.get(this._meteorSprite1, {
                loop : true
            }).wait(this._METEOR1_DELAY).to({
                x     : this._METEOR1_POS_X,
                y     : this._METEOR1_POS_Y,
                alpha : 0
            }, this._METEOR1_SPEED);

            createjs.Tween.get(this._meteorSprite2, {
                loop : true
            }).wait(this._METEOR2_DELAY).to({
                x     : this._METEOR2_POS_X,
                y     : this._METEOR2_POS_Y,
                alpha : 0
            }, this._METEOR2_SPEED);

            createjs.Tween.get(this._meteorSprite3, {
                loop : true
            }).wait(this._METEOR3_DELAY).to({
                x     : this._METEOR3_POS_X,
                y     : this._METEOR3_POS_Y,
                alpha : 0
            }, this._METEOR3_SPEED);

            createjs.Tween.get(this._meteorSprite4, {
                loop : true
            }).wait(this._METEOR4_DELAY).to({
                x     : this._METEOR4_POS_X,
                y     : this._METEOR4_POS_Y,
                alpha : 0
            }, this._METEOR4_SPEED);

            return this;
        },

        startMove: function() {

            createjs.Tween.get(this._flowerSprite1, {
                loop : true
            }).to({
                x : this._FLOWER1_POS_X - this._FLOWER1_DIFF_X,
                y : this._FLOWER1_POS_Y + this._FLOWER1_DIFF_Y
            }, this._FLOWER1_SPEED).to({
                x : this._FLOWER1_POS_X,
                y : this._FLOWER1_POS_Y
            }, this._FLOWER1_SPEED);

            createjs.Tween.get(this._flowerSprite2, {
                loop : true
            }).to({
                x : this._FLOWER2_POS_X - this._FLOWER2_DIFF_X,
                y : this._FLOWER2_POS_Y + this._FLOWER2_DIFF_Y
            }, this._FLOWER2_SPEED).to({
                x : this._FLOWER2_POS_X,
                y : this._FLOWER2_POS_Y
            }, this._FLOWER2_SPEED);

            createjs.Tween.get(this._flowerSprite3, {
                loop : true
            }).to({
                x : this._FLOWER3_POS_X - this._FLOWER3_DIFF_X,
                y : this._FLOWER3_POS_Y + this._FLOWER3_DIFF_Y
            }, this._FLOWER3_SPEED).to({
                x : this._FLOWER3_POS_X,
                y : this._FLOWER3_POS_Y
            }, this._FLOWER3_SPEED);

            createjs.Tween.get(this._flowerSprite4, {
                loop : true
            }).to({
                x : this._FLOWER4_POS_X - this._FLOWER4_DIFF_X,
                y : this._FLOWER4_POS_Y + this._FLOWER4_DIFF_Y
            }, this._FLOWER4_SPEED).to({
                x : this._FLOWER4_POS_X,
                y : this._FLOWER4_POS_Y
            }, this._FLOWER4_SPEED);

            createjs.Tween.get(this._flowerSprite5, {
                loop : true
            }).to({
                x : this._FLOWER5_POS_X - this._FLOWER5_DIFF_X,
                y : this._FLOWER5_POS_Y + this._FLOWER5_DIFF_Y
            }, this._FLOWER5_SPEED).to({
                x : this._FLOWER5_POS_X,
                y : this._FLOWER5_POS_Y
            }, this._FLOWER5_SPEED);

            createjs.Tween.get(this._flowerSprite6, {
                loop : true
            }).to({
                x : this._FLOWER6_POS_X - this._FLOWER6_DIFF_X,
                y : this._FLOWER6_POS_Y + this._FLOWER6_DIFF_Y
            }, this._FLOWER6_SPEED).to({
                x : this._FLOWER6_POS_X,
                y : this._FLOWER6_POS_Y
            }, this._FLOWER6_SPEED);

            return this;
        },

        enableClick: function() {

            var that = this;

            touch.onStart(function(data) {
                if (data.x > that._RECT_LEFT && data.x < that._RECT_RIGHT &&
                        data.y > that._RECT_TOP && data.y < that._RECT_BOTTOM) {
                    window.location.href = that._TARGET_LINK;
                }
            });

            return this;
        },

        init: function() {
            return this._buildSprites()._setSprites();
        }
    };

    // ************************************************************************
    // Stage
    // ************************************************************************
    var stageController = {

        _FRAME_RATE : 30,

        // Start playing
        _play: function() {
            createjs.Ticker.timingMode = createjs.Ticker.RAF;
            createjs.Ticker.setFPS(this._FRAME_RATE);
            createjs.Ticker.addEventListener('tick', this._stage);
            return this;
        },

        getStage: function() {
            return this._stage;
        },

        init: function() {

            this._stage = new createjs.Stage('stage_canvas');

            guidePage.init();
            homePage.init();
            treePage.init();
            flowerPage.init();

            girl.init().addToStage(this._stage);
            words.init().addToStage(this._stage);
            nextTip.init().addToStage(this._stage);

            this._stage.set({
                x : 0,
                y : 0
            });

            createjs.Touch.enable(this._stage);

            this._play();

            return this;
        }
    };

    // ************************************************************************
    // Animation director
    // 这里控制了所有的动画播放顺序和页面之间的逻辑关系
    // ************************************************************************
    var director = {

        _curr    : 0,
        _queue   : [],
        _enabled : false,

        playGuide: function(callback) {

            var that  = this;
            var stage = stageController.getStage();
            var index = stage.getChildIndex(girl.getSprite());

            homePage.addToStage(stage, index);
            guidePage.addToStage(stage, index + 1);

            guidePage.setDone(function() {
                callback && callback.call(that);
            });

            return this;
        },

        playPage1: function(callback) {

            var that  = this;
            var stage = stageController.getStage();
            var index = stage.getChildIndex(girl.getSprite());

            homePage.moveDown(function() {
                guidePage.removeFromStage();
            });

            girl.moveDown();
            setTimeout(function() {
                girl.walkToCenter(function() {
                    words.showP1(function() {
                        setTimeout(function() {
                            nextTip.showTip1();
                            callback && callback.call(that);
                        }, 500);
                    });
                });
                homePage.walk();
            }, 2000);

            return this;
        },

        playPage2: function(callback) {

            var that = this;

            nextTip.hide();
            words.hideP1(function() {
                homePage.shake(function() {
                    girl.dropDown();
                    homePage.dropDown(function() {
                        homePage.showLight();
                        words.showP2(function() {
                            setTimeout(function() {
                                nextTip.showTip2();
                                callback && callback.call(that);
                            }, 500);
                        });
                    });
                });
            });

            return this;
        },

        playPage3: function(callback) {

            var that  = this;
            var stage = stageController.getStage();
            var index = stage.getChildIndex(girl.getSprite());

            nextTip.hide();
            treePage.addToStage(stage, index);
            words.hideP2(function() {
                treePage.show(function() {
                    homePage.removeFromStage(stage);
                });
                setTimeout(function() {
                    girl.walk();
                }, 1500);
                treePage.move(function() {
                    girl.stand();
                });
                setTimeout(function() {
                    words.showP3(function() {
                        setTimeout(function() {
                            nextTip.showTip3();
                            callback && callback.call(that);
                        }, 500);
                    });
                }, 3000);
            });

            return this;
        },

        playPage4: function(callback) {

            var that  = this;
            var stage = stageController.getStage();
            var index = stage.getChildIndex(girl.getSprite());

            nextTip.hide();
            flowerPage.addToStage(stage, index);
            words.hideP3();
            girl.runOut(function() {
                flowerPage.show(function() {
                    treePage.removeFromStage(stage);
                    flowerPage.shine().showMeteor().startMove();
                });
                girl.runIn(function() {
                    girl.shine();
                });
                setTimeout(function() {
                    words.showP4(function() {
                        flowerPage.enableClick();
                        setTimeout(function() {
                            callback && callback.call(that);
                        }, 500);
                    });
                }, 4000);
            });

            return this;
        },

        startPlay: function() {
            return this.playGuide(function() {
                this.playPage1(function() {
                    this._enabled = true;
                });
            });

            // function() {
            //     this.playPage1(function() {
            //         this.playPage2(function() {
            //             this.playPage3(function() {
            //                 this.playPage4();
            //             });
            //         });
            //     });
            // }
        },

        init: function() {

            var that = this;

            this._curr = 0;
            this._enabled = false;
            this._queue.push(this.playPage2);
            this._queue.push(this.playPage3);
            this._queue.push(this.playPage4);

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
    };

    // ************************************************************************
    // Rotation tip page
    // 这里是转屏提示页面，通过判断width和height的关系，以及devicemotion事件中的zy的值
    // 来判断用户是否处于横屏状态，显示或隐藏横屏提示
    // ************************************************************************
    var pageCover = {

        _hideTip: function() {
            $('#page_cover').fadeOut();
            return this;
        },

        _showTip: function() {},

        init: function(ready) {

            var that  = this,
                done  = false,
                listeningStarted = false;

            function onDone() {

                if (!done) {
                    done = true;

                    $(window).unbind('resize', onWindowResize);
                    window.removeEventListener('devicemotion', onDeviceMotion);

                    that._hideTip();
                    ready && ready();
                }
            }

            function onWindowResize() {

                if (document.documentElement.clientWidth >
                        document.documentElement.clientHeight) {
                    onDone();
                }

                return false;
            }

            function onDeviceMotion(event) {

                // debugBar.show(count + ' ' + event.accelerationIncludingGravity.x);

                if (Math.abs(event.accelerationIncludingGravity.x) > 6) {
                    if (listeningStarted) {
                        onDone();
                    }
                }

                return false
            }

            if (document.documentElement.clientWidth >
                    document.documentElement.clientHeight) {
                this._hideTip();
                ready && ready();

            } else {
                this._showTip();
                $(window).bind('resize', onWindowResize);
                window.addEventListener('devicemotion', onDeviceMotion, false);

                setTimeout(function() {
                    listeningStarted = true;
                }, 2000);
            }

            return this;
        }
    };

    // ************************************************************************
    // Init everything
    // ************************************************************************

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

        stageController.init();

        pageCover.init(function() {

            director.init().startPlay();

            // For testing

            // var stage = stageController.getStage();
            // var index = stage.getChildIndex(girl.getSprite());

            // homePage.addToStage(stage, index);

            // girl._girlSprite.x = girl._CENTER_POS_X;
            // // girl._girlSprite.y = girl._DROP_DOWN_POS_Y;
            // girl._girlSprite.y = girl._MOVE_DOWN_POS_Y;

            // // director.playPage4();
            // girl.dropDown();
        });

    }, function(progress) {
        loadingTipEl.html(Math.floor(progress * 100));
    });

});