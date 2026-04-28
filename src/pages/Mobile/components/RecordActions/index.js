import React from 'react';
import { Popover } from 'antd-mobile';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import Constant from 'src/pages/chat/utils/constant';

const AddRecordWrap = styled.div`
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 60px;
  height: 60px;
  line-height: 50px;
  border-radius: 50%;
  color: #fff;
  text-align: center;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
`;

const BatchOperationWrap = styled.div`
  width: 44px;
  height: 44px;
  text-align: center;
  border-radius: 50%;
  position: fixed;
  right: 20px;
  bottom: 20px;
  background-color: #fff;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.16);
  z-index: 2;
  color: #9e9e9e;
  &.bottom70 {
    bottom: 70px;
  }
`;

const ShareWebToAppBtnWrap = styled.div`
  width: 44px;
  height: 44px;
  text-align: center;
  line-height: 44px;
  border-radius: 50%;
  background-color: #fff;
  color: #9e9e9e;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
  &.bottom70 {
    bottom: 70px;
  }
`;

export function AddRecordBtn(props) {
  const { className, warpStyle = {}, backgroundColor, onClick = () => {} } = props;
  return (
    <AddRecordWrap
      className={`addRecordItemWrapper ${className}`}
      style={{ ...warpStyle, backgroundColor }}
      onClick={onClick}
    >
      <Icon icon="add" className="Font36 LineHeight60" />
    </AddRecordWrap>
  );
}

export function BatchOperationBtn(props) {
  const { style, className, onClick = () => {} } = props;
  return (
    <BatchOperationWrap className={className} style={style} onClick={onClick}>
      <Icon icon={'done_all'} className="Font24 LineHeight44" />
    </BatchOperationWrap>
  );
}

export function ShareWebToAppBtn(props) {
  const { style, className, onClick = () => {} } = props;
  const actions = [
    { key: Constant.CARD_SHARE_ENUM.SHEET, text: '分享工作表' },
    { key: Constant.CARD_SHARE_ENUM.VIEW, text: '分享视图' },
  ];
  return (
    <Popover.Menu actions={actions} placement="right" onAction={node => onClick(node)} trigger="click">
      <ShareWebToAppBtnWrap className={className} style={style}>
        <Icon icon={'shareLink'} className="Font24 LineHeight44" />
      </ShareWebToAppBtnWrap>
    </Popover.Menu>
  );
}
