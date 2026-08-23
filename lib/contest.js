import { isValidPhone, normalizePhone, phoneKey, toWhatsAppDigits } from './phone.js';
import { confirmationMessage, invitationMessage } from './messages.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import {
  addInvite,
  enqueueWa,
  getContactById,
  getContactByPhoneKey,
  getContactByToken,
  listPendingWa,
  newId,
  newToken,
  recordEvent,
  syncPortetClient,
  syncTunnelLead,
  updateQueue,
  upsertContact,
} from './store.js';

export const SALLES = [
  { id: 'minimes', label: 'Minimes' },
  { id: 'st-cyprien', label: 'Saint-Cyprien' },
  { id: 'ramonville', label: 'Ramonville' },
  { id: 'etats-unis', label: 'États-Unis' },
  { id: 'portet', label: 'Portet' },
];

const NAME_MAX = 80;

function cleanText(v, max = NAME_MAX) {
  const s = String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
  return s || '';
}

function truthy(v) {
  return v === true || v === 'true' || v === '1' || v === 'on';
}

function parseEmail(v) {
  const email = cleanText(v, 160);
  if (!email) return { ok: true, email: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, email: null };
  return { ok: true, email };
}

/** 1 ticket de base, +1 par email (le tien et ceux de tes ami(e)s). */
export function ticketCount({ email, friends = [] } = {}) {
  let n = 1;
  if (email) n += 1;
  for (const f of friends) if (f?.email) n += 1;
  return n;
}

export function parseEntry(body) {
  const errors = [];
  const prenom = cleanText(body.prenom);
  const nom = cleanText(body.nom);
  const telephoneRaw = String(body.telephone || body.tel || '').trim();
  const ownMail = parseEmail(body.email);
  const salle = cleanText(body.salle, 40);
  const ville = cleanText(body.ville, 80);
  const source = cleanText(body.source || body.src, 40) || 'direct';
  const invite_token = cleanText(body.invite_token || body.inv, 64);

  if (!prenom) errors.push({ field: 'prenom', message: 'Prénom requis' });
  if (!nom) errors.push({ field: 'nom', message: 'Nom requis' });
  if (!telephoneRaw) errors.push({ field: 'telephone', message: 'Téléphone requis' });
  if (!ownMail.ok) errors.push({ field: 'email', message: 'Email invalide' });

  const participantPhone = normalizePhone(telephoneRaw);
  if (telephoneRaw && !participantPhone) {
    errors.push({ field: 'telephone', message: 'Numéro invalide' });
  }

  const friendsIn = Array.isArray(body.friends)
    ? body.friends
    : [body.ami1 || body.friend1, body.ami2 || body.friend2].filter(Boolean);

  if (friendsIn.length < 2) {
    errors.push({ field: 'friends', message: 'Deux ami(e)s sont requis' });
  }

  const friends = [0, 1].map((i) => {
    const f = friendsIn[i] || {};
    const mail = parseEmail(f.email);
    if (!mail.ok) errors.push({ field: `ami${i + 1}_email`, message: `Email ami(e) ${i + 1} invalide` });
    return {
      prenom: cleanText(f.prenom),
      nom: cleanText(f.nom),
      telephone: String(f.telephone || f.tel || '').trim(),
      email: mail.email,
    };
  });

  friends.forEach((f, i) => {
    const n = i + 1;
    if (!f.prenom) errors.push({ field: `ami${n}_prenom`, message: `Prénom ami(e) ${n} requis` });
    if (!f.nom) errors.push({ field: `ami${n}_nom`, message: `Nom ami(e) ${n} requis` });
    if (!f.telephone) errors.push({ field: `ami${n}_telephone`, message: `Téléphone ami(e) ${n} requis` });
  });

  if (!truthy(body.consent_age)) {
    errors.push({ field: 'consent_age', message: 'Confirmation d’âge requise' });
  }
  if (!truthy(body.consent_reglement)) {
    errors.push({ field: 'consent_reglement', message: 'Acceptation du règlement requise' });
  }
  if (!truthy(body.consent_wa)) {
    errors.push({ field: 'consent_wa', message: 'Accord WhatsApp requis' });
  }
  if (!truthy(body.consent_friends)) {
    errors.push({ field: 'consent_friends', message: 'Accord des ami(e)s requis' });
  }

  const pKey = phoneKey(telephoneRaw);
  const fKeys = friends.map((f) => phoneKey(f.telephone));
  if (pKey && fKeys.includes(pKey)) {
    errors.push({ field: 'friends', message: 'Un ami(e) ne peut pas avoir le même numéro que vous' });
  }
  if (fKeys[0] && fKeys[1] && fKeys[0] === fKeys[1]) {
    errors.push({ field: 'friends', message: 'Les deux ami(e)s doivent avoir des numéros différents' });
  }

  return {
    ok: errors.length === 0,
    errors,
    data: {
      prenom,
      nom,
      telephone: participantPhone || telephoneRaw,
      phone_key: pKey,
      email: ownMail.email,
      salle: salle || null,
      ville: ville || null,
      source,
      invite_token: invite_token || null,
      friends,
    },
  };
}

function isRegistered(contact) {
  return contact && (contact.status === 'inscrit' || contact.status === 'inscription_finalisee');
}

async function saveFriend({ friend, inviter, source, publicUrl }) {
  const key = phoneKey(friend.telephone) || `x-${String(friend.telephone).replace(/\W/g, '').slice(0, 20)}`;
  const valid = isValidPhone(friend.telephone);
  const waPhone = valid ? toWhatsAppDigits(friend.telephone) : '';
  const existing = await getContactByPhoneKey(key);

  if (existing) {
    await addInvite({ inviter_id: inviter.id, invitee_id: existing.id });
    const skipWa =
      isRegistered(existing) ||
      existing.wa_status === 'sent' ||
      existing.status === 'invite';
    return {
      contact: existing,
      created: false,
      duplicate: true,
      invalid: existing.status === 'numero_invalide',
      skipWa,
      reason: isRegistered(existing) ? 'already_registered' : 'already_invited',
    };
  }

  const contact = await upsertContact({
    id: newId(),
    phone_key: key,
    telephone: valid ? waPhone : friend.telephone,
    prenom: friend.prenom,
    nom: friend.nom,
    email: friend.email || null,
    salle: null,
    ville: null,
    source,
    role: 'invite',
    status: valid ? 'invite' : 'numero_invalide',
    wa_status: valid ? 'pending' : 'skipped',
    wa_error: valid ? null : 'numero_invalide',
    invited_by_id: inviter.id,
    invite_token: newToken(),
  });

  await addInvite({ inviter_id: inviter.id, invitee_id: contact.id });

  if (valid) {
    const link = `${publicUrl}/?inv=${encodeURIComponent(contact.invite_token)}`;
    await enqueueWa({
      kind: 'invitation',
      contact_id: contact.id,
      phone: contact.telephone,
      message: invitationMessage({
        friendPrenom: contact.prenom,
        referrerPrenom: inviter.prenom,
        referrerNom: inviter.nom,
        link,
      }),
    });
  }

  syncTunnelLead(contact, {
    referrer_prenom: inviter.prenom,
    referrer_nom: inviter.nom,
    referrer_phone: inviter.telephone,
  }).catch(() => {});
  if (valid) syncPortetClient(contact).catch(() => {});

  return {
    contact,
    created: true,
    duplicate: false,
    invalid: !valid,
    skipWa: !valid,
    reason: valid ? 'invited' : 'numero_invalide',
  };
}

export async function enterContest(body, { publicUrl, dryRun = false } = {}) {
  const parsed = parseEntry(body);
  if (!parsed.ok) {
    return { ok: false, status: 400, errors: parsed.errors };
  }
  const input = parsed.data;

  let invitedAs = null;
  if (input.invite_token) {
    invitedAs = await getContactByToken(input.invite_token);
    if (!invitedAs) {
      return {
        ok: false,
        status: 400,
        errors: [{ field: 'invite_token', message: 'Lien d’invitation invalide' }],
      };
    }
    const invitedKey = phoneKey(invitedAs.telephone);
    if (invitedKey && invitedKey !== input.phone_key) {
      return {
        ok: false,
        status: 400,
        errors: [{ field: 'telephone', message: 'Ce lien est lié à un autre numéro' }],
      };
    }
  }

  const existing = await getContactByPhoneKey(input.phone_key);

  if (existing && isRegistered(existing) && !invitedAs) {
    await recordEvent({
      type: 'duplicate',
      source: input.source,
      contact_id: existing.id,
      meta: { reason: 'already_registered' },
    });
    return {
      ok: true,
      status: 200,
      already_registered: true,
      participant: publicContact(existing),
      friends: [],
      whatsapp: { queued: 0 },
    };
  }

  const now = new Date().toISOString();
  const wasInvite = existing?.status === 'invite' || Boolean(invitedAs);
  const participant = await upsertContact({
    ...(existing || {}),
    ...(invitedAs && !existing ? invitedAs : {}),
    id: invitedAs?.id || existing?.id || newId(),
    phone_key: input.phone_key,
    telephone: toWhatsAppDigits(input.telephone),
    prenom: input.prenom,
    nom: input.nom,
    email: input.email,
    tickets: ticketCount(input),
    salle: input.salle,
    ville: input.ville,
    source: input.source || existing?.source || invitedAs?.source,
    role: wasInvite ? 'invite' : 'participant',
    status: wasInvite ? 'inscription_finalisee' : 'inscrit',
    wa_status: existing && isRegistered(existing) ? existing.wa_status : 'pending',
    wa_error: null,
    invited_by_id: invitedAs?.invited_by_id || existing?.invited_by_id || null,
    invite_token: invitedAs?.invite_token || existing?.invite_token || newToken(),
    finalized_at: wasInvite ? now : existing?.finalized_at || null,
  });

  const sendConfirm = participant.wa_status !== 'sent';
  if (sendConfirm) {
    await enqueueWa({
      kind: 'confirmation',
      contact_id: participant.id,
      phone: participant.telephone,
      message: confirmationMessage(participant.prenom),
    });
  }

  const friendResults = [];
  for (const friend of input.friends) {
    const result = await saveFriend({
      friend,
      inviter: participant,
      source: input.source,
      publicUrl,
    });
    friendResults.push(result);
    if (result.duplicate) {
      await recordEvent({
        type: 'duplicate',
        source: input.source,
        contact_id: result.contact.id,
        meta: { reason: result.reason, inviter_id: participant.id },
      });
    }
  }

  await recordEvent({
    type: 'form_submit',
    source: input.source,
    contact_id: participant.id,
    meta: { friends: friendResults.length, invite: Boolean(invitedAs) },
  });

  syncTunnelLead(participant).catch(() => {});
  syncPortetClient(participant).catch(() => {});

  const wa = await processWaQueue({ dryRun, limit: 8 });

  return {
    ok: true,
    status: 200,
    already_registered: false,
    dry_run: dryRun,
    participant: publicContact(participant),
    friends: friendResults.map((f) => ({
      prenom: f.contact.prenom,
      nom: f.contact.nom,
      status: f.contact.status,
      duplicate: f.duplicate,
      invalid: f.invalid,
      reason: f.reason,
      wa_status: f.skipWa ? 'skipped' : f.contact.wa_status,
    })),
    whatsapp: wa,
  };
}

function publicContact(c) {
  return {
    id: c.id,
    prenom: c.prenom,
    nom: c.nom,
    status: c.status,
    role: c.role,
  };
}

export async function processWaQueue({ dryRun = false, limit = 20 } = {}) {
  const jobs = await listPendingWa(limit);
  let sent = 0;
  let errors = 0;
  let skipped = 0;
  for (const job of jobs) {
    try {
      const result = await sendWhatsAppMessage(job.phone, job.message, { dryRun });
      if (result.sent) {
        sent += 1;
        await updateQueue(job.id, { status: 'sent', attempts: (job.attempts || 0) + 1, last_error: null });
        const contact = await getContactById(job.contact_id);
        if (contact) {
          await upsertContact({ ...contact, wa_status: 'sent', wa_error: null });
        }
        await recordEvent({
          type: 'wa_sent',
          contact_id: job.contact_id,
          meta: { kind: job.kind, dry_run: dryRun, reason: result.reason || null },
        });
      } else if (result.reason === 'whatsapp_not_configured') {
        skipped += 1;
        await updateQueue(job.id, {
          status: dryRun ? 'sent' : 'pending',
          attempts: (job.attempts || 0) + 1,
          last_error: result.reason,
        });
      } else {
        throw new Error(result.reason || 'envoi_refuse');
      }
    } catch (err) {
      errors += 1;
      const message = err.message || 'erreur_technique';
      await updateQueue(job.id, {
        status: 'pending',
        attempts: (job.attempts || 0) + 1,
        last_error: message,
      });
      const contact = await getContactById(job.contact_id);
      if (contact) {
        await upsertContact({ ...contact, wa_status: 'error', wa_error: message });
      }
      await recordEvent({
        type: 'wa_error',
        contact_id: job.contact_id,
        meta: { kind: job.kind, error: message },
      });
    }
  }
  return { queued: jobs.length, sent, errors, skipped };
}

export function kpis({ contacts, invites, events, queue }) {
  const visitors = events.filter((e) => e.type === 'page_vue').length;
  const formStarted = events.filter((e) => e.type === 'form_start').length;
  const formSubmit = events.filter((e) => e.type === 'form_submit').length;
  const inscrits = contacts.filter((c) => c.status === 'inscrit' || c.status === 'inscription_finalisee').length;
  const withEmail = contacts.filter((c) => String(c.email || '').includes('@')).length;
  const ticketsTotal = contacts.reduce((sum, c) => sum + Number(c.tickets || (c.email ? 2 : 1)), 0);
  const invitesCount = contacts.filter((c) => c.role === 'invite' || c.status === 'invite').length;
  const finalises = contacts.filter((c) => c.status === 'inscription_finalisee').length;
  const waSent = queue.filter((q) => q.status === 'sent').length;
  const waErrors = contacts.filter((c) => c.wa_status === 'error').length + events.filter((e) => e.type === 'wa_error').length;
  const duplicates = events.filter((e) => e.type === 'duplicate').length + contacts.filter((c) => c.status === 'doublon').length;
  const bySource = {};
  for (const c of contacts) {
    const s = c.source || 'direct';
    bySource[s] = (bySource[s] || 0) + 1;
  }
  const generatedBy = {};
  for (const inv of invites) {
    generatedBy[inv.inviter_id] = (generatedBy[inv.inviter_id] || 0) + 1;
  }
  return {
    visitors,
    form_started: formStarted,
    form_submitted: formSubmit,
    inscrits,
    with_email: withEmail,
    tickets_total: ticketsTotal,
    amis_invites: invitesCount,
    amis_finalises: finalises,
    taux_invite_inscrit: invitesCount ? Math.round((finalises / invitesCount) * 1000) / 10 : 0,
    wa_sent: waSent,
    wa_errors: waErrors,
    contacts_total: contacts.length,
    doublons: duplicates,
    by_source: bySource,
    generated_by: generatedBy,
  };
}
