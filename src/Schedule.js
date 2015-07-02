/**
 * ESUI (Enterprise Simple UI)
 * Copyright 2013 Baidu Inc. All rights reserved.
 *
 * @file Schedule控件
 * @author miaojian
 */

define(
    function (require) {
        var eoo = require('eoo');
        var lib = require('./lib');
        var esui = require('./main');
        var InputControl = require('./InputControl');
        var Layer = require('./Layer');
        var $ = require('jquery');
        var u = require('underscore');

        require('esui/behavior/Selectable');

        /**
         * Schedule控件
         *
         * @param {Object=} options 初始化参数
         * @constructor
         */
        var Schedule = eoo.create(
            InputControl,
            {

                /**
                 * 控件类型
                 * @type {string}
                 */
                type: 'Schedule',

                /**
                 * 创建控件主元素
                 * @override
                 * @return {HTMLElement}
                 */
                createMain: function (options) {
                    if (!options.tagName) {
                        return InputControl.prototype.createMain.call(this);
                    }
                    return document.createElement(options.tagName);
                },

                /**
                 * 初始化参数
                 *
                 * @param {Object=} options 构造函数传入的参数
                 * @override
                 * @protected
                 */
                initOptions: function (options) {
                    var properties = {};

                    lib.extend(properties, Schedule.defaultProperties, options);

                    this.setProperties(properties);

                    // 检测是否初始化rawValue值，没有则设置为默认
                    if (this.rawValue == null) {

                        this.setRawValue(initValue());
                    }

                    // 记录当前创建的tip元素
                    this.followTip = {};

                },

                /**
                 * 初始化DOM结构
                 *
                 * @protected
                 */
                initStructure: function () {
                    var me = this;

                    checkSlotSize(me);
                    this.main.tabIndex = 0;
                    var tpl = ''
                        + '<input type="hidden" name="${name}" id="${inputId}"/>'
                        + '<div class="${bodyClass}" id="${bodyId}"></div>'
                        + '<div class="${headClass}">'
                            + '<div class="${helpClass}">'
                                + '<div class="${helpSelectedClass}"></div>'
                                + '<div class="${helpTextClass}">'
                                    + '${helpSelected}'
                                + '</div>'
                                + '<div class="${helpUnselectedClass}"></div>'
                                + '<div class="${helpTextClass}">${help}</div>'
                            + '</div>'
                            + '<div class="${shortcutClass}" id="${shortcutId}">'
                                + '${shortcutHtml}'
                            + '</div>'
                        + '</div>';

                    this.main.innerHTML = lib.format(
                        tpl,
                        {
                            name: this.name,
                            inputId: getId(me, 'value-input'),
                            headClass: getClass(me, 'head'),
                            bodyClass: getClass(me, 'body'),
                            helpClass: getClass(me, 'help'),
                            helpSelectedClass: getClass(me, 'help-selected'),
                            helpUnselectedClass: getClass(me, 'help-unselected'),
                            helpTextClass: getClass(me, 'help-text'),
                            shortcutClass: getClass(me, 'shortcut'),
                            shortcutId: getId(me, 'shortcut'),
                            bodyId: getId(me, 'body'), // 7
                            helpSelected: me.helpSelectedText,
                            help: me.helpText,
                            shortcutHtml: getShortcutHtml(me)
                        }
                    );

                    initBody(me);
                },

                /**
                 * 初始化事件交互
                 *
                 * @protected
                 * @override
                 */
                initEvents: function () {
                    var me = this;
                    var timebody = lib.g(getId(this, 'time-body'));
                    // 绑定拖动drag事件
                    $(timebody).selectable(
                        {
                            filter: '.' + getClass(this, 'time'),
                            start: function (e) {

                                // ondragHuck(e.target);

                                // 记录鼠标位置
                                me.dragStartPos = {x: e.pageX, y: e.pageY};

                                // 鼠标拖拽效果
                                // 为了防止在控件渲染后，位置变动导致计算错误，所以每次mousedown
                                // 位置都计算一遍
                                me.dragRange = [];

                                var timebodyTop = lib.getOffset(timebody).top;
                                var timebodyLeft = lib.getOffset(timebody).left;
                                me.dragRange.push(timebodyTop);
                                me.dragRange.push(timebodyLeft + timebody.offsetWidth);
                                me.dragRange.push(timebodyTop + timebody.offsetHeight);
                                me.dragRange.push(timebodyLeft);

                                repaintFollowEle.call(me, e);
                            },
                            selecting: function (e) {
                                repaintFollowEle.call(me, e);
                            },
                            stop: function (e) {

                                // 隐藏鼠标跟随div
                                var followEle = lib.g(getId(me, 'follow-item'));
                                followEle.style.display = 'none';

                                // 为了修正，up的时候再重新计算下位置
                                var cellPos = getTragTimeCellPos(me,
                                    {x: e.pageX, y: e.pageY}
                                );

                                // hack ie8下重新渲染遮罩层的时候会跳动，发现是setCapture的原因
                                // 此处使用setTimeout，使其跳出setCapture的范围
                                setTimeout(function () {
                                    setSelectedAreaValue(me, cellPos);
                                }, 10);
                            }
                        }
                    );

                    // 绑定timebody mouseover事件
                    this.helper.addDOMEvent(timebody, 'mouseover', timeOverHandler);

                    // 绑定timebody mouseout事件
                    this.helper.addDOMEvent(timebody, 'mouseout', timeOutHandler);

                    // 绑定选择星期事件
                    this.helper.addDOMEvent(lib.g(getId(this, 'day-head')), 'click', dayClickHandler);


                    var shortcut = this.helper.getPart('shortcut');
                    // 绑定点击shortcut事件
                    this.helper.addDOMEvent(shortcut, 'click', shortcutClickHandler);

                    // shortcut mouseover
                    this.helper.addDOMEvent(shortcut, 'mouseover', u.partial(shortcutOverOutHandler, true));

                    // shortover mouseout
                    this.helper.addDOMEvent(shortcut, 'mouseout', u.partial(shortcutOverOutHandler, false));

                    // shortcut mousemove
                    this.helper.addDOMEvent(shortcut, 'mousemove', shortcutMoveHandler);
                },

                /**
                 * 设值
                 *
                 * @override
                 * @protected
                 */
                setProperties: function (properties) {
                    var changes = InputControl.prototype.setProperties.call(
                        this, properties);

                    var rawValueObj = changes.rawValue;

                    if (rawValueObj
                        && (this.stringifyValue(rawValueObj.oldValue)
                        !== this.stringifyValue(rawValueObj.newValue))) {

                        this.fire('change', {rawValue: this.rawValue});
                    }

                },

                /**
                 * 渲染自身
                 *
                 * @override
                 * @protected
                 */
                repaint: require('./painters').createRepaint(
                    InputControl.prototype.repaint,
                    {
                        name: 'rawValue',
                        paint: function (schedule, rawValue) {

                            // 填充hidden input的值
                            var value = schedule.stringifyValue(rawValue);
                            lib.g(getId(schedule, 'value-input')).value = value == null ? '' : value;

                            repaintView(schedule, rawValue);
                        }
                    },
                    {
                        name: ['disabled', 'readOnly'],
                        paint: function (schedule, disabled, readOnly) {
                            setDayCheckboxState(schedule, 'disabled', disabled || readOnly);
                        }
                    }
                ),

                /**
                 * 将string类型的value转换成原始格式
                 *
                 * @override
                 * @param {string} value 字符串值
                 * @return {Array}
                 */
                parseValue: function (value) {
                    var arr = [];
                    var step = 24;

                    for (var i = 0, len = value.length; i < len; i = i + step) {
                        var inner = value.substring(i, i + step).split('');

                        var innerOut = [];

                        for (var j = 0; j < inner.length; j++) {

                            innerOut.push(inner[j] - 0);
                        }

                        arr.push(innerOut);
                    }
                    return arr;
                },

                /**
                 * 将value从原始格式转换成string
                 *
                 * @override
                 *
                 * @param {Array} rawValue 原始值
                 * @return {string}
                 */
                stringifyValue: function (rawValue) {

                    var arr = [];

                    if (!rawValue) {

                        return null;
                    }

                    for (var i = 0, len = rawValue.length; i < len; i++) {

                        arr.push(rawValue[i].join(''));
                    }

                    return arr.join('');
                },

                /**
                 * 设置控件的值，并更新视图
                 *
                 * @public
                 * @param {Array} rawValue 控件的值
                 */
                setRawValue: function (rawValue) {
                    this.setProperties({rawValue: rawValue});
                },

                /**
                 * 获取控件的值
                 *
                 * @public
                 * @return {Array}
                 */
                getRawValue: function () {
                    return this.rawValue;
                },

                /**
                 * 按照坐标选择
                  * @param {...Array.<number>} coord 当前坐标[星期，小时]
                 */
                select: function (coord) {
                    dealValueByCoord(this, 1, [].slice.call(arguments));
                },

                /**
                 * 取消选择按照坐标
                 * @param {...Array.<number>} coord 当前坐标[星期，小时]
                 */
                unselect: function (coord) {
                    dealValueByCoord(this, 0, [].slice.call(arguments));
                },

                /**
                 * 销毁释放控件
                 */
                dispose: function () {
                    var helper = this.helper;
                    helper.beforeDispose();

                    // 清除followTip
                    var followTip = this.followTip;
                    for (var key in followTip) {

                        if (followTip[key]) {

                            document.body.removeChild(followTip[key]);
                        }
                    }

                    helper.dispose();
                    helper.afterDispose();
                }
            }
        );

        /**
         * 挂接到Schedule上以便进行全局替换
         */
        Schedule.defaultProperties = {

            // 图例说明文本
            helpSelectedText: '投放时间段',
            helpText: '暂停时间段',

            // 星期checkbox显示文本
            dayTexts: [
                '星期一',
                '星期二',
                '星期三',
                '星期四',
                '星期五',
                '星期六',
                '星期日'
            ],

            // 快捷方式配置
            shortcut: shortcut()
        };

        /**
         * 日程快捷方式
         *
         * @return {Array}
         */
        function shortcut() {

            function selectByDayStates(dayStates) {

                var value = [];
                for (var i = 0; i < 7 && i < dayStates.length; i++) {
                    value[i] = [];
                    for (var j = 0; j < 24; j++) {
                        value[i][j] = dayStates[i];
                    }
                }
                return value;
            }

            return [
                {
                    text: '全周投放',
                    tip: '周一到周日全天投放',
                    getValue: function () {
                        return selectByDayStates([1, 1, 1, 1, 1, 1, 1]);
                    }
                },
                {
                    text: '周一到周五投放',
                    tip: '周一到周五全天投放',
                    getValue: function () {
                        return selectByDayStates([1, 1, 1, 1, 1, 0, 0]);
                    }
                },
                {
                    text: '周末投放',
                    tip: '周六、周日全天投放',
                    getValue: function () {
                        return selectByDayStates([0, 0, 0, 0, 0, 1, 1]);
                    }
                }
            ];
        }

        /**
         * 初始化视图的值
         * @inner
         * @return {Array}
         */
        function initValue() {
            // 如果没有初始值，默认全部设为0，即全部选中
            var value = [];
            for (var i = 0; i < 7; i++) {
                var lineValue = [];
                value.push(lineValue);

                for (var j = 0; j < 24; j++) {
                    lineValue.push(0);
                }
            }

            return value;
        }

        /**
         * 获取部件的css class
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @param {string} part 部件名称
         * @return {string}
         */
        function getClass(schedule, part) {
            return schedule.helper.getPartClasses(part).join(' ');
        }

        /**
         * 获取部件的id
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @param {string} part 部件名称
         * @return {string}
         */
        function getId(schedule, part) {
            return schedule.helper.getId(part);
        }

        /**
         * 获取快捷方式的html
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @return {string}
         */
        function getShortcutHtml(schedule) {
            var me = schedule;
            var html = [];

            var tpl = ''
                + '<span class="${clazz}" data-item="${index}"'
                + ' >${text}</span>';

            // 说明标题拼接
            var textClass = getClass(me, 'shortcut-text-item');

            html.push('<span class="' + textClass + '">快速设定：</span>');


            var shortcuts = me.shortcut;
            var clazz = getClass(me, 'shortcut-item');

            // shortcut拼接
            for (var i = 0, len = shortcuts.length; i < len; i++) {
                var shortcut = shortcuts[i];
                html.push(
                    lib.format(
                        tpl,
                        {
                            clazz: clazz,
                            text: shortcut.text,
                            index: i
                        }
                    ));
            }

            return html.join('');
        }

        /**
         * 初始化body
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         */
        function initBody(schedule) {
            lib.g(getId(schedule, 'body')).innerHTML = ''
                + getBodyTimeHtml(schedule) // 拼接html: 头部time列表
                + getBodyDayHtml(schedule) // 拼接html: 星期列表
                + getBodyItemHtml(schedule); // 拼接html: 时间item列表
        }

        /**
         * 拼接html: body 头部time列表
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @return {string}
         */
        function getBodyTimeHtml(schedule) {
            var me = schedule;
            var html = [];

            var timelineClass = getClass(me, 'time-line');
            var timelineClassInner = timelineClass + '-inner';
            var bodyHeadId = getId(me, 'body-head');
            html.push(
                '<div class="', timelineClass, '" id="',
                bodyHeadId + '">'
            );
            html.push('<div class="' + timelineClassInner + '">');

            var timeHClass = getClass(me, 'time-head');
            for (var i = 0; i <= 24; i = i + 2) {
                html.push(
                    '<div class="', timeHClass,
                    '" data-time="', i, '" ',
                    'id="', getId(me, 'time-head' + i), '">',
                     i,
                     '</div>'
                );
            }
            // end of inner
            html.push('</div>');
            // end of time line
            html.push('</div>');

            return html.join('');
        }

        /**
         * 拼接html: body 星期列表
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @return {string}
         */
        function getBodyDayHtml(schedule) {
            var me = schedule;
            var html = [];

            var dayHClass = getClass(me, 'day-head');
            var dayHId    = getId(me, 'day-head');
            html.push('<div id="', dayHId, '" class="', dayHClass, '">');

            var dayClass = getClass(me, 'day');
            var customCheckClass = me.helper.getPrefixClass('checkbox-custom');
            var dayTpl = ''
                + '<div class="${dayClass}"><div class="${customCheckClass}">'
                    + '<input type="checkbox" id="${dayId}" value="${value}">'
                    + '<label for="${dayId}">${dayWord}</label>'
                + '</div></div>';

            var dayTexts = me.dayTexts;
            for (var i = 0; i < 7; i++) {
                html.push(
                    lib.format(
                        dayTpl,
                        {
                            dayWord: dayTexts[i],
                            dayId: getId(me, 'line-state' + i),
                            value: i,
                            dayClass: dayClass,
                            customCheckClass: customCheckClass
                        }
                    )
                );
            }

            html.push('</div>');

            return html.join('');

        }

        /**
         * 拼接html: body 时间item列表
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @return {string}
         */
        function getBodyItemHtml(schedule) {
            var me = schedule;
            var html = [];

            var timeTpl = ''
                + '<div class="${timeClass}"'
                    + ' id="${itemId}"'
                    + ' data-day="${dayIndex}"'
                    + ' data-time-item="1"'
                    + ' data-time="${timeIndex}">'
                + '</div>';

            var timeBClass = getClass(me, 'time-body');
            var timeBId    = getId(me, 'time-body');
            html.push('<div id="', timeBId, '" class="', timeBClass, '">');

            // 7天
            var lineClass = getClass(me, 'line');
            for (var i = 0; i < 7; i++) {

                var lineId    = getId(me, 'line' + i);
                html.push(
                    '<div class="', lineClass, '" id="', lineId, '">'
                );

                // 24小时
                for (var j = 0; j < 24; j++) {

                    var itemId = getId(me, 'time_' + i + '_' + j);

                    html.push(
                        lib.format(
                            timeTpl,
                            {
                                itemId: itemId,
                                timeClass: getClass(me, 'time'),
                                dayIndex: i,
                                timeIndex: j
                            }
                        )
                    );
                }

                html.push('</div>');
            }

            html.push('</div>');

            return html.join('');
        }

        /**
         * 重绘view区域
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @param {Array} value rawValue
         */
        function repaintView(schedule, value) {
            var me = schedule;
            var selectedClass = me.helper.getPartClassName('time-selected');
            var hoverClass = me.helper.getPartClassName('time-hover');

            for (var i = 0; i < 7; i++) {
                var statusArr = [];
                // item dom
                var lineEl = lib.g(getId(me, 'line' + i));

                // 去掉每行的连续选择遮罩层
                removeSelectedLineCoverTip(schedule, lineEl);

                for (var j = 0; j < 24; j++) {

                    var $item = $(lib.g(getId(me, 'time_' + i + '_' + j)));
                    var val  = value[i][j];

                    // 根据value,设置item的选中状态
                    if (val) {
                        $item.addClass(selectedClass);
                    }
                    else {
                        $item.removeClass(selectedClass);
                    }

                    $item.removeClass(hoverClass);
                    statusArr.push(val);
                }
                // 根据每周的value, 创建连续选中遮罩
                createSelectedLineCoverTip(me, statusArr, lineEl, i);
            }
        }

        /**
         * 根据每周的value, 创建连续选中遮罩
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @param {Array.<string>}  arr 星期index（参数）的每天的value值
         * @param {HTMLElement} parent item父元素
         * @param {number} index 星期索引
         */
        function createSelectedLineCoverTip(schedule, arr, parent, index) {
            var me = schedule;
            var slotSize = me.slotSize;
            var i = index;

            // 将当前星期的checkbox先初始化为不选中
            var checkInput = lib.g(getId(me, 'line-state' + i));
            checkInput.checked = false;

            // 对于连续选中大于3天的进行遮罩处理
            var patt = /1{1,}/g;
            var statusStr = arr.join('');
            var result;
            var coverClass = getClass(me, 'continue-covertimes');
            var coverTpl = ''
                    + '<div class="${coverClass}">'
                        + '<strong>${text}</strong>'
                    + '</div>';

            while ((result = patt.exec(statusStr)) != null) {
                var length = result[0].length;
                var start = result.index;
                var end = start + length;

                var coverDiv = document.createElement('aside');
                var cssStyle = ';width:' + length * slotSize
                    + 'px;top:0;left:' + start * slotSize + 'px;';

                // 设置星期checkbox的选中值
                checkInput.checked = length === 24;

                coverDiv.setAttribute('data-start-time', start);
                coverDiv.setAttribute('data-end-time', end);
                coverDiv.setAttribute('data-day', i);
                coverDiv.className = coverClass;
                coverDiv.style.cssText += cssStyle;

                if (length > 2) {
                    coverDiv.innerHTML = lib.format(
                        coverTpl,
                        {
                            start: start,
                            end: end,
                            text: length === 24
                                ? '全天投放' : start + ':00-' + end + ':00',
                            coverClass: getClass(me, 'covertimes-tip')
                        }
                    );
                }

                parent.appendChild(coverDiv);

                // 挂载事件
                me.helper.addDOMEvent(
                    coverDiv,
                    'mouseover',
                    u.partial(coverTipOverHandler, coverDiv, me)
                );
            }
        }

        /**
         * coverTip command hanlder
         * 遮罩的hover 事件句柄
         *
         * @inner
         * @param {Element} element coverTip元素
         * @param {Schedule} schedule Schedule实例
         */
        function coverTipOverHandler(element, schedule) {
            clearTimeout(schedule.coverOvierTimer);
            schedule.coverOvierTimer = setTimeout(
                function () {
                    element.style.display = 'none';
                },
                100
            );
        }

        /**
         * 去掉每行的连续选择遮罩层
         *
         * @inner
         * @param {Schedule} schedule Schedule实例
         * @param {Element} parent 行元素
         */
        function removeSelectedLineCoverTip(schedule, parent) {

            var removeDiv = parent.getElementsByTagName('aside');

            var len = removeDiv.length;
            while (len) {
                var item = removeDiv[0];

                if (item.getAttribute('data-day') != null) {
                    schedule.helper.removeDOMEvent(item);
                    parent.removeChild(item);
                }
                len--;
            }
        }

        /**
         * 设置tip遮罩的位置
         *
         * @param {Schedule} schedule Schedule实例
         * @param {string} tipId    要显示的tip Id
         * @param {Object} mousepos 当前鼠标的位置
         * @param {string} tipText  要显示的内容
         * @return {Element}
         */
        function showPromptTip(schedule, tipId, mousepos, tipText) {
            var me = schedule;

            tipId = tipId || getId(me, 'tip');
            var tipElement = lib.g(tipId);

            if (tipElement) {

                tipElement.style.top = mousepos.y + 'px';
                tipElement.style.left = mousepos.x + 'px';
                tipElement.innerHTML = tipText;
            }
            else {
                var cssStyle = 'font-size:'
                    + lib.getComputedStyle(me.main, 'fontSize')
                    + ';position:absolute;top:'
                    + mousepos.y + 'px;left:' + mousepos.x + 'px;display:none;'
                    + 'z-index:' + Layer.getZIndex(me.main) + ';';

                var tipClass = getClass(me, 'shortcut-item-tip');

                tipElement = document.createElement('div');
                tipElement.style.cssText = cssStyle;
                tipElement.id = tipId;
                tipElement.className = tipClass;

                tipElement.innerHTML = tipText;
                document.body.appendChild(tipElement);

                // 记录下来，以便dispose的时候清除
                me.followTip[tipId] = tipElement;
            }

            // 添加setTimeout,防止拖动的时候闪耀
            me.tipElementTime = setTimeout(function () {
                tipElement.style.display = 'block';
            }, 100);

            return tipElement;
        }

        /**
         * 隐藏tip遮罩
         *
         * @param {Schedule} schedule Schedule实例
         * @param {string} tipId    要显示的tip Id
         */
        function hidePromptTip(schedule, tipId) {

            clearTimeout(schedule.tipElementTime);

            var tip = lib.g(tipId);
            tip && (tip.style.display = 'none');
        }

        /**
         * dayWord click handle
         * 点击星期checkbox的处理函数
         *
         * @param {Event} e 事件对象
         */
        function dayClickHandler(e) {
            var target = e.target;

            if (target.nodeName.toLowerCase() !== 'input') {
                return;
            }

            var me = this;
            var dom = target;
            var dayIndex = parseInt(dom.value, 10);
            var dayState = dom.checked;

            var rawValueCopy = rawValueClone(me.rawValue);

            var timeValue = rawValueCopy[dayIndex];

            for (var i = 0, len = timeValue.length; i < len; i++) {

                timeValue[i] = dayState ? 1 : 0;

            }

            me.setRawValue(rawValueCopy);

        }

        /**
         * shortcut click handle
         * 点击shortcut的处理函数
         *
         * @param {Event} e 事件对象
         */
        function shortcutClickHandler(e) {
            var target = e.target;

            if (!target || !lib.hasAttribute(target, 'data-item')) {
                return;
            }

            var index = target.getAttribute('data-item');

            var func = this.shortcut[index].getValue;
            typeof func === 'function' && func.call(this);

            var rawValue;

            if (typeof func === 'function') {
                rawValue = func.call(this);
            }
            else {
                rawValue = func;
            }

            this.setRawValue(rawValue);

        }

        /**
         * 快捷方式区域的mousemove的处理函数
         *
         * @inner
         * @param {Event} e 事件对象
         */
        function shortcutMoveHandler(e) {
            var target = e.target;

            if (!target || !target.getAttribute('data-item')) {

                return;
            }

            var element = target;

            var me = this;

            var mousepos = {};
            mousepos.y = e.pageY + 20;
            mousepos.x = e.pageX + 10;

            var dom = element;

            var index = dom.getAttribute('data-item');
            var tipId = getId(me, 'shortcut-item') + index;

            setTimeout(function () {
                var tipElement = lib.g(tipId);

                if (tipElement) {

                    tipElement.style.top =  mousepos.y + 'px';
                    tipElement.style.left = mousepos.x + 'px';
                }

            }, 0);
        }

        /**
         * 快捷方式区域的mouseover mouseout的处理函数
         *
         * @inner
         * @param {boolean} isOver 是否mouseover
         * @param {Event} e 事件对象
         */
        function shortcutOverOutHandler(isOver, e) {
            var target = e.target;

            if (!target || !target.getAttribute('data-item')) {
                return;
            }

            var element = target;

            var mousepos = {};
            mousepos.y = e.pageY + 20;
            mousepos.x = e.pageX + 10;


            var me = this;
            var $dom = $(element);
            var index = $dom.attr('data-item');
            var tipId = getId(me, 'shortcut-item') + index;

            // 构建并获取tip
            var clazz = me.helper.getPartClassName('shortcut-item-hover');

            if (isOver) {
                $dom.addClass(clazz);

                var tipText = me.shortcut[index].tip;
                showPromptTip(me, tipId, mousepos, tipText);
            }
            else {
                $dom.removeClass(clazz);
                hidePromptTip(me, tipId);
            }
        }

        var timeTipTpl = ''
            + '<div id="${timeId}" class="${timeClass}">${time}</div>'
            + '<div id="${textId}" class="${textClass}">${text}</div>';

        /**
         * timeItem mouseover handler
         * 时间的mouseover的处理函数
         *
         * @param {Event} e 事件对象
         */
        function timeOverHandler(e) {
            var target = e.target;

            if (!target || !target.getAttribute('data-time-item')) {
                return;
            }

            var $element = $(target);

            // 添加hover class
            $element.addClass(
                this.helper.getPartClassName('time-hover')
            );

            // 获取鼠标位置
            var mousepos = {};
            mousepos.y = e.pageY + 20;
            mousepos.x = e.pageX + 10;

            var me = this;

            // 获取当前元素所代表的时间
            var time = parseInt($element.attr('data-time'), 10);
            var day  = parseInt($element.attr('data-day'), 10);

            // 创立并显示提示tip
            var tipText = lib.format(timeTipTpl,
                {
                    time: '<strong>' + time
                        + ':00</strong>&nbsp;—&nbsp;<strong>'
                        + (time + 1) + ':00</strong>',
                    text: '点击/拖动鼠标选择',
                    timeId: getId(me, 'timeitem-tip-head'),
                    textId: getId(me, 'timeitem-tip-body'),
                    timeClass: getClass(me, 'timeitem-tip-head'),
                    textClass: getClass(me, 'timeitem-tip-body')
                }
            );
            var tipId = getId(me, 'timeitem-tip');

            showPromptTip(me, tipId, mousepos, tipText);
            repaintCovers.call(this, day, time);
        }

        /**
         * 绘制遮罩
         * @param {number} day 星期
         * @param {number} time 时间段
         * @param {boolean} all TODO: all是干啥的
         */
        function repaintCovers(day, time, all) {
            // 重新计算所有遮罩层的显示
            var me = this;
            clearTimeout(me.repaintCoverTimer);
            me.repaintCoverTimer = setTimeout(
                function () {
                    var timebody = lib.g(getId(me, 'time-body'));
                    var timeCovers = timebody.getElementsByTagName('aside');

                    for (var i = 0, len = timeCovers.length; i < len; i++) {
                        var item = timeCovers[i];
                        var startCT = parseInt(item.getAttribute('data-start-time'), 10);
                        var endCT = parseInt(item.getAttribute('data-end-time'), 10);
                        var coverDay = parseInt(item.getAttribute('data-day'), 10);

                        if (!all && time >= startCT
                            && time < endCT
                            && day === coverDay) {
                            item.style.display = 'none';
                        }
                        else {
                            item.style.display = 'block';
                        }
                    }
                },
                100
            );

        }

        /**
         * timeItem mouseout handler
         * 时间的mouseout的处理函数
         *
         * @param {Event} e 鼠标事件
         */
        function timeOutHandler(e) {
            var target = e.target;
            var me = this;
            var related = e.relatedTarget;
            var current = e.currentTarget;
            if (!(related === false || current === related
                    || (related && (related.prefix === 'xul'
                    || lib.dom.contains(current, related)))
                )) {
                repaintCovers.call(me, 0, 0, true);
            }
            if (!target || !target.getAttribute('data-time-item')) {
                return;
            }

            // 移除hover效果
            $(target).removeClasses(
                me.helper.getPartClassName('time-hover')
            );

            // 隐藏tip
            hidePromptTip(me, getId(me, 'timeitem-tip'));
        }

        /**
         * drag后，重绘选中的值
         *
         * @param {Schedule} schedule Schedule实例
         * @param {Object} cellPos 选择区域的开始和结束配置
         */
        function setSelectedAreaValue(schedule, cellPos) {

            var me = schedule;

            var startcell = cellPos.startcell;
            var endcell   = cellPos.endcell;

            var minXCell = Math.min(startcell.x, endcell.x);
            var minYCell = Math.min(startcell.y, endcell.y);
            var maxXCell = Math.max(startcell.x, endcell.x);
            var maxYCell = Math.max(startcell.y, endcell.y);

            var rawValueCopy = rawValueClone(me.rawValue);

            for (var i = minYCell; i <= maxYCell; i++) {
                for (var j = minXCell; j <= maxXCell; j++) {

                    if (rawValueCopy[i][j]) {
                        rawValueCopy[i][j] = 0;
                    }
                    else {
                        rawValueCopy[i][j] = 1;
                    }

                }
            }

            me.setRawValue(rawValueCopy);
        }

        /**
         * 获取选择区域的开始和结束配置
         * @param {Schedule} schedule Schedule实例
         * @param {Object} mousepos 当前的鼠标位置
         * @return {Object} 选择区域的开始和结束配置
         */
        function getTragTimeCellPos(schedule, mousepos) {
            var me = schedule;
            var timeBodyPos  = me.dragRange;
            var dragStartPos = me.dragStartPos;
            var rangePos = {};
            var slotSize = me.slotSize;

            // 计算拖动遮罩层的结束鼠标点
            if (mousepos.x <= timeBodyPos[1]
                && mousepos.x  >= timeBodyPos[3]) {
                rangePos.x = mousepos.x;
            }
            else {
                rangePos.x = mousepos.x - dragStartPos.x < 0
                    ? timeBodyPos[3] : timeBodyPos[1];
            }

            if (mousepos.y  <= timeBodyPos[2]
                && mousepos.y >= timeBodyPos[0]) {
                rangePos.y = mousepos.y;
            }
            else {
                rangePos.y = mousepos.y - dragStartPos.y < 0
                ? timeBodyPos[0] : timeBodyPos[2];
            }

            var cellrange = {startcell: {}, endcell: {}};
            // 计算拖动遮罩层覆盖区域位置
            cellrange.startcell.x = Math.floor((dragStartPos.x - me.dragRange[3]) / slotSize);
            cellrange.startcell.y = Math.floor((dragStartPos.y - me.dragRange[0]) / slotSize);
            cellrange.endcell.x = Math.floor((rangePos.x - me.dragRange[3]) / slotSize);
            cellrange.endcell.y = Math.floor((rangePos.y - me.dragRange[0]) / slotSize);

            if (cellrange.endcell.x >= 23) {
                cellrange.endcell.x = 23;
            }
            if (cellrange.endcell.y >= 6) {
                cellrange.endcell.y = 6;
            }

            return cellrange;
        }

        /**
         * drag时的鼠标跟随层的渲染方法
         * @param {Event} e  鼠标事件
         */
        function repaintFollowEle(e) {
            var me = this;
            var slotSize = me.slotSize;

            // 计算当前显示区域
            var cellPos = getTragTimeCellPos(this,
                {x: e.pageX, y: e.pageY}
            );

            var followEleId = getId(me, 'follow-item');
            var followEle = lib.g(followEleId);
            if (!followEle) {
                followEle = document.createElement('div');
                followEle.className = getClass(me, 'follow-item');
                followEle.id = followEleId;
                lib.g(getId(me, 'time-body')).appendChild(followEle);
            }


            var startcell = cellPos.startcell;
            var endcell = cellPos.endcell;
            var startcellX = startcell.x;
            var startcellY = startcell.y;
            var endcellX = endcell.x;
            var endcellY = endcell.y;
            var divTop;
            var divLeft;
            var divHeight;
            var divWidth;


            if (endcellY >= startcellY) {
                divTop = startcellY * slotSize;
                divHeight = (endcellY - startcellY + 1) * slotSize - 2;
            }
            else {
                divTop = endcellY * slotSize;
                divHeight = (startcellY - endcellY + 1) * slotSize - 2;
            }

            if (endcellX >= startcellX) {
                divLeft = startcellX * slotSize;
                divWidth = (endcellX - startcellX + 1) * slotSize - 2;
            }
            else {
                divLeft = endcellX * slotSize;
                divWidth = (startcellX - endcellX + 1) * slotSize - 2;
            }

            var cssStyles = ''
                + ';display:block;'
                + ';width:' + divWidth + 'px'
                + ';height:' + divHeight + 'px'
                + ';top:' + divTop + 'px'
                + ';left:' + divLeft + 'px';

            followEle.style.cssText += cssStyles;
        }

        /**
         * 拷贝rawValue一个副本
         *
         * @param {Array} rawValue 一个二维数组
         * @return {Array}
         */
        function rawValueClone(rawValue) {

            var val = [];
            for (var i = 0, len = rawValue.length; i < len; i++) {
                val.push([].slice.call(rawValue[i], 0));
            }

            return val;
        }

        /**
         * 设置星期checkbox的状态
         * @param {Schedule} schedule 当前控件
         * @param {string} state    状态
         * @param {boolean} value    值
         */
        function setDayCheckboxState(schedule, state, value) {

            var dayHead = lib.g(getId(schedule, 'day-head'));
            var inputs = dayHead.getElementsByTagName('input');

            for (var i = 0, len = inputs.length; i < len; i++) {

                inputs[i][state] = value;
            }
        }

        /**
         * 根据坐标值改变当前值
         *
         * @param {Schedule} schedule 当前控件
         * @param {boolean} isSelect 是否选中当前坐标
         * @param {Array.<number>} coord 当前坐标[星期，小时]
         */
        function dealValueByCoord(schedule, isSelect, coord) {

            var rawValueCopy = rawValueClone(schedule.rawValue);

            for (var i = 0, len = coord.length; i < len; i++) {

                var item = coord[i];

                if (rawValueCopy[item[0]] != null
                    && rawValueCopy[item[0]][item[1]] != null) {

                    rawValueCopy[item[0]][item[1]] = isSelect ? 1 : 0;
                }
            }

            schedule.setRawValue(rawValueCopy);
        }

        function checkSlotSize(schedule) {
            var html = '<div class="${testSlotClass}"></div>';
            var ele = schedule.main;

            ele.innerHTML = lib.format(
                html,
                {
                    testSlotClass:
                        schedule.helper.getPartClasses('slot-tester').join(' ')
                }
            );
            schedule.slotSize = parseFloat(lib.getComputedStyle(ele.firstChild, 'width'));
        }

        esui.register(Schedule);
        return Schedule;
    }
);
