import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, LoadDiv } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import homeAppApi from 'src/api/homeApp';
import { navigateTo } from 'src/router/navigateTo';
import { getTranslateInfo } from 'src/utils/app';
import { browserIsMobile, pathCompletion } from 'src/utils/common';
import IframeModal from 'src/pages/customPage/components/WidgetContent/IframeModal';
import {
  getMenuConfig,
  buildDetailUrl,
} from 'src/pages/customPage/components/WidgetContent/menuClickConfig';

const Wrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background-color: var(--color-background-tertiary);
  padding: 24px;
  min-width: 0;

  .SingleViewWrap {
    border-radius: 4px;
    box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    background-color: var(--color-background-card);
  }
`;
const EmptyView = styled.div`
  width: 100%;
  height: 100%;
  justify-content: center;
`;
const ViewWrap = styled.div`
  width: 100%;
  height: 100%;
  .SingleViewHeader {
    font-size: 17px;
    height: 50px;
    padding: 10px 16px;
    align-items: center;
    border-bottom: 1px solid var(--color-border-secondary);
    .searchInputComp,
    .sheetHeader {
      background-color: transparent;
    }
    &.mobile {
      font-size: 14px;
      height: 44px;
      background-color: var(--widget-color);
    }
  }
  .SingleViewName {
    .name {
      color: var(--widget-title-color);
    }
    .icon {
      pointer-events: initial;
      color: var(--widget-icon-color) !important;
    }
  }
  .SingleViewName + div {
    display: none;
  }
  .SingleViewBody {
    border: none !important;
  }
  &.web .addRecord {
    border-color: var(--app-primary-color);
    background: var(--app-primary-color);
    &:hover,
    &:active,
    &:focus {
      border-color: var(--app-primary-hover-color);
      background: var(--app-primary-hover-color);
    }
  }
  &.hideAddRecord .addRecord,
  &.hideAddRecord .addGunterRecord,
  &.hideAddRecord .addBoardRecord,
  &.hideAddRecord .addRecordItemWrapper,
  &.hideAddRecord .gunterDirectory .addCoin,
  &.hideAddRecord .hierarchyViewLeftBoundary > div,
  &.hideAddRecord .resourceView .groupTableCon .addCoin,
  &.hideAddRecord .sheetViewTable .control-rowHead .hoverShow:last-child,
  &.hideAddRecord .groupBoardWrap .groupByControl .hoverShow:last-child,
  &.hideAddRecord .groupBoardContent .secondGroupItemWrap .addBoardRecord,
  &.hideAddRecord .mapViewWrap .addMapRecord,
  &.hideAddRecord .galleryViewContentWrap .groupByControlForGallery .hoverShow:last-child,
  &.hideAddRecord .sheetViewTable .addChildBtn.hoverShow,
  &.hideSearchRecord .icon-search,
  &.hideSearchRecord .searchWrapper,
  &.hideSearchRecord .mapSearchRecordAutoComplete {
    display: none !important;
  }
  &.hideSearchRecord .fixedMobileQuickFilter {
    display: flex !important;
  }
  &.disableSingleView {
    &.mobile,
    .SingleViewHeader,
    .SingleViewBody .columnHead .dropIcon,
    .SingleViewBody .Checkbox,
    .SingleViewBody .searchWrapper,
    .worksheetSheet .quickFilterWrap,
    .worksheetSheet .groupFilterWrap,
    .worksheetSheet .mdTableContent,
    .gunterView .gunterRecord,
    .gunterView .recordBlock,
    .gunterView .milepostRecordBlock,
    .structureViewWrap .nodeWrap,
    .structureViewWrap .hierarchyViewLeftBoundary,
    .worksheetBoardViewWrap .boardDataRecordItemWrap,
    .worksheetBoardViewWrap .addBoardRecord,
    .galleryViewContentWrap .galleryItem,
    .calendarCon .scheduleBtn,
    .calendarCon .worksheetFullCalendar,
    .SingleViewWrap .addRecord {
      pointer-events: none;
    }
    .mapViewWrap .addMapRecord {
      display: none !important;
    }
  }
  .mobileBoxCalendar {
    .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) > div .fc-button-primary:first-child {
      padding: 0 !important;
    }
  }
`;
const isMobile = browserIsMobile();

const createLoadableSingleView = loader => lazy(loader);

const LoadableMobileSingleView = createLoadableSingleView(() => import('mobile/components/SingleView'));
const LoadableSingleView = createLoadableSingleView(() => import('worksheet/common/SingleView'));

const navigateToView = (workSheetId, viewId) => {
  homeAppApi
    .getAppSimpleInfo({
      workSheetId,
    })
    .then(data => {
      const { appId, appSectionId } = data;

      if (window.isMingDaoApp) {
        window.location.href = pathCompletion(`/mobile/recordList/${appId}/${appSectionId}/${workSheetId}/${viewId}`);
      } else if (isMobile) {
        window.mobileNavigateTo(`/mobile/recordList/${appId}/${appSectionId}/${workSheetId}/${viewId}`);
      } else {
        navigateTo(`/app/${appId}/${appSectionId}/${workSheetId}/${viewId}`);
      }
    });
};

export function View(props) {
  const { appId, setting = {}, className, layoutType, filtersGroup = [], themeColor } = props;
  const { id, apkId, value, viewId, config = {} } = setting;
  const singleViewRef = useRef();
  const isMobileLayout = isMobile || layoutType === 'mobile';
  const translateInfo = getTranslateInfo(appId, null, id);
  const Component = isMobileLayout ? LoadableMobileSingleView : LoadableSingleView;
  const showTitle = config.showTitle ?? true;

  // === iframe 弹框相关 ===
  const menuConfigRef = useRef(null);
  const [iframeState, setIframeState] = useState({ visible: false, src: '', title: '' });
  // 用于关闭 iframe 后强制刷新 SingleView（变更 key 触发重挂载）
  const [refreshKey, setRefreshKey] = useState(0);

  // 首次挂载时判断是否命中 iframe 菜单
  useEffect(() => {
    const currentMenuAppId = id;
    const cfg = getMenuConfig(currentMenuAppId);
    menuConfigRef.current = cfg;

    if (cfg) {
      // 挂全局 hook 拦截行点击
      window.__CUSTOM_PAGE_IFRAME_HOOK__ = {
        enabled: true,
        onRowClick: row => {
          const cfg = menuConfigRef.current;
          if (!cfg) return;

          buildDetailUrl(cfg, row).then(url => {
            if (!url) {
              console.warn('[iframe hook] 构建 URL 失败', { row, cfg });
              return;
            }
            setIframeState({
              visible: true,
              src: url,
            });
          });
        },
      };

      return () => {
        // 卸载时清理 hook（避免误触发其他页面）
        if (window.__CUSTOM_PAGE_IFRAME_HOOK__?.enabled) {
          window.__CUSTOM_PAGE_IFRAME_HOOK__ = null;
        }
      };
    }

    return undefined;
  }, [apkId, appId]);

  if (_.isEmpty(viewId)) {
    return (
      <EmptyView className="SingleViewWrap valignWrapper emptyView">
        <div className="Font15 textTertiary">{_l('请先选择一个视图')}</div>
      </EmptyView>
    );
  }

  return (
    <ViewWrap
      style={{
        '--app-primary-color': themeColor,
        '--app-primary-hover-color': themeColor,
      }}
      className={cx(className, [layoutType], {
        hideAddRecord: window.shareState.shareId ? true : !config.isAddRecord,
        hideSearchRecord: !config.searchRecord,
      })}
    >
      <Suspense fallback={<LoadDiv className="mTop10" />}>
        <Component
          key={refreshKey}
          showHeader={showTitle}
          ref={singleViewRef}
          appId={apkId || appId}
          singleAppId={appId}
          worksheetId={value}
          viewId={viewId}
          maxCount={config.maxCount}
          pageSize={config.pageCount}
          authRefreshTime={config.refresh}
          filtersGroup={filtersGroup}
          config={config}
          headerLeft={
            <div className="SingleViewName flexRow alignItemsCenter flex">
              <span
                className={cx('Font15 bold ellipsis name', {
                  pointer: config.openView,
                })}
                onClick={() => {
                  if (config.openView) {
                    navigateToView(value, viewId);
                  }
                }}
              >
                {translateInfo.name || config.name}
              </span>
              {config.desc && (
                <Tooltip title={config.desc} placement="bottom">
                  <Icon icon="info" className="Font18 pointer textTertiary mLeft7" />
                </Tooltip>
              )}
            </div>
          }
        />
      </Suspense>

      {/* iframe 详情弹框 */}
      <IframeModal
        visible={iframeState.visible}
        src={iframeState.src}
        onClose={() => setIframeState({ visible: false, src: '', title: '' })}
        afterClose={() => setRefreshKey(k => k + 1)}
      />
    </ViewWrap>
  );
}

export default function Preview(props) {
  const { loading, ids = {}, setting } = props;
  const { appId } = ids;
  return (
    <Wrap>
      {loading ? (
        <EmptyView className="SingleViewWrap valignWrapper emptyView">
          <LoadDiv className="mTop10" />
        </EmptyView>
      ) : (
        <View className="disableSingleView" appId={appId} setting={setting} />
      )}
    </Wrap>
  );
}
