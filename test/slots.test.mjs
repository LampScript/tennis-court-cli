import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots, shanghaiMidnight } from '../dist/slots.js';

const envelope = (cells) => ({ returnCode: '0', returnData: { fieldList: [{ name: '示例场地', shedule: cells }] } });
test('只返回可订格，按时间排序，保留零元和实际折扣价', () => {
  const rows = availableSlots(envelope([
    { status: '0', timePoint: 21, realPrice: '100.00', expense: '120' },
    { status: '4', timePoint: 19 },
    { status: 0, timePoint: 17, realPrice: 0 },
  ]));
  assert.deepEqual(rows.map(r => [r.start, r.end, r.price]), [['17:00', '18:00', 0], ['21:00', '22:00', 100]]);
});
test('区分售罄、接口错误、响应缺字段', () => {
  assert.deepEqual(availableSlots(envelope([{ status: '4' }])), []);
  assert.throws(() => availableSlots({ returnCode: '-1', returnMsg: '会话失效' }), /会话失效/);
  assert.throws(() => availableSlots({ returnCode: '0', returnData: {} }), /fieldList/);
  assert.throws(() => availableSlots(envelope([{ status: '0', timePoint: 17 }])), /realPrice/);
});
test('上海零点及无效日期', () => {
  assert.equal(shanghaiMidnight('2026-11-20'), 1795104000);
  assert.throws(() => shanghaiMidnight('2026-02-30'));
});
