'use client';

import React, { useState, useEffect } from 'react';

export default function GalleryPage() {
  const [title, setTitle] = useState("JC");
  const [isEditMode, setIsEditMode] = useState(true);
  const [items, setItems] = useState([
    { type: 'section', name: "Section 1", photos: [] }
  ]);
  const [activePath, setActivePath] = useState({ folderIndex: null, sectionIndex: 0 });

  return (
    <div className={`min-h-screen bg-white text-neutral-900 font-sans ${isEditMode ? 'edit-mode' : 'view-mode'}`}>
      {/* Top Header */}
      <header className="sticky top-0 bg-white z-50 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-10 pt-6 pb-4 flex items-center justify-between flex-wrap gap-6">
          <h1 
            contentEditable={isEditMode}
            suppressContentEditableWarning
            onBlur={(e) => setTitle(e.currentTarget.textContent || "JC")}
            className="text-2xl font-normal tracking-wide outline-none cursor-text min-w-[120px]"
          >
            {title}
          </h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border-l border-neutral-200 pl-4">
              <button 
                onClick={() => setIsEditMode(true)}
                className={`text-xs tracking-wider px-3.5 py-1.5 rounded-full border transition-colors ${isEditMode ? 'bg-neutral-900 text-white border-neutral-900' : 'text-neutral-500 border-neutral-200 hover:border-neutral-900 hover:text-neutral-900'}`}
              >
                Edit
              </button>
              <button 
                onClick={() => setIsEditMode(false)}
                className={`text-xs tracking-wider px-3.5 py-1.5 rounded-full border transition-colors {!isEditMode ? 'bg-neutral-900 text-white border-neutral-900' : 'text-neutral-500 border-neutral-200 hover:border-neutral-900 hover:text-neutral-900'}`}
              >
                View
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="max-w-7xl mx-auto px-10 flex items-center flex-wrap gap-2 border-t border-neutral-100">
          {items.map((item, i) => {
            const isActive = activePath.folderIndex === null && activePath.sectionIndex === i;
            return (
              <div 
                key={i}
                onClick={() => setActivePath({ folderIndex: null, sectionIndex: i })}
                className={`px-4 py-3 cursor-pointer text-sm tracking-wide transition-colors border-b-2 ${isActive ? 'text-neutral-900 font-medium border-neutral-900' : 'text-neutral-500 border-transparent hover:text-neutral-900'}`}
              >
                {item.name}
              </div>
            );
          })}
        </nav>
      </header>

      {/* Main Gallery Grid */}
      <main className="max-w-7xl mx-auto px-10 py-12 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-7">
          {/* Photos for the active section will render here */}
        </div>
      </main>
    </div>
  );
}