// Las dos notas del pie del catálogo (lámina «Telas»).
//
// No son adornos: la de la izquierda avisa que este catálogo va a absorber a
// los otros dos inventarios de tela, y la de la derecha explica de dónde sale
// la columna de rollos, que es la que más se malinterpreta.

export function NotasTelas({ sinMetrosRollo }: { sinMetrosRollo: number }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="flex-1 rounded-lg border border-accent/35 bg-accent/[0.09] px-3.5 py-3 text-xs leading-relaxed">
        <b className="font-semibold text-accent">Este pasa a ser el único inventario de telas.</b>{' '}
        Hoy el saldo vive en tres lugares que no se hablan: este catálogo, la tabla de «Stock Telas»
        del Ojo de Dios (hoy vacía) y el módulo de prueba de los vendedores (50 rollos, 4 usuarios).
        Los tres se juntan acá, con una migración que primero muestra el informe y recién después
        escribe.
      </div>
      <div className="rounded-lg border border-border bg-card px-3.5 py-3 text-xs leading-relaxed lg:w-[300px]">
        <b className="font-semibold">Rollos equivalentes</b>
        <p className="mt-1 text-muted-foreground">
          Se calculan al mostrar (metros ÷ metros por rollo). No se guardan: el rollo es una forma
          de mirar, el metro es la verdad.
        </p>
        {sinMetrosRollo > 0 && (
          <p className="mt-1.5 text-muted-foreground">
            {sinMetrosRollo === 1
              ? 'Hay 1 tela que no dice cuántos metros trae su rollo'
              : `Hay ${sinMetrosRollo.toLocaleString('es-CL')} telas que no dicen cuántos metros trae su rollo`}
            , así que su columna queda en «—». Se completa en la ficha de la tela; nadie supone un
            largo por ella.
          </p>
        )}
      </div>
    </div>
  );
}

export default NotasTelas;
