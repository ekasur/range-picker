/*! range-picker - v0.0.2-dev - 2016-03-18 */
;(function(factory) {
    "use strict";

    if (typeof define === "function" && define.amd) {
        // amd
        define(["jquery"], factory);
    } else {
        factory(jQuery);
    }
}(function($) {
    "use strict";

    var STR_REPLACE_REG = /<%=\s*(\w+)\s*%>/g;

    function isUndefined(target) {
        return typeof target === "undefined";
    }

    function replace(str, value) {
        return str.replace(STR_REPLACE_REG, function(match, key) {
            return value[key];
        });
    }

    function RangePicker(container, options) {
        if (isUndefined(options.startValue) || isUndefined(options.endValue)) {
            throw new Error("startValue and endValue is need");
        }

        if(isUndefined(options.translateSelectLabel)) {
            throw new Error(" RangePicker: translateSelectLabel is need");
        }
        this.__init(container, options);
    }

    RangePicker.prototype = {
        constructor: RangePicker,
        __defaultOptions: {
            type: "single"
        },
        __template: "<div class='range-picker-wrapper'>" +
                      "<div class='range-picker'>" +
                        "<span class='not-select-process'></span>" +
                        "<span class='label range-label'><%= startValue %></span>" +
                        "<span class='label range-label end-label'><%= endValue %></span>" +
                      "</div>" +
                    "</div>",
        __init: function(container, options) {
            this.__options = $.extend({}, this.__defaultOptions, options);
            this.__$containerElement = container;
            this.__render();
            this.__$rangepickerElement = this.__$containerElement.find(".range-picker");
            this.__addWidget();
            this.__setContainerToWrapperWidget();
        },

        __render: function() {
            var templateValue = {
                startValue: this.__options.startValue,
                endValue: this.__options.endValue
            },
            viewStr = replace(this.__template, templateValue);
            this.__$containerElement.html(viewStr);
        },

        __addWidget: function() {
            var positionChangeCallback = $.proxy(this.__handleLabelPositionChange, this),
                totalWidth = this.__$rangepickerElement.width();

            this.__selectCursors = [];
            this.__selectCursors.push(new Cursor({
                positionChange: positionChangeCallback,
                totalWidth: totalWidth
            }));
            // 如果类型是 double 则添加两个游标
            if (this.__options.type === "double") {
                this.__selectCursors.push(new Cursor({
                    positionChange: positionChangeCallback,
                    totalWidth: totalWidth,
                }));
            }
            this.__processBar = new ProcessBar();

            this.__$rangepickerElement.append(this.__processBar.getJQueryElement());
            for(var i = 0; i < this.__selectCursors.length; i++) {
                this.__$rangepickerElement.append(this.__selectCursors[i].getJQueryElement());
            }
            this.__setWidgetInitialValue();
        },

        __setWidgetInitialValue: function() {
            var totalWidth = this.__$rangepickerElement.width();

            // 游标位置需要偏移半个游标的宽度, 所以先设置游标的文本,才能计算游标的位置
            this.__selectCursors[0].render(
                this.__options.translateSelectLabel(totalWidth, totalWidth)
            );
            // 设置游标前头的位置为右边界
            this.__selectCursors[0].updateArrowPosition(totalWidth);

            if (!isUndefined(this.__selectCursors[1])) {
                var cursor = this.__selectCursors[1];
                cursor.render(this.__options.translateSelectLabel(0, totalWidth));
                // 设置游标前头的位置为左边界
                cursor.updateArrowPosition(0);
            }

            this.__updateProcessBarView();
        },

        __setContainerToWrapperWidget: function() {
            // 添加容器的 paddint-top 以包含游标
            var wrapperElement = this.__$containerElement.find(".range-picker-wrapper"),
                cursorHeight = -(this.__selectCursors[0].getJQueryElement().position().top);
            if (!isUndefined(this.__selectCursors[1]) &&
                -(this.__selectCursors[1].getJQueryElement().position().top) > cursorHeight) {
                cursorHeight = -(this.__selectCursors[1].getJQueryElement().position().top);
            }
            wrapperElement.css("paddingTop", cursorHeight + "px");
        },

        __handleLabelPositionChange: function(position) {
            this.__updateView(position.left);
        },

        __updateView: function() {
            this.__updateCursorView();
            this.__updateProcessBarView();
        },

        __updateCursorView: function() {
            var i = 0,
                labelText = "",
                position = null;

            for(; i < this.__selectCursors.length; i++) {
                position = this.__selectCursors[i].getArrowPosition();
                labelText = this.__options.translateSelectLabel(position.left,
                        this.__$rangepickerElement.width());
                this.__selectCursors[i].render(labelText);
            }

        },

        __updateProcessBarView: function() {
            var cursorPosition = this.__getCursorPosition(),
                processBarPosition = {
                    left: cursorPosition.start,
                    right: this.__$rangepickerElement.width() - cursorPosition.end
                };
            this.__processBar.updatePosition(processBarPosition);
        },

        __getCursorPosition: function() {
            var position = {
                start: 0,
                startLabel: ""
            },
            tmpPosition = this.__selectCursors[0].getArrowPosition();

            // 先将第一个游标设置为结束位置
            position.end = tmpPosition.left;
            position.endLabel = tmpPosition.positionLabel;

            if (!isUndefined(this.__selectCursors[1])) {
                tmpPosition = this.__selectCursors[1].getArrowPosition();
                // 当存在第二个光标时且第二个光标距离更远,将第二个光标设置为结束位置,否则第二个光标设置为起始位置
                if (tmpPosition.left > position.end) {
                        position.start = position.end;
                        position.startLabel = position.endLabel;
                        position.end = tmpPosition.left;
                        position.endLabel = tmpPosition.positionLabel;
                } else {
                    position.start = tmpPosition.left;
                    position.startLabel = tmpPosition.positionLabel;
                }
            }

            return position;
        },

        getSelectValue: function() {
            var position = this.__getCursorPosition();
            position.totalWidth = this.__$rangepickerElement.width();

            return position;
        }
    };

    function Cursor(options) {
        this.__init(options);
    }

    Cursor.prototype = {
        constructor: Cursor,
        __defaultOptions: {
            positionChange: $.loop,
            totalWidth: 0
        },
        __template: "<span class='label select-label'></span>",

        __init: function(options) {
            this.__options = $.extend({}, this.__defaultOptions, options);
            this.__$element = $(this.__template);
            this.__bindDragEventHandler();
        },

        __bindDragEventHandler: function() {
            var self = this;

            this.__$element.on("mousedown", function(event) {
                this.__rangepicker = {
                    isMouseDown: true,
                    mouseStartX: event.clientX,
                    previousMoveDistance: 0
                };
                // 增加 z-index 的值,避免两个游标时被另一个游标遮挡
                $(this).css("zIndex", 1000);
            }).on("mouseup", function() {
                this.__rangepicker = null;
                $(this).css("zIndex", 1);
            }).on("mousemove", function(event) {
                if (this.__rangepicker && this.__rangepicker.isMouseDown) {
                    self.__handleDragEvent(event.clientX, this.__rangepicker);
                }
            }).on("mouseout", function() {
                $(this).css("zIndex", 1);
                this.__rangepicker = null;
            });
        },

        __handleDragEvent: function(clientX, elementData) {
            var distance = clientX - elementData.mouseStartX - elementData.previousMoveDistance;
            elementData.previousMoveDistance = clientX - elementData.mouseStartX;
            var position = this.__calculatePosition(distance);
            this.updateArrowPosition(position);
            // 获取游标下面箭头的位置,并传递给回调函数
            this.__options.positionChange(this.getArrowPosition(), this.__$element);

        },

        __calculatePosition: function(offset) {
            var newPosition = this.__arrowPosition + offset;
            // 如果拖动后游标的位置超过了左右边界,则设置为左右边界的位置
            if (newPosition > this.__options.totalWidth) {
                newPosition = this.__options.totalWidth;
            } else if (newPosition < 0) {
                newPosition = 0;
            }

            return newPosition;
        },

        __updatePosition: function(position) {
            for(var key in position) {
                if (position.hasOwnProperty(key)) {
                    this.__$element.css(key, position[key] + "px");
                }
            }
        },

        render: function(textValue) {
            this.__$element.text(textValue);
        },

        updateArrowPosition: function(position) {
            this.__arrowPosition = position;
            this.__updatePosition({
                left: position - this.__$element.outerWidth() / 2 // 游标的位置减去半个游标的宽度才是游标左边的位置
            });
        },

        getJQueryElement: function() {
            return this.__$element;
        },

        getArrowPosition: function() {
            return {
                left: this.__arrowPosition,
                positionLabel: this.__$element.text()
            };
        }
    };

    function ProcessBar(options) {
        this.__init(options);
    }

    ProcessBar.prototype = {
        constructor: ProcessBar,
        __template: "<span class='process'></span>",
        __init: function() {
            this.__$element = $(this.__template);
        },

        updatePosition: function(position) {
            for(var key in position) {
                if (position.hasOwnProperty(key)) {
                    this.__$element.css(key, position[key] + "px");
                }
            }
        },

        getJQueryElement: function() {
            return this.__$element;
        }
    };

    $.fn.rangepicker = function(options) {
        return new RangePicker(this, options);
    };
}));