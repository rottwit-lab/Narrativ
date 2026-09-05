import React, { useState } from 'react';
import { Mic2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { PronunciationEntry } from '../types';

interface PronunciationDictionaryCardProps {
  entries: PronunciationEntry[];
  onChange: (entries: PronunciationEntry[]) => void;
}

/**
 * Per-project pronunciation dictionary: force correct narration of names,
 * places, and acronyms by replacing them with phonetic respellings at
 * synthesis time (whole-word, case-insensitive).
 */
export const PronunciationDictionaryCard: React.FC<PronunciationDictionaryCardProps> = ({
  entries,
  onChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newPron, setNewPron] = useState('');

  const addEntry = () => {
    const word = newWord.trim();
    const pronunciation = newPron.trim();
    if (!word || !pronunciation) return;
    onChange([...entries, { id: `pron_${Date.now()}`, word, pronunciation }]);
    setNewWord('');
    setNewPron('');
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((e) => e.id !== id));
  };

  return (
    <div className="p-5 bg-neutral-900/80 border border-neutral-800 rounded-2xl shadow-md">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-2">
          <Mic2 className="w-4 h-4 text-lime-400" />
          <span className="text-xs font-semibold text-white">Pronunciation Dictionary</span>
          {entries.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-mono">
              {entries.length} {entries.length === 1 ? 'word' : 'words'}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3.5 space-y-3">
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Names, places, and acronyms are where AI narration stumbles. Add phonetic respellings
            (e.g. <code className="text-lime-300">Tarae → tah-RYE</code>) — they're applied to the
            spoken text at synthesis time, whole-word and case-insensitive, without altering your manuscript.
          </p>

          {entries.length > 0 && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs"
                >
                  <span className="text-neutral-200 truncate">
                    <span className="font-semibold">{entry.word}</span>
                    <span className="text-neutral-500 mx-1.5">→</span>
                    <span className="font-mono text-lime-300">{entry.pronunciation}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="Word as written"
              className="w-1/2 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-lime-500/50"
            />
            <input
              type="text"
              value={newPron}
              onChange={(e) => setNewPron(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
              placeholder="Spoken as (tah-RYE)"
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-lime-500/50"
            />
            <button
              type="button"
              onClick={addEntry}
              disabled={!newWord.trim() || !newPron.trim()}
              className="px-3 py-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-40 disabled:hover:bg-lime-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
