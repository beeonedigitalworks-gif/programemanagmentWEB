const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const APP_ROOT = path.resolve(__dirname);
const DB_DIR = path.join(APP_ROOT, 'db');
const DB_PATH = path.join(DB_DIR, 'eventalk.sqlite');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, json TEXT)');
  db.get("SELECT json FROM content WHERE key='homepage'", (err, row) => {
    if (err) return console.error(err);
    if (!row) {
      const homepage = {
        programName: 'Developer Conference 2019',
        programPlaceDate: 'December 21-24, 2019. Paris, Italy',
        counts: { participants: 0, programs: 0, teams: 0 },
        services: [
          { title: 'Results', href: '#finalised-results-section', iconClass: 'fa fa-trophy', iconStyle: 'background: linear-gradient(135deg,#2ecc71,#27ae60);' },
          { title: 'Speakers', href: 'speakers.html', iconClass: 'fa fa-microphone', iconStyle: 'background: linear-gradient(135deg,#34495e,#2c3e50);' },
          { title: 'Blog', href: 'blog.html', iconClass: 'fa fa-blog', iconStyle: 'background: linear-gradient(135deg,#1abc9c,#16a085);' },
          { title: 'Team Points', href: 'team-points.html', iconClass: 'fa fa-users', iconStyle: 'background: linear-gradient(135deg,#4cd964,#2ecc71);' },
          { title: 'Schedule', href: 'schedule.html', iconClass: 'fa fa-calendar-alt', iconStyle: 'background: linear-gradient(135deg,#f1c40f,#f39c12);' }
        ]
      };
      db.run('INSERT INTO content(key,json) VALUES(?,?)', ['homepage', JSON.stringify(homepage)], (e) => { if (e) console.error(e); else console.log('Seeded homepage content'); });
    }
  });
  // Seed speakers, schedule, participants, programs, mark entries, categories, final results if missing
  const seeds = [
    ['eventalk_speakers', JSON.stringify([
      { name: 'Jackie Spears', position: 'Entrepreneur', image: 'images/speaker-5.jpg' },
      { name: 'John Adams', position: 'Web Developer', image: 'images/speaker-1.jpg' },
      { name: 'Paul George', position: 'Web Developer', image: 'images/speaker-2.jpg' }
    ])],
    ['eventalk_schedule', JSON.stringify([
      { dayLabel: 'Day 01', date: 'Dec 21, 2019', sessions: [ { time: '09:00', title: 'Opening Keynote', speaker: 'Host', desc: 'Welcome and introduction' } ] },
      { dayLabel: 'Day 02', date: 'Dec 22, 2019', sessions: [ { time: '10:00', title: 'Workshop: Web', speaker: 'John Adams', desc: 'Hands-on web workshop' } ] }
    ])],
    ['eventalk_participants', JSON.stringify([])],
    ['eventalk_programs', JSON.stringify([])],
    ['eventalk_mark_entries', JSON.stringify({})],
    ['eventalk_categories', JSON.stringify([])],
    ['eventalk_final_results', JSON.stringify({})]
  ];
  seeds.forEach(function(s){
    db.get('SELECT json FROM content WHERE key=?', [s[0]], (err, row) => {
      if (err) return console.error(err);
      if (!row) db.run('INSERT INTO content(key,json) VALUES(?,?)', [s[0], s[1]], (e)=>{ if(e) console.error(e); else console.log('Seeded', s[0]); });
    });
  });
});

const app = express();
app.use(express.json());

// Serve the existing static site files from the project root
app.use(express.static(process.cwd()));

app.get('/api/content/:key', (req, res) => {
  const key = req.params.key;
  db.get('SELECT json FROM content WHERE key=?', [key], (err, row) => {
    if (err) return res.status(500).json({ error: 'database error' });
    if (!row) return res.status(404).json({ error: 'not found' });
    try { res.json(JSON.parse(row.json)); } catch (e) { res.json({ data: row.json }); }
  });
});

// List all content keys
app.get('/api/content', (req, res) => {
  db.all('SELECT key FROM content', (err, rows) => {
    if (err) return res.status(500).json({ error: 'database error' });
    res.json(rows.map(r => r.key));
  });
});

// Create or update content for a key
app.post('/api/content/:key', (req, res) => {
  const key = req.params.key;
  let json;
  try { json = JSON.stringify(req.body); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
  db.run('INSERT INTO content(key,json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json', [key, json], function(err){
    if (err) return res.status(500).json({ error: 'database error' });
    res.json({ ok: true });
  });
});

// Delete content key
app.delete('/api/content/:key', (req, res) => {
  const key = req.params.key;
  db.run('DELETE FROM content WHERE key=?', [key], function(err){
    if (err) return res.status(500).json({ error: 'database error' });
    res.json({ ok: true });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on http://localhost:' + port));
