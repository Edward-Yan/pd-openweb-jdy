import React, { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import DocumentTitle from 'react-document-title';
import { useFullscreen, useToggle } from 'react-use';
import axios from 'axios';
import cx from 'classnames';
import { pick } from 'lodash';
import _ from 'lodash';
import styled from 'styled-components';
import { LoadDiv } from 'ming-ui';
import customApi from 'statistics/api/custom.js';
import { getEmbedValue } from 'src/components/Form/core/formUtils/helper';
import { defaultConfig } from 'src/pages/customPage/components/ConfigSideWrap/defaultConfig';
import {
  deleteLinkageFiltersGroup,
  updateEditPageVisible,
  updateLoading,
  updatePageInfo,
} from 'src/pages/customPage/redux/action';
import { CUSTOM_PAGE_IFRAME_ALLOW, enumWidgetType, updateLayout } from 'src/pages/customPage/util';
import WebLayout from 'src/pages/customPage/webLayout';
import { getAppSectionData } from 'src/pages/PageHeader/AppPkgHeader/LeftAppGroup';
import { transferValue } from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util';
import { copyCustomPage } from 'src/pages/worksheet/redux/actions/sheetList';
import { deleteSheet, updateSheetList, updateSheetListAppItem } from 'src/pages/worksheet/redux/actions/sheetList';
import { getTranslateInfo } from 'src/utils/app';
import { browserIsMobile, emitter } from 'src/utils/common';
import { addBehaviorLog } from 'src/utils/project';
import { findSheet } from 'src/utils/worksheet';
import { insertPortal, syncThemeConfig } from '../util';
import CustomPageHeader from './CustomPageHeader';
import 'rc-trigger/assets/index.css';

const CustomPageEditor = lazy(() => import('src/pages/customPage'));

const CustomPageContentWrap = styled.div`
  flex: 1;
  position: relative;
  header {
    display: flex;
    justify-content: space-between;
    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: 44px;
    padding: 0 24px 0 10px;
    border-radius: 3px 3px 0 0;
    background-color: var(--color-background-card);
    box-shadow: var(--shadow-md);
    z-index: 1;
    .customPageDesc {
      padding: 0 4px;
    }
    .nameWrap {
      display: flex;
      align-items: center;
      min-width: 0;
      .pageName {
        color: var(--title-color);
        margin: 0 6px;
        font-size: 18px;
        font-weight: bold;
      }
    }
    .hideSide {
      vertical-align: top;
    }
    .iconWrap {
      color: var(--icon-color);
      &:hover {
        color: var(--icon-hover-color);
      }
      .icon-language {
        color: inherit !important;
      }
    }
    .svgWrap {
      width: 26px;
      height: 26px;
      border-radius: 4px;
      justify-content: center;
      line-height: initial;
    }
    .fullRotate {
      transform: rotate(90deg);
      display: inline-block;
    }
    .hoverGray {
      width: 24px;
      height: 24px;
      display: inline-block;
      text-align: center;
      line-height: 24px;
      border-radius: 3px;
    }
    .hoverGray:hover {
      // background: var(--color-background-secondary);
    }
    .createSource {
      & > div,
      & a {
        color: var(--title-color);
      }
    }
  }
  > .content {
    min-height: 0;
    width: 100%;
    flex: 1;
  }
  .customPageContent {
    padding: 0 8px 0px 8px;
    &.isFullscreen {
      padding-top: 0;
    }
    &.adjustScreen {
      overflow: hidden;
    }
  }
  .selectIconWrap {
    top: 40px;
    left: 10px;
  }
`;

function CustomPageContent(props) {
  const {
    appPkg,
    loading,
    visible,
    adjustScreen,
    config,
    updatePageInfo,
    updateLoading,
    apk,
    id,
    groupId,
    className,
    pageTitle,
    ids = {},
  } = props;
  const pageId = id;
  const appName = getTranslateInfo(appPkg.id, null, appPkg.id).name || props.appName || apk.appName || '';
  const ref = useRef(document.body);
  const configRef = useRef(config);
  const pageRequestRef = useRef(null);
  const [show, toggle] = useToggle(false);
  // 记录跳转token，用于认证中心跳转
  const [ssoToken, setSsoToken] = useState('');
  // token 请求是否失败，失败时停止 loading 并在 iframe 位置展示加载失败提示
  const [ssoTokenError, setSsoTokenError] = useState(false);
  // 互信认证请求状态锁：将副作用从 renderContent 迁移至 useEffect，确保接口仅单次调用
  // ssoFetchingRef：是否有请求进行中；ssoParamsKeyRef：已完成请求对应的参数键；ssoRequestIdRef：请求自增 ID，用于忽略过期回调
  const ssoFetchingRef = useRef(false);
  const ssoParamsKeyRef = useRef('');
  const ssoRequestIdRef = useRef(0);

  const showFullscreen = () => {
    document.body.classList.add('customPageFullscreen');
    toggle(true);
    window.parent.postMessage({ type: 'showFullscreen' }, md.global.Config.MarketUrl);
  };

  const closeFullscreen = () => {
    document.body.classList.remove('customPageFullscreen');
    toggle(false);
  };

  const isFullscreen = useFullscreen(ref, show, { onClose: closeFullscreen });
  const isMobile = browserIsMobile();
  const sheetList = [1, 3].includes(appPkg.currentPcNaviStyle) ? getAppSectionData(groupId) : props.sheetList;
  const currentSheet = findSheet(id, sheetList) || props.currentSheet || {};
  const pageName = getTranslateInfo(appPkg.id, null, pageId).name || props.pageName || currentSheet.workSheetName || '';
  const { urlTemplate } = currentSheet;

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const handler = value => {
      if (value === _.get(configRef.current, 'pageStyleType') || !configRef.current) return;
      updatePageInfo({
        config: syncThemeConfig(configRef.current, value),
      });
    };

    emitter.addListener('CHANGE_THEME_MODE', handler);
    return () => {
      emitter.removeListener('CHANGE_THEME_MODE', handler);
    };
  }, []);

  useEffect(() => {
    if (id && isFullscreen) {
      closeFullscreen();
    }
  }, [id]);

  useEffect(() => {
    if (urlTemplate) {
      updatePageInfo({
        config: {
          fullScreenVisible: true,
        },
      });
      updateLoading(false);
    } else {
      updateLoading(true);
      pageId && getPage();
    }

    return () => {
      if (_.isFunction(_.get(pageRequestRef, 'current.abort'))) {
        pageRequestRef.current.abort();
        pageRequestRef.current = null;
      }

      updateLoading(true);
    };
  }, [pageId]);

  const getPage = () => {
    if (_.isFunction(_.get(pageRequestRef, 'current.abort'))) {
      pageRequestRef.current.abort();
    }

    const request = customApi.getPage({
      appId: pageId,
    });

    pageRequestRef.current = request;
    request
      .then(({ components, desc, apk, adjustScreen, urlParams, name, config, version }) => {
        if (pageRequestRef.current !== request) return;

        const componentsData = isMobile
          ? components.filter(item => item.mobile.visible)
          : updateLayout(components, config);
        addBehaviorLog('customPage', pageId, {}, true);
        updatePageInfo({
          components: componentsData,
          desc,
          adjustScreen,
          urlParams,
          pageId,
          apk: apk || {},
          config: syncThemeConfig(
            config ? { ...config, webNewCols: 48, orightWebCols: config.webNewCols } : defaultConfig,
          ),
          pageName: name,
          filterComponents: componentsData.filter(item => item.value && item.type === enumWidgetType.filter),
          version,
        });
        if (window.shareState.shareId && !adjustScreen && className && className.includes('hideHeader')) {
          document.body.classList.add('bodyScroll');
        }
      })
      .finally(() => {
        if (pageRequestRef.current !== request) return;
        pageRequestRef.current = null;
        updateLoading(false);
      });
  };

  const resetPage = () => {
    updatePageInfo({ loadFilterComponentCount: 0 });
    updateLoading(true);
    getPage();
  };

  let cachedKey = null;
  /**
   * 导入 PKCS#8 私钥
   * 只在首次调用时执行,之后用缓存
   */
  const loadPrivateKey = async () => {
    if (cachedKey) return cachedKey;
    const RSA_PRIVATE_KEY_B64 = `MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6UtmeUf1XDmlPvyoUbFQ4kPX2meCmshdjcpi4e7HZixu0XILwVt0kR0hhFmkgUYGRl4K4Sg3dlAF2DkcjrSs2C25oR6ZLd3aYQfTFiDOjmeUHlzhiOFRXRapm+wTTLJ1ZXBeGv7FbcNdJVJDlWLt0Dnb0ifGIXLW3aWVwyO7iGRJEL+OE1h7TnVJZiQ4lGT1IsIYxFK8CFiTZ+dI8P/A3Qdl4RCuEjwIXRd+qvOld90fGtZTTDaromHi+WdIuq7dhR4p3kycd/cbIv1a0GoBuLJJw4mFM0z3h04VqmzOtIgtcO3xkW9GQtgN4pbkuOaX1iuN7NfFoHmLhiGnxQFaLAgMBAAECggEAGhfkNhHRYtG32d0xrW6GVO2oJILkPTQPpnO0A5H/FDIxDQ8vnyzrB1ucPUyAKHCBrrwDKH/mdTN3COty9wIXXRg4vA3cshDm4OfLuaYbZTv2IRwCX274EMjG1mktAc3rs0n8WXibA+1HmRNov1Wv2s7zxcdTtf8Vy7vM4wCgw7T159Dp7NkFBWm3be15213s28tpstdgLVZlYs+B+RhRTAgPy3+FHFXIDBLYAJFH52mLxOkj1KLjsAqmupe4qDFbk/vdumtdON3begoLhFi6H16F3vHdB5nDRfBX0ef1gy7tH33PUPqScuPgp9TPdGsfuc9882andUvtZcdU2y198QKBgQDkhzYZzSzIR0z4C8cktsdacSyKJQlH9Uur72CpFVQSE4R1R5nnDOkuDUBU2AJrdrRbeRfJ/sFG61Phk7o2SRI3TLqXRP/RxnFS9n4HKikpEBIehrZFfYFZGRPGKcePLurw/JBvfeKtWOtpgVSqg2hGT4eam9JRrS6vu7r/zx8R3wKBgQDQuNMiwgLgqT763VMEIPOL4UU9a6/Uezr4vkeUlAejVPXoMOhItgwETDbax8I7nFtS/d+ZPf3ycJE35+QwvDTQUXvjPCPiP/oeBqaveqaTVZsdktHK4ULAXVETQmUXfbNwxh7Ibex3Wnseod4290ijoAKJyD/JH96cLBX5UhiI1QKBgQDWAwHZO9naXVtpV65RZZJf0mjBnlmIt+D7zRsafUzT+M8s/bbVN7QPWn2KdxgdB3dzyn1Kv3bFMZDGSZAzUk7q1sJO82EXVN2/sfLoRsVxHQm66LE9doFxrRhlla67GlcPA5dHsf5cFE+x6FofrRwz7DqzwYU+1A5KqGZBNfiExQKBgA1+dYAAxQjbSEwVtQFGVBiOBtjytlppYSWlv6D2dQv1OTS6vLm+s0Yv2zgHxCHweOMDsMoKfPmIl4rivhj8gfmZ2wWU5MkC09vPGEWuC0jpNu8Rh+iy6YrgPZaeK0T6hnhbBrB0kt4ghmczldc9439Yn/FideU93zl/jCgjS5zFAoGBAK+0jmVtu5UbGBiYGC4JcIrND/AL8+RjDCvRRoU1AjZ4q1jiu5QCwTCIMq753CZPEjfHNw3UYpCHyzki1sTM5a8Y76uH3yktqG0UsQnyZSKpZ6N6lvvyzvRCjz/VAlB4CtGaovi202I/F06yIQAXvG+NSL6ZUNUozcqCWkT3H80y`;

    // Base64 → 字节
    const keyBytes = Uint8Array.from(atob(RSA_PRIVATE_KEY_B64), c => c.charCodeAt(0));

    cachedKey = await crypto.subtle.importKey(
      'pkcs8', // 格式:PKCS#8
      keyBytes, // 私钥字节
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, // 算法
      false, // 不 extractable
      ['sign'], // 用途:只允许签名
    );
    return cachedKey;
  };

  /**
   * SHA256withRSA 签名,返回 Base64
   * 对应后端 RsaUtil.sign
   */
  const signHandler = async data => {
    const key = await loadPrivateKey();
    const dataBytes = new TextEncoder().encode(data);
    const sigBuffer = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, dataBytes);
    // ArrayBuffer → Base64
    const bytes = new Uint8Array(sigBuffer);
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  };
  const handleRedirectUrl = (urlStr, keysToRemove) => {
    if (!keysToRemove || keysToRemove.length === 0 || !Array.isArray(keysToRemove)) {
      return urlStr;
    }
    const urlObj = new URL(urlStr);
    // 收集要删除的 key（避免在遍历中直接 delete 导致迭代异常）
    const toDelete = keysToRemove.filter(k => urlObj.searchParams.has(k));
    toDelete.forEach(k => urlObj.searchParams.delete(k));
    return urlObj.toString();
  };

  // 互信认证：当 urlTemplate 含 sysMutualTrust=true 时请求 token
  // 放在 useEffect 中执行，避免在 render 函数中发起副作用（render 可能被 React 多次调用）导致重复调用接口
  useEffect(() => {
    if (!urlTemplate) {
      ssoParamsKeyRef.current = '';
      ssoFetchingRef.current = false;
      return;
    }

    // 构造完整 url（与 renderContent 中一致），用于解析互信参数
    let url;
    try {
      const dataSource = transferValue(urlTemplate);
      url = dataSource
        .map(o => {
          if (o.staticValue) return o.staticValue;
          return encodeURIComponent(
            getEmbedValue(
              { projectId: appPkg.projectId, appId: ids.appId, groupId: ids.groupId, worksheetId: ids.worksheetId },
              o.cid,
            ),
          );
        })
        .join('');
    } catch (e) {
      return;
    }

    let urlParams;
    try {
      urlParams = new URLSearchParams(new URL(url).search);
    } catch (e) {
      return;
    }

    if (urlParams.get('sysMutualTrust') !== 'true') return;

    const targetSystemId = urlParams.get('targetSystemId');
    const userId = urlParams.get('userId');
    const cookie = window.getCookie('md_pss_id') || '';
    const redirectUrl = handleRedirectUrl(url, ['sysMutualTrust', 'targetSystemId']);

    if (!userId) {
      alert('请配置用户ID(userId)', 2);
      return;
    }
    if (!redirectUrl || !cookie) {
      alert('未获取到相关参数', 2);
      return;
    }

    // 参数键：用于判断是否已为该组参数发起过请求
    const paramsKey = `${targetSystemId}|${userId}|${redirectUrl}|${cookie}`;

    // 已有请求进行中，或已为相同参数完成过请求，则跳过，确保接口仅按预期单次调用
    if (ssoFetchingRef.current || ssoParamsKeyRef.current === paramsKey) return;

    const requestId = ++ssoRequestIdRef.current;
    const isCurrent = () => ssoRequestIdRef.current === requestId;
    // 用于在切换菜单/卸载时取消进行中的请求，避免上一个菜单的旧请求继续完成造成重复调用
    const controller = new AbortController();

    ssoFetchingRef.current = true;
    ssoParamsKeyRef.current = paramsKey;
    // 重置上次结果，触发 loading 渲染
    setSsoToken('');
    setSsoTokenError(false);

    const timestamp = String(Date.now());
    const params = {
      sourceSystemId: 'd03fb5f3-189e-4586-b1f7-45c75364cfeb',
      targetSystemId,
      userId,
      redirectUrl,
      sign: '',
      timestamp,
      extParams: {
        cookie,
      },
    };
    const signStr = `${params.sourceSystemId}${params.targetSystemId}${params.userId}${timestamp}`;
    // 签名 → axios POST 请求 → 解析 token；所有回调都先校验 isCurrent，避免依赖变化后旧请求污染状态
    signHandler(signStr)
      .then(sign => {
        if (!isCurrent() || !sign) throw new Error('sign 为空');
        // 使用 /zttt_api/，dev 由 CI/serve.js 代理、prod 由 nginx 代理，统一转发至 https://zttt.crecg-jt.com/api/sso/system/token，避免跨域
        return axios.post(
          '/zttt_api/sso/system/token',
          { ...params, sign },
          {
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
          },
        );
      })
      .then(res => {
        if (!isCurrent()) return;
        // axios 响应体在 res.data，兼容 {data:{token}} / {data:token} / {token} 三种结构
        if (res.status === 200) {
          if (res.data.success) {
            const jumpToken = _.get(res, 'data.data.jumpToken') || '';
            if (jumpToken) {
              setSsoToken(jumpToken);
            } else {
              setSsoTokenError('未获取到返回中的token');
              alert(_l('未获取到返回中的token'), 2);
            }
          } else {
            setSsoTokenError(res.data?.msg || '获取互信认证token失败');
            alert(res.data?.msg || '获取互信认证token失败', 2);
          }
        } else {
          setSsoTokenError('互信认证请求失败');
          alert(_l('互信认证请求失败'), 2);
        }
      })
      .catch(error => {
        if (!isCurrent()) return;
        // 被主动取消（切换菜单/卸载时 abort）：不提示，不置错
        if (axios.isCancel(error)) return;
        // 网络异常 / 接口报错 / 签名失败统一兜底；不重置 ssoParamsKeyRef，避免失败后无限重试
        setSsoTokenError('互信认证请求失败');
        alert(_l('互信认证请求失败'), 2);
      })
      .finally(() => {
        if (!isCurrent()) return;
        ssoFetchingRef.current = false;
      });

    return () => {
      // 切换菜单/卸载：取消进行中的请求，确保上一个菜单的 token 请求不再继续完成
      controller.abort();
      // 若仍是当前请求，释放锁并清空参数键，允许新一轮请求；旧请求的回调会因 isCurrent 失败而跳过
      if (isCurrent()) {
        ssoFetchingRef.current = false;
        ssoParamsKeyRef.current = '';
      }
    };
  }, [urlTemplate, appPkg.projectId, ids.appId, ids.groupId, ids.worksheetId]);

  const renderContent = () => {
    if (urlTemplate) {
      const dataSource = transferValue(urlTemplate);
      const urlList = [];
      dataSource.map(o => {
        if (o.staticValue) {
          urlList.push(o.staticValue);
        } else {
          const embedValue = getEmbedValue(
            {
              projectId: appPkg.projectId,
              appId: ids.appId,
              groupId: ids.groupId,
              worksheetId: ids.worksheetId,
            },
            o.cid,
          );
          urlList.push(encodeURIComponent(embedValue));
        }
      });
      const url = urlList.join('');
      const urlParams = new URLSearchParams(new URL(url).search);
      let urlFormat = '';

      if (urlParams.get('sysMutualTrust') === 'true') {
        // token 请求与防重锁逻辑已迁移至上方 useEffect，renderContent 保持纯渲染
        if (ssoToken) {
          // token 已就绪,则跳转认证中心
          urlFormat = `https://zttt.crecg-jt.com/mutual-trust/auth-center/authenticate?jumpToken=${ssoToken}`;
        } else if (ssoTokenError) {
          // 请求失败：在 iframe 位置展示加载失败提示
          return (
            <div className="customPageContent h100 pAll0">
              <div style={{ marginTop: '60px', textAlign: 'center', color: '#999' }}>{ssoTokenError}</div>
            </div>
          );
        } else {
          // 请求进行中先展示 loading，token 就绪后 setSsoToken 触发重新渲染
          return <LoadDiv style={{ marginTop: '60px' }} />;
        }
      } else {
        urlFormat = url;
      }
      return (
        <div className="customPageContent h100 pAll0">
          {urlFormat && (
            <iframe
              className="w100 h100"
              style={{ border: 'none' }}
              allow={CUSTOM_PAGE_IFRAME_ALLOW}
              allowFullScreen
              src={insertPortal(urlFormat)}
            />
          )}
        </div>
      );
    }

    if (visible) return null;
    if (loading) return <LoadDiv style={{ marginTop: '60px' }} />;

    return (
      <WebLayout
        layoutType={isMobile ? 'mobile' : 'web'}
        adjustScreen={adjustScreen}
        config={config}
        appPkg={appPkg}
        className={cx('customPageContent', { isFullscreen })}
        from="display"
        ids={ids}
        isFullscreen={isFullscreen}
        editable={false}
        emptyPlaceholder={
          <div className="empty">
            <div className="iconWrap">
              <i className="icon-widgets"></i>
            </div>
            <p className="mTop16">{_l('暂未添加组件')}</p>
          </div>
        }
      />
    );
  };

  return (
    <Fragment>
      <CustomPageContentWrap className={cx('CustomPageContentWrap flexColumn', className)}>
        {(appName || pageName) && (
          <DocumentTitle title={pageTitle || `${pageName}${pageName && appName ? ' - ' : ''}${appName}`} />
        )}
        {!loading && (
          <CustomPageHeader {...props} currentSheet={currentSheet} toggle={showFullscreen} resetPage={resetPage} />
        )}
        <div className="content">{renderContent()}</div>
      </CustomPageContentWrap>
      {visible && !urlTemplate && (
        <Suspense fallback={<LoadDiv style={{ marginTop: '60px' }} />}>
          <CustomPageEditor name={pageName} ids={ids} currentSheet={currentSheet} />
        </Suspense>
      )}
    </Fragment>
  );
}

export default connect(
  ({ appPkg, customPage, sheet: { isCharge, base }, sheetList: { data } }) => ({
    ...pick(customPage, [
      'loading',
      'visible',
      'desc',
      'adjustScreen',
      'urlParams',
      'apk',
      'pageName',
      'flag',
      'config',
      'version',
      'linkageFiltersGroup',
    ]),
    isCharge,
    appName: appPkg.name,
    sheetList: data,
    appPkg,
    activeSheetId: base.workSheetId,
    groupId: base.groupId,
  }),
  dispatch =>
    bindActionCreators(
      {
        updatePageInfo,
        updateLoading,
        copyCustomPage,
        deleteSheet,
        updateSheetList,
        updateSheetListAppItem,
        updateEditPageVisible,
        deleteLinkageFiltersGroup,
      },
      dispatch,
    ),
)(CustomPageContent);
