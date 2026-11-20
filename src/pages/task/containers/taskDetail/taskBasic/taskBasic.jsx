import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import { Dropdown, UserHead } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import RichText from 'ming-ui/components/RichText';
import Textarea from 'ming-ui/components/Textarea';
import { dialogSelectUser, quickSelectUser } from 'ming-ui/functions';
import UploadFiles from 'src/components/UploadFiles';
import UploadFilesTrigger from 'src/components/UploadFilesTrigger';
import { navigateTo } from 'src/router/navigateTo';
import taskCenterApi from 'src/api/taskCenter';
import { htmlDecodeReg } from 'src/utils/common';
import config, { OPEN_TYPE, RELATION_TYPES } from '../../../config/config';
import {
  addTaskAttachments,
  addTaskTag,
  agreeApplyJoinTask,
  deleteAttachmentData,
  refuseJoinTask,
  removeTasksTag,
  updateTaskCharge,
  updateTaskMemberStar,
  updateTaskName,
  updateTaskStageId,
  updateTaskSummary,
} from '../../../redux/actions';
import {
  afterUpdateTaskCharge,
  afterUpdateTaskName,
  afterUpdateTaskStage,
  afterUpdateTaskStar,
  joinProjectPrompt,
} from '../../../utils/taskComm';
import { checkIsProject } from '../../../utils/utils';
import SelectTag from '../SelectTag';
import './taskBasic.less';

const FROM_TYPE = {
  1: {
    icon: 'icon-bellSchedule',
    text: _l('日程转为的任务'),
  },
  2: {
    icon: 'icon-mingdao',
    text: _l('动态转为的任务'),
  },
  3: {
    icon: 'icon-worksheet',
    text: _l('工作表记录转为的任务'),
  },
};

class TaskBasic extends Component {
  constructor(props) {
    super(props);
    this.state = {
      taskName: props.taskDetails[props.taskId].data.taskName,
      showTags: props.taskDetails[props.taskId].data.tags.length > 0,
      showAttachment: false,
      isComplete: false,
      disabled: false,
      isEditing: false,
      attachmentData: [],
      kcAttachmentData: [],
      desktopMembers: [],
      desktopViewers: [],
    };
  }

  /**
   * 获取桌面端任务详情（members 负责人 / viewers 参与者）
   */
  fetchDesktopDetail = taskId => {
    taskCenterApi
      .getDesktopTaskDetail(taskId)
      .then(res => {
        if (res && res.success && this.props.taskId === taskId) {
          const detail = res.data || {};
          this.setState({
            desktopMembers: Array.isArray(detail.members) ? detail.members : [],
            desktopViewers: Array.isArray(detail.viewers) ? detail.viewers : [],
          });
        }
      })
      .catch(() => {});
  };

  componentDidMount() {
    this.fetchDesktopDetail(this.props.taskId);
  }

  /**
   * 打开详情
   */

  componentDidUpdate(prevProps) {
    if (prevProps !== this.props) {
      const { data } = this.props.taskDetails[this.props.taskId];

      if (this.props.taskId !== prevProps.taskId) {
        this.fetchDesktopDetail(this.props.taskId);
      }

      if (data.taskName !== this.state.taskName) {
        this.setState({
          taskName: data.taskName,
        });
      }

      if (this.props.taskId !== prevProps.taskId) {
        this.setState({
          showTags: data.tags.length > 0,
          showAttachment: false,
          isComplete: false,
          disabled: false,
          isEditing: false,
          attachmentData: [],
          kcAttachmentData: [],
        });
      }

      if (this.props.addTags) {
        this.setState({
          showTags: true,
        });
      }
    }
  }

  /**
   * 打开详情
   */
  openDetail(type, id) {
    if (type === 1) {
      navigateTo('/apps/calendar/detail_' + id); // 日程
    } else if (type === 2) {
      navigateTo('/feeddetail?itemID=' + id); // 动态
    } else if (type === 3) {
      const arr = id.split('|');

      // 工作表
      if (arr.length === 2) {
        // 老数据
        navigateTo(`/worksheet/${arr[0]}/row/${arr[1]}`);
      } else if (arr.length === 4) {
        // 视图id不存在的情况
        if (!arr[2]) {
          navigateTo(`/worksheet/${arr[1]}/row/${arr[3]}`);
        } else {
          navigateTo(`/app/${arr[0]}/${arr[1]}/${arr[2]}/row/${arr[3]}`);
        }
      }
    }
  }

  /**
   * 渲染项目信息
   */
  renderFolder() {
    const { taskId } = this.props;
    const { data } = this.props.taskDetails[taskId];
    const hasAuth = data.auth === config.auth.Charger || data.auth === config.auth.Member;
    const stages = (data.stages || []).map(item => {
      return {
        text: htmlDecodeReg(item.name),
        value: item.id,
      };
    });

    return (
      <div className="flexRow mTop15 detailFolder">
        {!data.folderID ? (
          <Fragment>
            <div
              className={cx('taskNullFolder', { 'pointer colorPrimary borderColorPrimary': hasAuth })}
              onClick={() => hasAuth && this.props.showRelationControl(RELATION_TYPES.folder)}
            >
              {_l('关联项目')}
            </div>
            <div className="overflow_ellipsis mLeft20 flex detailFolderName">{data.projectName || _l('个人')}</div>
          </Fragment>
        ) : (
          <Fragment>
            <Tooltip
              title={_l(
                '所属组织：%0',
                (this.props.taskDetails[this.props.taskId] || { data: {} }).data.projectName || _l('个人'),
              )}
            >
              <div
                className="taskDeatilFolderName pointer colorPrimary overflow_ellipsis"
                onClick={() => this.openFolder(data.folderID, data.folderCanLook)}
              >
                {htmlDecodeReg(data.folderName)}
              </div>
            </Tooltip>
            <div className="taskDeatilFolderStage">
              <Dropdown
                className={cx('mLeft15', { bgColorPrimary: hasAuth && !data.parentID })}
                data={stages}
                value={data.stageID}
                onChange={this.switchTaskStage}
                disabled={!hasAuth || !!data.parentID}
              />
            </div>
            <div className="flex" />
            {!(data.ancestors || []).length && (
              <Tooltip title={_l('重新关联项目')}>
                <span
                  className="folderBtn colorPrimary pointer"
                  onClick={() => this.props.showRelationControl(RELATION_TYPES.folder)}
                >
                  <i className="icon-edit" />
                </span>
              </Tooltip>
            )}
          </Fragment>
        )}
      </div>
    );
  }

  /**
   * 打开项目
   */
  openFolder(folderId, folderCanLook) {
    if (folderCanLook) {
      if (folderId === this.props.taskConfig.folderId) {
        return;
      }

      if (this.props.openType !== OPEN_TYPE.slide) {
        this.props.closeCallback();
      }

      navigateTo('/apps/task/folder_' + folderId);
    } else {
      joinProjectPrompt(folderId); // 申请加入项目
    }
  }

  /**
   * 更改阶段
   */
  switchTaskStage = stageId => {
    const { taskId, openType } = this.props;
    const { data } = this.props.taskDetails[taskId];
    const stageName = _.find(data.stages, item => item.id === stageId).name;

    const callback = data => {
      if (openType === OPEN_TYPE.slide) {
        afterUpdateTaskStage(stageId, taskId, data);
      }
    };

    this.props.dispatch(updateTaskStageId(taskId, stageId, stageName, callback));
  };

  /**
   * 渲染母任务列表
   */
  renderParentItem(item, i, showBtn) {
    return (
      <li key={i} className="flexRow">
        <div
          className="Font16 overflow_ellipsis colorPrimary borderColorPrimary pointer"
          onClick={() => this.props.switchTaskDetail(item.taskID)}
        >
          {item.taskName}
        </div>
        <div className="flex" />
        {showBtn && (
          <Fragment>
            <Tooltip title={_l('取消关联任务')}>
              <span
                className="parentBtn colorPrimary pointer"
                onClick={() => this.props.relationOnSubmit('', RELATION_TYPES.task)}
              >
                <i className="icon-delete" />
              </span>
            </Tooltip>
            <Tooltip title={_l('重新关联母任务')}>
              <span
                className="parentBtn colorPrimary pointer"
                onClick={() => this.props.showRelationControl(RELATION_TYPES.task)}
              >
                <i className="icon-edit" />
              </span>
            </Tooltip>
          </Fragment>
        )}
      </li>
    );
  }

  /**
   * 更改负责人之后回调处理列表
   */
  afterUpdateTaskCharge(avatar, accountId) {
    const { taskId, openType } = this.props;

    if (openType === OPEN_TYPE.slide) {
      afterUpdateTaskCharge(taskId, avatar, accountId);
    } else {
      this.props.updateCallback({ type: 'UPDATE_CHARGE', user: { accountId, avatar } });
    }
  }

  /**
   * 点击切换负责人
   */
  clickChargeAvatar(evt) {
    const { taskId } = this.props;
    const { data } = this.props.taskDetails[taskId];

    const callback = users => {
      const user = users[0];
      this.props.dispatch(
        updateTaskCharge(taskId, user, '', () => {
          this.afterUpdateTaskCharge(user.avatar, user.accountId);
          this.fetchDesktopDetail(taskId);
        }),
      );
    };

    quickSelectUser(evt.target, {
      sourceId: taskId,
      projectId: data.projectID,
      fromType: 2,
      selectedAccountIds: [data.charge.accountID],
      showMoreInvite: false,
      includeUndefinedAndMySelf: true,
      SelectUserSettings: {
        selectedAccountIds: [data.charge.accountID],
        projectId: checkIsProject(data.projectID) ? data.projectID : '',
        callback,
      },
      selectCb: callback,
    });
  }

  /**
   * 负责人 opHtml
   */
  renderChargeOpHtml() {
    const { taskId } = this.props;
    const { data } = this.props.taskDetails[taskId];

    return (
      <span
        className="textTertiary hoverColorPrimary pointer w100 oaButton updateTaskCharge"
        onClick={() => {
          dialogSelectUser({
            sourceId: taskId,
            title: _l('选择指派人'),
            showMoreInvite: false,
            fromType: 2,
            SelectUserSettings: {
              includeUndefinedAndMySelf: true,
              selectedAccountIds: [data.charge.accountID],
              projectId: checkIsProject(data.projectID) ? data.projectID : '',
              unique: true,
              callback: users => {
                const user = users[0];
                this.afterUpdateTaskCharge(user.avatar, user.accountId);
                this.props.dispatch(
                  updateTaskCharge(taskId, user, '', () => this.fetchDesktopDetail(taskId)),
                );
              },
            },
          });
        }}
      >
        {_l('更改指派人')}
      </span>
    );
  }

  /**
   * 回车失去焦点
   */
  updateTaskNameKeyDown = evt => {
    if (evt.keyCode === 13) {
      evt.currentTarget.blur();
      evt.preventDefault();
    }
  };

  /**
   * 更改任务名称
   */
  updateTaskName = () => {
    const { taskId } = this.props;
    const { data } = this.props.taskDetails[taskId];
    const taskName = _.trim(this.state.taskName);

    const callback = () => {
      if (this.props.openType === OPEN_TYPE.slide) {
        afterUpdateTaskName(taskId, taskName);
      } else {
        this.props.updateCallback({ type: 'UPDATE_NAME', taskName });
      }
    };

    if (taskName === data.taskName) {
      return;
    }

    if (taskName) {
      this.props.dispatch(updateTaskName(taskId, taskName, '', callback));
    } else {
      this.setState({ taskName: data.taskName });
    }
  };

  /**
   * 更改任务星标
   */
  updateTaskMemberStar = () => {
    const { taskId } = this.props;
    const { data } = this.props.taskDetails[taskId];
    const star = !data.star;

    const callback = () => {
      afterUpdateTaskStar(taskId, star);
    };

    this.props.dispatch(updateTaskMemberStar(taskId, star, callback));
  };

  /**
   * 桌面端成员item（负责人/参与者）: { accountId, avatar, fullName, status, member_type, apply_type }
   */
  renderDesktopMemberItem(item, i, hasAuth) {
    if (!item.accountId || item.status === 2) {
      return null;
    }

    const account = {
      accountID: item.accountId,
      accountId: item.accountId,
      avatar: item.avatar,
      fullname: item.fullName,
    };

    return (
      <span key={i} className="membersListItem">
        <UserHead
          className={cx({ gray: item.status && item.status !== 1 })}
          user={{
            userHead: item.avatar,
            accountId: item.accountId,
          }}
          size={26}
          secretType={1}
          operation={
            hasAuth || item.accountId === md.global.Account.accountId
              ? this.renderMemberOpHtml(account, hasAuth)
              : null
          }
        />
      </span>
    );
  }

  /**
   * 任务成员item
   */
  renderMemberItem(item, i, hasAuth) {
    if (item.type !== 0 || item.status === 2) {
      return null;
    }

    return (
      <span key={i} className="membersListItem">
        {item.status === 1 && <span className="maskApplyMemberBg" />}
        <UserHead
          className={cx({ gray: item.account.status !== 1 })}
          user={{
            userHead: item.account.avatar,
            accountId: item.account.accountID,
          }}
          size={26}
          secretType={1}
          operation={
            hasAuth || item.account.accountID === md.global.Account.accountId
              ? this.renderMemberOpHtml(item.account, hasAuth, item.status === 1)
              : null
          }
        />
      </span>
    );
  }

  /**
   * 成员 opHtml
   */
  renderMemberOpHtml(account, hasAuth, isApply) {
    // 无权限经过我自己
    if (!hasAuth && md.global.Account.accountId === account.accountId) {
      return (
        <span
          className="textTertiary hoverColorPrimary pointer w100 oaButton removeTaskMember"
          onClick={() => this.clickMemberFn('removeTaskMember', account)}
        >
          {_l('退出任务')}
        </span>
      );
    }

    // 申请
    if (isApply) {
      return (
        <Fragment>
          <span
            className="textTertiary hoverColorPrimary pointer oaButton addMemberAgree"
            onClick={() => this.clickMemberFn('addMemberAgree', account)}
          >
            {_l('同意')}
          </span>
          <span
            className="textTertiary hoverColorPrimary pointer oaButton addMemberRefuse"
            onClick={() => this.clickMemberFn('addMemberRefuse', account)}
          >
            {_l('拒绝')}
          </span>
        </Fragment>
      );
    }

    return (
      <Fragment>
        <span
          className="textTertiary hoverColorPrimary pointer oaButton updateTaskCharge"
          onClick={() => this.clickMemberFn('updateTaskCharge', account)}
        >
          {_l('设为指派人')}
        </span>
        <span
          className="textTertiary hoverColorPrimary pointer oaButton removeTaskMember"
          onClick={() => this.clickMemberFn('removeTaskMember', account)}
        >
          {md.global.Account.accountId === account.accountId ? _l('退出任务') : _l('移出任务')}
        </span>
      </Fragment>
    );
  }

  /**
   * 成员 op操作
   */
  clickMemberFn = (clickOp, account) => {
    const { taskId, removeTaskMember } = this.props;
    const user = {
      accountId: account.accountID,
      avatar: account.avatar,
      fullName: account.fullname,
    };

    switch (clickOp) {
      // 设为指派人
      case 'updateTaskCharge':
        this.props.dispatch(
          updateTaskCharge(taskId, user, '', () => {
            this.afterUpdateTaskCharge(user.avatar, user.accountId);
            this.fetchDesktopDetail(taskId);
          }),
        );
        return;
      // 移出成员
      case 'removeTaskMember':
        // 移除接口成功后再本地同步移除
        removeTaskMember(user.accountId, () => {
          this.setState(state => ({
            desktopMembers: state.desktopMembers.filter(item => item.accountId !== user.accountId),
            desktopViewers: state.desktopViewers.filter(item => item.accountId !== user.accountId),
          }));
        });
        return;
      // 同意
      case 'addMemberAgree':
        this.props.dispatch(agreeApplyJoinTask(taskId, user.accountId));
        return;
      // 拒绝
      case 'addMemberRefuse':
        this.props.dispatch(refuseJoinTask(taskId, user.accountId));
        return;
      default:
        return;
    }
  };

  /**
   * 添加桌面端成员（type: 1负责人 2参与者）
   */
  addDesktopMembers = type => evt => {
    const { taskId } = this.props;
    const { data } = this.props.taskDetails[taskId];
    const list = type === 1 ? this.state.desktopMembers : this.state.desktopViewers;
    const existsIds = list.filter(item => item.accountId).map(item => item.accountId);

    // 回调
    const callback = (users, callbackInviteResult) => {
      const accountIds = _.uniq(
        users.map(item => (_.isFunction(callbackInviteResult) ? item.account : item.accountId)).filter(Boolean),
      ).join(',');

      if (!accountIds) {
        return;
      }

      taskCenterApi
        .webAddMembersToTask({
          task_id: taskId,
          account_ids: accountIds,
          project_id: data.projectID || '',
          type,
        })
        .then(res => {
          if (res && res.success) {
            this.fetchDesktopDetail(taskId);
          } else {
            alert(_l('添加失败'), 2);
          }
        })
        .catch(() => {});
    };

    quickSelectUser(evt.target, {
      sourceId: taskId,
      projectId: data.projectID,
      fromType: 2,
      filterAccountIds: [data.charge.accountID, 'user-undefined'],
      selectedAccountIds: existsIds,
      includeUndefinedAndMySelf: true,
      SelectUserSettings: {
        filterAccountIds: [data.charge.accountID, 'user-undefined'],
        selectedAccountIds: existsIds,
        projectId: checkIsProject(data.projectID) ? data.projectID : '',
        callback,
      },
      selectCb: callback,
    });
  };

  /**
   * 取消上传附件
   */
  cancelAttachment = () => {
    this.setState({
      disabled: false,
      attachmentData: [],
      kcAttachmentData: [],
    });
  };

  /**
   * 添加附件
   */
  addTaskAttachments = () => {
    const { taskId } = this.props;
    const { isComplete, disabled, attachmentData, kcAttachmentData } = this.state;

    // 附件是否上传完成
    if (!isComplete) {
      alert(_l('文件上传中，请稍等'), 3);
      return;
    }

    if (disabled) {
      return;
    }

    this.props.dispatch(addTaskAttachments(taskId, attachmentData, kcAttachmentData, this.cancelAttachment));
    this.setState({ disabled: true });
  };

  /**
   * 删除附件
   */
  deleteAttachmentData = data => {
    const { taskId } = this.props;
    this.props.dispatch(deleteAttachmentData(taskId, data));
  };

  /**
   * 编辑描述
   */
  updateTaskSummary = summary => {
    const { taskId } = this.props;
    const { data } = this.props.taskDetails[taskId];

    if (data.summary !== summary) {
      this.props.dispatch(updateTaskSummary(taskId, summary));
    }
  };

  render() {
    const { taskName, showTags, attachmentData, kcAttachmentData, isEditing, desktopMembers, desktopViewers } = this.state;
    const { taskId, addTags, closeAddTags } = this.props;
    const { data } = this.props.taskDetails[taskId];
    const hasAuth = data.auth === config.auth.Charger || data.auth === config.auth.Member;

    return (
      <Fragment>
        {data.sourceId && (
          <div className="fromWhere flexRow">
            <i className={cx('mRight10 Font16', FROM_TYPE[data.sourceType].icon)} />
            <span className="colorPrimary pointer" onClick={() => this.openDetail(data.sourceType, data.sourceId)}>
              {FROM_TYPE[data.sourceType].text}
            </span>
          </div>
        )}
        <div className="taskContentBox taskContentBasicBox">
          {this.renderFolder()}
          <ul className="parentTaskList">
            {(data.ancestors || []).map((item, i) =>
              this.renderParentItem(item, i, hasAuth && i === data.ancestors.length - 1),
            )}
          </ul>
          <div className="flexRow mTop15">
            <Tooltip title={_l('指派人')}>
              <span className="chargeAvatar" onClick={evt => hasAuth && this.clickChargeAvatar(evt)}>
                <UserHead
                  className={cx({ gray: data.charge.status !== 1 }, { opacity6: data.status })}
                  user={{
                    userHead: data.charge.avatar,
                    accountId: data.charge.accountID,
                  }}
                  size={32}
                  operation={hasAuth ? this.renderChargeOpHtml() : null}
                />
              </span>
            </Tooltip>
            <Textarea
              disabled={!hasAuth}
              className="flex detailTaskName"
              minHeight={24}
              maxLength={100}
              value={taskName}
              spellCheck={false}
              onChange={value => this.setState({ taskName: value.replace(/[\r\n]/, '') })}
              onKeyDown={this.updateTaskNameKeyDown}
              onBlur={this.updateTaskName}
            />
            <Tooltip title={data.star ? _l('移除星标') : _l('添加星标')}>
              <span className="detailStar" onClick={this.updateTaskMemberStar}>
                <i className={data.star ? 'icon-task-star' : 'icon-star-hollow'} />
              </span>
            </Tooltip>
          </div>
          <div className="taskContentBoxBG mTop10">
            <div className="detailSummary">
              <i
                className="icon-edit taskContentIcon Hand"
                onClick={() => {
                  hasAuth && this.setState({ isEditing: true });
                }}
              />
              {!isEditing ? (
                <RichText
                  id={taskId}
                  className="taskDetailEdit"
                  dropdownPanelPosition={{ right: 'initial' }}
                  data={data.summary}
                  disabled={true}
                  minHeight={40}
                  maxHeight={500}
                  placeholder={hasAuth ? _l('添加描述') : _l('未添加描述')}
                  onClickNull={() => {
                    if (hasAuth) {
                      this.cacheSummary = data.summary || '';
                      this.setState({ isEditing: true });
                    }
                  }}
                />
              ) : (
                <div className="flexColumn">
                  <RichText
                    id={taskId}
                    maxWidth={550}
                    data={data.summary || ''}
                    onActualSave={summary => (this.cacheSummary = summary)}
                    className={cx('taskDetailEdit appIntroDescriptionEditor')}
                    maxHeight={500}
                    dropdownPanelPosition={{ right: 'initial' }}
                  />
                  <div className="flexRow taskDetailEditBtn alignItemsCenter">
                    <div className="flex" />
                    <span
                      className="textTertiary hoverColorPrimary mRight24"
                      onClick={() => this.setState({ isEditing: false })}
                    >
                      {_l('取消')}
                    </span>
                    <span
                      className="mRight16 taskDetailEditBtnSave bgColorPrimary hoverBgColorPrimaryDark"
                      onClick={() => {
                        this.updateTaskSummary(this.cacheSummary);
                        this.setState({ isEditing: false });
                      }}
                    >
                      {_l('保存')}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="detailAtts">
              <i className="icon-ic_attachment_black taskContentIcon" />
              <div>
                {!hasAuth && !data.attachments.length && <span className="detailAttsNull">{_l('无上传附件')}</span>}
                {hasAuth && (
                  <UploadFilesTrigger
                    canAddLink
                    minWidth={130}
                    onUploadComplete={isComplete => this.setState({ isComplete })}
                    temporaryData={attachmentData}
                    kcAttachmentData={kcAttachmentData}
                    onTemporaryDataUpdate={res => this.setState({ attachmentData: res })}
                    onKcAttachmentDataUpdate={res => this.setState({ kcAttachmentData: res })}
                    getPopupContainer={() => document.querySelector('.taskDetailContent .scroll-viewport')}
                    onCancel={this.cancelAttachment}
                    onOk={this.addTaskAttachments}
                  >
                    <span className="detailAttsBtn colorPrimary">{_l('添加附件')}</span>
                  </UploadFilesTrigger>
                )}

                <UploadFiles
                  isUpload={false}
                  isDeleteFile={hasAuth}
                  showAttInfo={false}
                  attachmentData={data.attachments}
                  onDeleteAttachmentData={this.deleteAttachmentData}
                />
              </div>
            </div>
            <div className={cx('detailTaskLable', { Hidden: !showTags })}>
              <i className="icon-task-label taskContentIcon" />
              <SelectTag
                focus={addTags}
                defaultValue={data.tags}
                taskID={taskId}
                addTaskTag={addTaskTag}
                removeTasksTag={removeTasksTag}
                dispatch={this.props.dispatch}
                closeAddTags={closeAddTags}
              />
            </div>
            <div className="taskMembers">
              <Tooltip title={_l('任务负责人')}>
                <span className="taskContentIcon">
                  <i className="icon-group" />
                </span>
              </Tooltip>
              <div className="membersList">
                {desktopMembers.map((item, i) => this.renderDesktopMemberItem(item, i, hasAuth))}
                {hasAuth && (
                  <Tooltip title={_l('添加任务负责人')}>
                    <span className="colorPrimary detailAddMember" onClick={this.addDesktopMembers(1)}>
                      <i className="icon-task-add-member-circle" />
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="taskMembers">
              <Tooltip title={_l('任务参与者')}>
                <span className="taskContentIcon">
                  <i className="icon-group-members" />
                </span>
              </Tooltip>
              <div className="membersList">
                {desktopViewers.map((item, i) => this.renderDesktopMemberItem(item, i, hasAuth))}
                {hasAuth && (
                  <Tooltip title={_l('添加任务参与者')}>
                    <span className="colorPrimary detailAddMember" onClick={this.addDesktopMembers(2)}>
                      <i className="icon-task-add-member-circle" />
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

export default connect(state => state.task)(TaskBasic);
