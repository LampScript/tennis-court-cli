import { spawnSync } from 'node:child_process';
import api from './api.json' with { type: 'json' };
import { venues } from './web.js';

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('排期数据格式异常');
  return value as Record<string, unknown>;
}

export function shanghaiMidnight(day: string): number {
  const ms = Date.parse(day + 'T00:00:00+08:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(ms) ||
      new Date(ms + 8 * 3600000).toISOString().slice(0, 10) !== day) throw new Error('请输入有效日期 YYYY-MM-DD');
  return ms / 1000;
}

function numberField(value: unknown, field: string): number {
  if ((typeof value !== 'number' && !(typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) ||
      !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('排期字段异常：' + field);
  return Number(value);
}

export function availableSlots(envelope: unknown) {
  const response = record(envelope);
  if (response.returnCode !== '0' && response.returnCode !== 0)
    throw new Error(typeof response.returnMsg === 'string' ? response.returnMsg : '韵动吧排期查询失败');
  const data = record(response.returnData);
  if (!Array.isArray(data.fieldList)) throw new Error('响应缺少普通场馆 fieldList');
  const slots = data.fieldList.flatMap((value: unknown) => {
    const field = record(value);
    if (typeof field.name !== 'string' || !Array.isArray(field.shedule)) throw new Error('场地名称或时段列表异常');
    const court = field.name;
    return field.shedule.flatMap((value: unknown) => {
      const cell = record(value);
      if (typeof cell.status !== 'string' && typeof cell.status !== 'number') throw new Error('时段缺少状态');
      if (String(cell.status) !== '0') return [];
      const hour = numberField(cell.timePoint, 'timePoint');
      if (!Number.isInteger(hour) || hour > 23) throw new Error('无法识别时段：' + hour);
      return [{ court, start: String(hour).padStart(2, '0') + ':00',
        end: String(hour + 1).padStart(2, '0') + ':00', price: numberField(cell.realPrice, 'realPrice') }];
    });
  });
  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

export async function querySlots(venue: string, city: string, day: string) {
  const date = shanghaiMidnight(day);
  let id = venue;
  if (!/^\d+$/.test(id)) {
    const matches = (await venues(city, venue, 1)).filter(v => v.name === venue);
    if (matches.length !== 1) throw new Error('请用 venues 确认唯一的场馆 ID 后重试');
    id = matches[0].id;
  }
  const signer = process.env.TENNIS_COURT_SIGNER;
  if (!signer) throw new Error('实时排期需要服务方授权的签名程序，请设置 TENNIS_COURT_SIGNER');
  const url = new URL(api.venues.slots.path, api.origin);
  const signed = spawnSync(signer, [], { input: JSON.stringify({ url: url.href, method: 'POST', data: { stadiumid: id, date } }),
    encoding: 'utf8', timeout: 20000 });
  if (signed.error) throw signed.error;
  if (signed.status !== 0) throw new Error('排期签名程序执行失败');
  const request = record(JSON.parse(signed.stdout));
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const [key, value] of Object.entries(record(request.headers))) {
    if (typeof value !== 'string') throw new Error('签名程序返回的请求头格式错误');
    headers.set(key, value);
  }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(record(request.body)),
    redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('排期请求失败 HTTP ' + response.status);
  return { stadiumId: id, date: day, slots: availableSlots(await response.json()) };
}
