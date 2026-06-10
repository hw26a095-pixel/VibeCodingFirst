/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { PlayerStats, Enemy, Bullet, Particle, DamagePopup, LootItem, LootType, EnemyType, WaveConfig, GameSettings } from '../types';
import { gameAudio } from '../audio';
import { Shield, Zap, Swords, Power, RefreshCw, Volume2, VolumeX, Eye } from 'lucide-react';

interface GameCanvasProps {
  playerStats: PlayerStats;
  settings: GameSettings;
  setPlayerStats: React.Dispatch<React.SetStateAction<PlayerStats>>;
  onLevelUp: () => void;
  onGameOver: (score: number, itemsCount: number, timeElapsed: number) => void;
  waveNum: number;
  setWaveNum: (w: number) => void;
  activeJoystickVector: { x: number; y: number; active: boolean };
  isPausedExternally?: boolean;
}

// Map dimensions
const MAP_SIZE = 1600;

const WAVE_CONFIGS: WaveConfig[] = [
  {
    waveNumber: 1,
    name: 'Twilight Shadows',
    japaneseName: '逢魔時の影',
    duration: 35,
    spawnInterval: 1400,
    allowedTypes: ['SWARMER'],
    spawnMultiplier: 1.0,
  },
  {
    waveNumber: 2,
    name: 'Iron Horde',
    japaneseName: '鋼鉄の進撃',
    duration: 40,
    spawnInterval: 1200,
    allowedTypes: ['SWARMER', 'WARRIOR'],
    spawnMultiplier: 1.3,
  },
  {
    waveNumber: 3,
    name: 'Spells and Spears',
    japaneseName: '氷火の魔弾',
    duration: 45,
    spawnInterval: 1100,
    allowedTypes: ['SWARMER', 'WARRIOR', 'MAGE'],
    spawnMultiplier: 1.5,
  },
  {
    waveNumber: 4,
    name: 'Champions Awakening',
    japaneseName: '猛将の覚醒',
    duration: 45,
    spawnInterval: 1000,
    allowedTypes: ['WARRIOR', 'MAGE', 'CHAMPION'],
    spawnMultiplier: 1.8,
  },
  {
    waveNumber: 5,
    name: 'Eternal Eclipse (BOSS)',
    japaneseName: '終ノ日（ボス出現）',
    duration: 120,
    spawnInterval: 1200, // minion spawn cycle
    allowedTypes: ['SWARMER', 'WARRIOR', 'MAGE', 'CHAMPION'],
    spawnMultiplier: 2.2,
  }
];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  playerStats,
  settings,
  setPlayerStats,
  onLevelUp,
  onGameOver,
  waveNum,
  setWaveNum,
  activeJoystickVector,
  isPausedExternally = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stats / Gameplay state kept in React states or refs to run in standard requestAnimationFrame loop nicely
  const [score, setScore] = useState(0);
  const [gameTime, setGameTime] = useState(0); // seconds elapsed
  const [kills, setKills] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dashCooldownRem, setDashCooldownRem] = useState(0); // 0 to 1 ratio for UI, or ms
  const [autoAimEnabled, setAutoAimEnabled] = useState(settings.autoAim);

  // Web values in refs to prevent closure issues in anim loop
  const pStatsRef = useRef<PlayerStats>(playerStats);
  const scoreRef = useRef(0);
  const killsRef = useRef(0);
  const waveNumRef = useRef(waveNum);
  const gameTimeRef = useRef(0);
  const autoAimRef = useRef(settings.autoAim);
  const isPausedExternallyRef = useRef(isPausedExternally);

  // Sync references
  useEffect(() => { pStatsRef.current = playerStats; }, [playerStats]);
  useEffect(() => { waveNumRef.current = waveNum; }, [waveNum]);
  useEffect(() => { autoAimRef.current = autoAimEnabled; }, [autoAimEnabled]);
  useEffect(() => { isPausedExternallyRef.current = isPausedExternally; }, [isPausedExternally]);

  // Keys state
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  // Mouse position inside canvas
  const mouseRef = useRef<{ x: number; y: number }>({ x: MAP_SIZE / 2, y: MAP_SIZE / 2 });
  const viewportSizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 600 });

  // Player position/motion refs
  const playerPosRef = useRef<{ x: number; y: number; angle: number }>({
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    angle: 0
  });

  // Dash properties
  const dashTimerRef = useRef<number>(0); // Active invincibility duration in frames
  const dashCooldownRef = useRef<number>(0); // Cooldown timer in frames
  const dashDirRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Weapon trigger state
  const atkCooldownRef = useRef<number>(0); // Attack cooldown in frames
  // Sword attack sweep properties
  const swordSweepActiveRef = useRef<number>(0); // Sweeping frame counter (e.g., 10 frames)
  const swordSweepDirRef = useRef<number>(0); // Swept angle direction
  const swordSweepSideRef = useRef<number>(1); // Left/Right sweep toggle

  // Orbiting rings shield angle
  const shieldAngleRef = useRef<number>(0);

  // Entities lists (mutable refs for the game frame rate performance)
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popupsRef = useRef<DamagePopup[]>([]);
  const lootItemsRef = useRef<LootItem[]>([]);

  // Track spawn accumulators
  const spawnTimerRef = useRef<number>(0);
  const waveElapsedTimeRef = useRef<number>(0);

  // Set up resize listener
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
      viewportSizeRef.current = { w: rect.width, h: rect.height };
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    handleResize();

    return () => observer.disconnect();
  }, []);

  // Keyboard management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;

      // Dash trigger keys: Space or Shift
      if ((e.key === ' ' || e.key === 'Shift') && !isPausedExternallyRef.current) {
        triggerDash();
      }

      // Quick pause key: P or Escape
      if ((e.key === 'Escape' || k === 'p') && !isPausedExternallyRef.current) {
        setIsPaused(prev => !prev);
        gameAudio.playClick();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const triggerDash = () => {
    if (dashCooldownRef.current > 0 || isPaused || isPausedExternallyRef.current) return;

    // Determine direction from keys or joystick, fallback to player current face angle
    let dx = 0;
    let dy = 0;

    if (keysRef.current['w'] || keysRef.current['arrowup']) dy -= 1;
    if (keysRef.current['s'] || keysRef.current['arrowdown']) dy += 1;
    if (keysRef.current['a'] || keysRef.current['arrowleft']) dx -= 1;
    if (keysRef.current['d'] || keysRef.current['arrowright']) dx += 1;

    // Use joystick vector if active
    if (activeJoystickVector.active) {
      dx = activeJoystickVector.x;
      dy = activeJoystickVector.y;
    }

    if (dx === 0 && dy === 0) {
      // Dash towards where player faces
      dx = Math.cos(playerPosRef.current.angle);
      dy = Math.sin(playerPosRef.current.angle);
    }

    // Normalize
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dashDirRef.current = { x: dx / len, y: dy / len };
    } else {
      dashDirRef.current = { x: 1, y: 0 };
    }

    dashTimerRef.current = 10; // active for 10 frames (~160ms)
    dashCooldownRef.current = 90; // cooldown for 90 frames (1.5s at 60fps)
    setDashCooldownRem(1);

    // Play sound and add spark trail
    gameAudio.playDash();

    // Create rapid particle clouds
    const pos = playerPosRef.current;
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x: pos.x,
        y: pos.y,
        dx: (Math.random() - 0.5) * 4 - dashDirRef.current.x * 3,
        dy: (Math.random() - 0.5) * 4 - dashDirRef.current.y * 3,
        radius: Math.random() * 4 + 2,
        color: 'rgba(251, 191, 36, 0.6)',
        alpha: 1,
        decay: 0.05
      });
    }
  };

  // Tracking mouse on canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasMouseX = e.clientX - rect.left;
    const canvasMouseY = e.clientY - rect.top;

    // Convert canvas coordinates back into Arena absolute space based on Camera offset centering player
    const viewPortW = viewportSizeRef.current.w;
    const viewPortH = viewportSizeRef.current.h;
    const camX = playerPosRef.current.x - viewPortW / 2;
    const camY = playerPosRef.current.y - viewPortH / 2;

    mouseRef.current = {
      x: canvasMouseX + camX,
      y: canvasMouseY + camY
    };
  };

  // Generate particles on hit or kill
  const spawnMeltParticles = (x: number, y: number, color: string, count = 8, scale = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 4 + 1.5) * scale;
      particlesRef.current.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        radius: (Math.random() * 3.5 + 1.5) * scale,
        color,
        alpha: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  };

  // Apply damage and manage damage popup
  const applyDamageToEnemy = (enemy: Enemy, dmg: number, forceX = 0, forceY = 0) => {
    // Critical Hit Check
    const isCrit = Math.random() < pStatsRef.current.critChance;
    const actualDmg = isCrit ? dmg * 2 : dmg;

    enemy.hp -= actualDmg;
    enemy.flashDuration = 8; // Flash red for 8 frames

    // Knockback
    enemy.x += forceX;
    enemy.y += forceY;

    // Sound
    gameAudio.playHitEnemy();

    // Damage number popup
    popupsRef.current.push({
      id: Math.random().toString(),
      x: enemy.x + (Math.random() - 0.5) * 15,
      y: enemy.y - 12,
      text: actualDmg.toString() + (isCrit ? ' 暴撃!' : ''),
      color: isCrit ? '#fbbf24' : '#ffffff', // gold for crit, white for regular
      isCrit,
      alpha: 1,
      life: 0
    });

    // Spawn minor splatters
    spawnMeltParticles(enemy.x, enemy.y, enemy.color, 4, isCrit ? 1.4 : 0.8);

    // Check if dead
    if (enemy.hp <= 0) {
      killsRef.current += 1;
      setKills(killsRef.current);
      scoreRef.current += enemy.scoreValue;
      setScore(scoreRef.current);

      // Huge particle splatter
      spawnMeltParticles(enemy.x, enemy.y, enemy.color, 16, 1.5);

      // Drops EXP Gem/Healing Potion
      let dropType: LootType = 'GEM_S';
      let gemChance = Math.random();
      let rollHex = Math.random();

      if (enemy.type === 'BOSS') {
        dropType = 'SHIELD'; // Drops powerful bubble or chest
      } else if (enemy.type === 'CHAMPION') {
        dropType = 'GEM_L';
      } else if (rollHex < 0.04) {
        dropType = 'HEAL'; // 4% heal drop chance
      } else if (gemChance < 0.70) {
        dropType = 'GEM_S';
      } else if (gemChance < 0.95) {
        dropType = 'GEM_M';
      } else {
        dropType = 'GEM_L';
      }

      // Generate visual descriptors
      let dropColors = {
        'GEM_S': '#38bdf8', // sky light blue
        'GEM_M': '#a855f7', // purple
        'GEM_L': '#f14668', // coral orange-red
        'HEAL': '#22c55e',  // green heart
        'SHIELD': '#eab308' // golden treasure shield
      };

      let dropVal = 10; // Exp
      if (dropType === 'GEM_M') dropVal = 30;
      if (dropType === 'GEM_L') dropVal = 80;
      if (dropType === 'HEAL') dropVal = 35; // healing value

      lootItemsRef.current.push({
        id: Math.random().toString(),
        type: dropType,
        x: enemy.x,
        y: enemy.y,
        radius: dropType === 'HEAL' || dropType === 'SHIELD' ? 10 : 6,
        color: dropColors[dropType],
        value: dropVal,
        isAttracted: false
      });
    }
  };

  // Standard enemy spawning
  const spawnEnemyOutside = () => {
    const currentWave = WAVE_CONFIGS[waveNumRef.current - 1] || WAVE_CONFIGS[WAVE_CONFIGS.length - 1];
    
    // Choose enemy type based on Wave configs allowed list
    const pool = currentWave.allowedTypes;
    const type = pool[Math.floor(Math.random() * pool.length)];

    // Calculate spawning radius just outside viewport
    const viewportW = viewportSizeRef.current.w;
    const viewportH = viewportSizeRef.current.h;
    const spawnRadius = Math.max(viewportW, viewportH) / 2 + 100;

    // Pick random angle
    const angle = Math.random() * Math.PI * 2;
    const sx = playerPosRef.current.x + Math.cos(angle) * spawnRadius;
    const sy = playerPosRef.current.y + Math.sin(angle) * spawnRadius;

    // Lock range bounded on MAP
    const rx = Math.max(50, Math.min(MAP_SIZE - 50, sx));
    const ry = Math.max(50, Math.min(MAP_SIZE - 50, sy));

    // Custom stats for different enemy types
    let radius = 16;
    let hp = 15 + currentWave.waveNumber * 5;
    let speed = 1.6 + Math.random() * 0.4;
    let damage = 8 + currentWave.waveNumber * 2;
    let scoreValue = 10;
    let color = '#f87171'; // Light red

    switch (type) {
      case 'SWARMER':
        radius = 12;
        hp = 12 + waveNumRef.current * 4;
        speed = 2.4 + Math.random() * 0.5;
        damage = 5 + waveNumRef.current;
        scoreValue = 8;
        color = '#ef4444'; // Red
        break;
      case 'WARRIOR':
        radius = 18;
        hp = 35 + waveNumRef.current * 10;
        speed = 1.3 + Math.random() * 0.2;
        damage = 12 + waveNumRef.current * 3;
        scoreValue = 18;
        color = '#2563eb'; // Royal Blue
        break;
      case 'MAGE':
        radius = 16;
        hp = 25 + waveNumRef.current * 8;
        speed = 1.0;
        damage = 6 + waveNumRef.current * 2;
        scoreValue = 25;
        color = '#c084fc'; // Violet
        break;
      case 'CHAMPION':
        radius = 24;
        hp = 120 + waveNumRef.current * 50;
        speed = 1.4;
        damage = 25 + waveNumRef.current * 5;
        scoreValue = 75;
        color = '#fbbf24'; // Golden Yellow
        break;
      case 'BOSS':
        // Boss gets spawned separately on wave start or timer, but if naturally, make sure it is extremely buffed
        radius = 45;
        hp = 800 + waveNumRef.current * 400;
        speed = 0.8;
        damage = 35;
        scoreValue = 500;
        color = '#ffffff'; // Multi-color
        break;
    }

    // Spawn adjustment
    enemiesRef.current.push({
      id: Math.random().toString(),
      type,
      x: rx,
      y: ry,
      radius,
      hp,
      maxHp: hp,
      speed,
      damage,
      scoreValue,
      color,
      flashDuration: 0,
      shootCooldown: type === 'MAGE' ? 40 + Math.random() * 50 : undefined,
      angle: 0
    });
  };

  // Spawn actual Giant final waves Bosses
  const spawnEpicBoss = (num: number) => {
    gameAudio.playBossSpawn();
    const bx = MAP_SIZE / 2 + (Math.random() - 0.5) * 300;
    const by = MAP_SIZE / 2 + (Math.random() - 0.5) * 300;

    enemiesRef.current.push({
      id: 'epic-boss-' + num,
      type: 'BOSS',
      x: bx,
      y: by,
      radius: 45,
      hp: 1200 + num * 600,
      maxHp: 1200 + num * 600,
      speed: 0.7,
      damage: 32,
      scoreValue: 1200,
      color: '#ec4899', // Brilliant pink / fuchsia
      flashDuration: 0,
      shootCooldown: 60, // frames interval to fire ring bullets
      angle: 0
    });

    // Make neat text layout
    popupsRef.current.push({
      id: Math.random().toString(),
      x: bx,
      y: by - 40,
      text: '★★★ ボスが出現しました！ ★★★',
      color: '#ef4444',
      isCrit: true,
      alpha: 1.0,
      life: 0
    });
  };

  // Main game logic loop
  useEffect(() => {
    let animationFrameId: number;
    let secondTimerId: NodeJS.Timeout;

    // Seconds time calculator
    secondTimerId = setInterval(() => {
      if (isPaused || isPausedExternally) return;
      
      // HP Regeneration (per second)
      if (pStatsRef.current.regeneration > 0 && pStatsRef.current.hp < pStatsRef.current.maxHp) {
        setPlayerStats(prev => ({
          ...prev,
          hp: Math.min(prev.maxHp, prev.hp + prev.regeneration)
        }));
      }

      gameTimeRef.current += 1;
      setGameTime(gameTimeRef.current);

      // Tick down active wave duration
      waveElapsedTimeRef.current += 1;
      const currentWave = WAVE_CONFIGS[waveNumRef.current - 1] || WAVE_CONFIGS[WAVE_CONFIGS.length - 1];
      
      if (waveElapsedTimeRef.current >= currentWave.duration) {
        // Progress to next wave if available
        if (waveNumRef.current < WAVE_CONFIGS.length) {
          const nextWave = waveNumRef.current + 1;
          setWaveNum(nextWave);
          waveElapsedTimeRef.current = 0;
          gameAudio.playBossSpawn();

          // Spawns bosses as entry alerts for later waves
          if (nextWave === 5) {
            spawnEpicBoss(5);
          }
        }
      }
    }, 1000);

    const loop = () => {
      if (isPaused || isPausedExternally) {
        renderGameScreen();
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      updateGamePhysics();
      renderGameScreen();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(secondTimerId);
    };
  }, [isPaused, isPausedExternally, waveNum, activeJoystickVector]);

  // physics updates
  const updateGamePhysics = () => {
    const pos = playerPosRef.current;
    const stats = pStatsRef.current;

    // 1. Tick Cooldowns
    if (dashCooldownRef.current > 0) {
      dashCooldownRef.current -= 1;
      setDashCooldownRem(dashCooldownRef.current / 90);
    }
    if (dashTimerRef.current > 0) {
      dashTimerRef.current -= 1;
    }
    if (atkCooldownRef.current > 0) {
      atkCooldownRef.current -= 1;
    }
    if (swordSweepActiveRef.current > 0) {
      swordSweepActiveRef.current -= 1;
    }

    // Orbiting Shield Angle speed
    shieldAngleRef.current += 0.04;

    // 2. Capture player movement vector
    let mx = 0;
    let my = 0;

    if (keysRef.current['w'] || keysRef.current['arrowup']) my -= 1;
    if (keysRef.current['s'] || keysRef.current['arrowdown']) my += 1;
    if (keysRef.current['a'] || keysRef.current['arrowleft']) mx -= 1;
    if (keysRef.current['d'] || keysRef.current['arrowright']) mx += 1;

    // Combine keyboard and virtual joystick vector inputs
    if (activeJoystickVector.active) {
      mx = activeJoystickVector.x;
      my = activeJoystickVector.y;
    }

    // Moving speeds
    let moveSpeed = stats.speed;
    if (dashTimerRef.current > 0) {
      // Apply speedy vector multiplier on dash
      mx = dashDirRef.current.x;
      my = dashDirRef.current.y;
      moveSpeed = stats.speed * 2.8;

      // Create ghost visual particle trail
      if (dashTimerRef.current % 2 === 0) {
        particlesRef.current.push({
          x: pos.x,
          y: pos.y,
          dx: 0,
          dy: 0,
          radius: 18,
          color: stats.weapon === 'SWORD' ? 'rgba(239, 68, 68, 0.4)' : stats.weapon === 'BOW' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(168, 85, 247, 0.4)',
          alpha: 0.5,
          decay: 0.08
        });
      }
    }

    const mLen = Math.sqrt(mx * mx + my * my);
    if (mLen > 0) {
      const normalX = mx / (mLen > 1 ? mLen : 1);
      const normalY = my / (mLen > 1 ? mLen : 1);

      // Update position, confine to Map Size Boundaries
      pos.x = Math.max(25, Math.min(MAP_SIZE - 25, pos.x + normalX * moveSpeed));
      pos.y = Math.max(25, Math.min(MAP_SIZE - 25, pos.y + normalY * moveSpeed));

      // Rotate player direction angle towards moving angle only if joystick/key operates
      if (!autoAimRef.current) {
        pos.angle = Math.atan2(normalY, normalX);
      }
    }

    // Auto-Aiming or Mouse Targeting update facing angle
    if (autoAimRef.current) {
      // Find closest enemy inside map to lock face angle
      let closestEnemy = findClosestEnemyToPlayer();
      if (closestEnemy) {
        pos.angle = Math.atan2(closestEnemy.y - pos.y, closestEnemy.x - pos.x);
      } else if (mLen > 0) {
        pos.angle = Math.atan2(my, mx);
      }
    } else {
      // Facing Mouse
      pos.angle = Math.atan2(mouseRef.current.y - pos.y, mouseRef.current.x - pos.x);
    }

    // 3. Spawning Enemies cycle
    spawnTimerRef.current += 16.67; // approx ms at 60fps
    const currentWave = WAVE_CONFIGS[waveNumRef.current - 1] || WAVE_CONFIGS[WAVE_CONFIGS.length - 1];
    
    // Dynamically throttle spacing between spawns
    const adjustedInterval = currentWave.spawnInterval / currentWave.spawnMultiplier;

    if (spawnTimerRef.current >= adjustedInterval) {
      spawnTimerRef.current = 0;
      
      // Limit total concurrent enemies to 120 to preserve CPU
      if (enemiesRef.current.length < 120) {
        const spawnGroupSize = Math.floor(Math.random() * 2) + Math.min(waveNumRef.current, 3);
        for (let i = 0; i < spawnGroupSize; i++) {
          spawnEnemyOutside();
        }
      }
    }

    // 4. Update Weapon Trigger/Attacking
    if (atkCooldownRef.current <= 0) {
      triggerWeaponAttack();
    }

    // 5. Update Bullets
    for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
      const b = bulletsRef.current[i];
      b.x += b.dx;
      b.y += b.dy;
      b.distanceTraveled += Math.sqrt(b.dx * b.dx + b.dy * b.dy);

      let keepBullet = true;

      // Map limits or Max Distance checks
      if (b.distanceTraveled >= b.maxDistance || b.x < 0 || b.y < 0 || b.x > MAP_SIZE || b.y > MAP_SIZE) {
        keepBullet = false;
      }

      if (keepBullet) {
        if (b.isEnemy) {
          // Check collision with Player
          const distToPlayer = Math.sqrt((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2);
          if (distToPlayer < b.radius + 18) {
            // Player hit by bullet!
            if (dashTimerRef.current <= 0) {
              damagePlayer(b.damage);
            }
            keepBullet = false;
          }
        } else {
          // Check collision with Enemies
          for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
            const enemy = enemiesRef.current[j];
            if (enemy.hp <= 0) continue;
            const dist = Math.sqrt((b.x - enemy.x) ** 2 + (b.y - enemy.y) ** 2);
            if (dist < b.radius + enemy.radius) {
              // Apply knockback
              const knockLength = 2.5;
              const kbX = (b.dx / Math.sqrt(b.dx * b.dx + b.dy * b.dy)) * knockLength;
              const kbY = (b.dy / Math.sqrt(b.dx * b.dx + b.dy * b.dy)) * knockLength;

              applyDamageToEnemy(enemy, b.damage, kbX, kbY);

              // Handle magical splash damage for Wizard (STAFF) projectiles
              if (b.color === '#c084fc') {
                const splashRadius = 110;
                const splashDmg = Math.round(b.damage * 0.82); // Splash deals 82% of core damage
                spawnMeltParticles(b.x, b.y, '#c084fc', 12, 1.3);

                for (let k = enemiesRef.current.length - 1; k >= 0; k--) {
                  const otherEnemy = enemiesRef.current[k];
                  if (otherEnemy.id === enemy.id || otherEnemy.hp <= 0) continue;
                  const distToOther = Math.sqrt((b.x - otherEnemy.x) ** 2 + (b.y - otherEnemy.y) ** 2);
                  if (distToOther < splashRadius) {
                    const sAngle = Math.atan2(otherEnemy.y - b.y, otherEnemy.x - b.x);
                    const skbX = Math.cos(sAngle) * 4.5;
                    const skbY = Math.sin(sAngle) * 4.5;
                    applyDamageToEnemy(otherEnemy, splashDmg, skbX, skbY);
                  }
                }
              }
              
              if (!b.isPierce) {
                keepBullet = false;
                break;
              }
            }
          }
        }
      }

      if (!keepBullet) {
        // Spawn sparks on impact
        spawnMeltParticles(b.x, b.y, b.color, 5, 0.7);
        bulletsRef.current.splice(i, 1);
      }
    }

    // 6. Update Enemies AI & Motion
    for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
      const enemy = enemiesRef.current[i];

      // If the enemy is dead, remove them from the list and skip calculations!
      if (enemy.hp <= 0) {
        enemiesRef.current.splice(i, 1);
        continue;
      }

      // Flash feedback
      if (enemy.flashDuration > 0) enemy.flashDuration -= 1;

      const edx = pos.x - enemy.x;
      const edy = pos.y - enemy.y;
      const dist = Math.sqrt(edx * edx + edy * edy);

      // Chase Player
      if (dist > 0) {
        enemy.angle = Math.atan2(edy, edx);
        
        let targetSpeed = enemy.speed;

        // Custom AI: Champion charge attack!
        if (enemy.type === 'CHAMPION') {
          // Every 3 seconds, charge
          const chargeInCycle = (Date.now() % 3000) < 600;
          if (chargeInCycle) {
            targetSpeed = enemy.speed * 2.8;
            enemy.color = '#ef4444'; // Red flash
          } else {
            enemy.color = '#fbbf24'; // Regular golden armor
          }
        }

        enemy.x += (edx / dist) * targetSpeed;
        enemy.y += (edy / dist) * targetSpeed;
      }

      // Mage Ranged attack shooting AI
      if (enemy.type === 'MAGE' && enemy.shootCooldown !== undefined) {
        enemy.shootCooldown -= 1;
        if (enemy.shootCooldown <= 0 && dist < 320) {
          enemy.shootCooldown = 110 + Math.random() * 40; // 2.5s cooldown
          const bAngle = Math.atan2(edy, edx);
          bulletsRef.current.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y,
            dx: Math.cos(bAngle) * 3.5,
            dy: Math.sin(bAngle) * 3.5,
            radius: 5,
            damage: Math.round(enemy.damage * 0.8),
            isEnemy: true,
            color: '#ff2020', // Vivid dangerous glowing red, completely distinct from purple magic/gems
            maxDistance: 450,
            distanceTraveled: 0
          });
        }
      }

      // Epic BOSS Bullet RING shooting patterns
      if (enemy.type === 'BOSS' && enemy.shootCooldown !== undefined) {
        enemy.shootCooldown -= 1;
        if (enemy.shootCooldown <= 0) {
          enemy.shootCooldown = 90; // every 1.5s
          
          const patternSelect = Math.random();
          if (patternSelect < 0.5) {
            // Radial bullet ring
            const bulletCount = 12;
            for (let bIdx = 0; bIdx < bulletCount; bIdx++) {
              const bAngle = (bIdx / bulletCount) * Math.PI * 2;
              bulletsRef.current.push({
                id: Math.random().toString(),
                x: enemy.x,
                y: enemy.y,
                dx: Math.cos(bAngle) * 3.2,
                dy: Math.sin(bAngle) * 3.2,
                radius: 6,
                damage: 15,
                isEnemy: true,
                color: '#ff00ff', // High contrast neon magenta, 100% distinct from any experience gems
                maxDistance: 600,
                distanceTraveled: 0
              });
            }
          } else {
            // Target spray bullet volley
            const bAngle = Math.atan2(edy, edx);
            for (let bIdx = -2; bIdx <= 2; bIdx++) {
              const finalAngle = bAngle + bIdx * 0.22;
              bulletsRef.current.push({
                id: Math.random().toString(),
                x: enemy.x,
                y: enemy.y,
                dx: Math.cos(finalAngle) * 4.5,
                dy: Math.sin(finalAngle) * 4.5,
                radius: 6,
                damage: 18,
                isEnemy: true,
                color: '#ff5500', // Super bright safety neon orange
                maxDistance: 600,
                distanceTraveled: 0
              });
            }
          }
        }
      }

      // Check collision with Player body
      if (dist < enemy.radius + 15) {
        // Only hit player if invincibility frames & dash is NOT active
        if (dashTimerRef.current <= 0) {
          damagePlayer(enemy.damage);
          // Apply minimal rebound pushback to prevent frame-perfect double damage lock
          const pushX = (edx / (dist || 1)) * -12;
          const pushY = (edy / (dist || 1)) * -12;
          enemy.x += pushX;
          enemy.y += pushY;
        }
      }

      // Check collision with Orbiting shield orbs (if player has shields)
      if (stats.shieldCount > 0) {
        for (let sIdx = 0; sIdx < stats.shieldCount; sIdx++) {
          const sAngle = shieldAngleRef.current + (sIdx / stats.shieldCount) * Math.PI * 2;
          const sX = pos.x + Math.cos(sAngle) * 55;
          const sY = pos.y + Math.sin(sAngle) * 55;

          const distToShield = Math.sqrt((enemy.x - sX) ** 2 + (enemy.y - sY) ** 2);
          if (distToShield < enemy.radius + 12) {
            // Deal massive shield sweep damage
            const shidForceX = Math.cos(sAngle) * 4;
            const shidForceY = Math.sin(sAngle) * 4;
            // Shield damage matches 1.2x player base damage
            applyDamageToEnemy(enemy, Math.round(stats.damage * 0.8), shidForceX, shidForceY);
          }
        }
      }

      // Slow collision separation between enemies to prevent stacking
      for (let j = i - 1; j >= 0; j--) {
        const other = enemiesRef.current[j];
        if (other.hp <= 0) continue;
        const sex = other.x - enemy.x;
        const sey = other.y - enemy.y;
        const sdist = Math.sqrt(sex * sex + sey * sey);
        const overlap = (enemy.radius + other.radius) - sdist;

        if (overlap > 0 && sdist > 0) {
          enemy.x -= (sex / sdist) * overlap * 0.15;
          enemy.y -= (sey / sdist) * overlap * 0.15;
          other.x += (sex / sdist) * overlap * 0.15;
          other.y += (sey / sdist) * overlap * 0.15;
        }
      }
    }

    // 7. Update Loot Drops and Magnet pull
    for (let i = lootItemsRef.current.length - 1; i >= 0; i--) {
      const loot = lootItemsRef.current[i];
      const ldx = pos.x - loot.x;
      const ldy = pos.y - loot.y;
      const ldist = Math.sqrt(ldx * ldx + ldy * ldy);

      // Check pull radius
      if (ldist < stats.magnetRadius) {
        loot.isAttracted = true;
      }

      if (loot.isAttracted) {
        // Accelerate item towards Player
        const pullSpeed = 4.8;
        loot.x += (ldx / ldist) * pullSpeed;
        loot.y += (ldy / ldist) * pullSpeed;
      }

      // Collect item check
      if (ldist < loot.radius + 16) {
        collectLootItem(loot);
        lootItemsRef.current.splice(i, 1);
      }
    }

    // 8. Update Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.dx;
      p.y += p.dy;
      if (p.gravity) p.dy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particlesRef.current.splice(i, 1);
      }
    }

    // 9. Update Popups
    for (let i = popupsRef.current.length - 1; i >= 0; i--) {
      const pop = popupsRef.current[i];
      pop.y -= 0.6; // Hover upward
      pop.life += 0.02; // Lifespan increment
      if (pop.life >= 1.0) {
        popupsRef.current.splice(i, 1);
      }
    }
  };

  // Weapon firing action
  const triggerWeaponAttack = () => {
    const stats = pStatsRef.current;
    const pos = playerPosRef.current;

    let baseCooldown = 50; // frames
    
    if (stats.weapon === 'SWORD') {
      baseCooldown = 32; // Faster sword recovery swings (was 40)
      atkCooldownRef.current = Math.max(10, baseCooldown * stats.attackSpeedMultiplier);
      
      // Sweep action triggered
      swordSweepActiveRef.current = 14;
      swordSweepDirRef.current = pos.angle;
      swordSweepSideRef.current *= -1; // Toggle side swings back-and-forth

      gameAudio.playSlash();

      // Swing Sweep Attack Detection - Buffed Knight Range & Sweep Arc for massive groups!
      const sweepRange = 155; // Long range reach (was 115)
      const sweepArc = Math.PI * 1.25; // 225 degree massive sweeping semi-circle (was 160)

      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const enemy = enemiesRef.current[i];
        if (enemy.hp <= 0) continue;
        const edx = enemy.x - pos.x;
        const edy = enemy.y - pos.y;
        const edist = Math.sqrt(edx * edx + edy * edy);

        if (edist <= sweepRange) {
          // Check if enemy lies within sweep angle limits
          let angleToEnemy = Math.atan2(edy, edx);
          let angleDiff = angleToEnemy - pos.angle;
          
          // Normalize angle difference to limits [-PI, PI]
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          if (Math.abs(angleDiff) <= sweepArc / 2) {
            // Sword sweep! Knocks enemy backward in angle with solid feedback
            const kbForce = 16.0; // Strong knockback (was 12)
            const kbX = Math.cos(angleToEnemy) * kbForce;
            const kbY = Math.sin(angleToEnemy) * kbForce;
            applyDamageToEnemy(enemy, stats.damage, kbX, kbY);
          }
        }
      }
    } 
    else if (stats.weapon === 'BOW') {
      baseCooldown = 28;
      atkCooldownRef.current = Math.max(8, baseCooldown * stats.attackSpeedMultiplier);
      
      gameAudio.playShootBow();

      // Fires projectile count arrows spreads
      const count = 1 + stats.projectileCount;
      const spreadAngle = 0.15; // rad spread spacing

      for (let i = 0; i < count; i++) {
        // Calculate offset angle
        const offset = (i - (count - 1) / 2) * spreadAngle;
        const finalAngle = pos.angle + offset;

        bulletsRef.current.push({
          id: Math.random().toString(),
          x: pos.x,
          y: pos.y,
          dx: Math.cos(finalAngle) * 8.5,
          dy: Math.sin(finalAngle) * 8.5,
          radius: 4,
          damage: Math.round(stats.damage * 0.9), // Slightly lower damage since fast & ranged
          isEnemy: false,
          color: '#fb923c', // orange arrows
          maxDistance: 480,
          distanceTraveled: 0,
          isPierce: true // Bow arrows pierce enemies!
        });
      }
    } 
    else if (stats.weapon === 'STAFF') {
      baseCooldown = 30; // Wizard attacks much more frequently now! (was 45)
      atkCooldownRef.current = Math.max(9, baseCooldown * stats.attackSpeedMultiplier);

      gameAudio.playMagicSpell();

      const count = 1 + stats.projectileCount;
      const spreadAngle = 0.22;

      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spreadAngle;
        const finalAngle = pos.angle + offset;

        bulletsRef.current.push({
          id: Math.random().toString(),
          x: pos.x,
          y: pos.y,
          dx: Math.cos(finalAngle) * 8.0, // Swifter projectiles (was 6.2)
          dy: Math.sin(finalAngle) * 8.0,
          radius: 7,
          damage: Math.round(stats.damage * 1.5), // High damage magic projectiles
          isEnemy: false,
          color: '#c084fc', // purple arcane missile
          maxDistance: 480, // Extended range (was 400)
          distanceTraveled: 0,
          isPierce: false // Explodes on first impact, deals massive splash damages!
        });
      }
    }
  };

  // Find target for Auto-aiming
  const findClosestEnemyToPlayer = (): Enemy | null => {
    let closest: Enemy | null = null;
    let minDist = Infinity;
    const pos = playerPosRef.current;

    enemiesRef.current.forEach(enemy => {
      if (enemy.hp <= 0) return;
      const dist = Math.sqrt((enemy.x - pos.x) ** 2 + (enemy.y - pos.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = enemy;
      }
    });

    return closest;
  };

  // Process item pickup
  const collectLootItem = (item: LootItem) => {
    // Spark animation
    spawnMeltParticles(item.x, item.y, item.color, 8, 0.8);
    gameAudio.playClick();

    if (item.type.startsWith('GEM_')) {
      // EXP Gem
      const gainedExp = item.value;
      const stats = pStatsRef.current;
      const nextExp = stats.exp + gainedExp;

      // Update Experience
      if (nextExp >= stats.nextLevelExp) {
        // Level Up Trigger!
        const leftover = nextExp - stats.nextLevelExp;
        const nextLevel = stats.level + 1;
        const nextTargetExp = Math.round(stats.nextLevelExp * 1.35 + 50);

        gameAudio.playLevelUp();

        // Level-Up Ring Visual Blast wave
        for (let i = 0; i < 30; i++) {
          const angle = (i / 30) * Math.PI * 2;
          particlesRef.current.push({
            x: playerPosRef.current.x,
            y: playerPosRef.current.y,
            dx: Math.cos(angle) * 6,
            dy: Math.sin(angle) * 6,
            radius: 4,
            color: '#febb07',
            alpha: 1,
            decay: 0.03
          });
        }

        popupsRef.current.push({
          id: Math.random().toString(),
          x: playerPosRef.current.x,
          y: playerPosRef.current.y - 30,
          text: `▲ レベルアップ! LV ${nextLevel} ▲`,
          color: '#fbbf24',
          isCrit: true,
          alpha: 1,
          life: 0
        });

        // Trigger react callback state logic
        setPlayerStats(prev => ({
          ...prev,
          level: nextLevel,
          exp: leftover,
          nextLevelExp: nextTargetExp
        }));

        onLevelUp();
      } else {
        setPlayerStats(prev => ({ ...prev, exp: nextExp }));
      }
    } 
    else if (item.type === 'HEAL') {
      setPlayerStats(prev => ({
        ...prev,
        hp: Math.min(prev.maxHp, prev.hp + item.value)
      }));

      popupsRef.current.push({
        id: Math.random().toString(),
        x: playerPosRef.current.x,
        y: playerPosRef.current.y - 25,
        text: `+${item.value} 回復`,
        color: '#4ade80',
        isCrit: false,
        alpha: 1,
        life: 0
      });
    }
    else if (item.type === 'SHIELD') {
      // Powerful invincibility barrier / custom shields gain
      setPlayerStats(prev => ({
        ...prev,
        shieldCount: Math.min(3, prev.shieldCount + 1)
      }));

      popupsRef.current.push({
        id: Math.random().toString(),
        x: playerPosRef.current.x,
        y: playerPosRef.current.y - 25,
        text: `盾バリア展開! +1 SHIELD`,
        color: '#c084fc',
        isCrit: true,
        alpha: 1,
        life: 0
      });
    }
  };

  // Player taking damage
  const damagePlayer = (dmg: number) => {
    const roundedDmg = Math.round(dmg);
    // If shield orbits exist, absorb hit instead of full damage!
    if (pStatsRef.current.shieldCount > 0) {
      gameAudio.playHitPlayer();
      setPlayerStats(prev => ({ ...prev, shieldCount: prev.shieldCount - 1 }));

      popupsRef.current.push({
        id: Math.random().toString(),
        x: playerPosRef.current.x,
        y: playerPosRef.current.y - 25,
        text: 'シールド防御!',
        color: '#38bdf8',
        isCrit: true,
        alpha: 1,
        life: 0
      });

      // Blast wave to push away near enemies
      spawnMeltParticles(playerPosRef.current.x, playerPosRef.current.y, '#38bdf8', 12, 1.2);
      return;
    }

    gameAudio.playHitPlayer();
    
    const newHp = Math.max(0, pStatsRef.current.hp - roundedDmg);
    setPlayerStats(prev => ({ ...prev, hp: newHp }));

    // Flash screen/sparks
    spawnMeltParticles(playerPosRef.current.x, playerPosRef.current.y, '#ef4444', 8, 1.0);

    popupsRef.current.push({
      id: Math.random().toString(),
      x: playerPosRef.current.x + (Math.random() - 0.5) * 10,
      y: playerPosRef.current.y - 20,
      text: `-${roundedDmg}`,
      color: '#ef4444',
      isCrit: false,
      alpha: 1.0,
      life: 0
    });

    if (newHp <= 0) {
      // Game over! Stop loop
      gameAudio.playGameOver();
      onGameOver(scoreRef.current, killsRef.current, gameTimeRef.current);
    }
  };

  // 10. Canvas DRAW rendering layout
  const renderGameScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport and dynamic camera calculations
    const vW = viewportSizeRef.current.w;
    const vH = viewportSizeRef.current.h;
    
    // Clear viewport with a nice obsidian charcoal gray dark base
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, vW, vH);

    // Camera offset translation so player stays centered
    const pPos = playerPosRef.current;
    const camX = pPos.x - vW / 2;
    const camY = pPos.y - vH / 2;

    ctx.save();
    ctx.translate(-camX, -camY);

    // ==========================================
    // DRAW ARENA BACKGROUND
    // ==========================================
    // Dark tiled floor grid
    const gridSize = 40;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1;

    // Bound grid loop to MAP boundaries
    const startGridX = Math.floor(Math.max(0, camX) / gridSize) * gridSize;
    const endGridX = Math.ceil(Math.min(MAP_SIZE, camX + vW) / gridSize) * gridSize;
    const startGridY = Math.floor(Math.max(0, camY) / gridSize) * gridSize;
    const endGridY = Math.ceil(Math.min(MAP_SIZE, camY + vH) / gridSize) * gridSize;

    for (let gx = startGridX; gx <= endGridX; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, Math.max(0, camY));
      ctx.lineTo(gx, Math.min(MAP_SIZE, camY + vH));
      ctx.stroke();
    }
    for (let gy = startGridY; gy <= endGridY; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(Math.max(0, camX), gy);
      ctx.lineTo(Math.min(MAP_SIZE, camX + vW), gy);
      ctx.stroke();
    }

    // Outer Map Ring Boundary lines (Glowing arena border)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.stroke();

    // Map Corner grid marks
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(10, 10, 10, 10);
    ctx.fillRect(MAP_SIZE - 20, 10, 10, 10);
    ctx.fillRect(10, MAP_SIZE - 20, 10, 10);
    ctx.fillRect(MAP_SIZE - 20, MAP_SIZE - 20, 10, 10);

    // ==========================================
    // DRAW LOOT DROPS
    // ==========================================
    lootItemsRef.current.forEach(loot => {
      // Glow shadow around gemstone
      ctx.shadowColor = loot.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = loot.color;

      ctx.beginPath();
      if (loot.type === 'HEAL') {
        // Red / green heart capsule shape
        const rx = loot.x;
        const ry = loot.y;
        ctx.beginPath();
        ctx.arc(rx - 3, ry - 3, 4, 0, Math.PI * 2);
        ctx.arc(rx + 3, ry - 3, 4, 0, Math.PI * 2);
        ctx.moveTo(rx - 7, ry - 2);
        ctx.lineTo(rx, ry + 6);
        ctx.lineTo(rx + 7, ry - 2);
        ctx.closePath();
      } else if (loot.type === 'SHIELD') {
        // Golden star orb
        ctx.arc(loot.x, loot.y, loot.radius, 0, Math.PI * 2);
      } else {
        // Shimmering Diamond gemstone shape
        const r = loot.radius;
        ctx.moveTo(loot.x, loot.y - r);
        ctx.lineTo(loot.x + r, loot.y);
        ctx.lineTo(loot.x, loot.y + r);
        ctx.lineTo(loot.x - r, loot.y);
      }
      ctx.fill();
    });
    // Turn off shadows for faster sprites draw
    ctx.shadowBlur = 0;

    // ==========================================
    // DRAW BULLETS
    // ==========================================
    bulletsRef.current.forEach(b => {
      if (b.isEnemy) {
        ctx.save();
        
        // 1. Thick dark outline for high contrast against any floor or gem color
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = "#000000";
        ctx.fill();

        // 2. High intensity neon warning color
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();

        // 3. Bright white central core (makes it look like a real energy projectile instead of a gem)
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.restore();
      } else {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.shadowBlur = 0;

    // ==========================================
    // DRAW ENEMIES
    // ==========================================
    enemiesRef.current.forEach(enemy => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle || 0);

      // Flash color if red-flash timer active
      if (enemy.flashDuration > 0) {
        ctx.fillStyle = '#ff8888';
      } else {
        ctx.fillStyle = enemy.color;
      }

      // Draw cute distinct sprite shapes per enemy type
      ctx.beginPath();
      if (enemy.type === 'SWARMER') {
        // Draw spiked spider ball
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw basic visual spikes/legs
        ctx.strokeStyle = enemy.color;
        ctx.lineWidth = 2;
        for (let s = 0; s < 6; s++) {
          const sAngle = (s / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sAngle) * (enemy.radius - 2), Math.sin(sAngle) * (enemy.radius - 2));
          ctx.lineTo(Math.cos(sAngle) * (enemy.radius + 6), Math.sin(sAngle) * (enemy.radius + 6));
          ctx.stroke();
        }
      } 
      else if (enemy.type === 'WARRIOR') {
        // Shield polygon layout
        ctx.moveTo(0, -enemy.radius);
        ctx.lineTo(enemy.radius, -enemy.radius * 0.4);
        ctx.lineTo(enemy.radius * 0.7, enemy.radius);
        ctx.lineTo(-enemy.radius * 0.7, enemy.radius);
        ctx.lineTo(-enemy.radius, -enemy.radius * 0.4);
        ctx.closePath();
        ctx.fill();

        // Highlighting shield trim
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 2;
        ctx.stroke();
      } 
      else if (enemy.type === 'MAGE') {
        // Hexagonal hood wizard
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Eyes glow
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -4, 4, 2);
        ctx.fillRect(2, 2, 4, 2);
      }
      else if (enemy.type === 'CHAMPION') {
        // Giant golden diamond warrior
        ctx.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
        ctx.fill();

        ctx.strokeStyle = '#e11d48'; // crimson lining
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      else if (enemy.type === 'BOSS') {
        // Huge Crimson Dragon circle with dynamic wings
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#f0f9ff';
        ctx.beginPath();
        ctx.arc(enemy.radius * 0.4, -enemy.radius * 0.35, 6, 0, Math.PI * 2);
        ctx.arc(enemy.radius * 0.4, enemy.radius * 0.35, 6, 0, Math.PI * 2);
        ctx.fill();

        // Wings sweep animation using sin wave
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 6;
        const wingSweep = Math.sin(Date.now() / 150) * enemy.radius * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -enemy.radius * 0.8);
        ctx.quadraticCurveTo(-enemy.radius, -enemy.radius * 1.5 + wingSweep, -enemy.radius * 1.8, -enemy.radius * 0.6);
        ctx.moveTo(0, enemy.radius * 0.8);
        ctx.quadraticCurveTo(-enemy.radius, enemy.radius * 1.5 - wingSweep, -enemy.radius * 1.8, enemy.radius * 0.6);
        ctx.stroke();
      }

      ctx.restore();

      // Enemy Health scale displayed above bosses and targets with HP damaged
      if (enemy.hp < enemy.maxHp) {
        const hpPercent = enemy.hp / enemy.maxHp;
        ctx.fillStyle = '#1e1b4b'; // black background
        ctx.fillRect(enemy.x - 15, enemy.y - enemy.radius - 8, 30, 4);

        ctx.fillStyle = enemy.type === 'BOSS' ? '#f43f5e' : '#22c55e'; // Green health, red for bosses
        ctx.fillRect(enemy.x - 15, enemy.y - enemy.radius - 8, 30 * hpPercent, 4);
      }
    });

    // ==========================================
    // DRAW PLAYER
    // ==========================================
    ctx.save();
    ctx.translate(pPos.x, pPos.y);
    ctx.rotate(pPos.angle);

    // Active weapon sweeping visual effects overlay inside translate
    const stats = pStatsRef.current;
    
    // Core player circle body
    // Light-Blue glowing center
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = dashTimerRef.current > 0 ? 15 : 6;
    
    // Character shape
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Trim ring
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Visual pointer (sword or bow layout holding vector)
    if (stats.weapon === 'SWORD') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      // sword blade extending forward
      ctx.rect(10, -3, 24, 6);
      ctx.fill();

      // Glowing hilt guard
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(14, -7, 3, 14);
    } 
    else if (stats.weapon === 'BOW') {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // bow recurve arch
      ctx.arc(10, 0, 14, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();

      // golden bowstring
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, -11);
      ctx.lineTo(3, 0);
      ctx.lineTo(10, 11);
      ctx.stroke();
    } 
    else if (stats.weapon === 'STAFF') {
      // Golden Mage Wand staff
      ctx.fillStyle = '#d97706';
      ctx.fillRect(10, -2, 20, 4);
      
      // Floating glowing amethyst sphere crystal on tip
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(28, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore(); // end player rotation layer

    // Draw active Sword Sweep visual overlay in absolute space
    if (stats.weapon === 'SWORD' && swordSweepActiveRef.current > 0) {
      ctx.save();
      ctx.translate(pPos.x, pPos.y);
      ctx.rotate(swordSweepDirRef.current);

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      
      const sweepDirection = swordSweepSideRef.current;
      const progress = (14 - swordSweepActiveRef.current) / 14;
      const swingStart = -Math.PI * 0.4 * sweepDirection;
      const swingEnd = Math.PI * 0.4 * sweepDirection * progress;

      ctx.arc(0, 0, 80, swingStart, swingStart + swingEnd, sweepDirection < 0);
      ctx.stroke();

      // Sharp glowing white edge
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 80, swingStart + swingEnd * 0.8, swingStart + swingEnd * 1.05, sweepDirection < 0);
      ctx.stroke();

      ctx.restore();
    }

    // Orbiting Shield shields
    if (stats.shieldCount > 0) {
      for (let sIdx = 0; sIdx < stats.shieldCount; sIdx++) {
        // Distribute shields equally around player circle bounds
        const sAngle = shieldAngleRef.current + (sIdx / stats.shieldCount) * Math.PI * 2;
        const sX = pPos.x + Math.cos(sAngle) * 55;
        const sY = pPos.y + Math.sin(sAngle) * 55;

        // Draw shield bubble
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sX, sY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Ring trim
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sX, sY, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // Magnetic pulling range dash-indicator (subtle golden circle in background)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pPos.x, pPos.y, stats.magnetRadius, 0, Math.PI * 2);
    ctx.stroke();

    // ==========================================
    // DRAW PARTICLES & POPUPS
    // ==========================================
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // Reset alpha

    popupsRef.current.forEach(pop => {
      ctx.fillStyle = pop.color;
      ctx.font = pop.isCrit ? '900 13px "JetBrains Mono", sans-serif' : 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y);
    });

    ctx.restore(); // restore camera transformation context
  };

  return (
    <div ref={containerRef} className="relative w-full h-full cursor-crosshair overflow-hidden rounded-2xl border border-zinc-800 bg-[#09090b] touch-none">
      
      {/* Absolute canvas elements */}
      <canvas 
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        className="block w-full h-full"
      />

      {/* Screen Damage Vignette Alert (When HP is low, under 30%) */}
      {playerStats.hp < playerStats.maxHp * 0.3 && (
        <div className="absolute inset-0 z-10 pointer-events-none border-[12px] sm:border-[20px] border-red-500/25 animate-pulse" />
      )}

      {/* In-Game HUD overlay panel */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none w-[200px] select-none bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 backdrop-blur-md">
        <div className="text-xs font-mono text-zinc-500 mb-1">CURRENT WAVE</div>
        <div className="text-lg font-sans font-black text-amber-400 capitalize mb-2">
          {WAVE_CONFIGS[waveNum - 1]?.japaneseName || '最終ウェーブ'}
        </div>

        {/* Lifebar panel */}
        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 mb-1">
          <span>HP</span>
          <span>{Math.round(playerStats.hp)} / {playerStats.maxHp}</span>
        </div>
        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 mb-2">
          <div 
            className="h-full bg-linear-to-r from-emerald-500 to-green-400 duration-200 transition-all" 
            style={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}
          />
        </div>

        {/* EXP bar panel */}
        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 mb-1">
          <span>EXP (LV {playerStats.level})</span>
          <span>{playerStats.exp} / {playerStats.nextLevelExp}</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
          <div 
            className="h-full bg-linear-to-r from-sky-500 to-indigo-500 transition-all duration-200" 
            style={{ width: `${(playerStats.exp / playerStats.nextLevelExp) * 100}%` }}
          />
        </div>
      </div>

      {/* Active gameplay HUD scores right-aligned */}
      <div className="absolute top-4 right-4 z-20 pointer-events-none flex flex-col items-end gap-1 font-mono text-xs select-none">
        
        {/* Score Card */}
        <div className="bg-zinc-950/80 px-3 py-1.5 rounded-lg border border-zinc-800/80 backdrop-blur-md text-right text-white">
          <span className="text-zinc-500 mr-2">SCORE:</span>
          <span className="font-bold text-amber-500 text-sm">{score}</span>
        </div>

        {/* Time Card */}
        <div className="bg-zinc-950/80 px-3 py-1 bg-zinc-950/80 rounded-lg border border-zinc-800/80 backdrop-blur-md text-right text-zinc-300">
          <span className="text-zinc-500 mr-2">TIME:</span>
          <span className="font-bold">
            {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {/* Kills Card */}
        <div className="bg-zinc-950/80 px-3 py-1 rounded-lg border border-zinc-800/80 backdrop-blur-md text-right text-zinc-300">
          <span className="text-zinc-500 mr-2">KILLS:</span>
          <span className="text-rose-400 font-bold">{kills}</span>
        </div>
      </div>

      {/* Skills / Dash Cooldown Indicator Footer */}
      <div className="absolute bottom-4 left-4 z-20 select-none flex items-center gap-3">
        {/* Dash Skill Button */}
        <button 
          onClick={triggerDash}
          className="relative pointer-events-auto w-12 h-12 bg-zinc-950/90 border border-zinc-800 hover:border-amber-400 rounded-xl flex flex-col items-center justify-center transition-all focus:outline-hidden group active:scale-90"
        >
          <Zap className="w-5 h-5 text-amber-400 group-hover:scale-110 duration-200" />
          <span className="text-[7px] text-zinc-500 font-mono tracking-tighter mt-0.5">SPACE (DASH)</span>
          
          {/* Circular cooldown fan overlay */}
          {dashCooldownRem > 0 && (
            <div 
              className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center text-[10px] text-amber-400 font-bold font-mono"
              style={{ clipPath: `ellipse(100% 100% at 50% 50%)` }}
            >
              {Math.ceil(dashCooldownRem * 1.5 * 10) / 10}s
            </div>
          )}
        </button>

        {/* Autotarget toggler */}
        <button 
          onClick={() => {
            gameAudio.playClick();
            setAutoAimEnabled(prev => !prev);
          }}
          className={`pointer-events-auto px-2.5 h-12 rounded-xl flex flex-col items-center justify-center border transition-all text-xs select-none ${
            autoAimEnabled 
              ? 'bg-amber-500/22 border-amber-500 text-amber-200' 
              : 'bg-zinc-950/90 border-zinc-800 text-zinc-500'
          }`}
        >
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            <span className="font-mono font-bold text-[8px] uppercase">Auto-Aim</span>
          </div>
          <span className="text-[10px] font-sans font-bold mt-0.5">
            {autoAimEnabled ? '自動照準 ON' : '手動照準 (Mouse)'}
          </span>
        </button>

        {/* Pause Button */}
        <button 
          onClick={() => {
            gameAudio.playClick();
            setIsPaused(prev => !prev);
          }}
          className="pointer-events-auto p-2 h-12 w-12 bg-zinc-950/90 border border-zinc-800 hover:border-white rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95"
        >
          <Power className="w-5 h-5" />
          <span className="text-[7px] font-mono mt-0.5 text-zinc-500">PAUSE [ESC]</span>
        </button>
      </div>

      {/* Wave announcements banner overlay */}
      {waveElapsedTimeRef.current < 4 && (
        <div className="absolute inset-x-0 top-1/4 pointer-events-none flex flex-col items-center text-center select-none animate-bounce">
          <div className="bg-black/85 border-y-2 border-amber-500/80 py-4 px-12 w-full max-w-xl shadow-2xl shadow-red-500/10 backdrop-blur-sm">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block mb-1">
              WAVE {waveNum} SURVIVAL
            </span>
            <h2 className="text-2xl sm:text-3xl font-sans font-extrabold text-white">
              {WAVE_CONFIGS[waveNum - 1]?.japaneseName || 'FINAL ONSLAUGHT'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono uppercase">
              {WAVE_CONFIGS[waveNum - 1]?.name || 'Defeat the Boss'}
            </p>
          </div>
        </div>
      )}

      {/* Paused PauseOverlay Screen */}
      {isPaused && (
        <div className="absolute inset-0 z-30 bg-black/75 flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="text-center p-8 max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl select-none">
            <Swords className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-sans font-black text-white mb-2">GAME PAUSED</h3>
            <p className="text-xs text-zinc-500 mb-6 font-mono">
              戦闘は一時停止中です。<br />
              [ESC]または下のボタンで再開します。
            </p>
            <button 
              onClick={() => {
                gameAudio.playClick();
                setIsPaused(false);
              }}
              className="pointer-events-auto w-full py-2.5 bg-linear-to-r from-amber-500 to-amber-600 border border-amber-300 text-black font-sans font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 duration-150"
            >
              Resume Play / 再開する
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
