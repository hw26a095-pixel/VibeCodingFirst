/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';

interface JoystickProps {
  onMove: (angleX: number, angleY: number, active: boolean) => void;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState<boolean>(false);

  const JOYSTICK_RADIUS = 40; // Max movement offset in pixels

  const handleStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    setTouchStart({ x: centerX, y: centerY });
    setActive(true);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!active || !touchStart) return;

    const dx = clientX - touchStart.x;
    const dy = clientY - touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      setPosition({ x: 0, y: 0 });
      onMove(0, 0, true);
      return;
    }

    // Lock position to maximum radius
    const cappedDistance = Math.min(distance, JOYSTICK_RADIUS);
    const ratio = cappedDistance / distance;
    const targetX = dx * ratio;
    const targetY = dy * ratio;

    setPosition({ x: targetX, y: targetY });

    // Send normalized vector (-1.0 to 1.0)
    onMove(targetX / JOYSTICK_RADIUS, targetY / JOYSTICK_RADIUS, true);
  };

  const handleEnd = () => {
    setActive(false);
    setTouchStart(null);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0, false);
  };

  // Attach global touchmove and touchend events to track movement even outside the small joystick container
  useEffect(() => {
    const onTouchMoveGlobal = (e: TouchEvent) => {
      if (!active) return;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const onMouseUpGlobal = () => {
      if (active) handleEnd();
    };

    const onMouseMoveGlobal = (e: MouseEvent) => {
      if (!active) return;
      handleMove(e.clientX, e.clientY);
    };

    window.addEventListener('touchmove', onTouchMoveGlobal, { passive: false });
    window.addEventListener('mouseup', onMouseUpGlobal);
    window.addEventListener('mousemove', onMouseMoveGlobal);

    return () => {
      window.removeEventListener('touchmove', onTouchMoveGlobal);
      window.removeEventListener('mouseup', onMouseUpGlobal);
      window.removeEventListener('mousemove', onMouseMoveGlobal);
    };
  }, [active, touchStart]);

  return (
    <div className="flex flex-col items-center select-none bg-zinc-950/20 p-2 rounded-2xl border border-zinc-800/20 backdrop-blur-sm pointer-events-auto">
      <span className="text-[9px] text-zinc-500 font-mono tracking-wider mb-2 uppercase">Move Virtual Joystick</span>
      <div 
        id="virtual-joystick-container"
        ref={containerRef}
        className="relative w-28 h-28 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={(e) => {
          e.preventDefault();
          const t = e.touches[0];
          handleStart(t.clientX, t.clientY);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleStart(e.clientX, e.clientY);
        }}
      >
        {/* Joystick Boundary Outer Ring shadow */}
        <div className="absolute inset-2 rounded-full border border-zinc-800/40 bg-zinc-950/60" />

        {/* Floating Joystick Thumb */}
        <div 
          id="virtual-joystick-thumb"
          className="absolute w-12 h-12 rounded-full transition-shadow duration-150 flex items-center justify-center 
            bg-linear-to-b from-amber-400 to-amber-600 border border-amber-300 shadow-md"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            boxShadow: active ? '0 0 16px rgba(245, 158, 11, 0.4)' : 'none',
          }}
        >
          <div className="w-4 h-4 rounded-full bg-amber-200/50" />
        </div>
      </div>
    </div>
  );
};
