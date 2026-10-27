// 防 SSRF 的外部抓取：
// 1) 只允许 http/https、80/443/8080/8443 端口
// 2) DNS 解析后校验 IP，拒绝内网/回环/保留地址；连接时使用校验过的 IP（防 DNS rebinding）
// 3) 手动跟随重定向并逐跳校验；限制响应体大小与总超时
import http from 'http';
import https from 'https';
import dns from 'dns';
import net from 'net';
import zlib from 'zlib';
import { config } from './config.js';

const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

function ipv4ToInt(ip) { return ip.split('.').reduce((a, b) => (a << 8) + (+b), 0) >>> 0; }
const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([ip, bits]) => [ipv4ToInt(ip), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKS.some(([base, mask]) => ((n & mask) >>> 0) === ((base & mask) >>> 0));
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    if (l.startsWith('::ffff:')) return isPrivateAddress(l.slice(7));
    if (/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(l)) return true;
    if (l.startsWith('64:ff9b:') || l.startsWith('2001:db8')) return true;
    return false;
  }
  return true;
}

const dnsCache = new Map();
function safeLookup(hostname, options, cb) {
  const now = Date.now();
  const cached = dnsCache.get(hostname);
  if (cached && (now - cached.ts < 60000)) {
    const ok = cached.addrs;
    if (options && options.all) return cb(null, ok);
    return cb(null, ok[0].address, ok[0].family);
  }
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    const ok = config.allowPrivateTargets ? addrs : addrs.filter(a => !isPrivateAddress(a.address));
    if (!ok.length) {
      const e = new Error('目标地址指向内网或保留地址，已拒绝访问');
      e.code = 'EBLOCKED';
      return cb(e);
    }
    dnsCache.set(hostname, { addrs: ok, ts: now });
    if (options && options.all) return cb(null, ok);
    cb(null, ok[0].address, ok[0].family);
  });
}

export class FetchError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function validateUrl(u) {
  let url;
  try { url = new URL(u); } catch { throw new FetchError('网址格式不正确', 'EBADURL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new FetchError('仅支持 http/https 网址', 'EBADURL');
  if (!ALLOWED_PORTS.has(url.port) && !config.allowPrivateTargets) throw new FetchError('不支持该端口', 'EBADURL');
  if (url.username || url.password) throw new FetchError('网址中不能包含账号密码', 'EBADURL');
  if (!config.allowPrivateTargets && net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
    throw new FetchError('目标地址指向内网或保留地址，已拒绝访问', 'EBLOCKED');
  }
  return url;
}

function requestOnce(url, { method, headers, body, timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method,
      headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers },
      lookup: safeLookup,
      timeout: timeoutMs,
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ redirect: res.headers.location, status, headers: res.headers });
      }
      let stream = res;
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      try {
        if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      } catch { /* 忽略 */ }
      const chunks = []; let size = 0; let truncated = false;
      stream.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) { truncated = true; chunks.push(c.subarray(0, Math.max(0, c.length - (size - maxBytes)))); res.destroy(); return; }
        chunks.push(c);
      });
      const done = () => resolve({ status, headers: res.headers, buffer: Buffer.concat(chunks), truncated });
      stream.on('end', done);
      stream.on('close', () => { if (truncated) done(); });
      stream.on('error', (e) => (truncated ? done() : reject(e)));
    });
    req.on('timeout', () => req.destroy(new FetchError('连接目标网站超时', 'ETIMEOUT')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function decodeBody(buffer, headers) {
  const ct = String(headers['content-type'] || '');
  let charset = (ct.match(/charset=([^;]+)/i) || [])[1];
  if (!charset) {
    const head = buffer.subarray(0, 2048).toString('latin1');
    charset = (head.match(/<meta[^>]+charset=["']?([a-z0-9_-]+)/i) || [])[1];
  }
  charset = (charset || 'utf-8').toLowerCase().replace(/["']/g, '');
  if (charset === 'gb2312' || charset === 'gbk') charset = 'gb18030';
  try { return new TextDecoder(charset).decode(buffer); } catch { return buffer.toString('utf8'); }
}

/**
 * @returns {Promise<{status:number, headers:object, text:string, url:string, ms:number, truncated:boolean, redirects:number}>}
 */
export async function safeFetch(input, opts = {}) {
  const {
    method = 'GET', headers = {}, body, timeoutMs = 12000,
    maxBytes = 3 * 1024 * 1024, maxRedirects = 5,
  } = opts;
  const started = Date.now();
  let url = validateUrl(input);
  let redirects = 0;
  const deadline = started + timeoutMs;
  while (true) {
    const remain = deadline - Date.now();
    if (remain <= 0) throw new FetchError('连接目标网站超时', 'ETIMEOUT');
    let r;
    try {
      r = await requestOnce(url, { method, headers, body, timeoutMs: remain, maxBytes });
    } catch (e) {
      if (e instanceof FetchError) throw e;
      if (e.code === 'EBLOCKED') throw new FetchError(e.message, 'EBLOCKED');
      if (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN') throw new FetchError('域名无法解析，请检查网址是否正确', 'EDNS');
      if (e.code === 'ECONNREFUSED') throw new FetchError('目标服务器拒绝连接', 'EREFUSED');
      if (String(e.code || '').startsWith('ERR_TLS') || /certificate|SSL/i.test(e.message)) throw new FetchError('目标网站 HTTPS 证书异常', 'ETLS');
      throw new FetchError(`无法连接目标网站（${e.code || e.message}）`, 'ENET');
    }
    if (r.redirect) {
      if (++redirects > maxRedirects) throw new FetchError('重定向次数过多', 'EREDIRECT');
      url = validateUrl(new URL(r.redirect, url).toString());
      continue;
    }
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      headers: r.headers,
      text: opts.raw ? '' : decodeBody(r.buffer, r.headers),
      buffer: opts.raw ? r.buffer : undefined,
      url: url.toString(),
      ms: Date.now() - started,
      truncated: r.truncated,
      redirects,
    };
  }
}

export const BOT_UA = 'Mozilla/5.0 (compatible; DailyToolbox-GEO-Audit/2.0; +https://geo.dailytoolbox.org)';
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 DailyToolbox-GEO/2.0';

// 规范化用户输入的网址
export function normalizeInputUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    if (!p.hostname.includes('.') && !config.allowPrivateTargets) return null;
    return p.toString();
  } catch { return null; }
}
