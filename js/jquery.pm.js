/*!
 * jquery.pm.js: imitation sina blog
 * 
 * Author: Vic Yang, 2014
 */

;
(function(factory) {
        if (0 && typeof define === "function" && define.amd) {

            define(['jquery'], factory);
        } else {
            // 全局
            if (typeof jQuery === "undefined") {
                throw new Error("Js requires jQuery");
            }

            var PM = factory(jQuery);
            PM.pm.userid_myself = Number(window.G.getCookie('userId'));
            PM.pm.is_show_fold_btn = false;
            PM.init();
        }
    }
    (function($) {

        "use strict";

        var WEB_HOST = "http://" + window.location.host,
            IMG_HOST = WEB_HOST,
            SYS_USER_ID = 0, // 系统用户id
            SYS_USER_NAME = '小助手',
            SYS_USER_PIC = IMG_HOST + 'images/sys_pic.jpg',
            TIME_INIT = 0, // 初始化延迟时间
            TIME_SCROLL_TO = 500, // 滑到底部的延迟时间 @ms
            TIME_HIDE_RESET_MSG = 3000, // 自动隐藏解除私信屏蔽的提示
            TIME_HIDE_USER_LIST = 30 * 1000, // 自动隐藏用户列表的延迟时间
            MAX_SEARCH_PERSON = 6, // 最大显示搜索人数
            MAX_SHOW_HISTORY_NUM = 3, // 最多连续查看历史信息的次数
            OPACITY_LIST = 0.65;

        var chat_port = '7000',
            chat_ip = '221.228.80.100';

        var timer_hide_list = null; // 时间器 - 隐藏用户列表

        var HTMLS = {
                msg_history: $.trim($('#tpl_message_history').html()),
                msg_content: $.trim($('#tpl_message_content').html()),
                user_item: $.trim($('#tpl_user_item').html()),
                search_item: $.trim($('#tpl_search_list').html()),
                show_history: $.trim($('#tpl_show_history').html())
            },
            TXT = {
                no_body: '', // 亲，此处寸草不生，还不快找人私信！
                offline: '对方当前不在线，可能无法立即回复。',
                hiding: '该用户已屏蔽，发送私信即可解除屏蔽。',
                reset_msg: '已恢复用户的私信',
                more_history: '点击聊天记录，查看更多。',
                no_history: '已没有更多的消息可显示。',
                shield: '确认屏蔽 __USER_NAME__ 的私信吗？',
                shield_over: '解除屏蔽后将恢复从消息箱中接收私信。',
                stat_online: '在线',
                stat_offline: '离线',
                stat_shield: '屏蔽'
            };

        var fee_messages = { // 保存客户端地址跳转的数据变量
                user_id: null,
                user_name: null,
                is_online: 0
            },
            is_first_fee_msg = true, // 第一次载入页面时，显示客户端的私信提示窗口
            isie6 = typeof window.document.body.style.maxHeight === 'undefined';

        // 客户端接口提示
        var showFeeMessage = function(msg) {
            var is_win_close = window.G && window.G.feeWinStatus && window.G.feeWinStatus === 'close';

            if (is_win_close && typeof window.external.notifyFeeFlash !== 'undefined') {
                window.external.notifyFeeFlash('talk', 10); // 右下角托盘闪烁
            }

            if (is_win_close && typeof window.external.notifyFeeBubble !== 'undefined') {
                var htmls = $('#tpl_pm_tips').html();

                htmls = htmls.replace(/__IMG__/g, msg.pic)
                    .replace(/__NAME__/g, msg.name)
                    .replace(/__MESSAGE__/g, msg.msg)
                    .replace(/__NUMBER__/g, msg.count);
                window.external.notifyFeeBubble('私信提示', htmls); // 冒泡提示
                // 保存客户端跳转的数据
                fee_messages.user_name = msg.name;
                fee_messages.user_id = msg.userId;

                htmls = null;
            }
        };

        var PrivateMessage = function() {
            var _self = this;

            this.is_debug = true; // 调试开关
            this.is_update_history = false; // 是否即时更新最新私信的状态
            this.is_show_fold_btn = false; // 是否默认显示滑出按钮

            this.arr_users = []; // 成员列表
            this.obj_messages = {}; // 成员私信集合
            this.userid_myself = null; // 设置自己的userid
            this.new_messages_num = {}; // 未读新私信的数量

            var $container = this.$container = $('#js-pm-container'); // 容器
            this.$pm_main = $('.pm_main', $container); // 聊天成员主容器
            this.$users_list = $('.pm_list .list_content_li', this.$pm_main); // 成员列表 @tag:ul
            var $chat_box = this.$chat_box = $('.pm_chat_box', $container); // 聊天窗口
            this.$messages_list = $('.webim_dia_list', $chat_box); // 消息列表容器
            this.$btn_min_chat = $('.pm_icon_minY', $container); // 最小化
            this.$btn_close_chat = $('.pm_icon_closeY', $chat_box); // 关闭聊天窗口
            this.$min_chat_box = $('.pm_min_chat', $container); // 迷你聊天窗口
            var $fold_btn = this.$fold_btn = $('.pm_fold_btn', $container); // 收起|展开 容器
            this.$btn_click = $('.btn_click', $fold_btn); // 成员列表 收起|展开 按钮
            this.$sendbox_area = $('.sendbox_area', $container); // 输入信息内容的容器
            this.$btn_send = $('.sendbox_btn a', $container); // 发送按钮
            this.$btn_shield = $('.pm_icon_shield', $container); // 屏蔽按钮
            this.$btn_shieldover = $('.pm_icon_shieldover', $container); // 解除屏蔽按钮
            var $search = this.$search = $('.layer_searchList', $container); // 搜索框容器
            this.$btn_close_search = $('.pm_icon_closeY', $search); // 关闭搜索框
            this.$btn_search = $('.state_search_btn', $container); // 显示|隐藏 搜索框
            this.$input_search = $('input', $search); // 搜索框 @tag:input
            this.$search_list = $('.list_content_li', $search); // 搜索结果列表 @tag:ul
            this.$online = $('.user_icon_online', $container); // 在线
            this.$offline = $('.user_icon_offline', $container); // 离线
            this.$no_shield = $('.user_no_shield', $container); // 接收私信
            this.$shield_all = $('.user_shield_all', $container); // 屏蔽私信
            this.$new_msg_num = $('.pm_new_msg_num', $container); // 显示新消息的数量

            // 根据userid获取用户私信列表
            this.flexGetUserMessages = function(userId, t_userId, only_new, max_count, max_time) {
                max_count = max_count || 5;
                max_time = max_time || null;

                window.widget.flashObj.getMessageFromJS(
                    0, window.widget.codes.getMessages, JSON.stringify({
                        f: userId,
                        t: t_userId,
                        o: only_new,
                        m: max_count,
                        i: max_time,
                        user: userId
                    })
                );
            };
            // 发送消息，并执行回调函数
            this.flexSendMessage = function(userId, t_userId, content, callback) {
                window.widget.flashObj.getMessageFromJS(
                    0, window.widget.codes.sendMessage, JSON.stringify({
                        f: userId,
                        t: t_userId,
                        s: content,
                        user: userId
                    })
                );

                if (callback && typeof callback === 'function') { // Callback function
                    callback();
                }
            };
            // 收到用户消息协议
            this.flexReceiveNewMessage = function(msg) {
                msg = msg || _self.testReceiveNewMessage();

                if (!msg.userId) {
                    _self.debug('The message has not the user id, pls check msg datas.', 'flexReceiveNewMessage');
                    return;
                }

                if (_self.getChatUserId() === msg.userId) { // 如果当前正在与该用户聊天，则立即获取私信内容
                    _self.flexGetUserMessages(_self.userid_myself, msg.userId, 1, null, null);
                }
                showFeeMessage(msg);

                _self.topTheUserItem(msg.userId);

                var new_msg_type = null;
                if (_self.$pm_main.is(':hidden') && _self.$chat_box.is(':hidden')) {
                    new_msg_type = 'show';
                }
                _self.new_messages_num[msg.userId] = msg.count;
                _self.setNewMessagesNum(new_msg_type);
            };
            // 设置状态
            this.flexSettingStat = function(type, stat, t_userId) {
                if (!type) {
                    _self.debug('Must be params.', 'flexSettingStat');
                    return;
                }
                var userId = _self.userid_myself,
                    params = null;

                switch (type) {
                    case 'online': // 在线|隐身
                        stat = !!stat ? 0 : 1;
                        params = {
                            u: userId,
                            h: stat
                        };
                        break;
                    case 'shield': // 屏蔽|解除
                        stat = !!stat ? 1 : 0;
                        params = {
                            u: userId,
                            sa: stat
                        };
                        if (t_userId) {
                            params.su = t_userId;
                        }
                        break;
                    default:
                }

                if (params === null) {
                    _self.debug('Params is error.', 'flexSettingStat');
                    return;
                }

                params.user = userId;
                window.widget.flashObj.getMessageFromJS(
                    0, window.widget.codes.setting, JSON.stringify(params)
                );
            };
        };

        // 客户端通知web跳转
        // window.notifyWebRedirect = function(loaction) {
        //     if (typeof window.widget === 'undefined' && window.G && typeof window.G.initWidgetPM !== 'undefined') {
        //         window.G.initWidgetPM(); // 从未触发私信初始化
        //         return;
        //     }

        //     // 打开好友最后一条的消息
        //     var $show_user = PM.findUserItem(fee_messages.user_id);
        //     if (!!$show_user) {
        //         $show_user.trigger('click.openchat');
        //     }
        //     $show_user = null;
        // };

        var class_new_message = 'W_new',
            class_stat_icon = 'W_chat_stat',
            class_stat_online = 'W_chat_stat_online',
            class_stat_offline = 'W_chat_stat_offline',
            class_stat_hiding = 'W_chat_stat_hiding',
            class_lf_msg = 'webim_dia_l',
            class_rg_msg = 'webim_dia_r',
            class_hide = 'hide',
            class_show_history = 'pm_more_msg',
            class_chat_rg = 'rg20',
            class_arrow_rg = 'arrow_rg',
            class_arrow_rg_on = 'arrow_rg_on',
            class_arrow_lf = 'arrow_lf',
            class_arrow_lf_on = 'arrow_lf_on',
            class_container_hide = 'pm_container_hide',
            class_watermark = 'watermark';

        var $msg_list_scroll = $('#js-chat-messages');

        var _proto = PrivateMessage.prototype;

        // 调试函数
        _proto.debug = function() {
            if (!this.is_debug) {
                return;
            }
            var msg = '[Debug log] ' + Array.prototype.join.call(arguments, ' ');

            if (window.console && window.console.log) {
                window.console.log(msg);
            } else if (window.opera && window.opera.postError) {
                window.opera.postError(msg);
            }
        };

        // 初始化函数
        _proto.init = function() {
            this.debug('init begin...');


            this.$fold_btn.removeClass(class_hide); // show btn
            this.initEvent();
        };

        // 初始化事件
        _proto.initEvent = function() {
            this.debug('init bind event...');
            this.bindChatList();
            this.bindChatWin();
            this.bindSearch();
            this.bindNewMessagesBox();
        };

        // 初始化显示成员列表
        _proto.initUserList = function() {
            this.debug('Setting user list datas...');

            if (!this.arr_users.length) {
                this.$users_list.html(TXT.no_body);
                return;
            }

            var list = [];
            for (var i = 0, len = this.arr_users.length; i < len; i++) {
                var user_info = this.arr_users[i];
                this.new_messages_num[user_info.id] = user_info.newMessage;
                list[i] = this.addTheUser(user_info);
            }

            if (list.length) {
                this.$users_list.html(list.join('')); // html user list.
            }

            list = null;
        };

        // 马上显示私信聊天窗口
        _proto.showChatNow = function() {
            if (!getUrlParam('showPM')) {
                return;
            }
            this.debug('Begin show chat win now...');

            var user_id = getUrlParam('userId'),
                user_name = unescape(getUrlParam('userName')),
                is_online = getUrlParam('isOnline') === 'true' || Number(getUrlParam('isOnline')) === 1 ? 1 : 0;

            if (!user_id) {
                this.debug('Not found the param userId', 'nowShowPM');
                return;
            }

            // 如果存在好友，即时查看最新一条消息（客户端跳转）
            if (getUrlParam('showNewMessage')) {
                var $show_user = this.findUserItem(user_id);

                if (!!$show_user) {
                    $show_user.trigger('click.openchat');
                    return;
                }
            }

            if (!user_name) {
                this.debug('Not found the param userName', 'nowShowPM');
                return;
            }

            var user_info = this.getUserInfo(user_id);
            user_info.userName = user_name;
            user_info.userOnline = is_online;
            if (user_info.userPic === '') {
                user_info.userPic = window.G.IMG_PATH + 'images/none.png';
            }

            this.showHideChatWin('show'); // Show user chat window
            this.setUserChatWin(user_info);
            user_info = null;
        };

        // 获取用户信息
        _proto.getUserInfo = function(userId) {
            var user_info = { // init the user info (type: object)
                userId: userId,
                userName: '',
                userPic: '',
                userMessages: { messages: [] },
                userOnline: 0,
                userShield: 0
            };

            for (var i = 0, len = this.arr_users.length; i < len; i++) {
                if (this.arr_users[i].id == userId) {
                    var user = this.arr_users[i];
                    user_info.userName = user.userName;
                    user_info.userPic = user.pic;
                    user_info.userOnline = user.online;
                    user_info.userShield = user.isShield;
                    break;
                }
            }

            if (this.obj_messages[userId]) {
                user_info.userMessages = this.obj_messages[userId];
            }

            return user_info;
        };

        // 重设用户昵称
        _proto.resetUserName = function(userId, userName) {
            if (!userId || !userName) {
                return;
            }

            var is_reset_succ = false;
            for (var i = 0, len = this.arr_users.length; i < len; i++) {
                if (this.arr_users[i].id == userId) {
                    this.arr_users[i].userName = userName;
                    is_reset_succ = true;
                    break;
                }
            }

            return is_reset_succ;
        };

        // 获取当前聊天用户的id
        _proto.getChatUserId = function() {
            var user_id = 0;

            if (this.$chat_box.is(':visible')) {
                user_id = Number(this.$chat_box.data('user_id'));
            }

            return user_id;
        };

        // 组装一个好友模板
        _proto.addTheUser = function(user) {
            var user_stat = user.online,
                class_stat = getUserStatClass(user_stat).class_name,
                class_newMessage = user.newMessage ? class_new_message : '';

            if (user.isShield) { // 如果是被屏蔽的用户，则增加样式
                class_stat += ' ' + class_stat_hiding;
            }

            var item = HTMLS.user_item
                .replace(/__USERID__/g, user.id)
                .replace(/__PIC__/g, user.pic)
                .replace(/__USER_NAME__/g, user.userName)
                .replace(/__CLASS_STAT__/g, class_stat)
                .replace(/__NEW_MESSAGE__/g, class_newMessage);

            return item;
        };

        // 设置用户私信窗口内容
        _proto.setUserChatWin = function(userInfo) {
            if (typeof userInfo !== 'object') {
                this.debug('Param userInfo is not object type.', 'setUserChatWin');
                return;
            }

            var _self = this,
                $chat_box = this.$chat_box,
                $min_chat_box = this.$min_chat_box;

            function init() {
                setName();
                setPic();
                setOnline();

                // 设置当前私信窗口用户id标识
                $chat_box.data('user_id', userInfo.userId);
                $min_chat_box.data('user_id', userInfo.userId);

                var hide_history = userInfo.userId === SYS_USER_ID ? true : false;
                _self.showUserMessages(userInfo.userMessages, hide_history); // 显示私信
            }

            function setName() {
                var $name = $('.chat_name a', $chat_box);
                $name
                    .html(userInfo.userName)
                    .attr({
                        'title': userInfo.userName,
                        'href': window.G.webUrl + '/user-' + userInfo.userId + '.html?pageCode=PM' // @todo
                    });
                if (userInfo.userId === SYS_USER_ID) {
                    $name.attr('href', '#');
                }

                $min_chat_box.html(userInfo.userName);
            }

            function setPic() {
                $chat_box.find('.head_pic img').attr('src', userInfo.userPic);
            }

            function setOnline() {
                var $chat_stat = $('.' + class_stat_icon, $chat_box),
                    $stat_tip = $('.webim_chat_tips', $chat_box),
                    $stat_tip_con = $('.pm_user_stat', $stat_tip),
                    $msg_top = $('.webim_dia_top', $chat_box),
                    stat = getUserStatClass(userInfo.userOnline),
                    class_stat = stat.class_name,
                    title_stat = stat.title;

                $chat_stat
                    .removeClass(class_stat_online)
                    .removeClass(class_stat_offline)
                    .removeClass(class_stat_hiding)
                    .addClass(class_stat)
                    .attr('title', title_stat);

                var shield_opts = {
                        isShield: true,
                        online: userInfo.userOnline,
                        userId: userInfo.userId
                    },
                    user_stat = userInfo.userShield ? 2 : userInfo.userOnline;
                switch (user_stat) {
                    case 0: // offline
                        _self.setChatTips('show', TXT.offline);
                        break;
                    case 1: // online
                        _self.setChatTips('hide');
                        break;
                    case 2: // shield | class hiding
                        _self.setChatTips('show', TXT.hiding);

                        $chat_stat.addClass(class_stat_hiding).attr('title', TXT.stat_shield);
                        shield_opts.isShield = false;
                        break;
                }
                _self.setShieldStat(shield_opts);
            }

            init();
        };

        // 设置聊天顶部的提示信息
        _proto.setChatTips = function(type, content) {
            var $stat_tip = $('.webim_chat_tips', this.$chat_box),
                $stat_tip_con = $('.pm_user_stat', this.$stat_tip),
                $msg_top = $('.webim_dia_top', this.$chat_box);

            switch (type) {
                case 'show':
                    $stat_tip.show();
                    $stat_tip_con.html(content);
                    $msg_top.show();
                    break;
                case 'hide':
                    $stat_tip.hide();
                    $msg_top.hide();
                    break;
                default:
                    this.debug('Type is error, pls check it.', 'setChatTips');
            }
        };

        // 设置屏蔽功能，以及事件的绑定
        _proto.setShieldStat = function(opts) {
            var _self = this;

            if (!opts || typeof opts !== 'object') {
                this.debug('Must be param opts, or opts is not object.', 'setShieldStat');
                return;
            }

            if (opts.isShield) {
                this.$btn_shield.show();
                this.$btn_shieldover.hide();
            } else {
                this.$btn_shield.hide();
                this.$btn_shieldover.show();
            }

            var $shield_tips = $('.pm_shield_tips', this.$chat_box), // 屏蔽私信提示信息容器
                $shield_tips_txt = $('.txt', $shield_tips);

            this.$btn_shield
                .unbind('click')
                .on('click', function() { // 屏蔽此人
                    var _func_shield = function() {
                        var is_shield = true;
                        _self.flexSettingStat('shield', is_shield, opts.userId);
                        _self.showShield(is_shield);
                        _self.setChatTips('show', TXT.hiding);
                        setShieldsStat(is_shield);
                        updateUserShield(is_shield);
                    };

                    var name = $('.chat_name a', _self.$chat_box).html();
                    $shield_tips_txt.html(TXT.shield.replace('__USER_NAME__', name));
                    $shield_tips
                        .removeClass(class_hide)
                        .undelegate()
                        .delegate('.WBIM_btn_confirm', 'click', function() {
                            _func_shield();
                            $shield_tips.addClass(class_hide);
                        })
                        .delegate('.WBIM_btn_cancel', 'click', function() {
                            $shield_tips.addClass(class_hide);
                        });
                });

            this.$btn_shieldover
                .unbind('click')
                .on('click', function() { // 解除屏蔽
                    var _shieldover = function() {
                        var is_shield = false;
                        _self.flexSettingStat('shield', is_shield, opts.userId);
                        _self.showShield(is_shield);
                        if (opts.online) { // online
                            _self.setChatTips('hide');
                        } else { // offline
                            _self.setChatTips('show', TXT.offline);
                        }
                        setShieldsStat(is_shield);
                        updateUserShield(is_shield);
                    };

                    $shield_tips_txt.html(TXT.shield_over);
                    $shield_tips
                        .removeClass(class_hide)
                        .undelegate()
                        .delegate('.WBIM_btn_confirm', 'click', function() {
                            _shieldover();
                            $shield_tips.addClass(class_hide);
                        })
                        .delegate('.WBIM_btn_cancel', 'click', function() {
                            $shield_tips.addClass(class_hide);
                        });
                });

            function setShieldsStat(stat) {
                var $list_item = _self.findUserItem(opts.userId),
                    $chat_stat = $('.' + class_stat_icon, _self.$chat_box);
                if (!$list_item.length) {
                    return;
                }

                var $list_user_stat = $('.' + class_stat_icon, $list_item);
                if (stat) {
                    $list_user_stat.addClass(class_stat_hiding);
                    $chat_stat.addClass(class_stat_hiding);
                } else {
                    $list_user_stat.removeClass(class_stat_hiding);
                    $chat_stat.removeClass(class_stat_hiding);
                }
            }

            function updateUserShield(stat) {
                var users_list = _self.arr_users;
                for (var i = 0, len = users_list.length; i < len; i++) {
                    if (users_list[i].id == opts.userId) {
                        _self.arr_users[i].isShield = !!stat ? 1 : 0;
                        break;
                    }
                }
            }
        };

        // 显示用户私信内容
        _proto.showUserMessages = function(msg, hide_history) {
            var $messages_list = this.$messages_list;

            msg = msg || { messages: [] };
            //to_bottom = to_bottom || true;

            // 以下开始显示 信息列表
            if (!msg.messages.length && !msg.newMessages) { // Empty the message contens
                $messages_list.empty();
                return;
            }
            if (!msg.messages.length && msg.newMessages && !msg.newMessages.length) { // Empty the message contens
                $messages_list.empty();
                return;
            }

            var contents = [];
            for (var i = 0, len = msg.messages.length; i < len; i++) { // Add some history messages
                contents[i] = this.getMessageHtml(msg.messages[i]);
            }
            if (!hide_history) {
                contents.unshift(HTMLS.show_history); // Show history text tip
            }
            contents.push(HTMLS.msg_history); // Add a history text, line

            if (msg.newMessages && msg.newMessages.length) { // Add any new messages
                /*jshint validthis:true */
                for (var j = 0, len_n = msg.newMessages.length; j < len_n; j++) {
                    contents.push(this.getMessageHtml(msg.newMessages[j]));
                    if (this.is_update_history) {
                        msg.messages.push(msg.newMessages[j]);
                    }
                }

                if (this.is_update_history) {
                    try {
                        delete msg.newMessages;
                    } catch (e) {
                        msg.newMessages.length = 0;
                    }
                }
            }

            $messages_list.html(contents.join(''));
            msgScrollToBottom();
        };

        // 获取信息html
        _proto.getMessageHtml = function(msg) {
            var class_lr = msg.isMine ? class_rg_msg : class_lf_msg;

            return HTMLS.msg_content
                .replace(/__CLASS_LR__/g, class_lr)
                .replace(/__TIME__/g, msg.time)
                .replace(/__MESSAGE__/g, msg.content);
        };

        // 追加一条信息
        _proto.appendMessage = function(msg) {
            this.$messages_list.append(this.getMessageHtml(msg));
            msgScrollToBottom();
        };

        // 追加信息到顶部
        _proto.prependMessage = function(msg) {
            //if(typeof msg === 'object') {
            //msg = [msg];
            //}

            var items = [];
            for (var i = 0, len = msg.length; i < len; i++) {
                items[i] = this.getMessageHtml(msg[i]);
            }

            var $history = this.$messages_list.find('.' + class_show_history);
            if ($history.length) {
                $history.after(items.join(''));
            } else {
                this.$messages_list.prepend(items.join(''));
            }

            msgScrollTop();
        };

        // 绑定聊天成员列表容器事件
        _proto.bindChatList = function() {
            var _self = this,
                $pm_main = this.$pm_main,
                $btn_click = this.$btn_click,
                $arrow = $('em', $btn_click);

            function clearTimer() {
                if (timer_hide_list) {
                    clearTimeout(timer_hide_list);
                    timer_hide_list = null;
                }
            }

            // 成员列表主容器 @todo: pm_container
            this.$container
                .unbind()
                .on('mouseenter.opacity', function() {
                    if ($pm_main.is(':hidden')) {
                        return;
                    }
                    _self.setChatListOpacity(1);

                    clearTimer();
                })
                .on('mouseleave.opacity', function() {
                    if (_self.$chat_box.is(':visible') || $pm_main.is(':hidden')) {
                        return;
                    }
                    _self.setChatListOpacity(OPACITY_LIST);

                    clearTimer();
                    timer_hide_list = setTimeout(function() { // 自动收起列表
                        if ($pm_main.is(':visible')) {
                            $btn_click.trigger('click');
                        }
                    }, TIME_HIDE_USER_LIST);
                });

            // 点击用户头像打开聊天窗口
            this.$users_list
                .undelegate('click.openchat')
                .delegate('li', 'click.openchat', function() {
                    var $this = $(this),
                        $new_message = $this.find('.WBIM_icon_new'),
                        has_new = $new_message.hasClass(class_new_message),
                        user_id = $this.data('userid');

                    if (!_self.obj_messages[user_id]) { // 如果没有记录，则主动获取
                        _self.obj_messages[user_id] = { messages: [], newMessages: [] };
                        _self.flexGetUserMessages(_self.userid_myself, user_id, 0, null, null);
                        has_new = false;
                    }

                    if (has_new) { // 如果存在未读私信 @todo
                        _self.flexGetUserMessages(_self.userid_myself, user_id, 1, null, null);
                    }

                    $new_message.removeClass(class_new_message); // Remove new message icon
                    _self.showHideChatWin('show'); // Show user chat window
                    _self.setUserChatWin(_self.getUserInfo(user_id));
                });

            // 收起|展开 按钮
            $btn_click
                .unbind('click')
                .on('click', function() {
                    var is_put_away = $arrow.hasClass(class_arrow_rg); // 成员列表是否收起

                    if (is_put_away) { // 收起成员列表
                        _self.contractUserList();
                        _self.setNewMessagesNum('show'); // 判断 显示新私信提示框
                        clearTimer();
                    } else { // 展开成员列表
                        _self.expandUserList();
                        //_self.setNewMessagesNum('hide'); // 隐藏新私信提示框
                    }
                })
                .hover(function() {
                    var is_put_away = $arrow.hasClass(class_arrow_rg);

                    if (is_put_away) {
                        $arrow.addClass(class_arrow_rg_on);
                    } else {
                        $arrow.addClass(class_arrow_lf_on);
                    }
                }, function() {
                    var is_put_away = $arrow.hasClass(class_arrow_rg);

                    if (is_put_away) {
                        $arrow.removeClass(class_arrow_rg_on);
                    } else {
                        $arrow.removeClass(class_arrow_lf_on);
                    }
                });

            // 上线|隐身
            this.$online
                .unbind()
                .on('click', function() {
                    var is_online = false,
                        is_self = true;
                    _self.showOnline(is_online, is_self);
                    _self.flexSettingStat('online', is_online);
                });

            this.$offline
                .unbind()
                .on('click', function() {
                    var is_online = true,
                        is_self = true;
                    _self.showOnline(is_online, is_self);
                    _self.flexSettingStat('online', is_online);
                });

            // 接收私信|屏蔽私信
            this.$no_shield
                .unbind()
                .on('click', function() {
                    var is_all = true,
                        is_shield = true;
                    _self.flexSettingStat('shield', is_shield);
                    _self.showShield(is_shield, is_all);
                });

            this.$shield_all
                .unbind()
                .on('click', function() {
                    var is_all = true,
                        is_shield = false;
                    _self.flexSettingStat('shield', is_shield);
                    _self.showShield(is_shield, is_all);
                });
        };

        // 展开好友列表
        _proto.expandUserList = function() {
            this.$pm_main.show();
            this.$container.removeClass(class_container_hide);
            this.$chat_box.removeClass(class_chat_rg);
            this.$min_chat_box.removeClass(class_chat_rg);
            this.$btn_close_search.trigger('click.close');

            $('em', this.$btn_click)
                .removeClass(class_arrow_lf)
                .removeClass(class_arrow_lf_on)
                .addClass(class_arrow_rg);
        };

        // 缩进好友列表
        _proto.contractUserList = function() {
            this.$pm_main.hide();
            this.$container.addClass(class_container_hide);
            this.$chat_box.addClass(class_chat_rg);
            this.$min_chat_box.addClass(class_chat_rg);

            $('em', this.$btn_click)
                .removeClass(class_arrow_rg)
                .removeClass(class_arrow_rg_on)
                .addClass(class_arrow_lf);
        };

        _proto.showFoldBtn = function() {
            if (this.is_show_fold_btn) {
                $('#js-pm-fold-btn').show();
            }
        };

        // 显示在线状态
        _proto.showOnline = function(is_online, is_self) {
            is_self = !!is_self ? true : false;

            if (is_self) { // 设置自己
                if (is_online) {
                    this.$offline.hide();
                    this.$online.show();
                } else {
                    this.$online.hide();
                    this.$offline.show();
                }
            }
            //else {
            // to do something
            //}
        };

        // 显示屏蔽状态
        _proto.showShield = function(is_shield, is_all) {
            is_all = !!is_all ? true : false;

            if (is_all) { // 屏蔽所有
                if (is_shield) {
                    this.$no_shield.hide();
                    this.$shield_all.show();
                } else {
                    this.$shield_all.hide();
                    this.$no_shield.show();
                }
            } else { // 屏蔽个人
                if (is_shield) {
                    this.$btn_shield.hide();
                    this.$btn_shieldover.show();
                } else {
                    this.$btn_shieldover.hide();
                    this.$btn_shield.show();
                }
            }
        };

        // 绑定搜索相关事件
        _proto.bindSearch = function() {
            var _self = this;

            function emptySearch() {
                _self.$input_search
                    .val(_self.$input_search.data('watermark'))
                    .addClass(class_watermark);
                _self.$search_list.empty();
            }

            // 关闭搜索框按钮
            this.$btn_close_search
                .unbind('click.close')
                .on('click.close', function() {
                    _self.$search.addClass(class_hide);
                    emptySearch(); // Empty the search input
                });

            // 显示|隐藏 搜索框
            this.$btn_search
                .unbind('click.search')
                .on('click.search', function() {
                    var $search = _self.$search;

                    $search.toggleClass(class_hide);
                    if (!$search.hasClass(class_hide)) { // If you can see it
                        emptySearch();
                        //_self.$input_search.focus();
                    }
                });

            // 输入搜索用户关键词
            this.$input_search
                .unbind('keyup.search')
                .on('keyup.search', function() {
                    var timer = null,
                        val = $.trim($(this).val());

                    if (timer !== null) {
                        clearTimeout(timer);
                        timer = null;
                    }

                    timer = setTimeout(function() {
                        if (val === '') {
                            _self.$search_list.empty();
                            return;
                        }

                        var items = _self.searchUserItems(val);
                        if (!items.length) { // Search none
                            _self.$search_list.html($('#tpl_search_none').html());
                        } else {
                            _self.$search_list.html(items.join(''));
                        }
                    }, 400);
                });

            this.$input_search.st_watermark();

            // 搜索结果 列表事件
            this.$search_list
                .undelegate('click.search')
                .delegate('li', 'click.search', function() {
                    var user_id = $(this).data('userid');
                    if (!user_id) {
                        _self.debug('Not found the user id from search list.');
                        return;
                    }

                    var $item = _self.findUserItem(user_id);
                    if (!$item) {
                        _self.debug('Not found the user item from the user list.');
                        return;
                    }
                    $item.trigger('click');
                });
        };

        // 搜索用户
        _proto.searchUserItems = function(keys) {
            if (!keys || keys === '') {
                return [];
            }

            var num = 0,
                items = [],
                users_list = this.arr_users,
                len = users_list.length;

            for (var i = 0; i < len; i++) {
                var user_name = users_list[i].userName;
                if (num > MAX_SEARCH_PERSON) {
                    break;
                }

                if (user_name.indexOf(keys) >= 0) {
                    items.push(HTMLS.search_item
                        .replace(/__ID__/g, users_list[i].id)
                        .replace(/__IMG__/g, users_list[i].pic)
                        .replace(/__NAME__/g, user_name)
                    );
                    num++;
                }
            }

            return items;
        };

        // 设置聊天成员列表的透明度
        _proto.setChatListOpacity = function(opacity) {
            opacity = !!opacity ? opacity : 0;

            this.$pm_main.fadeTo('fast', opacity);
            $('.webim_list_setting', this.$pm_main).children().fadeTo('fast', opacity);
        };

        // 绑定聊天窗口事件
        _proto.bindChatWin = function() {
            var _self = this,
                $chat_box = this.$chat_box;

            // Min the chat box
            this.$btn_min_chat
                .unbind('click.min')
                .on('click.min', function() {
                    _self.showHideChatWin('hide');
                    _self.showHideMinChatWin('show');

                    if (_self.$pm_main.is(':visible')) {
                        _self.setChatListOpacity(OPACITY_LIST);
                    }
                });

            // Max the chat box
            this.$min_chat_box
                .unbind('click.max')
                .on('click.max', function() {
                    _self.showHideMinChatWin('hide');
                    _self.showHideChatWin('show');

                    if (_self.$pm_main.is(':visible')) {
                        _self.setChatListOpacity(1);
                    }
                });

            // Close the chat box
            this.$btn_close_chat
                .unbind('click.close')
                .on('click.close', function() {
                    _self.showHideChatWin('hide');
                    _self.showHideMinChatWin('hide');

                    if (_self.$pm_main.is(':visible')) {
                        _self.setChatListOpacity(OPACITY_LIST);
                        timer_hide_list = setTimeout(function() { // 自动收起列表
                            if (_self.$pm_main.is(':visible')) {
                                _self.$btn_click.trigger('click');
                            }
                        }, TIME_HIDE_USER_LIST);
                    }

                    if (_self.$new_msg_num.is(':visible')) { // 重置新消息数量
                        _self.setNewMessagesNum('show');
                    }
                });

            // Send message
            this.$btn_send
                .unbind('click.send')
                .on('click.send', function() {
                    var send_content = _self.getSendContent();

                    if (send_content === '') {
                        return;
                    }

                    var msg = {
                        content: send_content,
                        isMine: true,
                        time: _self.getDateTime()
                    };

                    var t_user_id = Number($chat_box.data('user_id'));
                    if (!t_user_id) {
                        _self.setChatTips('show', '该用户未找到或者已注销');
                        _self.debug('Not found the to user id.', 'bindChatWin');
                        return;
                    }

                    // 初始化的时候增加等待提示 (提交过快无响应的情况)
                    if (!window.widget || !window.widget.flashObj || !window.widget.flashObj.getMessageFromJS) {
                        _self.setChatTips('show', '正在与TA建立连接，稍等...');
                        setTimeout(function() {
                            _self.setChatTips('hide');
                        }, 3000);
                        return;
                    }

                    if (window.widget && window.widget.isServerDisconnect) { // 已离线
                        window.widget.socketConnect();

                        _self.setChatTips('show', '重新尝试与TA连接，稍等...');
                        setTimeout(function() {
                            _self.setChatTips('hide');
                        }, 3000);
                        return;
                    }

                    _self.debug('[Begin] Send message.');
                    _self.flexSendMessage(_self.userid_myself, t_user_id, send_content, function() {
                        _self.debug('[Callback] Send message.');
                        if (_self.$btn_shieldover.is(':visible')) { // 解除屏蔽
                            // @todo: 自动解除屏蔽
                            _self.$btn_shieldover.trigger('click');

                            _self.setChatTips('show', TXT.reset_msg);
                            setTimeout(function() {
                                _self.setChatTips('hide');
                            }, TIME_HIDE_RESET_MSG);
                        }
                        return;
                    });

                    // Show the message
                    _self.appendMessage(msg);
                    _self.addMessageCache(msg, t_user_id);
                    _self.$sendbox_area.val('').focus();
                    if (!_self.findUserItem(t_user_id)) { // 重置好友列表
                        window.widget.getUserList();
                    } else { // 置顶当前聊天的好友
                        var is_new = false;
                        _self.topTheUserItem(t_user_id, is_new);
                    }
                });

            // Send message
            this.$sendbox_area
                .unbind()
                .keyup(function(event) {
                    if (event.which === 13) {
                        _self.$btn_send.trigger('click.send');
                        return false;
                    }
                });

            $chat_box
                .undelegate('click.showhitory')
                .delegate('.' + class_show_history, 'click.showhitory', function() {
                    var $this = $(this),
                        click_num = $this.data('num');

                    click_num = click_num || 0;

                    var t_user_id = Number($chat_box.data('user_id'));
                    if (!t_user_id) {
                        _self.debug('Not found the to user id.', 'bindChatWin -> show history');
                        return;
                    }

                    var max_time = _self.getOldestMessageTime(t_user_id);
                    if (!max_time) {
                        $this.remove();
                        return;
                    }
                    _self.flexGetUserMessages(_self.userid_myself, t_user_id, 0, null, max_time);

                    click_num++;
                    $this.data('num', click_num);
                });
        };

        // 判断是否查看的是历史信息
        _proto.isShowHistory = function() {
            var is_history = false,
                $show_history = $('.' + class_show_history, this.$chat_box);

            if ($show_history.length && $show_history.data('num')) {
                is_history = true;
            }

            return is_history;
        };

        // 隐藏显示查看更多消息，并显示提示信息
        _proto.hideMoreHistory = function() {
            var _self = this;

            $('.' + class_show_history, this.$chat_box).addClass(class_hide);
            this.setChatTips('show', TXT.no_history);

            setTimeout(function() {
                _self.setChatTips('hide');

                if (typeof jQuery.fn.jScrollPane !== 'undefined') {
                    $msg_list_scroll.jScrollPane(); // 重置滚动条，防止信息列表显示不完整
                }
            }, TIME_HIDE_RESET_MSG);
        };

        // 添加数据到缓存
        _proto.addMessageCache = function(msg, t_user_id) {
            if (!t_user_id) {
                this.debug('Must be to user id.', 'addMessageCache');
                return;
            }

            if (!this.obj_messages[t_user_id]) {
                this.obj_messages[t_user_id] = { messages: [], newMessages: [] };
            }

            this.obj_messages[t_user_id].newMessages.push(msg);
        };

        // 获取发送的信息内容
        _proto.getSendContent = function() {
            var send_content = $.trim(this.$sendbox_area.val());

            return send_content
                .replace(/\n/g, '')
                .replace(/\\/g, '')
                .replace(/<\/?[^>]*>/g, '')
                .replace(/[<\>]/g, '');
        };

        // 设置聊天窗口的显示与隐藏
        _proto.showHideChatWin = function(type) {
            var $chat_box = this.$chat_box;

            type = type || 'hide';

            if (!$chat_box.length) {
                this.debug('Not found the $chat_box.', 'showHideChatWin');
                return;
            }

            switch (type) {
                case 'show':
                    $chat_box.show();
                    this.$sendbox_area.focus();
                    if (this.$users_list.is(':hidden')) {
                        $chat_box.addClass(class_chat_rg);
                    }
                    break;
                case 'hide':
                    $chat_box.hide();
                    break;
                default:
                    this.debug('Param type is error.', 'showHideChatWin');
            }
        };

        // 设置最小化聊天窗口的显示与隐藏
        _proto.showHideMinChatWin = function(type) {
            var class_min_chat = 'pm_min_chat_show',
                $min_chat_box = this.$min_chat_box;

            type = type || 'hide';

            if (!$min_chat_box.length) {
                this.debug('Not found the $min_chat_box.', 'showHideMinChatWin');
                return;
            }

            switch (type) {
                case 'show':
                    $min_chat_box.addClass(class_min_chat);
                    break;
                case 'hide':
                    $min_chat_box.removeClass(class_min_chat);
                    break;
                default:
                    this.debug('Param type is error.', 'showHideMinChatWin');
            }
        };

        // 置顶指定用户
        _proto.topTheUserItem = function(userId, isNew) {
            var $item = this.findUserItem(userId);
            if (!$item) {
                this.debug('Not the user item.', 'topTheUserItem');
                return;
            }

            if ($item.index()) {
                $item.prependTo(this.$users_list);
            }
            var is_new = typeof isNew === 'undefined' ? true : isNew;
            this.updateItemNewIcon($item, is_new);
        };

        // 更新用户私信图标状态
        _proto.updateItemNewIcon = function(seletor, isNew) {
            if (!seletor) {
                return;
            }

            var $new_icon = seletor.find('.WBIM_icon_new');
            if (isNew) {
                $new_icon.addClass(class_new_message);
            } else {
                $new_icon.removeClass(class_new_message);
            }
        };

        // 查找用户是否在列表存在
        _proto.findUserItem = function(userId) {
            var $item = $('#user_items_' + userId);

            return $item.length ? $item : 0;
        };

        // 查找私信列表最老的时间点
        _proto.getOldestMessageTime = function(userId) {
            var messages = this.obj_messages[userId];

            if (messages && messages.messages.length) {
                return messages.messages[0].oTime || null;
            }

            return null;
        };

        // 获取时间格式
        _proto.getDateTime = function(timeMillions) {
            var date = timeMillions ? new Date(parseInt(timeMillions + '000')) : new Date(),
                //year = date.getFullYear(),
                month = date.getMonth() + 1,
                day = date.getDate(),
                hours = date.getHours(),
                minutes = date.getMinutes();
            //seconds = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();

            month = month < 10 ? '0' + month : month;
            day = day < 10 ? '0' + day : day;
            hours = hours < 10 ? '0' + hours : hours;
            minutes = minutes < 10 ? '0' + minutes : minutes;

            return month + "-" + day + " " + hours + ':' + minutes;
        };

        // 设置新私信的提示：包括数量和显示隐藏
        _proto.setNewMessagesNum = function(type) {
            var $new_msg_num = this.$new_msg_num,
                class_show = 'pm_new_msg_num_show';

            type = type || 'setting';

            switch (type) {
                case 'hide':
                    $new_msg_num.removeClass(class_show);
                    break;
                case 'show':
                    var new_num = 0;
                    $.each(this.new_messages_num, function(user_id, num) {
                        new_num += num;
                    });
                    if (!new_num) {
                        this.setNewMessagesNum('hide');
                        return;
                    }
                    this.showHideMinChatWin('hide');
                    $new_msg_num.addClass(class_show);

                    $new_msg_num.find('span').html(new_num);
                    break;
                default:
                    //this.debug('Type is error, pls check it.', 'setNewMessagesNum');
            }
        };

        // 绑定新私信提示容器时间
        _proto.bindNewMessagesBox = function() {
            var _self = this,
                $new_msg_num = this.$new_msg_num;

            $new_msg_num
                .unbind('click')
                .on('click', function() {
                    if (_self.$pm_main.is(':hidden')) {
                        _self.$btn_click.trigger('click');
                    }

                    $.each($('li', _self.$users_list), function() {
                        var $this = $(this),
                            $new_message = $this.find('.WBIM_icon_new');

                        if ($new_message.length && $new_message.hasClass(class_new_message)) {
                            $this.trigger('click.openchat');
                            return false;
                        }
                    });
                });
        };

        // 设置私信容器高度自适应
        _proto.settingSelfAdaption = function() {
            var $window = $(window),
                win_h = $window.height(),
                $list = $('.pm_list', this.$container),
                header_h = $('#js-header-container').height(),
                offset_h = 145,
                cont_off_h = 5;

            header_h = header_h || 70;

            this.$container.height(win_h - header_h - cont_off_h);
            $list.height(win_h - header_h - offset_h);

            if (typeof jQuery.fn.jScrollPane !== 'undefined') {
                $list.jScrollPane();
            }
        };

        function getUserStatClass(online) {
            var stat = {};
            switch (online) {
                case 0:
                    stat.class_name = class_stat_offline;
                    stat.title = TXT.stat_offline;
                    break;
                case 1:
                    stat.class_name = class_stat_online;
                    stat.title = TXT.stat_online;
                    break;
                case 2:
                    stat.class_name = class_stat_hiding;
                    stat.title = TXT.stat_shield;
                    break;
            }
            return stat;
        }

        function msgScrollToBottom() {
            if (typeof jQuery.fn.jScrollPane === 'undefined') {
                return;
            }

            $msg_list_scroll.jScrollPane();
            if ($msg_list_scroll.data('jsp')) {
                setTimeout(function() {
                    $msg_list_scroll.data('jsp').scrollToBottom();
                }, TIME_SCROLL_TO);
            }
        }

        function msgScrollTop() {
            if (typeof jQuery.fn.jScrollPane === 'undefined') {
                return;
            }

            $msg_list_scroll.jScrollPane();
            if ($msg_list_scroll.data('jsp')) {
                setTimeout(function() {
                    $msg_list_scroll.data('jsp').scrollTo(0, 0);
                }, TIME_SCROLL_TO);
            }
        }

        function getUrlParam(name) {
            var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
            var r = window.location.search.substr(1).match(reg);
            if (r !== null) {
                return unescape(r[2]);
            }
            return null;
        }

        // 水印
        $.fn.st_watermark = typeof $.fn.st_watermark !== 'undefined' ? $.fn.st_watermark : function(options) {
            var class_name = class_watermark;

            this.each(function() {
                var $this = $(this),
                    tip = $this.data('watermark'),
                    val = $.trim($this.val());

                $this.removeClass(class_name);

                if (val === '' && tip) {
                    $this.val(tip).addClass(class_name);
                } else if (val == tip) {
                    $this.addClass(class_name);
                }

                $this.bind('blur.empty', function() {
                        var val = $.trim($this.val());
                        if (val === '' || val == tip) {
                            $this.val(tip).addClass(class_name);
                        }
                    })
                    .bind('focusin.empty', function() {
                        if (tip && $.trim($this.val()) == tip) {
                            $this.val('').removeClass(class_name);
                        }
                    });

            });

            return this;
        };

        /* --- Begin: These are test datas --- */
        // 获取用户私信全部内容
        _proto.testGetUserMessages = function(userId) {
            var messages = {
                '123456': {
                    messages: [
                        { content: '亲，给我们拍的微电影投一下票吧。', time: '2014-04-10 08:00', isMine: false }
                    ],
                    newMessages: [
                        { content: '你们不请我吃饭，我咋找临时演员呢。', time: '2014-04-11 09:01', isMine: true }
                    ]
                },
                '234567': {
                    messages: [
                        { content: '哈哈哈，你好啊。', time: '2014-04-09 07:01', isMine: false },
                        { content: '你想干啥子？', time: '2014-04-11 09:01', isMine: true }
                    ]
                }
            };

            return messages[userId] || { messages: [] };
        };

        // 获取用户新私信内容
        _proto.testGetUserNewMessages = function() {
            return [
                { content: '最新发的消息111', time: '2014-04-22 08:59', isMine: false },
                { content: '最新发的消息222', time: '2014-04-22 09:01', isMine: false }
            ];
        };

        // 收到新消息
        _proto.testReceiveNewMessage = function() {
            return { userId: '123456', count: 2, name: 'Nick name', pic: '', msg: 'Content...' };
        };
        /* --- End: These are test datas --- */

        var PM = new PrivateMessage();

        var flex_timer = null,
            flex_time_out = 3 * 60 * 1000;

        var clearFlexTimer = function() {
            if (flex_timer) {
                clearTimeout(flex_timer);
                flex_timer = null;
            }
        };
        var initFlexHeartbeat = function() {
            clearFlexTimer();

            flex_timer = setTimeout(function() {
                window.widget.heartBeatTimeout(); // 心跳
            }, flex_time_out);
        };
        /**
         ** Flex 交互 --- Begin ---
         **/
        var Widget = function() {
            var _self = this;
            // 协议代码，16进制
            this.codes = {
                heartBeat: '06', // 心跳
                getUserList: '15', // 获取用户列表
                userList: '16', // 得到的用户列表
                sendMessage: '17', // 发送私信
                isSendMsgSucc: '18', // 是否发送成功
                newMessages: '19', // 新私信到达
                getMessages: '1a', // 获取私信
                messagesList: '1b', // 得到的私信列表
                setting: '1c', // 设置
                isSettingSucc: '1d', // 是否设置成功
                showMessage: '21',
                login: '2a', // 登录
                resLogin: '2b' // 登录回调
            };
            this.isServerDisconnect = false;
            this.flashObj = $('#Client1')[0];

            this.getUserList = function() {
                PM.debug('[Begin] Get user list.');
                _self.flashObj.getMessageFromJS(
                    0, _self.codes.getUserList, JSON.stringify({ u: PM.userid_myself, p: 0, user: PM.userid_myself })
                );
            };
            this.initLogin = function() {
                PM.debug('[Begin] Init Login.');
                PM.$users_list.text('开始登录...');
                _self.flashObj.getMessageFromJS(
                    0, _self.codes.login, JSON.stringify({ user: PM.userid_myself, ti: '', mt: 0 })
                );
            };
            this.heartBeat = function() {
                var _t = new Date();
                PM.debug('[Tips] Heart beat.', _t.getHours() + ':' + _t.getMinutes() + ':' + _t.getSeconds());
                _self.flashObj.getMessageFromJS(0, _self.codes.heartBeat, JSON.stringify({ user: 0 }));
            };
            this.heartBeatTimeout = function() {
                clearFlexTimer();

                if (!this.isServerDisconnect && window.G.feeWinStatus && window.G.feeWinStatus === 'open') { // 连接状态和客户端打开的时候才保持心跳
                    this.heartBeat();
                }

                flex_timer = setTimeout(function() {
                    _self.heartBeatTimeout();
                }, flex_time_out);
            };
        };

        Widget.prototype = {
            socketConnect: function() { // 成功连接状态事件 
                this.isServerDisconnect = false;
                PM.debug('[Tips] Connect is ok...');
                this.initLogin();
            },
            socketClose: function(message) { // 连接中断事件
                this.isServerDisconnect = true;
                PM.debug('[Tips] Connect is offdown...');
            },
            socketError: function(message) { // 连接异常事件 
                this.isServerDisconnect = true;
            },
            socketData: function(message) {
                var msgHeader, msgBody, msgLenth, msgFLag, msgType, msgJSON;

                try {
                    msgHeader = message.substring(0, 7);
                    msgBody = message.substring(7);
                    msgLenth = msgHeader.substring(0, 4);
                    msgFLag = msgHeader.substring(4, 5);
                    msgType = msgHeader.substring(5, 7);
                    msgJSON = JSON.parse(msgBody);
                } catch (e) {
                    $.st_debug(e.toString(), message);
                    return;
                }

                var codes = this.codes;

                switch (msgType) {
                    case codes.resLogin:
                        if (msgJSON.t === 0) {
                            this.getUserList();
                            initFlexHeartbeat();
                        } else {
                            PM.debug('[Error] Code:', msgJSON.t);
                            PM.$users_list.text('网络不稳定，稍候重试');
                        }
                        break;
                    case codes.userList:
                        PM.debug('[Begin] Init user list.');

                        var count_new_msg = 0; // 用作计算新消息条数

                        PM.arr_users = function(list) {
                            if (!list || list === '') {
                                return [];
                            }

                            var users = [];
                            for (var i = 0, len = list.length; i < len; i++) {
                                var user_info = list[i],
                                    user_pic = user_info.o && user_info.o !== 'NULL' ? (IMG_HOST + user_info.o) : (IMG_HOST + 'images/none.png');

                                users[i] = {
                                    id: user_info.u,
                                    userName: user_info.m,
                                    pic: user_pic,
                                    online: user_info.s,
                                    isShield: user_info.i,
                                    newMessage: user_info.c
                                };

                                count_new_msg += user_info.c;

                                if (user_info.u === SYS_USER_ID) {
                                    users[i].userName = SYS_USER_NAME;
                                    users[i].pic = SYS_USER_PIC;
                                    users[i].online = 1;
                                }
                            }
                            return users;
                        }(msgJSON.l);

                        PM.initUserList();
                        PM.settingSelfAdaption();
                        PM.setNewMessagesNum('show');

                        var is_online = msgJSON.h ? false : true,
                            is_self = true;
                        PM.showOnline(is_online, is_self); // 初始化 在线|隐身 

                        var is_shield = msgJSON.sa ? true : false,
                            is_all = true;
                        PM.showShield(is_shield, is_all); // 初始化 接受私信|屏蔽私信

                        // 私信小窗口
                        if (is_first_fee_msg && count_new_msg) {
                            var $first_item = PM.$users_list.find('.' + class_new_message).eq(0);

                            if ($first_item.length) {
                                var $item = $first_item.closest('li'),
                                    $item_pic = $('.user_item_img', $item),
                                    item_userid = $item.data('userid'),
                                    pic_src = $item_pic.attr('src');

                                var fee_msg = {
                                    userId: item_userid,
                                    pic: pic_src,
                                    name: $item_pic.attr('title'),
                                    msg: msgJSON.pm || '点击查看详细...', // 最新一条私信内容
                                    count: count_new_msg
                                };

                                showFeeMessage(fee_msg);

                                $item = null;
                                $item_pic = null;
                                pic_src = null;
                                item_userid = null;
                                fee_msg = null;
                            }

                            $first_item = null;

                            is_first_fee_msg = false; // 设置判断符，刷新页面不再重复显示私信小窗口
                        }
                        break;
                    case codes.isSendMsgSucc:
                        PM.debug('已发送-状态符：' + msgJSON.t);
                        initFlexHeartbeat();
                        break;
                    case codes.newMessages:
                        PM.debug('收到新消息...');
                        initFlexHeartbeat();

                        if (!PM.findUserItem(msgJSON.f)) { // If it's new user, then reset user list.
                            this.getUserList();
                            return;
                        }

                        PM.flexReceiveNewMessage({
                            userId: msgJSON.f,
                            time: msgJSON.i,
                            count: msgJSON.c,
                            msg: msgJSON.ms,
                            pic: msgJSON.o,
                            name: msgJSON.m
                        });
                        break;
                    case codes.messagesList:
                        if (msgJSON.t !== 0) {
                            $.st_debug('res msg list is fail, pls check it.');
                            return;
                        }
                        var history_list = msgJSON.hl || [],
                            new_list = msgJSON.nl || [],
                            t_user_id = msgJSON.ut,
                            h_len = history_list.length,
                            n_len = new_list.length,
                            update_messages = (h_len || n_len) ? true : false;

                        var chat_userid = PM.getChatUserId(),
                            is_append = chat_userid && n_len && !h_len,
                            history_msg = [],
                            is_history = PM.isShowHistory();

                        for (var i = 0; i < h_len; i++) { // History messages
                            var h_msg = history_list[i],
                                msg_info = {
                                    content: h_msg.s,
                                    time: PM.getDateTime(h_msg.t),
                                    oTime: h_msg.t,
                                    isMine: h_msg.u == PM.userid_myself ? true : false
                                };

                            if (is_history) {
                                history_msg.push(msg_info);
                            } else {
                                PM.obj_messages[t_user_id].messages.push(msg_info);
                            }
                        }

                        for (var j = 0; j < n_len; j++) { // New messages
                            var n_msg = new_list[j],
                                msg = {
                                    content: n_msg.s,
                                    time: PM.getDateTime(n_msg.t),
                                    oTime: n_msg.t,
                                    isMine: n_msg.u == PM.userid_myself ? true : false
                                };

                            PM.obj_messages[t_user_id].newMessages.push(msg);
                            if (is_append) {
                                PM.appendMessage(msg);
                            }
                        }

                        try {
                            delete PM.new_messages_num[t_user_id]; // Remove the user's new messages count
                        } catch (e) {
                            PM.new_messages_num[t_user_id] = 0;
                        }

                        if (is_append) { // 只追加最新的私信
                            //PM.debug('yeah, append is ok.');
                            var is_new = false;
                            PM.updateItemNewIcon(PM.findUserItem(t_user_id), is_new);
                            return;
                        }

                        if (is_history) { // 合并历史记录，查看历史私信
                            if (!history_msg.length) {
                                PM.hideMoreHistory();
                                return;
                            }
                            PM.prependMessage(history_msg);
                            PM.obj_messages[t_user_id].messages = $.merge(history_msg, PM.obj_messages[t_user_id].messages);
                            return;
                        }

                        if (update_messages) { // 显示全部私信
                            var hide_history = t_user_id === SYS_USER_ID ? true : false;
                            PM.showUserMessages(PM.obj_messages[t_user_id], hide_history);
                        }
                        break;
                    case codes.isSettingSucc:
                        PM.debug('设置返回-状态符：' + msgJSON.t);
                        break;
                    case codes.showMessage: // 升窗信息
                        if (!msgJSON.s) {
                            return;
                        }
                        break;
                    default:
                }
            },
            feeWinStatus: 'open'
        };

        var APP = {};
        APP.pm = PM;
        APP.init = function() {
            var MAX_INIT_COUNT = 30;

            var initSWF = function(opts) {
                var swfVersionStr = "10.0.0",
                    xiSwfUrlStr = "playerProductInstall.swf",
                    flashvars = {
                        ip: chat_ip,
                        port: chat_port
                    },
                    params = {
                        quality: "high",
                        bgcolor: "#fff",
                        allowscriptaccess: "sameDomain",
                        allowfullscreen: "true"
                    },
                    attributes = {
                        id: "Client1",
                        name: "Client1",
                        align: "middle"
                    };

                window.swfobject.embedSWF(
                    WEB_HOST + "lib/client.swf", "flashContent", "1", "1",
                    swfVersionStr, xiSwfUrlStr, flashvars, params, attributes);
            };

            var count = 0;
            var initFlex = function() {
                count++;

                if (count > MAX_INIT_COUNT) { // 超过最大初始化次数
                    PM.debug('[Error] 超过最大初始化次数');
                    PM.$users_list.text('系统繁忙，稍候重试');
                    return;
                }

                if (!window.swfobject || typeof window.swfobject.embedSWF === 'undefined') {
                    setTimeout(function() {
                        initFlex();
                    }, 150);
                    return;
                }

                initSWF();
            };

            var initFlexConnect = function() {
                window.widget = new Widget();
                PM.showChatNow();
            };

            // 私信组件 初始化
            var init = function() {
                PM.init();
                initFlex();
                initFlexConnect();
                //PM.$users_list.text('稍等，初始化...');

                PM.settingSelfAdaption(); // 初始化容器高度
                PM.showFoldBtn();

                // if(isie6) { // @todo fix bug: 未知原因造成私信容器按钮初始化无法显示
                //     PM.contractUserList();
                // }

                $(window).resize(function() { // 私信好友列表自适应
                    PM.settingSelfAdaption();
                });
            };

            init();
        };

        window.G = window.G || {};
        window.G.APP_PM = APP;

        return APP;

    }));
