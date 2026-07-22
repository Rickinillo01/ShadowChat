// =============================================================================
// chat.js — Conversation-based chat with multimedia (ShadowChat 2.0)
// =============================================================================

import {
  db, auth, ref, onValue, onChildAdded, onChildRemoved, onChildChanged, off, get, set, update, remove, query, limitToLast
} from '../firebase.js';

import {
  sendMessage, startCleanupInterval, stopCleanupInterval,
  formatTimestamp, getTTLOptions, getRemainingTime, markViewOnce, checkAllViewed
} from './messages.js';

import {
  uploadMedia, getMediaType, validateFile, formatFileSize, generateThumbnail
} from './media.js';

import { state } from '../main.js';

// ─── State ──────────────────────────────────────────────────
let _listeners = [];
let _cleanupIntervalId = null;
let _progressIntervalId = null;
let _expiryIntervalId = null;
let _currentUser = null;
let _currentConvId = null;
let _currentTTLIndex = 0;
let _container = null;
let _panicHandler = null;
let _backHandler = null;
let _memberCount = 0;
let _pendingFile = null;
let _viewOnce = false;
let _replyingTo = null;
let _editingMsgId = null;
const _linkPreviewCache = {};

// ─── SVG Icons ──────────────────────────────────────────────
const ICONS = {
  back: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  gear: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  timer: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="8"/><path d="M12 10v4l2 2"/><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="2" x2="12" y2="6"/></svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  send: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  mic: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
  stop: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  camera: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  sticker: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sticker"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M14 3v7a2 2 0 0 0 2 2h7"/><path d="M9.5 10h.01"/><path d="M14.5 10h.01"/><path d="M10 14c1-1 3-1 4 0"/></svg>`,
  clip: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  ghost: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2 2 3-3 3 3 2-2 3 3V10a8 8 0 0 0-8-8z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>`,
  play: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
};

// ─── Styles ─────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('shadowchat-styles')) return;
  const s = document.createElement('style');
  s.id = 'shadowchat-styles';
  s.textContent = `
    .ch-wrap { height:100%; display:flex; flex-direction:column; background:var(--ch-bg, #0a0a0f); color:var(--ch-text, #e0e0e0); font-family:'Inter',sans-serif; overflow:hidden; position:relative; }
    .ch-header { display:flex; align-items:center; gap:10px; padding:12px 16px; background:#0d0d15; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
    .ch-back { display:none; background:none; border:none; color:rgba(255,255,255,0.6); cursor:pointer; padding:4px; transition:color 0.2s; }
    .ch-back:hover { color:#00f5d4; }
    @media(max-width:768px) { .ch-back { display:flex; } }
    @media(max-width:768px) { .ch-back { display:flex; } }
    .ch-conv-name-wrap { flex:1; display:flex; align-items:center; gap:6px; overflow:hidden; }
    .ch-conv-name { font-weight:600; font-size:0.95rem; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ch-edit-name { background:none; border:none; cursor:pointer; font-size:0.85rem; opacity:0.5; transition:opacity 0.2s; padding:2px; }
    .ch-edit-name:hover { opacity:1; }
    .ch-badge { padding:3px 8px; border-radius:10px; font-size:0.7rem; font-weight:600; background:rgba(0,245,212,0.15); color:#00f5d4; }
    .ch-hdr-btn { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; padding:6px; border-radius:6px; transition:all 0.2s; display:flex; align-items:center; }
    .ch-hdr-btn:hover { color:#00f5d4; background:rgba(0,245,212,0.08); }
    .ch-panic { color:#f72585 !important; }
    .ch-panic:hover { background:rgba(247,37,133,0.12) !important; }

    .ch-msgs { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; padding:16px; display:flex; flex-direction:column; gap:6px; }
    .ch-msgs::-webkit-scrollbar { width:4px; }
    .ch-msgs::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:4px; }
    .ch-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:rgba(255,255,255,0.2); }
    .ch-empty p { margin:0; font-size:0.88rem; }

    .ch-msg { display:flex; flex-direction:column; max-width:65%; animation:chMsgIn 0.25s ease; position:relative; touch-action: pan-y; }
    
    .ch-msg-edited { font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-right: 4px; font-style: italic; display: inline-block; }
    
    .ch-msg-actions { position:absolute; top:-10px; right:0; background:#16162a; border:1px solid rgba(255,255,255,0.1); border-radius:12px; display:flex; opacity:0; pointer-events:none; transition:all 0.2s; z-index:10; box-shadow:0 4px 10px rgba(0,0,0,0.4); padding:2px; }
    .ch-bubble:hover .ch-msg-actions, .ch-msg-actions.visible { opacity:1; pointer-events:auto; }
    .ch-msg-action-btn { background:none; border:none; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-radius:8px; transition:all 0.2s; color:#00f5d4; }
    .ch-msg-action-btn:hover { background:rgba(0,245,212,0.1); transform:scale(1.1); }
    .ch-msg-del-btn { color:#f72585; }
    .ch-msg-del-btn:hover { background:rgba(247,37,133,0.1); }
    
    .ch-quoted-msg { background:rgba(0,0,0,0.2); border-left:3px solid #00f5d4; padding:6px 10px; border-radius:6px; margin-bottom:6px; cursor:pointer; font-size:0.8rem; overflow:hidden; max-width:100%; box-sizing:border-box; }
    .ch-quoted-msg .q-sender { color:#00f5d4; font-weight:600; margin-bottom:2px; font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ch-quoted-msg .q-text { color:rgba(255,255,255,0.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    
    .ch-reply-preview { position:absolute; bottom:100%; left:0; right:0; background:#16162a; border-top:1px solid rgba(255,255,255,0.06); padding:8px 16px; display:none; align-items:center; gap:10px; z-index:0; box-sizing: border-box; }
    .ch-reply-preview.active { display:flex; }
    .ch-reply-preview-content { flex:1; border-left:3px solid #00f5d4; padding-left:8px; overflow:hidden; min-width:0; }
    .ch-reply-preview-content .q-sender { color:#00f5d4; font-weight:600; font-size:0.75rem; }
    .ch-reply-preview-content .q-text { color:rgba(255,255,255,0.6); font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ch-reply-preview-close { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; padding:4px; border-radius:50%; display:flex; transition:all 0.2s; }
    .ch-reply-preview-close:hover { color:#f72585; background:rgba(247,37,133,0.1); }

    .ch-lp-card { display:flex; flex-direction:column; margin-top:8px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow:hidden; text-decoration:none; background:rgba(255,255,255,0.02); transition:all 0.2s; }
    .ch-lp-card:hover { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.15); }
    .ch-lp-img { width:100%; height:120px; object-fit:cover; }
    .ch-lp-info { padding:10px; display:flex; flex-direction:column; gap:4px; }
    .ch-lp-title { font-size:0.85rem; font-weight:600; color:#e2e8f0; line-height:1.2; }
    .ch-lp-desc { font-size:0.75rem; color:rgba(255,255,255,0.5); line-height:1.3; }
    .ch-lp-domain { font-size:0.65rem; color:var(--chat-accent, #00f5d4); text-transform:uppercase; letter-spacing:0.5px; }

    .ch-reactions-wrap { position:absolute; bottom:-12px; right:10px; display:flex; gap:2px; z-index:5; }
    .ch-msg.received .ch-reactions-wrap { right:auto; left:10px; }
    .ch-reaction { background:var(--chat-surface-2, #16162a); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:2px 4px; font-size:0.75rem; display:flex; align-items:center; gap:2px; box-shadow:0 2px 5px rgba(0,0,0,0.2); cursor:pointer; }
    .ch-reaction:hover { border-color:var(--chat-accent, #00f5d4); }
    .ch-reaction-count { font-size:0.65rem; color:rgba(255,255,255,0.6); font-weight:600; }
    .ch-emoji-picker { position:absolute; bottom:calc(100% + 12px); right:0; background:var(--chat-surface-2, #16162a); border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:6px 12px; display:flex; gap:12px; box-shadow:0 4px 15px rgba(0,0,0,0.3); opacity:0; pointer-events:none; transition:all 0.2s; z-index:20; }
    .ch-msg.received .ch-emoji-picker { right:auto; left:0; }
    @media(min-width: 769px) {
       .ch-bubble:hover .ch-emoji-picker { opacity:1; pointer-events:auto; transform:translateY(-5px); }
    }
    .ch-emoji-picker.visible { opacity:1 !important; pointer-events:auto !important; transform:translateY(-5px) !important; }
    .ch-emoji-opt { cursor:pointer; font-size:1.4rem; transition:transform 0.15s; padding:6px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
    .ch-emoji-opt:hover { transform:scale(1.3); background:rgba(255,255,255,0.1); }
    
    .ch-secret-btn { background:none; border:none; color:rgba(255,255,255,0.4); font-size:1.1rem; cursor:pointer; padding:4px; border-radius:50%; transition:all 0.2s; display:flex; align-items:center; justify-content:center; }
    .ch-secret-btn:hover { background:rgba(255,255,255,0.1); }
    
    .ch-drawer-wrap { position:relative; display:flex; align-items:center; flex-shrink:0; }
    .ch-drawer-btn { display:none; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.6); border-radius:8px; width:32px; height:32px; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; }
    .ch-drawer-content { display:flex; gap:4px; align-items:center; }
    
    @media(max-width:768px) { 
      .ch-msg { max-width:85%; } 
      .ch-drawer-btn { display:flex; }
      .ch-drawer-content { position:absolute; bottom:100%; left:0; transform:translateY(10px); background:var(--chat-surface-2, #16162a); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:6px; box-shadow:0 -4px 20px rgba(0,0,0,0.3); opacity:0; pointer-events:none; transition:all 0.2s ease; flex-direction:row; margin-bottom:8px; z-index:100; }
      .ch-drawer-wrap.open .ch-drawer-content { opacity:1; pointer-events:auto; transform:translateY(0); }
    }
    @keyframes chMsgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .ch-msg.sent { align-self:flex-end; align-items:flex-end; }
    .ch-msg.received { align-self:flex-start; align-items:flex-start; }
    .ch-msg-sender { font-size:0.7rem; color:rgba(0,245,212,0.6); margin-bottom:2px; padding-left:4px; font-weight:500; }
    .ch-bubble { padding:8px 12px; border-radius:14px; position:relative; word-wrap:break-word; max-width:100%; box-sizing:border-box; min-width:0; }
    .ch-msg.sent .ch-bubble { background:var(--ch-sent-bg, linear-gradient(135deg,rgba(0,245,212,0.12),rgba(0,212,170,0.08))); border:var(--ch-sent-border, 1px solid rgba(0,245,212,0.1)); border-bottom-right-radius:4px; transition:all 0.3s; }
    .ch-msg.received .ch-bubble { background:var(--ch-recv-bg, rgba(255,255,255,0.04)); border:var(--ch-recv-border, 1px solid rgba(255,255,255,0.06)); border-bottom-left-radius:4px; transition:all 0.3s; }
    .ch-msg-text { font-size:0.88rem; line-height:1.4; white-space:pre-wrap; }
    .ch-msg-time { font-size:0.65rem; color:rgba(255,255,255,0.25); margin-top:4px; text-align:right; }
    .ch-msg-progress { height:2px; background:rgba(0,245,212,0.15); border-radius:1px; margin-top:4px; overflow:hidden; }
    .ch-msg-progress-bar { height:100%; background:#00f5d4; border-radius:1px; transition:width 1s linear; }

    .ch-msg-img { max-width:280px; border-radius:10px; cursor:pointer; display:block; transition:opacity 0.2s; }
    .ch-msg-img:hover { opacity:0.9; }
    .ch-msg-video { max-width:300px; border-radius:10px; display:block; outline:none; }
    .ch-audio-player { display:flex; align-items:center; gap:8px; padding:6px 10px; background:rgba(255,255,255,0.04); border-radius:20px; min-width:200px; }
    .ch-audio-btn { background:none; border:none; color:#00f5d4; cursor:pointer; padding:4px; display:flex; }
    .ch-audio-bar-wrap { flex:1; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; cursor:pointer; }
    .ch-audio-bar { height:100%; background:#00f5d4; border-radius:2px; width:0; transition:width 0.1s; }
    .ch-audio-time { font-size:0.7rem; color:rgba(255,255,255,0.3); min-width:36px; text-align:right; }

    .ch-viewonce { display:flex; align-items:center; gap:8px; cursor:pointer; padding:8px; }
    .ch-viewonce-icon { font-size:1.5rem; }
    .ch-viewonce-text { font-size:0.85rem; color:rgba(255,255,255,0.5); font-style:italic; }
    .ch-viewonce-opened { font-style:italic; color:rgba(255,255,255,0.25); font-size:0.82rem; }

    .ch-sticker-btn { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; padding:6px; border-radius:50%; transition:all 0.2s; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.2rem; }
    .ch-sticker-btn:hover { color:#00f5d4; background:rgba(0,245,212,0.1); }
    .ch-sticker-panel { position:absolute; bottom:100%; right:0; left:0; height:250px; background:#16162a; border-top:1px solid rgba(255,255,255,0.08); border-radius:12px 12px 0 0; display:none; flex-direction:column; z-index:100; box-shadow:0 -4px 20px rgba(0,0,0,0.5); padding:10px; }
    .ch-sticker-panel.show { display:flex; animation:chMsgIn 0.2s ease; }
    .ch-sticker-grid { flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(65px, 1fr)); gap:12px; padding:4px; align-content:start; }
    .ch-sticker-item { width:100%; aspect-ratio:1; object-fit:contain; cursor:pointer; border-radius:8px; transition:transform 0.2s; background:rgba(255,255,255,0.03); }
    .ch-sticker-item:hover { transform:scale(1.1); background:rgba(255,255,255,0.08); }
    .ch-sticker-add { width:100%; aspect-ratio:1; border-radius:8px; border:2px dashed rgba(0,245,212,0.3); display:flex; align-items:center; justify-content:center; color:#00f5d4; font-size:1.5rem; cursor:pointer; transition:all 0.2s; background:rgba(0,245,212,0.05); }
    .ch-sticker-add:hover { background:rgba(0,245,212,0.15); border-color:#00f5d4; }
    .ch-msg-sticker { max-width:180px; width:100%; aspect-ratio:1; object-fit:contain; border-radius:0; background:transparent; margin:0; cursor:pointer; transition:transform 0.2s; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
    .ch-msg-sticker:hover { transform:scale(1.05); }

    .ch-input-area { position:relative; z-index:2; padding:8px 12px; background:#0d0d15; border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0; box-sizing:border-box; width:100%; max-width:100%; display:flex; flex-direction:column; gap:8px; overflow:visible; }
    .ch-input-row { display:flex; align-items:center; gap:6px; width:100%; box-sizing:border-box; }
    .ch-ttl-btn { padding:4px 10px; border-radius:16px; border:1px solid rgba(0,245,212,0.2); background:transparent; color:#00f5d4; font-size:0.72rem; font-weight:600; cursor:pointer; transition:all 0.2s; flex-shrink:0; white-space:nowrap; }
    .ch-ttl-btn:hover { background:rgba(0,245,212,0.08); }
    .ch-attach-wrap { position:relative; display:flex; align-items:center; justify-content:center; width:36px; height:36px; flex-shrink:0; }
    .ch-attach-btn { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; padding:0; border-radius:50%; transition:all 0.2s; display:flex; align-items:center; justify-content:center; width:100%; height:100%; flex-shrink:0; }
    .ch-attach-btn:hover { color:#00f5d4; }
    .ch-input { flex:1; min-width:0; box-sizing:border-box; padding:10px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.04); color:#e2e8f0; font-size:0.88rem; font-family:'Inter',sans-serif; outline:none; resize:none; max-height:100px; line-height:1.4; transition:border-color 0.2s; overflow-x:hidden; }
    .ch-input:focus { border-color:rgba(0,245,212,0.25); }
    .ch-input::placeholder { color:rgba(255,255,255,0.2); }
    .ch-send-btn, .ch-camera-btn { background:rgba(0,245,212,0.15); border:none; color:#00f5d4; cursor:pointer; width:36px; height:36px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:all 0.2s; flex-shrink:0; }
    .ch-send-btn:hover, .ch-camera-btn:hover { background:rgba(0,245,212,0.25); transform:scale(1.08); }
    .ch-cam-wrap { position:relative; display:flex; align-items:center; }
    .ch-cam-popup { position:absolute; bottom:50px; right:-10px; background:#1e1e2e; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:8px; display:none; flex-direction:column; gap:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5); z-index:100; }
    .ch-cam-popup.show { display:flex; animation:pfFadeIn 0.2s ease; }
    .cam-opt { padding:10px 16px; border-radius:8px; color:#fff; font-size:0.9rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.2s; white-space:nowrap; }
    .cam-opt:hover { background:rgba(255,255,255,0.1); }
    .ch-send-btn.recording { background:rgba(247,37,133,0.15); color:#f72585; animation:chPulse 1.5s infinite; }
    @keyframes chPulse { 0% { box-shadow:0 0 0 0 rgba(247,37,133,0.4); } 70% { box-shadow:0 0 0 10px rgba(247,37,133,0); } 100% { box-shadow:0 0 0 0 rgba(247,37,133,0); } }
    .ch-recording-ui { display:flex; align-items:center; gap:8px; flex:1; padding:10px 14px; background:rgba(247,37,133,0.05); border-radius:20px; color:#f72585; font-size:0.88rem; font-family:'Inter',sans-serif; min-width:0; overflow:hidden; }
    @media(max-width:400px) { .ch-recording-text { display:none; } .ch-recording-ui { padding:10px; } }
    .ch-recording-dot { width:8px; height:8px; background:#f72585; border-radius:50%; animation:chBlink 1s infinite; }
    @keyframes chBlink { 0%, 100% { opacity:1; } 50% { opacity:0.3; } }

    .ch-attach-menu { position:absolute; bottom:100%; left:0; background:var(--chat-surface-2, #16162a); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:4px; margin-bottom:8px; display:none; z-index:10; min-width:160px; box-shadow:0 -4px 20px rgba(0,0,0,0.3); }
    .ch-attach-menu.open { display:block; animation:chMsgIn 0.2s ease; }
    .ch-attach-option { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; cursor:pointer; font-size:0.85rem; color:#e2e8f0; transition:background 0.15s; border:none; background:none; width:100%; text-align:left; font-family:'Inter',sans-serif; }
    .ch-attach-option:hover { background:rgba(255,255,255,0.06); }

    .ch-preview { padding:10px 16px 0; background:var(--chat-surface, #0d0d15); display:flex; align-items:center; gap:10px; flex-shrink:0; max-width:100%; box-sizing:border-box; }
    .ch-preview-thumb { width:48px; height:48px; border-radius:8px; object-fit:cover; flex-shrink:0; }
    .ch-preview-info { flex:1; min-width:0; }
    .ch-preview-name { font-size:0.82rem; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ch-preview-size { font-size:0.72rem; color:rgba(255,255,255,0.3); }
    .ch-preview-viewonce { display:flex; align-items:center; gap:6px; font-size:0.78rem; color:rgba(255,255,255,0.4); cursor:pointer; flex-shrink:0; }
    .ch-preview-viewonce input { accent-color:#00f5d4; }
    .ch-preview-close { background:rgba(247,37,133,0.15); border:none; color:#f72585; cursor:pointer; padding:8px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; border-radius:50%; flex-shrink:0; width:32px; height:32px; }
    .ch-preview-close:hover { background:rgba(247,37,133,0.25); transform:scale(1.1); }
    .ch-upload-bar { height:3px; background:rgba(0,245,212,0.1); border-radius:2px; margin:6px 16px 0; overflow:hidden; }
    .ch-upload-bar-fill { height:100%; background:#00f5d4; border-radius:2px; width:0; transition:width 0.3s; }

    .ch-lightbox { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; animation:chFadeIn 0.2s ease; cursor:zoom-out; }
    @keyframes chFadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes chScaleUp { from { transform:scale(0.9); opacity:0; } to { transform:scale(1); opacity:1; } }
    .ch-lightbox img, .ch-lightbox video { max-width:95vw; max-height:95vh; object-fit:contain; border-radius:8px; animation:chScaleUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); box-shadow:0 10px 40px rgba(0,0,0,0.5); }
    .ch-lightbox-close { position:absolute; top:20px; right:20px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:44px; height:44px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:1.4rem; transition:all 0.2s; z-index:1001; }
    .ch-lightbox-close:hover { background:rgba(255,255,255,0.2); transform:scale(1.1); }

    .ch-ttl-dropdown { position:absolute; top:100%; right:0; background:#16162a; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:4px; margin-top:4px; display:none; z-index:10; box-shadow:0 4px 20px rgba(0,0,0,0.3); }
    .ch-ttl-dropdown.open { display:block; animation:chMsgIn 0.15s ease; }
    .ch-ttl-option { padding:8px 16px; border-radius:6px; cursor:pointer; font-size:0.82rem; color:rgba(255,255,255,0.6); transition:all 0.15s; white-space:nowrap; }
    .ch-ttl-option:hover { background:rgba(0,245,212,0.08); color:#00f5d4; }
    .ch-ttl-option.active { color:#00f5d4; font-weight:600; }
  `;
  document.head.appendChild(s);
}

// ─── Helpers ────────────────────────────────────────────────
function _el(tag, props = {}) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  return el;
}

function _formatAudioTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Message Rendering ──────────────────────────────────────
function _renderMessage(msg, msgId, msgsContainer) {
  const isSent = msg.senderId === _currentUser.uid;
  const wrapper = _el('div', { className: `ch-msg ${isSent ? 'sent' : 'received'}` });
  wrapper.dataset.msgId = msgId;

  // Sender name (received msgs in groups)
  if (!isSent && _memberCount > 2) {
    const senderEl = _el('div', { className: 'ch-msg-sender', textContent: msg.senderName });
    wrapper.appendChild(senderEl);
  }

  const bubble = _el('div', { className: 'ch-bubble' });

  // Render Quoted Message if exists
  if (msg.replyTo) {
    const quoted = _el('div', { className: 'ch-quoted-msg' });
    quoted.innerHTML = `<div class="q-sender">${msg.replyTo.sender}</div><div class="q-text">${msg.replyTo.text}</div>`;
    quoted.addEventListener('click', () => {
      const target = msgsContainer.querySelector(`[data-msg-id="${msg.replyTo.id}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.transition = 'background 0.3s';
        target.style.background = 'rgba(0, 245, 212, 0.2)';
        setTimeout(() => target.style.background = '', 1000);
      }
    });
    bubble.appendChild(quoted);
  }

  // View-once
  if (msg.viewOnce && msg.type !== 'text') {
    const viewedByMe = msg.viewedBy && msg.viewedBy[_currentUser.uid];
    if (viewedByMe || (isSent && Object.keys(msg.viewedBy || {}).length > 0)) {
      bubble.innerHTML = `<div class="ch-viewonce-opened">Abierto</div>`;
    } else if (isSent) {
      const typeLabel = msg.type === 'image' ? '📷 Foto' : msg.type === 'video' ? '🎥 Video' : '🎤 Audio';
      bubble.innerHTML = `<div class="ch-viewonce"><span class="ch-viewonce-icon">🔥</span><span class="ch-viewonce-text">${typeLabel} · Ver una vez</span></div>`;
    } else {
      const typeLabel = msg.type === 'image' ? '📷 Foto' : msg.type === 'video' ? '🎥 Video' : '🎤 Audio';
      bubble.innerHTML = `<div class="ch-viewonce"><span class="ch-viewonce-icon">🔥</span><span class="ch-viewonce-text">${typeLabel}</span></div>`;
      bubble.style.cursor = 'pointer';
      bubble.addEventListener('click', () => _openViewOnce(msg, msgId));
    }
  }
  // Regular media
  else if (msg.type === 'image' && msg.mediaURL) {
    const img = _el('img', { className: 'ch-msg-img', src: msg.mediaURL, alt: 'Imagen' });
    img.addEventListener('click', () => _openLightbox(msg.mediaURL, 'image'));
    bubble.appendChild(img);
  } else if (msg.type === 'sticker' && msg.mediaURL) {
    const sticker = _el('img', { className: 'ch-msg-sticker', src: msg.mediaURL });
    sticker.addEventListener('click', async (e) => {
       e.stopPropagation();
       if (confirm('¿Añadir este sticker a tus favoritos?')) {
          const { get, ref, set } = await import('../firebase.js');
          const snap = await get(ref(db, `users/${_currentUser.uid}/stickers`));
          const stickers = snap.exists() ? snap.val() : [];
          if (!stickers.includes(msg.mediaURL)) {
             stickers.push(msg.mediaURL);
             await set(ref(db, `users/${_currentUser.uid}/stickers`), stickers);
             alert('Sticker añadido correctamente.');
          } else {
             alert('Ya tienes este sticker guardado.');
          }
       }
    });
    bubble.style.background = 'transparent';
    bubble.style.boxShadow = 'none';
    bubble.style.border = 'none';
    bubble.style.padding = '0';
    bubble.appendChild(sticker);
  } else if (msg.type === 'video' && msg.mediaURL) {
    const video = _el('video', { className: 'ch-msg-video', src: msg.mediaURL, controls: true, preload: 'metadata' });
    if (msg.mediaThumbnail) video.poster = msg.mediaThumbnail;
    bubble.appendChild(video);
  } else if (msg.type === 'audio' && msg.mediaURL) {
    bubble.appendChild(_createAudioPlayer(msg.mediaURL));
  } else {
    // Text
    let displayText = msg.text;
    if (msg.isLocked) {
      displayText = '██████████';
    } else if (msg.isDistorted) {
      displayText = msg.distortedText;
    }

    const textEl = _el('div', { className: 'ch-msg-text' });
    if (msg.isLocked || msg.isDistorted) {
      textEl.textContent = displayText;
    } else {
      let escaped = displayText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      escaped = escaped.replace(/(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g, '<a href="$1" target="_blank" style="color:var(--chat-accent, #00f5d4); text-decoration:underline;" onclick="event.stopPropagation()">$1</a>');
      textEl.innerHTML = escaped;
    }
    
    if (msg.isLocked) {
      textEl.style.cursor = 'pointer';
      textEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (textEl.textContent === msg.text) return; // Already unlocked
        const pin = prompt("Introduce el PIN de 4 dígitos para leer este mensaje:");
        if (pin && btoa(pin) === msg.pinHash) {
          textEl.textContent = msg.text;
          textEl.style.cursor = 'text';
        } else if (pin) {
          const failCount = (msg.failedPins || 0) + 1;
          if (failCount >= 3) {
            alert("Has fallado el PIN 3 veces. El mensaje se ha autodestruido de forma permanente.");
            const { deleteMessage } = await import('./messages.js');
            deleteMessage(_currentConvId, msgId);
          } else {
            alert(`PIN incorrecto. Te quedan ${3 - failCount} intentos antes de que el mensaje se autodestruya.`);
            const { update } = await import('../firebase.js');
            update(ref(db, `messages/${_currentConvId}/${msgId}`), { failedPins: failCount });
          }
        }
      });
    }

    if (msg.isDistorted) {
      textEl.style.cursor = 'pointer';
      textEl.style.userSelect = 'none';
      const showReal = () => { textEl.textContent = msg.text; };
      const showFake = () => { textEl.textContent = msg.distortedText; };
      
      bubble.addEventListener('mouseenter', showReal);
      bubble.addEventListener('mouseleave', showFake);
      
      textEl.addEventListener('touchstart', showReal, { passive: true });
      textEl.addEventListener('touchend', showFake);
      textEl.addEventListener('touchcancel', showFake);
    }
    
    bubble.appendChild(textEl);

    // Link previews (Microlink)
    if (!msg.isLocked && !msg.isDistorted && !msg.viewOnce) {
      const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
      const urls = msg.text.match(urlRegex);
      if (urls && urls.length > 0) {
        const linkUrl = urls[0];
        const previewEl = _el('div', { className: 'ch-lp-wrapper' });
        previewEl.innerHTML = `<div style="font-size:0.75rem; color:rgba(255,255,255,0.4); padding:8px;">Cargando vista previa...</div>`;
        bubble.appendChild(previewEl);

        if (!_linkPreviewCache[linkUrl]) {
          _linkPreviewCache[linkUrl] = fetch(`https://api.microlink.io?url=${encodeURIComponent(linkUrl)}`)
            .then(r => r.json())
            .then(data => {
               if (data.status === 'success' && data.data) return data.data;
               throw new Error('Microlink failed');
            })
            .catch(async (e) => {
               try {
                  const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(linkUrl)}`);
                  const d = await r.json();
                  if (d && !d.error && d.title) {
                     return {
                        title: d.title,
                        description: d.author_name || '',
                        publisher: d.provider_name || new URL(linkUrl).hostname,
                        url: d.url || linkUrl,
                        image: d.thumbnail_url ? { url: d.thumbnail_url } : null
                     };
                  }
               } catch(err) {}
               console.warn("Link Preview Error:", e); 
               return null; 
            });
        }

        _linkPreviewCache[linkUrl].then(d => {
          if (!d || !d.url) {
            previewEl.innerHTML = `<div style="font-size:0.75rem; color:#f72585; padding:8px; font-style:italic;">Vista previa no disponible</div>`;
            setTimeout(() => previewEl.remove(), 3000);
            return;
          }
          previewEl.innerHTML = `
            <a href="${d.url}" target="_blank" class="ch-lp-card" onclick="event.stopPropagation()">
              ${d.image ? `<img src="${d.image.url}" class="ch-lp-img">` : ''}
              <div class="ch-lp-info">
                <div class="ch-lp-title">${d.title || d.publisher || 'Enlace'}</div>
                <div class="ch-lp-desc">${d.description ? d.description.slice(0, 60) + '...' : ''}</div>
                <div class="ch-lp-domain">${d.publisher || new URL(d.url).hostname}</div>
              </div>
            </a>
          `;
        });
      }
    }
  }

  // --- Reacciones ---
  const reactionsWrap = _el('div', { className: 'ch-reactions-wrap' });
  if (msg.reactions) {
    const counts = {};
    const myReactions = {};
    for (let uid in msg.reactions) {
      const r = msg.reactions[uid];
      counts[r] = (counts[r] || 0) + 1;
      if (uid === _currentUser.uid) myReactions[r] = true;
    }
    for (let r in counts) {
      const rEl = _el('div', { className: 'ch-reaction', innerHTML: `<span>${r}</span><span class="ch-reaction-count">${counts[r]}</span>` });
      if (myReactions[r]) {
        rEl.style.borderColor = 'var(--chat-accent, #00f5d4)';
        rEl.style.background = 'rgba(0,245,212,0.1)';
      }
      rEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        const refPath = `messages/${_currentConvId}/${msgId}/reactions/${_currentUser.uid}`;
        const { set } = await import('../firebase.js');
        if (myReactions[r]) {
          await set(ref(db, refPath), null);
        } else {
          await set(ref(db, refPath), r);
        }
      });
      reactionsWrap.appendChild(rEl);
    }
  }
  wrapper.appendChild(reactionsWrap);

  // Reaction picker
  const EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];
  const picker = _el('div', { className: 'ch-emoji-picker' });
  EMOJIS.forEach(emoji => {
    const opt = _el('span', { className: 'ch-emoji-opt', textContent: emoji });
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      picker.classList.remove('visible');
      const refPath = `messages/${_currentConvId}/${msgId}/reactions/${_currentUser.uid}`;
      const currentR = msg.reactions && msg.reactions[_currentUser.uid];
      const { set } = await import('../firebase.js');
      if (currentR === emoji) await set(ref(db, refPath), null);
      else await set(ref(db, refPath), emoji);
    });
    picker.appendChild(opt);
  });
  bubble.appendChild(picker);

  // (Touch events handled below in the wrapper logic)

  // Time
  if (msg.isEdited) {
    const editedEl = _el('span', { className: 'ch-msg-edited', textContent: 'Edited ' });
    bubble.appendChild(editedEl);
  }
  const timeEl = _el('div', { className: 'ch-msg-time', textContent: formatTimestamp(msg.timestamp) });
  
  if (isSent) {
    const checksWrap = _el('span', { className: 'ch-msg-checks', style: 'margin-left:4px; font-size:0.75rem; font-weight:bold; letter-spacing:-1px;' });
    let icon = '✓✓';
    let color = 'rgba(255,255,255,0.4)';
    const canSee = state.userData ? state.userData.canSeeReadReceipts !== false : true;

    if (canSee && msg.viewedBy) {
      let viewedByOthers = false;
      for (const uid in msg.viewedBy) {
        if (uid !== _currentUser.uid) {
           viewedByOthers = true; break;
        }
      }
      if (viewedByOthers) {
         color = 'var(--chat-accent, #00f5d4)';
      }
    }

    checksWrap.textContent = icon;
    checksWrap.style.color = color;
    timeEl.appendChild(checksWrap);
  }

  bubble.appendChild(timeEl);

  // Self-destruct bar
  if (msg.ttl && msg.expiresAt) {
    const remaining = getRemainingTime(msg.expiresAt, msg.ttl);
    if (remaining > 0) {
      const progressWrap = _el('div', { className: 'ch-msg-progress' });
      const progressBar = _el('div', { className: 'ch-msg-progress-bar' });
      progressBar.style.width = `${remaining * 100}%`;
      progressWrap.appendChild(progressBar);
      bubble.appendChild(progressWrap);
    }
  }

  // Context Menu Actions
  const actionsMenu = _el('div', { className: 'ch-msg-actions' });
  
  const triggerReply = () => {
    let previewText = msg.text || '';
    if (msg.type === 'image') previewText = '📷 Foto';
    else if (msg.type === 'video') previewText = '🎥 Video';
    else if (msg.type === 'audio') previewText = '🎤 Audio';
    else if (msg.viewOnce) previewText = '🔥 Ver una vez';
    
    _replyingTo = { id: msgId, sender: msg.senderName || 'Anónimo', text: previewText };
    
    const rp = document.querySelector('.ch-reply-preview');
    if (rp) {
      rp.querySelector('.q-sender').textContent = `Respondiendo a ${_replyingTo.sender}`;
      rp.querySelector('.q-text').textContent = _replyingTo.text;
      rp.classList.add('active');
    }
    const txt = document.querySelector('.ch-input');
    if (txt) txt.focus();
  };

  const isAdmin = _currentUser.email === 'cleivsec@gmail.com';
  const isBroadcast = _currentConvId === 'broadcast_support';

  if (!isBroadcast || isAdmin) {
    const replyBtn = _el('button', { className: 'ch-msg-action-btn', innerHTML: '↩️', title: 'Responder' });
    replyBtn.addEventListener('click', (e) => { e.stopPropagation(); triggerReply(); });
    actionsMenu.appendChild(replyBtn);
  }

  if (isSent && msg.type === 'text') {
    const timeElapsed = Date.now() - msg.timestamp;
    if (timeElapsed < 15 * 60 * 1000) { // 15 mins limit
      const editBtn = _el('button', { className: 'ch-msg-action-btn', innerHTML: '✏️', title: 'Editar' });
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _editingMsgId = msgId;
        const txt = document.querySelector('.ch-input');
        if (txt) {
          txt.value = msg.text;
          txt.focus();
          txt.style.height = 'auto';
          txt.style.height = Math.min(txt.scrollHeight, 100) + 'px';
          if (typeof _updateSendBtn === 'function') _updateSendBtn();
        }
      });
      actionsMenu.appendChild(editBtn);
    }
  }

  if (!isBroadcast || isAdmin) {
    const delBtn = _el('button', { className: 'ch-msg-action-btn ch-msg-del-btn', innerHTML: ICONS.close, title: 'Eliminar' });
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar este mensaje para todos?')) {
        const { deleteMessage } = await import('./messages.js');
        deleteMessage(_currentConvId, msgId);
      }
    });
    actionsMenu.appendChild(delBtn);
  }
  
  // Save button
  const saveBtn = _el('button', { className: 'ch-msg-action-btn', innerHTML: '⭐', title: 'Guardar/Desguardar' });
  saveBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const savedRef = ref(db, `users/${_currentUser.uid}/savedMessages/${_currentConvId}/${msgId}`);
      const snap = await get(savedRef);
      if (snap.exists()) {
        await set(savedRef, null);
      } else {
        await set(savedRef, true);
      }
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });
  actionsMenu.appendChild(saveBtn);

  bubble.appendChild(actionsMenu);

  // Swipe and Long Press
  let touchStartX = 0;
  let touchStartY = 0;
  let currentX = 0;
  let isSwiping = false;
  let longPressTimer = null;

  wrapper.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
    wrapper.style.transition = 'none';
    
    longPressTimer = setTimeout(() => {
      actionsMenu.classList.add('visible');
      picker.classList.add('visible');
    }, 500);
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (touchStartX === 0) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      clearTimeout(longPressTimer);
    }

    if (!isSwiping) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
        isSwiping = true;
      } else if (Math.abs(deltaY) > 5) {
        touchStartX = 0; // Cancel horizontal swipe if scrolling vertically
        return;
      }
    }

    if (isSwiping && deltaX > 0 && deltaX < 80) {
      currentX = deltaX;
      wrapper.style.transform = `translateX(${currentX}px)`;
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
    if (!isSwiping && currentX === 0) return;
    wrapper.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    if (currentX > 50 && (!isBroadcast || isAdmin)) {
      triggerReply();
    }
    currentX = 0;
    wrapper.style.transform = 'translateX(0)';
    touchStartX = 0;
    isSwiping = false;
  });

  // Tap anywhere outside to close actions on mobile
  document.addEventListener('touchstart', (e) => {
    if (!wrapper.contains(e.target)) {
      actionsMenu.classList.remove('visible');
      picker.classList.remove('visible');
    }
  }, { passive: true });

  wrapper.appendChild(bubble);

  msgsContainer.appendChild(wrapper);
}

function _createAudioPlayer(url) {
  const player = _el('div', { className: 'ch-audio-player' });
  const audio = new Audio(url);
  audio.preload = 'metadata';

  const playBtn = _el('button', { className: 'ch-audio-btn', innerHTML: ICONS.play });
  const barWrap = _el('div', { className: 'ch-audio-bar-wrap' });
  const bar = _el('div', { className: 'ch-audio-bar' });
  const timeEl = _el('span', { className: 'ch-audio-time', textContent: '0:00' });

  barWrap.appendChild(bar);

  let isPlaying = false;
  playBtn.addEventListener('click', () => {
    if (isPlaying) { audio.pause(); playBtn.innerHTML = ICONS.play; }
    else { audio.play(); playBtn.innerHTML = ICONS.pause; }
    isPlaying = !isPlaying;
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
      timeEl.textContent = _formatAudioTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    timeEl.textContent = _formatAudioTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    isPlaying = false;
    playBtn.innerHTML = ICONS.play;
    bar.style.width = '0';
  });

  barWrap.addEventListener('click', (e) => {
    if (audio.duration) {
      const rect = barWrap.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      audio.currentTime = ratio * audio.duration;
    }
  });

  player.appendChild(playBtn);
  player.appendChild(barWrap);
  player.appendChild(timeEl);
  return player;
}

// ─── Lightbox ───────────────────────────────────────────────
function _openLightbox(url, type) {
  const lb = _el('div', { className: 'ch-lightbox' });
  const closeBtn = _el('button', { className: 'ch-lightbox-close', textContent: '✕' });
  lb.appendChild(closeBtn);

  if (type === 'image') {
    lb.appendChild(_el('img', { src: url }));
  } else if (type === 'video') {
    lb.appendChild(_el('video', { src: url, controls: true, autoplay: true }));
  }

  const close = () => lb.remove();
  closeBtn.addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.body.appendChild(lb);
}

function _openViewOnce(msg, msgId) {
  const lb = _el('div', { className: 'ch-lightbox' });
  const closeBtn = _el('button', { className: 'ch-lightbox-close', textContent: '✕' });
  lb.appendChild(closeBtn);

  if (msg.type === 'image') {
    lb.appendChild(_el('img', { src: msg.mediaURL }));
  } else if (msg.type === 'video') {
    lb.appendChild(_el('video', { src: msg.mediaURL, controls: true, autoplay: true }));
  } else if (msg.type === 'audio') {
    lb.appendChild(_createAudioPlayer(msg.mediaURL));
  }

  const close = async () => {
    lb.remove();
    // Mark as viewed
    await markViewOnce(_currentConvId, msgId, _currentUser.uid);
    // Check if all viewed
    const snap = await get(ref(db, `messages/${_currentConvId}/${msgId}`));
    if (snap.exists()) {
      const updated = snap.val();
      if (checkAllViewed(updated, _memberCount)) {
        // Delete media and message
        if (updated.mediaPath) {
          const { deleteMedia } = await import('./media.js');
          await deleteMedia(updated.mediaPath);
        }
        await remove(ref(db, `messages/${_currentConvId}/${msgId}`));
      }
    }
    // Update bubble locally
    const bubble = document.querySelector(`[data-msg-id="${msgId}"] .ch-bubble`);
    if (bubble) bubble.innerHTML = `<div class="ch-viewonce-opened">Abierto</div><div class="ch-msg-time">${formatTimestamp(msg.timestamp)}</div>`;
  };

  closeBtn.addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });

  // Auto-close images after 5s
  if (msg.type === 'image') setTimeout(close, 5000);

  document.body.appendChild(lb);
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Plays a clean, synthetic notification sound using Web Audio API
 */
function _playNotificationSound(type = 'received') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    if (type === 'received') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) {
    console.warn('AudioContext no soportado');
  }
}

/**
 * Initialize chat for a specific conversation.
 */
export async function initChat(container, user, conversationId, options = {}) {
  // Solicitar permiso de notificaciones nativas si no se ha preguntado aún
  if (window.Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }

  destroyChat();
  _injectStyles();

  _container = container;
  _currentUser = user;
  _currentConvId = conversationId;
  _backHandler = options.onBack || null;
  _panicHandler = options.onPanic || null;
  _memberCount = options.memberCount || 2;
  _pendingFile = null;
  _viewOnce = false;
  _replyingTo = null;

  container.innerHTML = '';

  const wrap = _el('div', { className: 'ch-wrap' });

  // ── Header ──
  const header = _el('div', { className: 'ch-header' });

  const backBtn = _el('button', { className: 'ch-back', innerHTML: ICONS.back });
  backBtn.addEventListener('click', () => { if (_backHandler) _backHandler(); });

  const headerInfoWrap = _el('div', { className: 'ch-header-info-wrap', style: 'display: flex; flex-direction: column; justify-content: center; flex: 1; overflow: hidden;' });
  
  const convNameWrap = _el('div', { className: 'ch-conv-name-wrap' });
  const convName = _el('div', { className: 'ch-conv-name', textContent: 'Cargando...' });
  const editNameBtn = _el('button', { className: 'ch-edit-name', innerHTML: '✏️', title: 'Cambiar nombre local' });
  editNameBtn.style.display = 'none';
  convNameWrap.appendChild(convName);
  convNameWrap.appendChild(editNameBtn);
  
  const subtitleRow = _el('div', { style: 'display: flex; align-items: center; min-height: 14px; gap: 4px; margin-top: 2px;' });
  const onlineIndicator = _el('div', { className: 'ch-online-indicator', textContent: '', style: 'font-size:0.75rem; color:#00f5d4; font-weight: 500;' });
  const typingIndicator = _el('div', { className: 'ch-typing-indicator', textContent: 'escribiendo...', style: 'display:none; font-size:0.75rem; color:var(--chat-accent, #00f5d4); font-style:italic;' });
  subtitleRow.appendChild(onlineIndicator);
  subtitleRow.appendChild(typingIndicator);
  
  headerInfoWrap.appendChild(convNameWrap);
  headerInfoWrap.appendChild(subtitleRow);
  
  // Click listener for User Info Modal
  convNameWrap.style.cursor = 'pointer';
  convNameWrap.addEventListener('click', () => {
    if (conversationId !== 'broadcast_support') {
      _openUserInfoModal(conversationId);
    }
  });

  const badge = _el('span', { className: 'ch-badge' });

  // Fetch conversation info
  if (conversationId === 'broadcast_support') {
    convName.textContent = 'ShadowChat - Soporte';
    badge.textContent = '📢 Canal Oficial';
  } else {
    try {
      const convSnap = await get(ref(db, `conversations/${conversationId}`));
      if (convSnap.exists()) {
      const conv = convSnap.val();
      _memberCount = Object.keys(conv.members || {}).length;
      badge.textContent = `${_memberCount} miembros`;

      // Clear unread count for current user
      if (conv.unreadCount && conv.unreadCount[user.uid]) {
         update(ref(db), { [`conversations/${conversationId}/unreadCount/${user.uid}`]: null }).catch(()=>{});
      }

      if (conv.type === 'group') {
        convName.textContent = conv.name || 'Grupo';
      } else {
        const otherUid = Object.keys(conv.members || {}).find(uid => uid !== user.uid);
        if (otherUid) {
          const uSnap = await get(ref(db, `users/${otherUid}`));
          const cSnap = await get(ref(db, `users/${user.uid}/contacts/${otherUid}`));
          
          let defaultName = uSnap.exists() ? (uSnap.val().username || 'Usuario') : 'Usuario';
          let localName = cSnap.exists() ? cSnap.val() : null;
          
          convName.textContent = localName || defaultName;
          
          editNameBtn.style.display = 'block';
          editNameBtn.addEventListener('click', async () => {
             const newName = prompt('Introduce un apodo personalizado (déjalo en blanco para usar el original):', localName || '');
             if (newName !== null) {
                if (newName.trim() === '') {
                   await set(ref(db, `users/${user.uid}/contacts/${otherUid}`), null);
                   convName.textContent = defaultName;
                   localName = null;
                } else {
                   await set(ref(db, `users/${user.uid}/contacts/${otherUid}`), newName.trim());
                   convName.textContent = newName.trim();
                   localName = newName.trim();
                }
             }
          });
        } else {
          convName.textContent = 'Usuario';
        }
        badge.textContent = '';
        
        // Listen to presence
        if (otherUid) {
          const presenceRef = ref(db, `users/${otherUid}`);
          onValue(presenceRef, (snap) => {
             if (snap.exists()) {
                 const data = snap.val();
                 if (data.online) {
                     onlineIndicator.textContent = 'En línea';
                     onlineIndicator.style.color = '#00f5d4';
                 } else {
                     if (data.lastSeen) {
                         const date = new Date(data.lastSeen);
                         const isToday = new Date().toDateString() === date.toDateString();
                         const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                         onlineIndicator.textContent = `últ. vez ${isToday ? 'hoy' : date.toLocaleDateString()} a las ${time}`;
                         onlineIndicator.style.color = 'rgba(255,255,255,0.4)';
                     } else {
                         onlineIndicator.textContent = '';
                     }
                 }
             }
          });
          _listeners.push({ ref: presenceRef, type: 'value' });
        }
      }
      if (conv.expiresAt) {
          const banner = _el('div', { 
             className: 'ch-expiry-banner', 
             style: 'background:#ff3366; color:#fff; padding:8px; text-align:center; font-weight:bold; font-size:0.9rem; z-index:100; position:relative;' 
          });
          wrap.appendChild(banner);

          const checkExpiry = () => {
              const remaining = Math.max(0, conv.expiresAt - Date.now());
              if (remaining === 0) {
                  clearInterval(_expiryIntervalId);
                  banner.textContent = 'Este chat ha expirado. Autodestruyendo...';
                  setTimeout(async () => {
                      try {
                          const { deleteConversation } = await import('./messages.js');
                          await deleteConversation(conversationId);
                      } catch(e) {}
                      if (_backHandler) _backHandler();
                      setTimeout(() => { window.location.href = window.location.pathname; }, 1000);
                  }, 1000);
              } else {
                  const mins = Math.ceil(remaining / 60000);
                  banner.textContent = `⚠️ ESTE CHAT ES ANÓNIMO Y SE DESTRUIRÁ EN ${mins} MINUTO${mins !== 1 ? 'S' : ''}`;
              }
          };
          checkExpiry();
          if (_expiryIntervalId) clearInterval(_expiryIntervalId);
          _expiryIntervalId = setInterval(checkExpiry, 10000); // Check every 10s
      }

      // Listen for typing
      const typingRef = ref(db, `conversations/${conversationId}/typing`);
      onValue(typingRef, snap => {
        if (snap.exists()) {
          const typingUsers = snap.val();
          let isOtherTyping = false;
          for (let uid in typingUsers) {
            if (uid !== user.uid && Date.now() - typingUsers[uid] < 5000) {
              isOtherTyping = true;
              break;
            }
          }
          typingIndicator.style.display = isOtherTyping ? 'block' : 'none';
        } else {
          typingIndicator.style.display = 'none';
        }
      });
      _listeners.push({ ref: typingRef, type: 'value' });
      } else {
        convName.textContent = 'Conversación no encontrada';
      }
    } catch (e) {
      console.error('Error loading conv name:', e);
      convName.textContent = 'Error';
    }
  }

  const timerBtn = _el('button', { className: 'ch-hdr-btn ch-timer-btn', innerHTML: ICONS.timer, title: 'Autodestrucción: ' + getTTLOptions()[_currentTTLIndex].label });
  const panicBtn = _el('button', { className: 'ch-hdr-btn ch-panic', innerHTML: ICONS.bolt, title: 'Pánico' });
  panicBtn.addEventListener('click', () => { if (_panicHandler) _panicHandler(); });

  const hideIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;
  const hideBtn = _el('button', { className: 'ch-hdr-btn ch-hide', innerHTML: hideIcon, title: 'Limpiar pantalla' });
  
  const searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const searchBtn = _el('button', { className: 'ch-hdr-btn', innerHTML: searchIcon, title: 'Buscar mensajes' });
  
  let _isHidden = false;
  hideBtn.addEventListener('click', () => {
    _isHidden = !_isHidden;
    if (_isHidden) {
      msgsContainer.style.opacity = '0';
      msgsContainer.style.pointerEvents = 'none';
      hideBtn.style.color = '#ff3366';
    } else {
      msgsContainer.style.opacity = '1';
      msgsContainer.style.pointerEvents = 'auto';
      hideBtn.style.color = '';
    }
  });

  // TTL dropdown
  const ttlDropWrap = _el('div');
  ttlDropWrap.style.position = 'relative';
  const ttlDrop = _el('div', { className: 'ch-ttl-dropdown' });
  getTTLOptions().forEach((opt, i) => {
    const o = _el('div', { className: `ch-ttl-option${i === _currentTTLIndex ? ' active' : ''}`, textContent: opt.label });
    o.addEventListener('click', () => {
      _currentTTLIndex = i;
      ttlDrop.classList.remove('open');
      timerBtn.title = 'Autodestrucción: ' + opt.label;
      ttlDrop.querySelectorAll('.ch-ttl-option').forEach((el, j) => el.classList.toggle('active', j === i));
    });
    ttlDrop.appendChild(o);
  });
  ttlDropWrap.appendChild(ttlDrop);
  ttlDropWrap.appendChild(timerBtn);
  timerBtn.addEventListener('click', () => ttlDrop.classList.toggle('open'));

  header.appendChild(backBtn);
  header.appendChild(headerInfoWrap);
  header.appendChild(badge);
  header.appendChild(searchBtn);
  header.appendChild(hideBtn);
  header.appendChild(ttlDropWrap);
  header.appendChild(panicBtn);

  wrap.appendChild(header);
  
  // ── Search Bar ──
  const searchBar = _el('div', { className: 'ch-search-bar', style: 'display: none; padding: 10px 16px; background: #12121a; border-bottom: 1px solid rgba(255,255,255,0.06); align-items: center; gap: 10px;' });
  const searchInput = _el('input', { type: 'text', placeholder: 'Buscar palabra o YYYY-MM-DD...', style: 'flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; font-size: 0.9rem; outline: none;' });
  
  const searchNav = _el('div', { style: 'display: flex; gap: 5px;' });
  const searchUp = _el('button', { innerHTML: '▲', style: 'background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 4px 8px; border-radius: 4px; cursor: pointer;' });
  const searchDown = _el('button', { innerHTML: '▼', style: 'background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 4px 8px; border-radius: 4px; cursor: pointer;' });
  searchNav.appendChild(searchUp);
  searchNav.appendChild(searchDown);

  const searchClose = _el('button', { innerHTML: ICONS.close, style: 'background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; margin-left: 5px;' });
  
  searchBar.appendChild(searchInput);
  searchBar.appendChild(searchNav);
  searchBar.appendChild(searchClose);
  wrap.appendChild(searchBar);
  
  let _searchIsActive = false;
  let _fullHistoryCache = null;
  let _searchResults = [];
  let _searchIndex = -1;
  let _originalDOM = null; // To restore standard view
  
  searchBtn.addEventListener('click', async () => {
    _searchIsActive = !_searchIsActive;
    if (_searchIsActive) {
      searchBar.style.display = 'flex';
      if (!_fullHistoryCache) {
        searchInput.placeholder = 'Cargando historial...';
        searchInput.disabled = true;
        try {
          const snap = await get(ref(db, `messages/${conversationId}`));
          _fullHistoryCache = snap.exists() ? snap.val() : {};
        } catch(e) {}
        searchInput.disabled = false;
        searchInput.placeholder = 'Buscar palabra o YYYY-MM-DD...';
        
        // Save current DOM and render full history for contextual search
        _originalDOM = Array.from(msgsContainer.childNodes);
        msgsContainer.innerHTML = '';
        const allMsgs = Object.entries(_fullHistoryCache)
           .map(([id, msg]) => ({id, ...msg}))
           .sort((a,b) => a.timestamp - b.timestamp);
        
        allMsgs.forEach(msg => _renderMessage(msg, msg.id, msgsContainer, false));
      }
      searchInput.focus();
    } else {
      _closeSearch();
    }
  });
  
  searchClose.addEventListener('click', _closeSearch);
  
  function _closeSearch() {
    _searchIsActive = false;
    searchBar.style.display = 'none';
    searchInput.value = '';
    
    // Restore original limited DOM
    if (_originalDOM) {
      msgsContainer.innerHTML = '';
      _originalDOM.forEach(node => msgsContainer.appendChild(node));
      _originalDOM = null;
    }
    
    // Clear highlights
    msgsContainer.querySelectorAll('mark.ch-highlight').forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    
    _fullHistoryCache = null; // Free memory
    _searchResults = [];
    _searchIndex = -1;
    requestAnimationFrame(() => msgsContainer.scrollTop = msgsContainer.scrollHeight);
  }
  
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    
    // Remove existing highlights
    msgsContainer.querySelectorAll('mark.ch-highlight').forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    msgsContainer.querySelectorAll('.ch-msg').forEach(el => el.style.opacity = '1');
    
    _searchResults = [];
    _searchIndex = -1;
    
    if (!query) return;
    
    // Search in DOM
    const msgs = Array.from(msgsContainer.querySelectorAll('.ch-msg'));
    
    msgs.forEach(msgEl => {
      const textEl = msgEl.querySelector('.ch-msg-text');
      if (!textEl) return;
      
      const originalText = textEl.textContent;
      const lowerText = originalText.toLowerCase();
      
      // Also check date
      const timeEl = msgEl.querySelector('.ch-msg-time');
      const timeStr = timeEl ? timeEl.dataset.fullDate || '' : ''; // Assume we add dataset later or just check text
      
      if (lowerText.includes(query) || (timeStr && timeStr.includes(query))) {
         _searchResults.push(msgEl);
         
         // Highlight text
         if (lowerText.includes(query)) {
           const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
           textEl.innerHTML = originalText.replace(regex, '<mark class="ch-highlight" style="background:#ffdd00; color:#000; padding:0 2px; border-radius:2px;">$1</mark>');
         }
      }
    });
    
    if (_searchResults.length > 0) {
      // Go to most recent by default (which is the last one in the array)
      _searchIndex = _searchResults.length - 1;
      _jumpToSearch();
    }
  });
  
  searchUp.addEventListener('click', () => {
    if (_searchResults.length === 0) return;
    _searchIndex--;
    if (_searchIndex < 0) _searchIndex = _searchResults.length - 1;
    _jumpToSearch();
  });
  
  searchDown.addEventListener('click', () => {
    if (_searchResults.length === 0) return;
    _searchIndex++;
    if (_searchIndex >= _searchResults.length) _searchIndex = 0;
    _jumpToSearch();
  });
  
  function _jumpToSearch() {
    const el = _searchResults[_searchIndex];
    if (!el) return;
    
    // Reset opacities
    msgsContainer.querySelectorAll('.ch-msg').forEach(e => {
       e.style.opacity = _searchResults.includes(e) ? '1' : '0.4';
    });
    el.style.opacity = '1';
    
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add pulse animation
    el.style.transition = 'transform 0.3s, box-shadow 0.3s';
    el.style.transform = 'scale(1.02)';
    el.style.boxShadow = '0 0 15px rgba(255,221,0,0.5)';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
      el.style.boxShadow = 'none';
    }, 600);
  }

  // ── Messages ──
  const msgsContainer = _el('div', { className: 'ch-msgs' });
  msgsContainer.innerHTML = `<div class="ch-empty">${ICONS.ghost}<p>No hay mensajes aún...</p></div>`;
  wrap.appendChild(msgsContainer);

  // ── Preview area (hidden by default) ──
  const previewArea = _el('div', { className: 'ch-preview', id: 'ch-preview' });
  previewArea.style.display = 'none';
  wrap.appendChild(previewArea);

  // ── Upload progress ──
  const uploadBar = _el('div', { className: 'ch-upload-bar', id: 'ch-upload-bar' });
  uploadBar.style.display = 'none';
  uploadBar.innerHTML = `<div class="ch-upload-bar-fill" id="ch-upload-fill"></div>`;
  wrap.appendChild(uploadBar);

  // ── Input Area ──
  const inputArea = _el('div', { className: 'ch-input-area' });
  const inputRow = _el('div', { className: 'ch-input-row' });

  // Attach
  const attachWrap = _el('div', { className: 'ch-attach-wrap' });
  const attachBtn = _el('button', { className: 'ch-attach-btn', innerHTML: ICONS.clip });
  const attachMenu = _el('div', { className: 'ch-attach-menu' });
  attachMenu.innerHTML = `
    <button class="ch-attach-option" data-type="image">📷 Foto</button>
    <button class="ch-attach-option" data-type="video">🎥 Video</button>
    <button class="ch-attach-option" data-type="audio">🎤 Audio</button>
  `;

  const fileInput = _el('input', { type: 'file', style: 'display:none' });
  let _fileType = '';

  const accepts = {
    image: 'image/jpeg,image/png,image/webp,image/gif',
    video: 'video/mp4,video/webm',
    audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4'
  };

  attachMenu.querySelectorAll('.ch-attach-option').forEach(opt => {
    opt.addEventListener('click', () => {
      _fileType = opt.dataset.type;
      fileInput.accept = accepts[_fileType];
      fileInput.click();
      attachMenu.classList.remove('open');
    });
  });

  attachBtn.addEventListener('click', () => attachMenu.classList.toggle('open'));
  attachWrap.appendChild(attachMenu);
  attachWrap.appendChild(attachBtn);
  attachWrap.appendChild(fileInput);

  function _handleFileSelection(file, fileType) {
    if (!file) return;

    const validation = validateFile(file, fileType);
    if (!validation.valid) {
      alert(validation.error);
      fileInput.value = '';
      return;
    }

    _pendingFile = { file, type: fileType };
    _viewOnce = false;
    if (typeof _updateSendBtn === 'function') _updateSendBtn();

    // Show preview
    previewArea.style.display = 'flex';
    if (fileType === 'image') {
      const url = URL.createObjectURL(file);
      previewArea.innerHTML = `
        <img class="ch-preview-thumb" src="${url}" alt="">
        <div class="ch-preview-info"><div class="ch-preview-name">${file.name || 'Captura.png'}</div><div class="ch-preview-size">${formatFileSize(file.size)}</div></div>
        <label class="ch-preview-viewonce"><input type="checkbox" id="ch-viewonce-cb"> 🔥 Ver una vez</label>
        <button class="ch-preview-close">${ICONS.close}</button>
      `;
    } else {
      previewArea.innerHTML = `
        <div class="ch-preview-info"><div class="ch-preview-name">${fileType === 'video' ? '🎥' : '🎤'} ${file.name}</div><div class="ch-preview-size">${formatFileSize(file.size)}</div></div>
        <label class="ch-preview-viewonce"><input type="checkbox" id="ch-viewonce-cb"> 🔥 Ver una vez</label>
        <button class="ch-preview-close">${ICONS.close}</button>
      `;
    }

    previewArea.querySelector('#ch-viewonce-cb')?.addEventListener('change', (e) => { _viewOnce = e.target.checked; });
    previewArea.querySelector('.ch-preview-close').addEventListener('click', _clearPreview);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', async () => {
    _handleFileSelection(fileInput.files[0], _fileType);
  });

  document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Some browsers return files without a name or with a generic 'image.png'
          const customFile = new File([file], `Captura_${Date.now()}.png`, { type: file.type });
          _fileType = 'image';
          _handleFileSelection(customFile, 'image');
        }
        break;
      }
    }
  });

  function _clearPreview() {
    _pendingFile = null;
    _viewOnce = false;
    previewArea.style.display = 'none';
    previewArea.innerHTML = '';
    if (typeof _updateSendBtn === 'function') _updateSendBtn();
  }

  // Text input
  const textInput = _el('textarea', { className: 'ch-input', placeholder: 'Escribe un mensaje...', rows: 1 });
  const sendBtn = _el('button', { className: 'ch-send-btn', innerHTML: ICONS.mic });

  const _updateSendBtn = () => {
    if (window._isRecording) return;
    if (textInput.value.trim().length > 0 || _pendingFile) {
      sendBtn.innerHTML = ICONS.send;
    } else {
      sendBtn.innerHTML = ICONS.mic;
    }
  };

  let _typingTimeout = null;

  textInput.addEventListener('input', () => {
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 100) + 'px';
    _updateSendBtn();

    // Typing indicator
    if (_currentConvId && _currentUser) {
      set(ref(db, `conversations/${_currentConvId}/typing/${_currentUser.uid}`), Date.now());
      clearTimeout(_typingTimeout);
      _typingTimeout = setTimeout(() => {
        set(ref(db, `conversations/${_currentConvId}/typing/${_currentUser.uid}`), null);
      }, 2000);
    }
  });
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
  });

  // Recording State
  window._isRecording = false;
  let _mediaRecorder = null;
  let _audioChunks = [];
  let _recInterval = null;
  const recordingUI = _el('div', { className: 'ch-recording-ui' });
  recordingUI.style.display = 'none';
  recordingUI.innerHTML = `<div class="ch-recording-dot"></div><span class="ch-recording-text">Grabando...</span><canvas id="ch-wave-canvas" width="80" height="24" style="margin-left:auto; width:100%; max-width:80px;"></canvas>`;
  const recTime = _el('span', { textContent: ' 0:00', style: 'margin-left:8px; flex-shrink:0;' });
  recordingUI.appendChild(recTime);

  async function _toggleRecording() {
    if (window._isRecording) {
      _mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _mediaRecorder = new MediaRecorder(stream);
      _audioChunks = [];

      // Setup Web Audio API for waveform
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const canvas = recordingUI.querySelector('#ch-wave-canvas');
      const canvasCtx = canvas.getContext('2d');
      let animationId;

      const draw = () => {
        if (!window._isRecording) return;
        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for(let i = 0; i < bufferLength; i++) {
          const barHeight = Math.max(2, (dataArray[i] / 255) * canvas.height);
          canvasCtx.fillStyle = 'var(--chat-accent, #00f5d4)'; // Change to cyan to match theme
          canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      };

      _mediaRecorder.addEventListener('dataavailable', e => {
        if (e.data.size > 0) _audioChunks.push(e.data);
      });

      _mediaRecorder.addEventListener('stop', async () => {
        window._isRecording = false;
        clearInterval(_recInterval);
        cancelAnimationFrame(animationId);
        try { audioCtx.close(); } catch(e){}
        stream.getTracks().forEach(t => t.stop());

        textInput.style.display = '';
        const camBtn = document.querySelector('.ch-camera-btn');
        if (camBtn) camBtn.style.display = '';
        recordingUI.style.display = 'none';
        recordingUI.remove();
        sendBtn.classList.remove('recording');
        _updateSendBtn();

        const audioBlob = new Blob(_audioChunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `Audio_${Date.now()}.webm`, { type: 'audio/webm' });
        _pendingFile = { file, type: 'audio' };
        
        _send(); // auto-send
      });

      _mediaRecorder.start();
      window._isRecording = true;
      draw();

      textInput.style.display = 'none';
      const camBtn = document.querySelector('.ch-camera-btn');
      if (camBtn) camBtn.style.display = 'none';
      inputRow.insertBefore(recordingUI, sendBtn);
      recordingUI.style.display = 'flex';
      sendBtn.innerHTML = ICONS.stop;
      sendBtn.classList.add('recording');

      let secs = 0;
      recTime.textContent = '0:00';
      _recInterval = setInterval(() => {
        secs++;
        recTime.textContent = _formatAudioTime(secs);
      }, 1000);

    } catch (err) {
      console.error('Mic error:', err);
      alert('Debes permitir el acceso al micrófono para grabar audio.');
    }
  }

  sendBtn.addEventListener('click', () => {
    if (window._isRecording || (!textInput.value.trim() && !_pendingFile)) {
      _toggleRecording();
    } else {
      _send();
    }
  });

  // Secret Features State
  let _isLocked = false;
  let _isDistorted = false;

  const lockBtn = _el('button', { className: 'ch-secret-btn', innerHTML: '🔓' });
  lockBtn.addEventListener('click', () => {
    _isLocked = !_isLocked;
    lockBtn.innerHTML = _isLocked ? '🔒' : '🔓';
    lockBtn.style.color = _isLocked ? '#f72585' : '';
  });

  const maskBtn = _el('button', { className: 'ch-secret-btn', innerHTML: '🎭' });
  maskBtn.addEventListener('click', () => {
    _isDistorted = !_isDistorted;
    maskBtn.style.color = _isDistorted ? '#00f5d4' : '';
  });

  const drawerWrap = _el('div', { className: 'ch-drawer-wrap' });
  const drawerBtn = _el('button', { className: 'ch-drawer-btn', innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>` });
  const drawerContent = _el('div', { className: 'ch-drawer-content' });
  
  drawerContent.appendChild(attachWrap);
  drawerContent.appendChild(maskBtn);
  drawerContent.appendChild(lockBtn);
  
  drawerWrap.appendChild(drawerBtn);
  drawerWrap.appendChild(drawerContent);
  
  drawerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    drawerWrap.classList.toggle('open');
    if (drawerWrap.classList.contains('open')) {
      drawerBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
    } else {
      drawerBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    }
  });

  document.addEventListener('click', (e) => {
    if (!drawerWrap.contains(e.target)) {
      drawerWrap.classList.remove('open');
      drawerBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    }
  });

  inputRow.appendChild(drawerWrap);
  
  // ── Sticker Panel ──
  const stickerWrap = _el('div', { style: 'position:relative; display:flex; align-items:center; flex-shrink:0;' });
  const stickerBtn = _el('button', { className: 'ch-sticker-btn', innerHTML: ICONS.sticker });
  const stickerPanel = _el('div', { className: 'ch-sticker-panel' });
  const stickerGrid = _el('div', { className: 'ch-sticker-grid' });
  
  const stickerInput = _el('input', { type: 'file', accept: 'image/png, image/webp, image/jpeg, image/gif', style: 'display:none' });
  const addStickerBtn = _el('div', { className: 'ch-sticker-add', innerHTML: '+' });
  
  stickerPanel.appendChild(stickerGrid);
  stickerWrap.appendChild(stickerBtn);
  inputArea.appendChild(stickerPanel);
  stickerWrap.appendChild(stickerInput);
  
  stickerBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    stickerPanel.classList.toggle('show');
    if (stickerPanel.classList.contains('show')) {
      _loadStickers();
    }
  });

  document.addEventListener('click', (e) => {
    if (!stickerWrap.contains(e.target) && !stickerPanel.contains(e.target)) {
      stickerPanel.classList.remove('show');
    }
  });

  addStickerBtn.addEventListener('click', () => {
    stickerInput.click();
  });

  stickerInput.addEventListener('change', async () => {
    const file = stickerInput.files[0];
    if (!file) return;
    stickerInput.value = '';
    
    addStickerBtn.innerHTML = '<div style="width:20px;height:20px;border:2px solid #00f5d4;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>';
    try {
      const { uploadMedia } = await import('./media.js');
      const media = await uploadMedia(file, 'image');
      if (media && media.url) {
        const snap = await get(ref(db, `users/${user.uid}/stickers`));
        let stickers = snap.exists() ? snap.val() : [];
        stickers = stickers.filter(s => typeof s === 'string' && s.startsWith('http'));
        stickers.unshift(media.url);
        await set(ref(db, `users/${user.uid}/stickers`), stickers);
        _loadStickers();
      }
    } catch(err) {
      alert("Error subiendo sticker: " + err.message);
    }
    addStickerBtn.innerHTML = '+';
  });

  async function _loadStickers() {
    stickerGrid.innerHTML = '';
    stickerGrid.appendChild(addStickerBtn);
    const snap = await get(ref(db, `users/${user.uid}/stickers`));
    if (snap.exists()) {
      const rawStickers = snap.val();
      const urls = Array.isArray(rawStickers) ? rawStickers.filter(s => typeof s === 'string' && s.startsWith('http')) : [];
      urls.forEach((url, idx) => {
        const img = _el('img', { className: 'ch-sticker-item', src: url });
        
        img.addEventListener('click', () => {
          stickerPanel.classList.remove('show');
          _sendSticker(url);
        });

        const deleteSticker = async (e) => {
           if (e && e.preventDefault) e.preventDefault();
           if (Date.now() - (img.dataset.lastDel || 0) < 1000) return;
           img.dataset.lastDel = Date.now();
           if (confirm('¿Eliminar este sticker?')) {
             const newArr = urls.filter((_, i) => i !== idx);
             await set(ref(db, `users/${user.uid}/stickers`), newArr);
             _loadStickers();
           }
        };

        let timer;
        img.addEventListener('touchstart', () => {
          timer = setTimeout(deleteSticker, 600);
        }, { passive: true });
        img.addEventListener('touchend', () => clearTimeout(timer));
        img.addEventListener('touchcancel', () => clearTimeout(timer));
        img.addEventListener('touchmove', () => clearTimeout(timer));
        
        img.addEventListener('contextmenu', deleteSticker);

        stickerGrid.appendChild(img);
      });
    }
  }

  async function _sendSticker(url) {
    if (isMuted) return;
    try {
      const opts = { type: 'sticker', mediaURL: url };
      if (_replyingTo) opts.replyTo = _replyingTo;
      
      await sendMessage(conversationId, '', user, getTTLOptions()[_currentTTLIndex].value, opts);
      _replyingTo = null;
      document.querySelector('.ch-reply-preview')?.classList.remove('active');
    } catch(err) {
      alert("Error enviando sticker");
    }
  }

  const camWrap = _el('div', { className: 'ch-cam-wrap' });
  const cameraBtn = _el('button', { className: 'ch-camera-btn', innerHTML: ICONS.camera });
  const camPopup = _el('div', { 
    className: 'ch-cam-popup',
    innerHTML: `
      <div class="cam-opt" id="opt-photo">📸 Hacer foto</div>
      <div class="cam-opt" id="opt-video">🎥 Grabar vídeo</div>
    `
  });
  
  const cameraInput = _el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
  const videoInput = _el('input', { type: 'file', accept: 'video/*', capture: 'environment', style: 'display:none' });
  
  camWrap.appendChild(cameraBtn);
  camWrap.appendChild(camPopup);
  camWrap.appendChild(cameraInput);
  camWrap.appendChild(videoInput);

  cameraBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    camPopup.classList.toggle('show');
  });
  
  document.addEventListener('click', (e) => {
    if (!camWrap.contains(e.target)) {
      camPopup.classList.remove('show');
    }
  });

  camPopup.querySelector('#opt-photo').addEventListener('click', () => {
    camPopup.classList.remove('show');
    cameraInput.click();
  });

  camPopup.querySelector('#opt-video').addEventListener('click', () => {
    camPopup.classList.remove('show');
    videoInput.click();
  });
  
  cameraInput.addEventListener('change', async () => {
    _fileType = 'image';
    _handleFileSelection(cameraInput.files[0], 'image');
    cameraInput.value = '';
  });

  videoInput.addEventListener('change', async () => {
    _fileType = 'video';
    _handleFileSelection(videoInput.files[0], 'video');
    videoInput.value = '';
  });

  inputRow.appendChild(stickerWrap);
  inputRow.appendChild(textInput);
  inputRow.appendChild(camWrap);
  inputRow.appendChild(sendBtn);

  const uSnap = await get(ref(db, `users/${user.uid}`));
  const isMuted = uSnap.exists() && uSnap.val().muted === true;

  // ── Reply Preview ──
  const replyPreview = _el('div', { className: 'ch-reply-preview' });
  const replyContent = _el('div', { className: 'ch-reply-preview-content' });
  replyContent.innerHTML = `<div class="q-sender"></div><div class="q-text"></div>`;
  const replyClose = _el('button', { className: 'ch-reply-preview-close', innerHTML: ICONS.close });
  
  replyClose.addEventListener('click', () => {
    _replyingTo = null;
    replyPreview.classList.remove('active');
  });

  replyPreview.appendChild(replyContent);
  replyPreview.appendChild(replyClose);

  if (isMuted) {
    inputArea.innerHTML = `<div style="text-align:center; color:#f72585; font-size:0.85rem; padding:4px; font-family:'Inter',sans-serif;">🚫 Has sido silenciado por un administrador.</div>`;
  } else if (conversationId === 'broadcast_support' && user.email !== 'cleivsec@gmail.com') {
    inputArea.innerHTML = `<div style="text-align:center; color:#00f5d4; font-size:0.85rem; padding:8px; font-family:'Inter',sans-serif; font-weight:500;">📢 Solo los administradores pueden enviar mensajes en este canal.</div>`;
  } else {
    inputArea.appendChild(replyPreview);
    inputArea.appendChild(inputRow);
  }

  wrap.appendChild(inputArea);
  container.appendChild(wrap);

  let _isSending = false;

  // ── Send logic ──
  async function _send() {
    if (isMuted || _isSending) return;
    
    const text = textInput.value.trim();

    let pinHash = null;
    if (_isLocked && text) {
      // Small timeout to prevent Enter keydown from re-triggering immediately
      await new Promise(r => setTimeout(r, 10)); 
      
      _isSending = true;
      const pin = prompt("Introduce un PIN de 4 dígitos para bloquear este mensaje:");
      if (!pin || pin.length < 4) {
        alert("PIN inválido. El mensaje no se enviará.");
        _isSending = false;
        return;
      }
      pinHash = btoa(pin); // Simple encode for covert ops
    } else {
      _isSending = true;
    }

    let distText = null;
    if (_isDistorted && text) {
      const phrases = ["Ayer compré pan", "¿Viste el partido?", "Qué buen tiempo hace", "Tengo que ir al súper", "Luego te llamo", "Se me ha hecho tarde"];
      distText = phrases[Math.floor(Math.random() * phrases.length)];
    }

    if (_editingMsgId) {
      if (!text) {
        _isSending = false;
        return;
      }
      try {
        await update(ref(db, `messages/${conversationId}/${_editingMsgId}`), {
          text: text,
          isEdited: true
        });
        _editingMsgId = null;
        textInput.value = '';
        textInput.style.height = 'auto';
        const rp = document.querySelector('.ch-reply-preview');
        if (rp) rp.classList.remove('active');
        if (typeof _updateSendBtn === 'function') _updateSendBtn();
      } catch(e) {
        console.error("Edit error:", e);
      }
      _isSending = false;
      return;
    }

    const ttl = getTTLOptions()[_currentTTLIndex].value;

    if (_pendingFile) {
      // Upload media, then send
      const uploadBarEl = document.getElementById('ch-upload-bar');
      const uploadFill = document.getElementById('ch-upload-fill');
      uploadBarEl.style.display = '';
      uploadFill.style.width = '0';

      try {
        let thumbnail = null;
        if (_pendingFile.type === 'image') {
          try { thumbnail = await generateThumbnail(_pendingFile.file); } catch (e) {}
        }

        const result = await uploadMedia(_pendingFile.file, conversationId, (p) => {
          uploadFill.style.width = p + '%';
        });

        await sendMessage(conversationId, text, user, ttl, {
          type: _pendingFile.type,
          mediaURL: result.url,
          mediaPath: result.path,
          mediaThumbnail: thumbnail,
          viewOnce: _viewOnce,
          replyTo: _replyingTo,
          isLocked: _isLocked,
          pinHash: pinHash,
          isDistorted: _isDistorted,
          distortedText: distText
        });
      } catch (error) {
        console.error('[Chat] Upload error:', error);
        alert('Error al subir el archivo');
      }

      uploadBarEl.style.display = 'none';
      _clearPreview();
    } else if (text) {
      await sendMessage(conversationId, text, user, ttl, { 
        replyTo: _replyingTo,
        isLocked: _isLocked,
        pinHash: pinHash,
        isDistorted: _isDistorted,
        distortedText: distText
      });
    } else {
      _isSending = false;
      return; // Nothing to send
    }

    _replyingTo = null;
    _isLocked = false;
    _isDistorted = false;
    lockBtn.innerHTML = '🔓';
    lockBtn.style.color = '';
    maskBtn.style.color = '';
    
    replyPreview.classList.remove('active');
    textInput.value = '';
    textInput.style.height = 'auto';
    if (typeof _updateSendBtn === 'function') _updateSendBtn();
    
    _isSending = false;
  }

  // ── Firebase Listeners ──
  let firstLoad = true;
  const msgsRef = ref(db, `messages/${conversationId}`);
  const msgsQuery = query(msgsRef, limitToLast(50));

  const addedUnsub = onChildAdded(msgsQuery, (snapshot) => {
    const msg = snapshot.val();
    if (!msg) return;

    // Clear empty state
    const empty = msgsContainer.querySelector('.ch-empty');
    if (empty) empty.remove();

    _renderMessage(msg, snapshot.key, msgsContainer);

    // Alertas de Sonido y Notificaciones
    if (!firstLoad) {
      console.log(`[DEBUG] Nuevo mensaje detectado. msg.senderId: ${msg.senderId}, _currentUser.uid: ${_currentUser.uid}`);
      if (msg.senderId !== _currentUser.uid) {
        console.log(`[DEBUG] Reproduciendo sonido porque el senderId es diferente al current user.`);
        _playNotificationSound('received');

        // Clear unread count since user is already in the chat
        update(ref(db), { [`conversations/${conversationId}/unreadCount/${_currentUser.uid}`]: null }).catch(()=>{});
        
        if (document.hidden && window.Notification && Notification.permission === 'granted') {
          const notif = new Notification('Nuevo mensaje en ShadowChat', {
            body: 'Has recibido un nuevo mensaje secreto.',
            icon: './icon.jpg'
          });
          notif.onclick = () => window.focus();
        }
      }
    }

    // Auto-scroll
    const isNearBottom = msgsContainer.scrollHeight - msgsContainer.scrollTop - msgsContainer.clientHeight < 150;
    if (isNearBottom || firstLoad) {
      requestAnimationFrame(() => msgsContainer.scrollTop = msgsContainer.scrollHeight);
    }
  });
  _listeners.push({ ref: msgsQuery, type: 'child_added' });

  const removedUnsub = onChildRemoved(msgsQuery, (snapshot) => {
    const el = msgsContainer.querySelector(`[data-msg-id="${snapshot.key}"]`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.9)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }
  });
  _listeners.push({ ref: msgsQuery, type: 'child_removed' });

  const changedUnsub = onChildChanged(msgsQuery, (snapshot) => {
    const msg = snapshot.val();
    const el = msgsContainer.querySelector(`[data-msg-id="${snapshot.key}"]`);
    if (el && msg) {
      // Re-render message bubble content
      const bubble = el.querySelector('.ch-bubble');
      if (bubble) {
        if (msg.type === 'text') {
           const textEl = bubble.querySelector('.ch-msg-text');
           if (textEl) textEl.textContent = msg.text;
           
           if (msg.isEdited) {
             let editedEl = bubble.querySelector('.ch-msg-edited');
             if (!editedEl) {
               editedEl = document.createElement('span');
               editedEl.className = 'ch-msg-edited';
               editedEl.textContent = 'Edited ';
               const timeEl = bubble.querySelector('.ch-msg-time');
               if (timeEl) {
                 bubble.insertBefore(editedEl, timeEl);
               } else {
                 bubble.appendChild(editedEl);
               }
             }
           }
        }
      }
    }
  });
  _listeners.push({ ref: msgsQuery, type: 'child_changed' });

  // Progress bar updater
  _progressIntervalId = setInterval(() => {
    msgsContainer.querySelectorAll('.ch-msg-progress-bar').forEach(bar => {
      const msgEl = bar.closest('[data-msg-id]');
      if (!msgEl) return;
      // Reduce width gradually (visual only, actual cleanup is server-side)
      const current = parseFloat(bar.style.width) || 0;
      if (current > 0) bar.style.width = Math.max(0, current - 0.5) + '%';
    });
  }, 1000);

  // Cleanup interval
  _cleanupIntervalId = startCleanupInterval(conversationId);

  setTimeout(() => { firstLoad = false; }, 2000);

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    if (!attachWrap.contains(e.target)) attachMenu.classList.remove('open');
    if (!ttlDropWrap.contains(e.target)) ttlDrop.classList.remove('open');
  });
}

/**
 * User Info Modal
 */
async function _openUserInfoModal(conversationId) {
  const userObj = auth.currentUser;
  if (!userObj) return;

  const convSnap = await get(ref(db, `conversations/${conversationId}`));
  if (!convSnap.exists()) return;
  const conv = convSnap.val();
  
  if (conv.type === 'group') {
    alert("Perfiles de grupo aún no disponibles.");
    return;
  }
  
  const otherUid = Object.keys(conv.members || {}).find(uid => uid !== userObj.uid);
  if (!otherUid) return;
  
  const [uSnap, cSnap, msgsSnap, savedSnap] = await Promise.all([
    get(ref(db, `users/${otherUid}`)),
    get(ref(db, `users/${userObj.uid}/contacts/${otherUid}`)),
    get(ref(db, `messages/${conversationId}`)),
    get(ref(db, `users/${userObj.uid}/savedMessages/${conversationId}`))
  ]);
  
  const userData = uSnap.exists() ? uSnap.val() : {};
  const localName = cSnap.exists() ? cSnap.val() : null;
  const savedMsgs = savedSnap.exists() ? savedSnap.val() : {};
  
  const displayName = localName || userData.username || 'Usuario';
  const usernameStr = userData.username ? `@${userData.username}` : '@usuario';
  const emailStr = userData.email || 'Oculto';
  const avatarUrl = userData.photoURL || null;
  
  const mediaItems = [];
  const voiceItems = [];
  const linkItems = [];
  const savedItems = [];
  
  if (msgsSnap.exists()) {
    Object.entries(msgsSnap.val()).forEach(([id, msg]) => {
       msg.id = id;
       // Media
       if (msg.mediaURL && (msg.type === 'image' || msg.type === 'video')) mediaItems.push(msg);
       // Voice
       if (msg.mediaURL && msg.type === 'audio') voiceItems.push(msg);
       // Links
       if (msg.type === 'text' && msg.text && msg.text.match(/https?:\/\/[^\s]+/g)) {
         linkItems.push({ ...msg, links: msg.text.match(/https?:\/\/[^\s]+/g) });
       }
       // Saved
       if (savedMsgs[id]) savedItems.push(msg);
    });
  }
  
  // Sort descending
  [mediaItems, voiceItems, linkItems, savedItems].forEach(arr => arr.sort((a,b) => b.timestamp - a.timestamp));
  
  // Create UI
  const overlay = document.createElement('div');
  overlay.className = 'ch-user-info-modal';
  
  // Header
  const header = document.createElement('div');
  header.className = 'ch-uinfo-header';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.close;
  closeBtn.onclick = () => overlay.remove();
  const title = document.createElement('h2');
  title.textContent = 'User Info';
  header.appendChild(closeBtn);
  header.appendChild(title);
  
  // Profile
  const profileSec = document.createElement('div');
  profileSec.className = 'ch-uinfo-profile';
  const avatar = document.createElement('div');
  avatar.className = 'ch-uinfo-avatar';
  if (avatarUrl) {
    avatar.style.backgroundImage = `url(${avatarUrl})`;
  } else {
    avatar.textContent = displayName.charAt(0).toUpperCase();
  }
  const nameEl = document.createElement('h3');
  nameEl.textContent = displayName;
  const statusEl = document.createElement('p');
  statusEl.className = 'ch-uinfo-status';
  statusEl.innerHTML = '<span class="ch-uinfo-dots">•••</span> online'; // We could listen to real status, static for now
  
  profileSec.appendChild(avatar);
  profileSec.appendChild(nameEl);
  profileSec.appendChild(statusEl);
  
  // Info Card
  const infoCard = document.createElement('div');
  infoCard.className = 'ch-uinfo-card';
  
  // Email Row (replaces phone)
  const emailRow = document.createElement('div');
  emailRow.className = 'ch-uinfo-row';
  emailRow.innerHTML = `
    <div class="ch-uinfo-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></div>
    <div class="ch-uinfo-text">
      <div class="ch-uinfo-val">${emailStr}</div>
      <div class="ch-uinfo-lbl">Email</div>
    </div>
  `;
  
  // Username Row
  const userRow = document.createElement('div');
  userRow.className = 'ch-uinfo-row';
  userRow.innerHTML = `
    <div class="ch-uinfo-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg></div>
    <div class="ch-uinfo-text">
      <div class="ch-uinfo-val">${usernameStr}</div>
      <div class="ch-uinfo-lbl">Username</div>
    </div>
    <div class="ch-uinfo-qr"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></div>
  `;
  
  // Notif Row
  const notifRow = document.createElement('div');
  notifRow.className = 'ch-uinfo-row';
  notifRow.innerHTML = `
    <div class="ch-uinfo-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></div>
    <div class="ch-uinfo-text" style="flex:1;">
      <div class="ch-uinfo-val">Notifications</div>
    </div>
    <div class="ch-uinfo-toggle active"><div class="ch-uinfo-toggle-knob"></div></div>
  `;
  
  infoCard.appendChild(emailRow);
  infoCard.appendChild(userRow);
  infoCard.appendChild(notifRow);
  
  // Tabs
  const tabs = document.createElement('div');
  tabs.className = 'ch-uinfo-tabs';
  tabs.innerHTML = `
    <div class="ch-uinfo-tab active" data-tab="media">Media</div>
    <div class="ch-uinfo-tab" data-tab="saved">Saved</div>
    <div class="ch-uinfo-tab" data-tab="links">Links</div>
    <div class="ch-uinfo-tab" data-tab="voice">Voice</div>
  `;
  
  const contentArea = document.createElement('div');
  contentArea.className = 'ch-uinfo-content';
  contentArea.style.flex = '1';
  
  const _renderEmpty = () => `<div style="text-align:center; padding: 40px 20px; color:rgba(255,255,255,0.4);">no se han encontrado mensajes</div>`;
  
  const _renderTab = (tabName) => {
    contentArea.innerHTML = '';
    
    if (tabName === 'media') {
      const grid = document.createElement('div');
      grid.className = 'ch-uinfo-media-grid';
      if (mediaItems.length === 0) {
        grid.innerHTML = _renderEmpty();
        grid.style.display = 'block';
      } else {
        mediaItems.forEach(m => {
          const el = document.createElement('div');
          el.className = 'ch-uinfo-media-item';
          if (m.type === 'video') {
             el.innerHTML = `<video src="${m.mediaURL}" muted loop></video>`;
             el.onmouseenter = () => el.querySelector('video').play().catch(()=>{});
             el.onmouseleave = () => el.querySelector('video').pause();
          } else {
             el.style.backgroundImage = `url(${m.mediaURL})`;
          }
          grid.appendChild(el);
        });
      }
      contentArea.appendChild(grid);
    } 
    else if (tabName === 'saved') {
      const list = document.createElement('div');
      list.style.padding = '16px';
      if (savedItems.length === 0) list.innerHTML = _renderEmpty();
      else {
        savedItems.forEach(m => {
          const el = document.createElement('div');
          el.style.padding = '12px';
          el.style.background = 'rgba(255,255,255,0.05)';
          el.style.borderRadius = '8px';
          el.style.marginBottom = '8px';
          el.innerHTML = `<div style="color:rgba(255,255,255,0.5); font-size:0.75rem; margin-bottom:4px;">${new Date(m.timestamp).toLocaleString()}</div><div>${m.text || (m.type === 'image' ? '📷 Foto' : m.type === 'audio' ? '🎤 Audio' : '🎥 Video')}</div>`;
          list.appendChild(el);
        });
      }
      contentArea.appendChild(list);
    }
    else if (tabName === 'links') {
      const list = document.createElement('div');
      list.style.padding = '16px';
      if (linkItems.length === 0) list.innerHTML = _renderEmpty();
      else {
        linkItems.forEach(m => {
          m.links.forEach(l => {
            const el = document.createElement('a');
            el.href = l;
            el.target = '_blank';
            el.style.display = 'block';
            el.style.padding = '12px';
            el.style.background = 'rgba(255,255,255,0.05)';
            el.style.borderRadius = '8px';
            el.style.marginBottom = '8px';
            el.style.color = '#00f5d4';
            el.style.textDecoration = 'none';
            el.style.wordBreak = 'break-all';
            el.textContent = l;
            list.appendChild(el);
          });
        });
      }
      contentArea.appendChild(list);
    }
    else if (tabName === 'voice') {
      const list = document.createElement('div');
      list.style.padding = '16px';
      if (voiceItems.length === 0) list.innerHTML = _renderEmpty();
      else {
        voiceItems.forEach(m => {
          const el = document.createElement('div');
          el.style.padding = '12px';
          el.style.background = 'rgba(255,255,255,0.05)';
          el.style.borderRadius = '8px';
          el.style.marginBottom = '8px';
          el.innerHTML = `<div style="color:rgba(255,255,255,0.5); font-size:0.75rem; margin-bottom:4px;">${new Date(m.timestamp).toLocaleString()}</div><audio src="${m.mediaURL}" controls style="width:100%; height:32px;"></audio>`;
          list.appendChild(el);
        });
      }
      contentArea.appendChild(list);
    }
  };
  
  tabs.querySelectorAll('.ch-uinfo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.ch-uinfo-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _renderTab(tab.dataset.tab);
    });
  });
  
  // Render default
  _renderTab('media');
  
  overlay.appendChild(header);
  overlay.appendChild(profileSec);
  overlay.appendChild(infoCard);
  overlay.appendChild(tabs);
  overlay.appendChild(contentArea);
  
  document.body.appendChild(overlay);
  
  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });
}

/**
 * Destroys the chat and cleans up all listeners.
 */
export function destroyChat() {
  _listeners.forEach(l => { try { off(l.ref, l.type); } catch (e) {} });
  _listeners = [];
  if (_cleanupIntervalId) { stopCleanupInterval(_cleanupIntervalId); _cleanupIntervalId = null; }
  if (_progressIntervalId) { clearInterval(_progressIntervalId); _progressIntervalId = null; }
  if (_expiryIntervalId) { clearInterval(_expiryIntervalId); _expiryIntervalId = null; }
  _currentConvId = null;
  if (_progressIntervalId) { clearInterval(_progressIntervalId); _progressIntervalId = null; }
  _currentConvId = null;
  _pendingFile = null;
  _replyingTo = null;
  if (_container) _container.innerHTML = '';
}

export function setPanicHandler(handler) { _panicHandler = handler; }
export function setBackHandler(handler) { _backHandler = handler; }
