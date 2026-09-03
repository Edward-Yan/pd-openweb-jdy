import _ from 'lodash';
import worksheetApi from 'src/api/worksheet';

/**
 * 固定常量
 */
const DEFAULT_APP_ID = 'c378a60b-d734-4608-a351-d01e66b07f05';
const TEST_APP_ID = '2537d1b8-170a-4c02-abdf-124e610b194c';

/**
 * 菜单 → 表格行点击弹框映射表
 * 多套配置（默认 + 测试）共存，按 menuAppId 天然区分（不冲突）
 * 每个 entry：
 *   - appId          : 所属应用 ID（用于拼 iframe URL 的 appid 参数）
 *   - menuAppId      : 自定义页面所属的应用 ID，用于命中匹配
 *   - worksheetId    : 表格 widget 绑定的工作表 ID
 *   - detailUrl      : iframe 页面 URL 模板
 *   - instanceIdFromRowId : true → instanceId = rowId；false → 取 "关联实例" 字段
 *   - customFields   : 其他需要从 receiveControls 按 controlName 取值的字段
 */
const MENU_IFRAME_CONFIGS = [
  // ========== 默认（线上）配置 ==========
  {
    menuName: '业务台账',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c37d',
    worksheetId: '6a94e222e171f989ce3c0cc0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '发文业务台账',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c378',
    worksheetId: '6a94e222e171f989ce3c0cc0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '收文业务台账',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c37b',
    worksheetId: '6a94e222e171f989ce3c0cc0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '我管理的流程',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c387',
    worksheetId: '6a94e222e171f989ce3c0cc0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '业务流程管理',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c388',
    worksheetId: '6a94e222e171f989ce3c0cc0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办台账',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c386',
    worksheetId: '6a94e222e171f989ce3c0cc1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办台账',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c37a',
    worksheetId: '6a94e222e171f989ce3c0cc1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办任务台账（发文管理）',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c37f',
    worksheetId: '6a94e222e171f989ce3c0cc1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办任务台账（发文管理）',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c38b',
    worksheetId: '6a94e222e171f989ce3c0cc1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办任务台账（收文管理）',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c389',
    worksheetId: '6a94e222e171f989ce3c0cc1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办任务台账（收文管理）',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c382',
    worksheetId: '6a94e222e171f989ce3c0cc1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待阅台账',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c385',
    worksheetId: '6a94e222e171f989ce3c0cb4',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&userId=&ccRecordId=&appid=&isRead=&type=cc',
    customFields: { isRead: '阅读状态' },
  },
  {
    menuName: '已阅台账',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c38c',
    worksheetId: '6a94e222e171f989ce3c0cb4',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&userId=&ccRecordId=&appid=&isRead=&type=cc',
    customFields: { isRead: '阅读状态' },
  },
  {
    menuName: '待签收',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c379',
    worksheetId: '6a94e222e171f989ce3c0cc6',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=distribute-sign&appId=&recordId=&userId=',
  },
  {
    menuName: '已签收',
    appId: DEFAULT_APP_ID,
    menuAppId: '6a94e2285fa340b327d2c381',
    worksheetId: '6a94e222e171f989ce3c0cc6',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=distribute-sign&appId=&recordId=&userId=',
  },
  // ========== 测试环境配置 ==========
  {
    menuName: '业务台账',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1c8',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '发文业务台账',
    appId: TEST_APP_ID,
    menuAppId: '6a72dc56aca80ffffd723afe',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '收文业务台账',
    appId: TEST_APP_ID,
    menuAppId: '6a72dc97aca80ffffd723b0c',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '我管理的流程',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1c5',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '业务流程管理',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1b5',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办台账',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1bb',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办台账',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1c0',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办任务台账（发文管理）',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1c1',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办任务台账（发文管理）',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1ba',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办任务台账（收文管理）',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1b4',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办任务台账（收文管理）',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1bf',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待阅台账',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1c2',
    worksheetId: '6a632c256f0d1cf1793b75dd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&userId=&ccRecordId=&appid=&isRead=&type=cc',
    customFields: { isRead: '阅读状态' },
  },
  {
    menuName: '已阅台账',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1c4',
    worksheetId: '6a632c256f0d1cf1793b75dd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&userId=&ccRecordId=&appid=&isRead=&type=cc',
    customFields: { isRead: '阅读状态' },
  },
  {
    menuName: '待签收',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1b6',
    worksheetId: '6a632c256f0d1cf1793b75bd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=distribute-sign&appId=&recordId=&userId=',
  },
  {
    menuName: '已签收',
    appId: TEST_APP_ID,
    menuAppId: '6a632c28aca80ffffd67e1c7',
    worksheetId: '6a632c256f0d1cf1793b75bd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=distribute-sign&appId=&recordId=&userId=',
  },
];

/** 快速查找：menuAppId → config */
const menuIndex = _.keyBy(MENU_IFRAME_CONFIGS, 'menuAppId');

/**
 * 根据 menuAppId 查找配置
 */
export function getMenuConfig(menuAppId) {
  return menuIndex[menuAppId];
}

/**
 * 构建 iframe URL（通过 getRowByID 的 receiveControls 按 controlName 取值）
 *
 * @param {object} config  - menuConfig 条目
 * @param {object} row     - 表格行数据（含 rowid）
 * @returns {Promise<string>} 完整 URL
 */
export async function buildDetailUrl(config, row) {
  if (!config || !row) return '';

  const rowId = row.rowid || '';
  const userId = _.get(md, 'global.Account.accountId') || '';

  let instanceId = '';
  let customFieldValues = {};

  try {
    if (rowId) {
      const rowRes = await worksheetApi.getRowByID({
        worksheetId: config.worksheetId,
        rowId,
        getTemplate: true,
      });

      const receiveControls =
        _.get(rowRes, 'receiveControls') ||
        _.get(rowRes, 'row.receiveControls') ||
        [];

      // instanceId
      if (config.instanceIdFromRowId) {
        instanceId = rowId;
      } else {
        const relation = _.find(receiveControls, { controlName: '关联实例' });
        instanceId = relation?.value || '';
      }

      // customFields：paramKey → controlName
      _.forEach(config.customFields || {}, (controlName, paramKey) => {
        const control = _.find(receiveControls, { controlName });
        customFieldValues[paramKey] = control?.value || '';
      });
    }
  } catch (e) {
    console.warn('[buildDetailUrl] getRowByID 失败，退化为最小 URL', e);
    if (config.instanceIdFromRowId) {
      instanceId = rowId;
    }
  }

  const params = {
    appid: config.appId || DEFAULT_APP_ID,
    appId: config.appId || DEFAULT_APP_ID,
    userId,
    recordId: rowId,
    ccRecordId: rowId,
    runNodeRowId: rowId,
    instanceId,
    ...customFieldValues,
  };

  let url = config.detailUrl;
  _.forEach(params, (value, key) => {
    const re = new RegExp(`(${key}=)([^&]*)`, 'g');
    url = url.replace(re, `$1${encodeURIComponent(value)}`);
  });

  return url;
}

/**
 * 流程待办 iframe 配置（多套 appId/worksheetId 共存，遍历时自然区分）
 * 每条含：appId（匹配 item.app.id）、worksheetId（getRowByID 用）、detailUrl
 */
const WORKFLOW_IFRAME_CONFIGS = [
  {
    appId: DEFAULT_APP_ID,
    worksheetId: '6a94e222e171f989ce3c0cc1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
  },
  {
    appId: TEST_APP_ID,
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
  },
];

/** @param {object} item - 待办卡片数据，关键字段 app.id */
function findWorkflowConfig(item) {
  const appId = _.get(item, 'app.id');
  return _.find(WORKFLOW_IFRAME_CONFIGS, { appId });
}

/**
 * 流程待办卡片的 app.id 命中任何一套配置时，用 iframe 替换默认 ExecDialog
 */
export function shouldUseWorkflowIframe(item) {
  return !!findWorkflowConfig(item);
}

/**
 * 为流程待办卡片（MyProcess）构建审批详情 iframe URL
 *
 * 先按 item.app.id 找到对应 workflowConfig，再从 config.worksheetId 查行数据
 *
 * @param {object} item - 待办卡片数据（from instanceVersion.getTodoList）
 * @returns {Promise<string>}
 */
export async function buildWorkflowDetailUrl(item) {
  if (!item) return '';

  const workflowConfig = findWorkflowConfig(item);
  if (!workflowConfig) return '';

  let instanceId = '';
  let nodeId = '';

  try {
    // 1. 通过 workId 反查 worksheet 行 ID
    const workItemRes = await worksheetApi.getWorkItem({
      instanceId: item.id,
      workId: item.workId,
    });
    const rowId = _.get(workItemRes, 'rowId') || '';

    if (rowId) {
      const rowRes = await worksheetApi.getRowByID({
        worksheetId: workflowConfig.worksheetId,
        rowId,
        getTemplate: true,
      });

      const receiveControls =
        _.get(rowRes, 'receiveControls') ||
        _.get(rowRes, 'row.receiveControls') ||
        [];

      const relation = _.find(receiveControls, { controlName: '关联实例' });
      instanceId = relation?.value || '';

      const node = _.find(receiveControls, { controlName: '节点ID' });
      nodeId = node?.value || '';

      const params = {
        instanceId,
        nodeId,
        runNodeRowId: item.workId || '',
        userId: _.get(md, 'global.Account.accountId') || '',
        appid: workflowConfig.appId,
      };

      let url = workflowConfig.detailUrl;
      _.forEach(params, (value, key) => {
        const re = new RegExp(`(${key}=)([^&]*)`, 'g');
        url = url.replace(re, `$1${encodeURIComponent(value)}`);
      });

      return url;
    }
  } catch (e) {
    console.warn('[buildWorkflowDetailUrl] 获取 worksheet 行数据失败，退化为最小 URL', e);
  }

  const runNodeRowId = item.workId || '';
  const userId = _.get(md, 'global.Account.accountId') || '';
  let url = workflowConfig.detailUrl;
  url = url.replace(/(runNodeRowId=)([^&]*)/, `$1${encodeURIComponent(runNodeRowId)}`);
  url = url.replace(/(userId=)([^&]*)/, `$1${encodeURIComponent(userId)}`);
  url = url.replace(/(appid=)([^&]*)/, `$1${encodeURIComponent(workflowConfig.appId)}`);
  return url;
}
