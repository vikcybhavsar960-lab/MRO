import { BrandMasterItem, ParsedVendorProduct } from '../types';

export interface BrandKnowledgeEntry {
  canonicalName: string;
  category: string;
  subCategories: string[];
  defaultHsn: string;
  defaultGst: number;
  defaultUom: string;
  code: string;
  country: string;
  description: string;
  sampleProducts: string[];
}

export const MRO_BRAND_KNOWLEDGE: Record<string, BrandKnowledgeEntry> = {
  skf: {
    canonicalName: 'SKF',
    category: 'Bearing',
    subCategories: ['Deep Groove Ball Bearings', 'Spherical Roller Bearings', 'Pillow Block Bearings', 'Bearing Housings'],
    defaultHsn: '84821010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'SKF',
    country: 'Sweden',
    description: 'Global leader in rolling bearings, seals, lubrication systems, and condition monitoring.',
    sampleProducts: ['Deep Groove Ball Bearing 6205-2RSH', 'Spherical Roller Bearing 22212-E', 'Pillow Block UCF 205', 'Tapered Roller Bearing 30205'],
  },
  fag: {
    canonicalName: 'FAG',
    category: 'Bearing',
    subCategories: ['Ball Bearings', 'Roller Bearings', 'Plummer Blocks', 'Precision Bearings'],
    defaultHsn: '84821010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'FAG',
    country: 'Germany',
    description: 'Schaeffler Group premium industrial rolling bearings and precision motion.',
    sampleProducts: ['Ball Bearing 6306-2Z', 'Spherical Roller Bearing 22314-E1', 'Plummer Block Housing SNL 511'],
  },
  timken: {
    canonicalName: 'Timken',
    category: 'Bearing',
    subCategories: ['Tapered Roller Bearings', 'Spherical Bearings', 'Industrial Bearings'],
    defaultHsn: '84822010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'TMK',
    country: 'USA',
    description: 'World benchmark in engineered tapered roller bearings and heavy industrial bearings.',
    sampleProducts: ['Tapered Roller Bearing 32208', 'Heavy Spherical Roller Bearing 22218-K', 'Flanged Bearing Unit RCJ 50'],
  },
  nbc: {
    canonicalName: 'NBC',
    category: 'Bearing',
    subCategories: ['Industrial Bearings', 'Ball Bearings', 'Railway Bearings'],
    defaultHsn: '84821010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'NBC',
    country: 'India',
    description: 'National Engineering Industries CK Birla Group industrial and automotive bearings.',
    sampleProducts: ['Deep Groove Ball Bearing 6204-ZZ', 'Tapered Roller Bearing 30206', 'Spherical Bearing 22210'],
  },
  nsk: {
    canonicalName: 'NSK',
    category: 'Bearing',
    subCategories: ['Precision Bearings', 'Deep Groove Bearings', 'Linear Guides'],
    defaultHsn: '84821010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'NSK',
    country: 'Japan',
    description: 'Precision Japanese ball bearings, spherical roller bearings, and linear motion.',
    sampleProducts: ['Ball Bearing 6206 DDU', 'Self Aligning Ball Bearing 1205', 'Linear Guide Rail Carriage'],
  },
  ntn: {
    canonicalName: 'NTN',
    category: 'Bearing',
    subCategories: ['Ball Bearings', 'Taper Bearings', 'Mounted Units'],
    defaultHsn: '84821010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'NTN',
    country: 'Japan',
    description: 'Japanese precision engineered bearings, constant velocity joints, and precision machinery.',
    sampleProducts: ['Ball Bearing 6205 LLU', 'Needle Roller Bearing NK 20/20', 'Pillow Block UCP 206'],
  },
  koyo: {
    canonicalName: 'Koyo',
    category: 'Bearing',
    subCategories: ['Ball Bearings', 'Roller Bearings', 'Automotive Bearings'],
    defaultHsn: '84821010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'KYO',
    country: 'Japan',
    description: 'JTEKT Group industrial bearings for demanding heavy machinery applications.',
    sampleProducts: ['Ball Bearing 6005-2RS', 'Taper Roller Bearing 32007 JR', 'Spherical Roller Bearing 22214'],
  },
  abb: {
    canonicalName: 'ABB',
    category: 'Motor',
    subCategories: ['Induction Motors', 'VFD Drives', 'Switchgear', 'Transformers'],
    defaultHsn: '85015210',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'ABB',
    country: 'Switzerland',
    description: 'Pioneering technology leader in electrification products, industrial robotics, and drives.',
    sampleProducts: ['3-Phase Induction Motor 5.5kW IE3', 'Low Voltage AC Drive ACS580 11kW', 'Moulded Case Circuit Breaker 250A'],
  },
  siemens: {
    canonicalName: 'Siemens',
    category: 'Electrical item',
    subCategories: ['Switchgear', 'Motors', 'PLC Automation', 'Contactors'],
    defaultHsn: '85362030',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'SIE',
    country: 'Germany',
    description: 'World-renowned automation, industrial control components, switchgear, and motors.',
    sampleProducts: ['Air Circuit Breaker 3WL 1600A', 'SIRIUS Contactor 3RT2026 25A', 'SIMOTICS GP 7.5kW Motor'],
  },
  schneider: {
    canonicalName: 'Schneider Electric',
    category: 'Electrical item',
    subCategories: ['Switchgear', 'MCCB', 'Contactors', 'Power Supplies'],
    defaultHsn: '85362030',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'SCH',
    country: 'France',
    description: 'Digital transformation of energy management and automation solutions.',
    sampleProducts: ['EasyPact CVS MCCB 100A 3P 25kA', 'TeSys D Contactor LC1D25M7 25A', 'Acti9 Miniature Circuit Breaker 32A C-Curve'],
  },
  'l&t': {
    canonicalName: 'L&T Electrical & Automation',
    category: 'Electrical item',
    subCategories: ['Switchgear', 'Starters', 'Energy Meters', 'Contactors'],
    defaultHsn: '85362030',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'LNT',
    country: 'India',
    description: 'India premier low voltage switchgear, motor control centers, and electrical protection.',
    sampleProducts: ['Omega Air Circuit Breaker 1000A', 'MO Contactor 32A 220V', 'Automatic Star Delta Starter 15HP'],
  },
  havells: {
    canonicalName: 'Havells',
    category: 'Electrical item',
    subCategories: ['Industrial Cables', 'Motors', 'Switchgear', 'Lighting'],
    defaultHsn: '85362030',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'HAV',
    country: 'India',
    description: 'Fast-moving electrical goods, industrial motors, cables, and distribution switchgear.',
    sampleProducts: ['Industrial Armoured Cable 4C x 16 sq mm', 'Euro-II MCCB 125A 4P', '3-Phase Foot Mounted Motor 3HP'],
  },
  crompton: {
    canonicalName: 'Crompton Greaves',
    category: 'Motor',
    subCategories: ['Induction Motors', 'Flameproof Motors', 'Pumps'],
    defaultHsn: '85015210',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'CG',
    country: 'India',
    description: 'Heavy electrical equipment, standard and flameproof motors, and pump systems.',
    sampleProducts: ['Apex Series Induction Motor 10HP 1440 RPM', 'Flameproof Motor 5HP Gas Group IIA/IIB', 'Monoblock Centrifugal Pump 2HP'],
  },
  'bosch rexroth': {
    canonicalName: 'Bosch Rexroth',
    category: 'Machine spare',
    subCategories: ['Hydraulic Pumps', 'Proportional Valves', 'Hydraulic Cylinders', 'Filters'],
    defaultHsn: '84812000',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'REX',
    country: 'Germany',
    description: 'Drive and control technologies, electrohydraulic components, and mobile hydraulics.',
    sampleProducts: ['Axial Piston Variable Pump A10VSO 45', 'Directional Spool Valve 4WE6 D6X', 'Hydraulic Pressure Relief Valve DBDS 10'],
  },
  parker: {
    canonicalName: 'Parker Hannifin',
    category: 'Machine spare',
    subCategories: ['Hydraulics', 'Pneumatics', 'Hoses & Fittings', 'Filtration'],
    defaultHsn: '84812000',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'PRK',
    country: 'USA',
    description: 'Global motion and control technologies leader in hydraulics, pneumatics, and fluid conveyance.',
    sampleProducts: ['High Pressure Hydraulic Hose 2-Wire 1/2 inch', 'Electro-Pneumatic Regulator', 'Hydraulic Cartridge Check Valve'],
  },
  festo: {
    canonicalName: 'Festo',
    category: 'Machine spare',
    subCategories: ['Pneumatic Cylinders', 'Solenoid Valves', 'Air Preparation FRL', 'Fittings'],
    defaultHsn: '84812000',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'FST',
    country: 'Germany',
    description: 'Pioneering German pneumatic and electrical automation technology for factories.',
    sampleProducts: ['Standard Pneumatic Cylinder DNC-50-100-PPV-A', 'Solenoid Valve VUVS-LK25-M52-AD-G14', 'Air Filter Regulator Unit MS4-LFR-1/4'],
  },
  smc: {
    canonicalName: 'SMC Pneumatics',
    category: 'Machine spare',
    subCategories: ['Air Cylinders', 'Directional Valves', 'FRL Units', 'Quick Connectors'],
    defaultHsn: '84812000',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'SMC',
    country: 'Japan',
    description: 'World market share leader in pneumatic control devices, vacuum units, and flow switches.',
    sampleProducts: ['Compact Air Cylinder CDQ2B40-50DZ', '5-Port Solenoid Valve SY5120-5G-01', 'Modular FRL Unit AC30-03G-A'],
  },
  fenner: {
    canonicalName: 'Fenner',
    category: 'Machine spare',
    subCategories: ['V-Belts', 'Timing Belts', 'Shaft Couplings', 'Pulleys'],
    defaultHsn: '40103990',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'FNR',
    country: 'UK',
    description: 'Benchmark in heavy industrial power transmission belts, pulleys, and flexible couplings.',
    sampleProducts: ['Industrial V-Belt B-52 Classical Section', 'Flange Coupling FCL 140 Set', 'Taper Lock Bush 2012-35mm', 'Raw Edge Cogged Belt AX-45'],
  },
  gates: {
    canonicalName: 'Gates',
    category: 'Machine spare',
    subCategories: ['Power Transmission Belts', 'Hydraulic Hoses', 'Synchronous Timing Belts'],
    defaultHsn: '40103990',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'GTS',
    country: 'USA',
    description: 'World premier manufacturer of power transmission belts and fluid power products.',
    sampleProducts: ['Hi-Power II V-Belt C-85', 'PowerGrip Timing Belt 8M-1200-30', 'Wire Braid Hydraulic Hose MegaSys 3/8 inch'],
  },
  grundfos: {
    canonicalName: 'Grundfos',
    category: 'Pump',
    subCategories: ['Centrifugal Pumps', 'Vertical Multistage Pumps', 'Submersible Pumps'],
    defaultHsn: '84137010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'GRF',
    country: 'Denmark',
    description: 'Global benchmark in high-efficiency water solutions and advanced industrial pump systems.',
    sampleProducts: ['Vertical Multistage Centrifugal Pump CR 5-10', 'End Suction Water Pump NB 50-160', 'Submersible Sump Pump Unilift KP 250'],
  },
  kirloskar: {
    canonicalName: 'Kirloskar Brothers',
    category: 'Pump',
    subCategories: ['Centrifugal Pumps', 'Monoblock Pumps', 'Split Case Pumps', 'Valves'],
    defaultHsn: '84137010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'KBL',
    country: 'India',
    description: 'India largest manufacturer and exporter of centrifugal water and process pumps.',
    sampleProducts: ['End Suction Centrifugal Pump DB 65/26', 'Monoblock Pump KDS-214+', 'Cast Iron Sluice Valve 150mm PN16'],
  },
  ksb: {
    canonicalName: 'KSB',
    category: 'Pump',
    subCategories: ['Process Pumps', 'Boiler Feed Pumps', 'Industrial Valves'],
    defaultHsn: '84137010',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'KSB',
    country: 'Germany',
    description: 'Leading international supplier of pumps, valves, and related industrial process systems.',
    sampleProducts: ['Horizontal End Suction Pump Meganorm 65-200', 'High Pressure Multistage Pump Movitec V10', 'Non-Return Check Valve 80mm'],
  },
  unbrako: {
    canonicalName: 'Unbrako',
    category: 'Industrial consumable',
    subCategories: ['Socket Head Cap Screws', 'High Tensile Bolts', 'Grade 12.9 Fasteners'],
    defaultHsn: '73181500',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'UNB',
    country: 'USA',
    description: 'World benchmark in premium Grade 12.9 socket head cap screws and high-tensile fasteners.',
    sampleProducts: ['Socket Head Cap Screw M12 x 50mm Gr 12.9', 'Countersunk Socket Screw M10 x 30mm', 'Hex Socket Set Screw M8 x 16mm'],
  },
  tvs: {
    canonicalName: 'TVS Fasteners',
    category: 'Industrial consumable',
    subCategories: ['Hex Bolts', 'Flange Bolts', 'Nyloc Nuts', 'High Tensile Studs'],
    defaultHsn: '73181500',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'TVS',
    country: 'India',
    description: 'Sundram Fasteners TVS Group premier precision industrial and automotive fasteners.',
    sampleProducts: ['High Tensile Hex Bolt M16 x 75mm Gr 8.8', 'Nyloc Self-Locking Nut M12', 'Heavy Hex Head Bolt M20 x 100mm Gr 10.9'],
  },
  taparia: {
    canonicalName: 'Taparia',
    category: 'Industrial consumable',
    subCategories: ['Hand Tools', 'Spanners', 'Pliers', 'Socket Sets'],
    defaultHsn: '82055990',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'TAP',
    country: 'India',
    description: 'India foremost brand of forged hand tools, spanner sets, torque wrenches, and pliers.',
    sampleProducts: ['Double Ended Open Spanner Set 6-32mm (12 Pcs)', 'Combination Pliers 8 inch Insulated', 'Heavy Duty Adjustable Spanner 12 inch'],
  },
  stanley: {
    canonicalName: 'Stanley',
    category: 'Industrial consumable',
    subCategories: ['Hand Tools', 'Measuring Tapes', 'Tool Storage', 'Torque Wrenches'],
    defaultHsn: '82055990',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'STN',
    country: 'USA',
    description: 'World leader in precision measuring tapes, mechanics tool sets, and industrial hand tools.',
    sampleProducts: ['PowerLock Measuring Tape 5 Meter', 'Drive Socket Set 1/2 inch (24 Pcs)', 'Industrial Clicker Torque Wrench 40-200 Nm'],
  },
  bosch: {
    canonicalName: 'Bosch Power Tools',
    category: 'Industrial consumable',
    subCategories: ['Angle Grinders', 'Rotary Hammers', 'Cordless Drills', 'Abrasives'],
    defaultHsn: '84672100',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'BSH',
    country: 'Germany',
    description: 'Heavy duty German engineered industrial power tools, drill bits, and abrasive cutting wheels.',
    sampleProducts: ['Heavy Duty Angle Grinder GWS 900-100', 'Rotary Hammer Drill GBH 2-26 DRE', 'Industrial Cutting Disc 4 inch x 1.2mm (Pack of 50)'],
  },
  castrol: {
    canonicalName: 'Castrol Industrial',
    category: 'Lubricant',
    subCategories: ['Gear Oils', 'Hydraulic Oils', 'Greases', 'Coolants'],
    defaultHsn: '27101980',
    defaultGst: 18,
    defaultUom: 'LTR',
    code: 'CAS',
    country: 'UK',
    description: 'High-performance industrial lubricants, metalworking fluids, and synthetic gear oils.',
    sampleProducts: ['Industrial Gear Oil Alpha SP 220 (20 Ltr)', 'Hydraulic Oil Hyspin AWH-M 68 (210 Ltr)', 'Heavy Duty Bearing Grease Spheerol AP3 (18 Kg)'],
  },
  mobil: {
    canonicalName: 'Mobil Industrial',
    category: 'Lubricant',
    subCategories: ['Synthetic Gear Oils', 'Circulating Oils', 'Compressor Oils', 'Greases'],
    defaultHsn: '27101980',
    defaultGst: 18,
    defaultUom: 'LTR',
    code: 'MOB',
    country: 'USA',
    description: 'Mobil SHC premium synthetic lubricants designed for extreme temperatures and heavy loads.',
    sampleProducts: ['Mobilgear 600 XP 220 Industrial Gear Oil (208 Ltr)', 'Mobil DTE 25 Hydraulic Oil (20 Ltr)', 'Mobilgrease XHP 222 Lithium Complex Grease (18 Kg)'],
  },
  '3m': {
    canonicalName: '3M Industrial',
    category: 'Industrial consumable',
    subCategories: ['Safety PPE', 'Industrial Abrasives', 'Tapes & Adhesives', 'Respirators'],
    defaultHsn: '90200000',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: '3M',
    country: 'USA',
    description: 'Advanced occupational health, respiratory protection, safety glasses, and structural adhesives.',
    sampleProducts: ['Particulate Respirator N95 8210 (Box of 20)', 'Safety Glasses Virtua Clear Anti-Fog', 'VHB Structural Double Sided Tape 4910 19mm x 33m'],
  },
  fluke: {
    canonicalName: 'Fluke',
    category: 'Instrument',
    subCategories: ['Digital Multimeters', 'Clamp Meters', 'Thermal Cameras', 'Insulation Testers'],
    defaultHsn: '90303100',
    defaultGst: 18,
    defaultUom: 'NOS',
    code: 'FLK',
    country: 'USA',
    description: 'World standard in electronic test tools, infrared thermography, and industrial calibration.',
    sampleProducts: ['True-RMS Digital Multimeter Fluke 179', 'AC/DC Clamp Meter Fluke 376 FC', 'Infrared Thermometer Fluke 62 MAX+'],
  },
};

/**
 * Normalizes brand name for lookup
 */
export const cleanBrandKey = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Auto-lookup brand and return full enriched technical profile
 */
export const getBrandEnrichment = (
  brandName: string,
  knownBrands?: BrandMasterItem[]
): BrandKnowledgeEntry => {
  const rawClean = (brandName || '').trim();
  const key = cleanBrandKey(rawClean);

  // 1. Check known master brands
  if (knownBrands && knownBrands.length > 0) {
    const matched = knownBrands.find(
      (b) => cleanBrandKey(b.name) === key || (b.code && cleanBrandKey(b.code) === key)
    );
    if (matched) {
      // Find if we have technical knowledge for standard defaults
      const kb = Object.values(MRO_BRAND_KNOWLEDGE).find(
        (entry) => cleanBrandKey(entry.canonicalName) === key
      );
      return {
        canonicalName: matched.name,
        category: matched.category || kb?.category || 'Industrial consumable',
        subCategories: matched.categories || kb?.subCategories || ['General MRO'],
        defaultHsn: kb?.defaultHsn || '84821010',
        defaultGst: kb?.defaultGst || 18,
        defaultUom: kb?.defaultUom || 'NOS',
        code: matched.code || kb?.code || matched.name.slice(0, 3).toUpperCase(),
        country: matched.countryOfOrigin || kb?.country || 'India',
        description: matched.description || kb?.description || `${matched.name} certified industrial brand`,
        sampleProducts: kb?.sampleProducts || [`${matched.name} Standard Industrial Item`],
      };
    }
  }

  // 2. Check direct knowledge base
  for (const [k, entry] of Object.entries(MRO_BRAND_KNOWLEDGE)) {
    if (key === cleanBrandKey(k) || key === cleanBrandKey(entry.canonicalName)) {
      return entry;
    }
  }

  // 3. Fallback: intelligent heuristic based on brand name or common terms
  let inferredCat = 'Industrial consumable';
  let inferredHsn = '8482';
  let inferredUom = 'NOS';

  const lower = rawClean.toLowerCase();
  if (lower.includes('bearing') || lower.includes('ball') || lower.includes('roller')) {
    inferredCat = 'Bearing';
    inferredHsn = '84821010';
  } else if (lower.includes('motor') || lower.includes('drive') || lower.includes('vfd')) {
    inferredCat = 'Motor';
    inferredHsn = '85015210';
  } else if (lower.includes('pump') || lower.includes('valve') || lower.includes('pipe')) {
    inferredCat = 'Pump';
    inferredHsn = '84137010';
  } else if (lower.includes('belt') || lower.includes('pulley') || lower.includes('hose')) {
    inferredCat = 'Machine spare';
    inferredHsn = '40103990';
  } else if (lower.includes('switch') || lower.includes('cable') || lower.includes('electric') || lower.includes('relay')) {
    inferredCat = 'Electrical item';
    inferredHsn = '85362030';
  } else if (lower.includes('bolt') || lower.includes('fastener') || lower.includes('screw') || lower.includes('nut')) {
    inferredCat = 'Industrial consumable';
    inferredHsn = '73181500';
  } else if (lower.includes('oil') || lower.includes('grease') || lower.includes('lube')) {
    inferredCat = 'Lubricant';
    inferredHsn = '27101980';
    inferredUom = 'LTR';
  } else if (lower.includes('meter') || lower.includes('sensor') || lower.includes('gauge') || lower.includes('fluke')) {
    inferredCat = 'Instrument';
    inferredHsn = '90303100';
  }

  const code = rawClean.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'OEM';

  return {
    canonicalName: rawClean || 'Standard OEM',
    category: inferredCat,
    subCategories: [inferredCat],
    defaultHsn: inferredHsn,
    defaultGst: 18,
    defaultUom: inferredUom,
    code,
    country: 'India',
    description: `${rawClean} certified industrial supplier products`,
    sampleProducts: [`${rawClean} Standard Industrial Component`],
  };
};

/**
 * Parses raw text product lists from a CSV cell or multiline input
 * e.g. "Ball Bearing 6205, Taper Roller Bearing 30205, V-Belt B-52"
 * or "Bearing 6205 (SKF) [PN: 6205-2RS, Rate: 485]; Induction Motor 5HP (ABB)"
 */
export const parseVendorProductString = (
  productsStr: string,
  vendorBrands: string[] = [],
  vendorCategories: string[] = []
): ParsedVendorProduct[] => {
  if (!productsStr || typeof productsStr !== 'string') return [];

  const rawEntries = productsStr
    .split(/[\r\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // If only 1 entry and has commas, check if comma separated
  const entries: string[] = [];
  rawEntries.forEach((entry) => {
    // If entry contains multiple items separated by comma without bracket nesting
    if (entry.includes(',') && !entry.includes('(') && !entry.includes('[')) {
      entry.split(',').forEach((sub) => {
        if (sub.trim()) entries.push(sub.trim());
      });
    } else {
      entries.push(entry);
    }
  });

  const parsedList: ParsedVendorProduct[] = [];
  const primaryBrand = vendorBrands[0] || 'Standard OEM';
  const defaultCategory = vendorCategories[0] || '';

  entries.forEach((itemText) => {
    let cleanText = itemText;
    let explicitBrand = '';
    let explicitPartNo = '';
    let explicitRate: number | undefined;
    let explicitHsn = '';

    // Check for [PN: ...] or [Part: ...] or [Rate: ...]
    const bracketMatch = cleanText.match(/\[(.*?)\]/);
    if (bracketMatch) {
      const inside = bracketMatch[1];
      cleanText = cleanText.replace(bracketMatch[0], '').trim();

      const pnMatch = inside.match(/(?:pn|part|model|sku)\s*[:=]\s*([^,;]+)/i);
      if (pnMatch) explicitPartNo = pnMatch[1].trim();

      const rateMatch = inside.match(/(?:rate|price|cost|inr|rs)\s*[:=]\s*([0-9.]+)/i);
      if (rateMatch) explicitRate = parseFloat(rateMatch[1]);

      const hsnMatch = inside.match(/hsn\s*[:=]\s*([0-9]+)/i);
      if (hsnMatch) explicitHsn = hsnMatch[1].trim();
    }

    // Check for brand in parentheses (SKF) or (Timken)
    const parenMatch = cleanText.match(/\((.*?)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim();
      // If it looks like a brand
      if (inside.length <= 25 && !inside.toLowerCase().includes('nos') && !inside.toLowerCase().includes('mm')) {
        explicitBrand = inside;
        cleanText = cleanText.replace(parenMatch[0], '').trim();
      }
    }

    // Check for price syntax like "@ 485" or "Rs 485" or "INR 485"
    const atRateMatch = cleanText.match(/(?:@|rs\.?|inr)\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (atRateMatch && explicitRate === undefined) {
      explicitRate = parseFloat(atRateMatch[1]);
      cleanText = cleanText.replace(atRateMatch[0], '').trim();
    }

    // If explicit brand wasn't in parens, check if the text starts with a known brand or vendor brand
    if (!explicitBrand) {
      for (const vb of [...vendorBrands, ...Object.values(MRO_BRAND_KNOWLEDGE).map((b) => b.canonicalName)]) {
        if (cleanText.toLowerCase().startsWith(vb.toLowerCase())) {
          explicitBrand = vb;
          break;
        }
      }
    }

    const assignedBrand = explicitBrand || primaryBrand;
    // Auto-enrich other things as per brand!
    const enrichment = getBrandEnrichment(assignedBrand);

    const productName = cleanText.trim();
    if (!productName) return;

    // Generate smart part number if none provided
    let partNumber = explicitPartNo;
    if (!partNumber) {
      // Check if product name has alphanumeric part code like 6205-2RSH or FCL-140 or M2BAX
      const partRegex = /\b([0-9]{3,5}[A-Z0-9-]*|[A-Z]{2,4}[0-9-]{2,8})\b/i;
      const m = productName.match(partRegex);
      if (m) {
        partNumber = m[1].toUpperCase();
      } else {
        partNumber = `PN-${enrichment.code}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    parsedList.push({
      productName,
      brand: enrichment.canonicalName,
      category: defaultCategory || enrichment.category,
      partNumber,
      modelNumber: partNumber,
      specification: `${enrichment.canonicalName} certified standard industrial engineering specification`,
      uom: enrichment.defaultUom,
      approxRate: explicitRate,
      hsnCode: explicitHsn || enrichment.defaultHsn,
      gstRate: enrichment.defaultGst,
      stockQty: 50,
      description: `${enrichment.canonicalName} OEM genuine industrial catalog item`,
    });
  });

  return parsedList;
};
