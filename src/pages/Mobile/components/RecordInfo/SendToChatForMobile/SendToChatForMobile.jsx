import React, { Component, Fragment } from 'react';
import { Button, Popup, Toast } from 'antd-mobile';
import { debounce } from 'lodash';
import { Radio, ScrollView, UserHead } from 'ming-ui';
import { mdNotification } from 'ming-ui/functions';
import chatAjax from 'src/api/chat';
import discussionAjax from 'src/api/discussion';
import taskCenterAjax from 'src/api/taskCenter';
import Constant from 'src/pages/chat/utils/constant';
import * as utils from 'src/pages/chat/utils/index';
import * as socket from 'src/pages/chat/utils/socket';
import { SOURCE_TYPE } from 'src/components/comment/config';
import './SendToChatForMobile.less';

const SHARE_TARGET = {
  CHAT: 'chat',
  TASK: 'task',
};

export default class SendToChatForMobile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      shareTarget: SHARE_TARGET.CHAT,
      type: 'user',
      selectDepartmentType: 'current',
      description: '',
      selectedUser: null,
      selectedTask: null,
      chatList: [],
      taskList: [],
      loading: false,
      searchValue: '',
      recentContactsList: [],
      selectUserVisible: false,
      selectTaskVisible: false,
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

  loadTask = () => {
    this.setState({ loading: true, activeIndex: null });
    const { keywords } = this.state;
    taskCenterAjax
      .getTaskList({
        page: 1,
        size: 50,
        sort: 10,
        other: '',
        filterType: 6,
        completeTime: '',
        status: 0,
        tagIDs: [],
        withoutTag: false,
        folderID: '',
        structure: 0,
        isFirst: true,
        projectId: 'all',
        keyWords: keywords,
      })
      .then(source => {
        const list = source?.status ? source?.data?.data || [] : [];
        this.setState({ loading: false, taskList: list });
      })
      .catch(() => {
        this.setState({ loading: false, taskList: [] });
      });
  };

  handleScrollEnd = () => {};

  getShareCardPayload = () => {
    const { card, url } = this.props;
    if (!card) return null;
    const { extra, title = '', text } = card;
    return {
      extra: {
        ...(extra || {}),
      },
      title,
      md: null,
      text: text || null,
      url: card.url || url,
      entityid: card.entityid || card.entityId || '',
      pic: null,
    };
  };

  handleSend = () => {
    const { shareTarget } = this.state;
    if (shareTarget === SHARE_TARGET.TASK) {
      this.handleSendToTask();
      return;
    }
    this.handleSendToChat();
  };

  handleSendToChat = () => {
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

  handleSendToTask = () => {
    const { onClose = () => {} } = this.props;
    const { selectedTask } = this.state;
    const cardPayload = this.getShareCardPayload();

    if (!selectedTask) {
      Toast.show({
        content: _l('请选择'),
      });
      return;
    }

    if (!cardPayload) {
      Toast.show({
        icon: 'fail',
        content: _l('发送失败'),
      });
      return;
    }

    const message = `[fx]${JSON.stringify(cardPayload)}[/fx]`;

    discussionAjax
      .addDiscussion({
        sourceId: selectedTask.taskID,
        sourceType: SOURCE_TYPE.TASK,
        message,
        appId: md.global.APPInfo.taskAppID,
        attachments: JSON.stringify([]),
      })
      .then(res => {
        if (res && res.code === 1) {
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
      })
      .catch(() => {
        Toast.show({
          icon: 'fail',
          content: _l('发送失败'),
        });
      });
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
          Toast.show({
            icon: 'success',
            content: _l('发送成功'),
          });
          onClose();
        },
        result => {
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

  handleShareTargetChange = value => {
    if (value === this.state.shareTarget) return;
    this.setState({
      shareTarget: value,
      selectedUser: null,
      selectedTask: null,
      selectUserVisible: false,
      selectTaskVisible: false,
      recentContactsList: [],
      taskList: [],
      keywords: '',
      activeIndex: null,
    });
  };

  handleChatSelect = account => {
    this.setState({
      selectedUser: account,
    });
    this.handleRecentContactsClose();
  };

  handleTaskSelect = task => {
    this.setState({
      selectedTask: task,
    });
    this.handleTaskListClose();
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

  handleTaskListClose = () => {
    this.setState({
      listActive: false,
      activeIndex: null,
      selectTaskVisible: false,
      taskList: [],
      keywords: '',
    });
  };

  debouncedLoadChat = debounce(this.loadChat, 300);
  debouncedLoadTask = debounce(this.loadTask, 300);

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

  renderSelectTaskPopup = () => {
    const { activeIndex, selectTaskVisible, taskList, loading, keywords } = this.state;
    return (
      <Popup
        visible={selectTaskVisible}
        className="mobileSelectUserModal mobileModal topRadius"
        onMaskClick={() => this.handleTaskListClose()}
      >
        <div className="chat-list-mobile">
          <Fragment>
            <div className="header">
              <span>{_l('我的任务')}</span>
            </div>
            <div className="chat-list-container">
              <input
                type="text"
                placeholder={_l('请输入')}
                value={keywords}
                className="search-user-input"
                onChange={val => {
                  this.setState({ keywords: val.target.value.trim() });
                  this.debouncedLoadTask();
                }}
              />
              {loading && <div className="loading">加载中...</div>}
              {!loading && !taskList.length && <div className="empty-chat">{_l('未找到相关任务')}</div>}
              {!loading && !!taskList.length && (
                <ScrollView className="chat-items" ref={this.scrollViewRef} onScrollEnd={this.handleScrollEnd}>
                  {taskList.map((task, index) => (
                    <div
                      key={task.taskID}
                      className={`chat-item ${index === activeIndex ? 'active' : ''}`}
                      onClick={() => this.handleTaskSelect(task)}
                    >
                      <div className="user-name ellipsis" title={task.taskName}>
                        {task.taskName}
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

  renderShareTargetRadio = () => {
    const { shareTarget } = this.state;
    return (
      <div className="mobile-send-to-chat-target">
        <Radio
          text={_l('聊天')}
          checked={shareTarget === SHARE_TARGET.CHAT}
          onClick={() => this.handleShareTargetChange(SHARE_TARGET.CHAT)}
        />
        <Radio
          text={_l('任务通')}
          checked={shareTarget === SHARE_TARGET.TASK}
          onClick={() => this.handleShareTargetChange(SHARE_TARGET.TASK)}
        />
      </div>
    );
  };

  renderSelectArea = () => {
    const { shareTarget, selectedUser, selectedTask, selectUserVisible, selectTaskVisible } = this.state;
    const isChat = shareTarget === SHARE_TARGET.CHAT;
    const selectedName = isChat ? selectedUser?.name : selectedTask?.taskName;
    const placeholder = _l('请选择');
    const focused = isChat ? selectUserVisible : selectTaskVisible;

    return (
      <div className="selected-user" style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder={selectedName || placeholder}
          value={selectedName || ''}
          readOnly
          className="selected-user-input"
          style={{ border: `1px solid ${focused ? '#1677ff' : '#ddd'}` }}
        />
        <div className="selected-user-btn">
          <i
            className="icon-add addIcon selected-user-btn-icon"
            onClick={() => {
              if (isChat) {
                this.debouncedLoadChat();
                this.setState({ selectUserVisible: true });
              } else {
                this.debouncedLoadTask();
                this.setState({ selectTaskVisible: true });
              }
            }}
          ></i>
        </div>
      </div>
    );
  };

  render() {
    const { onClose = () => {}, sendChatMobileVisible } = this.props;
    const { shareTarget, selectedUser, selectedTask, selectUserVisible, selectTaskVisible } = this.state;
    const canSend = shareTarget === SHARE_TARGET.CHAT ? !!selectedUser : !!selectedTask;

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
            {this.renderShareTargetRadio()}
            <div className="mobile-send-to-chat-info">{this.renderSelectArea()}</div>

            <Button
              style={{
                width: '100%',
                height: '40px',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                marginTop: '10px',
              }}
              className={`send-btn-${canSend ? 'enable' : 'disable'}`}
              disabled={!canSend}
              onClick={this.handleSend}
            >
              {_l('发送')}
            </Button>
            {selectUserVisible && this.renderSelectUerPopup()}
            {selectTaskVisible && this.renderSelectTaskPopup()}
          </div>
        </Fragment>
      </Popup>
    );
  }
}
