// =====================================================
// EMBERHOLD: Остров Пепла — DATA (все числа в одном месте)
// =====================================================
const DATA = {
  saveVersion: 1,

  time: {
    dayLengthMin: 12,
    nightLengthMin: 5,
    decayScale: 0.35,
    growScale: 0.25,
    respawnScale: 0.5
  },

  world: {
    size: 1200,
    chunkSize: 64,
    abyssSea: true,
    monumentBlockers: true
  },

  survival: {
    maxHealth: 100,
    maxCalories: 500,
    maxHydration: 250,
    maxRadiation: 500,
    hungerRate: 0.8,
    thirstRate: 1.2,
    coldDamage: 2.5,
    bleedDps: 1.0,
    woundedDuration: 45,
    woundedChanceBase: 0.20,
    woundedChanceFull: 0.45
  },

  currency: {
    coins: 1250,
    slag: 0,
    emberCrystals: 0
  },

  workbenches: {
    I:  { cost: 50,   requires: null },
    II: { cost: 500,  requires: 'I' },
    III:{ cost: 1250, requires: 'II' }
  },

  armor: {
    ironMask:        [50, 70, 8, 0, -4, 8],
    metalChest:      [25, 20, 3, 0, -8, 0],
    tinHelm:         [35, 50, 8, 5, 0, 8],
    signplateJacket: [20, 25, 10, 0, -8, 0],
    signplateKilt:   [20, 25, 10, 0, -8, 0],
    radSuit:         [30, 30, 8, 50, 5, 5]
  },

  weapons: {
    ravager:   { dmg: 50, rpm: 450, mag: 30, name: 'Ravager AR' },
    lancer3:   { dmg: 40, rpm: 450, mag: 30, name: 'Lancer-3' },
    hornet:    { dmg: 37.5, rpm: 600, mag: 30, name: 'Hornet SMG' },
    marksman:  { dmg: 80, rpm: 40, mag: 5, name: 'Marksman Bolt' },
    scatter12: { dmg: 18, rpm: 60, mag: 6, name: 'Scatter-12' },
    anvil:     { dmg: 55, rpm: 600, mag: 100, name: 'Anvil LMG' }
  },

  building: {
    twigHP: 10,
    timberHP: 250,
    stoneHP: 500,
    plateHP: 1000,
    starsteelHP: 2000,
    privilegeRadius: 50
  },

  raid: {
    chargePackDmg: 550,
    siegeRocketDmg: 275,
    bundleChargeDmg: 85,
    powderJarDmg: 40
  },

  gyro: {
    mode: 'ads',
    sensHip: 1.0,
    sensAds: 0.55,
    multX: 1.0,
    multY: 1.0,
    invertX: false,
    invertY: false,
    deadzone: 0.4,
    smoothing: 0.25,
    preciseMode: true,
    vehicleSteer: false
  },

  graphics: {
    quality: 'medium',
    fpsLimit: 60,
    fov: 75,
    showFps: false
  },

  rarities: {
    common:    { chance: 0.55, color: '#9e9e9e', glow: 0.0 },
    uncommon:  { chance: 0.25, color: '#4caf50', glow: 0.15 },
    rare:      { chance: 0.12, color: '#2196f3', glow: 0.3 },
    epic:      { chance: 0.06, color: '#9c27b0', glow: 0.5 },
    legendary: { chance: 0.02, color: '#ff9800', glow: 0.8 }
  },

  skins: [
    { id: 'ravager_lava',     name: 'Ravager «Лава»',     rarity: 'legendary', weapon: 'ravager',  price: 0 },
    { id: 'ravager_ice',      name: 'Ravager «Лёд»',      rarity: 'epic',      weapon: 'ravager',  price: 0 },
    { id: 'lancer_gold',      name: 'Lancer «Золото»',    rarity: 'legendary', weapon: 'lancer3',  price: 0 },
    { id: 'hornet_neon',      name: 'Hornet «Неон»',      rarity: 'rare',      weapon: 'hornet',   price: 0 },
    { id: 'scatter_camo',     name: 'Scatter «Камуфляж»', rarity: 'uncommon',  weapon: 'scatter12',price: 0 },
    { id: 'default_ravager',  name: 'Ravager Стандарт',   rarity: 'common',    weapon: 'ravager',  price: 0 },
    { id: 'default_lancer',   name: 'Lancer Стандарт',    rarity: 'common',    weapon: 'lancer3',  price: 0 },
    { id: 'axe_ember',        name: 'Топор «Пепел»',      rarity: 'rare',      weapon: 'axe',      price: 0 }
  ],

  cases: [
    { id: 'case_basic',   name: 'Базовый ящик',   price: 150,  pool: ['common','uncommon'] },
    { id: 'case_military',name: 'Военный ящик',   price: 450,  pool: ['uncommon','rare','epic'] },
    { id: 'case_elite',   name: 'Элитный ящик',   price: 1200, pool: ['rare','epic','legendary'] }
  ],

  player: {
    nickname: 'AshWalker',
    level: 12,
    rank: 'Охотник',
    island: 47,
    equippedSkin: 'default_ravager'
  },

  lang: 'ru'
};

const Save = {
  key: 'emberhold_save_v1',
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.saveVersion !== DATA.saveVersion) {
        data.saveVersion = DATA.saveVersion;
      }
      return data;
    } catch (e) {
      console.warn('Save load error', e);
      return null;
    }
  },
  save(state) {
    try {
      const payload = {
        saveVersion: DATA.saveVersion,
        player: state.player || DATA.player,
        currency: state.currency || DATA.currency,
        gyro: state.gyro || DATA.gyro,
        graphics: state.graphics || DATA.graphics,
        inventory: state.inventory || [],
        equippedSkin: state.equippedSkin || DATA.player.equippedSkin,
        gyroProfiles: state.gyroProfiles || { 90: null, 270: null },
        hudLayout: state.hudLayout || null,
        lang: state.lang || DATA.lang
      };
      localStorage.setItem(this.key, JSON.stringify(payload));
    } catch (e) {
      console.warn('Save write error', e);
    }
  }
};
