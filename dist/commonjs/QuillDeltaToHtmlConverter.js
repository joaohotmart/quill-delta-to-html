"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var InsertOpsConverter_1 = require("./InsertOpsConverter");
var OpToHtmlConverter_1 = require("./OpToHtmlConverter");
var Grouper_1 = require("./grouper/Grouper");
var group_types_1 = require("./grouper/group-types");
var ListNester_1 = require("./grouper/ListNester");
var funcs_html_1 = require("./funcs-html");
require("./extensions/Object");
var value_types_1 = require("./value-types");
var BrTag = '<br/>';
var QuillDeltaToHtmlConverter = (function () {
    function QuillDeltaToHtmlConverter(deltaOps, options) {
        this.rawDeltaOps = [];
        this.callbacks = {};
        this.options = Object._assign({
            paragraphTag: 'p',
            encodeHtml: true,
            classPrefix: 'ql',
            multiLineBlockquote: true,
            multiLineHeader: true,
            multiLineCodeblock: true
        }, options, {
            orderedListTag: 'ol',
            bulletListTag: 'ul',
            listItemTag: 'li'
        });
        this.converterOptions = {
            encodeHtml: this.options.encodeHtml,
            classPrefix: this.options.classPrefix,
            listItemTag: this.options.listItemTag,
            paragraphTag: this.options.paragraphTag,
            linkRel: this.options.linkRel
        };
        this.rawDeltaOps = deltaOps;
    }
    QuillDeltaToHtmlConverter.prototype.getListTag = function (op) {
        return op.isOrderedList() ? this.options.orderedListTag + ''
            : op.isBulletList() ? this.options.bulletListTag + ''
                : '';
    };
    QuillDeltaToHtmlConverter.prototype.convert = function () {
        var _this = this;
        var deltaOps = InsertOpsConverter_1.InsertOpsConverter.convert(this.rawDeltaOps);
        var pairedOps = Grouper_1.Grouper.pairOpsWithTheirBlock(deltaOps);
        var groupedSameStyleBlocks = Grouper_1.Grouper.groupConsecutiveSameStyleBlocks(pairedOps, {
            blockquotes: !!this.options.multiLineBlockquote,
            header: !!this.options.multiLineHeader,
            codeBlocks: !!this.options.multiLineCodeblock
        });
        var groupedOps = Grouper_1.Grouper.reduceConsecutiveSameStyleBlocksToOne(groupedSameStyleBlocks);
        var listNester = new ListNester_1.ListNester();
        var groupListsNested = listNester.nest(groupedOps);
        var len = groupListsNested.length;
        var group, html;
        var htmlArr = [];
        for (var i = 0; i < len; i++) {
            group = groupListsNested[i];
            if (group instanceof group_types_1.ListGroup) {
                html = this.renderWithCallbacks(value_types_1.GroupType.List, group, function () { return _this.renderList(group); });
            }
            else if (group instanceof group_types_1.BlockGroup) {
                var g = group;
                html = this.renderWithCallbacks(value_types_1.GroupType.Block, group, function () { return _this.renderBlock(g.op, g.ops); });
            }
            else if (group instanceof group_types_1.VideoItem) {
                html = this.renderWithCallbacks(value_types_1.GroupType.Video, group, function () {
                    var g = group;
                    var converter = new OpToHtmlConverter_1.OpToHtmlConverter(g.op, _this.converterOptions);
                    return converter.getHtml();
                });
            }
            else {
                html = this.renderWithCallbacks(value_types_1.GroupType.InlineGroup, group, function () {
                    return _this.renderInlines(group.ops);
                });
            }
            htmlArr.push(html);
        }
        return htmlArr.join('');
    };
    QuillDeltaToHtmlConverter.prototype.renderWithCallbacks = function (groupType, group, myRenderFn) {
        var html = '';
        var beforeCb = this.callbacks['beforeRender_cb'];
        html = typeof beforeCb === 'function' ? beforeCb.apply(null, [groupType, group]) : '';
        if (!html) {
            html = myRenderFn();
        }
        var afterCb = this.callbacks['afterRender_cb'];
        html = typeof afterCb === 'function' ? afterCb.apply(null, [groupType, html]) : html;
        return html;
    };
    QuillDeltaToHtmlConverter.prototype.renderList = function (list, isOuterMost) {
        var _this = this;
        if (isOuterMost === void 0) { isOuterMost = true; }
        var firstItem = list.items[0];
        return funcs_html_1.makeStartTag(this.getListTag(firstItem.item.op))
            + list.items.map(function (li) { return _this.renderListItem(li, isOuterMost); }).join('')
            + funcs_html_1.makeEndTag(this.getListTag(firstItem.item.op));
    };
    QuillDeltaToHtmlConverter.prototype.renderListItem = function (li, isOuterMost) {
        var converterOptions = Object._assign({}, this.converterOptions);
        li.item.op.attributes.indent = 0;
        var converter = new OpToHtmlConverter_1.OpToHtmlConverter(li.item.op, this.converterOptions);
        var parts = converter.getHtmlParts();
        var liElementsHtml = this.renderInlines(li.item.ops, false);
        return parts.openingTag + (liElementsHtml || BrTag) +
            (li.innerList ? this.renderList(li.innerList, false) : '')
            + parts.closingTag;
    };
    QuillDeltaToHtmlConverter.prototype.renderBlock = function (op, ops) {
        var _this = this;
        var converter = new OpToHtmlConverter_1.OpToHtmlConverter(op, this.converterOptions);
        var htmlParts = converter.getHtmlParts();
        if (op.isCodeBlock()) {
            return htmlParts.openingTag +
                ops.map(function (op) { return op.insert.value; }).join(value_types_1.NewLine)
                + htmlParts.closingTag;
        }
        var inlines = ops.map(function (op) {
            var converter = new OpToHtmlConverter_1.OpToHtmlConverter(op, _this.converterOptions);
            return converter.getHtml().replace(/\n/g, BrTag);
        }).join('');
        return htmlParts.openingTag + (inlines || BrTag) + htmlParts.closingTag;
    };
    QuillDeltaToHtmlConverter.prototype.renderInlines = function (ops, wrapInParagraphTag) {
        var _this = this;
        if (wrapInParagraphTag === void 0) { wrapInParagraphTag = true; }
        var nlRx = /\n/g;
        var pStart = wrapInParagraphTag ? funcs_html_1.makeStartTag(this.options.paragraphTag) : '';
        var pEnd = wrapInParagraphTag ? funcs_html_1.makeEndTag(this.options.paragraphTag) : '';
        var opsLen = ops.length - 1;
        var html = pStart
            + ops.map(function (op, i) {
                if (i === opsLen && op.isJustNewline()) {
                    return '';
                }
                var converter = new OpToHtmlConverter_1.OpToHtmlConverter(op, _this.converterOptions);
                return converter.getHtml().replace(nlRx, BrTag);
            }).join('')
            + pEnd;
        return html;
    };
    QuillDeltaToHtmlConverter.prototype.beforeRender = function (cb) {
        if (typeof cb === 'function') {
            this.callbacks['beforeRender_cb'] = cb;
        }
    };
    QuillDeltaToHtmlConverter.prototype.afterRender = function (cb) {
        if (typeof cb === 'function') {
            this.callbacks['afterRender_cb'] = cb;
        }
    };
    return QuillDeltaToHtmlConverter;
}());
exports.QuillDeltaToHtmlConverter = QuillDeltaToHtmlConverter;
