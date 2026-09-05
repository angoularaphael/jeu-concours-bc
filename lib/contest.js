import { isValidPhone, normalizePhone, phoneKey, toWhatsAppDigits } from './phone.js';
import { confirmationEmail, invitationEmail } from './david-email.js';
import { sendDavidMail } from './email.js';
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

import { SALLES, salleById } from './salles.js';

export { SALLES };

const NAME_MAX = 80;
const EMAIL_MAX = 120;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(v, max = NAME_MAX) {
  const s = String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
  return s || '';
}

function cleanEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .slice(0, EMAIL_MAX);
}

function isValidEmail(v) {
  return EMAIL_OK.test(v) && !v.includes('..');
}

function truthy(v) {
  return v === true || v === 'true' || v === '1' || v === 'on';
}

const PROOF_MAX = 900_000;
const PROOF_OK = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

function parseAvisList(raw) {
  const src = Array.isArray(raw)
    ? raw
    : [{
        salle: raw?.avis_salle_0 || raw?.avis0_salle,
        proof: raw?.avis_proof_0 || raw?.avis0_proof,
      }];
  const avis = [];
  for (const item of src.slice(0, 1)) {
    const salleId = cleanText(item?.salle, 40);
    const proof = String(item?.proof || '').trim();
    if (!salleId && !proof) continue;
    if (!salleById(salleId)) {
      return { ok: false, error: { field: 'avis', message: 'Salle d’avis inconnue' }, avis: [] };
    }
    if (!PROOF_OK.test(proof) || proof.length > PROOF_MAX) {
      return { ok: false, error: { field: 'avis', message: 'Ajoute un screen de ton avis Google (photo)' }, avis: [] };
    }
    avis.push({ salle: salleId, proof });
  }
  return { ok: true, avis };
}

/** 1 ticket grâce aux ami(e)s, +1 ticket grâce à 1 avis Google — max 2. */
export function ticketCount({ avis = [] } = {}) {
  return 1 + (Array.isArray(avis) && avis.length > 0 ? 1 : 0);
}

export function parseEntry(body) {
  const errors = [];
  const prenom = cleanText(body.prenom);
  const nom = cleanText(body.nom);
  const telephoneRaw = String(body.telephone || body.tel || '').trim();
  const email = cleanEmail(body.email);
  const salle = cleanText(body.salle, 40);
  const ville = cleanText(body.ville, 80);
  const source = cleanText(body.source || body.src, 40) || 'direct';
  const invite_token = cleanText(body.invite_token || body.inv, 64);
  const avisParsed = parseAvisList(body.avis || body);

  if (!prenom) errors.push({ field: 'prenom', message: 'Prénom requis' });
  if (!nom) errors.push({ field: 'nom', message: 'Nom requis' });
  if (!telephoneRaw) errors.push({ field: 'telephone', message: 'Téléphone requis' });
  if (!email) errors.push({ field: 'email', message: 'Email requis' });
  else if (!isValidEmail(email)) errors.push({ field: 'email', message: 'Email invalide' });
  if (!avisParsed.ok) errors.push(avisParsed.error);

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
    return {
      prenom: cleanText(f.prenom),
      nom: cleanText(f.nom),
      telephone: String(f.telephone || f.tel || '').trim(),
      email: cleanEmail(f.email),
    };
  });

  friends.forEach((f, i) => {
    const n = i + 1;
    if (!f.prenom) errors.push({ field: `ami${n}_prenom`, message: `Prénom ami(e) ${n} requis` });
    if (!f.nom) errors.push({ field: `ami${n}_nom`, message: `Nom ami(e) ${n} requis` });
    if (!f.telephone) errors.push({ field: `ami${n}_telephone`, message: `Téléphone ami(e) ${n} requis` });
    if (f.email && !isValidEmail(f.email)) {
      errors.push({ field: `ami${n}_email`, message: `Email ami(e) ${n} invalide` });
    }
  });

  if (!truthy(body.consent_age)) {
    errors.push({ field: 'consent_age', message: 'Confirmation d’âge requise' });
  }
  if (!truthy(body.consent_reglement)) {
    errors.push({ field: 'consent_reglement', message: 'Acceptation du règlement requise' });
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
  const fEmails = friends.map((f) => f.email).filter(Boolean);
  if (email && fEmails.includes(email)) {
    errors.push({ field: 'friends', message: 'Un ami(e) ne peut pas avoir le même email que vous' });
  }
  if (fEmails[0] && fEmails[1] && fEmails[0] === fEmails[1]) {
    errors.push({ field: 'friends', message: 'Les deux ami(e)s doivent avoir des emails différents' });
  }

  return {
    ok: errors.length === 0,
    errors,
    data: {
      prenom,
      nom,
      telephone: participantPhone || telephoneRaw,
      email,
      phone_key: pKey,
      salle: salle || null,
      ville: ville || null,
      source,
      invite_token: invite_token || null,
      avis: avisParsed.avis,
      friends,
    },
  };
}

function isRegistered(contact) {
  return contact && (contact.status === 'inscrit' || contact.status === 'inscription_finalisee');
}

async function saveFriend({ friend, inviter, source, publicUrl, dryRun = false }) {
  const key = phoneKey(friend.telephone) || `x-${String(friend.telephone).replace(/\W/g, '').slice(0, 20)}`;
  const valid = isValidPhone(friend.telephone);
  const waPhone = valid ? toWhatsAppDigits(friend.telephone) : '';
  const existing = await getContactByPhoneKey(key);

  if (existing) {
    const emailWasNew = Boolean(friend.email && friend.email !== existing.email);
    const patched =
      emailWasNew ? await upsertContact({ ...existing, email: friend.email }) : existing;
    await addInvite({ inviter_id: inviter.id, invitee_id: patched.id });
    const skipWa =
      isRegistered(patched) ||
      patched.wa_status === 'sent' ||
      patched.status === 'invite';
    let mail = { sent: false, reason: 'skipped' };
    if (!isRegistered(patched) && emailWasNew && patched.email && patched.invite_token) {
      const link = `${publicUrl}/?inv=${encodeURIComponent(patched.invite_token)}`;
      mail = await sendDavidMail(
        invitationEmail({
          friendPrenom: patched.prenom,
          referrerPrenom: inviter.prenom,
          link,
        }),
        { to: patched.email, dryRun }
      );
      await recordEvent({
        type: mail.sent ? 'email_sent' : 'email_error',
        source,
        contact_id: patched.id,
        meta: { kind: 'invitation', duplicate: true, ...mail },
      });
    }
    return {
      contact: patched,
      created: false,
      duplicate: true,
      invalid: patched.status === 'numero_invalide',
      skipWa,
      mail,
      reason: isRegistered(patched) ? 'already_registered' : 'already_invited',
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

  const link = `${publicUrl}/?inv=${encodeURIComponent(contact.invite_token)}`;
  if (valid) {
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
  let mail = { sent: false, reason: 'skipped' };
  if (contact.email) {
    mail = await sendDavidMail(
      invitationEmail({
        friendPrenom: contact.prenom,
        referrerPrenom: inviter.prenom,
        link,
      }),
      { to: contact.email, dryRun }
    );
    await recordEvent({
      type: mail.sent ? 'email_sent' : 'email_error',
      source,
      contact_id: contact.id,
      meta: { kind: 'invitation', ...mail },
    });
  }

  syncTunnelLead(contact, {
    referrer_prenom: inviter.prenom,
    referrer_nom: inviter.nom,
    referrer_phone: inviter.telephone,
  }).catch((err) => console.error('syncTunnelLead ami', err));
  if (valid) {
    syncPortetClient(contact).catch((err) => console.error('syncPortetClient ami', err));
  }

  return {
    contact,
    created: true,
    duplicate: false,
    invalid: !valid,
    skipWa: !valid,
    mail,
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
    const friendResults = [];
    for (const friend of input.friends) {
      const result = await saveFriend({
        friend,
        inviter: existing,
        source: input.source,
        publicUrl,
        dryRun,
      });
      friendResults.push(result);
      if (result.duplicate) {
        await recordEvent({
          type: 'duplicate',
          source: input.source,
          contact_id: result.contact.id,
          meta: { reason: result.reason, inviter_id: existing.id },
        });
      }
    }
    const wa = await processWaQueue({ dryRun, limit: 8 });
    await recordEvent({
      type: 'duplicate',
      source: input.source,
      contact_id: existing.id,
      meta: { reason: 'already_registered', friends: friendResults.length },
    });
    return {
      ok: true,
      status: 200,
      already_registered: true,
      participant: publicContact(existing),
      friends: friendResults.map((f) => ({
        prenom: f.contact.prenom,
        nom: f.contact.nom,
        email: f.contact.email || null,
        status: f.contact.status,
        duplicate: f.duplicate,
        invalid: f.invalid,
        reason: f.reason,
        wa_status: f.skipWa ? 'skipped' : f.contact.wa_status,
        email_sent: Boolean(f.mail?.sent),
      })),
      whatsapp: wa,
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
    email: input.email || existing?.email || invitedAs?.email || null,
    tickets: ticketCount(input),
    avis: input.avis,
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
  let confirmMail = { sent: false, reason: 'skipped' };
  if (sendConfirm && participant.email) {
    confirmMail = await sendDavidMail(
      confirmationEmail({ prenom: participant.prenom, publicUrl }),
      { to: participant.email, dryRun }
    );
    await recordEvent({
      type: confirmMail.sent ? 'email_sent' : 'email_error',
      source: input.source,
      contact_id: participant.id,
      meta: { kind: 'confirmation', ...confirmMail },
    });
  }

  const friendResults = [];
  for (const friend of input.friends) {
    const result = await saveFriend({
      friend,
      inviter: participant,
      source: input.source,
      publicUrl,
      dryRun,
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
    meta: { friends: friendResults.length, invite: Boolean(invitedAs), avis: (input.avis || []).length },
  });

  const [, portet] = await Promise.all([
    syncTunnelLead(participant).catch((err) => {
      console.error('syncTunnelLead', err);
      return { ok: false, reason: err.message };
    }),
    syncPortetClient(participant).catch((err) => {
      console.error('syncPortetClient', err);
      return { ok: false, reason: err.message };
    }),
  ]);

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
      email: f.contact.email || null,
      status: f.contact.status,
      duplicate: f.duplicate,
      invalid: f.invalid,
      reason: f.reason,
      wa_status: f.skipWa ? 'skipped' : f.contact.wa_status,
      email_sent: Boolean(f.mail?.sent),
    })),
    whatsapp: wa,
    email: confirmMail,
    portet,
  };
}

function publicContact(c) {
  return {
    id: c.id,
    prenom: c.prenom,
    nom: c.nom,
    email: c.email || null,
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
          meta: { kind: job.kind, dry_run: dryRun, reason: result.reason || null, via: result.via || 'sms' },
        });
      } else if (result.reason === 'numero_invalide') {
        skipped += 1;
        await updateQueue(job.id, {
          status: 'skipped',
          attempts: (job.attempts || 0) + 1,
          last_error: result.reason,
        });
        const contact = await getContactById(job.contact_id);
        if (contact) {
          await upsertContact({ ...contact, wa_status: 'skipped', wa_error: result.reason });
        }
      } else if (result.reason === 'whatsapp_not_configured' || result.reason === 'sms_not_configured') {
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
  const withAvis = contacts.filter((c) => Array.isArray(c.avis) && c.avis.length > 0).length;
  const ticketsTotal = contacts.reduce((sum, c) => {
    const avisN = Array.isArray(c.avis) ? c.avis.length : 0;
    return sum + Number(c.tickets || 1 + avisN);
  }, 0);
  const invitesCount = contacts.filter(
    (c) => c.invited_by_id || c.role === 'invite' || c.status === 'invite'
  ).length;
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
  const countedInvitees = new Set();
  for (const inv of invites) {
    if (!inv.inviter_id || !inv.invitee_id) continue;
    generatedBy[inv.inviter_id] = (generatedBy[inv.inviter_id] || 0) + 1;
    countedInvitees.add(inv.invitee_id);
  }
  for (const c of contacts) {
    if (!c.invited_by_id || countedInvitees.has(c.id)) continue;
    generatedBy[c.invited_by_id] = (generatedBy[c.invited_by_id] || 0) + 1;
  }
  return {
    visitors,
    form_started: formStarted,
    form_submitted: formSubmit,
    inscrits,
    with_avis: withAvis,
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
