import { describe, expect, it, vi } from 'vitest';
import { resolverNumeroOT, type PuertoNumeroOT } from './numeroOT';

const EMPRESA = 'e1';

const puerto = (over: Partial<PuertoNumeroOT> = {}): PuertoNumeroOT => ({
  existeNumero: vi.fn(async () => false),
  generarNumero: vi.fn(async () => '268-14'),
  ...over,
});

describe('resolverNumeroOT', () => {
  it('el número tecleado pasa tal cual cuando no está repetido', async () => {
    const p = puerto();
    await expect(resolverNumeroOT(p, EMPRESA, '3189-B')).resolves.toBe('3189-B');
    expect(p.generarNumero).not.toHaveBeenCalled();
  });

  it('limpia los espacios del tecleado antes de buscarlo', async () => {
    const p = puerto();
    await expect(resolverNumeroOT(p, EMPRESA, '  3189  ')).resolves.toBe('3189');
    expect(p.existeNumero).toHaveBeenCalledWith(EMPRESA, '3189');
  });

  it('un número repetido no crea la OT: avisa y sugiere cómo seguir', async () => {
    const p = puerto({ existeNumero: vi.fn(async () => true) });
    await expect(resolverNumeroOT(p, EMPRESA, '3189')).rejects.toThrow(/Ya existe una OT/);
    await expect(resolverNumeroOT(p, EMPRESA, '3189')).rejects.toThrow(/3189-B/);
  });

  it('sin número tecleado pide el correlativo del mes', async () => {
    const p = puerto();
    await expect(resolverNumeroOT(p, EMPRESA, '')).resolves.toBe('268-14');
    expect(p.existeNumero).not.toHaveBeenCalled();
    expect(p.generarNumero).toHaveBeenCalledWith(EMPRESA);
  });

  it('solo espacios cuenta como vacío', async () => {
    await expect(resolverNumeroOT(puerto(), EMPRESA, '   ')).resolves.toBe('268-14');
  });

  it('si la BD falla, el error se propaga en vez de crear una OT sin número', async () => {
    const p = puerto({
      generarNumero: vi.fn(async () => {
        throw new Error('rpc caída');
      }),
    });
    await expect(resolverNumeroOT(p, EMPRESA, '')).rejects.toThrow('rpc caída');
  });
});
