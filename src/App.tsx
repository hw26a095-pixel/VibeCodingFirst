/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PlayerStats, WeaponType, Upgrade, GameSettings } from './types';
import { GameCanvas } from './components/GameCanvas';
import { UpgradeScreen } from './components/UpgradeScreen';
import { Joystick } from './components/Joystick';
import { gameAudio } from './audio';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Play, Swords, Volume2, VolumeX, Award, BookOpen, 
  RotateCcw, ShieldAlert, Sparkles, Crosshair, HelpCircle, 
  Smartphone, Monitor, ChevronRight 
} from 'lucide-react';

interface HighScore {
  score: number;
  kills: number;
  weapon: WeaponType;
  level: number;
  time: string; // MM:SS
  date: string;
}

export default function App() {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'LEVEL_UP' | 'GAME_OVER'>('START');
  
  // Game scores
  const [score, setScore] = useState(0);
  const [killsCount, setKillsCount] = useState(0);
  const [survivalTime, setSurvivalTime] = useState('');
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponType>('SWORD');
  const [waveNum, setWaveNum] = useState(1);

  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [controlType, setControlType] = useState<'KEYBOARD' | 'JOYSTICK'>('KEYBOARD');

  // Player stats
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    weapon: 'SWORD',
    level: 1,
    exp: 0,
    nextLevelExp: 100,
    maxHp: 100,
    hp: 100,
    speed: 3.5,
    damage: 15,
    attackSpeedMultiplier: 1.0,
    critChance: 0.05,
    magnetRadius: 80,
    shieldCount: 0,
    projectileCount: 0,
    regeneration: 0,
  });

  // Floating Virtual Joystick vector
  const [joystickVector, setJoystickVector] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  // Persistent High Scores list
  const [highScores, setHighScores] = useState<HighScore[]>([]);

  // Load scores & settings from localStorage
  useEffect(() => {
    try {
      const storedScores = localStorage.getItem('hord_slayer_scores');
      if (storedScores) {
        setHighScores(JSON.parse(storedScores));
      }

      const storedMute = localStorage.getItem('hord_slayer_mute');
      if (storedMute !== null) {
        const soundOn = storedMute === 'false';
        setSoundEnabled(soundOn);
        gameAudio.enabled = soundOn;
      }

      // Check if user is on mobile to select joystick by default
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        setControlType('JOYSTICK');
      }
    } catch (e) {
      console.error('Failed to read config from localStorage:', e);
    }
  }, []);

  // Update master audio synthesizer volume state
  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    gameAudio.enabled = nextVal;
    localStorage.setItem('hord_slayer_mute', (!nextVal).toString());
    gameAudio.playClick();
  };

  const startGame = () => {
    gameAudio.playClick();

    // Default base stats based on weapon selection
    let baseStats: PlayerStats = {
      weapon: selectedWeapon,
      level: 1,
      exp: 0,
      nextLevelExp: 100,
      maxHp: 100,
      hp: 100,
      speed: 3.2,
      damage: 15,
      attackSpeedMultiplier: 1.0,
      critChance: 0.05,
      magnetRadius: 80,
      shieldCount: 0,
      projectileCount: 0,
      regeneration: 0,
    };

    if (selectedWeapon === 'SWORD') {
      baseStats.damage = 34; // High base hit damage for Knights
      baseStats.maxHp = 160; // Extremely tankier class
      baseStats.hp = 160;
      baseStats.speed = 3.6; // Improved swift footing
      baseStats.magnetRadius = 95;
      baseStats.regeneration = 1.0; // Melee class gets +1.0 passive health regeneration/sec!
    } else if (selectedWeapon === 'BOW') {
      baseStats.damage = 11;
      baseStats.speed = 3.8; // High movement nimble speed
      baseStats.critChance = 0.15; // Higher base critic
      baseStats.attackSpeedMultiplier = 0.85; // Shoots faster
    } else if (selectedWeapon === 'STAFF') {
      baseStats.damage = 26; // High magical elemental damage
      baseStats.attackSpeedMultiplier = 0.90; // High frequency rapid casting! (Decreases cooldown)
      baseStats.magnetRadius = 110; // Large collection radius due to magical energy
      baseStats.shieldCount = 1; // Starts with 1 orbiting magical seal/shield
    }

    setPlayerStats(baseStats);
    setScore(0);
    setKillsCount(0);
    setWaveNum(1);
    setGameState('PLAYING');
  };

  const handleLevelUp = () => {
    setGameState('LEVEL_UP');
  };

  // Level Up card confirmation selection
  const handleSelectUpgrade = (upgrade: Upgrade) => {
    setPlayerStats(prev => upgrade.onApply(prev));
    setGameState('PLAYING');
  };

  // Game defeat handler
  const handleGameOver = (finalScore: number, finalKills: number, timeElapsedSecs: number) => {
    setScore(finalScore);
    setKillsCount(finalKills);

    const min = Math.floor(timeElapsedSecs / 60);
    const sec = timeElapsedSecs % 60;
    const formattedTime = `${min}:${sec.toString().padStart(2, '0')}`;
    setSurvivalTime(formattedTime);

    // Persist scores
    const newRecord: HighScore = {
      score: finalScore,
      kills: finalKills,
      weapon: selectedWeapon,
      level: playerStats.level,
      time: formattedTime,
      date: new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [newRecord, ...highScores].sort((a, b) => b.score - a.score).slice(0, 5);
    setHighScores(updated);
    try {
      localStorage.setItem('hord_slayer_scores', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save high scores:', e);
    }

    setGameState('GAME_OVER');
  };

  return (
    <div className="relative w-screen h-screen bg-[#030303] text-zinc-100 flex flex-col justify-between overflow-hidden font-sans select-none">
      
      {/* Background Ambience Neon glow particles vectors */}
      <div className="absolute inset-x-0 top-0 h-[300px] bg-radial-to-b from-rose-950/15 via-zinc-950/0 to-zinc-950/0 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[300px] bg-radial-to-t from-amber-950/10 via-zinc-950/0 to-zinc-950/0 pointer-events-none" />

      {/* Primary header bar */}
      <header className="relative z-10 w-full px-6 py-4 flex justify-between items-center bg-zinc-950/70 border-b border-zinc-900 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-b from-rose-500 to-amber-500 flex items-center justify-center border border-rose-400/40">
            <Swords className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-sm font-sans font-black tracking-tight text-white uppercase">
              Action Survival Game
            </h1>
            <p className="text-[10px] font-mono text-zinc-500 tracking-wider">
              VS THE UNENDING ONslaught / 無双アリーナ
            </p>
          </div>
        </div>

        {/* Global Toolbar Control buttons */}
        <div className="flex items-center gap-2">
          {/* Audio toggle button */}
          <button 
            onClick={toggleSound}
            className="p-2 sm:px-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg flex items-center gap-1.5 text-xs transition-colors cursor-pointer select-none"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline font-mono">SOUND: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-rose-500" />
                <span className="hidden sm:inline font-mono text-zinc-500">SOUND: OFF</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT CANVAS CONTAINER */}
      <main className="relative z-10 w-full flex-1 max-w-7xl mx-auto p-4 sm:p-6 flex flex-col items-center justify-center h-full overflow-hidden">
        
        <AnimatePresence mode="wait">
          {/* ==================== START TERMINAL SCREEN ==================== */}
          {gameState === 'START' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-3xl flex flex-col items-center bg-zinc-950/65 border border-zinc-900 p-6 sm:p-8 rounded-3xl backdrop-blur-lg shadow-2xl overflow-y-auto max-h-full"
            >
              {/* App title badges */}
              <div className="text-center mb-6">
                <span className="text-[10px] font-mono tracking-widest text-amber-500 font-black px-3 py-1 bg-amber-950/40 border border-amber-900/50 rounded-full select-none uppercase">
                  ROGUE-LITE ARENA COMBAT / スライ・サバイバー
                </span>
                
                <h1 className="text-4xl sm:text-5xl font-sans font-black tracking-tight text-white mt-3 text-center leading-tight">
                  無双サバイバル
                  <span className="block text-2xl font-black bg-gradient-to-r from-rose-400 via-amber-400 to-indigo-400 bg-clip-text text-transparent mt-1 font-sans">
                    Horde Slayer Action
                  </span>
                </h1>
                
                <p className="text-zinc-500 text-xs sm:text-sm mt-3 font-sans max-w-lg mx-auto">
                  一人で迫り来る大量のモンスター軍団を討伐せよ！経験値結晶を集めてLvUPし、新たな武器・魔法ルーンの力を手に入れましょう。
                </p>
              </div>

              {/* Class Weapons Chooser and Stats */}
              <div className="w-full mb-8">
                <h3 className="text-xs font-mono text-zinc-500 tracking-wider mb-3 text-center uppercase">
                  1. SELECT CURRENT CLASS / タップして武器を選択
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Sword Class */}
                  <div 
                    onClick={() => { setSelectedWeapon('SWORD'); gameAudio.playClick(); }}
                    className={`cursor-pointer border p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 relative group select-none active:scale-95 ${
                      selectedWeapon === 'SWORD' 
                        ? 'bg-rose-950/20 border-rose-500/80 shadow-lg shadow-rose-500/5' 
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          selectedWeapon === 'SWORD' ? 'bg-rose-500/20 border-rose-500/55' : 'bg-zinc-950 border-zinc-800/85'
                        }`}>
                          <Swords className="w-5 h-5 text-rose-400" />
                        </div>
                        <span className="text-[10px] font-mono text-rose-500 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/30">近接</span>
                      </div>
                      
                      <h4 className="text-sm font-sans font-bold text-white group-hover:text-rose-400 duration-200">
                        Knight (騎士)
                      </h4>
                      <p className="text-[11px] text-zinc-400 leading-normal mt-1 font-sans">
                        大剣による豪快な薙ぎ払い攻撃。敵を大きくノックバックさせ、高威力と頑丈なHP特性を誇ります。
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-850 flex justify-between text-[10px] font-mono text-zinc-500">
                      <span>DAMAGE: ★★★</span>
                      <span>RANGE: 100px</span>
                    </div>
                  </div>

                  {/* Bow Class */}
                  <div 
                    onClick={() => { setSelectedWeapon('BOW'); gameAudio.playClick(); }}
                    className={`cursor-pointer border p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 relative group select-none active:scale-95 ${
                      selectedWeapon === 'BOW' 
                        ? 'bg-amber-950/20 border-amber-500/80 shadow-lg shadow-amber-500/5' 
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          selectedWeapon === 'BOW' ? 'bg-amber-500/20 border-amber-500/55' : 'bg-zinc-950 border-zinc-800/85'
                        }`}>
                          <Crosshair className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/30">遠距離</span>
                      </div>
                      
                      <h4 className="text-sm font-sans font-bold text-white group-hover:text-amber-400 duration-200">
                        Archer (狩人)
                      </h4>
                      <p className="text-[11px] text-zinc-400 leading-normal mt-1 font-sans">
                        風の矢を最寄りの敵へ連射。貫通属性の矢を高速で放つ、クリティカル率が高いスピード特化型。
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-850 flex justify-between text-[10px] font-mono text-zinc-500">
                      <span>SPEED: ★★★</span>
                      <span>RANGE: 480px</span>
                    </div>
                  </div>

                  {/* Wizard Staff Class */}
                  <div 
                    onClick={() => { setSelectedWeapon('STAFF'); gameAudio.playClick(); }}
                    className={`cursor-pointer border p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 relative group select-none active:scale-95 ${
                      selectedWeapon === 'STAFF' 
                        ? 'bg-purple-950/20 border-purple-500/80 shadow-lg shadow-purple-500/5' 
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          selectedWeapon === 'STAFF' ? 'bg-purple-500/20 border-purple-500/55' : 'bg-zinc-950 border-zinc-800/85'
                        }`}>
                          <Sparkles className="w-5 h-5 text-purple-400" />
                        </div>
                        <span className="text-[10px] font-mono text-purple-500 font-bold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/30">魔法</span>
                      </div>
                      
                      <h4 className="text-sm font-sans font-bold text-white group-hover:text-purple-400 duration-200">
                        Wizard (魔導士)
                      </h4>
                      <p className="text-[11px] text-zinc-400 leading-normal mt-1 font-sans">
                        着弾時に爆散する魔導エネルギー球をキャスト。周囲をガードする自動氷盾を1枚持った状態で開始します。
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-850 flex justify-between text-[10px] font-mono text-zinc-500">
                      <span>SPLASH: ★★★</span>
                      <span>SHIELD +1</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Grid instructions and Device settings selectors side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-zinc-400 mb-8 select-none">
                
                {/* Method instructions */}
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-white font-bold text-xs font-mono mb-2">
                      <BookOpen className="w-4 h-4 text-amber-500" />
                      <span>HOW TO PLAY / 操作方法</span>
                    </div>
                    <ul className="text-[11px] space-y-1.5 text-zinc-300 font-sans leading-relaxed">
                      <li>• <strong className="text-white">移動 (Movement)</strong>: キーボード: <strong className="text-amber-500 font-mono">W, A, S, D</strong> または <strong className="text-amber-500 font-mono">矢印キー</strong>。</li>
                      <li>• <strong className="text-white">回避ダッシュ (Dash)</strong>: 移動中に <strong className="text-amber-500 font-mono">スペース</strong> / <strong className="text-amber-500 font-mono">シフトキー</strong>。無敵時間が発生！</li>
                      <li>• <strong className="text-white">照準 (Aim)</strong>: マウスでの個別方向狙い、または自動索敵。</li>
                      <li>• <strong className="text-white">ゲームオーバー</strong>: 画面四方の壁の中で生存し続けましょう。HPが0になると倒れます。</li>
                    </ul>
                  </div>

                  {/* Device Control mode toggles */}
                  <div className="border-t border-zinc-900/80 pt-3 mt-4 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-zinc-500">CONTROL TYPE</span>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => { setControlType('KEYBOARD'); gameAudio.playClick(); }}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border ${
                          controlType === 'KEYBOARD' ? 'bg-amber-500 text-black border-amber-300' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                        }`}
                      >
                        <Monitor className="w-3 h-3 inline-block mr-1 -mt-0.5" /> Keyboard
                      </button>
                      <button 
                        onClick={() => { setControlType('JOYSTICK'); gameAudio.playClick(); }}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border ${
                          controlType === 'JOYSTICK' ? 'bg-amber-500 text-black border-amber-300' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                        }`}
                      >
                        <Smartphone className="w-3 h-3 inline-block mr-1 -mt-0.5" /> Joystick
                      </button>
                    </div>
                  </div>
                </div>

                {/* Local high score lists */}
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-white font-bold text-xs font-mono mb-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>HIGH SCORES / ベストレコード</span>
                  </div>

                  {highScores.length === 0 ? (
                    <div className="h-28 flex flex-col items-center justify-center text-zinc-600 text-[10px] font-mono text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                      No Records Yet<br />戦績はまだありません
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {highScores.map((hs, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] font-mono bg-zinc-950/70 p-2 border border-zinc-900/60 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-500 font-bold">#{idx+1}</span>
                            <span className="text-zinc-300 font-semibold uppercase">{hs.weapon} (LV {hs.level})</span>
                            <span className="text-zinc-600">{hs.date}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold">{hs.score} PTS</div>
                            <div className="text-zinc-500 text-[9px]">{hs.kills} KILLS | Time: {hs.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Start game main trigger button */}
              <button 
                onClick={startGame}
                className="w-full sm:w-auto px-16 py-4 bg-linear-to-r from-rose-500 to-amber-500 border border-amber-300 font-sans font-black tracking-tight text-black text-lg rounded-2xl shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-95 duration-150 transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 select-none"
              >
                <Play className="w-5 h-5 fill-black" />
                START BATTLE / 戦闘開始
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* ==================== ACTIVE IN-GAME SCREEN ==================== */}
          {(gameState === 'PLAYING' || gameState === 'LEVEL_UP') && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full max-w-5xl aspect-video rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col justify-end"
            >
              {/* Actual Game Engine */}
              <GameCanvas 
                playerStats={playerStats}
                settings={{ soundEnabled, autoAim: true, controlType }}
                setPlayerStats={setPlayerStats}
                onLevelUp={handleLevelUp}
                onGameOver={handleGameOver}
                waveNum={waveNum}
                setWaveNum={setWaveNum}
                activeJoystickVector={joystickVector}
                isPausedExternally={gameState === 'LEVEL_UP'}
              />

              {/* Render dynamic joystick hud is Joystick toggle is ON */}
              {controlType === 'JOYSTICK' && (
                <div className="absolute bottom-6 right-6 z-20 pointer-events-none">
                  <Joystick 
                    onMove={(x, y, active) => {
                      setJoystickVector({ x, y, active });
                    }}
                  />
                </div>
              )}

              {/* Level Up selector overlay panel */}
              {gameState === 'LEVEL_UP' && (
                <UpgradeScreen 
                  playerStats={playerStats}
                  onSelectUpgrade={handleSelectUpgrade}
                />
              )}
            </motion.div>
          )}

          {/* ==================== SCREEN FAILURE / GAME OVER ==================== */}
          {gameState === 'GAME_OVER' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md text-center bg-zinc-950 border border-zinc-900 p-8 rounded-3xl backdrop-blur-md shadow-2xl flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 animate-pulse">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <span className="text-[10px] font-mono tracking-widest text-rose-500 font-bold mb-1 block">
                ARENA DEFEAT / 敗北
              </span>

              <h2 className="text-3xl font-sans font-black text-white leading-tight uppercase tracking-tight">
                Combat Terminated
                <span className="block text-rose-500 text-xl font-extrabold mt-1">作戦失敗</span>
              </h2>

              <p className="text-zinc-500 text-xs mt-3 font-sans max-w-sm mb-6">
                モンスターの強力な攻撃によりHPが力尽きました。強化カードを見直して再対戦しましょう！
              </p>

              {/* Game statistics */}
              <div className="grid grid-cols-2 gap-3 w-full mb-8 text-left font-mono text-xs select-none">
                <div className="bg-zinc-900 p-3.5 border border-zinc-800 rounded-xl">
                  <span className="text-zinc-500 block mb-0.5">FINAL SCORE</span>
                  <span className="text-lg font-bold text-amber-400 font-sans">{score}</span>
                </div>
                
                <div className="bg-zinc-900 p-3.5 border border-zinc-800 rounded-xl">
                  <span className="text-zinc-500 block mb-0.5">SURVIVAL TIME</span>
                  <span className="text-lg font-bold text-white font-sans">{survivalTime}</span>
                </div>

                <div className="bg-zinc-900 p-3.5 border border-zinc-800 rounded-xl">
                  <span className="text-zinc-500 block mb-0.5">ENEMIES SLAINED</span>
                  <span className="text-lg font-bold text-rose-400 font-sans">{killsCount}</span>
                </div>

                <div className="bg-zinc-900 p-3.5 border border-zinc-800 rounded-xl">
                  <span className="text-zinc-500 block mb-0.5">FINAL REACH LEVEL</span>
                  <span className="text-lg font-bold text-sky-400 font-sans">LV {playerStats.level}</span>
                </div>
              </div>

              {/* Restart button */}
              <button 
                onClick={() => {
                  gameAudio.playClick();
                  setGameState('START');
                }}
                className="w-full py-3.5 bg-linear-to-r from-zinc-100 to-zinc-300 border border-white text-black font-sans font-black text-sm rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 duration-120 cursor-pointer shadow-lg select-none"
              >
                <RotateCcw className="w-4 h-4" />
                Return to Menu / メニューに戻る
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Primary footer */}
      <footer className="relative z-10 w-full px-6 py-3.5 bg-zinc-950/70 border-t border-zinc-900 shrink-0 text-center select-none backdrop-blur-md">
        <p className="text-[10px] font-mono text-zinc-600">
          Action Survival Sandbox | Powered by HTML5 Canvas & Web Audio API
        </p>
      </footer>
    </div>
  );
}
