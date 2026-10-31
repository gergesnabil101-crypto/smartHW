/**
 * Utility to format mathematical powers, exponents, chemical ionic charges,
 * and chemical reaction formulas into clean Unicode superscripts/subscripts
 * or LaTeX expressions.
 */

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ'
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ'
};

export function toSuperscript(str: string): string {
  return str.split('').map(c => SUPERSCRIPTS[c] || c).join('');
}

export function toSubscript(str: string): string {
  return str.split('').map(c => SUBSCRIPTS[c] || c).join('');
}

// Common chemical elements to prevent false matches on general English words
const CHEM_ELEMENTS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
  'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th',
  'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm'
]);

/// Common polyatomic ions like SO4, CO3, NO3, PO4, NH4, OH, MnO4, Cr2O7, HCO3
const POLYATOMIC_IONS = [
  'SO4', 'SO3', 'CO3', 'HCO3', 'NO3', 'NO2', 'PO4', 'HPO4',
  'H2PO4', 'NH4', 'OH', 'MnO4', 'CrO4', 'Cr2O7', 'ClO4', 'ClO3',
  'ClO2', 'ClO', 'CH3COO', 'C2O4', 'SiO3'
];

/**
 * Automatically format powers, exponents, chemical charges, physical units, and arrows in any text.
 * E.g.:
 * "Cu + Pb+2 -> Cu+2 + Pb" => "Cu + Pb²⁺ → Cu²⁺ + Pb"
 * "x^2 + 5x = 0" => "x² + 5x = 0"
 * "10^-3" => "10⁻³"
 * "Fe+3 + 3e- -> Fe" => "Fe³⁺ + 3e⁻ → Fe"
 * "SO4-2" => "SO₄²⁻"
 * "m/s^2" => "m/s²"
 * "Ca(OH)2" => "Ca(OH)₂"
 */
export function formatScienceNotation(text: string | null | undefined): string {
  if (!text) return '';

  let res = text;

  // 1. Normalize reaction arrows: ->, -->, --->, =>, ==>, ⟶ to standard →
  res = res.replace(/(?<=\s|^)(?:->|-->|--->|=>|==>|⟶)(?=\s|$)/g, '→');

  // 2. Normalize reversible arrows: <->, <=>, ⇄, ⇌, ⇋
  res = res.replace(/(?<=\s|^)(?:<->|<=>|⇋|⇌)(?=\s|$)/g, '⇄');

  // 2.5. Common math symbols: +/- or +- -> ±, <= -> ≤, >= -> ≥, != -> ≠, ~= -> ≈
  res = res.replace(/(?<=\s|^)\+\/-(?=\s|\d|$)/g, '±');
  res = res.replace(/(?<=\s|^)\+-(?=\s|\d|$)/g, '±');
  res = res.replace(/(?<=\s)<=/g, '≤');
  res = res.replace(/(?<=\s)>=/g, '≥');
  res = res.replace(/(?<=\s)!=/g, '≠');
  res = res.replace(/(?<=\s)(?:~=|=~)(?=\s)/g, '≈');

  // 3. Physical units with exponents: m/s^2, m/s2, cm^3, cm3, m^3, m3, cm^2, cm2, m^2, m2, kg/m^3, g/cm^3
  res = res.replace(/\b(m|cm|km)\/s\^?2\b/g, '$1/s²');
  res = res.replace(/\b(kg|g)\/(m|cm)\^?3\b/g, '$1/$2³');
  res = res.replace(/\b(cm|m|mm|km)\^?3\b/g, '$1³');
  res = res.replace(/\b(cm|m|mm|km)\^?2\b/g, '$1²');

  // 4. Convert explicit power notation: e.g. x^2 -> x², 10^-3 -> 10⁻³, (a+b)^2 -> (a+b)²
  res = res.replace(/([a-zA-Z0-9\)])\^([0-9\+\-nxyz]+)/g, (_, base, exp) => {
    return `${base}${toSuperscript(exp)}`;
  });

  // 5. Convert parentheses chemical formulas with subscripts: e.g. (OH)2 -> (OH)₂, (NO3)2 -> (NO₃)₂, (SO4)3 -> (SO₄)₃
  res = res.replace(/\(([A-Za-z0-9]+)\)(\d+)/g, (_, inside, sub) => {
    // Format inside polyatomic if needed
    let formattedInside = inside;
    for (const ion of POLYATOMIC_IONS) {
      if (inside === ion) {
        formattedInside = ion.replace(/(\d+)/g, (__, digits) => toSubscript(digits));
        break;
      }
    }
    return `(${formattedInside})${toSubscript(sub)}`;
  });

  // 6. Convert chemical charges on known polyatomic ions: e.g. SO4-2 -> SO₄²⁻, NO3- -> NO₃⁻
  for (const ion of POLYATOMIC_IONS) {
    // Format ion subscript first if needed (e.g. SO4 -> SO₄)
    const formattedIon = ion.replace(/(\d+)/g, (_, digits) => toSubscript(digits));
    
    // Pattern with raw numbers (e.g. SO4-2, SO4^-2, SO4 2-)
    const regex1 = new RegExp(`\\b${ion}(?:\\^)?([\\+\\-]\\d+|\\d+[\\+\\-]|[\\+\\-])(?=[\\s,;.)\\?→⇄]|$)`, 'g');
    res = res.replace(regex1, (_, charge) => {
      let cleanCharge = charge;
      if (/^[\+\-]\d+$/.test(charge)) {
        cleanCharge = charge.slice(1) + charge[0]; // e.g. +2 -> 2+
      }
      return `${formattedIon}${toSuperscript(cleanCharge)}`;
    });

    // Also match if base ion was already subscripted (e.g. SO₄-2)
    const regex2 = new RegExp(`\\b${formattedIon}(?:\\^)?([\\+\\-]\\d+|\\d+[\\+\\-]|[\\+\\-])(?=[\\s,;.)\\?→⇄]|$)`, 'g');
    res = res.replace(regex2, (_, charge) => {
      let cleanCharge = charge;
      if (/^[\+\-]\d+$/.test(charge)) {
        cleanCharge = charge.slice(1) + charge[0];
      }
      return `${formattedIon}${toSuperscript(cleanCharge)}`;
    });
  }

  // 7. Convert electron charge: e- -> e⁻, 2e- -> 2e⁻
  res = res.replace(/(\d*)\s*e\s*-(?=[\s,;.)\?→⇄]|$)/g, '$1e⁻');

  // 8. Convert chemical charges on chemical elements: e.g. Pb+2 -> Pb²⁺, Cu+2 -> Cu²⁺, Fe+3 -> Fe³⁺, Cl- -> Cl⁻
  res = res.replace(/\b([A-Z][a-z]?)(?:\^)?([\+\-][1-9]|\b[1-9][\+\-]|[\+\-])(?=[\s,;.)\\?→⇄]|$)/g, (match, elem, charge) => {
    if (!CHEM_ELEMENTS.has(elem)) {
      return match;
    }
    let cleanCharge = charge;
    if (/^[\+\-]\d+$/.test(charge)) {
      cleanCharge = charge.slice(1) + charge[0]; // +2 -> 2+ (standard IUPAC ionic notation)
    }
    return `${elem}${toSuperscript(cleanCharge)}`;
  });

  // 9. Comprehensive chemical formulas with numbers that should be subscripts:
  const commonFormulas: Record<string, string> = {
    'H2O': 'H₂O',
    'CO2': 'CO₂',
    'CO': 'CO',
    'O2': 'O₂',
    'O3': 'O₃',
    'N2': 'N₂',
    'H2': 'H₂',
    'Cl2': 'Cl₂',
    'Br2': 'Br₂',
    'I2': 'I₂',
    'F2': 'F₂',
    'NaCl': 'NaCl',
    'HCl': 'HCl',
    'NaOH': 'NaOH',
    'KOH': 'KOH',
    'NH3': 'NH₃',
    'NH4Cl': 'NH₄Cl',
    'CH4': 'CH₄',
    'C2H6': 'C₂H₆',
    'C2H4': 'C₂H₄',
    'C2H2': 'C₂H₂',
    'C6H12O6': 'C₆H₁₂O₆',
    'C2H5OH': 'C₂H₅OH',
    'CH3COOH': 'CH₃COOH',
    'H2SO4': 'H₂SO₄',
    'H2SO3': 'H₂SO₃',
    'HNO3': 'HNO₃',
    'HNO2': 'HNO₂',
    'H3PO4': 'H₃PO₄',
    'H2CO3': 'H₂CO₃',
    'CaCO3': 'CaCO₃',
    'MgCO3': 'MgCO₃',
    'CuCO3': 'CuCO₃',
    'ZnCO3': 'ZnCO₃',
    'FeCO3': 'FeCO₃',
    'BaCO3': 'BaCO₃',
    'Na2CO3': 'Na₂CO₃',
    'K2CO3': 'K₂CO₃',
    'NaHCO3': 'NaHCO₃',
    'KHCO3': 'KHCO₃',
    'CaO': 'CaO',
    'MgO': 'MgO',
    'CuO': 'CuO',
    'ZnO': 'ZnO',
    'FeO': 'FeO',
    'Fe2O3': 'Fe₂O₃',
    'Fe3O4': 'Fe₃O₄',
    'Al2O3': 'Al₂O₃',
    'SO2': 'SO₂',
    'SO3': 'SO₃',
    'NO2': 'NO₂',
    'N2O': 'N₂O',
    'P2O5': 'P₂O₅',
    'MgCl2': 'MgCl₂',
    'CaCl2': 'CaCl₂',
    'BaCl2': 'BaCl₂',
    'CuCl2': 'CuCl₂',
    'ZnCl2': 'ZnCl₂',
    'FeCl2': 'FeCl₂',
    'FeCl3': 'FeCl₃',
    'AlCl3': 'AlCl₃',
    'CuSO4': 'CuSO₄',
    'ZnSO4': 'ZnSO₄',
    'MgSO4': 'MgSO₄',
    'CaSO4': 'CaSO₄',
    'BaSO4': 'BaSO₄',
    'FeSO4': 'FeSO₄',
    'Fe2(SO4)3': 'Fe₂(SO₄)₃',
    'Al2(SO4)3': 'Al₂(SO₄)₃',
    'Na2SO4': 'Na₂SO₄',
    'K2SO4': 'K₂SO₄',
    'AgNO3': 'AgNO₃',
    'NaNO3': 'NaNO₃',
    'KNO3': 'KNO₃',
    'KClO3': 'KClO₃',
    'KMnO4': 'KMnO₄',
    'K2Cr2O7': 'K₂Cr₂O₇',
    'Cu(OH)2': 'Cu(OH)₂',
    'Ca(OH)2': 'Ca(OH)₂',
    'Mg(OH)2': 'Mg(OH)₂',
    'Al(OH)3': 'Al(OH)₃',
    'Fe(OH)2': 'Fe(OH)₂',
    'Fe(OH)3': 'Fe(OH)₃',
    'Ba(OH)2': 'Ba(OH)₂',
    'Pb(NO3)2': 'Pb(NO₃)₂',
    'Cu(NO3)2': 'Cu(NO₃)₂',
    'AgCl': 'AgCl',
    'AgBr': 'AgBr',
    'AgI': 'AgI',
    'PbI2': 'PbI₂'
  };

  for (const [raw, formatted] of Object.entries(commonFormulas)) {
    // Match standalone or with integer coefficient (e.g. 2H2O, 3O2)
    const reg = new RegExp(`(?<=\\b|\\d+)${raw}\\b`, 'g');
    res = res.replace(reg, formatted);
  }

  return res;
}
