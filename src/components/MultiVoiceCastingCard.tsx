import React, { useState } from 'react';
import { MultiVoiceConfig } from '../types';
import {
  Users,
  Volume2,
  Sparkles,
  Play,
  Check,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

interface MultiVoiceCastingCardProps {
  config: MultiVoiceConfig;
  onChange: (updated: MultiVoiceConfig) => void;
  onAuditionMultiVoice?: (narratorVoice: string, dialogueVoice: string) => void;
}

export const MultiVoiceCastingCard: React.FC<MultiVoiceCastingCardProps> = ({
  config,
  onChange,
  onAuditionMultiVoice,
}) => {
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);

  const voiceOptions = [
    { name: 'Kore', label: 'Kore (Warm, Melodic Soprano/Alto)', desc: 'Ideal for descriptive narrative prose' },
    { name: 'Puck', label: 'Puck (Lively, Expressive Tenor)', desc: 'Great for energetic protagonists' },
    { name: 'Charon', label: 'Charon (Deep, Resonant Bass)', desc: 'Ideal for villains or grave characters' },
    { name: 'Fenrir', label: 'Fenrir (Rugged, Textured Baritone)', desc: 'Great for stoic warriors or historians' },
    { name: 'Zephyr', label: 'Zephyr (Soft, Gentle, Whisper-Resonant)', desc: 'Ideal for calm introspective characters' },
  ];

  const dramaPresets = [
    {
      title: 'Classic Audio Drama',
      narrator: 'Kore',
      dialogue: 'Puck',
      desc: 'Warm lyrical narration with lively protagonist dialogue',
    },
    {
      title: 'Dark Fantasy & Thriller',
      narrator: 'Fenrir',
      dialogue: 'Charon',
      desc: 'Rugged storytelling with deep baritone dialogue',
    },
    {
      title: 'Sci-Fi Exploration',
      narrator: 'Zephyr',
      dialogue: 'Puck',
      desc: 'Calm ambient narration with dynamic flight dialogue',
    },
  ];

  const handleToggle = (enabled: boolean) => {
    onChange({
      ...config,
      enabled,
      narratorVoice: config.narratorVoice || 'Kore',
      dialogueVoice: config.dialogueVoice || 'Puck',
    });
  };

  const handleApplyPreset = (narrator: string, dialogue: string) => {
    onChange({
      ...config,
      enabled: true,
      narratorVoice: narrator,
      dialogueVoice: dialogue,
    });
  };

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Title & Enable Switch */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold font-['Space_Grotesk'] text-white">
                Multi-Voice Dialogue Casting
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-lime-500/15 border border-lime-500/30 text-[10px] font-mono text-lime-300">
                FULL-CAST
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Cast distinct voices for quotation dialogue vs narrative exposition
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => handleToggle(!config.enabled)}
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
            config.enabled ? 'bg-lime-500' : 'bg-neutral-800'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-neutral-950 shadow-md transform transition-transform ${
              config.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {config.enabled ? (
        <div className="space-y-4 pt-2 border-t border-neutral-800/80 animate-in fade-in duration-200">
          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
              Dramatization Presets
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {dramaPresets.map((preset) => {
                const isCurrent =
                  config.narratorVoice === preset.narrator &&
                  config.dialogueVoice === preset.dialogue;
                return (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => handleApplyPreset(preset.narrator, preset.dialogue)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? 'bg-lime-500/10 border-lime-500/50 text-lime-200 shadow-sm'
                        : 'bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800/60 text-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{preset.title}</div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-1">
                      {preset.narrator} + {preset.dialogue}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1 line-clamp-2">
                      {preset.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Cast Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Narrator Voice */}
            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300">Narrator (Exposition)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  Descriptive Text
                </span>
              </div>
              <select
                value={config.narratorVoice}
                onChange={(e) =>
                  onChange({
                    ...config,
                    narratorVoice: e.target.value,
                  })
                }
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-lime-500"
              >
                {voiceOptions.map((v) => (
                  <option key={`narrator-${v.name}`} value={v.name}>
                    {v.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-500">
                {voiceOptions.find((v) => v.name === config.narratorVoice)?.desc}
              </p>
            </div>

            {/* Dialogue Voice */}
            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300">Dialogue (Characters)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Quoted Dialogue
                </span>
              </div>
              <select
                value={config.dialogueVoice}
                onChange={(e) =>
                  onChange({
                    ...config,
                    dialogueVoice: e.target.value,
                  })
                }
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {voiceOptions.map((v) => (
                  <option key={`dialogue-${v.name}`} value={v.name}>
                    {v.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-500">
                {voiceOptions.find((v) => v.name === config.dialogueVoice)?.desc}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-neutral-500 flex items-center space-x-2 pt-1">
          <HelpCircle className="w-4 h-4 text-neutral-600" />
          <span>Enable to automatically alternate voices between storyteller narrative and spoken character lines.</span>
        </div>
      )}
    </div>
  );
};
