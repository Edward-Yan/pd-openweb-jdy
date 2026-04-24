import React, { Component, Fragment } from 'react';
import { ActionSheet, Button, Form, Input, List, Popup, TextArea, Toast } from 'antd-mobile';
import { debounce } from 'lodash';
import { ScrollView, UserHead } from 'ming-ui';
import { mdNotification } from 'ming-ui/functions';
import chatAjax from 'src/api/chat';
import Constant from 'src/pages/chat/utils/constant';
import * as utils from 'src/pages/chat/utils/index';
import * as socket from 'src/pages/chat/utils/socket';
import './SendToChatForMobile.less';

export default class SendToChatForMobile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      type: 'user',
      selectDepartmentType: 'current', // current: 仅当前部门， all: 选择当前部门下所有子部门
      description: '',
      selectedUser: null,
      chatList: [],
      loading: false,
      searchValue: '',
      recentContactsList: [], // 最近所有人列表
      selectUserVisible: false, //选择用户
      listActive: false,
      activeIndex: null,
      keywords: '',
    };
    this.scrollViewRef = React.createRef();
    this.descriptionRef = React.createRef();
  }

  componentDidMount() {}

  loadChat = () => {
    this.setState({ loading: true, activeIndex: null });
    const { keywords } = this.state;
    chatAjax
      .getChatList({
        keywords,
        size: 50,
      })
      .then(data => {
        this.setState({ loading: false, recentContactsList: data });
      });
  };
  handleScrollEnd = () => {};

  handleSend = () => {
    const { card, url, onClose = () => {} } = this.props;
    const { selectedUser, description } = this.state;

    if (!selectedUser) {
      Toast.show({
        content: _l('请选择接收人'),
      });
      return;
    }
    const isRecordCard = !card?.text || card?.text === Constant.CARD_SHARE_ENUM.RECORD ? true : false;
    if (isRecordCard) {
      const cardData = card ? { ...card, url: card.url || url } : null;

      chatAjax
        .sendCardToChat({
          cards: cardData ? [cardData] : [],
          message: description,
          [selectedUser?.type === 1 ? 'toAccountId' : 'toGroupId']: selectedUser.value,
        })
        .then(data => {
          if (data) {
            onClose();
            Toast.show({
              icon: 'success',
              content: _l('发送成功'),
            });
          } else {
            Toast.show({
              icon: 'fail',
              content: _l('发送失败'),
            });
          }
        });
    } else {
      this.handleShareBySocket(card);
    }
  };

  handleShareBySocket = shareData => {
    if (window.config.SocketPolling && !IM.socket.connected) {
      return;
    }
    const { onClose = () => {} } = this.props;
    if (IM.socket.connected) {
      const { selectedUser } = this.state;
      const { msg = '', extra, title = '', url, text } = shareData;
      const sendMsg = {
        type: 5,
        msg,
        waitingid: utils.getUUID(),
        [selectedUser?.type === 1 ? 'touser' : 'togroup']: selectedUser.value,
        card: {
          extra: {
            ...extra,
          },
          title,
          md: null,
          text,
          url,
          entityid: '',
          pic: null,
        },
      };
      if (!selectedUser?.type) return;
      socket.Message.send(selectedUser.type, Object.assign({}, sendMsg)).then(
        result => {
          // console.log('socket send message success1111', result);
          Toast.show({
            icon: 'success',
            content: _l('发送成功'),
          });
          onClose();
        },
        result => {
          // console.log('socket send message success2222', result);
          // const { error } = result;
          // if (error === 'not my contract') {
          // }
          Toast.show({
            icon: 'fail',
            content: _l('发送失败'),
          });
          onClose();
        },
      );
    } else {
      mdNotification.error({
        title: _l('连接失败，请重新刷新页面'),
        key: 'connectedError',
        duration: null,
        btnList: [
          {
            text: _l('刷新'),
            onClick: () => {
              location.reload();
            },
          },
        ],
      });
      alert(_l('无法发送分享，请刷新页面重新连接'), 2);
    }
  };

  // 处理聊天列表选择
  handleChatSelect = account => {
    this.setState({
      selectedUser: account,
    });
    this.handleRecentContactsClose();
  };

  handleRecentContactsClose = () => {
    this.setState({
      listActive: false,
      activeIndex: null,
      selectUserVisible: false,
      recentContactsList: [],
      keywords: '',
    });
  };

  // 搜索聊天
  debouncedLoadChat = debounce(this.loadChat, 300);

  renderSelectUerPopup = () => {
    const { activeIndex, selectUserVisible, recentContactsList, loading, keywords } = this.state;
    return (
      <Popup
        visible={selectUserVisible}
        className="mobileSelectUserModal mobileModal topRadius"
        onMaskClick={() => this.handleRecentContactsClose()}
      >
        <div className="chat-list-mobile">
          <Fragment>
            <div className="header">
              <span>{_l('最近聊天')}</span>
            </div>
            <div className="chat-list-container">
              <input
                type="text"
                placeholder={_l('请输入')}
                value={keywords}
                className="search-user-input"
                onChange={val => {
                  this.setState({ keywords: val.target.value.trim() });
                  this.debouncedLoadChat();
                }}
              />
              {loading && <div className="loading">加载中...</div>}
              {!loading && !recentContactsList.length && (
                <div className="empty-chat">{_l('未找到相关的人员或群聊')}</div>
              )}
              {!loading && !!recentContactsList.length && (
                <ScrollView className="chat-items" ref={this.scrollViewRef} onScrollEnd={this.handleScrollEnd}>
                  {recentContactsList.map((account, index) => (
                    <div
                      key={account.value}
                      className={`chat-item ${index === activeIndex ? 'active' : ''}`}
                      onClick={() => this.handleChatSelect(account)}
                    >
                      <UserHead
                        className="user-head mRight10"
                        user={{
                          userHead: account.logo,
                          accountId: account.value,
                        }}
                        size={26}
                      />
                      <div className="user-name ellipsis" title={account.name}>
                        {account.name}
                      </div>
                    </div>
                  ))}
                </ScrollView>
              )}
            </div>
          </Fragment>
        </div>
      </Popup>
    );
  };

  render() {
    const { onClose = () => {}, sendChatMobileVisible, card } = this.props;
    const { selectedUser, description, selectUserVisible } = this.state;
    const isRecordCard = !card?.text || card?.text === Constant.CARD_SHARE_ENUM.RECORD ? true : false;
    return (
      <Popup
        forceRender
        className="actionSheetModal mobileModal topRadius"
        visible={sendChatMobileVisible}
        onClose={onClose}
        onMaskClick={onClose}
      >
        <Fragment>
          <div className="mobile-send-to-chat">
            <h3 className="mobile-send-to-chat-title">{_l('分享到')}</h3>
            <div className="mobile-send-to-chat-info">
              <div className="selected-user" style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={selectedUser ? selectedUser.name : _l('请选择')}
                  value={selectedUser ? selectedUser.name : ''}
                  readOnly
                  className="selected-user-input"
                  style={{ border: `1px solid ${selectUserVisible ? '#1677ff' : '#ddd'}` }}
                />
                <div className="selected-user-btn">
                  <i
                    className="icon-add addIcon selected-user-btn-icon"
                    onClick={() => {
                      this.debouncedLoadChat();
                      this.setState({ selectUserVisible: true });
                    }}
                  ></i>
                </div>
              </div>
              {isRecordCard && (
                <TextArea
                  className="desc-textarea"
                  placeholder="请添加说明内容"
                  showCount
                  maxLength={500}
                  value={description}
                  rows={3}
                  clearable
                  onChange={val => this.setState({ description: val })}
                />
              )}
            </div>

            <Button
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: selectedUser ? '#1677ff' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                marginTop: '10px',
              }}
              disabled={!selectedUser}
              onClick={this.handleSend}
            >
              {_l('发送')}
            </Button>
            {selectUserVisible && this.renderSelectUerPopup()}
          </div>
        </Fragment>
      </Popup>
    );
  }
}
