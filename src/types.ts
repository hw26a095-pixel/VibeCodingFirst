/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeaponType = 'SWORD' | 'BOW' | 'STAFF';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  japaneseName: string;
  japaneseDescription: string;
  icon: string;
  onApply: (stats: PlayerStats) => PlayerStats;
}

export interface PlayerStats {
  weapon: WeaponType;
  level: number;
  exp: number;
  nextLevelExp: number;
  maxHp: number;
  hp: number;
  speed: number;
  damage: number;
  attackSpeedMultiplier: number; // multiplier for weapon cooldown (lower = faster)
  critChance: number; // 0 to 1
  magnetRadius: number;
  shieldCount: number; // Number of active orbiting shields
  projectileCount: number; // Additional arrows/fireballs
  regeneration: number; // HP regenerated per second
}

export type EnemyType = 'SWARMER' | 'WARRIOR' | 'MAGE' | 'CHAMPION' | 'BOSS';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  scoreValue: number;
  color: string;
  flashDuration: number; // Visual feedback when hit
  shootCooldown?: number;
  angle?: number; // Movement angle/direction for visual rotation
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  damage: number;
  isEnemy: boolean;
  color: string;
  maxDistance: number;
  distanceTraveled: number;
  isPierce?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  gravity?: number;
}

export interface DamagePopup {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  isCrit: boolean;
  alpha: number;
  life: number; // 0 to 1
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  vy: number;
  alpha: number;
}

export type LootType = 'GEM_S' | 'GEM_M' | 'GEM_L' | 'HEAL' | 'SHIELD';

export interface LootItem {
  id: string;
  type: LootType;
  x: number;
  y: number;
  radius: number;
  value: number; // For gem = exp, for heal = hp amount, for duration = sec
  color: string;
  isAttracted: boolean; // True when player is pulls it
}

export interface GameSettings {
  soundEnabled: boolean;
  autoAim: boolean;
  controlType: 'KEYBOARD' | 'JOYSTICK';
}

export interface WaveConfig {
  waveNumber: number;
  name: string;
  japaneseName: string;
  duration: number; // seconds
  spawnInterval: number; // ms between spawns
  allowedTypes: EnemyType[];
  spawnMultiplier: number;
}
