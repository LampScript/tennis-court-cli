import { Command, InvalidArgumentError } from 'commander';
import { macLocation } from './location.js';
import { nearby, venues } from './web.js';
import { querySlots } from './slots.js';
import api from './api.json' with { type: 'json' };

const cli = new Command('tennis-court-cli').description('从终端直接查询韵动吧公开场馆，输出 JSON');
function print(value: unknown) { console.log(JSON.stringify(value, null, 2)); }

cli.command('location').description('获取 Mac 经纬度及水平精度（米）').action(() => print(macLocation()));
cli.command('venues').description('查询官网场馆目录')
  .option('--city <city>', '城市名', '上海市')
  .option('--keyword <text>', '搜索关键词', '网球')
  .option('--pages <n>', '每页 10 个场馆', value => {
    const n = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(n) || n < 1) throw new InvalidArgumentError('请输入正整数');
    return n;
  }, 1)
  .action(async opts => print(await venues(opts.city, opts.keyword, opts.pages)));

cli.command('slots <venue>').description('按场馆 ID 或完整名称查询普通场馆可订时段（需要授权签名程序）')
  .option('--city <city>', '按名称查找时使用的城市', '上海市')
  .option('--date <date>', '上海日期 YYYY-MM-DD', new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()))
  .action(async (venue, opts) => print(await querySlots(venue, opts.city, opts.date)));

cli.command('nearby').description('按距离排列官网首页推荐场馆，默认使用 Mac 定位')
  .option('--coords <lat,lon>', '使用指定的 WGS84 纬度、经度', value => {
    const fields = value.split(',');
    const [latitude, longitude] = fields.map(Number);
    if (fields.length !== 2 || fields.some(f => !f.trim()) ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new InvalidArgumentError('请输入有效的 纬度,经度');
    return { latitude, longitude };
  })
  .action(async opts => {
    const { latitude, longitude } = opts.coords ?? macLocation();
    print(await nearby(latitude, longitude));
  });
cli.command('api').description('查看 Android 客户端静态接口清单').command('describe').action(() => print(api));

try {
  await cli.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
