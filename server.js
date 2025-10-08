import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/chat', async (req, res) => {
  try {
    const userMsg = (req.body?.message || '').toString().slice(0, 4000);
    if (!userMsg) return res.status(400).json({ error: 'message is required' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are Nexum’s planning assistant. Be concise and actionable.' },
        { role: 'user', content: userMsg }
      ]
    });

    const text = completion.choices?.[0]?.message?.content ?? '';
    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
});

const port = process.env.PORT || 5175;
app.listen(port, () => console.log(`Nexum server listening on :${port}`));
