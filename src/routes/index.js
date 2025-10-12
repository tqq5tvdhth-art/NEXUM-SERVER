import express from 'express';
import { PrismaClient } from '@prisma/client';
import { extractHintsFromChat, extractHintsFromProfiles } from '../lib/extractors.js';
import { findOverlappingSlots } from '../lib/availability.js';
import { computeMidpoint } from '../lib/geo.js';
import { placesSearch } from '../lib/places.js';
import { rank } from '../lib/rank.js';

const prisma = new PrismaClient();
export const router = express.Router();

// Seed a simple demo group/users if missing
async function ensureDemo() {
  let g = await prisma.group.findFirst({ where: { name: 'demo' } });
  if (!g) {
    const u1 = await prisma.user.create({ data: { name: 'Alice', homeLat: -33.86, homeLng: 151.20 }});
    const u2 = await prisma.user.create({ data: { name: 'Bob',   homeLat: -33.87, homeLng: 151.18 }});
    const u3 = await prisma.user.create({ data: { name: 'Cara',  homeLat: -33.88, homeLng: 151.22 }});
    g = await prisma.group.create({ data: { name: 'demo' }});
    await prisma.groupMember.createMany({
      data: [
        { groupId: g.id, userId: u1.id, role: 'leader' },
        { groupId: g.id, userId: u2.id, role: 'member' },
        { groupId: g.id, userId: u3.id, role: 'member' }
      ]
    });
    await prisma.aIPrefs.create({ data: { groupId: g.id } });
  }
  return g;
}

// Save/Update AI prefs
router.post('/groups/:groupId/ai-prefs', async (req, res) => {
  try {
    await ensureDemo();
    const group = req.params.groupId === 'demo'
      ? await prisma.group.findFirst({ where: { name: 'demo' } })
      : await prisma.group.findUnique({ where: { id: req.params.groupId } });

    if (!group) return res.status(404).json({ error: 'group not found' });

    // MVP "leader" check (header flag)
    if (req.header('X-Demo-Leader') !== 'true') {
      return res.status(403).json({ error: 'leader required (X-Demo-Leader: true)' });
    }

    const data = {
      readChatOn:            !!req.body.readChatOn,
      planFromProfilesOn:    !!req.body.planFromProfilesOn,
      readChatWindowDays:    Number(req.body.readChatWindowDays ?? 14),
      planFromProfilesFreq:  String(req.body.planFromProfilesFreq ?? 'WEEKLY'),
      notifyChannel:         String(req.body.notifyChannel ?? 'CHAT')
    };

    const up = await prisma.aIPrefs.upsert({
      where: { groupId: group.id },
      update: data,
      create: { groupId: group.id, ...data }
    });

    res.json(up);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'prefs failed' });
  }
});

// Trigger suggestions (manual)
router.post('/groups/:groupId/suggest', async (req, res) => {
  try {
    const gDemo = await ensureDemo();
    const target = req.params.groupId === 'demo'
      ? gDemo
      : await prisma.group.findUnique({ where: { id: req.params.groupId } });

    if (!target) return res.status(404).json({ error: 'group not found' });

    const prefs = await prisma.aIPrefs.findUnique({ where: { groupId: target.id } });
    const mode = String(req.body?.mode || 'profiles').toUpperCase();

    if (mode === 'CHAT' && !prefs?.readChatOn)           return res.status(400).json({ error: 'chat scan is off' });
    if (mode === 'PROFILES' && !prefs?.planFromProfilesOn) return res.status(400).json({ error: 'profiles planning is off' });

    const members = await prisma.groupMember.findMany({
      where: { groupId: target.id },
      include: { user: true }
    });

    // Collect profiles
    const userIds = members.map(m => m.userId);
    const interests = await prisma.interest.findMany({ where: { userId: { in: userIds } } });
    const bucket    = await prisma.bucketItem.findMany({ where: { userId: { in: userIds } } });

    const profiles = members.map(m => ({
      userId: m.userId,
      interests: interests.filter(i => i.userId === m.userId),
      bucket:    bucket.filter(b => b.userId === m.userId),
      user:      m.user
    }));

    // Hints
    let hints;
    if (mode === 'CHAT') {
      const since = new Date(Date.now() - (prefs?.readChatWindowDays || 14) * 24*60*60*1000);
      const messages = await prisma.message.findMany({
        where: { groupId: target.id, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' }
      });
      hints = extractHintsFromChat(messages);
    } else {
      hints = extractHintsFromProfiles(profiles);
    }

    // Time slots + area + venues
    const timeSlots = findOverlappingSlots([]); // MVP: simple fixed 2h slot
    const mid = computeMidpoint(members);
    const venues = await placesSearch({ lat: mid.lat, lng: mid.lng, keywords: hints.keywords, timeWindow: timeSlots[0] });
    const top = rank(venues, timeSlots, members);

    // Save suggestions
    const created = [];
    for (const v of top) {
      const s = await prisma.suggestion.create({
        data: {
          groupId:   target.id,
          title:     `Meetup: ${v.name}`,
          startISO:  timeSlots[0].startISO,
          endISO:    timeSlots[0].endISO,
          venueName: v.name,
          venueLat:  v.lat,
          venueLng:  v.lng,
          source:    mode === 'CHAT' ? 'CHAT' : 'PROFILES',
          status:    'PROPOSED',
          detailsJson: JSON.stringify({ url: v.url, keywords: hints.keywords })
        }
      });
      created.push(s);
    }

    res.json({ suggestions: created });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'suggest failed' });
  }
});

// Suggestion actions
router.post('/suggestions/:id/action', async (req, res) => {
  try {
    const id = req.params.id;
    const action = String(req.body?.action || '').toUpperCase();
    const map = {
      ACCEPT:     'ACCEPTED',
      DECLINE:    'DECLINED',
      DISMISS:    'DISMISSED',
      RESCHEDULE: 'RESCHEDULE_REQUESTED'
    };
    const newStatus = map[action];
    if (!newStatus) return res.status(400).json({ error: 'invalid action' });

    const up = await prisma.suggestion.update({
      where: { id },
      data: { status: newStatus }
    });

    res.json(up);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'action failed' });
  }
});
