import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
}

const PRESET_GIFS = [
  { id: '1', title: 'Cat Jam / Vibing', url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif' },
  { id: '2', title: 'Popcat', url: 'https://media.giphy.com/media/S5qrrPXhyR840/giphy.gif' },
  { id: '3', title: 'GG / High Five', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
  { id: '4', title: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: '5', title: 'Celebrate / Hype', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
  { id: '6', title: 'Clapping', url: 'https://media.giphy.com/media/ely3apij36BJhoZ234/giphy.gif' },
  { id: '7', title: 'Hacker Typing', url: 'https://media.giphy.com/media/YQitE4YNQNahy/giphy.gif' },
  { id: '8', title: 'Dancing Doge', url: 'https://media.giphy.com/media/oBQZIgNobc7EWQDNg0/giphy.gif' },
  { id: '9', title: 'Confused Travolta', url: 'https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif' },
];

export const GifPickerModal: React.FC<GifPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectGif,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredGifs = PRESET_GIFS.filter((g) =>
    g.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-lg bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="h-14 px-4 border-b border-discord-darkest/60 flex items-center justify-between">
          <div className="relative flex-1 mr-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search GIFs across Tenor / Giphy"
              className="w-full bg-discord-input text-sm text-discord-gray-100 rounded px-3 py-1.5 pl-8 focus:outline-none focus:ring-1 focus:ring-discord-blurple"
              autoFocus
            />
            <Search className="w-4 h-4 text-discord-gray-400 absolute left-2.5 top-2.5" />
          </div>

          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-discord-gray-100 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GIF Grid */}
        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filteredGifs.map((gif) => (
            <div
              key={gif.id}
              onClick={() => {
                onSelectGif(gif.url);
                onClose();
              }}
              className="relative aspect-video rounded-lg overflow-hidden border border-discord-darkest cursor-pointer group hover:scale-[1.02] transition-transform"
            >
              <img
                src={gif.url}
                alt={gif.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[11px] text-white font-semibold truncate">
                  {gif.title}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="h-10 bg-discord-sidebar px-4 flex items-center justify-between text-[11px] text-discord-gray-400 border-t border-discord-darkest/60">
          <span>Powered by Tenor & Giphy (100% Free API)</span>
        </div>
      </div>
    </div>
  );
};
