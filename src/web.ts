const base = 'https://www.sports8.com.cn/YDBWX/';
const listUrl = new URL('servlet/stadium/StadiumManageServlet', base);
type Venue = { id: string; name: string; address: string; summary: string; distanceMeters?: number };

async function list(params: Record<string, string>): Promise<Venue[]> {
  const response = await fetch(listUrl, { method: 'POST', body: new URLSearchParams(params), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('韵动吧请求失败 HTTP ' + response.status);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('官网未返回场馆列表');
  return rows.map(row => {
    if (!row || !['string', 'number'].includes(typeof row.f0) || typeof row.f1 !== 'string' || typeof row.f6 !== 'string')
      throw new Error('官网场馆字段发生变化');
    const venue: Venue = { id: String(row.f0), name: row.f1, address: row.f6, summary: [row.f1, row.f6].join(', ') };
    if (params.optype === 'queryListForIndex') {
      const dist = /^([\d.]+)\s*(km|m|公里|米)$/i.exec(String(row.f9).trim());
      if (!dist || !Number.isFinite(Number(dist[1]))) throw new Error('官网推荐场馆距离格式异常');
      venue.distanceMeters = Math.round(Number(dist[1]) * (/^(km|公里)$/i.test(dist[2]) ? 1000 : 1));
    }
    return venue;
  });
}

export async function venues(city: string, keyword: string, pages: number) {
  const results = new Map<string, Venue>();
  for (let page = 0; page < pages; page++) {
    const rows = await list({ optype: 'queryListByAjax', cityname: city, keyword, sort: '1',
      maxRows: '10', firstRow: String(page * 10 + 1), records: page ? '10' : '0' });
    for (const row of rows) results.set(row.id, row);
    if (rows.length < 10) break;
  }
  return [...results.values()];
}

export async function nearby(latitude: number, longitude: number) {
  const response = await fetch(new URL('jsp/index.jsp', base), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('无法读取韵动吧官网首页 HTTP ' + response.status);
  const page = await response.text();
  const ids = /"stadiumIds"\s*:\s*"(\(\d+(?:,\d+)*\))"/.exec(page);
  if (!ids) throw new Error('官网未提供推荐场馆名单');
  const rows = await list({ optype: 'queryListForIndex', stadiumIds: ids[1], cityid: '',
    latitude: String(latitude), longitude: String(longitude) });
  return rows.sort((a, b) => a.distanceMeters! - b.distanceMeters!);
}
