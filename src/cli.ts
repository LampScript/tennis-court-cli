import { Command, InvalidArgumentError, Option } from 'commander';
import { Phone } from './phone.js';
import api from './api.json' with { type: 'json' };

function positive(input: string) {
  const n = Number(input);
  if (!/^\d+$/.test(input) || !Number.isSafeInteger(n) || n < 1) throw new InvalidArgumentError('请输入正整数');
  return n;
}

function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function dateLabel(input: string) {
  const timestamp = Date.parse(input + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== input) throw new InvalidArgumentError('请输入有效日期 YYYY-MM-DD');
  const days = (timestamp - Date.parse(today())) / 86400000;
  if (days < 0 || days > 365) throw new InvalidArgumentError('日期须在未来一年内（含今天）');
  return input.slice(5).replace('-', '/');
}

function hour(input: string) {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(input);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new InvalidArgumentError('请输入有效时间 HH:MM');
  return match.slice(1).map(s => s.padStart(2, '0')).join(':');
}

const cli = new Command('tennis-court-cli')
  .description('通过已连接的 Android 手机查询韵动吧，输出 JSON')
  .option('--serial <serial>', 'adb 设备序列号');
function phone() { return new Phone(cli.opts().serial); }
function print(data: unknown) { console.log(JSON.stringify(data, null, 2)); }
function pages() { return new Option('--pages <n>', '读取列表屏数').argParser(positive).default(1); }

cli.command('venues').description('列出当前城市的网球场馆').addOption(pages())
  .option('--keyword <text>', '按名称或地址筛选', '')
  .action(async opts => print(await phone().venues(opts.pages, opts.keyword)));

cli.command('slots <venue>').description('查询场馆各片场地的时间格').addOption(pages())
  .option('--date <date>', 'YYYY-MM-DD，默认今天', dateLabel)
  .option('--at <time>', '只显示该开始时间，例如 19:00', hour)
  .option('--scrolls <n>', '时间表最多读取屏数', positive, 6)
  .action(async (venue, opts) => {
    const rows = await phone().slots(venue, opts.date ?? dateLabel(today()), opts.pages, opts.scrolls);
    print(opts.at ? rows.filter(row => row.start === opts.at) : rows);
  });

cli.command('play').description('查询首页畅打活动').addOption(pages())
  .action(async opts => print(await phone().play(opts.pages)));
const auth = cli.command('auth').description('查看手机登录状态或打开登录入口');
auth.command('status').action(async () => print(await phone().auth(false)));
auth.command('login').action(async () => print(await phone().auth(true)));
cli.command('api').description('查看 APK 中确认的业务接口').command('describe').action(() => print(api));

try {
  await cli.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
