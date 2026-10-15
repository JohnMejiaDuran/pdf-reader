export function validateServerUrl(input: string): string {
  const url = new URL(input.trim());
  const parts = url.hostname.split('.');
  const ip = parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    ? parts.map(Number) : undefined;
  const local = url.hostname === 'localhost' || (ip && (ip[0] === 127 || ip[0] === 10
    || (ip[0] === 192 && ip[1] === 168) || (ip[0] === 172 && ip[1]! >= 16 && ip[1]! <= 31)));
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
    throw new Error('Usá HTTPS para Railway. HTTP solo se permite para localhost o una IP privada completa, sin credenciales ni parámetros.');
  }
  return url.toString().replace(/\/+$/, '');
}
