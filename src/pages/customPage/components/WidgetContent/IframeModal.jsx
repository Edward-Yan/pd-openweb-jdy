import React from 'react';
import { Modal } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const IFRAME_CONTAINER_HEIGHT = '90vh';

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
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: rgba(0, 0, 0, 0.85);
    background: rgba(0, 0, 0, 0.04);
  }
`;

const IframeWrap = styled.div`
  width: 100%;
  height: ${IFRAME_CONTAINER_HEIGHT};
  border: 1px solid var(--color-border-secondary, #e8e8e8);
  border-radius: 4px;
  overflow: hidden;

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
`;

/**
 * 弹框 + iframe 组件
 *
 * 关闭方式：右上角 × / 遮罩点击 / ESC 键
 */
export default function IframeModal({ visible, src, title = '详情', onClose }) {
  return (
    <Modal
      visible={visible}
      closable={false}
      width="90%"
      footer={null}
      onCancel={onClose}
      maskClosable={true}
      keyboard={true}
      destroyOnClose={true}
      centered={true}
      style={{ maxWidth: 1680 }}
      bodyStyle={{ padding: 24 }}
    >
      <BodyWrap>
        <CloseBtn type="button" onClick={onClose} title="关闭">
          <CloseOutlined />
        </CloseBtn>
        {visible && src && (
          <IframeWrap>
            <iframe src={src} allow="fullscreen" allowFullScreen title={title} />
          </IframeWrap>
        )}
      </BodyWrap>
    </Modal>
  );
}
