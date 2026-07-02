// Banner "HASTA 12 cuotas sin interés" + logos Visa / MasterCard / American
// Express, para el pie de la cotización (Fase 0). Recreado como SVG/CSS para
// que imprima nítido; los colores se fuerzan en impresión (print-color-adjust).

const AZUL = '#1d4f91';

export default function BannerCuotas() {
  return (
    <div
      className="flex flex-col items-center gap-3"
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      {/* Píldora azul */}
      <div
        className="flex items-center gap-3 rounded-full px-10 py-4 shadow"
        style={{ backgroundColor: AZUL }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-white"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Hasta
        </span>
        <span className="text-6xl font-extrabold leading-none text-white">12</span>
        <span className="flex flex-col leading-tight text-white">
          <span className="text-4xl font-light lowercase">cuotas</span>
          <span className="text-2xl font-bold">sin interés</span>
        </span>
      </div>

      {/* Logos de tarjetas */}
      <div className="flex items-center gap-2">
        {/* VISA */}
        <svg width="72" height="46" viewBox="0 0 72 46" aria-label="Visa">
          <rect x="0.5" y="0.5" width="71" height="45" rx="4" fill="#ffffff" stroke="#d4d4d8" />
          <rect x="4" y="4" width="64" height="5" rx="1" fill="#1a1f71" />
          <rect x="4" y="37" width="64" height="5" rx="1" fill="#f7b600" />
          <text
            x="36"
            y="29"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize="17"
            fontStyle="italic"
            fontWeight="bold"
            fill="#1a1f71"
          >
            VISA
          </text>
        </svg>
        {/* MasterCard */}
        <svg width="72" height="46" viewBox="0 0 72 46" aria-label="MasterCard">
          <rect x="0.5" y="0.5" width="71" height="45" rx="4" fill="#16366f" stroke="#0e2547" />
          <circle cx="29" cy="20" r="12" fill="#eb001b" />
          <circle cx="43" cy="20" r="12" fill="#f79e1b" fillOpacity="0.92" />
          <text
            x="36"
            y="40"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize="9.5"
            fontStyle="italic"
            fontWeight="bold"
            fill="#ffffff"
          >
            MasterCard
          </text>
        </svg>
        {/* American Express */}
        <svg width="72" height="46" viewBox="0 0 72 46" aria-label="American Express">
          <rect x="0.5" y="0.5" width="71" height="45" rx="4" fill="#2557d6" stroke="#1c46b0" />
          <text
            x="36"
            y="21"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize="9"
            fontWeight="bold"
            fill="#ffffff"
          >
            AMERICAN
          </text>
          <text
            x="36"
            y="32"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize="9"
            fontWeight="bold"
            fill="#ffffff"
          >
            EXPRESS
          </text>
        </svg>
      </div>
    </div>
  );
}
