import React, { Component } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { SpinLoading } from 'antd-mobile';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { WaterMark } from 'ming-ui';
import homeAppApi from 'src/api/homeApp';
import customApi from 'statistics/api/custom';
import DocumentTitle from 'mobile/components/DocumentTitle';
import workflowPushSoket from 'mobile/components/socket/workflowPushSoket';
import { getEmbedValue } from 'src/components/Form/core/formUtils/helper';
import { buildAuthCenterUrl, fetchMutualTrustToken, parseMutualTrustParams } from 'src/pages/customPage/mutualTrust';
import {
  CUSTOM_PAGE_IFRAME_ALLOW,
  getDefaultLayout,
  getEnumType,
  isLightColor,
  reorderComponents,
  replaceColor,
  syncThemeConfig,
} from 'src/pages/customPage/util';
import { insertPortal } from 'src/pages/customPage/util';
import { transferValue } from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util';
import store from 'src/redux/configureStore';
import { getTranslateInfo } from 'src/utils/app';
import { compatibleMDJS } from 'src/utils/project';
import AppPermissions from '../components/AppPermissions';
import Back from '../components/Back';
import LinkageBtn from './LinkageBtn';
import { updateFilterComponents } from './redux/actions';
import WidgetDisplay from './WidgetDisplay';

const getLayout = components =>
  components.map((item = {}, index) => {
    const { id } = item;
    const { layout, titleVisible } = item.mobile;
    const layoutType = 'mobile';
    return layout
      ? { ...layout, i: `${id || index}` }
      : {
          ...getDefaultLayout({
            components,
            index,
            layoutType,
            titleVisible,
          }),
          i: `${id || index}`,
        };
  });

const LayoutContent = styled.div`
  .widgetContent {
    position: absolute;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: var(--color-background-primary);
    border-radius: 3px;
    overflow: auto;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
    &.haveTitle {
      height: calc(100% - 40px);
    }
    &.tabs,
    &.subsection {
      overflow: inherit;
      box-shadow: none;
      background-color: transparent !important;
    }
    &.richText {
      box-shadow: none;
      background: transparent !important;
    }
  }
  .componentTitle {
    height: 32px;
    line-height: 32px;
    margin-bottom: 4px;
    font-size: 16px;
    color: var(--title-color);
  }
`;
const EmptyData = styled.div`
  .iconWrap {
    width: 130px;
    height: 130px;
    border-radius: 50%;
    margin: 0 auto;
    background-color: var(--color-border-secondary);
    text-align: center;
    padding-top: 35px;
    i {
      font-size: 60px;
      color: var(--color-text-disabled);
    }
  }
`;
let CustomPage = class CustomPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      apk: {},
      pageComponents: [],
      pageConfig: {},
      pageName: '',
      urlTemplate: '',
      // 外部链接互信认证：jumpToken / 请求失败信息
      ssoToken: '',
      ssoTokenError: '',
    };
    // 互信认证请求状态锁：防止重复请求、忽略过期回调
    this.ssoFetching = false;
    this.ssoParamsKey = '';
    this.ssoRequestId = 0;
    this.ssoController = null;
    // 防止重复触发顶层跳转
    this.ssoRedirecting = false;
  }

  componentDidMount() {
    this.getPage(this.props);
    this.getPageInfo(this.props);

    if (!window.isMingDaoApp) {
      workflowPushSoket();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps !== this.props) {
      const { params: newParams } = this.props.match;
      const { params } = prevProps.match;

      if (newParams.worksheetId !== params.worksheetId) {
        this.getPage(this.props);
        this.getPageInfo(this.props);
      }
    }
  }

  componentWillUnmount() {
    $(window).off('orientationchange');
    // 取消进行中的互信认证 token 请求
    if (this.ssoController) {
      this.ssoController.abort();
      this.ssoController = null;
    }

    if (!window.IM) return;
    IM.socket.off('workflow_push');
    IM.socket.off('workflow');
  }

  getPage(props) {
    const { params } = props.match;
    const { appNaviStyle, appSection = [] } = props;
    let currentNavWorksheetId = localStorage.getItem('currentNavWorksheetId');
    let currentNavWorksheetInfo =
      currentNavWorksheetId &&
      localStorage.getItem(`currentNavWorksheetInfo-${currentNavWorksheetId}`) &&
      JSON.parse(localStorage.getItem(`currentNavWorksheetInfo-${currentNavWorksheetId}`));

    if (appNaviStyle === 2 && currentNavWorksheetInfo) {
      const components = (currentNavWorksheetInfo || {}).components || [];
      const pageComponents = reorderComponents(components);
      const newPageComponents = (pageComponents ? pageComponents : components).filter(item => item.mobile.visible);
      this.setState({
        pageComponents: newPageComponents,
        loading: false,
        pageName: currentNavWorksheetInfo.name,
      });
      store.dispatch(updateFilterComponents(newPageComponents.filter(item => item.value && item.type === 6)));
    } else {
      this.setState({
        loading: true,
      });
      customApi
        .getPage({
          appId: params.worksheetId,
        })
        .then(result => {
          compatibleMDJS('workItemInfo', {
            item: result,
          });

          if (appNaviStyle === 2) {
            let navSheetList = _.flatten(
              appSection.map(item => {
                item.workSheetInfo.forEach(sheet => {
                  sheet.appSectionId = item.appSectionId;
                });
                return item.workSheetInfo;
              }),
            )
              .filter(item => [1, 3].includes(item.status) && !item.navigateHide) //左侧列表状态为1 且 角色权限没有设置隐藏
              .slice(0, 4);

            navSheetList.forEach(item => {
              if (item.workSheetId === params.worksheetId) {
                safeLocalStorageSetItem(`currentNavWorksheetInfo-${params.worksheetId}`, JSON.stringify(result));
              }
            });
          }

          const components = result.components;
          const pageComponents = reorderComponents(components);
          const newPageComponents = (pageComponents ? pageComponents : components).filter(item => item.mobile.visible);
          this.setState({
            apk: result.apk || {},
            pageComponents: newPageComponents,
            loading: false,
            pageName: result.name,
            pageConfig: replaceColor(syncThemeConfig(result.config || {}), _.get(result.apk, 'iconColor')),
          });
          store.dispatch(updateFilterComponents(newPageComponents.filter(item => item.value && item.type === 6)));
        });
    }

    $(window).bind('orientationchange', () => {
      location.reload();
    });
  }

  getPageInfo(props) {
    const { params } = props.match;
    homeAppApi
      .getPageInfo({
        appId: params.appId,
        groupId: params.groupId,
        id: params.worksheetId,
      })
      .then(data => {
        this.setState(
          {
            pageName: data.name,
            urlTemplate: data.urlTemplate,
          },
          () => {
            // urlTemplate 变化后重新检查互信认证
            this.handleMutualTrust(data.urlTemplate);
          },
        );
      });
  }

  // 拼接外部链接完整地址（urlTemplate 中变量按当前页面参数替换）
  buildUrlTemplateUrl(urlTemplate) {
    const { params } = this.props.match;
    const dataSource = transferValue(urlTemplate);
    const urlList = [];
    dataSource.map(o => {
      if (o.staticValue) {
        urlList.push(o.staticValue);
      } else {
        urlList.push(
          getEmbedValue(
            {
              appId: params.appId,
              groupId: params.groupId,
              worksheetId: params.worksheetId,
            },
            o.cid,
          ),
        );
      }
    });
    return urlList.join('');
  }

  /**
   * 互信认证：urlTemplate 含 sysMutualTrust=true 时请求 jumpToken
   * （与网页端 customPage/pageContent 逻辑一致：状态锁防重复、requestId 忽略过期回调）
   */
  handleMutualTrust(urlTemplate) {
    if (!urlTemplate) {
      this.ssoFetching = false;
      this.ssoParamsKey = '';
      return;
    }

    let url;

    try {
      url = this.buildUrlTemplateUrl(urlTemplate);
    } catch {
      return;
    }

    // 解析互信参数；未启用互信（sysMutualTrust !== 'true' 或 url 非法）时返回 null
    const parsed = parseMutualTrustParams(url);
    if (!parsed) return;

    const paramsKey = parsed.paramsKey;
    // 已有请求进行中，或已为相同参数完成过请求，则跳过
    if (this.ssoFetching || this.ssoParamsKey === paramsKey) return;

    const requestId = ++this.ssoRequestId;
    const isCurrent = () => this.ssoRequestId === requestId;
    const controller = new AbortController();

    this.ssoFetching = true;
    this.ssoParamsKey = paramsKey;
    this.ssoController = controller;
    // 重置上次结果，触发 loading 渲染
    this.setState({ ssoToken: '', ssoTokenError: '' });

    fetchMutualTrustToken(url, { signal: controller.signal })
      .then(jumpToken => {
        if (!isCurrent()) return;
        this.setState({ ssoToken: jumpToken });
      })
      .catch(error => {
        if (!isCurrent() || controller.signal.aborted) return;
        this.setState({ ssoTokenError: error.message || _l('互信认证请求失败') });
      })
      .finally(() => {
        if (!isCurrent()) return;
        this.ssoFetching = false;
      });
  }

  renderLoading() {
    return (
      <div className="flexRow justifyContentCenter alignItemsCenter h100">
        <SpinLoading color="primary" />
      </div>
    );
  }

  renderWithoutData() {
    return (
      <div className="flexRow justifyContentCenter alignItemsCenter h100">
        <EmptyData>
          <div className="iconWrap">
            <i className="icon-widgets"></i>
          </div>
          <p className="textSecondary TxtCenter mTop16">{_l('没有内容')}</p>
        </EmptyData>
      </div>
    );
  }

  renderContent() {
    const { apk, pageConfig } = this.state;
    const allPageComponents = this.state.pageComponents;
    const pageComponents = this.state.pageComponents.filter(c => !c.sectionId);
    const { params } = this.props.match;
    const layout = getLayout(pageComponents);
    const bgIsDark = pageConfig.pageBgColor && !isLightColor(pageConfig.pageBgColor);
    const widgetIsDark = pageConfig.widgetBgColor && !isLightColor(pageConfig.widgetBgColor);
    return (
      <div
        style={{
          backgroundColor: pageConfig.pageBgColor,
          '--title-color': bgIsDark ? '#ffffffcc' : '#333',
          '--icon-color': bgIsDark ? '#ffffffcc' : '#9e9e9e',
          '--bg-color': bgIsDark ? '#e6e6e633' : '#e6e6e6',
          '--widget-color': pageConfig.widgetBgColor,
          '--widget-title-color': widgetIsDark ? '#ffffffcc' : '#333',
          '--widget-icon-color': widgetIsDark ? '#ffffffcc' : '#9e9e9e',
          '--widget-icon-hover-color': widgetIsDark ? '#ffffff' : '#1677ff',
          '--app-primary-color': apk.iconColor,
        }}
      >
        <GridLayout
          width={document.documentElement.clientWidth}
          className="layout"
          cols={2}
          rowHeight={40}
          margin={[10, 10]}
          isDraggable={false}
          isResizable={false}
          draggableCancel=".componentTitle"
          layout={layout}
        >
          {pageComponents.map((widget, index) => {
            const { id, type } = widget;
            const { title, titleVisible } = widget.mobile;
            const componentType = getEnumType(type);
            const isTransparent =
              (componentType === 'analysis' && _.get(widget, 'config.showType') === 1) ||
              (componentType === 'card' && _.get(widget, 'componentConfig.showType') === 1);
            const translateInfo = getTranslateInfo(
              apk.appId,
              null,
              componentType === 'analysis' ? widget.value : widget.id,
            );
            const widgetConfig = {
              ...pageConfig,
              originWidgetBgColor: pageConfig.widgetBgColor,
              widgetBgColor: isTransparent ? 'transparent' : pageConfig.widgetBgColor,
            };
            return (
              <LayoutContent key={`${id || index}`} className="resizableWrap">
                {titleVisible && (
                  <div className="componentTitle overflow_ellipsis bold">
                    {title ? translateInfo.mobileTitle || title : ''}
                  </div>
                )}
                <div
                  className={cx('widgetContent', componentType, {
                    haveTitle: titleVisible,
                  })}
                  style={{
                    backgroundColor: widgetConfig.widgetBgColor,
                  }}
                >
                  <WidgetDisplay
                    pageComponents={allPageComponents}
                    pageConfig={widgetConfig}
                    componentType={componentType}
                    widget={widget}
                    apk={apk}
                    ids={{
                      appId: params.appId,
                      groupId: params.groupId,
                      worksheetId: params.worksheetId,
                    }}
                    updateComponents={newComponents => {
                      this.setState({
                        pageComponents: newComponents,
                      });
                    }}
                  />
                </div>
              </LayoutContent>
            );
          })}
        </GridLayout>
      </div>
    );
  }

  renderUrlTemplate() {
    const { ssoToken, ssoTokenError } = this.state;
    let urlFormat = this.buildUrlTemplateUrl(this.state.urlTemplate);

    try {
      // 外部链接启用互信认证（sysMutualTrust=true）时：jumpToken 就绪后跳转认证中心，认证通过后回到详情页
      const urlParams = new URLSearchParams(new URL(urlFormat).search);

      if (urlParams.get('sysMutualTrust') === 'true') {
        if (ssoToken) {
          // token 就绪后顶层跳转认证中心（认证通过后由认证中心跳回第三方页面 redirectUrl）。
          // 用 replace 替换当前历史记录而非新增，避免 iframe 内二次导航多压入一条历史，
          // 这样移动端按一次返回即可回到上级页面
          if (!this.ssoRedirecting) {
            this.ssoRedirecting = true;
            window.location.replace(buildAuthCenterUrl(ssoToken));
          }

          // 跳转完成前先展示 loading
          return (
            <div className="h100 w100 flexRow justifyContentCenter alignItemsCenter">
              <SpinLoading color="primary" />
            </div>
          );
        } else if (ssoTokenError) {
          // 请求失败：在 iframe 位置展示加载失败提示
          return (
            <div className="h100 w100 flexRow justifyContentCenter alignItemsCenter">
              <span className="textTertiary Font15">{ssoTokenError}</span>
            </div>
          );
        } else {
          // 请求进行中先展示 loading，token 就绪后 setState 触发重新渲染
          return (
            <div className="h100 w100 flexRow justifyContentCenter alignItemsCenter">
              <SpinLoading color="primary" />
            </div>
          );
        }
      }
    } catch {
      // url 非法时按原地址渲染
    }

    return (
      <div className="h100 w100">
        <iframe
          className="w100 h100"
          style={{
            border: 'none',
          }}
          allow={CUSTOM_PAGE_IFRAME_ALLOW}
          allowFullScreen
          src={insertPortal(urlFormat)}
        />
      </div>
    );
  }

  render() {
    const { pageTitle, appNaviStyle } = this.props;
    const { pageComponents, loading, pageName, apk, urlTemplate } = this.state;
    return (
      <WaterMark projectId={apk.projectId}>
        <div
          id="componentsWrap"
          className="h100 w100 bgTertiary"
          style={{
            overflowY: 'auto',
          }}
        >
          <DocumentTitle title={pageTitle || pageName || _l('自定义页面')} />
          {urlTemplate
            ? this.renderUrlTemplate()
            : loading
              ? this.renderLoading()
              : pageComponents.length
                ? this.renderContent()
                : this.renderWithoutData()}
          {!window.isMingDaoApp &&
            !(appNaviStyle === 2 && location.href.includes('mobile/app') && md.global.Account.isPortal) &&
            !_.get(window, 'shareState.shareId') &&
            !location.href.includes('embed/page') && (
              <Back
                style={{
                  bottom: appNaviStyle === 2 ? '70px' : '20px',
                }}
                className="low"
                icon={appNaviStyle === 2 && location.href.includes('mobile/app') ? 'home' : 'back'}
                onClick={() => {
                  if (appNaviStyle === 2 && location.href.includes('mobile/app')) {
                    window.mobileNavigateTo('/mobile/dashboard');
                    return;
                  }

                  const { params } = this.props.match;
                  window.mobileNavigateTo(`/mobile/app/${params.appId}`);
                }}
              />
            )}
          <LinkageBtn />
        </div>
      </WaterMark>
    );
  }
};
CustomPage = AppPermissions(CustomPage);
export default CustomPage;
