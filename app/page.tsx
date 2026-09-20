'use client';

import React, { useEffect } from 'react';
import { upload as vercelBlobUpload } from '@vercel/blob/client';
import galleryData from './old-gallery-data.json';

export default function GalleryPage() {
  useEffect(() => {
    // Prevent script from running twice in React StrictMode
    if ((window as any).__GALLERY_INIT__) return;
    (window as any).__GALLERY_INIT__ = true;

    // =========================================================
    // 1. PASTE YOUR ENTIRE ORIGINAL JAVASCRIPT BELOW THIS LINE
    // (Everything between your original <script> and </script>)
    // =========================================================

// RESTORED STORAGE KEY to perfectly recall your original photos!
const STORAGE_KEY = 'artGalleryState_v2';
const MAX_PHOTOS_PER_SECTION = 200;

/* --- IndexedDB Storage Engine (Eliminates 5MB Limit) --- */
const DB_NAME = 'PhotoGalleryDB';
const STORE_NAME = 'galleryStore';

let dbPromise: any = null;
function initDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
  return dbPromise;
}

async function saveToDB(key: string, val: any) {
  try {
    const db: any = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(val, key);
  } catch(e) {}
}

async function loadFromDB(key: string) {
  try {
    const db: any = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch(e) {
    return null;
  }
}

/* --- Cryptography Engine --- */
function encodeUTF8(text: string) { return unescape(encodeURIComponent(text)); }
function decodeUTF8(bytes: string) { return decodeURIComponent(escape(bytes)); }

// Encryption disabled - falling back to raw text for public/private logic
function encryptData(text: string, key: string) { return text; }
function decryptData(b64: string, key: string) { return b64; }

// Global Auth State
let sessionPassword: any = "dummy"; // Keeps existing components happy without needing real passwords
let currentViewMode = 'private'; // Can be 'public' or 'private'

let state: any = JSON.parse(JSON.stringify(galleryData));

let openFolderIndex: any = null; 

async function loadInitialState(){
  if ((window as any).__EMBEDDED_GALLERY_DATA__) {
    return (window as any).__EMBEDDED_GALLERY_DATA__;
  }
  return await loadFromDB(STORAGE_KEY);
}

function updateStorageMeter() {
    const textEl = document.getElementById('storageText');
    if(!textEl) return;
    const currentBytes = JSON.stringify(state).length;
    const mbUsed = (currentBytes / 1048576).toFixed(2);
    textEl.textContent = `${mbUsed} MB STORED`;
}

function saveState(){
  saveToDB(STORAGE_KEY, state);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){}
  updateStorageMeter();
}

function getActiveSection() {
  const path = state.activePath;
  if (path.folderIndex !== null) {
    const folder = state.items[path.folderIndex];
    if (folder && folder.sections) {
       return folder.sections[path.sectionIndex];
    }
  } else {
    return state.items[path.sectionIndex];
  }
  return null;
}

function resetActivePath() {
  if (state.items.length === 0) {
     state.items.push({ type: 'section', name: 'Section 1', photos: [] });
     state.activePath = { folderIndex: null, sectionIndex: 0 };
     return;
  }
  const { folderIndex, sectionIndex } = state.activePath;
  if (folderIndex !== null) {
     if (state.items[folderIndex] && state.items[folderIndex].type === 'folder') {
        if (state.items[folderIndex].sections.length > sectionIndex) return;
        if (state.items[folderIndex].sections.length > 0) {
           state.activePath.sectionIndex = state.items[folderIndex].sections.length - 1;
           return;
        }
     }
  } else {
     if (state.items[sectionIndex] && state.items[sectionIndex].type === 'section') return;
  }
  for(let i=0; i<state.items.length; i++) {
     if (state.items[i].type === 'section') {
        state.activePath = { folderIndex: null, sectionIndex: i };
        return;
     }
     if (state.items[i].type === 'folder' && state.items[i].sections.length > 0) {
        state.activePath = { folderIndex: i, sectionIndex: 0 };
        return;
     }
  }
}

/* ---------------- Elements ---------------- */
const body = document.body;
const brandTitle = document.getElementById('brandTitle');
const authContainer = document.getElementById('authContainer');
const tabsNav = document.getElementById('tabsNav');
const mobileTabsToggle = document.getElementById('mobileTabsToggle');
const mobileTabsLabel = document.getElementById('mobileTabsLabel');
const galleryArea = document.getElementById('galleryArea');
const editBtn = document.getElementById('editBtn');
const viewBtn = document.getElementById('viewBtn');
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const dragOverlay = document.getElementById('dragOverlay');

const lightbox = document.getElementById('lightbox');
const lightboxImgWrap = document.getElementById('lightboxImgWrap');
const lightboxImg = document.getElementById('lightboxImg') as HTMLImageElement;
const lightboxText = document.getElementById('lightboxText');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxDesc = document.getElementById('lightboxDesc');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

let currentPhotoIndex: any = null;

/* ---------------- Mobile Menu ---------------- */
if (mobileTabsToggle) {
  mobileTabsToggle.addEventListener('click', () => {
    tabsNav!.classList.toggle('open');
    mobileTabsToggle!.classList.toggle('open');
  });
}

function closeMobileMenu() {
  tabsNav!.classList.remove('open');
  mobileTabsToggle!.classList.remove('open');
}

document.addEventListener('click', (e: any) => {
  if (!e.target.closest('.folder-tab')) {
     if (openFolderIndex !== null) {
        openFolderIndex = null;
        renderTabs();
     }
  }
});

/* ---------------- Rendering ---------------- */

function render(){
  brandTitle!.textContent = state.title || "JC";
  renderAuth();
  renderTabs();
  renderGallery();
  saveState();
}

function renderAuth() {
    authContainer!.innerHTML = '';
    const isEdit = body.classList.contains('edit-mode');

    // Only show the View Mode dropdown when in View mode
    if (!isEdit) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '8px';
        wrapper.style.alignItems = 'center';

        const lbl = document.createElement('span');
        lbl.textContent = 'Viewing as: ';
        lbl.style.fontSize = '12px';
        lbl.style.color = 'var(--ink)';

        const select = document.createElement('select');
        select.innerHTML = `<option value="private">Private (All Photos)</option><option value="public">Public Only</option>`;
        select.value = currentViewMode;
        select.style.padding = '4px 8px';
        select.style.borderRadius = '4px';
        select.style.border = '1px solid var(--line)';
        select.style.fontFamily = 'inherit';

        select.addEventListener('change', (e) => {
            currentViewMode = (e.target as HTMLSelectElement).value;
            render();
        });

        wrapper.appendChild(lbl);
        wrapper.appendChild(select);
        authContainer!.appendChild(wrapper);
    }
}

function reencryptSection(section: any, oldPwd: any, newPwd: any) {
    section.photos.forEach((p: any) => {
        if (p.locked) {
            let rawSrc = p.src;
            let rawContent = p.content;
            let rawTitle = p.title;
            let rawDesc = p.desc;

            // 1. Recover plain text using old password
            if (oldPwd) {
                if (p.type === 'text') rawContent = decryptData(p.content, oldPwd) || '';
                else rawSrc = decryptData(p.src, oldPwd) || '';
                if(p.title) rawTitle = decryptData(p.title, oldPwd) || '';
                if(p.desc) rawDesc = decryptData(p.desc, oldPwd) || '';
            }

            // 2. Encrypt with new password OR leave as plain text if password removed
            if (newPwd) {
                if (p.type === 'text') p.content = encryptData(rawContent, newPwd);
                else p.src = encryptData(rawSrc, newPwd);
                if(rawTitle) p.title = encryptData(rawTitle, newPwd);
                if(rawDesc) p.desc = encryptData(rawDesc, newPwd);
            } else {
                if (p.type === 'text') p.content = rawContent;
                else p.src = rawSrc;
                p.title = rawTitle;
                p.desc = rawDesc;
                
                p.locked = false; // Auto-unlock if master password is removed entirely
            }
        }
    });
}

function renderTabs(){
  tabsNav!.innerHTML = "";
  
  const activeSectionData = getActiveSection();
  if(mobileTabsLabel) {
    if(activeSectionData) {
      mobileTabsLabel.textContent = activeSectionData.name;
    } else {
      mobileTabsLabel.textContent = "Empty Folder";
    }
  }

  state.items.forEach((item: any, i: any) => {
    if (item.type === 'section') {
      const isTabActive = (state.activePath.folderIndex === null && state.activePath.sectionIndex === i);
      const tab = document.createElement('div');
      tab.className = 'tab' + (isTabActive ? ' active' : '');

      const nameEl = document.createElement('span');
      nameEl.className = 'tab-name';
      nameEl.textContent = item.name;
      nameEl.contentEditable = body.classList.contains('edit-mode') ? "true" : "false";
      nameEl.spellcheck = false;
      
      nameEl.addEventListener('click', (e) => {
        if(!body.classList.contains('edit-mode')){
          state.activePath = { folderIndex: null, sectionIndex: i };
          openFolderIndex = null;
          closeMobileMenu();
          render();
        }
        e.stopPropagation();
      });
      nameEl.addEventListener('blur', () => {
        item.name = nameEl.textContent?.trim() || `Section ${i+1}`;
        saveState();
        if(isTabActive && mobileTabsLabel) mobileTabsLabel.textContent = item.name;
      });
      nameEl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); nameEl.blur(); }
      });

      tab.addEventListener('click', () => {
        state.activePath = { folderIndex: null, sectionIndex: i };
        openFolderIndex = null;
        closeMobileMenu();
        render();
      });

      const removeEl = document.createElement('span');
      removeEl.className = 'remove-tab';
      removeEl.textContent = '\u00d7';
      removeEl.title = 'Remove section';
      removeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if(state.items.length === 1 && state.items[0].type === 'section'){
          alert("You need at least one section."); return;
        }
        if(confirm(`Remove "${item.name}" and its photos?`)){
          state.items.splice(i, 1);
          resetActivePath();
          render();
        }
      });

      tab.appendChild(nameEl);
      tab.appendChild(removeEl);
      tabsNav!.appendChild(tab);

    } else if (item.type === 'folder') {
      const isFolderActive = (state.activePath.folderIndex === i);
      const folderTab = document.createElement('div');
      folderTab.className = 'folder-tab' + (isFolderActive ? ' active' : '') + (openFolderIndex === i ? ' open' : '');

      const header = document.createElement('div');
      header.className = 'folder-tab-header';

      const nameEl = document.createElement('span');
      nameEl.className = 'folder-name tab-name';
      nameEl.textContent = item.name;
      nameEl.contentEditable = body.classList.contains('edit-mode') ? "true" : "false";
      nameEl.spellcheck = false;
      
      nameEl.addEventListener('click', (e) => {
         if(body.classList.contains('edit-mode')) e.stopPropagation();
      });
      nameEl.addEventListener('blur', () => {
         item.name = nameEl.textContent?.trim() || `Folder ${i+1}`;
         saveState();
      });
      nameEl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); nameEl.blur(); }
      });

      const removeFolderEl = document.createElement('span');
      removeFolderEl.className = 'remove-tab';
      removeFolderEl.textContent = '\u00d7';
      removeFolderEl.title = 'Remove folder and all its sections';
      removeFolderEl.addEventListener('click', (e) => {
         e.stopPropagation();
         if(confirm(`Remove folder "${item.name}" AND all its sections?`)){
            state.items.splice(i, 1);
            openFolderIndex = null;
            resetActivePath();
            render();
         }
      });

      const chevron = document.createElement('span');
      chevron.className = 'chevron';
      chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

      header.addEventListener('click', (e) => {
         openFolderIndex = (openFolderIndex === i) ? null : i;
         render();
      });

      header.appendChild(nameEl);
      if(body.classList.contains('edit-mode')) header.appendChild(removeFolderEl);
      header.appendChild(chevron);
      
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown-menu';
      dropdown.addEventListener('click', e => e.stopPropagation());

      item.sections.forEach((subSec: any, j: any) => {
         const isSubActive = (state.activePath.folderIndex === i && state.activePath.sectionIndex === j);
         const subItem = document.createElement('div');
         subItem.className = 'dropdown-item' + (isSubActive ? ' active' : '');
         
         const subNameEl = document.createElement('span');
         subNameEl.className = 'tab-name';
         subNameEl.textContent = subSec.name;
         subNameEl.contentEditable = body.classList.contains('edit-mode') ? "true" : "false";
         subNameEl.spellcheck = false;

         subNameEl.addEventListener('click', (e) => {
            if(!body.classList.contains('edit-mode')){
               state.activePath = { folderIndex: i, sectionIndex: j };
               openFolderIndex = null;
               closeMobileMenu();
               render();
            } else {
               e.stopPropagation();
            }
         });
         subNameEl.addEventListener('blur', () => {
            subSec.name = subNameEl.textContent?.trim() || `Section ${j+1}`;
            saveState();
            if(isSubActive && mobileTabsLabel) mobileTabsLabel.textContent = subSec.name;
         });
         subNameEl.addEventListener('keydown', (e) => {
            if(e.key === 'Enter'){ e.preventDefault(); subNameEl.blur(); }
         });

         subItem.addEventListener('click', () => {
            state.activePath = { folderIndex: i, sectionIndex: j };
            openFolderIndex = null;
            closeMobileMenu();
            render();
         });

         const removeSubEl = document.createElement('span');
         removeSubEl.className = 'remove-tab';
         removeSubEl.textContent = '\u00d7';
         removeSubEl.title = 'Remove section';
         removeSubEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`Remove "${subSec.name}" and its photos?`)){
               item.sections.splice(j, 1);
               resetActivePath();
               render();
            }
         });

         subItem.appendChild(subNameEl);
         subItem.appendChild(removeSubEl);
         dropdown.appendChild(subItem);
      });

      if (body.classList.contains('edit-mode')) {
         const addSub = document.createElement('div');
         addSub.className = 'dropdown-item add-sub-tab';
         addSub.innerHTML = `<span style="font-size:14px; opacity:0.8">+ Add section</span>`;
         const addSubInput = document.createElement('input');
         addSubInput.className = 'add-tab-input';
         addSubInput.style.display = 'none';
         
         addSub.addEventListener('click', (e) => {
            e.stopPropagation();
            addSub.style.display = 'none';
            addSubInput.style.display = 'block';
            addSubInput.focus();
         });
         
         function commitSubAdd() {
            const name = addSubInput.value.trim();
            if(name) {
               item.sections.push({ name, photos: [] });
               state.activePath = { folderIndex: i, sectionIndex: item.sections.length - 1 };
               openFolderIndex = i; 
               render();
            } else {
               addSubInput.style.display = 'none';
               addSub.style.display = 'flex';
            }
         }
         addSubInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter'){ commitSubAdd(); }
            if(e.key === 'Escape'){ addSubInput.value=''; addSubInput.blur(); }
         });
         addSubInput.addEventListener('blur', commitSubAdd);
         addSubInput.addEventListener('click', e => e.stopPropagation());

         dropdown.appendChild(addSub);
         dropdown.appendChild(addSubInput);
      }

      folderTab.appendChild(header);
      folderTab.appendChild(dropdown);
      tabsNav!.appendChild(folderTab);
    }
  });

  if (body.classList.contains('edit-mode')) {
    const addContainer = document.createElement('div');
    addContainer.className = 'add-tab-container';

    const addSecBtn = document.createElement('div');
    addSecBtn.className = 'add-tab';
    addSecBtn.innerHTML = `<span>+ Section</span>`;
    
    const addFolBtn = document.createElement('div');
    addFolBtn.className = 'add-tab';
    addFolBtn.innerHTML = `<span>+ Folder</span>`;

    const addInput = document.createElement('input');
    addInput.className = 'add-tab-input';
    let addingType = 'section'; 

    addSecBtn.addEventListener('click', () => {
      addingType = 'section';
      addSecBtn.style.display = 'none';
      addFolBtn.style.display = 'none';
      addInput.style.display = 'inline-block';
      addInput.placeholder = 'Section name';
      addInput.focus();
    });
    addFolBtn.addEventListener('click', () => {
      addingType = 'folder';
      addSecBtn.style.display = 'none';
      addFolBtn.style.display = 'none';
      addInput.style.display = 'inline-block';
      addInput.placeholder = 'Folder name';
      addInput.focus();
    });

    function commitAddRoot(){
      const name = addInput.value.trim();
      if(name){
         if (addingType === 'section') {
            state.items.push({ type: 'section', name, photos: [] });
            state.activePath = { folderIndex: null, sectionIndex: state.items.length - 1 };
         } else {
            state.items.push({ type: 'folder', name, sections: [] });
            openFolderIndex = state.items.length - 1; 
            state.activePath = { folderIndex: state.items.length - 1, sectionIndex: 0 };
         }
         closeMobileMenu();
         render();
      } else {
         addInput.style.display = 'none';
         addSecBtn.style.display = 'flex';
         addFolBtn.style.display = 'flex';
      }
    }
    
    addInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ commitAddRoot(); }
      if(e.key === 'Escape'){ addInput.value=''; addInput.blur(); }
    });
    addInput.addEventListener('blur', commitAddRoot);

    addContainer.appendChild(addSecBtn);
    addContainer.appendChild(addFolBtn);
    addContainer.appendChild(addInput);
    tabsNav!.appendChild(addContainer);
  }
}

function renderGallery(){
  galleryArea!.innerHTML = "";
  const section = getActiveSection();
  const isEdit = body.classList.contains('edit-mode');

  if(!section){
    const empty = document.createElement('div');
    empty.className = 'section-empty';
    if(isEdit) {
      empty.textContent = 'This folder is empty. Open the folder dropdown above and click "+ Add section" to begin.';
    } else {
      empty.textContent = 'Nothing to show here yet.';
    }
    galleryArea!.appendChild(empty);
    return;
  }

  if(section.photos.length === 0 && !isEdit){
    const empty = document.createElement('div');
    empty.className = 'section-empty';
    // Check if it's an exported shareable view and display a loading notice
    if (body.classList.contains('locked') && !window.navigator.onLine) {
      empty.textContent = 'Loading photos from cloud storage...';
    } else {
      empty.textContent = 'No items in this section yet.';
    }
    galleryArea!.appendChild(empty);
    return;
  }

 if (isEdit && section.photos.length > 0) {
    const secToolbar = document.createElement('div');
    secToolbar.style.display = 'flex';
    secToolbar.style.justifyContent = 'flex-end';
    secToolbar.style.marginBottom = '16px';
    
    const bulkLockBtn = document.createElement('button');
    const allLocked = section.photos.every((p: any) => p.locked);
    bulkLockBtn.innerHTML = allLocked ? '🌎 Make Entire Section Public' : '👁️ Make Entire Section Private';
    bulkLockBtn.style.cssText = 'background:none; border:1px solid var(--line); border-radius:16px; padding:6px 14px; font-size:12px; font-family:inherit; cursor:pointer; color:var(--ink); transition: background 0.15s; font-weight:500;';
    bulkLockBtn.addEventListener('mouseenter', () => bulkLockBtn.style.background = '#fafafa');
    bulkLockBtn.addEventListener('mouseleave', () => bulkLockBtn.style.background = 'none');
    
    bulkLockBtn.addEventListener('click', () => {
        section.photos.forEach((item: any) => { item.locked = !allLocked; });
        saveState();
        render();
    });
    secToolbar.appendChild(bulkLockBtn);
    galleryArea!.appendChild(secToolbar);
  }

  const grid = document.createElement('div');
  grid.className = 'grid';

  section.photos.forEach((item: any, pIndex: any) => {
    // Hide private photos when viewing as public
    if (!isEdit && currentViewMode === 'public' && item.locked) return;
    
    const card = document.createElement('div');
    card.className = 'photo-card';
    const isLockedState = false; // Never blur photos anymore since encryption is gone

    if (!item.type || item.type === 'image' || item.type === 'group') {
       if (item.type === 'group' && item.sources && item.sources.length > 0) {
           const gridContainer = document.createElement('div');
           gridContainer.style.cssText = 'width:100%; height:100%; display:grid; grid-template-columns:repeat(2, 1fr); grid-template-rows:repeat(2, 1fr); gap:2px; background:#ffffff;';
           
           for (let i = 0; i < 4; i++) {
               const sourceObj = item.sources[i];
               const subCell = document.createElement('div');
               subCell.style.cssText = 'background:#ffffff; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;';
               
               if (sourceObj) {
                   const obj = typeof sourceObj === 'object' ? sourceObj : { src: sourceObj, locked: false };
                   const isSubLocked = obj.locked && !sessionPassword;
                   const srcVal = obj.src;

                   if (isSubLocked) {
                       const subImg = document.createElement('img');
                       subImg.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48L3N2Zz4=';
                       subImg.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain; display:block; filter:blur(10px); opacity:0.4;';
                       subCell.appendChild(subImg);
                       const lockBadge = document.createElement('div');
                       lockBadge.innerHTML = '🔒';
                       lockBadge.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px;';
                       subCell.appendChild(lockBadge);
                   } else {
                       const actualSrc = obj.locked ? (decryptData(srcVal, sessionPassword) || '') : srcVal;
                       const subImg = document.createElement('img');
                       subImg.src = actualSrc;
                       subImg.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain; display:block;';
                       subImg.draggable = false;
                       subImg.loading = 'lazy'; // Force lazy loading on sub-images
                       subImg.decoding = 'async'; // Prevent main thread blocking
                       subCell.appendChild(subImg);
                   }
               }
               gridContainer.appendChild(subCell);
           }
           card.appendChild(gridContainer);
       } else {
               const img = document.createElement('img');
               if (isLockedState) {
                   img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48L3N2Zz4='; 
               } else {
                   img.src = item.locked ? (decryptData(item.src, sessionPassword) || '') : item.src;
               }
               img.alt = '';
               img.loading = 'lazy';
               img.decoding = 'async'; // Offload image decoding to speed up tab switching
               img.draggable = false;
               card.appendChild(img);
           }

       card.addEventListener('click', () => {
          if(!isLockedState) openLightbox(pIndex);
       });
       
    } else if (item.type === 'text') {
       card.classList.add('text-type');
       
       const tc = document.createElement('div');
       tc.className = 'text-content';
       tc.contentEditable = (isEdit && !isLockedState) ? "true" : "false";
       
       if (isLockedState) {
           tc.innerHTML = 'Hidden Content<br><br>...<br>...';
       } else {
           tc.innerHTML = item.locked ? (decryptData(item.content, sessionPassword) || '') : (item.content || '');
       }
       
       tc.addEventListener('blur', () => {
          if(isLockedState) return;
          const raw = tc.innerHTML;
          item.content = item.locked ? encryptData(raw, sessionPassword) : raw;
          saveState();
       });
       tc.addEventListener('keydown', e => e.stopPropagation());

       if (isEdit && !isLockedState) {
           // Momentarily disable card dragging when hovering text so text selection works naturally
           tc.addEventListener('mouseenter', () => card.setAttribute('draggable', 'false'));
           tc.addEventListener('mouseleave', () => card.setAttribute('draggable', 'true'));
       }

       if (!isEdit) {
          card.addEventListener('click', () => { if(!isLockedState) openLightbox(pIndex); });
       }

       card.appendChild(tc);

       if (isEdit && !isLockedState) {
         const tb = document.createElement('div');
         tb.className = 'text-card-toolbar';
         tb.contentEditable = "false"; 
         
         const label = document.createElement('span');
         label.className = 'toolbar-label';
         label.textContent = "Highlight text, then:";
         tb.appendChild(label);
         
         const weights = [
            { label: 'Thin', val: '300' },
            { label: 'Regular', val: '400' },
            { label: 'Bold', val: '700' }
         ];
         
         tb.addEventListener('mousedown', (e) => e.preventDefault());
         
         weights.forEach(w => {
            const btn = document.createElement('button');
            btn.textContent = w.label;
            
            btn.addEventListener('click', (e) => {
               e.stopPropagation();
               const sel = window.getSelection();
               if (!sel || !sel.rangeCount || sel.isCollapsed) return; 
               
               const range = sel.getRangeAt(0);
               const span = document.createElement('span');
               span.style.fontWeight = w.val;
               span.appendChild(range.extractContents());
               range.insertNode(span);
               sel.removeAllRanges(); 
               
               const raw = tc.innerHTML;
               item.content = item.locked ? encryptData(raw, sessionPassword) : raw;
               saveState();
            });
            tb.appendChild(btn);
         });
         card.appendChild(tb);
       }
    }

    const lockEl = document.createElement('div');
    lockEl.className = 'photo-lock';
    lockEl.style.width = 'auto'; 
    lockEl.style.padding = '0 8px';
    lockEl.style.borderRadius = '12px';
    lockEl.style.fontSize = '11px';
    lockEl.style.fontWeight = 'bold';
    lockEl.innerHTML = item.locked ? '👁️ Private' : '🌎 Public';
    lockEl.title = item.locked ? 'Switch to Public' : 'Switch to Private';
    lockEl.addEventListener('click', (e) => {
      e.stopPropagation();
      item.locked = !item.locked;
      saveState();
      render();
    });

    const removeEl = document.createElement('div');
    removeEl.className = 'photo-remove';
    removeEl.textContent = '\u00d7';
    removeEl.title = 'Remove item';
    removeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      section.photos.splice(pIndex, 1);
      render();
    });
    
    if(isEdit) {
       card.appendChild(lockEl);
       card.appendChild(removeEl);

       if (!item.type || item.type === 'image') {
           const dlEl = document.createElement('div');
           dlEl.className = 'photo-download';
           dlEl.innerHTML = '↓';
           dlEl.title = 'Download image';
           dlEl.addEventListener('click', (e) => {
               e.stopPropagation();
               if (item.locked && !sessionPassword) {
                   alert("Unlock the item first to download it.");
                   return;
               }
               const imgSrc = item.locked ? decryptData(item.src, sessionPassword) : item.src;
               if (!imgSrc) return;
               
               const safeTitle = (item.title || 'gallery-image').replace(/[^a-z0-9]/gi, '_').toLowerCase();
               
               // Dynamically convert the stored image back to a high-quality PNG
               const tempImg = new Image();
               tempImg.onload = () => {
                   const canvas = document.createElement('canvas');
                   canvas.width = tempImg.width;
                   canvas.height = tempImg.height;
                   canvas.getContext('2d')!.drawImage(tempImg, 0, 0);
                   const a = document.createElement('a');
                   a.href = canvas.toDataURL('image/png');
                   a.download = safeTitle + '.png';
                   document.body.appendChild(a);
                   a.click();
                   a.remove();
               };
               tempImg.src = imgSrc;
           });
           card.appendChild(dlEl);
       }

       // --- Drag and Drop Reordering Setup ---
       card.setAttribute('draggable', 'true');
       
       card.addEventListener('dragstart', (e) => {
           e.dataTransfer!.setData('text/plain', pIndex.toString());
           e.dataTransfer!.effectAllowed = 'move';
           setTimeout(() => card.classList.add('dragging'), 0);
       });

       card.addEventListener('dragend', () => {
           card.classList.remove('dragging');
       });

       card.addEventListener('dragover', (e) => {
           e.preventDefault();
           if (e.dataTransfer!.types.includes('text/plain')) {
               card.classList.add('drag-over');
           }
       });

       card.addEventListener('dragleave', () => {
           card.classList.remove('drag-over');
       });

       card.addEventListener('drop', (e) => {
            card.classList.remove('drag-over');
            const dragData = e.dataTransfer!.getData('text/plain');
            if (dragData !== "") {
                e.preventDefault();
                e.stopPropagation();
                const fromIndex = parseInt(dragData, 10);
                const toIndex = pIndex;
                
                if (!isNaN(fromIndex) && fromIndex !== fromIndex) return; // safety

                const section = getActiveSection();
                const targetItem = section.photos[toIndex];
                const sourceItem = section.photos[fromIndex];

                // Prevent text notes or invalid drops
                if (!sourceItem || sourceItem.type === 'text') return;
                if (targetItem && targetItem.type === 'text') return;

                // Check if user is trying to combine into a 4-photo group slot
                // Hold 'Shift' key while dropping to force nesting/combining, OR drop directly onto a group card
                const isGroupTarget = targetItem.type === 'group';
                const isShiftDrop = e.shiftKey;

                if (isGroupTarget || isShiftDrop) {
                    if (!targetItem.sources) {
                        targetItem.type = 'group';
                        // Convert old string format to object format with empty title/desc
                        targetItem.sources = [{ src: targetItem.src, title: targetItem.title || "", desc: targetItem.desc || "" }];
                        delete targetItem.src;
                        delete targetItem.title;
                        delete targetItem.desc;
                    }

                    if (targetItem.sources.length < 4 && fromIndex !== toIndex) {
                        let actualObj;
                        if (sourceItem.type === 'group') {
                            actualObj = sourceItem.sources[0];
                        } else {
                            const decryptedSrc = sourceItem.locked ? decryptData(sourceItem.src, sessionPassword) : sourceItem.src;
                            const decryptedTitle = sourceItem.locked && sourceItem.title ? decryptData(sourceItem.title, sessionPassword) : (sourceItem.title || "");
                            const decryptedDesc = sourceItem.locked && sourceItem.desc ? decryptData(sourceItem.desc, sessionPassword) : (sourceItem.desc || "");
                            actualObj = { src: decryptedSrc, title: decryptedTitle, desc: decryptedDesc };
                        }

                        if (actualObj && actualObj.src) {
                            targetItem.sources.push(actualObj);
                            section.photos.splice(fromIndex, 1); 
                            saveState();
                            render();
                        }
                    } else if (targetItem.sources.length >= 4) {
                        alert("This image block already has the maximum of 4 photos combined.");
                    }
                } else {
                    // Standard reordering behavior
                    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
                        const [movedItem] = section.photos.splice(fromIndex, 1);
                        section.photos.splice(toIndex, 0, movedItem);
                        saveState();
                        renderGallery();
                    }
                }
            }
        });
    }
    grid.appendChild(card);
  });

  if(isEdit && section.photos.length < MAX_PHOTOS_PER_SECTION){
    const addCard = document.createElement('div');
    addCard.className = 'add-item-card show';
    
    const btnPhoto = document.createElement('div');
    btnPhoto.className = 'add-item-btn';
    btnPhoto.innerHTML = `<div class="plus">+</div><div>Photo</div>`;
    btnPhoto.addEventListener('click', () => fileInput!.click());
    
    const btnText = document.createElement('div');
    btnText.className = 'add-item-btn';
    btnText.innerHTML = `<div class="plus">+</div><div>Note</div>`;
    btnText.addEventListener('click', () => {
       section.photos.push({ type: 'text', content: '', locked: false });
       render();
    });
    
    addCard.appendChild(btnPhoto);
    addCard.appendChild(btnText);
    grid.appendChild(addCard);
  }

  galleryArea!.appendChild(grid);

  if(isEdit){
    const note = document.createElement('div');
    note.className = 'count-note';
    note.textContent = `${section.photos.length} / ${MAX_PHOTOS_PER_SECTION} items in "${section.name}"`;
    galleryArea!.appendChild(note);
  }
}

/* ---------------- Visually-Lossless Image Compression Engine ---------------- */

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image')); };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not compress'))), type, quality);
  });
}

async function uploadOneFile(file: File, n: number): Promise<string> {
  const img = await loadImageFromFile(file);
  let width = img.width;
  let height = img.height;

  const MAX_SIZE = 1600;
  if (width > height && width > MAX_SIZE) {
    height = Math.round((height * MAX_SIZE) / width);
    width = MAX_SIZE;
  } else if (height > MAX_SIZE) {
    width = Math.round((width * MAX_SIZE) / height);
    height = MAX_SIZE;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/webp', 0.85);
  const result = await vercelBlobUpload(`gallery/photo-${Date.now()}-${n}.webp`, blob, {
    access: 'public',
    handleUploadUrl: '/api/upload',
  });
  return result.url;
}

async function processFiles(fileList: any) {
  const section = getActiveSection();
  if(!section) {
     alert("Please create or select a section to upload photos into.");
     return;
  }

  const room = MAX_PHOTOS_PER_SECTION - section.photos.length;
  const toAdd = fileList.slice(0, room);
  if(fileList.length > room) alert(`Only ${room} more photo(s) can be added to this section (200 max).`);
  if(toAdd.length === 0) return;

  document.body.style.cursor = 'progress';
  let failed = 0;

  for (let i = 0; i < toAdd.length; i += 4) {
    const batch = toAdd.slice(i, i + 4);
    const urls = await Promise.all(
      batch.map((file: any, j: number) => uploadOneFile(file, i + j).catch(() => null))
    );
    urls.forEach((url: any) => {
      if (url) section.photos.push({ type: 'image', src: url, title: "", desc: "", locked: false });
      else failed++;
    });
    render();
  }

  document.body.style.cursor = '';
  if (failed > 0) alert(`${failed} photo(s) failed to upload. Try those again.`);
}

fileInput!.addEventListener('change', () => {
  const files = Array.from(fileInput!.files || []);
  if(files.length > 0) processFiles(files);
  fileInput!.value = "";
});

/* ---------------- Drag & Drop Logic ---------------- */

document.addEventListener('dragenter', (e) => { 
  e.preventDefault(); 
  if(body.classList.contains('edit-mode') && Array.from(e.dataTransfer!.types).includes('Files')) {
    dragOverlay!.style.display = 'flex'; 
  }
});
document.addEventListener('dragover', (e) => { 
  e.preventDefault(); 
  if(body.classList.contains('edit-mode') && Array.from(e.dataTransfer!.types).includes('Files')) {
    dragOverlay!.style.display = 'flex'; 
  }
});
document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  if (!e.relatedTarget || (e.relatedTarget as Node).nodeName === 'HTML') dragOverlay!.style.display = 'none';
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragOverlay!.style.display = 'none';
  if(body.classList.contains('edit-mode')) {
    const files = Array.from(e.dataTransfer!.files || []).filter(f => f.type.startsWith('image/'));
    if(files.length > 0) processFiles(files);
  }
});

/* ---------------- Lightbox ---------------- */

function openLightbox(pIndex: any){
  currentPhotoIndex = pIndex;
  showCurrentPhoto();
  lightbox!.classList.add('open');
}

let activeGroupSubIndex: any = null;

function showCurrentPhoto(){
  const section = getActiveSection();
  if(!section) return;
  const item = section.photos[currentPhotoIndex];
  if(!item) return;
  
  const isEdit = body.classList.contains('edit-mode');
  const isText = item.type === 'text';
  const isGroup = item.type === 'group';
  
  if (isText) {
    lightboxImgWrap!.style.display = 'none';
    lightboxText!.style.display = 'block';
    activeGroupSubIndex = null;
    
    const rawContent = item.locked ? decryptData(item.content, sessionPassword) : item.content;
    lightboxText!.innerHTML = rawContent || (isEdit ? '' : '<span style="color:#c7c7c7; font-style:italic;">Empty note</span>');
    lightboxCaption!.style.display = 'none'; 
 } else if (isGroup && activeGroupSubIndex === null) {
    lightboxImgWrap!.style.display = 'flex';
    lightboxText!.style.display = 'none';
    lightboxCaption!.style.display = 'none'; 

    lightboxImgWrap!.innerHTML = '';
    const selectorGrid = document.createElement('div');
    // Made the 2x2 larger (600px instead of 400px) with pure white background
    selectorGrid.style.cssText = 'width:600px; height:600px; max-width:90vw; max-height:90vw; display:grid; grid-template-columns:repeat(2, 1fr); grid-template-rows:repeat(2, 1fr); gap:12px; background:#ffffff; padding:0; border-radius:8px;';

    item.sources.forEach((sourceObj: any, subIdx: any) => {
        const cell = document.createElement('div');
        cell.style.cssText = 'background:#ffffff; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:4px; position:relative;';
        
        if (sourceObj) {
            const obj = typeof sourceObj === 'object' ? sourceObj : { src: sourceObj, locked: false };
            const isSubLocked = obj.locked && !sessionPassword;
            const srcVal = obj.src;

            const img = document.createElement('img');
            if (isSubLocked) {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48L3N2Zz4=';
                img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain; display:block; filter:blur(10px); opacity:0.4;';
            } else {
                img.src = obj.locked ? (decryptData(srcVal, sessionPassword) || '') : srcVal;
                img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain; display:block;';
                cell.style.cursor = 'pointer';
                cell.addEventListener('mouseenter', () => cell.style.opacity = '0.8');
                cell.addEventListener('mouseleave', () => cell.style.opacity = '1');
            }
            img.draggable = false;
            cell.appendChild(img);

            if (isEdit) {
                // Individual Lock/Unlock button for each sub-image
                const subLockBtn = document.createElement('div');
                subLockBtn.innerHTML = obj.locked ? '🔒' : '🔓';
                subLockBtn.title = obj.locked ? 'Unlock this image' : 'Lock this image';
                subLockBtn.style.cssText = 'position:absolute; top:6px; left:6px; width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,0.95); display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer; z-index:10; border:1px solid var(--line); box-shadow:0 2px 6px rgba(0,0,0,0.05);';
                subLockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!state.galleryPassword) {
                        alert("Please set a Master Password at the top right before locking items.");
                        return;
                    }
                    if (!obj.locked) {
                        obj.src = encryptData(obj.src, state.galleryPassword);
                        if(obj.title) obj.title = encryptData(obj.title, state.galleryPassword);
                        if(obj.desc) obj.desc = encryptData(obj.desc, state.galleryPassword);
                        obj.locked = true;
                    } else {
                        obj.src = decryptData(obj.src, state.galleryPassword) || "";
                        if(obj.title) obj.title = decryptData(obj.title, state.galleryPassword) || "";
                        if(obj.desc) obj.desc = decryptData(obj.desc, state.galleryPassword) || "";
                        obj.locked = false;
                    }
                    saveState();
                    showCurrentPhoto();
                });
                cell.appendChild(subLockBtn);

                cell.setAttribute('draggable', 'true');
                cell.addEventListener('dragstart', (e) => {
                    e.dataTransfer!.setData('text/subindex', subIdx.toString());
                    e.dataTransfer!.effectAllowed = 'move';
                });
                cell.addEventListener('dragover', (e) => e.preventDefault());
                cell.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const fromSub = parseInt(e.dataTransfer!.getData('text/subindex'), 10);
                    const toSub = subIdx;
                    if (!isNaN(fromSub) && fromSub !== toSub) {
                        const temp = item.sources[fromSub];
                        item.sources[fromSub] = item.sources[toSub];
                        item.sources[toSub] = temp;
                        saveState();
                        showCurrentPhoto(); 
                    }
                });
            }

            if (!isSubLocked) {
                cell.addEventListener('click', () => {
                    activeGroupSubIndex = subIdx;
                    showCurrentPhoto();
                });
            }
        }
        selectorGrid.appendChild(cell);
    });
    lightboxImgWrap!.appendChild(selectorGrid);

 } else {
    lightboxImgWrap!.style.display = 'flex';
    lightboxText!.style.display = 'none';
    
    lightboxImgWrap!.innerHTML = '';
    lightboxImgWrap!.appendChild(lightboxImg); 

  
    const targetObj = isGroup ? item.sources[activeGroupSubIndex] : item;
    const targetSrc = typeof targetObj === 'object' ? targetObj.src : targetObj;
    lightboxImg.src = item.locked ? decryptData(targetSrc, sessionPassword) || '' : targetSrc;
    
    const rawTitle = item.locked ? (decryptData(targetObj.title, sessionPassword) || "") : (targetObj.title || "");
    const rawDesc = item.locked ? (decryptData(targetObj.desc, sessionPassword) || "") : (targetObj.desc || "");
    
    const hasTitle = rawTitle.trim().length > 0;
    const hasDesc = rawDesc.trim().length > 0;
    
    lightboxTitle!.textContent = rawTitle;
    lightboxDesc!.textContent = rawDesc;
    lightboxTitle!.contentEditable = isEdit ? "true" : "false";
    lightboxDesc!.contentEditable = isEdit ? "true" : "false";
    
    if (!isEdit) {
      if (!hasTitle && !hasDesc) {
          lightboxCaption!.style.display = 'none'; 
      } else {
        lightboxCaption!.style.display = 'block';
        lightboxTitle!.style.display = hasTitle ? 'block' : 'none';
        lightboxDesc!.style.display = hasDesc ? 'block' : 'none';
        lightboxDesc!.textContent = rawDesc;
      }
    } else {
      lightboxCaption!.style.display = 'block';
      lightboxTitle!.style.display = 'block';
      lightboxDesc!.style.display = 'block';
    }
  }
}

// Make sure closing lightbox resets the group sub-index state
let closeLightbox = function() {
    activeGroupSubIndex = null;
    lightbox!.classList.remove('open'); 
    currentPhotoIndex = null;
};

lightboxClose!.addEventListener('click', closeLightbox);
lightbox!.addEventListener('click', (e) => { if(e.target === lightbox) closeLightbox(); });

function getValidGroupIndices(item: any) {
    if (!item.sources) return [];
    let indices = [];
    for (let i = 0; i < item.sources.length; i++) {
        if (item.sources[i]) indices.push(i);
    }
    return indices;
}

function findNextUnlockedIndex(startIndex: any, direction: any) {
  const section = getActiveSection();
  if(!section || section.photos.length <= 1) return startIndex;
  
  const isEdit = body.classList.contains('edit-mode');
  let i = startIndex;
  let checks = 0;
  while(checks < section.photos.length) {
     i = (i + direction + section.photos.length) % section.photos.length;
     const targetItem = section.photos[i];
     
     // Skip private photos if we are navigating the gallery in Public view
     if (isEdit || currentViewMode === 'private' || !targetItem.locked) return i;
     
     checks++;
  }
  return startIndex; 
}

lightboxPrev!.addEventListener('click', () => {
  if(currentPhotoIndex === null) return;
  const section = getActiveSection();
  const item = section.photos[currentPhotoIndex];
  
  if (item && item.type === 'group' && activeGroupSubIndex !== null) {
      const validIndices = getValidGroupIndices(item);
      const currPos = validIndices.indexOf(activeGroupSubIndex);
      if (currPos > 0) {
          activeGroupSubIndex = validIndices[currPos - 1];
          showCurrentPhoto();
          return;
      } else {
          // Finished going backwards through sub-photos, go to previous main gallery item
          activeGroupSubIndex = null;
      }
  }
  
  currentPhotoIndex = findNextUnlockedIndex(currentPhotoIndex, -1);
  const prevItem = section.photos[currentPhotoIndex];
  if (prevItem && prevItem.type === 'group') {
      const validIndices = getValidGroupIndices(prevItem);
      if (validIndices.length > 0) {
          activeGroupSubIndex = validIndices[validIndices.length - 1]; // start at bottom-right when entering backwards
      }
  } else {
      activeGroupSubIndex = null;
  }
  showCurrentPhoto();
});

lightboxNext!.addEventListener('click', () => {
  if(currentPhotoIndex === null) return;
  const section = getActiveSection();
  const item = section.photos[currentPhotoIndex];
  
  if (item && item.type === 'group') {
      const validIndices = getValidGroupIndices(item);
      const currPos = activeGroupSubIndex !== null ? validIndices.indexOf(activeGroupSubIndex) : -1;
      
      if (currPos < validIndices.length - 1 && currPos !== -2) {
          activeGroupSubIndex = currPos === -1 ? validIndices[0] : validIndices[currPos + 1];
          showCurrentPhoto();
          return;
      }
  }
  
  activeGroupSubIndex = null;
  currentPhotoIndex = findNextUnlockedIndex(currentPhotoIndex, 1);
  showCurrentPhoto();
});
document.addEventListener('keydown', (e) => {
  if(!lightbox!.classList.contains('open')) return;
  if(document.activeElement === lightboxTitle || document.activeElement === lightboxDesc) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'ArrowLeft') lightboxPrev!.click();
  if(e.key === 'ArrowRight') lightboxNext!.click();
});

lightboxTitle!.addEventListener('blur', () => {
  const section = getActiveSection();
  if(!section) return;
  const item = section.photos[currentPhotoIndex];
  if(item) {
     const raw = lightboxTitle!.textContent!.trim();
     if (item.type === 'group' && activeGroupSubIndex !== null) {
         if (typeof item.sources[activeGroupSubIndex] !== 'object') {
             item.sources[activeGroupSubIndex] = { src: item.sources[activeGroupSubIndex], title: "", desc: "" };
         }
         item.sources[activeGroupSubIndex].title = item.locked ? encryptData(raw, sessionPassword) : raw;
     } else if (!item.type || item.type === 'image') {
         item.title = item.locked ? encryptData(raw, sessionPassword) : raw; 
     }
     saveState(); 
  }
});
lightboxDesc!.addEventListener('blur', () => {
  const section = getActiveSection();
  if(!section) return;
  const item = section.photos[currentPhotoIndex];
  if(item) {
     const raw = lightboxDesc!.textContent!.trim();
     if (item.type === 'group' && activeGroupSubIndex !== null) {
         if (typeof item.sources[activeGroupSubIndex] !== 'object') {
             item.sources[activeGroupSubIndex] = { src: item.sources[activeGroupSubIndex], title: "", desc: "" };
         }
         item.sources[activeGroupSubIndex].desc = item.locked ? encryptData(raw, sessionPassword) : raw;
     } else if (!item.type || item.type === 'image') {
         item.desc = item.locked ? encryptData(raw, sessionPassword) : raw; 
     }
     saveState(); 
  }
});
/* ---------------- Mode toggle ---------------- */

function setMode(mode: any){
  if(mode === 'edit'){
    body.classList.add('edit-mode');
    body.classList.remove('view-mode');
    editBtn!.classList.add('active');
    viewBtn!.classList.remove('active');
    brandTitle!.contentEditable = "true";
    
    // Automatically apply the stored password so photos are visible to the creator
    sessionPassword = state.galleryPassword;
  } else {
    body.classList.remove('edit-mode');
    body.classList.add('view-mode');
    viewBtn!.classList.add('active');
    editBtn!.classList.remove('active');
    brandTitle!.contentEditable = "false";
    
    // Instantly clear the password so the view mode accurately reflects the locked state
    sessionPassword = null;
  }
  if(lightbox!.classList.contains('open')) showCurrentPhoto();
  render();
}

editBtn!.addEventListener('click', () => setMode('edit'));
viewBtn!.addEventListener('click', () => setMode('view'));

brandTitle!.addEventListener('blur', () => {
  state.title = brandTitle!.textContent!.trim() || "JC";
  document.title = state.title;
  saveState();
});
brandTitle!.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); brandTitle!.blur(); } });

/* ---------------- Right-click / drag protection ---------------- */
document.addEventListener('contextmenu', (e: any) => { if(e.target.tagName === 'IMG') e.preventDefault(); });
lightboxImg.draggable = false;

/* ---------------- Export & Backup Handlers ---------------- */

async function generateExport(type: 'editable' | 'shareable', visibility: 'public' | 'private') {
  try {
    const res = await fetch('/template.html');
    let htmlTemplate = await res.text();

    // 1. Clone state so we don't modify the live working gallery
    let exportState = JSON.parse(JSON.stringify(state));
    exportState.galleryPassword = null; 
    
    // 2. If downloading a Public copy, completely erase Private items from the exported JSON
    if (visibility === 'public') {
      exportState.items.forEach((item: any) => {
        if (item.type === 'section') {
          item.photos = item.photos.filter((p: any) => !p.locked);
        } else if (item.type === 'folder') {
          item.sections.forEach((sec: any) => {
            sec.photos = sec.photos.filter((p: any) => !p.locked);
          });
        }
      });
    }

    // 3. Inject data
    const injectedScript = `<script id="embeddedDataScript">window.__EMBEDDED_GALLERY_DATA__ = ${JSON.stringify(exportState)};</script>\n</head>`;
    htmlTemplate = htmlTemplate.replace('</head>', injectedScript);

    // 4. Force view/edit modes on load
    if (type === 'editable') {
      htmlTemplate = htmlTemplate.replace(/<body[^>]*>/, '<body class="edit-mode">');
    } else {
      htmlTemplate = htmlTemplate.replace(/<body[^>]*>/, '<body class="view-mode">');
    }

    // 5. Trigger download
    const blob = new Blob([htmlTemplate], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (state.title || 'gallery').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'gallery';
    a.download = `${safeName}-${type}-${visibility}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Could not generate file. Make sure template.html is inside the public folder.");
  }
}

// Bind the 3 new buttons
const doc = document as any;

doc.getElementById('saveProjectBtn')?.addEventListener('click', (e:any) => { 
  e.target.textContent = 'Generating...'; 
  // Passing 'private' visibility retains ALL photos (public and private), giving you the full website back
  generateExport('editable', 'private').then(()=>e.target.textContent='Download Editable Copy'); 
});

doc.getElementById('saveShareablePublicBtn')?.addEventListener('click', (e:any) => { 
  e.target.textContent = 'Generating...'; 
  generateExport('shareable', 'public').then(()=>e.target.textContent='Shareable (Public)'); 
});

doc.getElementById('saveShareablePrivateBtn')?.addEventListener('click', (e:any) => { 
  e.target.textContent = 'Generating...'; 
  generateExport('shareable', 'private').then(()=>e.target.textContent='Shareable (Private)'); 
});

/* ---------------- App Initialization ---------------- */
async function init() {
  document.title = state.title || "JC";
  const loaded = await loadInitialState();
  
  // FIX: If the local database only contains the empty "Section 1" fallback 
  // from our earlier tests, ignore it. This allows your imported JSON to take over.
  if (loaded && loaded.items && loaded.items.length === 1 && loaded.items[0].photos.length === 0) {
    saveState(); // Overwrite the empty database with your rich JSON data
  } else if (loaded) {
    state = loaded;
  }
  
  resetActivePath();

  if((window as any).__EMBEDDED_GALLERY_DATA__){
    if (body.classList.contains('locked')) {
      setMode('view');
    } else {
      setMode('edit');
    }
  } else {
    setMode('edit');
  }
}

init();

    // =========================================================
    // PASTE ABOVE THIS LINE
    // =========================================================
  }, []);

  return (
    <>
      {/* I have translated your exact HTML into React JSX format */}
      <header className="site-head">
        <div className="head-inner">
          <div className="brand" contentEditable="true" suppressContentEditableWarning={true} spellCheck={false} id="brandTitle">JC</div>
          <div className="header-actions">
            <div id="authContainer" className="auth-container"></div>
            <div id="storageMeter" className="storage-meter" title="Remote Vercel Blob storage active">
              <span id="storageText" className="storage-text">Vercel Blob Active</span>
              <span className="storage-badge" style={{ color: '#000' }}>● Cloud Storage</span>
            </div>
            <div className="mode-toggle">
              <button id="editBtn" className="active">Edit</button>
              <button id="viewBtn">View</button>
            </div>
          </div>
        </div>
        
        <div className="mobile-tabs-toggle" id="mobileTabsToggle">
          <span id="mobileTabsLabel">Sections</span>
          <svg className="chevron" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <nav className="tabs" id="tabsNav"></nav>
      </header>

      <main>
        <div id="galleryArea"></div>
      </main>

      <div className="export-bar">
        <span>Edit mode — add up to 200 items per section. Save an editable copy anytime to back up.</span>
        <div className="bar-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button id="saveProjectBtn" className="ghost" title="Download an HTML copy you can open and continue editing anytime">Download Editable Copy</button>
          <button id="saveShareablePublicBtn">Shareable (Public)</button>
          <button id="saveShareablePrivateBtn">Shareable (Private)</button>
        </div>
      </div>

      <div className="lightbox" id="lightbox">
        <button className="lightbox-close" id="lightboxClose">&times;</button>
        <button className="lightbox-nav lightbox-prev" id="lightboxPrev">&#8249;</button>
        <button className="lightbox-nav lightbox-next" id="lightboxNext">&#8250;</button>
        
        <div className="lightbox-img-wrap" id="lightboxImgWrap">
          <img id="lightboxImg" alt="" />
        </div>
        
        <div className="lightbox-text-wrap" id="lightboxText"></div>
        
        <div className="lightbox-caption" id="lightboxCaption">
          <div className="lightbox-title" id="lightboxTitle" contentEditable="false" data-placeholder="Untitled"></div>
          <div className="lightbox-desc" id="lightboxDesc" contentEditable="false" data-placeholder="Add a description..."></div>
          <div className="edit-hint">Click title or description to edit</div>
        </div>
      </div>

      <div id="dragOverlay" className="drag-overlay">
        Drop photos to add to the active section
      </div>

      <input type="file" id="fileInput" accept="image/*" multiple style={{ display: 'none' }} />
    </>
  );
}