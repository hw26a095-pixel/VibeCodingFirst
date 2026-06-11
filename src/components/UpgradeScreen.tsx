/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlayerStats, Upgrade } from '../types';
import { Shield, Zap, Sword, Heart, Sparkles, Magnet, Activity, Crosshair, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { gameAudio } from '../audio';

interface UpgradeScreenProps {
  playerStats: PlayerStats;
  onSelectUpgrade: (upgrade: Upgrade) => void;
}

export const UPGRADES_LIST: Upgrade[] = [
  {
    id: 'dmg_boost',
    name: 'Might Boost',
    japaneseName: '攻撃力の強化',
    description: 'Increases all weapon damage by +20%',
    japaneseDescription: 'すべての攻撃の威力が +20% 上昇します。',
    icon: 'Sword',
    onApply: (stats) => ({ ...stats, damage: Math.round(stats.damage * 1.2 * 10) / 10 }),
  },
  {
    id: 'speed_boost',
    name: 'Hermes Wings',
    japaneseName: '迅速の羽',
    description: 'Increases movement speed by +12%',
    japaneseDescription: 'プレイヤーの移動速度が +12% 上昇します。',
    icon: 'Zap',
    onApply: (stats) => ({ ...stats, speed: Math.round(stats.speed * 1.12 * 10) / 10 }),
  },
  {
    id: 'atk_speed',
    name: 'Wind Quiver',
    japaneseName: '風のルーン',
    description: 'Increases attack speed (decreases weapon cooldown) by +15%',
    japaneseDescription: '攻撃の間隔（クールダウン）が +15% 短縮されます。',
    icon: 'Sparkles',
    onApply: (stats) => ({ ...stats, attackSpeedMultiplier: Math.round(stats.attackSpeedMultiplier * 0.85 * 100) / 100 }),
  },
  {
    id: 'max_hp',
    name: 'Sacred Heart',
    japaneseName: '生命の輝き',
    description: 'Increases Max HP by +30 and heals for 30 HP',
    japaneseDescription: '最大HPが +30 増加し、HPを 30 回復します。',
    icon: 'Heart',
    onApply: (stats) => {
      const newMax = stats.maxHp + 30;
      return { ...stats, maxHp: newMax, hp: Math.min(newMax, stats.hp + 30) };
    },
  },
  {
    id: 'magnet_range',
    name: 'Gravity Pull',
    japaneseName: '重力の磁石',
    description: 'Increases EXP extraction magnet range by +45%',
    japaneseDescription: '経験値ジェムを引き寄せる吸引範囲が +45% 拡大します。',
    icon: 'Magnet',
    onApply: (stats) => ({ ...stats, magnetRadius: Math.round(stats.magnetRadius * 1.45) }),
  },
  {
    id: 'shield',
    name: 'Orbiting Shield',
    japaneseName: '防護の結界',
    description: 'Spawns an orbiting shield that damages close enemies and blocks 1 hit',
    japaneseDescription: '周囲を浮遊する盾を生成。接近する敵にダメージを与え、攻撃を防ぎます。',
    icon: 'Shield',
    onApply: (stats) => ({ ...stats, shieldCount: stats.shieldCount + 1 }),
  },
  {
    id: 'regen',
    name: 'Rejuvenation',
    japaneseName: '治癒の癒し',
    description: 'Passive recovery of +1 HP every 2 seconds',
    japaneseDescription: '2秒ごとにプレイヤーのHPを +1 自動的に回復します。',
    icon: 'Activity',
    onApply: (stats) => ({ ...stats, regeneration: stats.regeneration + 0.5 }),
  },
  {
    id: 'crit',
    name: 'Hawk Eye',
    japaneseName: '一撃の極意',
    description: 'Increases critical hit strike rate by +15% (Double Damage)',
    japaneseDescription: 'クリティカル率が +15% 上昇します（ダメージ2倍）。',
    icon: 'Crosshair',
    onApply: (stats) => ({ ...stats, critChance: Math.round((stats.critChance + 0.15) * 100) / 100 }),
  },
  {
    id: 'extra_proj',
    name: 'Splitting Will',
    japaneseName: '分裂の術',
    description: 'Fires +1 extra projectile for Bow/Staff weapons',
    japaneseDescription: '（弓・魔杖）攻撃時に追加の発射物を +1 同時発射します。',
    icon: 'Sparkles',
    onApply: (stats) => ({ ...stats, projectileCount: stats.projectileCount + 1 }),
  },
  {
    id: 'extra_slashes',
    name: 'Multi-Directional Slash',
    japaneseName: '多角連撃の術',
    description: 'Triggers +1 additional deep physical sword sweep in other directions!',
    japaneseDescription: '剣で攻撃時、死角をカバーする周囲への追加の大振りの斬撃（+1回）を同時に放ちます。',
    icon: 'Sword',
    onApply: (stats) => ({ ...stats, projectileCount: stats.projectileCount + 1 }),
  }
];

export const UpgradeScreen: React.FC<UpgradeScreenProps> = ({ playerStats, onSelectUpgrade }) => {
  // Select 3 random upgrades
  const [choices, setChoices] = React.useState<Upgrade[]>([]);

  React.useEffect(() => {
    // Sift upgrades
    const filtered = [...UPGRADES_LIST];
    // If melee weapon, projectileCount is not very useful, but we can still offer it as visual shield size, or just filter it if they have sword
    let finalPool = filtered;
    if (playerStats.weapon === 'SWORD') {
      finalPool = filtered.filter(u => u.id !== 'extra_proj');
    } else {
      finalPool = filtered.filter(u => u.id !== 'extra_slashes');
    }

    const shuffled = [...finalPool].sort(() => 0.5 - Math.random());
    setChoices(shuffled.slice(0, 3));
  }, [playerStats]);

  const selectUpgrade = (upgrade: Upgrade) => {
    gameAudio.playClick();
    onSelectUpgrade(upgrade);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sword': return <Sword className="w-8 h-8 text-rose-400" />;
      case 'Zap': return <Zap className="w-8 h-8 text-amber-400" />;
      case 'Sparkles': return <Sparkles className="w-8 h-8 text-purple-400" />;
      case 'Heart': return <Heart className="w-8 h-8 text-emerald-400" />;
      case 'Magnet': return <Magnet className="w-8 h-8 text-sky-400" />;
      case 'Shield': return <Shield className="w-8 h-8 text-blue-400" />;
      case 'Activity': return <Activity className="w-8 h-8 text-teal-400" />;
      case 'Crosshair': return <Crosshair className="w-8 h-8 text-orange-400" />;
      default: return <HelpCircle className="w-8 h-8 text-gray-400" />;
    }
  };

  return (
    <div id="upgrade-overlay" className="absolute inset-0 z-40 bg-black/85 flex flex-col justify-center items-center p-4 sm:p-6 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-4xl text-center flex flex-col items-center select-none my-auto py-2"
      >
        <span className="text-amber-500 font-mono tracking-widest text-xs sm:text-sm md:text-lg font-bold bg-amber-950/40 border border-amber-800/40 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full mb-2 sm:mb-3 uppercase animate-pulse">
          LEVEL UP! / レベルアップ!
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-sans font-black text-white mb-1 sm:mb-2 tracking-tight">
          Select Your Upgrade
        </h2>
        <p className="text-gray-400 text-xs sm:text-sm max-w-md mx-auto mb-5 sm:mb-8 md:mb-10 font-sans px-2">
          Choose a path to bolster your defenses. Enemies are growing stronger!
          <br className="hidden sm:block" />
          能力を強化して生き残りましょう。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 w-full max-w-3xl px-2">
          {choices.map((upgrade, idx) => (
            <motion.div
              key={upgrade.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1, type: "spring", stiffness: 100 }}
              onClick={() => selectUpgrade(upgrade)}
              className="group cursor-pointer relative bg-zinc-900 border border-zinc-800 hover:border-amber-500/80 p-4 sm:p-6 rounded-xl sm:rounded-2xl flex md:flex-col items-center text-left md:text-center transition-all duration-300 transform md:hover:-translate-y-2 hover:shadow-2xl hover:shadow-amber-500/10 active:scale-98 touch-manipulation"
            >
              {/* Card visual highlight */}
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 rounded-xl sm:rounded-2xl transition-opacity duration-300" />
              
              {/* Icon Container */}
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-zinc-950 flex flex-shrink-0 items-center justify-center mr-4 md:mr-0 md:mb-5 border border-zinc-800 group-hover:border-amber-500/40 group-hover:bg-zinc-900 duration-300">
                {getIcon(upgrade.icon)}
              </div>

              {/* Text Container */}
              <div className="flex-1 min-w-0 md:flex flex-col md:items-center">
                {/* Japanese Title */}
                <h4 className="text-[10px] sm:text-xs font-mono text-amber-500 tracking-wider font-bold mb-0.5">
                  {upgrade.japaneseName}
                </h4>

                {/* Name */}
                <h3 className="text-sm sm:text-base md:text-lg font-sans font-black text-white mb-1 md:mb-3 group-hover:text-amber-400 transition-colors">
                  {upgrade.name}
                </h3>

                {/* Divider */}
                <div className="hidden md:block w-12 h-px bg-zinc-800 group-hover:bg-amber-500/30 mb-4 transition-colors" />

                {/* Descriptions */}
                <p className="text-xs text-zinc-300 leading-normal md:leading-relaxed font-sans">
                  {upgrade.japaneseDescription}
                </p>
                <p className="text-[10px] text-zinc-500 leading-normal md:leading-relaxed font-mono mt-0.5 md:mt-2">
                  {upgrade.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Level footer stats */}
        <div className="mt-6 md:mt-12 flex flex-wrap gap-x-4 gap-y-1 text-zinc-500 font-mono text-[10px] sm:text-xs border-t border-zinc-800/80 pt-4 md:pt-6 justify-center w-full max-w-lg">
          <div>WEAPON: <span className="text-zinc-300 font-sans font-bold">{playerStats.weapon}</span></div>
          <div>LEVEL: <span className="text-zinc-300 font-sans font-bold">{playerStats.level}</span></div>
          <div>DAMAGE: <span className="text-zinc-300 font-sans font-bold">{playerStats.damage}</span></div>
          <div>SHIELDS: <span className="text-zinc-300 font-sans font-bold">{playerStats.shieldCount}</span></div>
          <div>CRIT: <span className="text-zinc-300 font-sans font-bold">{Math.round(playerStats.critChance * 100)}%</span></div>
        </div>
      </motion.div>
    </div>
  );
};
