import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

// OpenProject #706: o jsQR acerta ou erra conforme a escala em que o QR chega (a mesma foto real lê
// em 1500 px e falha em 1280 px). O decodificador tenta poucas escalas e depois contraste normalizado.
const leitor = vi.hoisted(() => vi.fn<(dados: Uint8ClampedArray, largura: number, altura: number) => { data: string } | null>());
vi.mock('jsqr', () => ({ default: leitor }));
const { decodificarQr } = await import('../src/leitura/qr/decodificar.js');
const sinal = () => new AbortController().signal;
const larguras = () => leitor.mock.calls.map(chamada => chamada[1]);
const foto = (lado: number) => sharp({ create: { width: lado, height: lado, channels: 3, background: '#ffffff' } }).png().toBuffer();
const QR = { data: 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35' };

describe('#706: tentativas de leitura do QR da foto', () => {
 beforeEach(() => leitor.mockReset());

 it('lê na primeira escala e não tenta mais nada', async () => {
  leitor.mockReturnValueOnce(QR);
  expect(await decodificarQr(await foto(2000), 'image/png', sinal())).toBe(QR.data);
  expect(larguras()).toEqual([1500]);
 });
 it('se a primeira escala não lê, tenta as outras e para na que ler', async () => {
  leitor.mockReturnValueOnce(null).mockReturnValueOnce(null).mockReturnValueOnce(QR);
  expect(await decodificarQr(await foto(2000), 'image/png', sinal())).toBe(QR.data);
  expect(larguras()).toEqual([1500, 1000, 800]);
 });
 it('depois das escalas sem tratamento, tenta com contraste normalizado', async () => {
  leitor.mockReturnValue(null);
  for (let i = 0; i < 5; i++) leitor.mockReturnValueOnce(null);
  leitor.mockReturnValueOnce(QR);
  expect(await decodificarQr(await foto(2000), 'image/png', sinal())).toBe(QR.data);
  expect(larguras()).toEqual([1500, 1000, 800, 1200, 600, 1500]);
 });
 it('sem QR, desiste depois de 10 tentativas (5 escalas, sem e com contraste)', async () => {
  leitor.mockReturnValue(null);
  expect(await decodificarQr(await foto(2000), 'image/png', sinal())).toBeUndefined();
  expect(leitor).toHaveBeenCalledTimes(10);
 });
 it('imagem pequena não repete tentativa na mesma escala', async () => {
  leitor.mockReturnValue(null);
  await decodificarQr(await foto(640), 'image/png', sinal());
  expect(larguras()).toEqual([640, 600, 640, 600]);
 });
 it('para quando o pedido é cancelado, sem rodar o jsQR', async () => {
  const c = new AbortController(); c.abort();
  await expect(decodificarQr(await foto(2000), 'image/png', c.signal)).rejects.toThrow();
  expect(leitor).not.toHaveBeenCalled();
 });
});
