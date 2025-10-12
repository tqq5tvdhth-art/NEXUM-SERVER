import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find the demo group and members
  const group = await prisma.group.findFirst({ where: { name: 'demo' } });
  if (!group) throw new Error('demo group not found');

  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true }
  });
  if (members.length === 0) throw new Error('no members in demo group');

  // Use first 2 members for messages
  const u1 = members[0].user.id;
  const u2 = members[1]?.user.id ?? members[0].user.id;

  // Recent messages mentioning ideas and times
  const now = new Date();
  const msgs = [
    { text: "Anyone up for sushi this Friday evening?", at: -2 }, // 2 days ago
    { text: "Bowling or arcade could be fun too!", at: -1 },       // 1 day ago
    { text: "I’m free 7–9pm tomorrow.", at: 0 }                    // today
  ];

  for (let i = 0; i < msgs.length; i++) {
    const when = new Date(now.getTime() + msgs[i].at * 24*60*60*1000);
    await prisma.message.create({
      data: {
        groupId: group.id,
        userId: i % 2 === 0 ? u1 : u2,
        text: msgs[i].text,
        createdAt: when
      }
    });
  }

  console.log('Seeded demo chat messages ✔');
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
