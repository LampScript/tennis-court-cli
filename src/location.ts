import { spawnSync } from 'node:child_process';

export function macLocation() {
  if (process.platform !== 'darwin') throw new Error('location 需要 macOS 定位服务');
  const { stdout, stderr, error, status } = spawnSync('CoreLocationCLI', [
    '--format', '%latitude %longitude %h_accuracy',
  ], { encoding: 'utf8', timeout: 60000 });
  if (error && 'code' in error && error.code === 'ENOENT') throw new Error('请先运行 brew install --cask corelocationcli');
  if (error && 'code' in error && error.code === 'ETIMEDOUT') throw new Error('等待定位超时，请检查 macOS 定位授权及 Wi-Fi 后重试');
  if (error) throw error;
  if (status !== 0) throw new Error(stderr.trim() || '定位失败，请检查 macOS 定位服务及 Wi-Fi');

  const fields = stdout.trim().split(/\s+/);
  const [latitude, longitude, accuracyMeters] = fields.map(Number);
  if (fields.length !== 3 || ![latitude, longitude, accuracyMeters].every(Number.isFinite) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracyMeters < 0) {
    throw new Error('未取得有效定位，请检查系统设置中的定位授权及 Wi-Fi');
  }
  return { latitude, longitude, accuracyMeters };
}
