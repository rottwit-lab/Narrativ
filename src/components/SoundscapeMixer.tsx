import React, { useState, useEffect } from 'react';
import { SoundscapeType, FoleyEffectType } from '../types';
import { soundscapeEngine } from '../utils/soundscapes';
import {
  CloudRain,
  Flame,
  Moon,
  Wind,
  BookOpen,
  Radio,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Bell,
  Footprints,
  FileText,
  Sliders,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface SoundscapeMixerProps {
  onSoundscapeChange?: (type: SoundscapeType, volume: number) => void;
  initialType?: SoundscapeType;
  initialVolume?: number;
}

export const SoundscapeMixer: React.FC<SoundscapeMixerProps> = ({
  onSoundscapeChange,
  initialType = 'none',
  initialVolume = 0.25,
}) => {
  const [activeType, setActiveType] = useState<SoundscapeType>(initialType);
  const [volume, setVolume] = useState<number>(initialVolume);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [foleyPlaying, setFoleyPlaying] = useState<string | null>(null);

  const presets: { type: SoundscapeType; name: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'none', name: 'Off', icon: <VolumeX className="w-4 h-4" />, desc: 'Narration Only' },
    { type: 'rain', name: 'Gentle Rain', icon: <CloudRain className="w-4 h-4 text-cyan-400" />, desc: 'Soft droplets & damp air' },
    { type: 'fireplace', name: 'Cozy Fireplace', icon: <Flame className="w-4 h-4 text-amber-400" />, desc: 'Warm crackling hearth' },
    { type: 'cosmic_drone', name: 'Cosmic Drone', icon: <Moon className="w-4 h-4 text-purple-400" />, desc: 'Deep ethereal sub-bass' },
    { type: 'forest_wind', name: 'Forest Wind', icon: <Wind className="w-4 h-4 text-emerald-400" />, desc: 'Breeze through pines' },
    { type: 'victorian_library', name: 'Quiet Library', icon: <BookOpen className="w-4 h-4 text-orange-300" />, desc: 'Room tone & clock pendulum' },
    { type: 'starship_hum', name: 'Starship Hum', icon: <Radio className="w-4 h-4 text-blue-400" />, desc: 'Deep engine frequency' },
  ];

  const foleyEffects: { type: FoleyEffectType; name: string; icon: React.ReactNode }[] = [
    { type: 'page_turn', name: 'Page Turn', icon: <FileText className="w-3.5 h-3.5" /> },
    { type: 'chime', name: 'Chime', icon: <Bell className="w-3.5 h-3.5 text-amber-300" /> },
    { type: 'distant_thunder', name: 'Thunder', icon: <Zap className="w-3.5 h-3.5 text-yellow-400" /> },
    { type: 'footsteps', name: 'Footsteps', icon: <Footprints className="w-3.5 h-3.5 text-neutral-300" /> },
    { type: 'magic_shimmer', name: 'Shimmer', icon: <Sparkles className="w-3.5 h-3.5 text-lime-400" /> },
  ];

  const handleSelectSoundscape = (type: SoundscapeType) => {
    setActiveType(type);
    soundscapeEngine.setSoundscape(type);
    soundscapeEngine.setVolume(volume);
    onSoundscapeChange?.(type, volume);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    soundscapeEngine.setVolume(newVol);
    onSoundscapeChange?.(activeType, newVol);
  };

  const handleTriggerFoley = (effect: FoleyEffectType) => {
    setFoleyPlaying(effect);
    soundscapeEngine.triggerFoley(effect);
    setTimeout(() => {
      setFoleyPlaying(null);
    }, 600);
  };

  return (
    <div className="bg-neutral-900/95 border border-neutral-800 rounded-2xl p-4 shadow-xl text-neutral-100 transition-all">
      {/* Header / Collapse Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-lime-500/10 border border-lime-500/30 text-lime-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-['Space_Grotesk'] uppercase tracking-wider text-white">
              Ambient Soundscape & Foley Bed
            </h3>
            <p className="text-[11px] text-neutral-400">
              {activeType === 'none'
                ? 'Soundscape muted — click a preset to enrich narration'
                : `Active bed: ${presets.find(p => p.type === activeType)?.name} (${Math.round(volume * 100)}% vol)`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title={isExpanded ? 'Collapse Soundscapes' : 'Expand Soundscapes'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Controls (Always visible presets bar) */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const isSelected = activeType === preset.type;
          return (
            <button
              key={preset.type}
              type="button"
              onClick={() => handleSelectSoundscape(preset.type)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-lime-500/15 border-lime-500/50 text-lime-300 shadow-sm'
                  : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              {preset.icon}
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Expanded Controls: Volume Fader & Foley Soundboard */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Volume Slider */}
          <div className="flex items-center space-x-3 text-xs">
            <Volume2 className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="text-[11px] text-neutral-400 w-16">Bed Level</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              disabled={activeType === 'none'}
              className="flex-1 accent-lime-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
            <span className="font-mono text-[11px] text-lime-400 w-8 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Foley Sound Effects Trigger Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Foley & FX Triggers
              </span>
              <span className="text-[10px] text-neutral-500">Live sound cues</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {foleyEffects.map((foley) => {
                const isPlayingThis = foleyPlaying === foley.type;
                return (
                  <button
                    key={foley.type}
                    type="button"
                    onClick={() => handleTriggerFoley(foley.type)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                      isPlayingThis
                        ? 'bg-lime-500/20 border-lime-400 text-lime-300 scale-95 shadow-md shadow-lime-500/20'
                        : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-800/60 text-neutral-300 hover:text-white'
                    }`}
                  >
                    {foley.icon}
                    <span className="text-[10px] font-medium mt-1 truncate w-full">
                      {foley.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
