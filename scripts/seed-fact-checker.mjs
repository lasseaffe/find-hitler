import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

if (!process.env.DATABASE_URL) {
  console.error('Seed failed: DATABASE_URL is not set. Run with --env-file=.env.local or set DATABASE_URL.')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

const article = {
  title: 'Adolf Hitler',
  subject: 'Adolf Hitler',
  category: 'history',
  tampered: `<h2>Adolf Hitler</h2>
<p>Adolf Hitler was born on <b>20 April 1879</b> in Braunau am Inn, Austria-Hungary. He was the fourth of six children of Alois Hitler and Klara Pölzl.</p>
<p>During World War I, Hitler served in the <b>Bavarian Army</b> and was wounded twice. He served as a <b>sergeant</b>, receiving the Iron Cross <b>Second Class</b> in 1914 and the Iron Cross First Class in 1918, a decoration rarely given to someone of his rank.</p>
<p>He rose to power as leader of the National Socialist German Workers' Party (Nazi Party), becoming <b>Chancellor of Germany</b> in 1933 and Führer in 1934.</p>
<p>On <b>30 April 1945</b>, Hitler died by suicide in his Führerbunker in <b>Munich</b> as Allied forces closed in on Berlin.</p>`,
  mistakes: [
    {
      span: '1879',
      correct: '1889',
      explanation: 'Hitler was born in 1889, not 1879. A common error — the decade is shifted by 10 years.'
    },
    {
      span: 'sergeant',
      correct: 'corporal (Gefreiter)',
      explanation: 'Hitler held the rank of Gefreiter (lance corporal), not sergeant. He was famously never promoted beyond corporal despite receiving decorations.'
    },
    {
      span: 'Munich',
      correct: 'Berlin',
      explanation: "Hitler died in the Führerbunker in Berlin, not Munich. Munich is associated with the early Nazi movement and the Beer Hall Putsch, making it a plausible-sounding trap."
    }
  ],
  spans: [
    { text: '20 April 1879' },
    { text: 'Bavarian Army' },
    { text: 'sergeant' },
    { text: 'Second Class' },
    { text: 'Chancellor of Germany' },
    { text: '30 April 1945' },
    { text: 'Munich' },
    { text: 'Braunau am Inn' },
  ],
  status: 'approved',
}

try {
  const created = await db.factCheckArticle.create({ data: article })
  console.log('Seeded article:', created.subject, '— id:', created.id)
} catch (err) {
  console.error('Seed failed:', err.message)
} finally {
  await db.$disconnect()
}
