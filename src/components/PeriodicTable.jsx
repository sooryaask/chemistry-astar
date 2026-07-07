import { useEffect } from 'react'

// [Z, symbol, Ar (OCR data-sheet value, null = unstable), grid column, grid row]
const ELEMENTS = [
  [1, 'H', 1.0, 1, 1], [2, 'He', 4.0, 18, 1],
  [3, 'Li', 6.9, 1, 2], [4, 'Be', 9.0, 2, 2], [5, 'B', 10.8, 13, 2], [6, 'C', 12.0, 14, 2],
  [7, 'N', 14.0, 15, 2], [8, 'O', 16.0, 16, 2], [9, 'F', 19.0, 17, 2], [10, 'Ne', 20.2, 18, 2],
  [11, 'Na', 23.0, 1, 3], [12, 'Mg', 24.3, 2, 3], [13, 'Al', 27.0, 13, 3], [14, 'Si', 28.1, 14, 3],
  [15, 'P', 31.0, 15, 3], [16, 'S', 32.1, 16, 3], [17, 'Cl', 35.5, 17, 3], [18, 'Ar', 39.9, 18, 3],
  [19, 'K', 39.1, 1, 4], [20, 'Ca', 40.1, 2, 4], [21, 'Sc', 45.0, 3, 4], [22, 'Ti', 47.9, 4, 4],
  [23, 'V', 50.9, 5, 4], [24, 'Cr', 52.0, 6, 4], [25, 'Mn', 54.9, 7, 4], [26, 'Fe', 55.8, 8, 4],
  [27, 'Co', 58.9, 9, 4], [28, 'Ni', 58.7, 10, 4], [29, 'Cu', 63.5, 11, 4], [30, 'Zn', 65.4, 12, 4],
  [31, 'Ga', 69.7, 13, 4], [32, 'Ge', 72.6, 14, 4], [33, 'As', 74.9, 15, 4], [34, 'Se', 79.0, 16, 4],
  [35, 'Br', 79.9, 17, 4], [36, 'Kr', 83.8, 18, 4],
  [37, 'Rb', 85.5, 1, 5], [38, 'Sr', 87.6, 2, 5], [39, 'Y', 88.9, 3, 5], [40, 'Zr', 91.2, 4, 5],
  [41, 'Nb', 92.9, 5, 5], [42, 'Mo', 95.9, 6, 5], [43, 'Tc', null, 7, 5], [44, 'Ru', 101.1, 8, 5],
  [45, 'Rh', 102.9, 9, 5], [46, 'Pd', 106.4, 10, 5], [47, 'Ag', 107.9, 11, 5], [48, 'Cd', 112.4, 12, 5],
  [49, 'In', 114.8, 13, 5], [50, 'Sn', 118.7, 14, 5], [51, 'Sb', 121.8, 15, 5], [52, 'Te', 127.6, 16, 5],
  [53, 'I', 126.9, 17, 5], [54, 'Xe', 131.3, 18, 5],
  [55, 'Cs', 132.9, 1, 6], [56, 'Ba', 137.3, 2, 6], [57, 'La', 138.9, 3, 6], [72, 'Hf', 178.5, 4, 6],
  [73, 'Ta', 180.9, 5, 6], [74, 'W', 183.8, 6, 6], [75, 'Re', 186.2, 7, 6], [76, 'Os', 190.2, 8, 6],
  [77, 'Ir', 192.2, 9, 6], [78, 'Pt', 195.1, 10, 6], [79, 'Au', 197.0, 11, 6], [80, 'Hg', 200.6, 12, 6],
  [81, 'Tl', 204.4, 13, 6], [82, 'Pb', 207.2, 14, 6], [83, 'Bi', 209.0, 15, 6], [84, 'Po', null, 16, 6],
  [85, 'At', null, 17, 6], [86, 'Rn', null, 18, 6],
  [87, 'Fr', null, 1, 7], [88, 'Ra', null, 2, 7], [89, 'Ac', null, 3, 7], [104, 'Rf', null, 4, 7],
  [105, 'Db', null, 5, 7], [106, 'Sg', null, 6, 7], [107, 'Bh', null, 7, 7], [108, 'Hs', null, 8, 7],
  [109, 'Mt', null, 9, 7], [110, 'Ds', null, 10, 7], [111, 'Rg', null, 11, 7], [112, 'Cn', null, 12, 7],
  [113, 'Nh', null, 13, 7], [114, 'Fl', null, 14, 7], [115, 'Mc', null, 15, 7], [116, 'Lv', null, 16, 7],
  [117, 'Ts', null, 17, 7], [118, 'Og', null, 18, 7],
  // Lanthanoids (row 9) and actinoids (row 10)
  [58, 'Ce', 140.1, 4, 9], [59, 'Pr', 140.9, 5, 9], [60, 'Nd', 144.2, 6, 9], [61, 'Pm', null, 7, 9],
  [62, 'Sm', 150.4, 8, 9], [63, 'Eu', 152.0, 9, 9], [64, 'Gd', 157.3, 10, 9], [65, 'Tb', 158.9, 11, 9],
  [66, 'Dy', 162.5, 12, 9], [67, 'Ho', 164.9, 13, 9], [68, 'Er', 167.3, 14, 9], [69, 'Tm', 168.9, 15, 9],
  [70, 'Yb', 173.0, 16, 9], [71, 'Lu', 175.0, 17, 9],
  [90, 'Th', 232.0, 4, 10], [91, 'Pa', 231.0, 5, 10], [92, 'U', 238.1, 6, 10], [93, 'Np', null, 7, 10],
  [94, 'Pu', null, 8, 10], [95, 'Am', null, 9, 10], [96, 'Cm', null, 10, 10], [97, 'Bk', null, 11, 10],
  [98, 'Cf', null, 12, 10], [99, 'Es', null, 13, 10], [100, 'Fm', null, 14, 10], [101, 'Md', null, 15, 10],
  [102, 'No', null, 16, 10], [103, 'Lr', null, 17, 10],
]

export default function PeriodicTable({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="pt-overlay" onClick={onClose}>
      <div className="pt-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pt-head">
          <span className="pt-title">Periodic table — Ar values (OCR data sheet)</span>
          <button className="pt-close" onClick={onClose} aria-label="Close periodic table">×</button>
        </div>
        <div className="pt-scroll">
          <div className="pt-grid">
            {ELEMENTS.map(([z, sym, ar, col, row]) => (
              <div
                className="pt-el"
                key={z}
                style={{ gridColumn: col, gridRow: row }}
                title={`${sym} · atomic number ${z}${ar != null ? ` · Ar ${ar.toFixed(1)}` : ''}`}
              >
                <span className="pt-ar">{ar != null ? ar.toFixed(1) : '–'}</span>
                <span className="pt-sym">{sym}</span>
                <span className="pt-num">{z}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
