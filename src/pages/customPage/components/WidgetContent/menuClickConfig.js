import localForage from 'localforage';
import _ from 'lodash';
import worksheetApi from 'src/api/worksheet';

/**
 * 固定常量
 */
const DEFAULT_APP_ID = '2537d1b8-170a-4c02-abdf-124e610b194c';

/** 懒加载语言（模块初始化时 md.global 可能还未就绪） */
function getLang() {
  return _.get(md, 'global.Account.lang') || 'zh-Hans';
}

/**
 * 菜单 → 表格行点击弹框映射表
 * 每个 entry 对应一个自定义页面菜单：
 *   - menuAppId     : 自定义页面所属的应用 ID，用于命中匹配
 *   - worksheetId   : 表格 widget 绑定的工作表 ID（用于查 controls 定义）
 *   - detailUrl     : iframe 页面 URL 模板（含空占位参数，运行时替换）
 *   - instanceIdRule: instanceId 特殊处理 —— 特定 worksheetId 下取 rowId，否则取 "关联实例" 字段
 */
export const MENU_IFRAME_CONFIG = [
  {
    menuName: '业务台账',
    menuAppId: '6a632c28aca80ffffd67e1c8',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    // instanceId 特殊规则：worksheetId === '6a632c256f0d1cf1793b75d1' → 取 rowId
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '发文业务台账',
    menuAppId: '6a72dc56aca80ffffd723afe',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '收文业务台账',
    menuAppId: '6a72dc97aca80ffffd723b0c',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '我管理的流程',
    menuAppId: '6a632c28aca80ffffd67e1c5',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '业务流程管理',
    menuAppId: '6a632c28aca80ffffd67e1b5',
    worksheetId: '6a632c256f0d1cf1793b75d1',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&appid=&userId=&type=instance',
    instanceIdFromRowId: true,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办台账',
    menuAppId: '6a632c28aca80ffffd67e1bb',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl:
      'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false, // instanceId 取 "关联实例" 字段
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办台账',
    menuAppId: '6a632c28aca80ffffd67e1c0',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl:
      'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办任务台账（发文管理）',
    menuAppId: '6a632c28aca80ffffd67e1c1',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl:
      'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办任务台账（发文管理）',
    menuAppId: '6a632c28aca80ffffd67e1ba',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl:
      'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待办任务台账（收文管理）',
    menuAppId: '6a632c28aca80ffffd67e1b4',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl:
      'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '已办任务台账（收文管理）',
    menuAppId: '6a632c28aca80ffffd67e1bf',
    worksheetId: '6a632c256f0d1cf1793b75d0',
    detailUrl:
      'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo',
    instanceIdFromRowId: false,
    customFields: { nodeId: '节点ID' },
  },
  {
    menuName: '待阅台账',
    menuAppId: '6a632c28aca80ffffd67e1c2',
    worksheetId: '6a632c256f0d1cf1793b75dd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&userId=&ccRecordId=&appid=&isRead=&type=cc',
    customFields: { isRead: '阅读状态' },
  },
  {
    menuName: '已阅台账',
    menuAppId: '6a632c28aca80ffffd67e1c4',
    worksheetId: '6a632c256f0d1cf1793b75dd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=todo-detail&userId=&ccRecordId=&appid=&isRead=&type=cc',
    customFields: { isRead: '阅读状态' },
  },
  {
    menuName: '待签收',
    menuAppId: '6a632c28aca80ffffd67e1b6',
    worksheetId: '6a632c256f0d1cf1793b75bd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=distribute-sign&appId=&recordId=&userId=',
  },
  {
    menuName: '已签收',
    menuAppId: '6a632c28aca80ffffd67e1c7',
    worksheetId: '6a632c256f0d1cf1793b75bd',
    detailUrl: 'https://zttt.crecg-jt.com:18001/?tab=distribute-sign&appId=&recordId=&userId=',
  },
];

/** 快速查找：menuAppId → config */
const menuIndex = _.keyBy(MENU_IFRAME_CONFIG, 'menuAppId');

/**
 * 根据 menuAppId 查找配置
 */
export function getMenuConfig(menuAppId) {
  return menuIndex[menuAppId];
}

/**
 * 从 IndexedDB localForage 缓存中读取 worksheet controls 定义
 * key 格式：Worksheet_GetWorksheetBaseInfo_${worksheetId}_${lang}
 */
function loadWorksheetBaseInfo(worksheetId) {
  const cacheKey = `Worksheet_GetWorksheetBaseInfo_${worksheetId}_${getLang()}`;
  return localForage.getItem(cacheKey).then(cache => _.get(cache, 'data') || null);
}

/**
 * 在 worksheet controls 里，通过 controlName（中文名）找 controlId
 * @returns {string|null}
 */
function findControlIdByName(controls, controlName) {
  if (!_.isArray(controls)) return null;
  const matched = controls.find(c => c.controlName === controlName);
  return matched ? matched.controlId : null;
}

/**
 * 从 row 数据里取某个 controlId 的值
 * 明道云 row 对象里，自定义字段的 key 是 controlId，系统字段（rowid、caid 等）直接用字段名
 */
function getRowValue(row, controlId) {
  if (!row) return '';
  // row 数据可能有两套 key：controlId（后端原样返回） 或 alias（前端处理后）
  // 先直接取
  if (row[controlId] !== undefined && row[controlId] !== null) {
    const val = row[controlId];
    // 关联记录类型（type=29）可能是数组 {rowid, name}
    if (_.isArray(val)) {
      return val.length > 0 ? val[0].rowid || val[0].name || val[0] : '';
    }
    if (_.isObject(val)) {
      return val.rowid || val.name || val.value || JSON.stringify(val);
    }
    return val;
  }
  return '';
}

/**
 * 构建 iframe URL
 *
 * @param {object} config  - menuConfig 条目
 * @param {object} row     - 表格行数据
 * @param {object} worksheetInfo - worksheet 基础信息（用于查 controls）
 * @returns {string} 完整 URL
 */
export async function buildDetailUrl(config, row, worksheetInfo) {
  if (!config || !row) return '';

  const rowId = row.rowid || '';
  const userId = _.get(md, 'global.Account.accountId') || '';
  const controls = _.get(worksheetInfo, 'template.controls') || [];

  // 先准备好各参数的值（按 doc 的 paramsDesc 规则）
  const params = {
    // 固定值
    appid: DEFAULT_APP_ID,
    appId: DEFAULT_APP_ID,
    userId,
    // 直接从 rowId 取的
    recordId: rowId,
    ccRecordId: rowId,
    runNodeRowId: rowId,
    // 自定义字段（需要先查 controlId）
    nodeId: '',
    isRead: '',
    instanceId: '',
  };

  // instanceId 特殊处理
  if (config.instanceIdFromRowId) {
    params.instanceId = rowId;
  } else {
    const relationControlId = findControlIdByName(controls, '关联实例');
    params.instanceId = relationControlId ? getRowValue(row, relationControlId) : '';
  }

  // 其他自定义字段
  _.forEach(config.customFields || {}, (controlName, paramKey) => {
    const controlId = findControlIdByName(controls, controlName);
    params[paramKey] = controlId ? getRowValue(row, controlId) : '';
  });

  // 替换 detailUrl 模板里的空占位参数
  let url = config.detailUrl;
  _.forEach(params, (value, key) => {
    // 匹配 &key= 或 &key=& 后的空值（包括 &key=value 已有值也覆盖，但 doc 模板里都是空）
    const re = new RegExp(`(${key}=)([^&]*)`, 'g');
    url = url.replace(re, `$1${encodeURIComponent(value)}`);
  });

  return url;
}

/**
 * 加载 worksheetInfo（优先从缓存，没有则返回 null）
 * 调用方可以在页面加载时预加载，避免用户点击时阻塞
 */
export function preloadWorksheetBaseInfo(worksheetId) {
  if (!worksheetId) return Promise.resolve(null);
  return loadWorksheetBaseInfo(worksheetId);
}

/**
 * 流程待办卡片 → 审批详情 iframe URL 模板（参考 menuClickConfig "待办台账" 条目）
 */
const WORKFLOW_APP_ID = '2537d1b8-170a-4c02-abdf-124e610b194c';
const WORKFLOW_WORKSHEET_ID = '6a632c256f0d1cf1793b75d0';
const WORKFLOW_DETAIL_URL_TEMPLATE =
  'https://zttt.crecg-jt.com:18001/?tab=todo-detail&instanceId=&nodeId=&runNodeRowId=&userId=&appid=&type=todo';

/**
 * 流程待办卡片的 app.id 值命中时，用 iframe 替换默认 ExecDialog
 */
export function shouldUseWorkflowIframe(item) {
  return _.get(item, 'app.id') === WORKFLOW_APP_ID;
}

/**
 * 为流程待办卡片（MyProcess）构建审批详情 iframe URL
 *
 *   - "关联实例" → instanceId（UUID）
 *   - "节点ID"   → nodeId
 *
 * @param {object} item - 待办卡片数据（from instanceVersion.getTodoList）
 *   关键字段：id=流程实例ID, workId=工作项ID
 * @returns {Promise<string>}
 */
export async function buildWorkflowDetailUrl(item) {
  if (!item) return '';

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
        worksheetId: WORKFLOW_WORKSHEET_ID,
        rowId,
        getTemplate: true,
      });

      const receiveControls =
        _.get(rowRes, 'receiveControls') ||
        _.get(rowRes, 'row.receiveControls') ||
        [];

      // 按 controlName 取值
      const relation = _.find(receiveControls, { controlName: '关联实例' });
      instanceId = relation?.value || '';

      const node = _.find(receiveControls, { controlName: '节点ID' });
      nodeId = node?.value || '';

      const params = {
        instanceId,
        nodeId,
        runNodeRowId: item.workId || '',
        userId: _.get(md, 'global.Account.accountId') || '',
        appid: WORKFLOW_APP_ID,
      };

      let url = WORKFLOW_DETAIL_URL_TEMPLATE;
      _.forEach(params, (value, key) => {
        const re = new RegExp(`(${key}=)([^&]*)`, 'g');
        url = url.replace(re, `$1${encodeURIComponent(value)}`);
      });

      return url;
    }
  } catch (e) {
    console.log('[buildWorkflowDetailUrl] 获取 worksheet 行数据失败，退化为最小 URL', e);
  }

  const runNodeRowId = item.workId || '';
  const userId = _.get(md, 'global.Account.accountId') || '';
  let url = WORKFLOW_DETAIL_URL_TEMPLATE;
  url = url.replace(/(runNodeRowId=)([^&]*)/, `$1${encodeURIComponent(runNodeRowId)}`);
  url = url.replace(/(userId=)([^&]*)/, `$1${encodeURIComponent(userId)}`);
  url = url.replace(/(appid=)([^&]*)/, `$1${encodeURIComponent(WORKFLOW_APP_ID)}`);
  return url;
}
