// =============================================================================
// messages.js — Message management with multimedia + view-once (ShadowChat 2.0)
// =============================================================================

import { db, ref, push, set, get, remove, update } from '../firebase.js';
import { deleteMedia } from './media.js';

/**
 * Creates a message object with multimedia and view-once support.
 */
export function createMessage(text, user, ttlMs, options = {}) {
  const now = Date.now();
  return {
    text: text || '',
    senderId: user.uid,
    senderName: user.displayName || 'Anónimo',
    senderPhoto: user.photoURL || null,
    timestamp: now,
    type: options.type || 'text',
    mediaURL: options.mediaURL || null,
    mediaPath: options.mediaPath || null,
    mediaThumbnail: options.mediaThumbnail || null,
    viewOnce: options.viewOnce || false,
    replyTo: options.replyTo || null,
    isLocked: options.isLocked || false,
    pinHash: options.pinHash || null,
    isDistorted: options.isDistorted || false,
    distortedText: options.distortedText || null,
    viewedBy: {},
    ttl: ttlMs,
    expiresAt: ttlMs > 0 ? now + ttlMs : null
  };
}

/**
 * Sends a message to a specific conversation.
 */
export async function sendMessage(conversationId, text, user, ttlMs, options = {}) {
  const msgObj = createMessage(text, user, ttlMs, options);
  const msgRef = push(ref(db, `messages/${conversationId}`));

  // Determine preview text for lastMessage
  let previewText = text;
  if (options.type === 'image') previewText = '📷 Foto';
  else if (options.type === 'video') previewText = '🎥 Video';
  else if (options.type === 'audio') previewText = '🎤 Audio';

  // Write message and update lastMessage atomically
  const updates = {};
  updates[`messages/${conversationId}/${msgRef.key}`] = msgObj;
  updates[`conversations/${conversationId}/lastMessage`] = {
    text: previewText,
    sender: user.displayName || 'Anónimo',
    timestamp: msgObj.timestamp,
    type: options.type || 'text'
  };

  // Fetch conversation to update unread counts and send push notifications
  try {
    const convSnap = await get(ref(db, `conversations/${conversationId}`));
    if (convSnap.exists()) {
      const conv = convSnap.val();
      const otherUids = Object.keys(conv.members || {}).filter(uid => uid !== user.uid);
      
      // Increment unread count
      const unreadCount = conv.unreadCount || {};
      for (const uid of otherUids) {
          unreadCount[uid] = (unreadCount[uid] || 0) + 1;
      }
      updates[`conversations/${conversationId}/unreadCount`] = unreadCount;

      // Send Push Notification
      if (otherUids.length > 0) {
        const k1 = 'os_v2_app_c7ibfd4fxvdotnlv4xfymv2suoa44z';
        const k2 = 'f34txepbe2opw257wkaaoo55fn5wgbgxczxv4ygw6yk62o45kqrwflsvirsew4tuzt2rdgfxa';
        fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + k1 + k2
          },
          body: JSON.stringify({
            app_id: "17d0128f-85bd-46e9-b575-e5cb865752a3",
            include_external_user_ids: otherUids,
            headings: { "en": user.displayName || "Nuevo mensaje", "es": user.displayName || "Nuevo mensaje" },
            contents: { "en": msgObj.isLocked ? "🔒 Mensaje cifrado" : previewText, "es": msgObj.isLocked ? "🔒 Mensaje cifrado" : previewText }
          })
        }).catch(e => console.warn('OneSignal send error:', e));
      }
    }
  } catch (e) {
    console.warn("Could not process unread/push:", e);
  }

  await update(ref(db), updates);

  return msgRef;
}

/**
 * Starts cleanup interval for expired messages in a conversation.
 */
export function startCleanupInterval(conversationId) {
  const intervalId = setInterval(async () => {
    try {
      const snapshot = await get(ref(db, `messages/${conversationId}`));
      if (!snapshot.exists()) return;

      const now = Date.now();
      const messages = snapshot.val();

      for (const key of Object.keys(messages)) {
        const msg = messages[key];
        if (msg.expiresAt < now) {
          // Delete media from Storage if it exists
          if (msg.mediaPath) {
            await deleteMedia(msg.mediaPath);
          }
          await remove(ref(db, `messages/${conversationId}/${key}`));
        }
      }
    } catch (error) {
      console.error('[Messages] Cleanup error:', error);
    }
  }, 15000);

  return intervalId;
}

/**
 * Stops the cleanup interval.
 */
export function stopCleanupInterval(intervalId) {
  clearInterval(intervalId);
}

/**
 * Formats a timestamp to HH:MM (24h, zero-padded).
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Returns the available TTL options.
 */
export function getTTLOptions() {
  return [
    { label: 'Permanente', value: 0 },
    { label: '1 min', value: 60000 },
    { label: '5 min', value: 300000 },
    { label: '15 min', value: 900000 },
    { label: '1 hora', value: 3600000 },
    { label: '24 horas', value: 86400000 }
  ];
}

/**
 * Calculates remaining time as a ratio (0 to 1).
 */
export function getRemainingTime(expiresAt, ttl) {
  const now = Date.now();
  if (now >= expiresAt) return 0;
  const remaining = expiresAt - now;
  if (ttl && ttl > 0) return Math.min(1, remaining / ttl);
  return 1;
}

/**
 * Marks a view-once message as viewed by a user.
 */
export async function markViewOnce(conversationId, messageId, userId) {
  await set(ref(db, `messages/${conversationId}/${messageId}/viewedBy/${userId}`), true);
}

/**
 * Checks if all members (excluding sender) have viewed a view-once message.
 */
export function checkAllViewed(message, memberCount) {
  const viewedCount = Object.keys(message.viewedBy || {}).length;
  // memberCount - 1 because sender doesn't need to view it
  return viewedCount >= (memberCount - 1);
}

/**
 * Manually deletes a message for everyone.
 */
export async function deleteMessage(conversationId, messageId) {
  try {
    const snap = await get(ref(db, `messages/${conversationId}/${messageId}`));
    if (snap.exists()) {
      const msg = snap.val();
      if (msg.mediaPath) {
        deleteMedia(msg.mediaPath);
      }
      await remove(ref(db, `messages/${conversationId}/${messageId}`));
    }
  } catch (e) {
    console.error('Failed to delete message:', e);
  }
}

/**
 * Deletes the entire conversation for everyone.
 */
export async function deleteConversation(conversationId) {
  try {
    await remove(ref(db, `messages/${conversationId}`));
    await remove(ref(db, `conversations/${conversationId}`));
  } catch (e) {
    console.error('Failed to delete conversation:', e);
  }
}
