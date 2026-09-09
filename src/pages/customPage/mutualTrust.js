import _ from 'lodash';
import axios from 'axios';

/**
 * 互信认证公用方法（从 customPage/pageContent/index.jsx 抽取）
 *
 * 流程：详情页 url 的 query 中含 sysMutualTrust=true 时，解析 targetSystemId/userId，
 * 以去掉互信参数后的 url 作为 redirectUrl，SHA256withRSA 签名后请求 jumpToken，
 * 最终 iframe 地址改为认证中心地址（认证通过后由认证中心跳回 redirectUrl）
 */

/** 源系统 ID（本系统在互信平台注册的 ID） */
const SOURCE_SYSTEM_ID = 'd03fb5f3-189e-4586-b1f7-45c75364cfeb';

/**
 * token 接口地址
 * dev 由 CI/serve.js 代理、prod 由 nginx 代理，统一转发至 https://zttt.crecg-jt.com/api/sso/system/token，避免跨域
 */
const TOKEN_API_URL = '/zttt_api/sso/system/token';

/** 认证中心地址 */
const AUTH_CENTER_URL = 'https://zttt.crecg-jt.com/mutual-trust/auth-center/authenticate';

/** 私钥缓存（模块级，只导入一次） */
let cachedKey = null;

/**
 * 导入 PKCS#8 私钥
 * 只在首次调用时执行，之后用缓存
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
 * SHA256withRSA 签名，返回 Base64
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

/**
 * 移除 url 上的指定 query 参数
 */
const handleRedirectUrl = (urlStr, keysToRemove) => {
  if (!keysToRemove || !Array.isArray(keysToRemove) || keysToRemove.length === 0) {
    return urlStr;
  }
  const urlObj = new URL(urlStr);
  // 收集要删除的 key（避免在遍历中直接 delete 导致迭代异常）
  const toDelete = keysToRemove.filter(k => urlObj.searchParams.has(k));
  toDelete.forEach(k => urlObj.searchParams.delete(k));
  return urlObj.toString();
};

/**
 * 解析 url 中的互信认证参数
 *
 * @param {string} url 详情页完整地址
 * @returns {object|null} 未启用互信（sysMutualTrust !== 'true' 或 url 非法）时返回 null，
 *                        否则返回 { targetSystemId, userId, cookie, redirectUrl, paramsKey }
 */
export function parseMutualTrustParams(url, sysMutualTrust) {
  try {
    const urlParams = new URLSearchParams(new URL(url).search);
    if (urlParams.get('sysMutualTrust') === 'false') return null;

    const targetSystemId = urlParams.get('targetSystemId');
    const userId = urlParams.get('userId');
    const cookie = window.getCookie('md_pss_id') || '';
    const redirectUrl = handleRedirectUrl(url, ['sysMutualTrust', 'targetSystemId']);

    return {
      targetSystemId,
      userId,
      cookie,
      redirectUrl,
      // 参数键：用于调用方判断是否已为该组参数发起过请求
      paramsKey: `${targetSystemId}|${userId}|${redirectUrl}|${cookie}`,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 互信认证：请求 jumpToken
 *
 * @param {string} url 详情页完整地址（query 中需含 sysMutualTrust/targetSystemId/userId）
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] 用于取消请求
 * @param {string} [options.sourceSystemId] 外部传入的源系统 ID（覆盖默认常量）
 * @param {string} [options.targetSystemId] 外部传入的目标系统 ID（覆盖 URL 解析值）
 * @returns {Promise<string>} jumpToken
 */
export async function fetchMutualTrustToken(url, options = {}) {
  const parsed = parseMutualTrustParams(url);
  if (!parsed) throw new Error(_l('未启用互信认证'));

  // 外部传入的 sourceSystemId / targetSystemId 优先，未传入时回退到 URL 解析值 / 默认常量
  const sourceSystemId = options.sourceSystemId || SOURCE_SYSTEM_ID;
  const targetSystemId = options.targetSystemId || parsed.targetSystemId;
  const { userId, cookie, redirectUrl } = parsed;

  if (!userId) {
    throw new Error('请配置用户ID(userId)');
  }
  if (!redirectUrl || !cookie) {
    throw new Error('未获取到相关参数');
  }

  const timestamp = String(Date.now());
  const params = {
    sourceSystemId,
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
  // 签名 → 请求 token
  const sign = await signHandler(signStr);
  if (!sign) throw new Error(_l('互信认证请求失败'));

  const res = await axios.post(
    TOKEN_API_URL,
    { ...params, sign },
    {
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
    },
  );

  if (res.status === 200) {
    if (res.data.success) {
      const jumpToken = _.get(res, 'data.data.jumpToken') || '';
      if (jumpToken) return jumpToken;
      throw new Error(_l('未获取到返回中的token'));
    }
    throw new Error(res.data?.msg || _l('获取互信认证token失败'));
  }
  throw new Error(_l('互信认证请求失败'));
}

/**
 * 构建认证中心跳转地址（jumpToken 就绪后使用）
 *
 * @param {string} jumpToken 互信认证跳转 token
 * @returns {string} 认证中心地址
 */
export function buildAuthCenterUrl(jumpToken) {
  return `${AUTH_CENTER_URL}?jumpToken=${jumpToken}`;
}

/**
 * 构建互信认证后的 iframe 地址
 *
 * 详情页 url 启用互信（sysMutualTrust=true）时：以该 url 作为 redirectUrl 换取 jumpToken，
 * 返回认证中心地址；未启用时原样返回；请求失败时提示并回退为原 url（保证详情页仍可打开）
 *
 * @param {string} url 详情页完整地址
 * @param {object} [options]
 * @param {string} [options.sourceSystemId] 外部传入的源系统 ID（覆盖默认常量，menuClickConfig 从配置接口获取后传入）
 * @param {string} [options.targetSystemId] 外部传入的目标系统 ID（覆盖 URL 解析值，menuClickConfig 从配置接口获取后传入）
 * @returns {Promise<string>} iframe 实际使用的地址
 */
export async function buildMutualTrustAuthUrl(url, options = {}) {
  if (!url || !parseMutualTrustParams(url)) return url;

  try {
    const jumpToken = await fetchMutualTrustToken(url, options);
    return buildAuthCenterUrl(jumpToken);
  } catch (error) {
    // 被主动取消：不提示，回退原 url
    if (axios.isCancel(error)) return url;
    console.warn('[mutualTrust] 获取互信认证token失败', error);
    alert(error.message || _l('互信认证请求失败'), 2);
    return url;
  }
}
