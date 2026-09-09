import React, { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import DocumentTitle from 'react-document-title';
import { useFullscreen, useToggle } from 'react-use';
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
import { buildAuthCenterUrl, fetchMutualTrustToken, parseMutualTrustParams } from '../mutualTrust';
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

  // 互信认证：签名与 token 请求已抽至 ../mutualTrust 公用模块

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

    // 解析互信参数；未启用互信（sysMutualTrust !== 'true' 或 url 非法）时返回 null
    const parsed = parseMutualTrustParams(url);
    if (!parsed) return;

    // 参数键：用于判断是否已为该组参数发起过请求
    const paramsKey = parsed.paramsKey;

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

    fetchMutualTrustToken(url, { signal: controller.signal })
      .then(jumpToken => {
        if (!isCurrent()) return;
        setSsoToken(jumpToken);
      })
      .catch(error => {
        // 请求失败：记录错误信息，在 iframe 位置展示加载失败提示
        if (!isCurrent() || controller.signal.aborted) return;
        setSsoTokenError(error.message || _l('互信认证请求失败'));
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
          urlFormat = buildAuthCenterUrl(ssoToken);
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
