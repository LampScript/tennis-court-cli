import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { SaxesParser } from 'saxes';

const app = 'com.sports8.newtennis';
interface Box { left: number; top: number; right: number; bottom: number }
interface UiNode extends Box { text: string; desc: string }
interface Activity { title: string; club: string; time: string; summary: string; price?: string }

function parseScreen(xml: string): UiNode[] {
  const nodes: UiNode[] = [];
  const parser = new SaxesParser();
  parser.on('opentag', tag => {
    const a = tag.attributes;
    if (tag.name !== 'node' || a.package !== app) return;
    const coords = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(a.bounds);
    if (!coords) throw new Error('界面节点的 bounds 格式异常');
    const [left, top, right, bottom] = coords.slice(1).map(Number);
    if (right > left && bottom > top) {
      nodes.push({ left, top, right, bottom, text: a.text ?? '', desc: a['content-desc'] ?? '' });
    }
  });
  parser.write(xml).close();
  if (!nodes.length) throw new Error('韵动吧不在前台，请解锁手机并打开应用');
  return nodes;
}

export class Phone {
  private readonly deviceArgs: string[];
  constructor(serial?: string) {
    this.deviceArgs = serial ? ['-s', serial] : [];
  }

  private adb(...args: (string | number)[]): string {
    return execFileSync('adb', [...this.deviceArgs, ...args.map(String)], {
      encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  private async screen(): Promise<UiNode[]> {
    for (let i = 0; i < 3; i++) {
      const output = this.adb('exec-out', 'uiautomator', 'dump', '/dev/tty');
      const end = output.indexOf('</hierarchy>');
      if (end >= 0) return parseScreen(output.slice(0, end + '</hierarchy>'.length));
      await sleep(400);
    }
    throw new Error('无法读取手机界面，请解锁后重试');
  }

  private async touch(box: Box) {
    this.adb('shell', 'input', 'tap', Math.floor((box.left + box.right) / 2), Math.floor((box.top + box.bottom) / 2));
    await sleep(400);
  }

  private select(nodes: UiNode[], label: string) {
    const node = nodes.findLast(n => n.text === label || n.desc === label);
    if (!node) throw new Error('当前页面未找到「' + label + '」');
    return this.touch(node);
  }

  private async tab(label: string) {
    this.adb('shell', 'am', 'start', '-W', '-n', app + '/.MainActivity');
    await sleep(600);
    for (let i = 0; i < 6; i++) {
      const nodes = await this.screen();
      if (nodes.some(n => n.text === '首页')) {
        await this.select(nodes, label);
        return this.screen();
      }
      this.adb('shell', 'input', 'keyevent', 4);
      await sleep(350);
    }
    throw new Error('未找到应用首页，请在手机上返回首页');
  }

  private async *screens(nodes: UiNode[], limit: number) {
    for (let page = 0; page < limit; page++) {
      yield nodes;
      if (page + 1 === limit) return;
      const x = Math.floor(Math.max(...nodes.map(n => n.right)) / 2);
      const h = Math.max(...nodes.map(n => n.bottom));
      this.adb('shell', 'input', 'swipe', x, Math.floor(h * .75), x, Math.floor(h * .4), 480);
      await sleep(450);
      const next = await this.screen();
      if (JSON.stringify(next) === JSON.stringify(nodes)) return;
      nodes = next;
    }
  }

  private async *venueCards(pages: number) {
    await this.select(await this.tab('订场'), '全部场馆');
    await this.select(await this.screen(), '网球');
    for await (const nodes of this.screens(await this.screen(), pages)) {
      for (const node of nodes) {
        if (node.desc.includes(', ') && /收藏|已订|￥|¥/.test(node.desc)) {
          yield { name: node.desc.split(', ')[0], node };
        }
      }
    }
  }

  async venues(pages: number, keyword: string) {
    const venues = new Map<string, { name: string; summary: string }>();
    for await (const { name, node } of this.venueCards(pages)) {
      if (node.desc.includes(keyword)) venues.set(name, { name, summary: node.desc });
    }
    return [...venues.values()];
  }

  private async venueDetail(name: string, pages: number) {
    for await (const card of this.venueCards(pages)) {
      if (card.name === name) {
        await this.touch(card.node);
        return this.screen();
      }
    }
    throw new Error('未找到场馆「' + name + '」，请用 venues 确认名称或增大 --pages');
  }

  async slots(name: string, day: string, pages: number, scrolls: number) {
    const detail = await this.venueDetail(name, pages);
    await this.select(detail, detail.some(n => n.text === day) ? day : '立即预订');
    const dateTab = (await this.screen()).find(n => n.desc.endsWith(', ' + day));
    if (!dateTab) throw new Error('当前场馆可见的预约日期中没有 ' + day);
    await this.touch(dateTab);

    const result = new Map<string, { court: string; start: string; display: string }>();
    let columns: UiNode[] = [];
    for await (const nodes of this.screens(await this.screen(), scrolls)) {
      const times = nodes.filter(n => /^\d\d:\d\d$/.test(n.text))
        .map(n => ({ hour: n.text, y: Math.floor((n.top + n.bottom) / 2) }));
      if (!times.length) throw new Error('当前场馆未显示可读取的时间表');
      if (!columns.length) {
        const first = Math.min(...times.map(t => t.y));
        columns = nodes.filter(n => {
          const h = n.bottom - n.top;
          const gap = first - n.bottom;
          return n.text && n.left > 0 && gap >= 0 && gap < h + 20 && n.right - n.left >= 2 * h;
        });
      }
      for (const cell of nodes) {
        if (!cell.desc) continue;
        const court = columns.find(n => n.left === cell.left && n.right === cell.right);
        if (!court) continue;
        // Time labels are centered on the top edge of their grid cells.
        const row = times.reduce((a, b) => Math.abs(b.y - cell.top) < Math.abs(a.y - cell.top) ? b : a);
        if (Math.abs(row.y - cell.top) <= 6) {
          result.set(JSON.stringify([court.text, row.hour]), { court: court.text, start: row.hour, display: cell.desc });
        }
      }
    }
    if (!result.size) throw new Error('未识别到场地和时间格，请在手机核对该场馆排期');
    return [...result.values()];
  }

  async play(pages: number) {
    let home = await this.tab('首页');
    if (home.some(n => n.text === '畅打活动' || n.desc === '畅打活动')) {
      await this.select(home, '畅打活动');
      home = await this.screen();
    }
    const cards = new Map<string, Activity>();
    for await (const nodes of this.screens(home, pages)) {
      for (const box of nodes) {
        const fields = box.desc.split(', ');
        const time = fields.find(f => /\d\d:\d\d[-~]\d\d:\d\d/.test(f));
        if (fields.length < 3 || !time || !/#网球|畅打/.test(box.desc)) continue;
        const [title, club] = fields;
        const key = JSON.stringify([title, club, time]);
        const card = cards.get(key) ?? { title, club, time, summary: '' };
        if (box.desc.length > card.summary.length) card.summary = box.desc;
        const price = nodes.find(n => /^[¥￥]\s*[\d.]+$/.test(n.text) &&
          n.left >= box.left && n.right <= box.right && n.top >= box.top && n.bottom <= box.bottom);
        if (price) card.price = price.text;
        cards.set(key, card);
      }
    }
    return [...cards.values()];
  }

  async auth(login: boolean) {
    const nodes = await this.tab('我的');
    const entry = nodes.find(n => n.text.includes('登录') && !n.text.includes('退出'));
    if (entry) {
      if (login) {
        await this.select(nodes, entry.text);
        return { status: 'login_required', next: '在手机上完成登录后运行 auth status' };
      }
      return { status: 'login_required' };
    }
    return { status: nodes.some(n => /天陪伴|韵动吧已陪你/.test(n.text)) ? 'signed_in' : 'unknown', source: '韵动吧个人主页' };
  }
}
