import { load } from 'cheerio';
import { createHash } from 'node:crypto';
export function identificarLeiaute(html: string, uf: string): string {
 const $ = load(html); const atributos = new Set<string>();
 const regiao = $('#tabResult');
 regiao.add(regiao.find('*')).each((_i, el) => {
  const id = $(el).attr('id'); if (id) atributos.add('id:' + id.replace(/\d+/g, 'N')); // 'Item + 3' e 'Item + 4' são o mesmo leiaute
  for (const c of ($(el).attr('class') ?? '').split(/\s+/).filter(Boolean)) atributos.add('class:' + c);
 });
 const assinatura = createHash('sha256').update([...atributos].sort().join('\n')).digest('hex').slice(0,16);
 return uf + '-' + assinatura;
}
