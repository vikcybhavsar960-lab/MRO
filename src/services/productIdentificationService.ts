// Smart Product Search, Identification & Industrial MRO Classification Service

export interface MaterialClassificationSuggestion {
  category: string;
  subCategory: string;
  productType?: string;
  suggestedBrand?: string;
  confidence: number; // 0 to 100
  matchReason: string;
  detectedPartNumber?: string;
  detectedRating?: string;
  detectedSize?: string;
  isConfirmedRule: boolean;
}

// Common industrial abbreviations dictionary
export const INDUSTRIAL_ABBREVIATIONS: Record<string, { expanded: string; category: string; subCategory: string }> = {
  mcb: { expanded: 'Miniature Circuit Breaker', category: 'Electrical', subCategory: 'MCB' },
  mccb: { expanded: 'Molded Case Circuit Breaker', category: 'Electrical', subCategory: 'MCCB' },
  elcb: { expanded: 'Earth Leakage Circuit Breaker', category: 'Electrical', subCategory: 'ELCB/RCCB/RCD' },
  rccb: { expanded: 'Residual Current Circuit Breaker', category: 'Electrical', subCategory: 'ELCB/RCCB/RCD' },
  rcbo: { expanded: 'Residual Current Breaker with Overcurrent', category: 'Electrical', subCategory: 'RCBO' },
  acb: { expanded: 'Air Circuit Breaker', category: 'Electrical', subCategory: 'Circuit Breakers' },
  vcb: { expanded: 'Vacuum Circuit Breaker', category: 'Electrical', subCategory: 'Circuit Breakers' },
  db: { expanded: 'Distribution Board', category: 'Electrical', subCategory: 'Distribution Boards' },
  hrc: { expanded: 'High Rupturing Capacity Fuse', category: 'Electrical', subCategory: 'Fuses' },
  smps: { expanded: 'Switched-Mode Power Supply', category: 'Electronics and Automation', subCategory: 'SMPS/Power Supplies' },
  plc: { expanded: 'Programmable Logic Controller', category: 'Electronics and Automation', subCategory: 'PLC' },
  hmi: { expanded: 'Human Machine Interface', category: 'Electronics and Automation', subCategory: 'HMI' },
  vfd: { expanded: 'Variable Frequency Drive / AC Drive', category: 'Electronics and Automation', subCategory: 'VFD/AC Drives' },
  pid: { expanded: 'Proportional-Integral-Derivative Controller', category: 'Electronics and Automation', subCategory: 'Temperature Controllers' },
  frl: { expanded: 'Filter Regulator Lubricator', category: 'Mechanical and Industrial', subCategory: 'Pneumatic Components' },
  gi: { expanded: 'Galvanized Iron', category: 'Plumbing, Pipes and Fittings', subCategory: 'GI Pipes' },
  ms: { expanded: 'Mild Steel', category: 'Plumbing, Pipes and Fittings', subCategory: 'MS Pipes' },
  ss: { expanded: 'Stainless Steel', category: 'Plumbing, Pipes and Fittings', subCategory: 'SS Pipes' },
  pvc: { expanded: 'Polyvinyl Chloride', category: 'Plumbing, Pipes and Fittings', subCategory: 'PVC Pipes' },
  cpvc: { expanded: 'Chlorinated Polyvinyl Chloride', category: 'Plumbing, Pipes and Fittings', subCategory: 'CPVC Pipes' },
  upvc: { expanded: 'Unplasticized Polyvinyl Chloride', category: 'Plumbing, Pipes and Fittings', subCategory: 'UPVC Pipes' },
  hdpe: { expanded: 'High-Density Polyethylene', category: 'Plumbing, Pipes and Fittings', subCategory: 'HDPE Pipes' },
  ballvlv: { expanded: 'Ball Valve', category: 'Plumbing, Pipes and Fittings', subCategory: 'Valves' },
  btfvlv: { expanded: 'Butterfly Valve', category: 'Plumbing, Pipes and Fittings', subCategory: 'Valves' },
};

/**
 * Automatically classifies user-entered text into the standard Category, Subcategory, and Product Type
 * Follows strict anti-hallucination rules (does NOT fabricate brand or manufacturer)
 */
export function identifyProductClassification(rawInput: string): MaterialClassificationSuggestion {
  const clean = (rawInput || '').trim();
  const lower = clean.toLowerCase();

  if (!clean) {
    return {
      category: 'Other',
      subCategory: 'General Consumables',
      confidence: 10,
      matchReason: 'Empty input',
      isConfirmedRule: false,
    };
  }

  // 1. Check direct abbreviations (e.g. "MCB", "ELCB", "PLC", "VFD")
  const tokens = lower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (INDUSTRIAL_ABBREVIATIONS[token]) {
      const match = INDUSTRIAL_ABBREVIATIONS[token];
      return {
        category: match.category,
        subCategory: match.subCategory,
        productType: match.subCategory,
        confidence: 96,
        matchReason: `Exact industrial abbreviation match "${token.toUpperCase()}" → ${match.expanded}`,
        isConfirmedRule: true,
      };
    }
  }

  // 2. Electrical domain
  if (/\b(mcb|mccb|elcb|rccb|rcbo|circuit breaker|breaker)\b/i.test(lower)) {
    let sub = 'MCB';
    if (/\bmccb\b/i.test(lower)) sub = 'MCCB';
    else if (/\b(elcb|rccb|rcd)\b/i.test(lower)) sub = 'ELCB/RCCB/RCD';
    else if (/\brcbo\b/i.test(lower)) sub = 'RCBO';
    else if (/\bcircuit breaker\b/i.test(lower)) sub = 'Circuit Breakers';

    const ratingMatch = clean.match(/\b(\d+\s*[aA]\b|\d+\s*[mM][aA]\b|\d+\s*pole\b|\d+\s*[pP]\b)/gi);
    return {
      category: 'Electrical',
      subCategory: sub,
      productType: sub,
      detectedRating: ratingMatch ? ratingMatch.join(', ') : undefined,
      confidence: 95,
      matchReason: `Identified Electrical Circuit Protection (${sub})`,
      isConfirmedRule: true,
    };
  }

  if (/\b(contactor|contactors|overload relay|thermal relay|relays?)\b/i.test(lower)) {
    const isContactor = /\bcontactor\b/i.test(lower);
    return {
      category: 'Electrical',
      subCategory: isContactor ? 'Contactors' : 'Overload Relays',
      productType: isContactor ? 'Contactors' : 'Relays',
      confidence: 94,
      matchReason: isContactor ? 'Identified Electrical Motor Contactor' : 'Identified Electrical Overload Relay',
      isConfirmedRule: true,
    };
  }

  if (/\b(cable|cables|wire|wires|sqmm|armoured cable)\b/i.test(lower)) {
    return {
      category: 'Electrical',
      subCategory: 'Cables and Wires',
      productType: 'Cables and Wires',
      confidence: 94,
      matchReason: 'Identified Electrical Conductors & Cabling',
      isConfirmedRule: true,
    };
  }

  if (/\b(gland|glands|lugs?|crimping lug|terminal)\b/i.test(lower)) {
    return {
      category: 'Electrical',
      subCategory: /\blug\b/i.test(lower) || /\bgland\b/i.test(lower) ? 'Cable Glands and Lugs' : 'Electrical Terminals',
      productType: 'Cable Glands and Lugs',
      confidence: 93,
      matchReason: 'Identified Electrical Termination Accessories',
      isConfirmedRule: true,
    };
  }

  if (/\b(switch|switches|socket|sockets|modular switch)\b/i.test(lower)) {
    return {
      category: 'Electrical',
      subCategory: 'Switches and Sockets',
      productType: 'Switches and Sockets',
      confidence: 92,
      matchReason: 'Identified Electrical Wiring Device',
      isConfirmedRule: true,
    };
  }

  // 3. Electronics and Automation
  if (/\b(plc|programmable logic controller|s7-1200|s7-1500|micrologix)\b/i.test(lower)) {
    return {
      category: 'Electronics and Automation',
      subCategory: 'PLC',
      productType: 'PLC',
      confidence: 97,
      matchReason: 'Identified Programmable Logic Controller (PLC)',
      isConfirmedRule: true,
    };
  }

  if (/\b(hmi|touch panel|operator panel)\b/i.test(lower)) {
    return {
      category: 'Electronics and Automation',
      subCategory: 'HMI',
      productType: 'HMI',
      confidence: 95,
      matchReason: 'Identified Human Machine Interface (HMI)',
      isConfirmedRule: true,
    };
  }

  if (/\b(vfd|variable frequency drive|ac drive|frequency inverter|altivar|micromaster)\b/i.test(lower)) {
    return {
      category: 'Electronics and Automation',
      subCategory: 'VFD/AC Drives',
      productType: 'VFD/AC Drives',
      confidence: 95,
      matchReason: 'Identified Industrial Motor Inverter Drive (VFD)',
      isConfirmedRule: true,
    };
  }

  if (/\b(sensor|proximity|inductive sensor|photoelectric|optical sensor|rtd|thermocouple)\b/i.test(lower)) {
    let sub = 'Sensors';
    if (/\binductive|proximity\b/i.test(lower)) sub = 'Proximity Sensors';
    else if (/\bphotoelectric|optical\b/i.test(lower)) sub = 'Photoelectric Sensors';
    else if (/\brtd|thermocouple|temperature\b/i.test(lower)) sub = 'Temperature Controllers';

    return {
      category: 'Electronics and Automation',
      subCategory: sub,
      productType: sub,
      confidence: 95,
      matchReason: `Identified Automation Sensor (${sub})`,
      isConfirmedRule: true,
    };
  }

  // 4. Plumbing, Pipes and Fittings
  if (/\b(water tap|faucet|bib tap|pillar tap|angle valve|tap)\b/i.test(lower)) {
    return {
      category: 'Plumbing, Pipes and Fittings',
      subCategory: 'Water Taps/Faucets',
      productType: 'Water Taps/Faucets',
      confidence: 96,
      matchReason: 'Identified Plumbing Water Faucets & Taps',
      isConfirmedRule: true,
    };
  }

  if (/\b(pvc pipe|cpvc pipe|upvc pipe|gi pipe|ms pipe|ss pipe|hdpe pipe|pipe)\b/i.test(lower)) {
    let sub = 'Pipe Fittings';
    if (/cpvc/i.test(lower)) sub = 'CPVC Pipes';
    else if (/upvc/i.test(lower)) sub = 'UPVC Pipes';
    else if (/pvc/i.test(lower)) sub = 'PVC Pipes';
    else if (/\bgi\b/i.test(lower)) sub = 'GI Pipes';
    else if (/\bms\b/i.test(lower)) sub = 'MS Pipes';
    else if (/\bss\b/i.test(lower)) sub = 'SS Pipes';
    else if (/hdpe/i.test(lower)) sub = 'HDPE Pipes';

    const sizeMatch = clean.match(/(\d+\s*(?:mm|inch|in|\")\b)/i);
    return {
      category: 'Plumbing, Pipes and Fittings',
      subCategory: sub,
      productType: sub,
      detectedSize: sizeMatch ? sizeMatch[0] : undefined,
      confidence: 95,
      matchReason: `Identified Industrial Piping (${sub})`,
      isConfirmedRule: true,
    };
  }

  if (/\b(elbow|tee|reducer|coupling|union|flange|flanges)\b/i.test(lower)) {
    const isFlange = /\bflange\b/i.test(lower);
    return {
      category: 'Plumbing, Pipes and Fittings',
      subCategory: isFlange ? 'Flanges' : 'Elbows, Tees and Reducers',
      productType: isFlange ? 'Flanges' : 'Pipe Fittings',
      confidence: 94,
      matchReason: isFlange ? 'Identified Industrial Piping Flange' : 'Identified Pipe Fitting (Elbow/Tee/Reducer)',
      isConfirmedRule: true,
    };
  }

  if (/\b(valve|ball valve|butterfly valve|globe valve|gate valve|check valve|nrv)\b/i.test(lower)) {
    return {
      category: 'Plumbing, Pipes and Fittings',
      subCategory: 'Valves',
      productType: 'Valves',
      confidence: 95,
      matchReason: 'Identified Fluid Isolation & Control Valve',
      isConfirmedRule: true,
    };
  }

  // 5. Mechanical and Industrial
  if (/\b(bearing|bearings|ball bearing|roller bearing|pillow block|plummer block|6205|6206|6207|6208|6305|6306|6308|22212|22216|30205|30206|ucp|ucf)\b/i.test(lower)) {
    const partMatch = clean.match(/\b([0-9]{4,5}[A-Z0-9\-\/]*)\b/i);
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Bearings',
      productType: 'Bearings',
      detectedPartNumber: partMatch ? partMatch[1].toUpperCase() : undefined,
      confidence: 98,
      matchReason: 'Identified Industrial Rolling Bearing',
      isConfirmedRule: true,
    };
  }

  if (/\b(belt|belts|v-belt|timing belt|htd|pulley|pulleys|sprocket|chain)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Belts and Pulleys',
      productType: 'Belts and Pulleys',
      confidence: 95,
      matchReason: 'Identified Power Transmission Belt / Pulley',
      isConfirmedRule: true,
    };
  }

  if (/\b(pump|pumps|centrifugal pump|submersible pump|slurry pump)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Pumps',
      productType: 'Pumps',
      confidence: 95,
      matchReason: 'Identified Industrial Pumping Equipment',
      isConfirmedRule: true,
    };
  }

  if (/\b(motor|motors|induction motor|flameproof motor|brake motor)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Motors',
      productType: 'Motors',
      confidence: 95,
      matchReason: 'Identified Electric Motor',
      isConfirmedRule: true,
    };
  }

  if (/\b(gearbox|gear box|worm gearbox|helical gearbox|planetary)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Gearboxes',
      productType: 'Gearboxes',
      confidence: 95,
      matchReason: 'Identified Speed Reducer / Industrial Gearbox',
      isConfirmedRule: true,
    };
  }

  if (/\b(pneumatic|pneumatics|air cylinder|solenoid valve 5\/2|festo|smc|janatics)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Pneumatic Components',
      productType: 'Pneumatic Components',
      confidence: 94,
      matchReason: 'Identified Pneumatic Automation Component',
      isConfirmedRule: true,
    };
  }

  if (/\b(hydraulic|hydraulic cylinder|power pack|hydraulic hose|rexroth|yukeno)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Hydraulic Components',
      productType: 'Hydraulic Components',
      confidence: 94,
      matchReason: 'Identified Hydraulic Fluid Power Component',
      isConfirmedRule: true,
    };
  }

  if (/\b(fastener|fasteners|bolt|bolts|nut|nuts|screw|washer|threaded rod|unbrako|tvs)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Fasteners',
      productType: 'Fasteners',
      confidence: 94,
      matchReason: 'Identified Industrial Fasteners & Hardware',
      isConfirmedRule: true,
    };
  }

  if (/\b(grease|lubricant|synthetic oil|gear oil|hydraulic oil|kluber|mobil|mosil)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: 'Lubricants and Grease',
      productType: 'Lubricants and Grease',
      confidence: 94,
      matchReason: 'Identified Industrial Specialty Lubricant / Grease',
      isConfirmedRule: true,
    };
  }

  if (/\b(seal|seals|oil seal|o-ring|o ring|gasket|spiral wound)\b/i.test(lower)) {
    return {
      category: 'Mechanical and Industrial',
      subCategory: /\bgasket\b/i.test(lower) ? 'Gaskets' : 'Seals and O-Rings',
      productType: 'Seals and O-Rings',
      confidence: 93,
      matchReason: 'Identified Fluid Sealing / Gasketing Spare',
      isConfirmedRule: true,
    };
  }

  // Fallback
  return {
    category: 'Other',
    subCategory: 'General Consumables',
    productType: 'General Consumables',
    confidence: 60,
    matchReason: 'General industrial supplies (custom category)',
    isConfirmedRule: false,
  };
}

/**
 * Normalizes brand and part number for reliable duplicate detection
 */
export function generateProductDeduplicationKey(brand: string, partNumber?: string, productName?: string, spec?: string): string {
  const b = (brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const p = (partNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const n = (productName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  const s = (spec || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

  if (b && p) return `${b}::part::${p}`;
  if (b && n) return `${b}::name::${n}::${s}`;
  return `generic::${n}::${p}::${s}`;
}
