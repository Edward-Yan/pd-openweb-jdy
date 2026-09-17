import React, { Fragment } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import styled from 'styled-components';
import { browserIsMobile } from 'src/utils/common';

const isMobile = browserIsMobile();
const MOBILE_HEADER_HEIGHT = 48;

const BodyWrap = styled.div`
  position: relative;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: -24px;
  right: -24px;
  z-index: 10;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(0, 0, 0, 0.45);
  font-size: 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.2s,
    background 0.2s;

  &:hover {
    color: rgba(0, 0, 0, 0.85);
    background: rgba(0, 0, 0, 0.04);
  }
`;

const MOBILE_MODAL_STYLE_CSS = `
  .mobileIframeModalWrap {
    overflow: hidden;
  }
  .mobileIframeModalWrap .ant-modal {
    height: 100%;
    max-width: 100%;
    margin: 0;
    padding-bottom: 0;
  }
  .mobileIframeModalWrap .ant-modal-content {
    height: 100%;
    padding: 0;
    border-radius: 0;
    overflow: hidden;
  }
  .mobileIframeModalWrap .ant-modal-body {
    height: 100%;
    overflow: hidden;
  }
`;

const MobileBody = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--color-background-primary);
`;

const MobileHeader = styled.div`
  flex-shrink: 0;
  height: ${MOBILE_HEADER_HEIGHT}px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-secondary);

  .title {
    flex: 1;
    min-width: 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-primary);
  }
`;

const MobileFooter = styled.div`
  flex-shrink: 0;
  padding: 10px 15px;
  padding-bottom: calc(10px + constant(safe-area-inset-bottom));
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border-secondary);

  .closeBtn {
    width: 100%;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 24px;
    background-color: var(--color-primary);
    color: var(--color-white, #fff);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;

    &:active {
      opacity: 0.85;
    }
  }
`;

const IframeWrap = styled.div`
  width: 100%;
  ${isMobile
    ? `flex: 1;
       min-height: 0;`
    : `height: 90vh;`}
  border: ${isMobile ? 'none' : '1px solid var(--color-border-secondary, #e8e8e8)'};
  border-radius: ${isMobile ? 0 : '4px'};
  overflow: hidden;
  background-color: var(--color-background-primary);

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
`;

/**
 * 弹框 + iframe 组件（网页端 / 移动端共用）
 *
 * 网页端：居中 90% 宽弹框，右上角 × / 遮罩点击 / ESC 键关闭
 * 移动端：全屏弹框（标题栏 + 自适应 iframe + 底部关闭按钮），通过底部按钮关闭
 *
 * @param {object} props
 * @param {boolean} props.visible - 是否显示
 * @param {string} props.src - iframe 地址
 * @param {string} [props.title] - 标题
 * @param {() => void} props.onClose - 关闭回调（遮罩/ESC/关闭按钮都会触发）
 * @param {() => void} [props.afterClose] - 关闭后额外回调（用于刷新列表等）
 */
export default function IframeModal({ visible, src, title = '详情', onClose, afterClose }) {
  const handleClose = () => {
    onClose && onClose();
    afterClose && afterClose();
  };

  const renderIframe = () =>
    visible && src ? (
      <IframeWrap>
        <iframe src={src} allow="fullscreen" allowFullScreen title={title} />
      </IframeWrap>
    ) : null;

  return (
    <Fragment>
      {isMobile && <style>{MOBILE_MODAL_STYLE_CSS}</style>}
      <Modal
        visible={visible}
        closable={false}
        width={isMobile ? '100%' : '90%'}
        footer={null}
        onCancel={handleClose}
        maskClosable={!isMobile}
        keyboard={true}
        destroyOnClose={true}
        centered={!isMobile}
        wrapClassName={isMobile ? 'mobileIframeModalWrap' : undefined}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : { maxWidth: 1680 }}
        bodyStyle={isMobile ? { padding: 0 } : { padding: 24 }}
      >
        {isMobile ? (
          <MobileBody>
            <MobileHeader>
              <div className="title overflow_ellipsis">{title}</div>
            </MobileHeader>
            {renderIframe()}
            <MobileFooter>
              <button className="closeBtn" type="button" onClick={handleClose}>
                {_l('关闭')}
              </button>
            </MobileFooter>
          </MobileBody>
        ) : (
          <BodyWrap>
            <CloseBtn type="button" onClick={handleClose} title={_l('关闭')}>
              <CloseOutlined />
            </CloseBtn>
            {renderIframe()}
          </BodyWrap>
        )}
      </Modal>
    </Fragment>
  );
}
