import _ from 'lodash';
import axios from 'axios';
import worksheetApi from 'src/api/worksheet';

/**
 * iframe 基础地址（后端配置表中的 detailUrl 只存储 query 参数部分）
 */
const IFRAME_BASE_URL = 'https://zttt.crecg-jt.com:18001/?';

/**
 * 后端接口地址
 */
const CONFIG_API_URL = 'https://zttt.crecg-jt.com:18001/api/sync/exec-app-data-config';

/**
 * localStorage 缓存 key，用于持久化配置（减少启动时的接口请求）
 */
const CACHE_KEY = 'exec_app_data_config_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟

/**
 * IFrameConfigLoader —— 配置加载器
 *
 * 职责：
 * 1. 模块首次被 import 时就尝试加载配置（先读 localStorage 缓存，再异步请求接口）
 * 2. 内存中维护两份索引：
 *    - menuIndex      : menuAppId → MENU_IFRAME_CONFIG 条目
 *    - workflowIndex  : appId     → WORKFLOW_IFRAME_CONFIG 条目
 * 3. 对外暴露同步 getter 和一个 ensureLoaded() Promise
 *    - ensureLoaded() 供组件在首次渲染前 await，避免未命中
 *    - getter 在 cache 就绪前返回 null / false
 */
class IFrameConfigLoader {
  constructor() {
    this.menuIndex = {};      // menuAppId → menuConfig
    this.workflowIndex = {};  // appId → workflowConfig
    this._loadingPromise = null;
    this._cacheLoaded = false;

    // 启动时立即尝试加载
    this._loadingPromise = this._init();
  }

  async _init() {
    // 1. 先尝试读 localStorage 缓存（同步），尽快填充 menuIndex
    const cached = this._readCache();
    if (cached) {
      this._applyConfigList(cached);
      this._cacheLoaded = true;
    }

    // 2. 无论是否命中缓存，都异步请求最新数据（保证刷新后生效）
    try {
      await this._fetchFromApi();
    } catch (e) {
      console.warn('[IFrameConfigLoader] 配置接口请求失败，使用缓存数据', e);
    }
    return this;
  }

  _readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { list, ts } = JSON.parse(raw);
      if (!list || !Array.isArray(list)) return null;
      if (Date.now() - (ts || 0) > CACHE_TTL) return null;
      return list;
    } catch (_) {
      return null;
    }
  }

  _writeCache(list) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ list, ts: Date.now() }),
      );
    } catch (_) {
      // 忽略 localStorage 写入失败
    }
  }

  async _fetchFromApi() {
    const { data } = await axios.get(CONFIG_API_URL, {
      timeout: 8000,
    });
    console.log('配置信息', data)
    // 兼容两种返回格式：{ success, data: { list } } / 直接数组
    const list = _.get(data, 'data.list') || _.get(data, 'list') || (Array.isArray(data) ? data : []);
    if (_.get(data, 'success') === false || !list.length) {
      return;
    }

    this._applyConfigList(list);
    this._writeCache(list);
    this._cacheLoaded = true;
  }

  _applyConfigList(list) {
    const newMenuIndex = {};
    const newWorkflowIndex = {};

    list.forEach(entry => {
      const appId = entry.appId;
      const cfg = entry.config || {};

      // menu 配置 —— 用 appId + menuAppId 做复合 key，避免不同应用的 menuAppId 冲突
      const menuList = cfg.MENU_IFRAME_CONFIGS || [];
      menuList.forEach(item => {
        const fullUrl = this._resolveDetailUrl(item.detailUrl);
        const effectiveAppId = item.appId || appId;
        const key = `${effectiveAppId}__${item.menuAppId}`;
        newMenuIndex[key] = {
          ...item,
          appId: effectiveAppId,
          detailUrl: fullUrl,
        };
      });

      // workflow 配置 —— appId 本身唯一，保持原逻辑
      const wfList = cfg.WORKFLOW_IFRAME_CONFIGS || [];
      wfList.forEach(item => {
        const fullUrl = this._resolveDetailUrl(item.detailUrl);
        newWorkflowIndex[item.appId || appId] = {
          ...item,
          detailUrl: fullUrl,
        };
      });
    });

    this.menuIndex = newMenuIndex;
    this.workflowIndex = newWorkflowIndex;
  }

  /**
   * 后端 detailUrl 可能只存 query 参数（"tab=todo-detail&..."），
   * 也可能是完整 URL（兼容旧格式），这里统一补全。
   */
  _resolveDetailUrl(detailUrl) {
    if (!detailUrl) return '';
    if (/^https?:\/\//.test(detailUrl)) return detailUrl;
    return `${IFRAME_BASE_URL}${detailUrl}`;
  }

  /** 等待首次加载完成（组件可 await） */
  ensureLoaded() {
    return this._loadingPromise || Promise.resolve(this);
  }

  /** 强制重新拉取接口数据 */
  async reload() {
    this._loadingPromise = this._fetchFromApi();
    await this._loadingPromise;
  }

  /** 根据 appId + menuAppId 查找菜单配置（同步，未就绪时返回 undefined） */
  getMenuConfig(appId, menuAppId) {
    if (!appId || !menuAppId) return undefined;
    return this.menuIndex[`${appId}__${menuAppId}`];
  }

  /** 根据 appId 查找 workflow 配置（同步，未就绪时返回 undefined） */
  getWorkflowConfig(appId) {
    if (!appId) return undefined;
    return this.workflowIndex[appId];
  }
}

/** 单例实例，模块加载即启动 */
const loader = new IFrameConfigLoader();

/* ==================== 对外导出的工具函数 ==================== */

/**
 * 根据 appId + menuAppId 查找菜单配置
 *
 * 同步版本：首次渲染时可能返回 undefined，建议在组件中配合 ensureLoaded 使用。
 *
 * @param {string} appId      当前应用的 appId（如 2537d1b8-...）
 * @param {string} menuAppId  当前自定义页面所属的 menuAppId（如 6a632c28...）
 */
export function getMenuConfig(appId, menuAppId) {
  return loader.getMenuConfig(appId, menuAppId);
}

/**
 * 根据 appId + menuAppId 查找菜单配置（异步，确保配置已加载）
 */
export async function getMenuConfigAsync(appId, menuAppId) {
  await loader.ensureLoaded();
  return loader.getMenuConfig(appId, menuAppId);
}

/**
 * 等待配置加载完成（组件在 useEffect 中可 await）
 */
export async function ensureIframeConfigLoaded() {
  return loader.ensureLoaded();
}

/**
 * 强制重新加载配置
 */
export function reloadIframeConfig() {
  return loader.reload();
}

/**
 * 构建菜单 iframe 详情 URL
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
    appid: config.appId,
    appId: config.appId,
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
  console.log('构建的 URL', url);
  return url;
}

/** @param {object} item - 待办卡片数据，关键字段 app.id */
function findWorkflowConfig(item) {
  const appId = _.get(item, 'app.id');
  return loader.getWorkflowConfig(appId);
}

/**
 * 流程待办卡片的 app.id 命中任何一套配置时，用 iframe 替换默认 ExecDialog
 *
 * 同步版本（未加载完成时返回 false）
 */
export function shouldUseWorkflowIframe(item) {
  return !!findWorkflowConfig(item);
}

/**
 * 是否命中 workflow iframe 配置（异步，确保配置已加载）
 */
export async function shouldUseWorkflowIframeAsync(item) {
  await loader.ensureLoaded();
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
  let rowId = '';
  try {
    // 1. 通过 workId 反查 worksheet 行 ID
    const workItemRes = await worksheetApi.getWorkItem({
      instanceId: item.id,
      workId: item.workId,
    });
    rowId = _.get(workItemRes, 'rowId') || '';

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
        runNodeRowId: rowId || '',
        userId: _.get(md, 'global.Account.accountId') || '',
        appid: workflowConfig.appId,
      };

      let url = workflowConfig.detailUrl;
      _.forEach(params, (value, key) => {
        const re = new RegExp(`(${key}=)([^&]*)`, 'g');
        url = url.replace(re, `$1${encodeURIComponent(value)}`);
      });
      console.log('构建的审批详情 URL', url);
      return url;
    }
  } catch (e) {
    console.warn('[buildWorkflowDetailUrl] 获取 worksheet 行数据失败，退化为最小 URL', e);
  }

  const runNodeRowId = rowId || '';
  const userId = _.get(md, 'global.Account.accountId') || '';
  let url = workflowConfig.detailUrl;
  url = url.replace(/(runNodeRowId=)([^&]*)/, `$1${encodeURIComponent(runNodeRowId)}`);
  url = url.replace(/(userId=)([^&]*)/, `$1${encodeURIComponent(userId)}`);
  url = url.replace(/(appid=)([^&]*)/, `$1${encodeURIComponent(workflowConfig.appId)}`);
  return url;
}

/* ==================== 兼容旧名（如果外部有引用） ==================== */
export const MENU_IFRAME_CONFIGS = []; // 保留导出名，避免直接引用时报错
export const WORKFLOW_IFRAME_CONFIGS = [];
